import { useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import type { Aspect, ImageRef } from '../../lib/types'
import { aspectRatio, imageSrc, imageStyle } from '../../lib/image'
import { useInvite } from '../context'

interface Props {
  image: ImageRef | null | undefined
  aspect?: Aspect
  className?: string
  style?: CSSProperties
  radius?: number | string
  zoomIn?: boolean // 진입 시 약한 줌
  eager?: boolean
  alt?: string
  onClick?: () => void
  fill?: boolean // 부모 크기를 채움 (aspect 무시)
  sizes?: string
}

export function Img({ image, aspect = 'original', className = '', style, radius = 0, zoomIn, eager, alt, onClick, fill }: Props) {
  const { motionOn, speed } = useInvite()
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const src = imageSrc(image)
  const ratio = fill ? undefined : aspectRatio(aspect, image)
  const wrapStyle: CSSProperties = {
    aspectRatio: ratio ? String(ratio) : undefined,
    borderRadius: radius,
    overflow: 'hidden',
    position: 'relative',
    background: 'color-mix(in srgb, var(--c-bg2) 85%, var(--c-accent))',
    ...style,
  }
  const inner = imageStyle(image)
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      className={`block w-full ${onClick ? 'tap cursor-zoom-in' : ''} ${className}`}
      style={wrapStyle}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      aria-label={onClick ? (alt || '사진 크게 보기') : undefined}
    >
      {src && !failed ? (
        <motion.img
          src={src}
          alt={alt ?? image?.alt ?? ''}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full select-none"
          style={{ ...inner, transform: undefined }}
          initial={false}
          animate={{
            opacity: loaded ? 1 : 0,
            scale: (image?.zoom ?? 1) * (zoomIn && motionOn && !loaded ? 1.06 : 1),
          }}
          transition={{ opacity: { duration: 0.8 / speed }, scale: { duration: zoomIn && motionOn ? 2.4 / speed : 0 } }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.35 }}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="M21 17l-5-5-8 8" />
          </svg>
        </div>
      )}
    </Wrapper>
  )
}
