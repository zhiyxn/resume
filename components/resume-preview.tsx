"use client";

import { Icon } from "@iconify/react";
import type { ResumeData } from "@/types/resume";

interface ResumePreviewProps {
  resumeData: ResumeData;
}

/**
 * 简历预览组件
 */
export default function ResumePreview({ resumeData }: ResumePreviewProps) {
  // 格式化求职意向显示
  const formatJobIntention = () => {
    if (!resumeData.jobIntentionSection?.enabled || !resumeData.jobIntentionSection?.items?.length) {
      return null;
    }

    const items = resumeData.jobIntentionSection.items
      .filter(item => {
        // 过滤掉空值的项
        if (item.type === 'salary') {
          return item.salaryRange?.min !== undefined || item.salaryRange?.max !== undefined;
        }
        return item.value && item.value.trim() !== '';
      })
      .sort((a, b) => a.order - b.order)
      .map(item => `${item.label}：${item.value}`)
      .join(' ｜ ');

    return items || null;
  };

  const jobIntentionText = formatJobIntention();

  return (
    <div className="resume-preview resume-content">
      {/* 头部信息 */}
      <div className={`flex items-start mb-6 ${resumeData.centerTitle ? 'flex-col items-center' : 'justify-between'}`}>
        <div className={`flex-1 ${resumeData.centerTitle ? 'w-full' : ''}`}>
          <h1 className={`resume-title text-2xl font-bold text-foreground mb-4 ${resumeData.centerTitle ? 'text-center' : ''}`}>
            {resumeData.title || "简历标题"}
          </h1>

          {/* 求职意向 */}
          {jobIntentionText && (
            <div className={`job-intention-line text-sm text-muted-foreground mb-3 ${resumeData.centerTitle ? 'text-center' : ''}`}>
              {jobIntentionText}
            </div>
          )}

          {/* 个人信息 */}
          {(resumeData.personalInfoSection?.layout?.mode === 'inline' ||
            (resumeData.personalInfoSection?.layout?.mode === undefined && (resumeData.personalInfoSection as any)?.personalInfoInline)) ? (
            /* 单行显示模式（inline） */
            <div className="personal-info flex flex-wrap items-center gap-x-4 gap-y-2">
              {resumeData.personalInfoSection?.personalInfo.map((item, index) => (
                <div
                  key={item.id}
                  className="personal-info-item flex items-center gap-1"
                >
                  {index > 0 && <span className="text-muted-foreground"></span>}
                  {item.icon && (
                    <svg
                      className="resume-icon w-4 h-4 flex-shrink-0 transform -translate-y-[-1px]"
                      fill="black"
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                    />
                  )}
                  {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                    <span className="text-sm text-muted-foreground">
                      {item.label}:
                    </span>
                  )}
                  {item.value.type === "link" && item.value.content ? (
                    <a
                      href={item.value.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {item.value.title || "点击访问"}
                    </a>
                  ) : (
                    <span className="text-sm text-foreground">
                      {item.value.content || "未填写"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* 多行显示模式（grid）- 动态列数布局 */
            <div
              className="personal-info"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${resumeData.personalInfoSection?.layout?.itemsPerRow || 2}, auto)`,
                gap: '0.5rem 1rem',
                justifyContent: 'start',
                alignItems: 'center'
              }}
            >
              {resumeData.personalInfoSection?.personalInfo.map((item) => (
                <div
                  key={item.id}
                  className="personal-info-item flex items-center gap-1"
                >
                  {item.icon && (
                    <svg
                      className="resume-icon w-4 h-4 flex-shrink-0 transform -translate-y-[-1px]"
                      fill="black"
                      width={16}
                      height={16}
                      viewBox="0 0 24 24"
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                    />
                  )}
                  {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                    <span className="text-sm text-muted-foreground">
                      {item.label}:
                    </span>
                  )}
                  {item.value.type === "link" && item.value.content ? (
                    <a
                      href={item.value.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {item.value.title || "点击访问"}
                    </a>
                  ) : (
                    <span className="text-sm text-foreground">
                      {item.value.content || "未填写"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 头像 */}
        {resumeData.avatar && (
          <div className={resumeData.centerTitle ? 'mt-4' : 'ml-6'}>
            <img
              src={resumeData.avatar}
              alt="头像"
              className="resume-avatar w-20 h-20 rounded-full object-cover border-2 border-border"
            />
          </div>
        )}
      </div>

      {/* 简历模块 */}
      <div className="space-y-6">
        {resumeData.modules
          .sort((a, b) => a.order - b.order)
          .map((module) => (
            <div key={module.id} className="resume-module">
              <div className="module-title text-lg font-semibold text-foreground border-b border-border pb-2 mb-3 flex items-center gap-2">
                {module.icon && (
                  <svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    dangerouslySetInnerHTML={{ __html: module.icon }}
                  />
                )}
                {module.title}
              </div>

              <div className="space-y-2">
                {/* 副标题和时间 */}
                {(module.subtitle || module.timeRange) && (
                  <div className="flex items-center justify-between">
                    {module.subtitle && (
                      <h3 className="font-medium text-foreground">
                        {module.subtitle}
                      </h3>
                    )}
                    {module.timeRange && (
                      <span className="text-sm text-muted-foreground time-range">
                        {module.timeRange}
                      </span>
                    )}
                  </div>
                )}

                {/* 内容 */}
                {module.content && (
                  <div className="module-content text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {module.content}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* 空状态提示 */}
      {resumeData.modules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground no-print">
          <Icon
            icon="mdi:file-document-outline"
            className="w-12 h-12 mx-auto mb-4 opacity-50"
          />
          <p>暂无简历内容，请在左侧编辑区域添加模块</p>
        </div>
      )}
    </div>
  );
}
