import type { PdfExportOptions, ResumeDocument, ResumeListItem } from './resume'

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

export type ExportPdfResult =
  | { ok: true; filePath: string }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'error'; message: string }

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
  }) => Promise<{ ok: true; document: ResumeDocument } | { ok: false; error: string }>
  duplicateResume: (
    resumeId: string,
  ) => Promise<{ ok: true; document: ResumeDocument } | { ok: false; error: string }>
  exportResumePdf: (payload: ExportPdfPayload) => Promise<ExportPdfResult>
}
