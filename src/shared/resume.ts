/** 与磁盘 JSON 对齐；变更时请递增并做迁移。 */
export const RESUME_SCHEMA_VERSION = 1

export type TemplateId = 'classic' | 'modern' | 'minimal'

export const TEMPLATE_OPTIONS: Array<{ id: TemplateId; label: string }> = [
  { id: 'classic', label: '经典' },
  { id: 'modern', label: '现代' },
  { id: 'minimal', label: '极简' },
]

export interface PersonalSection {
  fullName: string
  title: string
  email: string
  phone: string
  location: string
  /** MVP：可填外链；本地图片后续再做 */
  photoUrl: string
  links: Array<{ label: string; url: string }>
}

export interface ExperienceEntry {
  id: string
  company: string
  role: string
  startDate: string
  endDate: string
  description: string
}

export interface EducationEntry {
  id: string
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
  description: string
}

export interface ProjectEntry {
  id: string
  name: string
  role: string
  techStack: string
  startDate: string
  endDate: string
  description: string
}

export interface CustomBlock {
  id: string
  title: string
  body: string
}

export interface ResumeSections {
  personal: PersonalSection
  summary: { headline: string; body: string }
  experience: { entries: ExperienceEntry[] }
  education: { entries: EducationEntry[] }
  /** 每行一项或逗号分隔，渲染时统一按行拆 */
  skills: { text: string }
  projects: { entries: ProjectEntry[] }
  certificates: { text: string }
  languages: { text: string }
  custom: { blocks: CustomBlock[] }
}

export type SectionVisibilityKey = keyof ResumeSections

export type SectionVisibility = Record<SectionVisibilityKey, boolean>

/** 全局样式（TS-03）：与模板叠加，预览/PDF/导出图同源 */
export type ResumeBodyFont = 'template' | 'serif' | 'sans' | 'mono'

export type ResumeLayoutDensity = 'compact' | 'normal' | 'relaxed'

export interface ResumeGlobalStyle {
  /** 相对模板正文字号的缩放，约 0.85–1.25 */
  fontScale: number
  /** 相对模板行高的倍率，约 0.85–1.2 */
  lineHeight: number
  /**
   * 主题强调色（边框、标题区、链接等）；空字符串表示沿用模板默认色。
   * 形如 #RRGGBB。
   */
  accentColor: string
  density: ResumeLayoutDensity
  bodyFont: ResumeBodyFont
}

export const DEFAULT_GLOBAL_STYLE: ResumeGlobalStyle = {
  fontScale: 1,
  lineHeight: 1,
  accentColor: '',
  density: 'normal',
  bodyFont: 'template',
}

/** 编辑区 / 预览 / PDF 模块顺序（CE-03） */
export const DEFAULT_SECTION_ORDER: SectionVisibilityKey[] = [
  'personal',
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certificates',
  'languages',
  'custom',
]

export interface ResumeDocument {
  schemaVersion: number
  resumeId: string
  name: string
  updatedAt: string
  templateId: TemplateId
  visibility: SectionVisibility
  /** 模块顺序；缺省或无效时按 DEFAULT_SECTION_ORDER */
  sectionOrder?: SectionVisibilityKey[]
  /** 全局排版微调（TS-03） */
  globalStyle?: ResumeGlobalStyle
  sections: ResumeSections
}

export interface ResumeListItem {
  resumeId: string
  name: string
  updatedAt: string
}

export interface PdfExportOptions {
  paperSize: 'A4' | 'Letter'
  /**
   * 四边统一内容边距（毫米）。实际排版由 `buildResumePrintHtml` 的 body padding 实现，
   * 以便与预览一致并避免 Chromium printToPDF 自定义边距校验问题。
   */
  marginMm: number
  /** Chromium scale，约 0.5–2，默认 1 */
  scale: number
}

/** IO-02 导出整页长图（与预览同源 HTML） */
export interface ExportImageOptions {
  format: 'png' | 'jpeg'
  /** 清晰度倍率 1–3，越大文件越大 */
  pixelRatio: number
}
