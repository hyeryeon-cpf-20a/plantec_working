import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { heartQrDataUrl } from '../lib/qr'
import { inviteUrl, shareImageRef, shareKakao, smsHref } from '../lib/share'
import { copyText, errorMessage } from '../lib/util'
import { imageSrc } from '../lib/image'
import type { InvitationContent } from '../lib/types'
import { formatKoFull, parseWedding } from '../lib/date'
import { useEditor } from './EditorContext'
import { ImageField } from './MediaLibrary'
import { Btn, Group, TextArea, TextInput } from './ui'

export function SharePanel({ published, isPublished }: { published: InvitationContent | null; isPublished: boolean }) {
  const { draft, update, slug, toast } = useEditor()
  const url = inviteUrl(slug)
  const [qr, setQr] = useState<string>('')
  const [qrDark, setQrDark] = useState(draft.theme.colors.text)
  const [qrShape, setQrShape] = useState<'heart' | 'square'>('heart')

  useEffect(() => {
    const make =
      qrShape === 'heart'
        ? heartQrDataUrl(url, { dark: qrDark })
        : QRCode.toDataURL(url, { width: 1024, margin: 2, color: { dark: qrDark, light: '#FFFFFFFF' }, errorCorrectionLevel: 'M' })
    make.then(setQr).catch(() => setQr(''))
  }, [url, qrDark, qrShape])

  const shareImg = imageSrc(shareImageRef(draft))

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-[20px] font-semibold text-stone-800">공유 · 배포</h1>
      <p className="mt-1 text-[13px] text-stone-500">
        링크는 한 번 공유하면 계속 그대로예요. 관리자에서 수정 후 <b>게시</b>하면 같은 주소에 바로 반영됩니다.
      </p>
      {!isPublished && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">아직 게시되지 않았어요. 오른쪽 위 ‘게시하기’를 누르면 하객이 이 링크로 볼 수 있어요.</p>}

      <div className="mt-6 grid gap-5 md:grid-cols-[1fr_220px]">
        <div className="rounded-2xl border border-stone-200 bg-white">
          <Group title="초대 링크">
            <div className="flex gap-2">
              <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-[12.5px]" onFocus={(e) => e.target.select()} />
              <Btn variant="primary" onClick={async () => toast((await copyText(url)) ? '링크를 복사했어요' : '복사에 실패했어요')}>
                복사
              </Btn>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn
                onClick={async () => {
                  try {
                    const ok = await shareKakao(published ?? draft, url)
                    if (!ok) toast('카카오 JavaScript 키를 아래에 입력하고 게시해 주세요', 'error')
                  } catch (e) {
                    toast(errorMessage(e), 'error')
                  }
                }}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-[#FAE100]" /> 카카오톡으로 공유
              </Btn>
              <a className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-stone-700 hover:bg-stone-50" href={smsHref(draft.share.title, url)}>
                문자로 보내기
              </a>
              <a className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-stone-700 hover:bg-stone-50" href={url} target="_blank" rel="noreferrer">
                초대장 열기 ↗
              </a>
            </div>
          </Group>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">QR 코드</p>
          <div className="mx-auto mb-2 flex w-fit rounded-lg bg-stone-100 p-0.5 text-[11.5px]">
            {(['heart', 'square'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setQrShape(v)} className={`rounded-md px-2.5 py-1 ${qrShape === v ? 'bg-white shadow-sm' : 'text-stone-500'}`}>
                {v === 'heart' ? '하트' : '사각'}
              </button>
            ))}
          </div>
          {qr && <img src={qr} alt="초대장 QR 코드" className="mx-auto w-full max-w-[180px]" />}
          <div className="mt-2 flex items-center justify-center gap-1.5">
            {[draft.theme.colors.text, '#000000', draft.theme.colors.wax, draft.theme.colors.accent].map((c) => (
              <button key={c} type="button" onClick={() => setQrDark(c)} className={`h-5 w-5 rounded-full border ${qrDark === c ? 'ring-2 ring-stone-400 ring-offset-1' : ''}`} style={{ background: c }} aria-label={`QR 색상 ${c}`} />
            ))}
          </div>
          <a href={qr} download="wedding-invitation-qr.png" className="mt-3 inline-block rounded-lg bg-[#514A43] px-3 py-1.5 text-[12.5px] text-white">
            PNG 다운로드
          </a>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-stone-200 bg-white">
        <Group title="카카오톡 · 문자 미리보기 (대표 이미지와 제목)">
          <div className="grid gap-5 md:grid-cols-[1fr_240px]">
            <div className="space-y-3.5">
              <TextInput label="제목" value={draft.share.title} onChange={(v) => update((d) => void (d.share.title = v))} maxLength={60} />
              <TextArea label="설명" value={draft.share.description} rows={2} onChange={(v) => update((d) => void (d.share.description = v))} />
              <Btn
                variant="ghost"
                onClick={() =>
                  update((d) => {
                    const p = parseWedding(d.wedding)
                    const ev = d.sections.find((x) => x.type === 'event')
                    const hero = d.sections.find((x) => x.type === 'hero')
                    const venue = ev?.type === 'event' ? ev.settings.venueName : ''
                    if (hero?.type === 'hero' && hero.settings.subtitle) d.share.title = hero.settings.subtitle.replace(/\n/g, ' ')
                    d.share.description = `${formatKoFull(p)}${venue ? `\n${venue}` : ''}`
                  })
                }
              >
                행사 부제 · 날짜 · 장소로 자동 작성
              </Btn>
              <TextInput label="버튼 문구 (카카오톡)" value={draft.share.buttonText} onChange={(v) => update((d) => void (d.share.buttonText = v))} />
              <ImageField label="대표 이미지 (비워 두면 첫 화면 배경 그림)" value={draft.share.image} aspect="16:9" onChange={(v) => update((d) => void (d.share.image = v))} />
              <TextInput
                label="카카오 JavaScript 키"
                value={draft.share.kakaoJsKey}
                onChange={(v) => update((d) => void (d.share.kakaoJsKey = v.trim()))}
                hint={
                  <>
                    developers.kakao.com → 내 애플리케이션 → 앱 키의 ‘JavaScript 키’. 플랫폼 &gt; Web 에 이 사이트 도메인({window.location.origin})을 등록해야 해요.
                  </>
                }
              />
            </div>
            <div>
              <p className="mb-2 text-[11px] text-stone-400">미리보기</p>
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="aspect-[1.9] bg-stone-100">{shareImg && <img src={shareImg} alt="" className="h-full w-full object-cover" />}</div>
                <div className="p-3">
                  <p className="text-[13px] font-semibold text-stone-800">{draft.share.title}</p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11.5px] text-stone-500">{draft.share.description}</p>
                </div>
                <div className="border-t border-stone-100 py-2 text-center text-[12px] text-stone-600">{draft.share.buttonText}</div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-stone-400">변경 후 ‘게시하기’를 눌러야 링크 미리보기에 반영돼요. 카카오톡은 미리보기를 캐시하므로 반영에 시간이 걸릴 수 있어요.</p>
            </div>
          </div>
        </Group>
      </div>
    </div>
  )
}
