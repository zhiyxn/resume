# PDF 生成浏览器关闭策略优化

## 问题背景

在 WSL2/某些 Linux 环境中，Puppeteer 的 `browser.close()` 方法会无限期挂起，导致：
- PDF 生成接口超时
- 健康检查失败
- 前端自动降级到浏览器打印模式

## 解决方案

### 智能关闭策略 (`lib/browser-utils.ts`)

实现了 `closeBrowserSafely()` 函数，采用**优雅关闭优先 + 超时强制关闭**的策略：

1. **第一步**：尝试标准的 `browser.close()`（优雅关闭）
2. **第二步**：设置 2-3 秒超时
3. **第三步**：超时后使用 `disconnect()` + `kill(SIGKILL)`（强制关闭）

```typescript
await closeBrowserSafely(browser, { timeout: 2000 });
```

## 对不同环境的影响

### ✅ Vercel/AWS Lambda (Serverless)

**完全安全** - 推荐部署

- Serverless 函数执行完毕后，整个容器被销毁
- 无论使用优雅关闭还是强制关闭，所有进程都会被清理
- **无资源泄漏风险**
- 使用 `@sparticuz/chromium` 专为 Serverless 优化

### ✅ Docker/传统服务器 (Node.js 长进程)

**安全且优化**

- 优先尝试优雅关闭 → 在大多数环境中正常工作
- 仅在挂起时才强制关闭 → 避免资源泄漏
- `SIGKILL` 确保进程被彻底清理

### ✅ WSL2/本地开发

**已修复**

- 绕过 `browser.close()` 挂起问题
- PDF 生成现在可以正常工作

## 技术细节

### 优雅关闭 vs 强制关闭

| 方法 | 优点 | 缺点 | 使用场景 |
|------|------|------|----------|
| `browser.close()` | • 清理所有资源<br>• 关闭所有标签页<br>• 等待 WebSocket 断开 | • 某些环境会挂起<br>• 耗时较长 | 生产环境优先 |
| `disconnect()` + `kill()` | • 立即完成<br>• 不会挂起<br>• 强制终止进程 | • 跳过清理步骤<br>• 可能留下临时文件 | 挂起时的备选方案 |

### 我们的策略

**两全其美**：
1. 先尝试优雅关闭（生产环境大概率成功）
2. 超时后强制关闭（WSL2/问题环境的保障）

## 环境变量（可选）

如果需要强制使用快速关闭（跳过优雅关闭尝试）：

```typescript
// 在 API 路由中
await closeBrowserSafely(browser, {
  force: process.env.FORCE_BROWSER_KILL === 'true'
});
```

在 `.env.local` 或 Vercel 环境变量中设置：
```bash
FORCE_BROWSER_KILL=true
```

## 部署建议

### Vercel 部署

1. **无需额外配置** - 直接部署即可
2. **推荐设置**：
   - Runtime: Node.js (已配置)
   - 函数超时: 60-120 秒
   - 内存: 1024MB 或更高

### Docker 部署

```dockerfile
# Dockerfile 示例
FROM node:22-alpine

# 安装 Chromium 依赖
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# 设置环境变量指向系统 Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_PATH=/usr/bin/chromium-browser

# ... 其他配置
```

### 传统服务器 (PM2/Systemd)

无需特殊配置，智能关闭策略会自动处理。

## 测试验证

### 本地测试

```bash
# 启动开发服务器
pnpm dev

# 测试健康检查
curl http://localhost:3000/api/pdf/health
# 应返回: {"ok":true}
```

### 生产测试

部署后在浏览器中：

```javascript
// 测试健康检查
fetch('/api/pdf/health').then(r => r.json()).then(console.log)
// 应返回: {ok: true}

// 测试 PDF 生成
// 在应用中点击"导出 PDF"
// 应该直接下载 PDF，而不是打开浏览器打印对话框
```

## 监控建议

如果需要监控浏览器关闭情况，查看日志中的警告：

```
# 如果看到这个警告，说明优雅关闭失败，触发了强制关闭
Graceful browser close failed, forcing close: Browser close timeout
```

在 Vercel 上查看函数日志：
```bash
vercel logs --follow
```

## 结论

✅ **该优化对所有部署环境都是安全的**

- Serverless: 完全安全，无影响
- Docker/服务器: 优化资源管理，更可靠
- WSL2/开发: 修复挂起问题

**推荐直接部署到生产环境，无需担心负面影响。**
