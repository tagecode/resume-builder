/**
 * MVP 冒烟：不启动 GUI，校验预览/PDF 同源 HTML 的编码、显隐与多模板差异。
 * 运行：pnpm run verify:mvp
 */
import assert from 'node:assert/strict'

import { parseResumeBackupJson } from '../electron/backup-io'
import { buildResumePrintHtml } from '../src/lib/resume-print-html'
import {
  createResumeDocument,
  defaultVisibility,
  sampleSections,
} from '../src/lib/resume-factory'
import type { ResumeDocument, TemplateId } from '../src/shared/resume'
import { BACKUP_FORMAT_VERSION } from '../src/shared/backup'

function doc(overrides: Partial<ResumeDocument>): ResumeDocument {
  const base = createResumeDocument({
    name: '验收测试简历',
    sections: sampleSections(),
  })
  return { ...base, ...overrides }
}

const zhSample = sampleSections()
assert.ok(
  zhSample.personal.fullName.includes('张') || zhSample.experience.entries.length > 0,
  '示例数据应含中文，便于检测乱码风险',
)

// UTF-8 与中文保留
const htmlUtf8 = buildResumePrintHtml(doc({}))
assert.match(htmlUtf8, /charset=["']UTF-8["']/i)
assert.ok(htmlUtf8.includes('张三'), '姓名等中文应原样出现在 HTML 中')

// CE-04：隐藏模块不出现在 HTML（与预览/PDF 同源）
const hiddenExp = doc({
  visibility: { ...defaultVisibility(), experience: false },
})
const htmlHidden = buildResumePrintHtml(hiddenExp)
assert.ok(
  !htmlHidden.includes('<h2>工作经历</h2>'),
  '关闭「工作经历」时不应输出该区块标题',
)
assert.ok(htmlHidden.includes('<h2>教育背景</h2>'), '其他可见区块仍应输出')

// TS：多套模板 CSS 应有区分（同一字段下切换模板仍渲染）
const bodies: Record<TemplateId, string> = {
  classic: buildResumePrintHtml(doc({ templateId: 'classic' })),
  modern: buildResumePrintHtml(doc({ templateId: 'modern' })),
  minimal: buildResumePrintHtml(doc({ templateId: 'minimal' })),
}
assert.notEqual(bodies.classic, bodies.modern)
assert.notEqual(bodies.modern, bodies.minimal)
assert.ok(bodies.classic.includes('Georgia'), 'classic 模板应包含 serif 栈')
assert.ok(bodies.modern.includes('system-ui'), 'modern 模板应包含 sans 栈')
assert.ok(bodies.minimal.includes('Helvetica'), 'minimal 模板应包含 Helvetica 栈')

// IO-06：备份 JSON 封装与单文件简历均可解析
const sampleDoc = doc({ name: '备份解析测试' })
const envelope = JSON.stringify({
  backupFormatVersion: BACKUP_FORMAT_VERSION,
  appId: 'resume-builder',
  exportedAt: new Date().toISOString(),
  resumes: [sampleDoc],
})
const parsedEnvelope = parseResumeBackupJson(envelope)
assert.ok(parsedEnvelope.ok)
if (parsedEnvelope.ok) {
  assert.equal(parsedEnvelope.file.resumes.length, 1)
  assert.equal(parsedEnvelope.file.resumes[0].name, '备份解析测试')
}
const parsedBare = parseResumeBackupJson(JSON.stringify(sampleDoc))
assert.ok(parsedBare.ok)
if (parsedBare.ok) {
  assert.equal(parsedBare.file.resumes.length, 1)
}

console.log('verify:mvp — 全部断言通过（仍为离线验收，导出 PDF 请在桌面端人工打开确认）。')
