import { useCallback, useEffect, useState } from 'react'
import { createVersion, deleteVersion, listInvitationGroup, renameVersion, saveDraft, type VersionInfo } from '../lib/api'
import { defaultContent } from '../lib/defaults'
import { inviteUrl } from '../lib/share'
import { copyText, errorMessage } from '../lib/util'
import { Btn, Modal } from './ui'

/**
 * 여러 버전의 초대장 관리.
 * 버전마다 주소·내용·게시가 따로이고, 이미지·관리자는 함께 씁니다.
 */
export function VersionManager({
  open,
  onClose,
  dataId,
  currentId,
  currentName,
  onSwitch,
  toast,
}: {
  open: boolean
  onClose: () => void
  dataId: string
  currentId: string
  currentName: string
  onSwitch: (slug: string) => void
  toast: (m: string, k?: 'ok' | 'error') => void
}) {
  const [rows, setRows] = useState<VersionInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [needsSql, setNeedsSql] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [template, setTemplate] = useState<'copy' | 'event'>('copy')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listInvitationGroup(dataId))
      setNeedsSql(false)
    } catch (e) {
      // 두 번째 SQL(버전 기능)을 아직 실행하지 않은 경우
      if (/parent_id|column/i.test(String((e as Error).message))) setNeedsSql(true)
      else toast(errorMessage(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [dataId, toast])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  async function create() {
    setBusy(true)
    try {
      const r = await createVersion(currentId, name.trim(), slug.trim().toLowerCase())
      // 기본 템플릿: 새 버전의 초안을 처음 기본 내용으로 바꿔서 시작
      if (template === 'event') await saveDraft(r.id, defaultContent())
      toast(`'${name || r.slug}' 버전을 만들었어요`)
      setName('')
      setSlug('')
      onSwitch(r.slug)
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="초대장 버전" wide>
      <div className="space-y-5 p-5">
        <p className="text-[12.5px] leading-relaxed text-stone-500">
          받는 사람에 따라 내용을 다르게 만든 초대장을 여러 개 둘 수 있어요. 버전마다 <b>주소·내용·게시</b>가 따로이고,{' '}
          <b>이미지 라이브러리·관리자</b>는 모든 버전이 함께 써요.
        </p>

        {needsSql && (
          <div className="rounded-xl bg-amber-50 p-4 text-[12.5px] leading-relaxed text-amber-900">
            버전 기능을 쓰려면 Supabase <b>SQL Editor</b>에서 <code className="rounded bg-white px-1">supabase/migrations/20261118000000_versions.sql</code> 파일 내용을 한 번 실행해 주세요.
          </div>
        )}

        {loading && !rows.length && <p className="text-[13px] text-stone-400">불러오는 중…</p>}
        <div className="space-y-2">
          {rows.map((v) => {
            const url = inviteUrl(v.slug)
            const current = v.id === currentId
            return (
              <div key={v.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${current ? 'border-[#B8A489]/70 bg-[#F4F0E8]' : 'border-stone-200 bg-white'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      className="min-w-0 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[14px] font-semibold text-stone-800 hover:border-stone-200 focus:border-stone-300 focus:bg-white"
                      defaultValue={v.name}
                      onBlur={async (e) => {
                        const nv = e.target.value.trim()
                        if (!nv || nv === v.name) return
                        try {
                          await renameVersion(v.id, nv)
                          toast('이름을 바꿨어요')
                          void load()
                        } catch (err) {
                          toast(errorMessage(err), 'error')
                        }
                      }}
                      aria-label="버전 이름"
                    />
                    {!v.parent_id && <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10.5px] text-stone-500">기본</span>}
                    <span className={`rounded px-1.5 py-0.5 text-[10.5px] ${v.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {v.is_published ? '게시 중' : '게시 전'}
                    </span>
                    {current && <span className="text-[10.5px] text-[#8a7a66]">편집 중</span>}
                  </div>
                  <p className="mt-0.5 truncate px-1 font-mono text-[11.5px] text-stone-400">{url}</p>
                </div>
                <Btn variant="ghost" onClick={async () => toast((await copyText(url)) ? '링크를 복사했어요' : '복사 실패')}>
                  링크 복사
                </Btn>
                {!current && (
                  <Btn
                    onClick={() => {
                      onSwitch(v.slug)
                    }}
                  >
                    편집하기
                  </Btn>
                )}
                {v.parent_id && (
                  <Btn
                    variant="ghost"
                    className="!text-red-500"
                    onClick={async () => {
                      if (!confirm(`'${v.name}' 버전을 삭제할까요?\n이 주소로 들어오는 분은 더 이상 볼 수 없어요.`)) return
                      try {
                        await deleteVersion(v.id)
                        toast('삭제했어요')
                        if (current) onSwitch(rows.find((x) => !x.parent_id)!.slug)
                        else void load()
                      } catch (e) {
                        toast(errorMessage(e), 'error')
                      }
                    }}
                  >
                    삭제
                  </Btn>
                )}
              </div>
            )
          })}
        </div>

        {!needsSql && (
          <div className="rounded-xl border border-dashed border-stone-300 p-4">
            <p className="text-[13px] font-semibold text-stone-800">새 버전 만들기</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['copy', '지금 내용 복사', `편집 중인 ‘${currentName}’을 그대로 복사해서 시작해요.`],
                  ['event', '기본 템플릿으로 새로', '첫 화면 → 초대 글 → 행사 상세안내(4칸) · 오시는 길 기본 내용으로 새로 시작해요.'],
                ] as const
              ).map(([v, title, desc]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTemplate(v)}
                  className={`rounded-lg border p-3 text-left ${template === v ? 'border-[#B8A489] bg-[#F4F0E8]' : 'border-stone-200 bg-white hover:bg-stone-50'}`}
                >
                  <span className="block text-[12.5px] font-semibold text-stone-800">{title}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-stone-500">{desc}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className="rounded-lg border border-stone-200 px-3 py-2 text-[13px]"
                placeholder="이름 (예: VIP용)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex items-center rounded-lg border border-stone-200 px-3 text-[13px]">
                <span className="shrink-0 text-stone-400">/invite/</span>
                <input
                  className="min-w-0 flex-1 py-2 outline-none"
                  placeholder="friends"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                />
              </div>
              <Btn variant="primary" disabled={busy || slug.length < 3} onClick={create}>
                {busy ? '만드는 중…' : '만들기'}
              </Btn>
            </div>
            <p className="mt-2 text-[11px] text-stone-400">주소는 영어 소문자·숫자·하이픈(-)만 쓸 수 있어요. 만든 뒤 내용을 고치고 ‘게시하기’를 누르면 그 주소가 열려요.</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
