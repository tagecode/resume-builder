import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { BrowserWindow } from 'electron'

import { unlinkTemp } from './resume-storage'

/**
 * 加载同源 HTML 并拉起系统打印对话框（与 PDF 使用相同 HTML）。
 */
export async function printHtmlWithDialog(html: string): Promise<void> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  })
  const tempHtml = path.join(tmpdir(), `resume-builder-print-${Date.now()}-${Math.random().toString(16).slice(2)}.html`)
  try {
    await writeFile(tempHtml, html, 'utf8')
    await win.loadFile(tempHtml)
    await new Promise<void>((resolve, reject) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (!success) {
          reject(new Error(failureReason || '打印已取消或失败'))
          return
        }
        resolve()
      })
    })
  } finally {
    win.destroy()
    await unlinkTemp(tempHtml)
  }
}
