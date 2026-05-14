import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { BrowserWindow } from 'electron'

import type { PdfExportOptions } from '../src/shared/resume'

import { unlinkTemp } from './resume-storage'

function mmToPdfMarginPx(mm: number): number {
  return Math.round((mm / 25.4) * 96)
}

export async function renderHtmlToPdfBuffer(
  html: string,
  options: PdfExportOptions,
): Promise<Buffer> {
  const margin = mmToPdfMarginPx(Math.max(0, options.marginMm))
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  })
  const tempHtml = path.join(
    tmpdir(),
    `resume-builder-${Date.now()}-${Math.random().toString(16).slice(2)}.html`,
  )
  try {
    await writeFile(tempHtml, html, 'utf8')
    await win.loadFile(tempHtml)
    await new Promise<void>((resolve) => {
      win.webContents.once('did-finish-load', () => {
        resolve()
      })
    })
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: options.paperSize,
      margins: {
        marginType: 'custom',
        top: margin,
        bottom: margin,
        left: margin,
        right: margin,
      },
      scale: options.scale,
    })
    return Buffer.from(pdf)
  } finally {
    win.destroy()
    await unlinkTemp(tempHtml)
  }
}
