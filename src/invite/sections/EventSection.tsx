import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { EventSettings, EventTab, ProgramItem, SectionOf } from '../../lib/types'
import { formatKoDate, formatKoTime, parseWedding } from '../../lib/date'
import { imageSrc } from '../../lib/image'
import { hasPlace, openMap, type MapApp, type Place } from '../../lib/maps'
import { useInvite } from '../context'
import { Img } from '../ui/Img'
import { Lightbox } from '../ui/Lightbox'
import { Reveal } from '../ui/Reveal'
import { SectionShell } from '../SectionShell'
import { brandTextStyle, HeroBackdrop, HeroText } from './HeroSection'

// ------------------------------------------------------------------ 작은 조각들

const muted = (s: EventSettings) => `color-mix(in srgb, ${s.cardTextColor} 58%, transparent)`
const line = (s: EventSettings) => `color-mix(in srgb, ${s.cardTextColor} 14%, transparent)`

export function EventIcon({ name, size = 64 }: { name: EventTab['icon']; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const body: Record<EventTab['icon'], ReactNode> = {
    calendar: (
      <>
        <rect x="6" y="9" width="40" height="36" rx="6" {...p} />
        <path d="M6 19h40M18 19v26M30 19v14M6 32h24" {...p} />
        <circle cx="45" cy="45" r="12" {...p} fill="#fff" />
        <path d="M40 45l4 4 6-7" {...p} />
      </>
    ),
    clock: (
      <>
        <circle cx="32" cy="32" r="22" {...p} />
        <path d="M32 19v14l9 6" {...p} />
      </>
    ),
    seat: (
      <>
        <rect x="10" y="12" width="44" height="14" rx="4" {...p} />
        <circle cx="16" cy="38" r="5" {...p} />
        <circle cx="32" cy="38" r="5" {...p} />
        <circle cx="48" cy="38" r="5" {...p} />
        <circle cx="24" cy="52" r="5" {...p} />
        <circle cx="40" cy="52" r="5" {...p} />
      </>
    ),
    meal: (
      <>
        <circle cx="32" cy="34" r="16" {...p} />
        <circle cx="32" cy="34" r="9" {...p} />
        <path d="M8 12v12a4 4 0 0 0 4 4v26M12 12v10M16 12v12a4 4 0 0 1-4 4" {...p} />
        <path d="M56 12c-4 2-6 8-6 16h6v26" {...p} />
      </>
    ),
    pin: (
      <>
        <path d="M32 56s-17-15-17-28a17 17 0 0 1 34 0c0 13-17 28-17 28z" {...p} />
        <circle cx="32" cy="28" r="6" {...p} />
      </>
    ),
    info: (
      <>
        <circle cx="32" cy="32" r="22" {...p} />
        <path d="M32 29v14M32 21v.5" {...p} />
      </>
    ),
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden style={{ color: 'var(--c-accent)' }}>
      {body[name]}
    </svg>
  )
}

/** 네이버지도 · 카카오맵 · 티맵 버튼 (주소만 넣으면 자동으로 연결) */
const APPS: { app: MapApp; label: ReactNode; style: CSSProperties; mark: ReactNode }[] = [
  {
    app: 'naver',
    label: '네이버지도',
    style: { background: '#fff', borderColor: '#DADADA', color: '#222' },
    mark: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" fill="#03C75A" />
        <path d="M9.4 6.5h1.8l1.9 2.9V6.5h1.5v5.2h-1.8l-1.9-2.9v2.9H9.4z" fill="#fff" />
      </svg>
    ),
  },
  {
    app: 'kakao',
    label: '카카오맵',
    style: { background: '#FEE500', borderColor: '#FEE500', color: '#191919' },
    mark: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" fill="#2B65E8" />
        <path d="M9 15v-3.5a2 2 0 0 1 2-2h4m-2-2l2 2-2 2" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    app: 'tmap',
    label: <span style={{ letterSpacing: '0.04em', fontWeight: 600 }}>TMAP</span>,
    style: { background: '#fff', borderColor: '#DADADA', color: '#111' },
    mark: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="tm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#E5007E" />
            <stop offset="1" stopColor="#2A5BFF" />
          </linearGradient>
        </defs>
        <path d="M3 4h18v4.5h-6.6V21H9.6V8.5H3z" fill="url(#tm)" />
      </svg>
    ),
  },
]

function MapPills({ place, s }: { place: Place; s: EventSettings }) {
  const { toast, flags } = useInvite()
  if (!hasPlace(place)) {
    return flags.preview ? (
      <p className="rounded-xl border border-dashed px-4 py-3 text-[0.78rem]" style={{ borderColor: 'var(--c-accent)', color: muted(s) }}>
        편집 화면에서 주소(또는 장소 이름)를 입력하면 길찾기 버튼이 자동으로 생겨요
      </p>
    ) : null
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {APPS.map((a) => (
        <button
          key={a.app}
          type="button"
          className="tap flex min-h-[46px] items-center justify-center gap-1.5 rounded-full border px-1.5 text-[0.86rem]"
          style={a.style}
          onClick={() => {
            if (!openMap(place, a.app)) toast('티맵은 휴대폰에서 열 수 있어요')
          }}
        >
          {a.mark}
          <span className="whitespace-nowrap">{a.label}</span>
        </button>
      ))}
    </div>
  )
}

function ProgramTable({ items, s }: { items: ProgramItem[]; s: EventSettings }) {
  if (!items.length) return null
  return (
    <div className="mt-8 text-left" style={{ borderTop: '1.5px solid var(--c-accent)', borderBottom: '1.5px solid var(--c-accent)' }}>
      {items.map((it, i) => (
        <div
          key={it.id}
          className="grid grid-cols-[41%_59%] items-center py-2.5"
          style={{ borderTop: i ? '1px solid color-mix(in srgb, var(--c-accent) 55%, transparent)' : undefined }}
        >
          <p className="text-center font-semibold" style={{ color: 'var(--c-accent)', fontSize: 'calc(1rem * var(--body-scale, 1))', letterSpacing: '-0.03em' }}>
            {it.time}
          </p>
          <div className="pr-2">
            <p className="font-semibold" style={{ fontSize: 'calc(1.04rem * var(--body-scale, 1))', lineHeight: 1.35 }}>
              {it.title}
            </p>
            {it.desc && (
              <p className="whitespace-pre-line" style={{ color: muted(s), fontSize: 'calc(0.78rem * var(--body-scale, 1))', lineHeight: 1.4, letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>
                {it.desc}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function BlockLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 font-bold" style={{ color: 'var(--c-accent)', fontSize: 'calc(1.3rem * var(--title-scale, 1))', letterSpacing: '0.12em' }}>
      <span style={{ fontWeight: 300 }}>ㅣ</span>
      {children}
      <span style={{ fontWeight: 300 }}>ㅣ</span>
    </p>
  )
}

function eventPlace(s: EventSettings): Place {
  return { name: s.venueName, address: s.address, lat: s.lat, lng: s.lng }
}

/** 상세 페이지 본문 */
function TabBody({ tab, s }: { tab: EventTab; s: EventSettings }) {
  const { content, flags } = useInvite()
  const [zoom, setZoom] = useState<number | null>(null)
  const src = imageSrc(tab.image)
  const date = parseWedding(content.wedding)
  const image = tab.image && (
    <button type="button" className="mt-6 block w-full" onClick={() => setZoom(0)} aria-label="크게 보기">
      <Img image={tab.image} aspect={tab.aspect} radius={12} />
    </button>
  )
  const body = tab.body && (
    <p className="mt-5 whitespace-pre-line" style={{ fontSize: 'calc(0.95rem * var(--body-scale, 1))', lineHeight: 1.75, wordBreak: 'keep-all' }}>
      {tab.body}
    </p>
  )
  const divider = <div className="my-9 h-px" style={{ background: line(s) }} />

  let inner: ReactNode
  if (tab.kind === 'schedule') {
    const time = s.timeText || formatKoTime(date)
    inner = (
      <>
        <BlockLabel>{tab.dateLabel}</BlockLabel>
        <p style={{ fontSize: 'calc(1.18rem * var(--body-scale, 1))', fontWeight: 500 }}>{s.dateText || formatKoDate(date)}</p>
        {time && (
          <p className="mt-1.5 inline-block font-bold" style={{ fontSize: 'calc(1.22rem * var(--body-scale, 1))', borderBottom: `2px solid ${s.cardTextColor}`, lineHeight: 1.3 }}>
            {time}
          </p>
        )}
        {s.venueName && (
          <>
            {divider}
            <BlockLabel>{tab.placeLabel}</BlockLabel>
            <p className="font-bold" style={{ fontSize: 'calc(1.18rem * var(--body-scale, 1))', wordBreak: 'keep-all' }}>
              {s.venueName}
            </p>
          </>
        )}
        {(s.address || flags.preview) && (
          <>
            {divider}
            <BlockLabel>{tab.addressLabel}</BlockLabel>
            <p style={{ fontSize: 'calc(1.1rem * var(--body-scale, 1))', fontWeight: 500, wordBreak: 'keep-all', color: s.address ? undefined : muted(s) }}>
              {s.address || '(주소를 입력하면 여기에 표시돼요)'}
            </p>
          </>
        )}
        {image}
        {body}
        {s.showDirections && hasPlace(eventPlace(s)) && (
          <div className="mt-6 flex items-baseline gap-3 text-left">
            <p className="shrink-0 font-semibold" style={{ fontSize: '0.98rem' }}>
              {tab.moreLabel}
            </p>
            <p style={{ color: muted(s), fontSize: '0.76rem', lineHeight: 1.4 }}>{tab.moreText}</p>
          </div>
        )}
        {s.showDirections && (
          <div className="mt-3">
            <MapPills place={eventPlace(s)} s={s} />
          </div>
        )}
      </>
    )
  } else {
    inner = (
      <>
        {tab.showIcon && (
          <div className="mb-4 flex justify-center">
            <EventIcon name={tab.icon} size={tab.icon === 'calendar' ? 74 : 64} />
          </div>
        )}
        {tab.title && (
          <p className="whitespace-pre-line font-medium" style={{ fontSize: 'calc(1.06rem * var(--title-scale, 1))', lineHeight: 1.5, letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>
            {tab.title}
          </p>
        )}
        {tab.kind === 'program' ? (
          <>
            <ProgramTable items={tab.items} s={s} />
            {image}
            {body}
          </>
        ) : (
          <>
            {image}
            {body}
            <ProgramTable items={tab.items} s={s} />
          </>
        )}
      </>
    )
  }
  return (
    <div className="text-center">
      {inner}
      {src && <Lightbox items={[{ src }]} index={zoom} onClose={() => setZoom(null)} />}
    </div>
  )
}

function Footer({ s }: { s: EventSettings }) {
  const { content } = useInvite()
  const hero = content.sections.find((x) => x.type === 'hero')
  const font = hero?.type === 'hero' ? hero.settings.brandFont : 'sans'
  if (s.footerImage) {
    return (
      <div className="mx-auto mt-14 w-[56%] pb-14">
        <Img image={s.footerImage} aspect="original" />
      </div>
    )
  }
  if (!s.footerText) return <div className="pb-12" />
  return (
    <p
      className="mt-14 whitespace-pre-line pb-14 text-center"
      style={{ ...brandTextStyle(font, 1.95), color: s.footerColor }}
    >
      {s.footerText}
    </p>
  )
}

function Card({ s, children, style }: { s: EventSettings; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="-mx-2 px-6 pt-9"
      style={{ background: s.cardColor, color: s.cardTextColor, borderRadius: '30px 30px 0 0', fontFamily: 'var(--f-sans)', textAlign: 'left', ...style }}
    >
      {children}
    </div>
  )
}

// ------------------------------------------------------------------ 상세 페이지 (버튼을 누르면 열림)

const OPEN_KEY = 'eventTab'

function DetailPage({ tab, s, onClose }: { tab: EventTab; s: EventSettings; onClose: () => void }) {
  const { content } = useInvite()
  const hero = content.sections.find((x) => x.type === 'hero' && !x.hidden) as SectionOf<'hero'> | undefined
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo(0, 0)
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prev
    }
  }, [tab.id])
  return (
    <motion.div
      ref={ref}
      className="invite-doc fixed inset-0 z-[70] overflow-y-auto overscroll-contain"
      style={{ background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'var(--f-sans)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      role="dialog"
      aria-modal="true"
      aria-label={tab.label}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="처음 화면으로"
        className="tap fixed z-[71] flex h-10 w-10 items-center justify-center rounded-full"
        style={{ top: 'calc(14px + var(--safe-top, 0px))', right: 14, background: '#fff', color: '#2546D6', boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 3.2 2.6 11a1 1 0 0 0 1.3 1.5l.8-.7V20a1 1 0 0 0 1 1h4.3v-5.5h4v5.5h4.3a1 1 0 0 0 1-1v-8.2l.8.7a1 1 0 1 0 1.3-1.5z" />
        </svg>
      </button>
      <div className="relative overflow-hidden px-6">
        {hero && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <HeroBackdrop s={hero.settings} />
          </div>
        )}
        <div className="relative mx-auto max-w-[430px]" style={{ paddingTop: 'calc(120px + var(--safe-top, 0px))', paddingBottom: 56 }}>
          {hero && <HeroText s={hero.settings} animate={false} />}
        </div>
      </div>
      <div className="relative z-[1] px-6">
        <div className="mx-auto max-w-[430px]">
          <Card s={s} style={{ minHeight: '60svh' }}>
            <div className="-mt-[58px] mb-8 flex justify-center">
              <span
                className="rounded-full px-10 py-2.5 font-bold"
                style={{ background: 'var(--c-accent)', color: '#fff', fontSize: 'calc(1.22rem * var(--title-scale, 1))', boxShadow: '0 6px 16px -8px rgba(0,0,0,.35)' }}
              >
                {tab.label}
              </span>
            </div>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>
              <TabBody tab={tab} s={s} />
            </motion.div>
            <div className="mt-10 flex justify-center">
              <button type="button" onClick={onClose} className="tap rounded-full border px-6 py-2.5 text-[0.86rem]" style={{ borderColor: line(s), color: muted(s) }}>
                ← 처음 화면으로
              </button>
            </div>
            <Footer s={s} />
          </Card>
        </div>
      </div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ 메인 카드

export function EventSection({ section, selected }: { section: SectionOf<'event'>; selected?: boolean }) {
  const { flags } = useInvite()
  const s = section.settings
  const [openId, setOpenId] = useState<string | null>(null)
  const tab = s.tabs.find((t) => t.id === openId) ?? null

  // 휴대폰 ‘뒤로 가기’로 상세 페이지를 닫을 수 있게
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const id = (e.state as Record<string, unknown> | null)?.[OPEN_KEY]
      setOpenId(typeof id === 'string' ? id : null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const open = (id: string) => {
    if (!flags.preview) window.history.pushState({ ...(window.history.state ?? {}), [OPEN_KEY]: id }, '')
    setOpenId(id)
  }
  const close = useCallback(() => {
    if (!flags.preview && (window.history.state as Record<string, unknown> | null)?.[OPEN_KEY]) window.history.back()
    else setOpenId(null)
  }, [flags.preview])

  const btnStyle = (i: number): CSSProperties => {
    const outline = s.buttonStyle === 'outline' || (s.buttonStyle === 'mixed' && i % 2 === 0)
    return outline
      ? { background: s.cardColor, color: 'var(--c-accent)', border: '1.5px solid var(--c-accent)' }
      : { background: 'var(--c-accent)', color: '#fff', border: '1.5px solid var(--c-accent)' }
  }

  return (
    <SectionShell section={section} selected={selected} center={false}>
      <Reveal>
        <Card s={s}>
          {s.tabs.length > 0 && (
            <>
              <h2 className="font-bold" style={{ fontSize: 'calc(1.32rem * var(--title-scale, 1))', letterSpacing: '-0.02em' }}>
                {s.title}
              </h2>
              {s.description && (
                <p className="mt-1 whitespace-pre-line" style={{ color: muted(s), fontSize: 'calc(0.84rem * var(--body-scale, 1))', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                  {s.description}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {s.tabs.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => open(t.id)}
                    className={`tap min-h-[48px] rounded-full px-2 font-bold ${s.tabs.length % 2 === 1 && i === s.tabs.length - 1 ? 'col-span-2' : ''}`}
                    style={{ ...btnStyle(i), fontSize: 'calc(1.06rem * var(--body-scale, 1))', letterSpacing: '-0.01em' }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {s.showDirections && (
            <>
              {s.tabs.length > 0 && <div className="-mx-2 my-7 h-px" style={{ background: line(s) }} />}
              <h2 className="font-bold" style={{ fontSize: 'calc(1.32rem * var(--title-scale, 1))', letterSpacing: '-0.02em' }}>
                {s.mapTitle}
              </h2>
              {s.mapDescription && (
                <p className="mb-4 mt-1 whitespace-pre-line" style={{ color: muted(s), fontSize: 'calc(0.84rem * var(--body-scale, 1))', lineHeight: 1.5 }}>
                  {s.mapDescription}
                </p>
              )}
              <MapPills place={eventPlace(s)} s={s} />
            </>
          )}
          <Footer s={s} />
        </Card>
      </Reveal>
      {typeof document !== 'undefined' &&
        createPortal(<AnimatePresence>{tab && <DetailPage key={tab.id} tab={tab} s={s} onClose={close} />}</AnimatePresence>, document.body)}
    </SectionShell>
  )
}
