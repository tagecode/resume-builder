import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import Store from 'electron-store'

import { setupApplicationMenu } from './app-menu'
import { readBackupFile } from './backup-io'
import { renderHtmlToPdfBuffer } from './pdf-export'
import { printHtmlWithDialog } from './print-html'
import {
  deleteResume,
  getResumesDir,
  listResumes,
  readResume,
  writeResumeAtomic,
} from './resume-storage'
import { BACKUP_FORMAT_VERSION, type ResumeBackupFileV1 } from '../src/shared/backup'
import type { ExportPdfPayload, PrintHtmlResult, ThemeMode } from '../src/shared/electron'
import type { ResumeDocument } from '../src/shared/resume'
import {
  cloneResumeForCopy,
  cloneResumeForImport,
  createResumeDocument,
  normalizeResumeDocument,
  sampleSections,
  validateResumeName,
} from '../src/lib/resume-factory.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rendererDistPath = path.join(__dirname, '../dist/index.html')

const settingsStore = new Store<{ theme: ThemeMode }>({
  defaults: {
    theme: 'system',
  },
})

function resumesDirPath() {
  return getResumesDir(app.getPath('userData'))
}

async function loadAllResumeDocuments(): Promise<ResumeDocument[]> {
  const dir = resumesDirPath()
  const items = await listResumes(dir)
  const out: ResumeDocument[] = []
  for (const it of items) {
    const d = await readResume(dir, it.resumeId)
    if (d) {
      out.push(d)
    }
  }
  return out
}

function targetWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1040,
    minHeight: 720,
    title: 'Resume Builder',
    autoHideMenuBar: false,
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL)
    window.webContents.openDevTools({ mode: 'detach' })
    return window
  }

  void window.loadFile(rendererDistPath)
  return window
}

app.whenReady().then(() => {
  setupApplicationMenu()

  ipcMain.handle('app:get-metadata', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  }))

  ipcMain.handle('settings:get-theme', () => settingsStore.get('theme'))
  ipcMain.handle('settings:set-theme', (_event, theme: ThemeMode) => {
    settingsStore.set('theme', theme)
    return theme
  })

  ipcMain.handle('resume:list', async () => {
    return listResumes(resumesDirPath())
  })

  ipcMain.handle('resume:read', async (_e, resumeId: string) => {
    return readResume(resumesDirPath(), resumeId)
  })

  ipcMain.handle('resume:save', async (_e, doc: ResumeDocument) => {
    const nameErr = validateResumeName(doc.name)
    if (nameErr) {
      return { ok: false as const, error: nameErr }
    }
    const normalized: ResumeDocument = normalizeResumeDocument({
      ...doc,
      name: doc.name.trim(),
    })
    try {
      await writeResumeAtomic(resumesDirPath(), normalized)
      return { ok: true as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('resume:delete', async (_e, resumeId: string) => {
    try {
      await deleteResume(resumesDirPath(), resumeId)
      return { ok: true as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle(
    'resume:create',
    async (
      _e,
      payload: { mode: 'blank' | 'sample'; name: string; templateId?: ResumeDocument['templateId'] },
    ) => {
      const nameErr = validateResumeName(payload.name)
      if (nameErr) {
        return { ok: false as const, error: nameErr }
      }
      const sections = payload.mode === 'sample' ? sampleSections() : undefined
      const doc = createResumeDocument({
        name: payload.name.trim(),
        sections,
        templateId: payload.templateId,
      })
      try {
        await writeResumeAtomic(resumesDirPath(), doc)
        return { ok: true as const, document: doc }
      } catch (err) {
        const message = err instanceof Error ? err.message : '创建失败'
        return { ok: false as const, error: message }
      }
    },
  )

  ipcMain.handle('resume:duplicate', async (_e, resumeId: string) => {
    const existing = await readResume(resumesDirPath(), resumeId)
    if (!existing) {
      return { ok: false as const, error: '源简历不存在' }
    }
    const copy = cloneResumeForCopy(existing)
    try {
      await writeResumeAtomic(resumesDirPath(), copy)
      return { ok: true as const, document: copy }
    } catch (err) {
      const message = err instanceof Error ? err.message : '复制失败'
      return { ok: false as const, error: message }
    }
  })

  ipcMain.handle('resume:print-html', async (_e, html: string): Promise<PrintHtmlResult> => {
    try {
      await printHtmlWithDialog(html)
      return { ok: true as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : '打印失败'
      const cancelled =
        /cancel/i.test(message) ||
        message.includes('取消') ||
        message.includes('已取消')
      if (cancelled) {
        return { ok: false as const, reason: 'cancelled' as const }
      }
      return { ok: false as const, reason: 'error' as const, message }
    }
  })

  ipcMain.handle('resume:export-pdf', async (_e, payload: ExportPdfPayload) => {
    const suggested = payload.suggestedFileName.replace(/[^\w\u4e00-\u9fff\-_. ]+/g, '_') || '简历'
    try {
      const win = targetWindow()
      const dialogOptions = {
        title: '导出 PDF',
        defaultPath: path.join(app.getPath('documents'), `${suggested}.pdf`),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      }
      const { filePath, canceled } = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      if (canceled || !filePath) {
        return { ok: false as const, reason: 'cancelled' as const }
      }
      const outPath = filePath.toLowerCase().endsWith('.pdf') ? filePath : `${filePath}.pdf`
      const buf = await renderHtmlToPdfBuffer(payload.html, payload.options)
      await writeFile(outPath, buf)
      return { ok: true as const, filePath: outPath }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败'
      return { ok: false as const, reason: 'error' as const, message }
    }
  })

  ipcMain.handle('backup:export-all', async () => {
    try {
      const resumes = await loadAllResumeDocuments()
      const payload: ResumeBackupFileV1 = {
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        appId: 'resume-builder',
        exportedAt: new Date().toISOString(),
        resumes,
      }
      const win = targetWindow()
      const dateStr = new Date().toISOString().slice(0, 10)
      const dialogOptions = {
        title: '导出 JSON 备份',
        defaultPath: path.join(app.getPath('documents'), `resume-builder-backup-${dateStr}.json`),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }
      const { filePath, canceled } = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      if (canceled || !filePath) {
        return { ok: false as const, reason: 'cancelled' as const }
      }
      const outPath = filePath.toLowerCase().endsWith('.json') ? filePath : `${filePath}.json`
      await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
      return { ok: true as const, filePath: outPath, count: resumes.length }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败'
      return { ok: false as const, reason: 'error' as const, message }
    }
  })

  ipcMain.handle('backup:export-one', async (_e, resumeId: string) => {
    try {
      const doc = await readResume(resumesDirPath(), resumeId)
      if (!doc) {
        return { ok: false as const, reason: 'error' as const, message: '简历不存在' }
      }
      const payload: ResumeBackupFileV1 = {
        backupFormatVersion: BACKUP_FORMAT_VERSION,
        appId: 'resume-builder',
        exportedAt: new Date().toISOString(),
        resumes: [doc],
      }
      const win = targetWindow()
      const safe = doc.name.replace(/[^\w\u4e00-\u9fff\-_. ]+/g, '_') || '简历'
      const dialogOptions = {
        title: '导出此简历为 JSON',
        defaultPath: path.join(app.getPath('documents'), `${safe}.json`),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }
      const { filePath, canceled } = win
        ? await dialog.showSaveDialog(win, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      if (canceled || !filePath) {
        return { ok: false as const, reason: 'cancelled' as const }
      }
      const outPath = filePath.toLowerCase().endsWith('.json') ? filePath : `${filePath}.json`
      await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
      return { ok: true as const, filePath: outPath, count: 1 }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败'
      return { ok: false as const, reason: 'error' as const, message }
    }
  })

  ipcMain.handle('backup:import', async () => {
    try {
      const win = targetWindow()
      const dialogOptions = {
        title: '从 JSON 恢复',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile' as const],
      }
      const { filePaths, canceled } = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      if (canceled || !filePaths?.[0]) {
        return { ok: false as const, reason: 'cancelled' as const }
      }
      const parsed = await readBackupFile(filePaths[0])
      if (!parsed.ok) {
        return { ok: false as const, error: parsed.error }
      }
      const toWrite: ResumeDocument[] = []
      for (const src of parsed.file.resumes) {
        const next = cloneResumeForImport(src)
        const nameErr = validateResumeName(next.name)
        if (nameErr) {
          return { ok: false as const, error: `校验未通过：${nameErr}` }
        }
        toWrite.push({ ...next, name: next.name.trim() })
      }
      for (const doc of toWrite) {
        await writeResumeAtomic(resumesDirPath(), doc)
      }
      return { ok: true as const, importedCount: toWrite.length }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败'
      return { ok: false as const, error: message }
    }
  })

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
