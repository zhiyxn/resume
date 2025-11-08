/**
 * 个人信息值的接口
 */
export interface PersonalInfoValue {
  /** 对应的值 */
  content: string
  /** 值类型：text（文本）或 link（链接） */
  type?: "text" | "link"
  /** 链接类型时的显示标题（仅当type为link时使用） */
  title?: string
}

/**
 * 个人信息项的数据结构
 */
export interface PersonalInfoItem {
  /** 标签名称 */
  label: string
  /** 值信息 */
  value: PersonalInfoValue
  /** 图标名称（来自iconify） */
  icon?: string
  /** 唯一标识符 */
  id: string
  /** 排序顺序 */
  order: number
}

/**
 * 个人信息布局配置接口
 */
export interface PersonalInfoLayout {
  /** 布局模式：inline（一行紧凑显示）或 grid（网格布局） */
  mode: 'inline' | 'grid'
  /** grid模式下的每行项目数（1-6列可选，仅当mode为grid时使用） */
  itemsPerRow?: 1 | 2 | 3 | 4 | 5 | 6
}

/**
 * 个人信息模块的数据结构
 */
export interface PersonalInfoSection {
  /** 个人信息列表 */
  personalInfo: PersonalInfoItem[]
  /** 是否显示个人信息标签 */
  showPersonalInfoLabels?: boolean
  /** 个人信息布局配置 */
  layout: PersonalInfoLayout
}

/**
 * 求职意向项的数据结构
 */
export interface JobIntentionItem {
  /** 唯一标识符 */
  id: string
  /** 标签名称 */
  label: string
  /** 值内容 */
  value: string
  /** 排序顺序 */
  order: number
  /** 类型 */
  type: 'workYears' | 'position' | 'city' | 'salary' | 'custom'
  /** 薪资范围（仅当type为salary时使用） */
  salaryRange?: {
    min?: number
    max?: number
  }
}

/**
 * 求职意向模块的数据结构
 */
export interface JobIntentionSection {
  /** 求职意向项列表 */
  items: JobIntentionItem[]
  /** 是否启用 */
  enabled: boolean
}

/**
 * 简历模块的数据结构
 */
export interface ResumeModule {
  /** 唯一标识符 */
  id: string
  /** 大标题 */
  title: string
  /** 副标题（可选） */
  subtitle?: string
  /** 时间范围（可选） */
  timeRange?: string
  /** 内容描述 */
  content: string
  /** 图标名称（可选） */
  icon?: string
  /** 模块顺序 */
  order: number
}

/**
 * 完整简历数据结构
 */
export interface ResumeData {
  /** 简历标题/姓名 */
  title: string
  /** 简历标题是否居中显示 */
  centerTitle?: boolean
  /** 个人信息模块 */
  personalInfoSection: PersonalInfoSection
  /** 求职意向模块 */
  jobIntentionSection?: JobIntentionSection
  /** 简历模块列表 */
  modules: ResumeModule[]
  /** 头像URL（可选） */
  avatar?: string
  /** 创建时间 */
  createdAt: string
  /** 最后修改时间 */
  updatedAt: string
}

/**
 * 文件保存/导入的数据结构
 */
export interface MagicyanFile {
  /** 文件版本 */
  version: string
  /** 简历数据 */
  data: ResumeData
  /** 文件元数据 */
  metadata: {
    /** 导出时间 */
    exportedAt: string
    /** 应用版本 */
    appVersion: string
  }
}

/**
 * 编辑器状态类型
 */
export interface EditorState {
  /** 当前编辑的简历数据 */
  resumeData: ResumeData
  /** 是否处于编辑模式 */
  isEditing: boolean
  /** 当前选中的模块ID */
  selectedModuleId?: string
  /** 是否显示预览 */
  showPreview: boolean
}
