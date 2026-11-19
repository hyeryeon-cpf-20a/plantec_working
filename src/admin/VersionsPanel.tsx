import { useCallback, useEffect, useState } from 'react'
import { listVersions, restoreVersion, unpublish, type VersionRow } from '../lib/api'
import type { InvitationContent } from '../lib/types'
import { errorMessage } from '../lib/util'
import { Btn } from './ui'

export function VersionsPanel({
  invitationId,
  isPublished,
  publishedAt,
  onRestored,
  onUnpublished,
  toast,
}: {
  invitationId: string
  isPublished: boolean
  publishedAt: string | null
  onRestored: (content: InvitationContent, published: boolean) => void
  onUnpublished: () => void
  toast: (m: string, k?: 'ok' | 'error') => void
}) {
  const [rows, setRows] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listVersions(invitationId))
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [invitationId, toast])
  useEffect(() => {
    void load()
  }, [load, publishedAt])

  async function restore(v: VersionRow, publishNow: boolean) {
    const msg = publishNow
      ? '이 버전으로 초대장 화면을 즉시 되돌릴까요? (편집 중인 초안도 이 버전으로 바뀝니다)'
      : '이 버전을 편집 초안으로 불러올까요? 현재 초안은 덮어써집니다. (초대장 화면은 게시 전까지 그대로)'
    if (!confirm(msg)) return
    setBusy(true)
    try {
      const c = await restoreVersion(v.id, publishNow)
      onRestored(c, publishNow)
      toast(publishNow ? '이전 버전으로 되돌려 게시했어요' : '초안으로 불러왔어요')
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-[20px] font-semibold text-stone-800">버전 기록</h1>
      <p className="mt-1 text-[13px] text-stone-500">게시할 때마다 버전이 저장돼요 (최근 50개). 언제든 이전 버전으로 되돌릴 수 있어요.</p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5">
        <div>
          <p className="text-[13px] font-medium text-stone-800">
            현재 상태: {isPublished ? <span className="text-emerald-700">게시 중</span> : <span className="text-stone-500">게시 중지됨</span>}
          </p>
          {publishedAt && <p className="text-[12px] text-stone-400">마지막 게시 {new Date(publishedAt).toLocaleString('ko-KR')}</p>}
        </div>
        {isPublished && (
          <Btn
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!confirm('게시를 중지할까요? 링크로 접속하면 ‘준비 중’ 화면이 보여요. (다시 게시하면 복구)')) return
              try {
                await unpublish(invitationId)
                onUnpublished()
                toast('게시를 중지했어요')
              } catch (e) {
                toast(errorMessage(e), 'error')
              }
            }}
          >
            게시 중지
          </Btn>
        )}
      </div>

      <div className="mt-5 space-y-2">
        {loading && <p className="py-8 text-center text-[13px] text-stone-400">불러오는 중…</p>}
        {!loading && rows.length === 0 && <p className="rounded-xl border border-dashed border-stone-200 py-12 text-center text-[13px] text-stone-400">아직 게시한 버전이 없어요.</p>}
        {rows.map((v, i) => (
          <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-stone-800">
                {new Date(v.created_at).toLocaleString('ko-KR')}
                {i === 0 && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] text-emerald-700">최신 게시본</span>}
              </p>
              <p className="text-[12px] text-stone-400">
                {v.note || '메모 없음'} · 페이지 {(v.content as InvitationContent)?.sections?.length ?? 0}개
              </p>
            </div>
            <Btn disabled={busy} onClick={() => restore(v, false)}>
              초안으로 불러오기
            </Btn>
            {i > 0 && (
              <Btn disabled={busy} variant="primary" onClick={() => restore(v, true)}>
                이 버전으로 되돌리기
              </Btn>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
