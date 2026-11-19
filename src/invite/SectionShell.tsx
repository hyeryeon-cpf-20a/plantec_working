import type { CSSProperties, ReactNode } from 'react'
import type { Section } from '../lib/types'
import { SectionAnim } from './ui/Reveal'

export function sectionDomId(id: string) {
  return `sec-${id}`
}

export function SectionShell({
  section,
  children,
  className = '',
  innerClassName = '',
  center = true,
  selected,
  backdrop,
}: {
  section: Section
  children: ReactNode
  className?: string
  innerClassName?: string
  center?: boolean
  selected?: boolean
  /** 섹션 전체를 덮는 배경 레이어 (예: 흐린 사진) */
  backdrop?: ReactNode
}) {
  const st = section.style
  const bg =
    st.background === 'custom' && st.customBackground
      ? st.customBackground
      : st.background === 'bg2'
        ? 'var(--c-bg2)'
        : 'var(--c-bg)'
  const style: CSSProperties = {
    background: bg,
    paddingTop: `calc(${st.paddingTop}px + ${section.type === 'hero' ? 'var(--safe-top)' : '0px'})`,
    paddingBottom: st.paddingBottom,
    textAlign: st.align,
    color: st.textColor || undefined,
    ['--title-scale' as string]: st.titleScale,
    ['--body-scale' as string]: st.bodyScale,
  }
  return (
    <section
      id={sectionDomId(section.id)}
      data-section-id={section.id}
      data-preview-selected={selected ? 'true' : undefined}
      aria-label={section.label}
      className={`sec ${st.fitScreen ? 'sec-fit' : ''} ${center && st.fitScreen ? 'flex flex-col justify-center' : ''} ${className}`}
      style={style}
    >
      {backdrop && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {backdrop}
        </div>
      )}
      <SectionAnim.Provider value={st.animation}>
        <div className={`sec-inner ${backdrop ? 'relative' : ''} ${innerClassName}`}>{children}</div>
      </SectionAnim.Provider>
    </section>
  )
}

/** 섹션 제목 (영문 eyebrow + 한글 제목) */
export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title?: string }) {
  if (!eyebrow && !title) return null
  return (
    <header className="mb-10">
      {eyebrow && <p className="eyebrow" style={{ fontSize: `calc(0.72rem * var(--title-scale, 1))` }}>{eyebrow}</p>}
      {title && (
        <h2
          className="mt-3 font-normal"
          style={{ fontSize: `calc(1.22rem * var(--title-scale, 1))`, letterSpacing: '-0.01em', lineHeight: 1.5 }}
        >
          {title}
        </h2>
      )}
    </header>
  )
}

export function Body({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`whitespace-pre-line ${className}`}
      style={{ fontSize: `calc(0.94rem * var(--body-scale, 1))`, lineHeight: 1.9, ...style }}
    >
      {children}
    </div>
  )
}
