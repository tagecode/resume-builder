import { useCallback, useEffect, useState } from 'react'
import { Copy, Download, FilePlus, FileText, Pencil, Trash2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ResumeListItem, TemplateId } from '@/shared/resume'
import { TEMPLATE_OPTIONS } from '@/shared/resume'
import { validateResumeName } from '@/lib/resume-factory'
import { ThemeControls } from '@/features/resume/theme-controls'
import type { ThemeMode } from '@/shared/electron'

function needsElectron(): boolean {
  return typeof window.electronAPI === 'undefined'
}

export function ResumeListPage({
  theme,
  onThemeChange,
  onOpenResume,
}: {
  theme: ThemeMode
  onThemeChange: (t: ThemeMode) => void
  onOpenResume: (id: string) => void
}) {
  const [items, setItems] = useState<ResumeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'blank' | 'sample'>('blank')
  const [createTemplateId, setCreateTemplateId] = useState<TemplateId>('classic')
  const [newName, setNewName] = useState('我的简历')

  const [renameTarget, setRenameTarget] = useState<ResumeListItem | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<ResumeListItem | null>(null)
  const [successHint, setSuccessHint] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (needsElectron()) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const list = await window.electronAPI!.listResumes()
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleCreate() {
    const err = validateResumeName(newName)
    if (err) {
      setError(err)
      return
    }
    const res = await window.electronAPI!.createResume({
      mode: createMode,
      name: newName.trim(),
      templateId: createTemplateId,
    })
    if (!res.ok) {
      setError(res.error)
      return
    }
    setCreateOpen(false)
    setNewName('我的简历')
    await refresh()
    onOpenResume(res.document.resumeId)
  }

  async function handleRename() {
    if (!renameTarget) {
      return
    }
    const err = validateResumeName(renameValue)
    if (err) {
      setError(err)
      return
    }
    const doc = await window.electronAPI!.readResume(renameTarget.resumeId)
    if (!doc) {
      setError('简历不存在')
      return
    }
    doc.name = renameValue.trim()
    doc.updatedAt = new Date().toISOString()
    const save = await window.electronAPI!.saveResume(doc)
    if (!save.ok) {
      setError(save.error)
      return
    }
    setRenameTarget(null)
    await refresh()
  }

  async function handleDuplicate(id: string) {
    const res = await window.electronAPI!.duplicateResume(id)
    if (!res.ok) {
      setError(res.error)
      return
    }
    await refresh()
    onOpenResume(res.document.resumeId)
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return
    }
    const res = await window.electronAPI!.deleteResume(deleteTarget.resumeId)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDeleteTarget(null)
    await refresh()
  }

  async function handleExportBackupAll() {
    setError(null)
    setSuccessHint(null)
    const res = await window.electronAPI!.exportBackupAll()
    if (res.ok) {
      setSuccessHint(`已导出 ${res.count} 份简历到：${res.filePath}`)
      window.setTimeout(() => setSuccessHint(null), 5500)
      return
    }
    if (res.reason === 'error') {
      setError(res.message)
    }
  }

  async function handleImportBackup() {
    setError(null)
    setSuccessHint(null)
    const res = await window.electronAPI!.importBackup()
    if (res.ok) {
      await refresh()
      setSuccessHint(
        `已导入 ${res.importedCount} 份简历（均为新副本，名称带「· 导入」后缀）`,
      )
      window.setTimeout(() => setSuccessHint(null), 6500)
      return
    }
    if ('reason' in res && res.reason === 'cancelled') {
      return
    }
    setError('error' in res ? res.error : '导入失败')
  }

  if (needsElectron()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-center text-muted-foreground">
          简历数据保存在本机，请使用 <code className="rounded bg-muted px-1.5 py-0.5">pnpm dev</code>{' '}
          启动 Electron 桌面端（而非仅 Web 预览）。
        </p>
        <ThemeControls theme={theme} onChange={onThemeChange} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Resume Builder</h1>
            <p className="text-sm text-muted-foreground">本地简历列表 · 数据目录见系统用户数据路径</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ThemeControls theme={theme} onChange={onThemeChange} />
            <Button
              onClick={() => {
                setCreateMode('blank')
                setCreateTemplateId('classic')
                setCreateOpen(true)
              }}
            >
              <FilePlus className="size-4" />
              新建空白
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCreateMode('sample')
                setCreateTemplateId('classic')
                setCreateOpen(true)
              }}
            >
              <FileText className="size-4" />
              从示例创建
            </Button>
            <Button variant="outline" onClick={() => void handleExportBackupAll()}>
              <Download className="size-4" />
              导出 JSON 备份
            </Button>
            <Button variant="outline" onClick={() => void handleImportBackup()}>
              <Upload className="size-4" />
              从 JSON 恢复
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {error ? (
          <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {successHint ? (
          <p className="mb-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            {successHint}
          </p>
        ) : null}

        {loading ? (
          <p className="text-muted-foreground">加载中…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardHeader className="text-base font-medium">还没有简历</CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              点击「新建空白」或「从示例创建」开始。
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.resumeId}>
                <Card className="transition-colors hover:bg-accent/40">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onOpenResume(item.resumeId)}
                    >
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        更新 {new Date(item.updatedAt).toLocaleString()}
                      </p>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => onOpenResume(item.resumeId)}>
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRenameTarget(item)
                          setRenameValue(item.name)
                        }}
                      >
                        <Pencil className="size-4" />
                        重命名
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void handleDuplicate(item.resumeId)}>
                        <Copy className="size-4" />
                        复制
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(item)}
                      >
                        <Trash2 className="size-4" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createMode === 'sample' ? '从示例创建' : '新建空白简历'}</DialogTitle>
            <DialogDescription>为简历起一个名称，便于在列表中识别。</DialogDescription>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="简历名称" />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">初始模板</span>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value={createTemplateId}
              onChange={(e) => setCreateTemplateId(e.target.value as TemplateId)}
            >
              {TEMPLATE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleCreate()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button onClick={() => void handleRename()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除简历？</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.name}」将从本机删除且不可恢复（未另存备份时）。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
