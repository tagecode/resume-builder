/**
 * 轻量标记 → 安全 HTML：先在「行级」转义，再做受限的内联替换，避免注入。
 * 语法：**粗体**、*斜体*、`- ` 开头的连续行为列表项、`[文字](https://…)` 链接。
 */
export function richTextToSafeHtml(raw: string): string {
  if (!raw.trim()) return ''
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        const itemRaw = lines[i].replace(/^\s*-\s+/, '')
        items.push(`<li>${inlineRichHtml(escapeHtml(itemRaw))}</li>`)
        i++
      }
      blocks.push(`<ul class="rt-ul">${items.join('')}</ul>`)
      continue
    }
    if (line === '') {
      blocks.push('<br/>')
      i++
      continue
    }
    blocks.push(`<div class="rt-line">${inlineRichHtml(escapeHtml(line))}</div>`)
    i++
  }
  return `<div class="rich-text">${blocks.join('')}</div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 输入须已为 HTML 转义后的纯文本片段（可含 * 与 [ ]） */
function inlineRichHtml(escaped: string): string {
  let s = escaped
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, urlRaw: string) => {
    try {
      const u = new URL(urlRaw)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return label
      }
      const href = u.href.replace(/"/g, '&quot;')
      return `<a href="${href}">${label}</a>`
    } catch {
      return label
    }
  })
  return s
}
