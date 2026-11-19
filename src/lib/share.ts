import { DEFAULT_SLUG } from './defaults'
import type { InvitationContent } from './types'
import { imageSrc } from './image'

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean
      init: (key: string) => void
      Share: { sendDefault: (o: Record<string, unknown>) => void }
    }
  }
}

const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

/** 하객에게 보낼 주소 — 기본 초대장은 도메인만으로 열림 (예: https://event.vercel.app) */
export function inviteUrl(slug: string, origin = window.location.origin) {
  return slug === DEFAULT_SLUG ? `${origin}/` : `${origin}/invite/${slug}`
}

function loadKakao(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Kakao) return resolve()
    const el = document.createElement('script')
    el.src = KAKAO_SDK
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('카카오 SDK를 불러오지 못했어요'))
    document.head.appendChild(el)
  })
}

/** 카카오톡 공유 (JavaScript 키 + 도메인 등록 필요). 키가 없으면 false 를 반환합니다. */
export async function shareKakao(content: InvitationContent, url: string): Promise<boolean> {
  const key = content.share.kakaoJsKey?.trim()
  if (!key) return false
  await loadKakao()
  if (!window.Kakao) return false
  if (!window.Kakao.isInitialized()) window.Kakao.init(key)
  const img = content.share.ogImagePath ? imageSrc({ path: content.share.ogImagePath }) : imageSrc(shareImageRef(content))
  const abs = img ? new URL(img, window.location.origin).toString() : undefined
  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: content.share.title,
      description: content.share.description.replace(/\n/g, ' '),
      imageUrl: abs,
      link: { mobileWebUrl: url, webUrl: url },
    },
    buttons: [{ title: content.share.buttonText || '초대장 보기', link: { mobileWebUrl: url, webUrl: url } }],
  })
  return true
}

/** 기기 공유 시트(문자·카카오톡 등) → 실패 시 null */
export async function shareNative(title: string, text: string, url: string): Promise<boolean> {
  if (!navigator.share) return false
  try {
    await navigator.share({ title, text, url })
    return true
  } catch {
    return false
  }
}

export function smsHref(text: string, url: string) {
  return `sms:?&body=${encodeURIComponent(`${text}\n${url}`)}`
}

export function shareImageRef(content: InvitationContent) {
  if (content.share.image) return content.share.image
  const hero = content.sections.find((s) => s.type === 'hero')
  return hero?.type === 'hero' ? hero.settings.bgImage : null
}

/**
 * 링크 미리보기용 가로 사진(1200×630)을 관리자가 정한 위치·확대 그대로 잘라 만듭니다.
 * 카카오톡이 원본을 제멋대로 자르지 않도록, 이미 잘린 사진을 넘겨 줍니다.
 */
export async function renderOgImage(img: import('./types').ImageRef): Promise<Blob | null> {
  const src = imageSrc(img)
  if (!src) return null
  const el = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = src
  })
  const W = 1200
  const H = 630
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const fx = (img.focusX ?? 50) / 100
  const fy = (img.focusY ?? 50) / 100
  const z = img.zoom ?? 1
  // 화면에서와 똑같이: 꽉 채우기(cover) + 초점 위치 + 초점 기준 확대
  const s0 = Math.max(W / el.naturalWidth, H / el.naturalHeight)
  let dw = el.naturalWidth * s0
  let dh = el.naturalHeight * s0
  let dx = -(dw - W) * fx
  let dy = -(dh - H) * fy
  const px = W * fx
  const py = H * fy
  dx = px - (px - dx) * z
  dy = py - (py - dy) * z
  dw *= z
  dh *= z
  ctx.drawImage(el, dx, dy, dw, dh)
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88))
}
