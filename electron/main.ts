import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import Store from 'electron-store'

import { renderHtmlToPdfBuffer } from './pdf-export'
import {
  deleteResume,
  getResumesDir,
  listResumes,
  readResume,
  writeResumeAtomic,
} from './resume-storage'
import type { ExportPdfPayload, ThemeMode } from '../src/shared/electron'
import type { ResumeDocument } from '../src/shared/resume'
import {
  cloneResumeForCopy,
  createResumeDocument,
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
    autoHideMenuBar: true,
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
    try {
      await writeResumeAtomic(resumesDirPath(), doc)
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
    async (_e, payload: { mode: 'blank' | 'sample'; name: string }) => {
      const nameErr = validateResumeName(payload.name)
      if (nameErr) {
        return { ok: false as const, error: nameErr }
      }
      const sections = payload.mode === 'sample' ? sampleSections() : undefined
      const doc = createResumeDocument({ name: payload.name.trim(), sections })
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
      const buf = await renderHtmlToPdfBuffer(payload.html, payload.options)
      await writeFile(filePath, buf)
      return { ok: true as const, filePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败'
      return { ok: false as const, reason: 'error' as const, message }
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
