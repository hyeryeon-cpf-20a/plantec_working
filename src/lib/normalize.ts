import { defaultContent, defaultSettings, defaultStyle, SECTION_META } from './defaults'
import type { InvitationContent, Section, SectionType } from './types'
import { isPlainObject, mergeDefaults, uid } from './util'

const TYPES = Object.keys(SECTION_META) as SectionType[]

/** DB 에서 읽은 콘텐츠를 현재 스키마에 맞게 보정합니다 (필드 누락·이전 버전 대비). */
export function normalizeContent(raw: unknown): InvitationContent {
  const base = defaultContent()
  if (!isPlainObject(raw) || !Array.isArray(raw.sections)) return base
  const { sections: rawSections, ...rest } = raw
  const merged = mergeDefaults({ ...base, sections: [] as Section[] }, rest)

  const seen = new Set<string>()
  const sections: Section[] = []
  for (const s of rawSections as unknown[]) {
    if (!isPlainObject(s) || !TYPES.includes(s.type as SectionType)) continue
    const type = s.type as SectionType
    let id = typeof s.id === 'string' && s.id ? s.id : uid()
    if (seen.has(id)) id = uid()
    seen.add(id)
    sections.push({
      id,
      type,
      label: typeof s.label === 'string' ? s.label : SECTION_META[type].label,
      hidden: s.hidden === true,
      style: mergeDefaults(defaultStyle(), s.style),
      settings: mergeDefaults(defaultSettings(type), s.settings),
    } as Section)
  }
  merged.sections = sections
  return merged
}
