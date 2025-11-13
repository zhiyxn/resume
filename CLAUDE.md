# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Next.js 的简历生成器应用，支持本地存储、富文本编辑、实时预览和多格式导出（PDF、图片、JSON）。数据完全存储在浏览器的 localStorage 中，无需后端数据库。

## 核心技术栈

- **框架**: Next.js 15 (App Router)
- **UI**: Shadcn UI + Tailwind CSS 4
- **富文本编辑**: Tiptap (基于 ProseMirror)
- **PDF 生成**: Puppeteer-core + @sparticuz/chromium
- **图片导出**: html-to-image
- **拖拽排序**: @hello-pangea/dnd
- **包管理器**: pnpm

## 常用命令

```bash
# 开发环境运行
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint
```

## 核心架构

### 数据流架构

1. **本地存储层** (`lib/storage.ts`)
   - 所有简历数据存储在 `localStorage` 的 `resume.entries` 键中
   - 使用 `StoredResume[]` 数组结构，每个条目包含 `id`, `createdAt`, `updatedAt`, `resumeData`
   - 提供 CRUD 操作：`getAllResumes()`, `getResumeById()`, `upsertResume()`, `deleteResumes()`
   - 错误处理包括配额超限检测（Safari code 22, Firefox 1014, Chrome QuotaExceededError）

2. **数据模型** (`types/resume.ts`)
   - `ResumeData`: 核心简历数据结构
     - `personalInfoSection`: 个人信息（支持 inline/grid 布局）
     - `jobIntentionSection`: 求职意向（可选）
     - `modules`: 模块化内容（教育、工作、项目等）
   - `ModuleContentRow`: 支持 1-4 列的行布局，可以是富文本行 (`type: 'rich'`) 或标签行 (`type: 'tags'`)
   - `JSONContent`: Tiptap 富文本 JSON 格式

3. **页面路由结构**
   - `/`: 用户中心（首页），管理所有本地简历
   - `/edit/new`: 新建简历（支持 `?clone=ID` 参数从现有简历复制）
   - `/edit/[id]`: 编辑已有简历
   - `/view/[id]`: 仅预览简历
   - `/print`: 打印专用页面（供 Puppeteer 渲染，从 sessionStorage 读取数据）
   - `/pdf/preview/[filename]`: PDF 预览页
   - `/auth`: 访问口令页（可选，通过 `SITE_PASSWORD` 环境变量启用）

### PDF 生成架构

**双模式设计**：服务端优先，自动降级到浏览器打印

1. **服务端模式** (`app/api/pdf/route.ts`)
   - 使用 Puppeteer + Chromium headless 渲染 `/print` 页面
   - 通过 `page.evaluateOnNewDocument()` 在页面加载前将 `resumeData` 写入 sessionStorage，避免 URL 过长（431 错误）
   - 自动将远程头像转换为 data URL，防止跨域或网络问题
   - 等待策略：
     - 等待 `.resume-content` 或 `.pdf-preview-mode` 选择器出现
     - 等待网络空闲（如果支持 `waitForNetworkIdle`）
     - 等待 Tiptap 富文本内容渲染（ProseMirror 相关选择器）
     - 等待字体加载完成 (`document.fonts.ready`)
   - 使用 `preferCSSPageSize: true` 让 CSS `@page` 规则的 margin 生效，避免双重边距
   - 支持通过 `PUPPETEER_EXECUTABLE_PATH` 或 `CHROME_PATH` 指定系统 Chrome

2. **浏览器打印模式**
   - 当服务端不可用时自动降级
   - 打开新窗口到 `/print` 页面，通过 `window.sessionStorage` 传递数据
   - 提供用户指导：关闭"页眉和页脚"，勾选"背景图形"

3. **环境变量**
   - `NEXT_PUBLIC_FORCE_SERVER_PDF=true`: 强制使用服务端 PDF
   - `NEXT_PUBLIC_FORCE_PRINT=true`: 强制使用浏览器打印
   - `PUPPETEER_EXECUTABLE_PATH` 或 `CHROME_PATH`: 指定 Chrome 可执行文件路径

### 认证架构

**可选的密码保护机制** (`middleware.ts`)

- 通过环境变量 `SITE_PASSWORD` 启用全站密码保护
- 使用 SHA-256 哈希存储在 Cookie (`site_auth`) 中，有效期 30 天
- Middleware 拦截所有页面路由（除 `/_next/*`, `/auth`, `/api/auth`, `/favicon.ico`, `/robots.txt`）
- Puppeteer 渲染时自动携带相同的认证 Cookie

### 富文本编辑架构

使用 Tiptap 提供所见即所得编辑体验：

- **扩展**: StarterKit + Color + FontFamily + Link + TextAlign + TextStyle + Underline
- **工具栏**: `rich-text-toolbar.tsx` 提供格式化按钮（加粗、斜体、下划线、字号、颜色、对齐等）
- **渲染器**: `rich-text-renderer.tsx` 将 Tiptap JSON 渲染为 HTML（编辑和预览共用相同渲染逻辑）
- **数据格式**: 存储为 Tiptap JSONContent 格式，确保跨平台一致性

### 模块化组件架构

1. **用户中心** (`components/user-center.tsx`)
   - 简历列表管理：搜索、排序（名称/创建时间/更新时间）
   - 批量操作：多选、批量删除
   - 导入/导出 JSON 文件

2. **简历编辑器** (`components/resume-builder.tsx`)
   - 左侧编辑面板 + 右侧实时预览
   - 支持切换为仅编辑或仅预览模式
   - 自动保存功能（每次编辑更新 localStorage）

3. **模块编辑器** (`components/module-editor.tsx`)
   - 支持添加/删除/重排模块
   - 动态行列编辑（1-4 列布局）
   - 拖拽排序（基于 @hello-pangea/dnd）

4. **个人信息编辑器** (`components/personal-info-editor.tsx`)
   - inline 模式：一行紧凑显示，用分隔符分割
   - grid 模式：网格布局，支持 1-6 列配置
   - 图标选择器集成（Iconify）

5. **导出按钮** (`components/export-button.tsx`)
   - 统一导出入口：PDF、PNG、JPG、WEBP、SVG、JSON
   - PDF 优先尝试服务端生成，失败时自动降级浏览器打印
   - 图片导出使用 html-to-image，通过 `/api/image-proxy` 代理远程图片避免跨域

## 开发注意事项

### 数据一致性

- 编辑操作必须同时更新 `resumeData.updatedAt` 和 `StoredResume.updatedAt`
- 使用 `validateResumeData()` (`lib/utils.ts`) 验证数据结构
- 创建/更新简历前必须校验数据，确保所有必需字段存在

### 样式和打印

- 打印样式定义在 `styles/print.css`，使用 `@media print` 和 `@page` 规则
- 预览和打印共用相同的 HTML/CSS，确保"所见即所得"
- 字体文件 `public/NotoSansSC-Medium.ttf` 需要在打印时正确加载

### PDF 生成调试

- 使用 `GET /api/pdf/health` 检查 Chromium 是否可用
- 如果 Puppeteer 启动失败，检查环境变量 `PUPPETEER_EXECUTABLE_PATH`
- Vercel 部署时需要 Node.js runtime（不是 Edge），已在 `route.ts` 中声明 `export const runtime = "nodejs"`
- **浏览器关闭策略**: 使用 `closeBrowserSafely()` 实现智能关闭
  - 优先尝试优雅关闭（`browser.close()`），2秒超时
  - 超时后强制关闭（`disconnect()` + `kill()`）
  - 避免 WSL2/某些 Linux 环境下 `browser.close()` 挂起的问题
  - 对 Serverless 和传统服务器环境都安全
  - 详见 `docs/pdf-browser-close-optimization.md`

### 存储配额管理

- 当 localStorage 满时，`StorageError` 会抛出 `QUOTA_EXCEEDED` 错误
- 用户需要导出 JSON 备份后清理旧数据
- 头像使用 data URL 时注意大小限制

### Tiptap 数据处理

- 富文本内容存储为 `JSONContent` 格式，不要直接存储 HTML
- 使用 `generateHTML(content, extensions)` 将 JSON 转换为 HTML
- 编辑器实例化时需要提供相同的 extensions 列表

## 数据迁移

项目支持导入 magicyan/resume-builder 的旧格式数据：

- `importFromMagicyanFile()` (`lib/utils.ts`) 处理格式转换
- 模板文件：`public/template.json` (空模板), `public/example.json` (示例)

## 部署

### Vercel 部署

- 确保使用 Node.js runtime（项目已配置）
- 提升函数超时时间（推荐 60s+）和内存（推荐 1024MB+）
- PDF 生成使用 @sparticuz/chromium，无需额外配置

### 环境变量

可选配置：
- `SITE_PASSWORD`: 启用全站密码保护
- `PUPPETEER_EXECUTABLE_PATH` 或 `CHROME_PATH`: 指定系统 Chrome 路径
- `NEXT_PUBLIC_FORCE_SERVER_PDF=true`: 强制服务端 PDF
- `NEXT_PUBLIC_FORCE_PRINT=true`: 强制浏览器打印

## 扩展开发

### 添加新的简历模块类型

1. 在 `types/resume.ts` 扩展 `ResumeModule` 接口
2. 在 `module-editor.tsx` 添加新模块类型的编辑逻辑
3. 在 `resume-preview.tsx` 添加新模块类型的渲染逻辑

### 添加新的富文本格式

1. 安装对应的 Tiptap extension
2. 在 `rich-text-input.tsx` 的 extensions 数组中注册
3. 在 `rich-text-toolbar.tsx` 添加格式化按钮
4. 在 `rich-text-renderer.tsx` 的 extensions 数组中同步添加

### 添加新的导出格式

在 `export-button.tsx` 的导出菜单中添加新选项，参考现有的 PNG/JPG/WEBP/SVG 实现。
