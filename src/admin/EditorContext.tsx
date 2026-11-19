import { createContext, useContext } from 'react'
import type { InvitationContent } from '../lib/types'

export interface EditorCtx {
  invitationId: string
  slug: string
  draft: InvitationContent
  update: (fn: (d: InvitationContent) => void) => void
  toast: (msg: string, kind?: 'ok' | 'error') => void
  /** 이미지 라이브러리에서 이미지 선택 (취소 시 null) */
  pickImages: (opts?: { multiple?: boolean }) => Promise<import('../lib/api').MediaAsset[] | null>
}

export const EditorContext = createContext<EditorCtx | null>(null)

export function useEditor() {
  const c = useContext(EditorContext)
  if (!c) throw new Error('useEditor outside provider')
  return c
}
