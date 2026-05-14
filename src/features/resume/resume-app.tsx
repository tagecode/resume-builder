import { useState } from 'react'

import { useAppTheme } from '@/hooks/use-app-theme'

import { ResumeEditorPage } from '@/features/resume/resume-editor-page'
import { ResumeListPage } from '@/features/resume/resume-list-page'

export function ResumeApp() {
  const { theme, setTheme } = useAppTheme()
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [listTick, setListTick] = useState(0)

  if (view === 'editor' && editingId) {
    return (
      <ResumeEditorPage
        resumeId={editingId}
        theme={theme}
        onThemeChange={setTheme}
        onBack={() => {
          setView('list')
          setEditingId(null)
        }}
        listRefreshKey={() => setListTick((t) => t + 1)}
      />
    )
  }

  return (
    <ResumeListPage
      key={listTick}
      theme={theme}
      onThemeChange={setTheme}
      onOpenResume={(id) => {
        setEditingId(id)
        setView('editor')
      }}
    />
  )
}
