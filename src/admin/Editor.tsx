import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { publish, saveDraft, type AdminInvitation, type MediaAsset } from '../lib/api'
import type { InvitationContent, RuntimeFlags } from '../lib/types'
import { errorMessage } from '../lib/util'
import { inviteUrl, renderOgImage, shareImageRef } from '../lib/share'
import { requireClient } from '../lib/supabase'
import { EditorContext, type EditorCtx } from './EditorContext'
import { SectionList, THEME_ID } from './SectionList'
import { SectionInspector } from './Inspector'
import { ThemePanel } from './ThemePanel'
import { MediaLibrary } from './MediaLibrary'
import { SharePanel } from './SharePanel'
import { VersionsPanel } from './VersionsPanel'
import { SettingsPanel } from './SettingsPanel'
import { Btn } from './ui'
import { VersionManager } from './VersionManager'
import type { PreviewMessage } from '../invite/PreviewPage'

type View = 'edit' | 'share' | 'versions' | 'settings' | 'media'
type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const DEVICES = [
  { id: 'galaxy', label: 'Galaxy S', w: 360, h: 780 },
  { id: 'iphone-se', label: 'iPhone SE', w: 375, h: 667 },
  { id: 'iphone', label: 'iPhone 15', w: 393, h: 852 },
  { id: 'iphone-max', label: 'iPhone Pro Max', w: 430, h: 932 },
]

const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))

export function Editor({
  initial,
  email,
  onSignOut,
  onSwitchVersion,
}: {
  initial: AdminInvitation
  email: string
  onSignOut: () => void
  onSwitchVersion: (slug: string) => void
}) {
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [inv, setInv] = useState(initial)
  const [draft, setDraft] = useState<InvitationContent>(initial.draft)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [savedAt, setSavedAt] = useState<string>(initial.draft_updated_at)
  const [selectedId, setSelectedId] = useState<string | null>(initial.draft.sections.find((s) => s.type === 'hero')?.id ?? THEME_ID)
  const [view, setView] = useState<View>('edit')
  const [device, setDevice] = useState(DEVICES[2])
  const [mobileTab, setMobileTab] = useState<'pages' | 'preview' | 'inspector'>('preview')
  const [publishing, setPublishing] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ text: string; kind: 'ok' | 'error'; id: number } | null>(null)
  const [media, setMedia] = useState<{ multiple: boolean; resolve: (r: MediaAsset[] | null) => void } | null>(null)

  const past = useRef<InvitationContent[]>([])
  const future = useRef<InvitationContent[]>([])
  const latest = useRef(draft)
  latest.current = draft
  const saving = useRef<Promise<void> | null>(null)
  const pendingSave = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const iframe = useRef<HTMLIFrameElement>(null)
  const frameReady = useRef(false)

  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setToastMsg({ text, kind, id: Date.now() })
  }, [])
  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), toastMsg.kind === 'error' ? 4500 : 2200)
    return () => clearTimeout(t)
  }, [toastMsg])

  // ---------------------------------------------------------------- 저장
  const doSave = useCallback(async (): Promise<void> => {
    if (saving.current) {
      pendingSave.current = true
      return saving.current
    }
    setSaveState('saving')
    const run = (async () => {
      try {
        const snapshot = latest.current
        const at = await saveDraft(inv.id, snapshot)
        setSavedAt(at)
        setSaveState(latest.current === snapshot ? 'saved' : 'dirty')
      } catch (e) {
        setSaveState('error')
        toast(`저장 실패: ${errorMessage(e)}`, 'error')
        throw e
      } finally {
        saving.current = null
      }
    })()
    saving.current = run
    await run
    if (pendingSave.current) {
      pendingSave.current = false
      await doSave()
    }
  }, [inv.id, toast])

  const scheduleSave = useCallback(() => {
    setSaveState('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => void doSave().catch(() => {}), 1200) // 자동저장
  }, [doSave])

  const update = useCallback<EditorCtx['update']>(
    (fn) => {
      setDraft((prev) => {
        const next = clone(prev)
        fn(next)
        past.current.push(prev)
        if (past.current.length > 80) past.current.shift()
        future.current = []
        return next
      })
      scheduleSave()
    },
    [scheduleSave],
  )

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(latest.current)
    setDraft(prev)
    scheduleSave()
  }, [scheduleSave])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(latest.current)
    setDraft(next)
    scheduleSave()
  }, [scheduleSave])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (saveTimer.current) clearTimeout(saveTimer.current)
        void doSave().then(() => toast('임시저장했어요')).catch(() => {})
      } else if (e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSave, undo, redo, toast])

  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [saveState])

  // ---------------------------------------------------------------- 게시
  async function onPublish() {
    setPublishing(true)
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      // 링크 미리보기용 사진을 정한 위치대로 잘라 두기 (사진이나 위치가 바뀐 경우에만)
      try {
        const src = shareImageRef(latest.current)
        const key = src ? JSON.stringify([src.path, src.url, src.focusX, src.focusY, src.zoom]) : ''
        if (key && key !== latest.current.share.ogKey) {
          const blob = await renderOgImage(src!)
          if (blob) {
            const path = `${inv.data_id}/og-${inv.id.slice(0, 8)}-${Date.now()}.jpg`
            const up = await requireClient().storage.from('media').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
            if (!up.error) {
              const next = clone(latest.current)
              next.share.ogImagePath = path
              next.share.ogKey = key
              latest.current = next
              setDraft(next)
            }
          }
        }
      } catch {
        /* 미리보기 사진을 못 만들어도 게시는 계속 */
      }
      await doSave()
      const r = await publish(inv.id)
      setInv((p) => ({ ...p, published: clone(latest.current), is_published: true, published_at: r.published_at }))
      toast('게시했어요! 공유 링크에 바로 반영됐어요')
    } catch (e) {
      toast(`게시 실패: ${errorMessage(e)}`, 'error')
    } finally {
      setPublishing(false)
    }
  }

  const unpublished = useMemo(() => !inv.is_published || JSON.stringify(inv.published) !== JSON.stringify(draft), [inv.published, inv.is_published, draft])

  // ---------------------------------------------------------------- 미리보기 iframe
  const runtimeFlags: RuntimeFlags = useMemo(
    () => ({
      slug: inv.slug,
      invitationId: inv.data_id,
      guestbookEnabled: inv.guestbook_enabled,
      guestbookPublic: inv.guestbook_public,
      uploadsEnabled: inv.uploads_enabled,
      uploadsPublic: inv.uploads_public,
      uploadsRequireApproval: inv.uploads_require_approval,
      preview: true,
    }),
    [inv],
  )
  const postState = useCallback(() => {
    if (!frameReady.current) return
    const msg: PreviewMessage = {
      type: 'preview:state',
      content: latest.current,
      flags: runtimeFlags,
      selectedId: selectedId === THEME_ID ? null : selectedId,
    }
    iframe.current?.contentWindow?.postMessage(msg, window.location.origin)
  }, [runtimeFlags, selectedId])

  useEffect(() => {
    const raf = requestAnimationFrame(postState)
    return () => cancelAnimationFrame(raf)
  }, [draft, postState])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'preview:ready') {
        frameReady.current = true
        postState()
      } else if (e.data?.type === 'preview:select' && typeof e.data.id === 'string') {
        setSelectedId(e.data.id)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [postState])

  const selectFromList = (id: string) => {
    setSelectedId(id)
    if (id !== THEME_ID) {
      setTimeout(() => iframe.current?.contentWindow?.postMessage({ type: 'preview:scrollTo', id } satisfies PreviewMessage, window.location.origin), 60)
    }
    if (window.innerWidth < 1024) setMobileTab('inspector')
  }

  // 미리보기 크기 자동 맞춤
  const stage = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setScale(Math.min(1, (r.height - 70) / (device.h + 24), (r.width - 32) / (device.w + 24)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [device, view, mobileTab])

  // ---------------------------------------------------------------- 이미지 라이브러리
  const pickImages = useCallback<EditorCtx['pickImages']>(
    (opts) => new Promise((resolve) => setMedia({ multiple: !!opts?.multiple, resolve })),
    [],
  )

  const ctx: EditorCtx = { invitationId: inv.data_id, slug: inv.slug, draft, update, toast, pickImages }
  const selected = draft.sections.find((s) => s.id === selectedId)

  const NAV: { id: View; label: string }[] = [
    { id: 'edit', label: '편집' },
    { id: 'media', label: '이미지' },
    { id: 'share', label: '공유 · 배포' },
    { id: 'versions', label: '게시 기록' },
    { id: 'settings', label: '설정' },
  ]

  const saveLabel = {
    saved: `저장됨 ${new Date(savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`,
    dirty: '변경사항 저장 대기',
    saving: '저장 중…',
    error: '저장 실패 · 다시 시도',
  }[saveState]

  return (
    <EditorContext.Provider value={ctx}>
      <div className="flex h-[100dvh] flex-col bg-[#F5F3EF] font-sans text-stone-800">
        {/* 상단 바 */}
        <header className="flex shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3 py-2 sm:px-4">
          <div className="mr-1 flex items-center gap-2">
            <span className="text-[15px] font-bold leading-none text-[#151C5C]">i</span>
            <button
              type="button"
              onClick={() => setVersionsOpen(true)}
              className="flex max-w-[180px] items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-[12.5px] font-semibold text-stone-800 hover:bg-stone-50"
              title="초대장 버전 바꾸기 · 새 버전 만들기"
            >
              <span className="truncate">{inv.name || '기본 버전'}</span>
              <span className="text-stone-400">▾</span>
            </button>
          </div>
          <nav className="no-scrollbar flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setView(n.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] transition ${view === n.id ? 'bg-[#F4F0E8] font-semibold text-stone-900' : 'text-stone-500 hover:bg-stone-50'}`}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => saveState === 'error' && void doSave().catch(() => {})}
              className={`hidden text-[11.5px] sm:block ${saveState === 'error' ? 'text-red-600 underline' : 'text-stone-400'}`}
            >
              {saveLabel}
            </button>
            <Btn variant="ghost" onClick={undo} disabled={!past.current.length} title="실행 취소 (Ctrl/⌘+Z)" className="hidden md:inline-flex">
              ↶
            </Btn>
            <Btn variant="ghost" onClick={redo} disabled={!future.current.length} title="다시 실행 (Ctrl/⌘+Shift+Z)" className="hidden md:inline-flex">
              ↷
            </Btn>
            <Btn
              onClick={() => {
                if (saveTimer.current) clearTimeout(saveTimer.current)
                void doSave().then(() => toast('임시저장했어요')).catch(() => {})
              }}
              disabled={saveState === 'saving'}
              title="임시저장 (Ctrl/⌘+S)"
            >
              임시저장
            </Btn>
            <a href={inviteUrl(inv.slug)} target="_blank" rel="noreferrer" className="hidden rounded-lg px-2.5 py-1.5 text-[12.5px] text-stone-600 hover:bg-stone-100 lg:inline-block">
              초대장 화면 ↗
            </a>
            <Btn variant="primary" onClick={onPublish} disabled={publishing}>
              {publishing ? '게시 중…' : unpublished ? '게시하기' : '게시됨 ✓'}
            </Btn>
            <div className="group relative">
              <button type="button" className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-[12px] font-semibold uppercase text-stone-600">
                {email.slice(0, 1)}
              </button>
              <div className="invisible absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-stone-200 bg-white p-1.5 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <p className="truncate px-2.5 py-1.5 text-[11.5px] text-stone-400">{email}</p>
                <button type="button" className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12.5px] hover:bg-stone-50" onClick={onSignOut}>
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </header>

        {unpublished && inv.is_published && view === 'edit' && (
          <div className="shrink-0 bg-[#F4F0E8] px-4 py-1.5 text-center text-[11.5px] text-stone-600">
            게시되지 않은 변경사항이 있어요 · 초대장 화면은 마지막 게시본을 보여주고 있어요
          </div>
        )}
        {!inv.is_published && view === 'edit' && (
          <div className="shrink-0 bg-amber-50 px-4 py-1.5 text-center text-[11.5px] text-amber-800">
            아직 게시 전이에요 · ‘게시하기’를 누르면 공유 링크({inviteUrl(inv.slug)})가 열립니다
          </div>
        )}

        {/* 본문 */}
        {view === 'edit' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_1fr_360px]">
              <aside className={`min-h-0 border-r border-stone-200 bg-white ${mobileTab === 'pages' ? 'block' : 'hidden'} lg:block`}>
                <SectionList selectedId={selectedId} onSelect={selectFromList} />
              </aside>

              <div ref={stage} className={`relative min-h-0 flex-col items-center overflow-hidden ${mobileTab === 'preview' ? 'flex' : 'hidden'} lg:flex`}>
                <div className="flex w-full flex-wrap items-center justify-center gap-1.5 px-3 py-2.5">
                  <select
                    className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12px]"
                    value={device.id}
                    onChange={(e) => setDevice(DEVICES.find((d) => d.id === e.target.value)!)}
                    aria-label="미리보기 기기"
                  >
                    {DEVICES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label} · {d.w}×{d.h}
                      </option>
                    ))}
                  </select>
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      frameReady.current = false
                      iframe.current?.contentWindow?.location.reload()
                    }}
                  >
                    ↻ 새로고침
                  </Btn>
                </div>
                <div
                  className="relative shrink-0 rounded-[44px] bg-[#1f1c1a] p-3 shadow-[0_30px_80px_-30px_rgba(60,50,40,.45)]"
                  style={{ width: device.w + 24, height: device.h + 24, transform: `scale(${scale})`, transformOrigin: 'top center' }}
                >
                  <div className="pointer-events-none absolute left-1/2 top-[18px] z-10 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-[#1f1c1a]" />
                  <iframe
                    ref={iframe}
                    title="모바일 미리보기"
                    src="/admin/preview"
                    className="h-full w-full rounded-[34px] bg-[#FAF9F6]"
                    style={{ width: device.w, height: device.h }}
                    onLoad={() => setTimeout(postState, 50)}
                  />
                </div>
              </div>

              <aside className={`min-h-0 overflow-y-auto border-l border-stone-200 bg-white ${mobileTab === 'inspector' ? 'block' : 'hidden'} lg:block`}>
                {selectedId === THEME_ID || !selected ? <ThemePanel /> : <SectionInspector key={selected.id} section={selected} />}
              </aside>
            </div>
            {/* 작은 화면용 탭 */}
            <div className="grid shrink-0 grid-cols-3 border-t border-stone-200 bg-white lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {(
                [
                  ['pages', '페이지'],
                  ['preview', '미리보기'],
                  ['inspector', '편집'],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setMobileTab(k)} className={`py-3 text-[12.5px] ${mobileTab === k ? 'font-semibold text-stone-900' : 'text-stone-400'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <main className="min-h-0 flex-1 overflow-y-auto">
            {view === 'share' && <SharePanel published={inv.published} isPublished={inv.is_published} />}
            {view === 'versions' && (
              <VersionsPanel
                invitationId={inv.id}
                isPublished={inv.is_published}
                publishedAt={inv.published_at}
                toast={toast}
                onUnpublished={() => setInv((p) => ({ ...p, is_published: false }))}
                onRestored={(c, pub) => {
                  past.current.push(latest.current)
                  setDraft(c)
                  setSaveState('saved')
                  if (pub) setInv((p) => ({ ...p, published: c, is_published: true, published_at: new Date().toISOString() }))
                }}
              />
            )}
            {view === 'settings' && <SettingsPanel invitationId={inv.data_id} email={email} toast={toast} />}
            {view === 'media' && (
              <div className="mx-auto max-w-4xl p-6">
                <h1 className="text-[20px] font-semibold text-stone-800">이미지 라이브러리</h1>
                <p className="mt-1 text-[13px] text-stone-500">업로드한 사진은 서버 저장소에 보관되고, 어느 페이지에서든 다시 사용할 수 있어요.</p>
                <Btn className="mt-4" variant="primary" onClick={() => setMedia({ multiple: false, resolve: () => {} })}>
                  라이브러리 열기
                </Btn>
              </div>
            )}
          </main>
        )}

        <VersionManager
          open={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          dataId={inv.data_id}
          currentId={inv.id}
          currentName={inv.name || '기본 버전'}
          toast={toast}
          onSwitch={async (slug) => {
            // 바꾸기 전에 지금 버전 저장
            if (saveTimer.current) clearTimeout(saveTimer.current)
            try {
              await doSave()
            } catch {
              return
            }
            setVersionsOpen(false)
            onSwitchVersion(slug)
          }}
        />
        <MediaLibrary
          invitationId={inv.data_id}
          open={!!media}
          multiple={media?.multiple}
          toast={toast}
          onClose={() => {
            media?.resolve(null)
            setMedia(null)
          }}
          onPick={
            view === 'media'
              ? undefined
              : (assets) => {
                  media?.resolve(assets)
                  setMedia(null)
                }
          }
        />

        {toastMsg && (
          <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[200] flex justify-center lg:bottom-6">
            <div className={`rounded-full px-4 py-2 text-[12.5px] shadow-lg ${toastMsg.kind === 'error' ? 'bg-red-600 text-white' : 'bg-stone-800 text-white'}`}>{toastMsg.text}</div>
          </div>
        )}
      </div>
    </EditorContext.Provider>
  )
}
