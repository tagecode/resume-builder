import type { ResumeDocument, TemplateId } from '@/shared/resume'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linesToItems(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<li>${esc(l)}</li>`)
    .join('')
}

function renderBody(resume: ResumeDocument): string {
  const { sections: s, visibility: v } = resume
  const parts: string[] = []

  if (v.personal) {
    const p = s.personal
    const links =
      p.links.length > 0
        ? `<div class="links">${p.links.map((l) => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join(' · ')}</div>`
        : ''
    parts.push(`
      <header class="personal">
        ${p.photoUrl ? `<img class="photo" src="${esc(p.photoUrl)}" alt="" />` : ''}
        <div class="name-block">
          <h1>${esc(p.fullName) || '姓名'}</h1>
          <p class="title-line">${esc(p.title)}</p>
          <p class="meta">${esc([p.email, p.phone, p.location].filter(Boolean).join(' · '))}</p>
          ${links}
        </div>
      </header>
    `)
  }

  if (v.summary && (s.summary.headline || s.summary.body)) {
    parts.push(`
      <section class="block">
        <h2>总结与意向</h2>
        ${s.summary.headline ? `<p class="subhead">${esc(s.summary.headline)}</p>` : ''}
        ${s.summary.body ? `<div class="pre">${esc(s.summary.body)}</div>` : ''}
      </section>
    `)
  }

  if (v.experience && s.experience.entries.length > 0) {
    const rows = s.experience.entries
      .map(
        (e) => `
        <article class="item">
          <div class="item-head">
            <strong>${esc(e.company)}</strong>
            <span class="muted">${esc(e.role)}</span>
            <span class="dates">${esc(e.startDate)} — ${esc(e.endDate)}</span>
          </div>
          ${e.description ? `<div class="pre">${esc(e.description)}</div>` : ''}
        </article>
      `,
      )
      .join('')
    parts.push(`<section class="block"><h2>工作经历</h2>${rows}</section>`)
  }

  if (v.education && s.education.entries.length > 0) {
    const rows = s.education.entries
      .map(
        (e) => `
        <article class="item">
          <div class="item-head">
            <strong>${esc(e.school)}</strong>
            <span class="muted">${esc(e.degree)} · ${esc(e.field)}</span>
            <span class="dates">${esc(e.startDate)} — ${esc(e.endDate)}</span>
          </div>
          ${e.description ? `<div class="pre small">${esc(e.description)}</div>` : ''}
        </article>
      `,
      )
      .join('')
    parts.push(`<section class="block"><h2>教育背景</h2>${rows}</section>`)
  }

  if (v.skills && s.skills.text.trim()) {
    const items = linesToItems(s.skills.text)
    parts.push(`<section class="block"><h2>技能</h2><ul class="tags">${items}</ul></section>`)
  }

  if (v.projects && s.projects.entries.length > 0) {
    const rows = s.projects.entries
      .map(
        (e) => `
        <article class="item">
          <div class="item-head">
            <strong>${esc(e.name)}</strong>
            <span class="muted">${esc(e.role)}</span>
            <span class="dates">${esc(e.techStack)}</span>
          </div>
          <p class="mini-dates">${esc(e.startDate)} — ${esc(e.endDate)}</p>
          ${e.description ? `<div class="pre">${esc(e.description)}</div>` : ''}
        </article>
      `,
      )
      .join('')
    parts.push(`<section class="block"><h2>项目经验</h2>${rows}</section>`)
  }

  if (v.certificates && s.certificates.text.trim()) {
    parts.push(`
      <section class="block">
        <h2>证书与奖项</h2>
        <ul class="tags">${linesToItems(s.certificates.text)}</ul>
      </section>
    `)
  }

  if (v.languages && s.languages.text.trim()) {
    parts.push(`
      <section class="block">
        <h2>语言</h2>
        <ul class="tags">${linesToItems(s.languages.text)}</ul>
      </section>
    `)
  }

  if (v.custom && s.custom.blocks.length > 0) {
    const blocks = s.custom.blocks
      .map(
        (b) => `
        <article class="item">
          <h3>${esc(b.title)}</h3>
          ${b.body ? `<div class="pre">${esc(b.body)}</div>` : ''}
        </article>
      `,
      )
      .join('')
    parts.push(`<section class="block custom">${blocks}</section>`)
  }

  return parts.join('\n')
}

function stylesForTemplate(id: TemplateId): string {
  const base = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12mm 14mm;
      color: #111;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pre { white-space: pre-wrap; word-break: break-word; line-height: 1.55; font-size: 10.5pt; }
    .small { font-size: 10pt; }
    .muted { color: #444; font-weight: 500; }
    .dates, .mini-dates { color: #555; font-size: 9.5pt; }
    .mini-dates { margin: 2px 0 6px; }
    h2 {
      font-size: 12pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
      margin: 14px 0 10px;
    }
    h3 { font-size: 11pt; margin: 8px 0 4px; }
    .block { page-break-inside: avoid; }
    .item { margin-bottom: 10px; page-break-inside: avoid; }
    .item-head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: baseline; margin-bottom: 4px; }
    .item-head strong { font-size: 11pt; }
    ul.tags { margin: 4px 0 0 18px; padding: 0; }
    ul.tags li { margin: 2px 0; }
    .subhead { font-weight: 600; margin: 0 0 6px; }
    a { color: #0b57d0; text-decoration: none; }
  `

  if (id === 'classic') {
    return (
      base +
      `
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.45; }
      .personal { text-align: center; margin-bottom: 18px; }
      .personal .photo { width: 72px; height: 72px; object-fit: cover; border-radius: 50%; margin-bottom: 8px; }
      .name-block h1 { margin: 0; font-size: 22pt; font-weight: 700; }
      .title-line { margin: 6px 0 4px; font-size: 12pt; color: #333; }
      .meta { margin: 0; font-size: 10.5pt; color: #444; }
      .links { margin-top: 8px; font-size: 10pt; }
    `
    )
  }

  if (id === 'modern') {
    return (
      base +
      `
      body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 10.5pt; line-height: 1.5; }
      .personal { display: flex; gap: 16px; align-items: flex-start; border-left: 4px solid #2563eb; padding-left: 14px; margin-bottom: 18px; }
      .personal .photo { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
      .name-block h1 { margin: 0; font-size: 20pt; font-weight: 800; letter-spacing: -0.02em; }
      .title-line { margin: 4px 0; color: #2563eb; font-weight: 600; }
      .meta { margin: 0; }
      .links { margin-top: 6px; }
      h2 { border-bottom-color: #2563eb; color: #1e3a8a; }
    `
    )
  }

  // minimal
  return (
    base +
    `
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.6; color: #1a1a1a; }
    .personal { display: flex; gap: 14px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e5e5e5; }
    .personal .photo { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; }
    .name-block h1 { margin: 0; font-size: 18pt; font-weight: 600; letter-spacing: -0.01em; }
    .title-line { margin: 4px 0; color: #666; }
    .meta { margin: 0; color: #555; font-size: 10pt; }
    .links { margin-top: 6px; font-size: 10pt; }
    h2 { border-bottom: none; text-transform: none; letter-spacing: 0; font-size: 11pt; color: #000; margin-top: 18px; }
    .item-head { flex-direction: column; gap: 2px; }
  `
  )
}

/**
 * 完整 HTML 文档，供预览 iframe 与 printToPDF 使用（同一来源保证一致）。
 */
export function buildResumePrintHtml(resume: ResumeDocument): string {
  const body = renderBody(resume)
  const css = stylesForTemplate(resume.templateId)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${esc(resume.name)}</title>
  <style>${css}</style>
</head>
<body>
${body}
</body>
</html>`
}
