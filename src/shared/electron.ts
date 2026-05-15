import type { PdfExportOptions, ResumeDocument, ResumeListItem, TemplateId } from './resume'

export type ThemeMode = 'system' | 'light' | 'dark'

export type ResumeCreateMode = 'blank' | 'sample'

export interface AppMetadata {
  name: string
  version: string
  electron: string
  chromium: string
  node: string
  platform: string
  arch: string
}

export interface ExportPdfPayload {
  html: string
  options: PdfExportOptions
  suggestedFileName: string
}

/** 主进程菜单向渲染进程广播的动作（DT-05 / EF-04） */
export type MenuAction =
  | 'back-to-list'
  | 'save'
  | 'print'
  | 'export-pdf'
  | 'export-backup'
  | 'import-backup'
  | 'shortcuts-help'

export type PrintHtmlResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'error'; message?: string }

export type ExportPdfResult =
  | { ok: true; filePath: string }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'error'; message: string }

export type BackupExportResult =
  | { ok: true; filePath: string; count: number }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'error'; message: string }

export type BackupImportResult =
  | { ok: true; importedCount: number }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; error: string }

export interface ElectronApi {
  getAppMetadata: () => Promise<AppMetadata>
  getTheme: () => Promise<ThemeMode>
  setTheme: (theme: ThemeMode) => Promise<ThemeMode>
  listResumes: () => Promise<ResumeListItem[]>
  readResume: (resumeId: string) => Promise<ResumeDocument | null>
  saveResume: (doc: ResumeDocument) => Promise<{ ok: true } | { ok: false; error: string }>
  deleteResume: (resumeId: string) => Promise<{ ok: true } | { ok: false; error: string }>
  createResume: (payload: {
    mode: ResumeCreateMode
    name: string
    templateId?: TemplateId
  }) => Promise<{ ok: true; document: ResumeDocument } | { ok: false; error: string }>
  duplicateResume: (
    resumeId: string,
  ) => Promise<{ ok: true; document: ResumeDocument } | { ok: false; error: string }>
  exportResumePdf: (payload: ExportPdfPayload) => Promise<ExportPdfResult>
  exportBackupAll: () => Promise<BackupExportResult>
  exportBackupOne: (resumeId: string) => Promise<BackupExportResult>
  importBackup: () => Promise<BackupImportResult>
  /** 订阅原生应用菜单触发的动作；返回取消订阅函数 */
  onMenuAction: (listener: (action: MenuAction) => void) => () => void
  /** 系统打印对话框（IO-03），HTML 与预览/PDF 同源 */
  printResumeHtml: (html: string) => Promise<PrintHtmlResult>
}
