import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Section } from '../lib/types'
import { sectionDomId } from './SectionShell'
import { useInvite } from './context'

export function scrollToSection(id: string, smooth = true) {
  const el = document.getElementById(sectionDomId(id))
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: smooth && !reduce ? 'smooth' : 'auto' })
}

/** 작은 세로형 페이지 내비게이션 — 현재 섹션 표시, 탭하면 해당 섹션으로 이동 */
export function SideNav({ sections, visible }: { sections: Section[]; visible: boolean }) {
  const { content } = useInvite()
  const [active, setActive] = useState(sections[0]?.id)
  const [showLabel, setShowLabel] = useState(false)
  const right = content.nav.position !== 'left'

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(sectionDomId(s.id))).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    const ratios = new Map<string, number>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set((e.target as HTMLElement).dataset.sectionId!, e.isIntersecting ? e.intersectionRect.height : 0)
        let best: string | undefined
        let bestH = -1
        for (const s of sections) {
          const h = ratios.get(s.id) ?? 0
          if (h > bestH) {
            bestH = h
            best = s.id
          }
        }
        if (best) setActive(best)
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections])

  useEffect(() => {
    if (!showLabel) return
    const t = setTimeout(() => setShowLabel(false), 1400)
    return () => clearTimeout(t)
  }, [showLabel, active])

  if (!content.nav.enabled || sections.length < 2) return null
  const activeIndex = Math.max(0, sections.findIndex((s) => s.id === active))
  const activeSection = sections[activeIndex]
  const DOT = 26 // 점 하나의 높이
  const PAD = 6 // 위아래 여백
  return (
    <AnimatePresence>
      {visible && (
        // 위치 고정은 바깥 div 가, 나타나기 효과는 안쪽 nav 가 맡아 서로 간섭하지 않음
        <div
          className="fixed top-1/2 z-40 -translate-y-1/2"
          style={{ [right ? 'right' : 'left']: 'max(4px, env(safe-area-inset-' + (right ? 'right' : 'left') + ', 0px))' }}
        >
          <motion.nav
            aria-label="섹션 이동"
            className="relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <ul
              className="flex flex-col items-center rounded-full"
              style={{
                paddingTop: PAD,
                paddingBottom: PAD,
                background: 'color-mix(in srgb, var(--c-bg) 72%, transparent)',
              }}
            >
              {sections.map((s) => {
                const on = s.id === active
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        scrollToSection(s.id)
                        setShowLabel(true)
                      }}
                      aria-label={`${s.label}(으)로 이동`}
                      aria-current={on ? 'true' : undefined}
                      className="flex w-[18px] items-center justify-center"
                      style={{ height: DOT }}
                    >
                      <span
                        className="block w-[5px] rounded-full transition-all duration-300"
                        style={{
                          height: on ? 14 : 5,
                          background: on ? 'var(--c-accent)' : 'var(--c-text)',
                          opacity: on ? 1 : 0.22,
                        }}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
            {/* 현재 섹션 이름 — 점 옆에 겹쳐서 표시(목록 폭에 영향 없음), 바뀔 때는 같은 자리에서 교차 페이드 */}
            <div
              className="pointer-events-none absolute"
              style={{
                top: PAD + activeIndex * DOT + DOT / 2,
                [right ? 'right' : 'left']: 'calc(100% + 6px)',
                transition: 'top .3s ease',
              }}
            >
              <AnimatePresence initial={false}>
                {(content.nav.showLabels || showLabel) && activeSection && (
                  <motion.span
                    key={activeSection.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="font-serif-en absolute top-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.64rem] tracking-[0.18em]"
                    style={{
                      [right ? 'right' : 'left']: 0,
                      translateY: '-50%',
                      background: 'color-mix(in srgb, var(--c-bg) 70%, transparent)',
                      color: 'var(--c-text)',
                    }}
                  >
                    {activeSection.label.toUpperCase()}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  )
}
