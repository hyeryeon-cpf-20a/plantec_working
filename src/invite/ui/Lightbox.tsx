import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'

export interface LightboxItem {
  src: string
  caption?: string
  sub?: string
}

/** 전체 화면 사진 보기 — 좌우 스와이프, 키보드, 닫기 */
export function Lightbox({ items, index, onClose }: { items: LightboxItem[]; index: number | null; onClose: () => void }) {
  const [i, setI] = useState(index ?? 0)
  const [dir, setDir] = useState(0)
  useEffect(() => {
    if (index !== null) setI(index)
  }, [index])
  const go = useCallback(
    (d: number) => {
      setDir(d)
      setI((x) => (x + d + items.length) % items.length)
    },
    [items.length],
  )
  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = prev
    }
  }, [index, go, onClose])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.y) > 120 && Math.abs(info.offset.y) > Math.abs(info.offset.x)) return onClose()
    if (info.offset.x < -50 || info.velocity.x < -400) go(1)
    else if (info.offset.x > 50 || info.velocity.x > 400) go(-1)
  }

  const item = items[i]
  return createPortal(
    <AnimatePresence>
      {index !== null && item && (
        <motion.div
          className="fixed inset-0 z-[90] flex flex-col"
          style={{ background: 'rgba(28,25,22,.94)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label="사진 크게 보기"
        >
          <div className="flex items-center justify-between px-4 text-white/80" style={{ paddingTop: 'calc(10px + var(--safe-top))' }}>
            <span className="font-serif-en text-[0.8rem] tracking-[0.2em]">
              {i + 1} / {items.length}
            </span>
            <button type="button" onClick={onClose} className="tap -mr-2 flex h-11 w-11 items-center justify-center" aria-label="닫기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>
          </div>
          <div className="relative flex-1 overflow-hidden">
            <AnimatePresence initial={false} custom={dir}>
              <motion.img
                key={i}
                src={item.src}
                alt={item.caption || ''}
                custom={dir}
                className="absolute inset-0 m-auto max-h-full max-w-full touch-none select-none object-contain"
                draggable={false}
                drag
                dragSnapToOrigin
                dragElastic={0.6}
                onDragEnd={onDragEnd}
                initial={{ opacity: 0, x: dir * 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -60 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </AnimatePresence>
            {items.length > 1 && (
              <>
                <button type="button" aria-label="이전 사진" onClick={() => go(-1)} className="absolute left-0 top-1/2 hidden h-16 w-12 -translate-y-1/2 items-center justify-center text-white/60 sm:flex">
                  ‹
                </button>
                <button type="button" aria-label="다음 사진" onClick={() => go(1)} className="absolute right-0 top-1/2 hidden h-16 w-12 -translate-y-1/2 items-center justify-center text-white/60 sm:flex">
                  ›
                </button>
              </>
            )}
          </div>
          <div className="min-h-16 px-6 pt-3 text-center text-white/80" style={{ paddingBottom: 'calc(18px + var(--safe-bottom))' }}>
            {item.caption && <p className="text-[0.9rem]">{item.caption}</p>}
            {item.sub && <p className="mt-1 text-[0.76rem] text-white/50">{item.sub}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
