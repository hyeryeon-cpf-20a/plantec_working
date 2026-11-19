import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { InvitationContent, RuntimeFlags } from '../lib/types'

export interface InviteCtx {
  content: InvitationContent
  flags: RuntimeFlags
  motionOn: boolean
  speed: number
  toast: (msg: string) => void
}

const Ctx = createContext<InviteCtx | null>(null)

export function useInvite() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useInvite outside provider')
  return c
}

export function InviteProvider({
  content,
  flags,
  reducedMotion,
  children,
}: {
  content: InvitationContent
  flags: RuntimeFlags
  reducedMotion: boolean
  children: ReactNode
}) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const toast = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMsg({ id: Date.now(), text })
    timer.current = setTimeout(() => setMsg(null), 1900)
  }, [])
  const motionOn = content.animation.enabled && !reducedMotion
  const value = useMemo(
    () => ({ content, flags, motionOn, speed: Math.max(0.25, content.animation.speed || 1), toast }),
    [content, flags, motionOn, toast],
  )
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center"
        style={{ bottom: 'calc(28px + var(--safe-bottom))' }}
      >
        <AnimatePresence>
          {msg && (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.25 }}
              className="rounded-full px-4 py-2 text-[13px]"
              style={{
                background: 'color-mix(in srgb, var(--c-text) 88%, transparent)',
                color: 'var(--c-bg)',
                backdropFilter: 'blur(6px)',
              }}
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
