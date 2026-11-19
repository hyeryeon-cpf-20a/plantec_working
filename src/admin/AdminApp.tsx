import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { claimInvitation, loadAdminInvitation, type AdminInvitation } from '../lib/api'
import { isBackendConfigured, supabase } from '../lib/supabase'
import { DEFAULT_SLUG } from '../lib/defaults'
import { errorMessage } from '../lib/util'
import { Editor } from './Editor'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F3EF] p-5 font-sans text-stone-800">
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-[0_30px_80px_-40px_rgba(60,50,40,.4)]">
        <p className="text-center text-[15px] font-semibold tracking-[0.3em] text-[#151C5C]">INVITATION</p>
        <p className="mb-7 mt-2 text-center text-[11px] uppercase tracking-[0.3em] text-[#B8A489]">admin</p>
        {children}
      </div>
    </div>
  )
}

function NotConfigured() {
  return (
    <Shell>
      <h1 className="text-[16px] font-semibold">서버 연결이 필요해요</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-stone-500">
        관리자 편집과 이미지 저장은 Supabase(데이터베이스·인증·이미지 저장소)에 연결되어야 동작해요. 지금은 연결 정보가 없어 저장 기능을 사용할 수 없습니다.
      </p>
      <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-stone-600">
        <li>supabase.com 에서 새 프로젝트 생성</li>
        <li>
          SQL Editor 에서 <code className="rounded bg-stone-100 px-1">supabase/migrations/*.sql</code> 실행
        </li>
        <li>
          배포 환경변수에 <code className="rounded bg-stone-100 px-1">VITE_SUPABASE_URL</code>,{' '}
          <code className="rounded bg-stone-100 px-1">VITE_SUPABASE_PUBLISHABLE_KEY</code> 설정
        </li>
        <li>다시 배포 후 /admin 에서 가입 → 첫 계정이 관리자가 됩니다</li>
      </ol>
      <p className="mt-4 text-[12px] text-stone-400">자세한 내용은 README.md 를 참고하세요.</p>
    </Shell>
  )
}

function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        if (password.length < 8) throw new Error('비밀번호는 8자 이상으로 정해 주세요.')
        const { data, error } = await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/admin` } })
        if (error) throw error
        if (!data.session) setMsg({ text: '가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.' })
      }
    } catch (err) {
      setMsg({ text: errorMessage(err), error: true })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full rounded-xl border border-stone-200 px-4 py-3 text-[14px] outline-none focus:border-[#B8A489]" type="email" placeholder="이메일" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className="w-full rounded-xl border border-stone-200 px-4 py-3 text-[14px] outline-none focus:border-[#B8A489]"
          type="password"
          placeholder={mode === 'signup' ? '비밀번호 (8자 이상)' : '비밀번호'}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#514A43] py-3 text-[14px] font-medium text-white disabled:opacity-50">
          {busy ? '잠시만요…' : mode === 'login' ? '로그인' : '관리자 계정 만들기'}
        </button>
        {msg && <p className={`text-[12.5px] ${msg.error ? 'text-red-600' : 'text-stone-600'}`}>{msg.text}</p>}
      </form>
      <button type="button" className="mt-5 w-full text-center text-[12px] text-stone-400 underline-offset-4 hover:underline" onClick={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}>
        {mode === 'login' ? '처음이신가요? 관리자 계정 만들기' : '이미 계정이 있어요 · 로그인'}
      </button>
      {mode === 'signup' && (
        <p className="mt-3 text-[11.5px] leading-relaxed text-stone-400">
          초대장에 아직 관리자가 없다면 처음 가입한 계정이 관리자가 돼요. 이후 가입한 계정은 기존 관리자가 ‘설정’에서 추가해야 편집할 수 있어요.
        </p>
      )}
    </Shell>
  )
}

function initialSlug() {
  try {
    return new URLSearchParams(window.location.search).get('v') || DEFAULT_SLUG
  } catch {
    return DEFAULT_SLUG
  }
}

export default function AdminApp() {
  const [slug, setSlug] = useState(initialSlug)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ok'; inv: AdminInvitation } | { kind: 'denied'; message: string }>({ kind: 'loading' })

  useEffect(() => {
    document.title = '초대장 관리'
    document.documentElement.classList.remove('invite-doc')
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancel = false
    setState({ kind: 'loading' })
    ;(async () => {
      try {
        await claimInvitation(DEFAULT_SLUG)
        let inv: AdminInvitation
        try {
          inv = await loadAdminInvitation(slug)
        } catch (err) {
          if (slug === DEFAULT_SLUG) throw err
          inv = await loadAdminInvitation(DEFAULT_SLUG) // 지워진 버전 등
        }
        if (!cancel) setState({ kind: 'ok', inv })
      } catch (e) {
        if (!cancel) setState({ kind: 'denied', message: errorMessage(e) })
      }
    })()
    return () => {
      cancel = true
    }
  }, [userId, slug])

  if (!isBackendConfigured) return <NotConfigured />
  if (session === undefined) return <div className="min-h-[100dvh] bg-[#F5F3EF]" />
  if (!session) return <Login />
  if (state.kind === 'loading')
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#F5F3EF] text-[13px] text-stone-400">
        초대장을 불러오는 중…
      </div>
    )
  if (state.kind === 'denied')
    return (
      <Shell>
        <p className="text-[14px] font-semibold">접근할 수 없어요</p>
        <p className="mt-2 text-[13px] text-stone-500">{state.message}</p>
        <p className="mt-3 text-[12px] leading-relaxed text-stone-400">
          로그인한 계정: {session.user.email}
          <br />
          기존 관리자에게 ‘설정 → 관리자 추가’를 요청해 주세요.
        </p>
        <button type="button" className="mt-5 w-full rounded-xl border border-stone-200 py-2.5 text-[13px]" onClick={() => supabase!.auth.signOut()}>
          로그아웃
        </button>
      </Shell>
    )
  return (
    <Editor
      key={state.inv.id}
      initial={state.inv}
      email={session.user.email ?? ''}
      onSignOut={() => supabase!.auth.signOut()}
      onSwitchVersion={(next) => {
        const u = new URL(window.location.href)
        if (next === DEFAULT_SLUG) u.searchParams.delete('v')
        else u.searchParams.set('v', next)
        window.history.replaceState(null, '', u.toString())
        setSlug(next)
      }}
    />
  )
}
