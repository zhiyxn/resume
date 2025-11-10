"use client"

import { useEffect, useState, Suspense } from "react"
import dynamic from "next/dynamic"
import type { ResumeData } from "@/types/resume"
import { Button } from "@/components/ui/button"
import { Icon } from "@iconify/react"

// 动态导入 PDF 组件，禁用 SSR
const DynamicPDFViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PDFViewer),
  { ssr: false }
)

function PDFPreviewContent() {
  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [fallback, setFallback] = useState(false)
  const [serverFilename, setServerFilename] = useState<string | undefined>(undefined)

  useEffect(() => {
    // 从原始 URL 解析最后一段路径作为文件名（保持原始编码，避免 %2F 被还原成 "/"）
    try {
      const path = window.location.pathname || "";
      const seg = path.split('/').filter(Boolean).pop();
      if (seg) setServerFilename(seg);
    } catch {}

    // 先检查 sessionStorage 是否有数据
    const storedData = sessionStorage.getItem('resumeData');
    if (storedData) {
      try {
        setResumeData(JSON.parse(storedData));
      } catch (error) {
        console.error("Failed to parse stored resume data:", error);
      }
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'resumeData') {
        setResumeData(event.data.data);
        sessionStorage.setItem('resumeData', JSON.stringify(event.data.data));
      }
    };

    window.addEventListener('message', handleMessage);

    // 发送 ready 消息到父窗口
    if (window.opener) {
      window.opener.postMessage({ type: 'ready' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [])

  if (!resumeData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg mb-4">正在加载简历数据...</p>
      </div>
    )
  }

  return (
    <div className="pdf-preview-page-root flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
      {fallback && (
        <div className="flex items-center justify-between p-4 border-b no-print">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold">PDF预览</h1>
            <div className="flex items-baseline gap-1 text-xs text-muted-foreground">
              <Icon icon="mdi:alert-circle" className="w-3.5 h-3.5 text-amber-600" />
              <span>服务器不可用，已切换为浏览器打印。请在打印对话框中关闭“页眉和页脚”，勾选“背景图形”。</span>
              <Button size="sm" className="ml-2 h-6 px-2 py-1 text-xs" onClick={() => window.print()}>
                打印/保存为 PDF
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-hidden flex print:overflow-visible print:h-auto">
        <div className="w-full h-full print:h-auto">
          <DynamicPDFViewer
            resumeData={resumeData}
            renderNotice="external"
            serverFilename={serverFilename}
            onModeChange={(m) => setFallback(m === "fallback")}
          />
        </div>
      </div>
    </div>
  )
}

export default function PDFPreviewPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg mb-4">加载中...</p>
      </div>
    }>
      <PDFPreviewContent />
    </Suspense>
  )
}
