import { useEffect, useRef, useState } from 'react'
import type { Aspect, GalleryPhoto, SectionOf } from '../../lib/types'
import { imageSrc } from '../../lib/image'
import { Img } from '../ui/Img'
import { Lightbox } from '../ui/Lightbox'
import { Reveal } from '../ui/Reveal'
import { SectionShell, SectionTitle } from '../SectionShell'

/** 에디토리얼 콜라주: 사진 수에 따라 자동으로 패턴을 반복 */
function Editorial({ photos, open }: { photos: GalleryPhoto[]; open: (i: number) => void }) {
  const blocks: GalleryPhoto[][] = []
  for (let i = 0; i < photos.length; i += 3) blocks.push(photos.slice(i, i + 3))
  return (
    <div className="space-y-3">
      {blocks.map((b, bi) => {
        const base = bi * 3
        const flip = bi % 2 === 1
        if (b.length === 1)
          return (
            <Reveal key={bi} variant="zoom">
              <Img image={b[0].image} aspect="4:5" onClick={() => open(base)} alt={b[0].caption} />
            </Reveal>
          )
        if (b.length === 2)
          return (
            <div key={bi} className="grid grid-cols-2 gap-3">
              {b.map((p, j) => (
                <Reveal key={p.id} delay={j * 0.08}>
                  <Img image={p.image} aspect="3:4" onClick={() => open(base + j)} alt={p.caption} />
                </Reveal>
              ))}
            </div>
          )
        return (
          <div key={bi} className="space-y-3">
            <Reveal variant="zoom">
              <Img image={b[0].image} aspect={flip ? '4:3' : '4:5'} onClick={() => open(base)} alt={b[0].caption} />
            </Reveal>
            <div className={`grid gap-3 ${flip ? 'grid-cols-[1fr_1.4fr]' : 'grid-cols-[1.4fr_1fr]'}`}>
              <Reveal delay={0.05}>
                <Img image={b[1].image} aspect={flip ? '3:4' : '4:5'} onClick={() => open(base + 1)} alt={b[1].caption} />
              </Reveal>
              <Reveal delay={0.12} className="flex flex-col justify-end">
                <Img image={b[2].image} aspect={flip ? '4:5' : '3:4'} onClick={() => open(base + 2)} alt={b[2].caption} />
              </Reveal>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Slider({ photos, open }: { photos: GalleryPhoto[]; open: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const w = el.clientWidth * 0.82
    setIdx(Math.round(el.scrollLeft / (w + 12)))
  }
  return (
    <div className="-mx-6">
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2"
        style={{ scrollPaddingLeft: 24, overscrollBehaviorX: 'contain' }}
      >
        {photos.map((p, i) => (
          <div key={p.id} className="w-[82%] shrink-0 snap-start">
            <Img image={p.image} aspect="3:4" onClick={() => open(i)} alt={p.caption} />
            {p.caption && (
              <p className="mt-2 text-left text-[0.78rem]" style={{ color: 'var(--c-muted)' }}>
                {p.caption}
              </p>
            )}
          </div>
        ))}
        <div className="w-3 shrink-0" />
      </div>
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {photos.map((p, i) => (
          <span
            key={p.id}
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: i === idx ? 16 : 4, background: 'var(--c-text)', opacity: i === idx ? 0.6 : 0.18 }}
          />
        ))}
      </div>
    </div>
  )
}

/** 큰 사진 한 장 + 아래 작은 사진 줄. 큰 사진·작은 사진 모두 옆으로 스와이프 */
function Carousel({ photos, aspect, open }: { photos: GalleryPhoto[]; aspect: Aspect; open: (i: number) => void }) {
  const main = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const raf = useRef(0)
  // 썸네일을 눌러 이동하는 동안에는 스크롤 중간값으로 번호가 흔들리지 않게 고정
  const lock = useRef<{ target: number; until: number } | null>(null)

  const onMainScroll = () => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = main.current
      if (!el) return
      const pos = el.scrollLeft / el.clientWidth
      const l = lock.current
      if (l) {
        if (Math.abs(pos - l.target) < 0.02 || performance.now() > l.until) lock.current = null
        else return
      }
      const i = Math.max(0, Math.min(photos.length - 1, Math.round(pos)))
      setIdx((cur) => (cur === i ? cur : i))
    })
  }

  // 지금 보이는 사진의 썸네일을 가운데로
  useEffect(() => {
    const st = strip.current
    const th = st?.children[idx] as HTMLElement | undefined
    if (!st || !th) return
    st.scrollTo({ left: th.offsetLeft - st.clientWidth / 2 + th.clientWidth / 2, behavior: 'smooth' })
  }, [idx])

  const goTo = (i: number) => {
    const el = main.current
    if (!el || i === idx) return
    // 바로 옆 사진은 부드럽게, 멀리 떨어진 사진은 중간 사진들을 거치지 않고 바로 이동
    const far = Math.abs(i - idx) > 1
    lock.current = { target: i, until: performance.now() + 900 }
    setIdx(i)
    el.scrollTo({ left: i * el.clientWidth, behavior: far ? 'auto' : 'smooth' })
  }

  const cur = photos[idx]
  return (
    <div className="text-left">
      <div className="relative">
        <div
          ref={main}
          onScroll={onMainScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
          style={{ overscrollBehaviorX: 'contain' }}
          aria-roledescription="사진 슬라이드"
        >
          {photos.map((p, i) => (
            <div key={p.id} className="w-full shrink-0 snap-center snap-always" aria-hidden={i !== idx}>
              <Img image={p.image} aspect={aspect} onClick={() => open(i)} alt={p.caption || `사진 ${i + 1}`} eager={i < 2} />
            </div>
          ))}
        </div>
        <span
          className="font-serif-en pointer-events-none absolute bottom-3 right-3 rounded-full px-2.5 py-0.5 text-[0.7rem] tracking-[0.12em]"
          style={{ background: 'rgba(28,25,22,.38)', color: '#fff' }}
        >
          {idx + 1} / {photos.length}
        </span>
        {photos.length > 1 && (
          <>
            <button type="button" aria-label="이전 사진" onClick={() => goTo(Math.max(0, idx - 1))} disabled={idx === 0} className="tap absolute left-1 top-1/2 flex h-10 w-8 -translate-y-1/2 items-center justify-center text-white/90 disabled:opacity-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
              ‹
            </button>
            <button type="button" aria-label="다음 사진" onClick={() => goTo(Math.min(photos.length - 1, idx + 1))} disabled={idx === photos.length - 1} className="tap absolute right-1 top-1/2 flex h-10 w-8 -translate-y-1/2 items-center justify-center text-white/90 disabled:opacity-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
              ›
            </button>
          </>
        )}
      </div>
      <p className="mt-2 min-h-[1.2em] text-center text-[0.78rem]" style={{ color: 'var(--c-muted)' }}>
        {cur?.caption}
      </p>
      {photos.length > 1 && (
        <div ref={strip} className="no-scrollbar -mx-6 mt-2 flex gap-1.5 overflow-x-auto px-6 py-[5px]" style={{ overscrollBehaviorX: 'contain' }}>
          {photos.map((p, i) => {
            const on = i === idx
            const src = imageSrc(p.image)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${i + 1}번째 사진 보기`}
                aria-current={on ? 'true' : undefined}
                className="relative h-[64px] w-[52px] shrink-0 overflow-hidden rounded-[6px]"
                style={{
                  background: 'var(--c-bg2)',
                  outline: on ? '1.5px solid var(--c-text)' : '1.5px solid transparent',
                  outlineOffset: 2,
                }}
              >
                {src && (
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      objectPosition: `${p.image.focusX ?? 50}% ${p.image.focusY ?? 50}%`,
                      // 선택 안 된 사진은 색을 살짝 뺀 톤
                      filter: on ? 'none' : 'saturate(.4) brightness(1.04)',
                      opacity: on ? 1 : 0.8,
                      transition: 'opacity .3s ease, filter .3s ease',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function GallerySection({ section, selected }: { section: SectionOf<'gallery'>; selected?: boolean }) {
  const s = section.settings
  const [open, setOpen] = useState<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  const photos = s.photos.filter((p) => imageSrc(p.image))
  const limit = s.layout === 'slide' || s.layout === 'carousel' || expanded ? photos.length : Math.max(1, s.initialCount || photos.length)
  const visible = photos.slice(0, limit)

  return (
    <SectionShell section={section} selected={selected}>
      <Reveal>
        <SectionTitle eyebrow={s.eyebrow} title={s.title} />
      </Reveal>
      {photos.length === 0 ? (
        <p className="text-[0.86rem]" style={{ color: 'var(--c-muted)' }}>
          곧 사진이 채워질 예정이에요.
        </p>
      ) : s.layout === 'carousel' ? (
        <Carousel photos={photos} aspect={s.carouselAspect || '4:5'} open={setOpen} />
      ) : s.layout === 'slide' ? (
        <Slider photos={photos} open={setOpen} />
      ) : s.layout === 'editorial' ? (
        <Editorial photos={visible} open={setOpen} />
      ) : (
        <div className={`grid gap-1.5 ${s.columns === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {visible.map((p, i) => (
            <Reveal key={p.id} delay={(i % 6) * 0.05} variant="fade">
              <Img image={p.image} aspect="1:1" onClick={() => setOpen(i)} alt={p.caption} />
            </Reveal>
          ))}
        </div>
      )}
      {s.layout !== 'slide' && s.layout !== 'carousel' && photos.length > limit && (
        <button type="button" className="tap btn-ghost mt-8 inline-flex items-center gap-2" onClick={() => setExpanded(true)}>
          사진 더보기 <span style={{ color: 'var(--c-muted)' }}>+{photos.length - limit}</span>
        </button>
      )}
      <Lightbox
        items={photos.map((p) => ({ src: imageSrc(p.image)!, caption: p.caption }))}
        index={open}
        onClose={() => setOpen(null)}
      />
    </SectionShell>
  )
}
