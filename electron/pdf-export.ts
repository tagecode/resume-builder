import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { BrowserWindow } from 'electron'

import type { PdfExportOptions } from '../src/shared/resume'

import { unlinkTemp } from './resume-storage'

export async function renderHtmlToPdfBuffer(
  html: string,
  options: PdfExportOptions,
): Promise<Buffer> {
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
    // loadFile 的 Promise 本身会在 did-finish-load 后 resolve；若在此之后再监听该事件，会永远等不到。
    await win.loadFile(tempHtml)
    // 边距由 HTML/CSS（buildResumePrintHtml 的 body padding）控制，与 iframe 预览一致。
    // Chromium 对 printToPDF「自定义边距 + 纸张」会校验像素值；用 mm→px 换算在部分版本会误报
    // margins must be less than or equal to pageSize，故此处关闭 PDF 级边距。
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: options.paperSize,
      margins: { marginType: 'none' },
      scale: options.scale,
    })
    return Buffer.from(pdf)
  } finally {
    win.destroy()
    await unlinkTemp(tempHtml)
  }
}
