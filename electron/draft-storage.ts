import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ResumeDocument } from '../src/shared/resume'
import { normalizeResumeDocument } from '../src/lib/resume-factory.ts'

export function getDraftsDir(userDataRoot: string): string {
  return path.join(userDataRoot, 'drafts')
}

export async function writeDraft(userDataRoot: string, doc: ResumeDocument): Promise<void> {
  const dir = getDraftsDir(userDataRoot)
  await mkdir(dir, { recursive: true })
  const stampDoc: ResumeDocument = {
    ...doc,
    updatedAt: new Date().toISOString(),
  }
  const normalized = normalizeResumeDocument(stampDoc)
  const target = path.join(dir, `${normalized.resumeId}.json`)
  await writeFile(target, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
}

export async function readDraft(userDataRoot: string, resumeId: string): Promise<ResumeDocument | null> {
  const target = path.join(getDraftsDir(userDataRoot), `${resumeId}.json`)
  try {
    const raw = await readFile(target, 'utf8')
    const parsed = JSON.parse(raw) as ResumeDocument
    return normalizeResumeDocument(parsed)
  } catch {
    return null
  }
}

export async function clearDraft(userDataRoot: string, resumeId: string): Promise<void> {
  try {
    await unlink(path.join(getDraftsDir(userDataRoot), `${resumeId}.json`))
  } catch {
    /* noop */
  }
}

export async function listDraftSummaries(
  userDataRoot: string,
): Promise<Array<{ resumeId: string; updatedAt: string }>> {
  const dir = getDraftsDir(userDataRoot)
  try {
    const names = await readdir(dir)
    const out: Array<{ resumeId: string; updatedAt: string }> = []
    for (const name of names) {
      if (!name.endsWith('.json')) {
        continue
      }
      try {
        const raw = await readFile(path.join(dir, name), 'utf8')
        const parsed = JSON.parse(raw) as ResumeDocument
        if (parsed.resumeId && parsed.updatedAt) {
          out.push({ resumeId: parsed.resumeId, updatedAt: parsed.updatedAt })
        }
      } catch {
        /* skip bad file */
      }
    }
    return out
  } catch {
    return []
  }
}
