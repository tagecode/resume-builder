import type {
  CustomBlock,
  EducationEntry,
  ExperienceEntry,
  PersonalSection,
  ProjectEntry,
  ResumeDocument,
  ResumeSections,
  SectionVisibility,
  TemplateId,
} from '../shared/resume'
import { RESUME_SCHEMA_VERSION } from '../shared/resume'

export function newEntityId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function defaultVisibility(): SectionVisibility {
  return {
    personal: true,
    summary: true,
    experience: true,
    education: true,
    skills: true,
    projects: true,
    certificates: true,
    languages: true,
    custom: true,
  }
}

function emptyPersonal(): PersonalSection {
  return {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    photoUrl: '',
    links: [],
  }
}

export function emptySections(): ResumeSections {
  return {
    personal: emptyPersonal(),
    summary: { headline: '', body: '' },
    experience: { entries: [] },
    education: { entries: [] },
    skills: { text: '' },
    projects: { entries: [] },
    certificates: { text: '' },
    languages: { text: '' },
    custom: { blocks: [] },
  }
}

export function sampleSections(): ResumeSections {
  const exp: ExperienceEntry = {
    id: newEntityId(),
    company: '示例科技有限公司',
    role: '高级前端工程师',
    startDate: '2022-01',
    endDate: '至今',
    description: '负责桌面端效率工具开发与性能优化。\n推动 TypeScript 与组件库标准化。',
  }
  const edu: EducationEntry = {
    id: newEntityId(),
    school: '示例大学',
    degree: '硕士',
    field: '计算机科学',
    startDate: '2016-09',
    endDate: '2019-06',
    description: '研究方向：人机交互',
  }
  const proj: ProjectEntry = {
    id: newEntityId(),
    name: '跨平台简历编辑器',
    role: '技术负责人',
    techStack: 'Electron, React, TypeScript',
    startDate: '2025-01',
    endDate: '',
    description: '离线可用的简历编辑与 PDF 导出方案。',
  }
  const custom: CustomBlock = {
    id: newEntityId(),
    title: '其他',
    body: '可在此处补充任意说明。',
  }
  return {
    personal: {
      fullName: '张三',
      title: '软件工程师',
      email: 'zhangsan@email.com',
      phone: '138-0000-0000',
      location: '上海',
      photoUrl: '',
      links: [
        { label: 'GitHub', url: 'https://github.com' },
        { label: '博客', url: 'https://example.com' },
      ],
    },
    summary: {
      headline: '求职意向：前端 / 客户端方向',
      body: '多年 Web 与桌面端开发经验，关注性能与可维护性，乐于推动工程化落地。',
    },
    experience: { entries: [exp] },
    education: { entries: [edu] },
    skills: { text: 'TypeScript\nReact\nElectron\nNode.js' },
    projects: { entries: [proj] },
    certificates: { text: 'PMP（示例）' },
    languages: { text: '英语 — 工作语言\n普通话 — 母语' },
    custom: { blocks: [custom] },
  }
}

export function createResumeDocument(options: {
  name: string
  templateId?: TemplateId
  sections?: ResumeSections
}): ResumeDocument {
  const now = new Date().toISOString()
  return {
    schemaVersion: RESUME_SCHEMA_VERSION,
    resumeId: newEntityId(),
    name: options.name.trim() || '未命名简历',
    updatedAt: now,
    templateId: options.templateId ?? 'classic',
    visibility: defaultVisibility(),
    sections: options.sections ?? emptySections(),
  }
}

export function cloneResumeForCopy(source: ResumeDocument): ResumeDocument {
  const now = new Date().toISOString()
  const cloned = structuredClone(source) as ResumeDocument
  cloned.resumeId = newEntityId()
  cloned.name = `${source.name} 的副本`
  cloned.updatedAt = now
  return cloned
}

export function validateResumeName(name: string): string | null {
  const t = name.trim()
  if (!t) {
    return '名称不能为空'
  }
  if (t.length > 120) {
    return '名称过长（≤120 字符）'
  }
  if (/[\\/]/.test(t)) {
    return '名称不能包含 / 或 \\'
  }
  return null
}
