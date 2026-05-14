import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ResumeDocument, ResumeListItem } from '../src/shared/resume'
import { RESUME_SCHEMA_VERSION } from '../src/shared/resume'

export function getResumesDir(rootUserData: string): string {
  return path.join(rootUserData, 'resumes')
}

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true })
}

export async function listResumes(resumesDir: string): Promise<ResumeListItem[]> {
  await ensureDir(resumesDir)
  const names = await readdir(resumesDir)
  const jsonFiles = names.filter((n) => n.endsWith('.json'))
  const items: ResumeListItem[] = []
  for (const file of jsonFiles) {
    const full = path.join(resumesDir, file)
    try {
      const raw = await readFile(full, 'utf8')
      const doc = JSON.parse(raw) as ResumeDocument
      if (doc?.resumeId && doc?.name) {
        items.push({
          resumeId: doc.resumeId,
          name: doc.name,
          updatedAt: doc.updatedAt ?? new Date(0).toISOString(),
        })
      }
    } catch {
      /* 跳过损坏文件 */
    }
  }
  items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return items
}

export function resumeFilePath(resumesDir: string, resumeId: string): string {
  return path.join(resumesDir, `${resumeId}.json`)
}

export async function readResume(resumesDir: string, resumeId: string): Promise<ResumeDocument | null> {
  const fp = resumeFilePath(resumesDir, resumeId)
  try {
    const raw = await readFile(fp, 'utf8')
    const doc = JSON.parse(raw) as ResumeDocument
    if (doc.schemaVersion !== RESUME_SCHEMA_VERSION) {
      doc.schemaVersion = RESUME_SCHEMA_VERSION
    }
    return doc
  } catch {
    return null
  }
}

export async function writeResumeAtomic(resumesDir: string, doc: ResumeDocument): Promise<void> {
  await ensureDir(resumesDir)
  const fp = resumeFilePath(resumesDir, doc.resumeId)
  const tmp = `${fp}.${process.pid}.tmp`
  const payload = `${JSON.stringify(doc, null, 2)}\n`
  await writeFile(tmp, payload, 'utf8')
  await rename(tmp, fp)
}

export async function deleteResume(resumesDir: string, resumeId: string): Promise<void> {
  const fp = resumeFilePath(resumesDir, resumeId)
  try {
    await unlink(fp)
  } catch {
    /* 幂等 */
  }
}

export async function unlinkTemp(tempPath: string): Promise<void> {
  try {
    await unlink(tempPath)
  } catch {
    /* ignore */
  }
}
