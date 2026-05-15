import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ArrowLeft, FileJson, GripVertical, Save } from 'lucide-react'

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
import { buildResumePrintHtml, estimatePrintPageCount } from '@/lib/resume-print-html'
import { getSectionOrder, newEntityId, reorderSectionKeys, validateResumeName } from '@/lib/resume-factory'
import type {
  CustomBlock,
  EducationEntry,
  ExperienceEntry,
  PdfExportOptions,
  ProjectEntry,
  ResumeDocument,
  SectionVisibilityKey,
  TemplateId,
} from '@/shared/resume'
import { TEMPLATE_OPTIONS } from '@/shared/resume'
import { ThemeControls } from '@/features/resume/theme-controls'
import type { ThemeMode } from '@/shared/electron'

const VISIBILITY_LABELS: Record<SectionVisibilityKey, string> = {
  personal: '个人信息',
  summary: '总结与意向',
  experience: '工作经历',
  education: '教育背景',
  skills: '技能',
  projects: '项目经验',
  certificates: '证书与奖项',
  languages: '语言',
  custom: '自定义模块',
}

const RICH_TEXT_HINT =
  '轻量语法：**粗体**、*斜体*、行首「- 」无序列表、[显示文字](https://链接)'

export type ResumeEditorHandle = {
  save: () => Promise<boolean>
  print: () => Promise<void>
  exportPdf: () => void
  backToList: () => void
  exportBackupOne: () => void
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function textAreaClass() {
  return 'flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
}

function lineInputClass() {
  return 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
}


function DraggableSectionCard({
  sectionKey,
  onReorder,
  children,
}: {
  sectionKey: SectionVisibilityKey
  onReorder: (from: SectionVisibilityKey, to: SectionVisibilityKey) => void
  children: React.ReactNode
}) {
  return (
    <div
      className="group relative pl-5"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.preventDefault()
        const from = e.dataTransfer.getData('text/plain') as SectionVisibilityKey
        if (from && from !== sectionKey) {
          onReorder(from, sectionKey)
        }
      }}
    >
      <div
        className="absolute left-0 top-9 z-10 flex h-8 w-5 cursor-grab items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted/80 hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
        draggable
        role="button"
        tabIndex={0}
        aria-label="拖拽调整模块顺序"
        title="拖拽调整模块顺序"
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', sectionKey)
          e.dataTransfer.effectAllowed = 'move'
        }}
      >
        <GripVertical className="size-4" />
      </div>
      {children}
    </div>
  )
}

export const ResumeEditorPage = forwardRef<
  ResumeEditorHandle,
  {
    resumeId: string
    theme: ThemeMode
    onThemeChange: (t: ThemeMode) => void
    onBack: () => void
    listRefreshKey: () => void
  }
>(function ResumeEditorPage({
  resumeId,
  theme,
  onThemeChange,
  onBack,
  listRefreshKey,
},
ref) {
  const [doc, setDoc] = useState<ResumeDocument | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const [pdfPaper, setPdfPaper] = useState<'A4' | 'Letter'>('A4')
  const [pdfMarginMm, setPdfMarginMm] = useState(14)
  const [pdfScale, setPdfScale] = useState(1)

  const [unsavedOpen, setUnsavedOpen] = useState(false)
  const [previewPageCount, setPreviewPageCount] = useState<number | null>(null)
  const previewIframeRef = useRef<HTMLIFrameElement>(null)

  const docRef = useRef(doc)
  docRef.current = doc

  const serialized = useMemo(() => (doc ? JSON.stringify(doc) : ''), [doc])
  const isDirty = doc ? serialized !== savedSnapshot : false

  const previewHtml = useMemo(
    () => (doc ? buildResumePrintHtml(doc, { pageMarginMm: pdfMarginMm }) : ''),
    [doc, pdfMarginMm],
  )

  useEffect(() => {
    setPreviewPageCount(null)
  }, [previewHtml])

  const persist = useCallback(async (explicit?: ResumeDocument): Promise<boolean> => {
    if (!window.electronAPI) {
      return false
    }
    const base = explicit ?? docRef.current
    if (!base) {
      return false
    }
    const nameErr = validateResumeName(base.name)
    if (nameErr) {
      setSaveHint(nameErr)
      window.setTimeout(() => setSaveHint(null), 4500)
      return false
    }
    const toSave = { ...base, name: base.name.trim(), updatedAt: new Date().toISOString() }
    const res = await window.electronAPI.saveResume(toSave)
    if (res.ok) {
      setDoc(toSave)
      setSavedSnapshot(JSON.stringify(toSave))
      setSaveHint('已保存')
      window.setTimeout(() => setSaveHint(null), 2000)
      return true
    }
    setSaveHint(`保存失败：${res.error}`)
    return false
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      setLoadError(null)
      const d = await window.electronAPI!.readResume(resumeId)
      if (!alive) {
        return
      }
      if (!d) {
        setLoadError('找不到该简历')
        return
      }
      setDoc(d)
      setSavedSnapshot(JSON.stringify(d))
    }
    void load()
    return () => {
      alive = false
    }
  }, [resumeId])

  useEffect(() => {
    if (!isDirty || !doc) {
      return
    }
    const t = window.setTimeout(() => {
      void persist()
    }, 1500)
    return () => window.clearTimeout(t)
  }, [serialized, isDirty, persist, doc])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void persist()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [persist])

  useEffect(() => {
    if (!isDirty) {
      return
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  function tryBack() {
    if (isDirty) {
      setUnsavedOpen(true)
    } else {
      listRefreshKey()
      onBack()
    }
  }

  async function saveAndBack() {
    const ok = await persist()
    if (!ok) {
      return
    }
    setUnsavedOpen(false)
    listRefreshKey()
    onBack()
  }

  function discardAndBack() {
    setUnsavedOpen(false)
    listRefreshKey()
    onBack()
  }

  function patchDoc(updater: (prev: ResumeDocument) => ResumeDocument) {
    setDoc((prev) => (prev ? updater(prev) : prev))
  }

  function handleSectionReorder(from: SectionVisibilityKey, to: SectionVisibilityKey) {
    patchDoc((p) => ({
      ...p,
      sectionOrder: reorderSectionKeys(getSectionOrder(p), from, to),
    }))
  }

  async function handleExportBackupOne() {
    const saved = await persist()
    if (!saved) {
      return
    }
    const res = await window.electronAPI!.exportBackupOne(resumeId)
    if (res.ok) {
      setSaveHint(`已导出 JSON：${res.filePath}`)
      window.setTimeout(() => setSaveHint(null), 4000)
    } else if (res.reason === 'error') {
      setSaveHint(`导出失败：${res.message}`)
      window.setTimeout(() => setSaveHint(null), 4500)
    }
  }

  async function handleExportPdf() {
    const d = docRef.current
    if (!d) {
      return
    }
    const html = buildResumePrintHtml(d, { pageMarginMm: pdfMarginMm })
    const options: PdfExportOptions = {
      paperSize: pdfPaper,
      marginMm: pdfMarginMm,
      scale: pdfScale,
    }
    setExporting(true)
    try {
      const res = await window.electronAPI!.exportResumePdf({
        html,
        options,
        suggestedFileName: d.name,
      })
      if (res.ok) {
        setSaveHint(`已导出：${res.filePath}`)
        window.setTimeout(() => setSaveHint(null), 4000)
      } else if (res.reason === 'error') {
        setSaveHint(res.message)
        window.setTimeout(() => setSaveHint(null), 4000)
      }
    } finally {
      setExporting(false)
    }
  }

  const editorApiRef = useRef({
    persist,
    tryBack,
    handleExportPdf,
    handleExportBackupOne,
    pdfMarginMm,
  })
  editorApiRef.current = { persist, tryBack, handleExportPdf, handleExportBackupOne, pdfMarginMm }

  useImperativeHandle(
    ref,
    () => ({
      save: () => editorApiRef.current.persist(),
      print: async () => {
        const d = docRef.current
        const { pdfMarginMm: mm } = editorApiRef.current
        if (!d || !window.electronAPI?.printResumeHtml) {
          return
        }
        const html = buildResumePrintHtml(d, { pageMarginMm: mm })
        const res = await window.electronAPI.printResumeHtml(html)
        if (res.ok) {
          setSaveHint('已打开系统打印')
          window.setTimeout(() => setSaveHint(null), 2500)
        } else if (res.reason === 'error') {
          setSaveHint(res.message ?? '打印失败')
          window.setTimeout(() => setSaveHint(null), 4000)
        }
      },
      exportPdf: () => void editorApiRef.current.handleExportPdf(),
      backToList: () => editorApiRef.current.tryBack(),
      exportBackupOne: () => void editorApiRef.current.handleExportBackupOne(),
    }),
    [],
  )

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <p className="text-destructive">{loadError}</p>
        <Button onClick={() => onBack()}>返回列表</Button>
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">加载中…</div>
    )
  }

  function sectionCard(section: SectionVisibilityKey): React.ReactNode {
    if (!doc) {
      return null
    }
    switch (section) {
      case 'personal':
        return (
          <Card>
            <CardHeader className="text-sm font-semibold">个人信息</CardHeader>
            <CardContent className="space-y-3">
              <Field label="姓名">
                <input
                  className={lineInputClass()}
                  value={doc.sections.personal.fullName}
                  onChange={(e) =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        personal: { ...p.sections.personal, fullName: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
              <Field label="职位 / 头衔">
                <input
                  className={lineInputClass()}
                  value={doc.sections.personal.title}
                  onChange={(e) =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        personal: { ...p.sections.personal, title: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="邮箱">
                  <input
                    className={lineInputClass()}
                    value={doc.sections.personal.email}
                    onChange={(e) =>
                      patchDoc((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          personal: { ...p.sections.personal, email: e.target.value },
                        },
                      }))
                    }
                  />
                </Field>
                <Field label="电话">
                  <input
                    className={lineInputClass()}
                    value={doc.sections.personal.phone}
                    onChange={(e) =>
                      patchDoc((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          personal: { ...p.sections.personal, phone: e.target.value },
                        },
                      }))
                    }
                  />
                </Field>
              </div>
              <Field label="地点">
                <input
                  className={lineInputClass()}
                  value={doc.sections.personal.location}
                  onChange={(e) =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        personal: { ...p.sections.personal, location: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
              <Field label="照片 URL（可选）">
                <input
                  className={lineInputClass()}
                  value={doc.sections.personal.photoUrl}
                  onChange={(e) =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        personal: { ...p.sections.personal, photoUrl: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">社交链接</span>
                {doc.sections.personal.links.map((link, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      placeholder="标签"
                      className={lineInputClass()}
                      value={link.label}
                      onChange={(e) =>
                        patchDoc((p) => {
                          const links = [...p.sections.personal.links]
                          links[i] = { ...links[i], label: e.target.value }
                          return {
                            ...p,
                            sections: { ...p.sections, personal: { ...p.sections.personal, links } },
                          }
                        })
                      }
                    />
                    <input
                      placeholder="https://"
                      className={lineInputClass()}
                      value={link.url}
                      onChange={(e) =>
                        patchDoc((p) => {
                          const links = [...p.sections.personal.links]
                          links[i] = { ...links[i], url: e.target.value }
                          return {
                            ...p,
                            sections: { ...p.sections, personal: { ...p.sections.personal, links } },
                          }
                        })
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        patchDoc((p) => ({
                          ...p,
                          sections: {
                            ...p.sections,
                            personal: {
                              ...p.sections.personal,
                              links: p.sections.personal.links.filter((_, j) => j !== i),
                            },
                          },
                        }))
                      }
                    >
                      删
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        personal: {
                          ...p.sections.personal,
                          links: [...p.sections.personal.links, { label: '', url: '' }],
                        },
                      },
                    }))
                  }
                >
                  添加链接
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      case 'summary':
        return (
          <Card>
            <CardHeader className="text-sm font-semibold">总结与意向</CardHeader>
            <CardContent className="space-y-3">
              <Field label="标题 / 意向一行">
                <input
                  className={lineInputClass()}
                  value={doc.sections.summary.headline}
                  onChange={(e) =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        summary: { ...p.sections.summary, headline: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
              <Field label="正文">
                <textarea
                  className={textAreaClass()}
                  value={doc.sections.summary.body}
                  onChange={(e) =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        summary: { ...p.sections.summary, body: e.target.value },
                      },
                    }))
                  }
                />
              </Field>
              <p className="text-xs text-muted-foreground">{RICH_TEXT_HINT}</p>
            </CardContent>
          </Card>
        )
      case 'experience':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <span className="text-sm font-semibold">工作经历</span>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() =>
                  patchDoc((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      experience: {
                        entries: [
                          ...p.sections.experience.entries,
                          {
                            id: newEntityId(),
                            company: '',
                            role: '',
                            startDate: '',
                            endDate: '',
                            description: '',
                          },
                        ],
                      },
                    },
                  }))
                }
              >
                添加条目
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground">{RICH_TEXT_HINT}</p>
              {doc.sections.experience.entries.map((entry, idx) => (
                <ExperienceBlock
                  key={entry.id}
                  entry={entry}
                  onChange={(next) =>
                    patchDoc((p) => {
                      const entries = [...p.sections.experience.entries]
                      entries[idx] = next
                      return {
                        ...p,
                        sections: { ...p.sections, experience: { entries } },
                      }
                    })
                  }
                  onRemove={() =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        experience: {
                          entries: p.sections.experience.entries.filter((_, j) => j !== idx),
                        },
                      },
                    }))
                  }
                />
              ))}
              {doc.sections.experience.entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无经历，可点击「添加条目」。</p>
              ) : null}
            </CardContent>
          </Card>
        )
      case 'education':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <span className="text-sm font-semibold">教育背景</span>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() =>
                  patchDoc((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      education: {
                        entries: [
                          ...p.sections.education.entries,
                          {
                            id: newEntityId(),
                            school: '',
                            degree: '',
                            field: '',
                            startDate: '',
                            endDate: '',
                            description: '',
                          },
                        ],
                      },
                    },
                  }))
                }
              >
                添加条目
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground">{RICH_TEXT_HINT}</p>
              {doc.sections.education.entries.map((entry, idx) => (
                <EducationBlock
                  key={entry.id}
                  entry={entry}
                  onChange={(next) =>
                    patchDoc((p) => {
                      const entries = [...p.sections.education.entries]
                      entries[idx] = next
                      return {
                        ...p,
                        sections: { ...p.sections, education: { entries } },
                      }
                    })
                  }
                  onRemove={() =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        education: {
                          entries: p.sections.education.entries.filter((_, j) => j !== idx),
                        },
                      },
                    }))
                  }
                />
              ))}
            </CardContent>
          </Card>
        )
      case 'skills':
        return (
          <Card>
            <CardHeader className="text-sm font-semibold">技能（每行一项）</CardHeader>
            <CardContent>
              <textarea
                className={textAreaClass()}
                rows={6}
                value={doc.sections.skills.text}
                onChange={(e) =>
                  patchDoc((p) => ({
                    ...p,
                    sections: { ...p.sections, skills: { text: e.target.value } },
                  }))
                }
              />
            </CardContent>
          </Card>
        )
      case 'projects':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <span className="text-sm font-semibold">项目经验</span>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() =>
                  patchDoc((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      projects: {
                        entries: [
                          ...p.sections.projects.entries,
                          {
                            id: newEntityId(),
                            name: '',
                            role: '',
                            techStack: '',
                            startDate: '',
                            endDate: '',
                            description: '',
                          },
                        ],
                      },
                    },
                  }))
                }
              >
                添加条目
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground">{RICH_TEXT_HINT}</p>
              {doc.sections.projects.entries.map((entry, idx) => (
                <ProjectBlock
                  key={entry.id}
                  entry={entry}
                  onChange={(next) =>
                    patchDoc((p) => {
                      const entries = [...p.sections.projects.entries]
                      entries[idx] = next
                      return {
                        ...p,
                        sections: { ...p.sections, projects: { entries } },
                      }
                    })
                  }
                  onRemove={() =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        projects: {
                          entries: p.sections.projects.entries.filter((_, j) => j !== idx),
                        },
                      },
                    }))
                  }
                />
              ))}
            </CardContent>
          </Card>
        )
      case 'certificates':
        return (
          <Card>
            <CardHeader className="text-sm font-semibold">证书与奖项（每行一项）</CardHeader>
            <CardContent>
              <textarea
                className={textAreaClass()}
                rows={4}
                value={doc.sections.certificates.text}
                onChange={(e) =>
                  patchDoc((p) => ({
                    ...p,
                    sections: { ...p.sections, certificates: { text: e.target.value } },
                  }))
                }
              />
            </CardContent>
          </Card>
        )
      case 'languages':
        return (
          <Card>
            <CardHeader className="text-sm font-semibold">语言（每行一项）</CardHeader>
            <CardContent>
              <textarea
                className={textAreaClass()}
                rows={4}
                value={doc.sections.languages.text}
                onChange={(e) =>
                  patchDoc((p) => ({
                    ...p,
                    sections: { ...p.sections, languages: { text: e.target.value } },
                  }))
                }
              />
            </CardContent>
          </Card>
        )
      case 'custom':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <span className="text-sm font-semibold">自定义模块</span>
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() =>
                  patchDoc((p) => ({
                    ...p,
                    sections: {
                      ...p.sections,
                      custom: {
                        blocks: [
                          ...p.sections.custom.blocks,
                          { id: newEntityId(), title: '新模块', body: '' },
                        ],
                      },
                    },
                  }))
                }
              >
                添加区块
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-xs text-muted-foreground">{RICH_TEXT_HINT}</p>
              {doc.sections.custom.blocks.map((block, idx) => (
                <CustomBlockEditor
                  key={block.id}
                  block={block}
                  onChange={(next) =>
                    patchDoc((p) => {
                      const blocks = [...p.sections.custom.blocks]
                      blocks[idx] = next
                      return {
                        ...p,
                        sections: { ...p.sections, custom: { blocks } },
                      }
                    })
                  }
                  onRemove={() =>
                    patchDoc((p) => ({
                      ...p,
                      sections: {
                        ...p.sections,
                        custom: {
                          blocks: p.sections.custom.blocks.filter((_, j) => j !== idx),
                        },
                      },
                    }))
                  }
                />
              ))}
            </CardContent>
          </Card>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => tryBack()}>
            <ArrowLeft className="size-4" />
            列表
          </Button>
          <Input
            className="max-w-xs font-medium"
            value={doc.name}
            onChange={(e) => patchDoc((p) => ({ ...p, name: e.target.value }))}
          />
          {isDirty ? (
            <span className="text-xs text-amber-600 dark:text-amber-400">未保存</span>
          ) : (
            <span className="text-xs text-muted-foreground">已同步</span>
          )}
          <Button size="sm" variant="secondary" onClick={() => void persist()}>
            <Save className="size-4" />
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleExportBackupOne()}>
            <FileJson className="size-4" />
            JSON
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ThemeControls theme={theme} onChange={onThemeChange} />
          </div>
        </div>
        {saveHint ? <p className="mt-2 text-xs text-muted-foreground">{saveHint}</p> : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-h-[50vh] flex-1 overflow-y-auto border-b border-border p-4 lg:min-h-0 lg:w-1/2 lg:border-b-0 lg:border-r">
          <div className="mx-auto max-w-xl space-y-6 pb-20">
            <Card>
              <CardHeader className="text-sm font-semibold">模板与显示</CardHeader>
              <CardContent className="space-y-4">
                <Field label="模板">
                  <select
                    className={lineInputClass()}
                    value={doc.templateId}
                    onChange={(e) =>
                      patchDoc((p) => ({ ...p, templateId: e.target.value as TemplateId }))
                    }
                  >
                    {TEMPLATE_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(VISIBILITY_LABELS) as SectionVisibilityKey[]).map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={doc.visibility[key]}
                        onChange={(e) =>
                          patchDoc((p) => ({
                            ...p,
                            visibility: { ...p.visibility, [key]: e.target.checked },
                          }))
                        }
                      />
                      {VISIBILITY_LABELS[key]}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="text-sm font-semibold">导出 PDF</CardHeader>
              <CardContent className="space-y-3">
                <Field label="纸张">
                  <select
                    className={lineInputClass()}
                    value={pdfPaper}
                    onChange={(e) => setPdfPaper(e.target.value as 'A4' | 'Letter')}
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                  </select>
                </Field>
                <Field label={`边距（毫米）：${pdfMarginMm}`}>
                  <input
                    type="range"
                    min={4}
                    max={30}
                    value={pdfMarginMm}
                    onChange={(e) => setPdfMarginMm(Number(e.target.value))}
                    className="w-full"
                  />
                </Field>
                <Field label={`清晰度 / 缩放（影响 PDF 渲染，${pdfScale.toFixed(2)}）`}>
                  <input
                    type="range"
                    min={0.75}
                    max={1.25}
                    step={0.05}
                    value={pdfScale}
                    onChange={(e) => setPdfScale(Number(e.target.value))}
                    className="w-full"
                  />
                </Field>
                <Button disabled={exporting} onClick={() => void handleExportPdf()}>
                  {exporting ? '导出中…' : '导出 PDF…'}
                </Button>
              </CardContent>
            </Card>

            {getSectionOrder(doc).map((key) => (
              <DraggableSectionCard key={key} sectionKey={key} onReorder={handleSectionReorder}>
                {sectionCard(key)}
              </DraggableSectionCard>
            ))}
          </div>
        </div>

        <div className="flex min-h-[45vh] flex-1 flex-col bg-muted/30 lg:min-h-0 lg:w-1/2">
          <div className="shrink-0 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            实时预览（与导出同源 HTML）
            {previewPageCount != null ? (
              <span className="ml-2 font-normal text-muted-foreground">
                · 按当前纸张/边距估算约 {previewPageCount} 页（仅供参考，实际分页因打印机/PDF 引擎可能略有差异）
              </span>
            ) : null}
          </div>
          <iframe
            ref={previewIframeRef}
            title="preview"
            className="min-h-0 flex-1 w-full border-0 bg-white"
            srcDoc={previewHtml}
            onLoad={() => {
              const frame = previewIframeRef.current
              const body = frame?.contentDocument?.body
              if (!body) {
                return
              }
              const n = estimatePrintPageCount(body.scrollHeight, pdfMarginMm, pdfPaper)
              setPreviewPageCount(n)
            }}
          />
        </div>
      </div>

      <Dialog open={unsavedOpen} onOpenChange={setUnsavedOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>有未保存的更改</DialogTitle>
            <DialogDescription>返回列表前请选择如何处理当前编辑内容。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-stretch">
            <Button variant="outline" onClick={() => setUnsavedOpen(false)}>
              取消
            </Button>
            <Button variant="secondary" onClick={() => discardAndBack()}>
              放弃更改
            </Button>
            <Button onClick={() => void saveAndBack()}>保存并返回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
})

function ExperienceBlock({
  entry,
  onChange,
  onRemove,
}: {
  entry: ExperienceEntry
  onChange: (e: ExperienceEntry) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" type="button" onClick={onRemove}>
          删除条目
        </Button>
      </div>
      <Field label="公司">
        <input
          className={lineInputClass()}
          value={entry.company}
          onChange={(e) => onChange({ ...entry, company: e.target.value })}
        />
      </Field>
      <Field label="职位">
        <input
          className={lineInputClass()}
          value={entry.role}
          onChange={(e) => onChange({ ...entry, role: e.target.value })}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="开始">
          <input
            className={lineInputClass()}
            value={entry.startDate}
            onChange={(e) => onChange({ ...entry, startDate: e.target.value })}
          />
        </Field>
        <Field label="结束">
          <input
            className={lineInputClass()}
            value={entry.endDate}
            onChange={(e) => onChange({ ...entry, endDate: e.target.value })}
          />
        </Field>
      </div>
      <Field label="描述">
        <textarea
          className={textAreaClass()}
          value={entry.description}
          onChange={(e) => onChange({ ...entry, description: e.target.value })}
        />
      </Field>
    </div>
  )
}

function EducationBlock({
  entry,
  onChange,
  onRemove,
}: {
  entry: EducationEntry
  onChange: (e: EducationEntry) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" type="button" onClick={onRemove}>
          删除条目
        </Button>
      </div>
      <Field label="学校">
        <input
          className={lineInputClass()}
          value={entry.school}
          onChange={(e) => onChange({ ...entry, school: e.target.value })}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="学位">
          <input
            className={lineInputClass()}
            value={entry.degree}
            onChange={(e) => onChange({ ...entry, degree: e.target.value })}
          />
        </Field>
        <Field label="专业">
          <input
            className={lineInputClass()}
            value={entry.field}
            onChange={(e) => onChange({ ...entry, field: e.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="开始">
          <input
            className={lineInputClass()}
            value={entry.startDate}
            onChange={(e) => onChange({ ...entry, startDate: e.target.value })}
          />
        </Field>
        <Field label="结束">
          <input
            className={lineInputClass()}
            value={entry.endDate}
            onChange={(e) => onChange({ ...entry, endDate: e.target.value })}
          />
        </Field>
      </div>
      <Field label="备注">
        <textarea
          className={textAreaClass()}
          value={entry.description}
          onChange={(e) => onChange({ ...entry, description: e.target.value })}
        />
      </Field>
    </div>
  )
}

function ProjectBlock({
  entry,
  onChange,
  onRemove,
}: {
  entry: ProjectEntry
  onChange: (e: ProjectEntry) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" type="button" onClick={onRemove}>
          删除条目
        </Button>
      </div>
      <Field label="项目名称">
        <input
          className={lineInputClass()}
          value={entry.name}
          onChange={(e) => onChange({ ...entry, name: e.target.value })}
        />
      </Field>
      <Field label="职责角色">
        <input
          className={lineInputClass()}
          value={entry.role}
          onChange={(e) => onChange({ ...entry, role: e.target.value })}
        />
      </Field>
      <Field label="技术栈">
        <input
          className={lineInputClass()}
          value={entry.techStack}
          onChange={(e) => onChange({ ...entry, techStack: e.target.value })}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="开始">
          <input
            className={lineInputClass()}
            value={entry.startDate}
            onChange={(e) => onChange({ ...entry, startDate: e.target.value })}
          />
        </Field>
        <Field label="结束">
          <input
            className={lineInputClass()}
            value={entry.endDate}
            onChange={(e) => onChange({ ...entry, endDate: e.target.value })}
          />
        </Field>
      </div>
      <Field label="描述">
        <textarea
          className={textAreaClass()}
          value={entry.description}
          onChange={(e) => onChange({ ...entry, description: e.target.value })}
        />
      </Field>
    </div>
  )
}

function CustomBlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: CustomBlock
  onChange: (b: CustomBlock) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" type="button" onClick={onRemove}>
          删除区块
        </Button>
      </div>
      <Field label="标题">
        <input
          className={lineInputClass()}
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </Field>
      <Field label="内容">
        <textarea
          className={textAreaClass()}
          value={block.body}
          onChange={(e) => onChange({ ...block, body: e.target.value })}
        />
      </Field>
    </div>
  )
}
