import type { CSSProperties } from 'react'
import type { HeroSettings, SectionOf } from '../../lib/types'
import { imageSrc } from '../../lib/image'
import { Reveal } from '../ui/Reveal'
import { SectionShell } from '../SectionShell'

/**
 * 브랜드 글씨 모양 (첫 화면 위 · 카드 맨 아래 로고가 같이 사용)
 * sans: 플랜텍 로고처럼 반듯하고 아주 굵은 고딕 / serif: 굵은 기울임 / script: 필기체
 */
export function brandTextStyle(f: HeroSettings['brandFont'], size: number): CSSProperties {
  if (f === 'script') return { fontFamily: 'var(--f-script)', fontWeight: 400, fontSize: `${size * 1.3}rem`, lineHeight: 1.15 }
  if (f === 'serif') return { fontFamily: 'var(--f-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: `${size}rem`, lineHeight: 1.2 }
  return { fontFamily: 'var(--f-sans)', fontWeight: 800, fontSize: `${size}rem`, lineHeight: 1.15, letterSpacing: '-0.01em' }
}

/** 배경 그림 (섹션 전체를 채우고, 아래쪽은 바탕색으로 자연스럽게 이어짐) */
export function HeroBackdrop({ s }: { s: HeroSettings }) {
  const src = imageSrc(s.bgImage)
  return (
    <>
      {src && (
        <img
          src={src}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${s.bgImage?.focusX ?? 50}% ${s.bgImage?.focusY ?? 50}%` }}
        />
      )}
      {s.overlay > 0 && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${s.overlay})` }} />}
      <div className="absolute inset-x-0 bottom-0 h-[28%]" style={{ background: 'linear-gradient(180deg, transparent, var(--c-bg))' }} />
    </>
  )
}

/** 브랜드 · 제목 · 부제 글자 (첫 화면과 상세 페이지 머리에서 같이 사용) */
export function HeroText({ s, animate = true }: { s: HeroSettings; animate?: boolean }) {
  const W = animate ? Reveal : ({ children, style }: { children: React.ReactNode; style?: CSSProperties; delay?: number }) => <div style={style}>{children}</div>
  return (
    <div>
      {s.brandImage && imageSrc(s.brandImage) ? (
        <W>
          <img src={imageSrc(s.brandImage)!} alt={s.brand || '로고'} className="block h-auto max-h-[56px] w-auto max-w-[60%] object-contain" />
        </W>
      ) : (
        s.brand && (
          <W>
            <p className="whitespace-pre-line" style={brandTextStyle(s.brandFont, 1.42)}>
              {s.brand}
            </p>
          </W>
        )
      )}
      {s.title && (
        <W delay={0.08}>
          <h1
            className="mt-4 whitespace-pre-line"
            style={{ fontSize: `calc(${s.titleSize}rem * var(--title-scale, 1))`, fontWeight: 500, lineHeight: 1.16, letterSpacing: '-0.01em' }}
          >
            {s.title}
          </h1>
        </W>
      )}
      {s.subtitle && (
        <W delay={0.16}>
          <p className="mt-2 whitespace-pre-line" style={{ color: s.subtitleColor || 'var(--c-accent)', fontWeight: 300, fontSize: 'calc(1.12rem * var(--body-scale, 1))', letterSpacing: '-0.01em' }}>
            {s.subtitle}
          </p>
        </W>
      )}
    </div>
  )
}

export function HeroSection({ section, selected }: { section: SectionOf<'hero'>; selected?: boolean }) {
  const s = section.settings
  return (
    <SectionShell section={section} selected={selected} center={false} backdrop={<HeroBackdrop s={s} />}>
      <div
        className="flex flex-col justify-end"
        style={{ minHeight: `calc(var(--app-h, 100svh) * ${s.height / 100})`, paddingTop: 'calc(48px + var(--safe-top, 0px))', paddingBottom: 40 }}
      >
        <HeroText s={s} />
      </div>
    </SectionShell>
  )
}
