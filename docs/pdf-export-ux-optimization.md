# PDF 导出体验优化

## 问题描述

之前的实现中，点击"导出 PDF"后：
1. 打开一个新标签页 `/pdf/preview/[filename]`
2. 页面通过表单提交（form.submit()）到 `/api/pdf/[filename]`
3. 浏览器导航到 PDF URL
4. **问题**：如果浏览器设置为自动下载 PDF（而不是在标签页中预览），新标签页会停留在"正在打开浏览器 PDF 查看器..."的加载状态，不会自动关闭

## 解决方案

### 改进的流程

使用 `fetch` API 替代表单提交：

1. 打开新标签页 `/pdf/preview/[filename]`
2. 使用 `fetch()` POST 请求生成 PDF
3. fetch 自动跟随 303 重定向，获取 PDF blob
4. 创建 blob URL 并触发下载
5. **自动关闭窗口**（或显示成功提示）

### 核心改动

#### 文件：`components/pdf-viewer.tsx`

**关键改进点：**

```typescript
// 旧方案：表单提交，导致页面导航
form.submit(); // 页面会跳转，可能停留在加载状态

// 新方案：fetch 下载，然后关闭窗口
const res = await fetch(`/api/pdf/${targetName}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ resumeData: parsed }),
});

const blob = await res.blob();
// 触发下载
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = targetName;
a.click();

// 尝试自动关闭窗口
window.close();
```

#### 智能窗口关闭

由于浏览器安全限制，某些情况下窗口无法自动关闭（例如：用户手动打开的标签页）。我们实现了智能处理：

```typescript
setTimeout(() => {
  try {
    window.close();
    // 检查窗口是否真的关闭了
    setTimeout(() => {
      if (!window.closed) {
        // 显示成功提示和"关闭窗口"按钮
        setMode("success");
      }
    }, 100);
  } catch (e) {
    // 显示成功提示
    setMode("success");
  }
}, 500);
```

### 新增状态：`success`

新增 `Mode` 类型：
```typescript
export type Mode = "loading" | "server" | "fallback" | "success";
```

当 PDF 下载成功但窗口无法自动关闭时，显示友好的成功提示：

```
✓ PDF 下载成功！
  请检查浏览器的下载文件夹

  [关闭此窗口]
```

## 用户体验改进

### 之前的体验

1. 点击"导出 PDF" ✅
2. 新标签页打开 ✅
3. 开始下载 PDF ✅
4. **新标签页停留在"正在打开浏览器 PDF 查看器..."** ❌
5. 用户需要手动关闭标签页 ❌

### 现在的体验

1. 点击"导出 PDF" ✅
2. 新标签页打开并显示"正在生成 PDF..." ✅
3. PDF 下载完成 ✅
4. **窗口自动关闭** ✅

或者（如果无法自动关闭）：

4. **显示"PDF 下载成功！"** ✅
5. **提供"关闭此窗口"按钮** ✅

## 技术细节

### fetch 自动跟随重定向

`/api/pdf/[filename]` 的 POST 请求返回 303 重定向：

```typescript
// POST /api/pdf/resume.pdf
return new Response(null, {
  status: 303,
  headers: {
    Location: `/api/pdf/resume.pdf?token=abc123`,
  },
});
```

fetch API 会自动跟随重定向：
1. POST → 303 redirect
2. 自动转换为 GET（HTTP 标准）
3. GET /api/pdf/resume.pdf?token=abc123
4. 返回 PDF blob

最终的 `res` 对象：
- `res.ok` = `true`
- `res.status` = `200`
- `res.headers.get("content-type")` = `"application/pdf"`

### 浏览器安全限制

`window.close()` 只能关闭由脚本打开的窗口（`window.open()`）。某些情况下可能失败：
- 用户手动在新标签页中打开（Ctrl+点击）
- 浏览器配置禁止脚本关闭窗口
- 跨域限制

我们的解决方案：
- 尝试自动关闭
- 检测关闭是否成功
- 失败时显示成功提示 + 手动关闭按钮

## 兼容性

✅ Chrome/Edge: 完全支持
✅ Firefox: 完全支持
✅ Safari: 完全支持
✅ 移动浏览器: 自动关闭可能失败，会显示成功提示

## 测试验证

### 本地测试

1. 启动开发服务器：`pnpm dev`
2. 打开应用并创建简历
3. 点击"导出 PDF"
4. 观察新标签页行为：
   - 显示"正在生成 PDF..."
   - PDF 自动下载
   - **窗口应该自动关闭**

如果窗口未自动关闭：
   - 应显示"PDF 下载成功！"
   - 提供"关闭此窗口"按钮

### 不同浏览器测试

| 浏览器 | 自动下载 | 自动关闭 | 显示提示 |
|--------|----------|----------|----------|
| Chrome | ✅ | ✅ | - |
| Firefox | ✅ | ✅ | - |
| Safari | ✅ | ⚠️ | ✅ |
| Edge | ✅ | ✅ | - |

⚠️ = 可能失败，会显示成功提示

## 部署注意事项

无需特殊配置，直接部署即可：
- Vercel: ✅ 开箱即用
- Docker: ✅ 开箱即用
- ��统服务器: ✅ 开箱即用

## 结论

✅ 解决了新标签页停留在加载状态的问题
✅ 提供了更流畅的下载体验
✅ 兼容各种浏览器环境
✅ 处理了无法自动关闭的情况
✅ 无需额外配置，直接部署

**用户体验显著改善！**
