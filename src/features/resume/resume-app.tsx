import { useCallback, useEffect, useRef, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppTheme } from '@/hooks/use-app-theme'
import type { MenuAction } from '@/shared/electron'

import { ResumeEditorPage, type ResumeEditorHandle } from '@/features/resume/resume-editor-page'
import { ResumeListPage } from '@/features/resume/resume-list-page'

function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const rows: Array<{ action: string; keys: string }> = [
    { action: '返回列表', keys: 'Ctrl + Esc（macOS：⌘ + Esc）' },
    { action: '保存', keys: 'Ctrl + S（macOS：⌘ + S）' },
    { action: '打印…', keys: 'Ctrl + P（macOS：⌘ + P）' },
    { action: '导出 PDF…', keys: 'Ctrl + Shift + E（macOS：⌘ + Shift + E）' },
    { action: '快捷键说明', keys: 'Ctrl + /（macOS：⌘ + /）' },
  ]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>快捷键说明</DialogTitle>
          <DialogDescription>
            以下快捷键由应用菜单注册；另可在「文件」菜单使用 JSON 备份导入/导出（无默认全局快捷键）。
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.action} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 text-muted-foreground">{r.action}</td>
                <td className="py-2 font-mono text-xs">{r.keys}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}

export function ResumeApp() {
  const { theme, setTheme } = useAppTheme()
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [listTick, setListTick] = useState(0)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const editorRef = useRef<ResumeEditorHandle>(null)

  const listRefreshKey = useCallback(() => {
    setListTick((t) => t + 1)
  }, [])

  const runImportBackup = useCallback(async () => {
    const api = window.electronAPI
    if (!api) {
      return
    }
    const res = await api.importBackup()
    if (res.ok) {
      listRefreshKey()
    }
  }, [listRefreshKey])

  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onMenuAction) {
      return
    }
    return api.onMenuAction((action: MenuAction) => {
      switch (action) {
        case 'shortcuts-help':
          setShortcutsOpen(true)
          break
        case 'import-backup':
          void runImportBackup()
          break
        case 'export-backup':
          if (view === 'editor') {
            void editorRef.current?.exportBackupOne()
          } else {
            void window.electronAPI?.exportBackupAll()
          }
          break
        case 'back-to-list':
          if (view === 'editor') {
            editorRef.current?.backToList()
          }
          break
        case 'save':
          if (view === 'editor') {
            void editorRef.current?.save()
          }
          break
        case 'print':
          if (view === 'editor') {
            void editorRef.current?.print()
          }
          break
        case 'export-pdf':
          if (view === 'editor') {
            void editorRef.current?.exportPdf()
          }
          break
        default:
          break
      }
    })
  }, [view, runImportBackup])

  if (view === 'editor' && editingId) {
    return (
      <>
        <ResumeEditorPage
          ref={editorRef}
          resumeId={editingId}
          theme={theme}
          onThemeChange={setTheme}
          onBack={() => {
            setView('list')
            setEditingId(null)
          }}
          listRefreshKey={listRefreshKey}
        />
        <ShortcutsHelpDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </>
    )
  }

  return (
    <>
      <ResumeListPage
        key={listTick}
        theme={theme}
        onThemeChange={setTheme}
        onOpenResume={(id) => {
          setEditingId(id)
          setView('editor')
        }}
      />
      <ShortcutsHelpDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
