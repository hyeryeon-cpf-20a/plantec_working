import { useEffect, useState } from 'react'
import type { InvitationContent, RuntimeFlags } from '../lib/types'
import { InvitationView } from './InvitationView'
import { scrollToSection } from './SideNav'

/** 관리자 화면의 모바일 미리보기 iframe. 부모 창(같은 origin)에서 초안 콘텐츠를 postMessage 로 받습니다. */
export interface PreviewState {
  content: InvitationContent
  flags: RuntimeFlags
  selectedId: string | null
}

export type PreviewMessage =
  | ({ type: 'preview:state' } & PreviewState)
  | { type: 'preview:scrollTo'; id: string }

export default function PreviewPage() {
  const [st, setSt] = useState<PreviewState | null>(null)

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const m = e.data as PreviewMessage
      if (!m || typeof m !== 'object') return
      if (m.type === 'preview:state') {
        const { type: _t, ...rest } = m
        void _t
        setSt(rest)
      } else if (m.type === 'preview:scrollTo') {
        scrollToSection(m.id, true)
      }
    }
    window.addEventListener('message', onMsg)
    window.parent?.postMessage({ type: 'preview:ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  if (!st) return <div className="min-h-[100svh]" style={{ background: 'var(--c-bg)' }} />
  return (
    <InvitationView
      content={st.content}
      flags={st.flags}
      options={{
        selectedId: st.selectedId,
        onSelect: (id) => window.parent?.postMessage({ type: 'preview:select', id }, window.location.origin),
      }}
    />
  )
}
