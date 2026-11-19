import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPublicInvitation } from '../lib/api'
import { isBackendConfigured } from '../lib/supabase'
import { DEFAULT_SLUG, defaultContent } from '../lib/defaults'
import type { PublicInvitation, RuntimeFlags } from '../lib/types'
import { errorMessage } from '../lib/util'
import { InvitationView } from './InvitationView'

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center px-8 text-center" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      {children}
    </div>
  )
}

/** 필기체가 다 받아진 뒤에만 ‘with love’를 보여 줌 (반듯한 글씨가 먼저 보였다 바뀌지 않게) */
/** ‘with love’가 실제로 보이기 시작한 시각 — 최소 노출 시간 계산용 */
let shownAt: Promise<number> | null = null
let markShown: (t: number) => void = () => {}
function resetShown() {
  shownAt = new Promise<number>((r) => (markShown = r))
}
resetShown()

const MIN_VISIBLE_MS = 1600 // ‘with love’를 최소 이만큼 보여 줌 (나타나는 0.6초 포함)

function LoadingScript() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let done = false
    const show = () => {
      if (done) return
      done = true
      setReady(true)
      markShown(performance.now())
    }
    try {
      show()
    } catch {
      show()
    }
    const t = setTimeout(show, 2500) // 글꼴이 너무 늦으면 그냥 표시
    return () => clearTimeout(t)
  }, [])
  return (
    <p
      className="text-[0.9rem] tracking-[0.3em]"
      style={{ opacity: ready ? 0.7 : 0, transition: 'opacity .6s ease', animation: ready ? 'soft-pulse 2.4s ease-in-out .6s infinite' : undefined }}
    >
      INVITATION
    </p>
  )
}

export default function InvitePage() {
  const { slug = DEFAULT_SLUG } = useParams()
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ok'; inv: PublicInvitation } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'demo' }
  >(isBackendConfigured ? { kind: 'loading' } : { kind: 'demo' })

  useEffect(() => {
    if (!isBackendConfigured) return
    let cancelled = false
    resetShown()
    // 데이터가 빨리 와도 ‘with love’를 충분히 보여 준 뒤 넘어감 (글꼴이 안 와도 최대 3초 안에는 넘어감)
    const waitShown = async () => {
      const t = await Promise.race([shownAt!, new Promise<number>((r) => setTimeout(() => r(-1), 3000))])
      if (t < 0) return
      const left = MIN_VISIBLE_MS - (performance.now() - t)
      if (left > 0) await new Promise((r) => setTimeout(r, left))
    }
    fetchPublicInvitation(slug)
      .then(async (inv) => {
        await waitShown()
        if (!cancelled) setState(inv ? { kind: 'ok', inv } : { kind: 'missing' })
      })
      .catch((e) => !cancelled && setState({ kind: 'error', message: errorMessage(e) }))
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (state.kind !== 'ok') return
    const sh = state.inv.content.share
    if (sh.title) document.title = sh.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', sh.description.replace(/\n/g, ' '))
  }, [state])

  if (state.kind === 'loading')
    return (
      <Centered>
        <LoadingScript />
      </Centered>
    )
  if (state.kind === 'missing')
    return (
      <Centered>
        <p className="text-[1.6rem] tracking-[0.12em]">Coming soon</p>
        <p className="mt-4 text-[0.9rem]" style={{ color: 'var(--c-muted)' }}>
          초대장을 준비하고 있어요.
          <br />
          조금만 기다려 주세요.
        </p>
      </Centered>
    )
  if (state.kind === 'error')
    return (
      <Centered>
        <p className="text-[0.95rem]">초대장을 불러오지 못했어요.</p>
        <p className="mt-2 text-[0.8rem]" style={{ color: 'var(--c-muted)' }}>
          {state.message}
        </p>
        <button type="button" className="tap btn-ghost mt-6" onClick={() => location.reload()}>
          다시 시도
        </button>
      </Centered>
    )

  if (state.kind === 'demo') {
    const flags: RuntimeFlags = {
      slug,
      invitationId: null,
      guestbookEnabled: false,
      guestbookPublic: false,
      uploadsEnabled: false,
      uploadsPublic: false,
      uploadsRequireApproval: true,
      preview: false,
    }
    return (
      <>
        <div
          className="fixed inset-x-0 top-0 z-[70] px-4 py-2 text-center text-[0.72rem]"
          style={{ background: '#514A43', color: '#FAF9F6', paddingTop: 'calc(8px + var(--safe-top))' }}
          role="status"
        >
          서버(Supabase)가 연결되지 않은 데모 화면이에요
        </div>
        <InvitationView content={defaultContent()} flags={flags} />
      </>
    )
  }

  const inv = state.inv
  const flags: RuntimeFlags = {
    slug: inv.slug,
    invitationId: inv.id,
    guestbookEnabled: inv.guestbook_enabled,
    guestbookPublic: inv.guestbook_public,
    uploadsEnabled: inv.uploads_enabled,
    uploadsPublic: inv.uploads_public,
    uploadsRequireApproval: inv.uploads_require_approval,
    preview: false,
  }
  return <InvitationView content={inv.content} flags={flags} />
}
