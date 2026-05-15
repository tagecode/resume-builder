import type { ResumeDocument } from './resume'

/** 与 `electron/backup-io.ts` 写入的 JSON 顶层结构一致；递增时同步修改解析逻辑。 */
export const BACKUP_FORMAT_VERSION = 1 as const

export interface ResumeBackupFileV1 {
  backupFormatVersion: typeof BACKUP_FORMAT_VERSION
  appId: 'resume-builder'
  exportedAt: string
  resumes: ResumeDocument[]
}
