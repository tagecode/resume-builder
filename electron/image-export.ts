import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { BrowserWindow } from 'electron'

import type { ExportImageOptions } from '../src/shared/resume'

import { unlinkTemp } from './resume-storage'

/**
 * 将同源预览 HTML 截图为整页长图（IO-02）。
 */
export async function renderHtmlToImageBuffer(html: string, options: ExportImageOptions): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
    },
  })
  const tempHtml = path.join(
    tmpdir(),
    `resume-builder-img-${Date.now()}-${Math.random().toString(16).slice(2)}.html`,
  )
  const pixelRatio = Math.min(3, Math.max(1, options.pixelRatio))
  try {
    await writeFile(tempHtml, html, 'utf8')
    await win.loadFile(tempHtml)
    const size = (await win.webContents.executeJavaScript(`(function () {
      const w = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      return {
        w: Math.min(16000, Math.max(64, w)),
        h: Math.min(32000, Math.max(64, h)),
      };
    })()`)) as { w: number; h: number }
    win.setContentSize(Math.ceil(size.w), Math.ceil(size.h))
    await new Promise<void>((r) => {
      setTimeout(() => r(), 120)
    })
    const image = await win.webContents.capturePage()
    const { width, height } = image.getSize()
    const scaled =
      pixelRatio === 1
        ? image
        : image.resize({
            width: Math.round(width * pixelRatio),
            height: Math.round(height * pixelRatio),
          })
    return options.format === 'jpeg' ? scaled.toJPEG(92) : scaled.toPNG()
  } finally {
    win.destroy()
    await unlinkTemp(tempHtml)
  }
}
