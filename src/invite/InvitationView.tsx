import { memo, useEffect, useMemo, useState } from 'react'
import type { InvitationContent, RuntimeFlags, Section } from '../lib/types'
import { fontStack, loadFonts } from '../lib/fonts'
import { prefersReducedMotion } from '../lib/util'
import { InviteProvider } from './context'
import { SideNav } from './SideNav'
import { GallerySection } from './sections/GallerySection'
import { TextSection } from './sections/TextSection'
import { GreetingSection } from './sections/GreetingSection'
import { HeroSection } from './sections/HeroSection'
import { LetterSection } from './sections/LetterSection'
import { EventSection } from './sections/EventSection'

export interface ViewOptions {
  selectedId?: string | null
  onSelect?: (id: string) => void
}

function applyTheme(content: InvitationContent) {
  const r = document.documentElement
  r.classList.add('invite-doc')
  const c = content.theme.colors
  r.style.setProperty('--c-bg', c.bg)
  r.style.setProperty('--c-bg2', c.bg2)
  r.style.setProperty('--c-text', c.text)
  r.style.setProperty('--c-accent', c.accent)
  r.style.setProperty('--c-sage', c.sage)
  r.style.setProperty('--c-wax', c.wax)
  r.style.setProperty('--c-muted', c.muted)
  r.style.setProperty('--f-script', fontStack(content.theme.fonts.script))
  r.style.setProperty('--f-serif', fontStack(content.theme.fonts.serif))
  r.style.setProperty('--f-sans', fontStack(content.theme.fonts.sans))
  r.style.fontSize = `${content.theme.baseFontSize || 15}px`
  document.body.style.letterSpacing = content.theme.letterSpacing ? `${content.theme.letterSpacing}em` : ''
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg)
  loadFonts([content.theme.fonts.script, content.theme.fonts.serif, content.theme.fonts.sans])
}

function renderSection(s: Section, selected: boolean) {
  switch (s.type) {
    case 'hero':
      return <HeroSection key={s.id} section={s} selected={selected} />
    case 'letter':
      return <LetterSection key={s.id} section={s} selected={selected} />
    case 'event':
      return <EventSection key={s.id} section={s} selected={selected} />
    case 'gallery':
      return <GallerySection key={s.id} section={s} selected={selected} />
    case 'text':
      return <TextSection key={s.id} section={s} selected={selected} />
    case 'greeting':
      return <GreetingSection key={s.id} section={s} selected={selected} />
    default:
      return null
  }
}

const SectionNode = memo(function SectionNode({ s, selected }: { s: Section; selected: boolean }) {
  return renderSection(s, selected)
})

export function InvitationView({ content, flags, options = {} }: { content: InvitationContent; flags: RuntimeFlags; options?: ViewOptions }) {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const fn = () => setReduced(mq.matches)
    mq.addEventListener?.('change', fn)
    return () => mq.removeEventListener?.('change', fn)
  }, [])

  useEffect(() => applyTheme(content), [content])

  // 초대장 화면 확대 막기 (배율 1배 고정 + 아이폰 사파리의 두 손가락 확대 차단)
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const prev = meta?.getAttribute('content')
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover')
    const stop = (e: Event) => e.preventDefault()
    const multiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('gesturestart', stop, { passive: false })
    document.addEventListener('gesturechange', stop, { passive: false })
    document.addEventListener('touchmove', multiTouch, { passive: false })
    return () => {
      if (prev) meta?.setAttribute('content', prev)
      document.removeEventListener('gesturestart', stop)
      document.removeEventListener('gesturechange', stop)
      document.removeEventListener('touchmove', multiTouch)
    }
  }, [])

  // 화면 높이를 한 번만 재서 고정 (휴대폰 주소창이 접혔다 펴져도 섹션·사진 크기가 바뀌지 않게).
  // 가로 폭이 바뀔 때(휴대폰을 돌릴 때)만 다시 잽니다.
  useEffect(() => {
    const r = document.documentElement
    let lastW = window.innerWidth
    const set = () => r.style.setProperty('--app-h', `${window.innerHeight}px`)
    set()
    const onResize = () => {
      if (Math.abs(window.innerWidth - lastW) < 2) return
      lastW = window.innerWidth
      set()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const visible = useMemo(() => content.sections.filter((s) => !s.hidden), [content.sections])

  return (
    <InviteProvider content={content} flags={flags} reducedMotion={reduced}>
      <div
        className="invite-root invite-scroller"
        onClickCapture={
          options.onSelect
            ? (e) => {
                const el = (e.target as HTMLElement).closest('[data-section-id]') as HTMLElement | null
                if (el?.dataset.sectionId) options.onSelect!(el.dataset.sectionId)
              }
            : undefined
        }
      >
        <main>
          {visible.map((s) => (
            <SectionNode key={s.id} s={s} selected={options.selectedId === s.id} />
          ))}
        </main>
        {visible.length === 0 && (
          <div className="flex min-h-[100svh] items-center justify-center text-[0.9rem]" style={{ color: 'var(--c-muted)' }}>
            표시할 섹션이 없어요.
          </div>
        )}
      </div>
      <SideNav sections={visible} visible />
    </InviteProvider>
  )
}

export type { RuntimeFlags }
