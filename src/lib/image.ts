import type { Aspect, ImageRef } from './types'
import { SUPABASE_URL } from './supabase'

export function mediaUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function imageSrc(img: ImageRef | null | undefined): string | null {
  if (!img) return null
  if (img.path) return mediaUrl(img.path)
  return img.url || null
}

export function aspectRatio(aspect: Aspect, img?: ImageRef | null): number | undefined {
  if (aspect === 'original') {
    if (img?.width && img?.height) return img.width / img.height
    return 3 / 4
  }
  const [w, h] = aspect.split(':').map(Number)
  return w / h
}

export function imageStyle(img: ImageRef | null | undefined): React.CSSProperties {
  const fx = img?.focusX ?? 50
  const fy = img?.focusY ?? 50
  const z = img?.zoom ?? 1
  return {
    objectFit: 'cover',
    objectPosition: `${fx}% ${fy}%`,
    transform: z !== 1 ? `scale(${z})` : undefined,
    transformOrigin: `${fx}% ${fy}%`,
  }
}

export interface PreparedImage {
  blob: Blob
  width: number
  height: number
  type: string
  ext: string
}

/** 브라우저에서 이미지를 디코드해 긴 변 기준으로 축소(JPEG/WebP). 디코드 불가(HEIC 등)면 원본 그대로. */
export async function prepareImage(file: File, maxSide = 2400, quality = 0.86): Promise<PreparedImage> {
  const extOf = (t: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'image/gif': 'gif' })[t] || 'jpg'
  const original = async (): Promise<PreparedImage> => {
    const dims = await readDims(file).catch(() => ({ width: 0, height: 0 }))
    return { blob: file, ...dims, type: file.type || 'image/jpeg', ext: extOf(file.type) }
  }
  if (file.type === 'image/gif') return original()
  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = 'createImageBitmap' in window ? await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions) : await loadImg(file)
  } catch {
    try {
      bitmap = await loadImg(file)
    } catch {
      return original()
    }
  }
  const w = bitmap.width
  const h = bitmap.height
  const scale = Math.min(1, maxSide / Math.max(w, h))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024 && /jpeg|webp/.test(file.type)) {
    return { blob: file, width: w, height: h, type: file.type, ext: extOf(file.type) }
  }
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return original()
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, cw, ch)
  if ('close' in bitmap) bitmap.close()
  const keepPng = file.type === 'image/png' && file.size < 2 * 1024 * 1024
  const type = keepPng ? 'image/png' : 'image/jpeg'
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, quality))
  if (!blob) return original()
  return { blob, width: cw, height: ch, type, ext: extOf(type) }
}

function loadImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

async function readDims(file: Blob) {
  const img = await loadImg(file)
  return { width: img.naturalWidth, height: img.naturalHeight }
}

export const ACCEPTED_GUEST_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export function isAcceptedImage(file: File) {
  if (ACCEPTED_GUEST_TYPES.includes(file.type)) return true
  // 일부 안드로이드/iOS 는 type 을 비워서 전달 — 확장자로 판별
  return !file.type && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
}
