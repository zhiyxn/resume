export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  try {
    const [{ default: chromium }, { default: puppeteer }, { closeBrowserSafely }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
      import("@/lib/browser-utils"),
    ]);
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || "";
    const resolvedPath = envPath || (await chromium.executablePath());
    if (!resolvedPath) {
      return new Response(JSON.stringify({ ok: false, error: "No executablePath (set PUPPETEER_EXECUTABLE_PATH)" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    const usingSystemChrome = !!envPath;
    const launchArgs = usingSystemChrome
      ? [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ]
      : chromium.args;
    // Puppeteer v23 headless option type is boolean | 'shell'.
    // Use boolean true for both system Chrome (new headless) and bundled Chromium default.
    const headless: import('puppeteer-core').LaunchOptions["headless"] = usingSystemChrome ? true : chromium.headless;
    const browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath: resolvedPath,
      headless,
    });
    // 使用智能关闭：优先尝试优雅关闭，超时则强制关闭
    await closeBrowserSafely(browser, { timeout: 2000 });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
}
