import { motion, type HTMLMotionProps } from 'framer-motion'
import type { AnimationType } from '../../lib/types'
import { useInvite } from '../context'
import { createContext, useContext } from 'react'

export interface RevealConfig {
  enabled: boolean
  type: AnimationType
  duration: number
}

export const SectionAnim = createContext<RevealConfig>({ enabled: true, type: 'slide-up', duration: 0.9 })

type Props = HTMLMotionProps<'div'> & {
  delay?: number
  as?: 'div' | 'p' | 'h2' | 'h3' | 'span' | 'li'
  variant?: AnimationType // 섹션 기본값 대신 사용할 효과
}

/** 섹션 진입 시 부드럽게 나타나는 래퍼. 움직임 줄이기 설정·관리자 설정을 따릅니다. */
export function Reveal({ delay = 0, as = 'div', variant, children, ...rest }: Props) {
  const { motionOn, speed } = useInvite()
  const cfg = useContext(SectionAnim)
  const type = variant ?? cfg.type
  const C = motion[as] as typeof motion.div
  if (!motionOn || !cfg.enabled || type === 'none') {
    return <C {...rest}>{children}</C>
  }
  const initial =
    type === 'fade'
      ? { opacity: 0 }
      : type === 'zoom'
        ? { opacity: 0, scale: 1.04 }
        : { opacity: 0, y: 18 }
  return (
    <C
      initial={initial}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25, margin: '0px 0px -8% 0px' }}
      transition={{ duration: cfg.duration / speed, delay: delay / speed, ease: [0.22, 0.61, 0.36, 1] }}
      {...rest}
    >
      {children}
    </C>
  )
}
