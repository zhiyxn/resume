export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 简单内存缓存，保存最近一次生成的 PDF，便于浏览器查看器下载时复用
const PDF_CACHE: Map<string, { data: Uint8Array; expires: number }> = new Map();

function setPdfTokenCookie(token: string) {
  // 5 分钟有效
  const maxAge = 300;
  return `pdfToken=${token}; Path=/api/pdf; Max-Age=${maxAge}; SameSite=Lax`;
}

function getPdfTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)pdfToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function getOrigin(req: Request) {
  try {
    const u = new URL(req.url);
    if (u.origin) return u.origin;
  } catch {}
  const proto = (req.headers.get("x-forwarded-proto") || req.headers.get("scheme") || "http").split(",")[0].trim();
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

async function toDataUrlIfRemote(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (/^data:/i.test(url)) return url;
  if (/^blob:/i.test(url)) return undefined;
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const ct = res.headers.get("content-type") || "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return url;
  }
}

export async function POST(req: Request, ctx: { params: { filename: string } }) {
  try {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);

    // Body parsing: JSON, form, or raw text(JSON)
    let resumeData: any = null;
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      const body = await req.json().catch(() => null);
      resumeData = body?.resumeData ?? body;
    } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      try {
        const form = await req.formData();
        const val = form.get("resumeData") as any;
        if (typeof val === "string") {
          resumeData = JSON.parse(val);
        } else if (val instanceof Blob) {
          const text = await val.text();
          resumeData = JSON.parse(text);
        }
      } catch {}
    } else {
      const text = await req.text().catch(() => "");
      if (text) {
        try { resumeData = JSON.parse(text); } catch {}
      }
    }

    if (!resumeData) {
      return new Response(JSON.stringify({ error: "Missing resumeData" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const origin = getOrigin(req);
    if (!origin) {
      return new Response(JSON.stringify({ error: "Cannot resolve origin" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const url = `${origin}/print`;

    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || "";
    const executablePath = envPath || (await chromium.executablePath());
    if (!executablePath) {
      return new Response(JSON.stringify({ error: "Chromium executable not found (set PUPPETEER_EXECUTABLE_PATH)" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    const usingSystemChrome = !!envPath;
    const launchArgs = usingSystemChrome
      ? ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"]
      : chromium.args;
    const headless: any = usingSystemChrome ? "new" : chromium.headless;
    const browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: { width: 1200, height: 1600, deviceScaleFactor: 2 },
      executablePath,
      headless,
    });
    const page = await browser.newPage();

    // Prepare data: inline avatar if remote
    const preparedData = { ...resumeData } as any;
    if (preparedData.avatar) {
      preparedData.avatar = await toDataUrlIfRemote(preparedData.avatar);
    }
    await page.evaluateOnNewDocument((data) => {
      try {
        window.sessionStorage.setItem("resumeData", JSON.stringify(data));
      } catch {}
    }, preparedData);
    await page.emulateMediaType("print");
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    try { await page.waitForSelector(".resume-content, .pdf-preview-mode", { timeout: 20000 }); } catch { await new Promise(r => setTimeout(r, 500)); }
    try { /* @ts-ignore puppeteer v23+ */ await page.waitForNetworkIdle({ idleTime: 300, timeout: 10000 }); } catch { await new Promise(r => setTimeout(r, 300)); }
    try {
      await page.waitForFunction(() => {
        const root = document.querySelector('.resume-content');
        if (!root) return false;
        return !!root.querySelector('.ProseMirror, .resume-module p, .resume-module li, .resume-module a, .resume-module span');
      }, { timeout: 30000 });
    } catch {}
    try { await page.evaluate(() => (document as any).fonts && (document as any).fonts.ready); } catch {}

    async function doPrint() {
      return await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true,
      });
    }
    let pdf: Buffer | Uint8Array;
    try {
      pdf = await doPrint();
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (/Target closed|Execution context was destroyed/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 300));
        pdf = await doPrint();
      } else {
        throw e;
      }
    }
    await browser.close();

    // Content-Disposition with filename from URL param
    const inputName = ctx?.params?.filename || "resume.pdf";
    // 解码并确保不会包含换行或路径分隔符
    const rawNameUnsafe = decodeURIComponent(inputName);
    const rawName = rawNameUnsafe.replace(/[\r\n]/g, "_").replace(/\//g, "_");
    const asciiFallback = rawName.replace(/[^\x20-\x7E]/g, "_");
    const utf8Star = `UTF-8''${encodeURIComponent(rawName)}`;

    // 生成并缓存 token，供浏览器下载按钮重复请求（GET）时使用
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    PDF_CACHE.set(token, { data: Buffer.from(pdf), expires: Date.now() + 5 * 60 * 1000 });

    // 关键修复：不要直接返回 PDF 正文。
    // 某些浏览器的内置 PDF 查看器在点击“下载”时，会由扩展上下文发起一个新的 GET 请求，
    // 该请求不会携带 Lax Cookie，导致我们基于 Cookie 的缓存命中失败，出现“下载失败/网络错误”。
    // 这里改为 303 重定向到携带 token 的 GET URL，使后续的查看与下载都使用同一个带 token 的地址，
    // 无需依赖 Cookie，从而避免下载失败。
    const loc = new URL(req.url);
    const redirectUrl = `${loc.origin}/api/pdf/${encodeURIComponent(inputName)}?token=${encodeURIComponent(token)}`;
    return new Response(null, {
      status: 303,
      headers: {
        Location: redirectUrl,
        // 仍设置一次 Cookie 作为兜底（同站情况下也可命中）
        "set-cookie": setPdfTokenCookie(token),
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function GET(req: Request, ctx: { params: { filename: string } }) {
  try {
    // 允许通过 URL 查询参数或 Cookie 携带 token
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get("token");
    const token = tokenFromQuery || getPdfTokenFromRequest(req);
    const cached = token ? PDF_CACHE.get(token) : undefined;
    if (cached && cached.expires > Date.now()) {
      const inputName = ctx?.params?.filename || "resume.pdf";
      const rawNameUnsafe = decodeURIComponent(inputName);
      const rawName = rawNameUnsafe.replace(/[\r\n]/g, "_").replace(/\//g, "_");
      const asciiFallback = rawName.replace(/[^\x20-\x7E]/g, "_");
      const utf8Star = `UTF-8''${encodeURIComponent(rawName)}`;
      return new Response(cached.data, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename=\"${asciiFallback}\"; filename*=${utf8Star}`,
          "cache-control": "no-store",
        },
      });
    }
    // 若缓存失效或缺失，返回 404，提示用户重新生成
    return new Response(JSON.stringify({ error: "PDF cache expired. Please regenerate." }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
