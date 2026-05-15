import { readFile } from 'node:fs/promises'

import type { ResumeBackupFileV1 } from '../src/shared/backup'
import { BACKUP_FORMAT_VERSION } from '../src/shared/backup'
import type { ResumeDocument, TemplateId } from '../src/shared/resume'
import { RESUME_SCHEMA_VERSION } from '../src/shared/resume'
import { normalizeResumeDocument } from '../src/lib/resume-factory.ts'

function isTemplateId(x: unknown): x is TemplateId {
  return x === 'classic' || x === 'modern' || x === 'minimal'
}

function validateResumeDocument(doc: unknown, indexLabel: string): ResumeDocument | string {
  if (!doc || typeof doc !== 'object') {
    return `${indexLabel}数据不是对象`
  }
  const d = doc as Record<string, unknown>
  if (typeof d.name !== 'string' || !d.name.trim()) {
    return `${indexLabel}缺少有效名称`
  }
  const sv = typeof d.schemaVersion === 'number' ? d.schemaVersion : 0
  if (sv > RESUME_SCHEMA_VERSION) {
    return `${indexLabel}schemaVersion=${sv} 高于当前应用（${RESUME_SCHEMA_VERSION}），请升级应用后再导入`
  }
  if (!d.sections || typeof d.sections !== 'object') {
    return `${indexLabel}缺少 sections`
  }
  if (!d.visibility || typeof d.visibility !== 'object') {
    return `${indexLabel}缺少 visibility`
  }
  const templateId = isTemplateId(d.templateId) ? d.templateId : 'classic'
  const normalized: ResumeDocument = {
    ...(d as unknown as ResumeDocument),
    schemaVersion: RESUME_SCHEMA_VERSION,
    templateId,
    name: String(d.name),
    resumeId: typeof d.resumeId === 'string' ? d.resumeId : '',
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : new Date(0).toISOString(),
  }
  return normalizeResumeDocument(normalized)
}

function isBareResumeDocument(o: Record<string, unknown>): boolean {
  return (
    typeof o.schemaVersion === 'number' &&
    typeof o.resumeId === 'string' &&
    o.sections !== null &&
    typeof o.sections === 'object'
  )
}

/**
 * 解析备份文件或单份简历 JSON（与磁盘 `.json` 简历文件同形）。
 */
export function parseResumeBackupJson(raw: string):
  | { ok: true; file: ResumeBackupFileV1 }
  | { ok: false; error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: '文件内容不是合法的 JSON' }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON 根节点须为对象' }
  }
  const o = parsed as Record<string, unknown>

  if (isBareResumeDocument(o)) {
    const doc = validateResumeDocument(o, '')
    if (typeof doc === 'string') {
      return { ok: false, error: doc }
    }
    return {
      ok: true,
      file: {
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        appId: 'resume-builder',
        exportedAt: new Date().toISOString(),
        resumes: [doc],
      },
    }
  }

  if (o.backupFormatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      ok: false,
      error: `不支持的备份格式（backupFormatVersion 须为 ${BACKUP_FORMAT_VERSION}）`,
    }
  }
  if (o.appId !== 'resume-builder') {
    return { ok: false, error: '不是 Resume Builder 导出的备份（appId 不匹配）' }
  }
  if (!Array.isArray(o.resumes)) {
    return { ok: false, error: '备份中缺少 resumes 数组' }
  }
  if (o.resumes.length === 0) {
    return { ok: false, error: '备份中没有简历，无法导入' }
  }

  const resumes: ResumeDocument[] = []
  for (let i = 0; i < o.resumes.length; i++) {
    const label = o.resumes.length > 1 ? `第 ${i + 1} 份简历：` : ''
    const doc = validateResumeDocument(o.resumes[i], label)
    if (typeof doc === 'string') {
      return { ok: false, error: doc }
    }
    resumes.push(doc)
  }

  return {
    ok: true,
    file: {
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      appId: 'resume-builder',
      exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : '',
      resumes,
    },
  }
}

export async function readBackupFile(filePath: string) {
  const raw = await readFile(filePath, 'utf8')
  return parseResumeBackupJson(raw)
}
