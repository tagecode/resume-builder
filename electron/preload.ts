import { contextBridge, ipcRenderer } from 'electron'

import type {
  ElectronApi,
  ExportPdfPayload,
  MenuAction,
  ResumeCreateMode,
  ThemeMode,
} from '../src/shared/electron'
import type { ResumeDocument, TemplateId } from '../src/shared/resume'

const electronApi: ElectronApi = {
  getAppMetadata: () => ipcRenderer.invoke('app:get-metadata'),
  getTheme: () => ipcRenderer.invoke('settings:get-theme'),
  setTheme: (theme: ThemeMode) => ipcRenderer.invoke('settings:set-theme', theme),
  listResumes: () => ipcRenderer.invoke('resume:list'),
  readResume: (resumeId: string) => ipcRenderer.invoke('resume:read', resumeId),
  saveResume: (doc: ResumeDocument) => ipcRenderer.invoke('resume:save', doc),
  deleteResume: (resumeId: string) => ipcRenderer.invoke('resume:delete', resumeId),
  createResume: (payload: { mode: ResumeCreateMode; name: string; templateId?: TemplateId }) =>
    ipcRenderer.invoke('resume:create', payload),
  duplicateResume: (resumeId: string) => ipcRenderer.invoke('resume:duplicate', resumeId),
  exportResumePdf: (payload: ExportPdfPayload) =>
    ipcRenderer.invoke('resume:export-pdf', payload),
  exportBackupAll: () => ipcRenderer.invoke('backup:export-all'),
  exportBackupOne: (resumeId: string) => ipcRenderer.invoke('backup:export-one', resumeId),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  onMenuAction: (listener: (action: MenuAction) => void) => {
    const channel = 'app:menu-action'
    const handler = (_event: Electron.IpcRendererEvent, action: MenuAction) => listener(action)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  printResumeHtml: (html: string) => ipcRenderer.invoke('resume:print-html', html),
}

contextBridge.exposeInMainWorld('electronAPI', electronApi)
