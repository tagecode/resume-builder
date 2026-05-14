import { MoonStar, MonitorCog, SunMedium } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ThemeMode } from '@/shared/electron'

const options: Array<{ value: ThemeMode; label: string; Icon: typeof MonitorCog }> = [
  { value: 'system', label: '系统', Icon: MonitorCog },
  { value: 'light', label: '浅色', Icon: SunMedium },
  { value: 'dark', label: '深色', Icon: MoonStar },
]

export function ThemeControls({
  theme,
  onChange,
}: {
  theme: ThemeMode
  onChange: (t: ThemeMode) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(({ value, label, Icon }) => (
        <Button
          key={value}
          size="sm"
          variant={theme === value ? 'default' : 'outline'}
          onClick={() => void onChange(value)}
        >
          <Icon className="size-4" />
          {label}
        </Button>
      ))}
    </div>
  )
}
