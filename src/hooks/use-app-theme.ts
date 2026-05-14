import { useCallback, useEffect, useState } from 'react'

import type { ThemeMode } from '@/shared/electron'

function applyDomTheme(theme: ThemeMode) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark)

  root.classList.toggle('dark', shouldUseDark)
}

export function useAppTheme() {
  const [theme, setTheme] = useState<ThemeMode>('system')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onSys = () => {
      setTheme((current) => {
        if (current === 'system') {
          applyDomTheme('system')
        }
        return current
      })
    }
    mq.addEventListener('change', onSys)
    return () => mq.removeEventListener('change', onSys)
  }, [])

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      if (!window.electronAPI) {
        applyDomTheme('system')
        return
      }
      const saved = await window.electronAPI.getTheme()
      if (!mounted) {
        return
      }
      setTheme(saved)
      applyDomTheme(saved)
    }

    void bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  const setThemePersist = useCallback(async (next: ThemeMode) => {
    setTheme(next)
    applyDomTheme(next)
    if (window.electronAPI) {
      await window.electronAPI.setTheme(next)
    }
  }, [])

  return { theme, setTheme: setThemePersist }
}
