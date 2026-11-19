export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** base 의 구조를 기준으로 value 의 값을 덮어씁니다. 배열은 value 를 그대로 사용합니다. */
export function mergeDefaults<T>(base: T, value: unknown): T {
  if (value === undefined) return base
  if (isPlainObject(base) && isPlainObject(value)) {
    const out: Record<string, unknown> = { ...base }
    for (const k of Object.keys(value)) {
      const bv = (base as Record<string, unknown>)[k]
      out[k] = bv !== undefined && bv !== null ? mergeDefaults(bv, value[k]) : value[k]
    }
    return out as T
  }
  if (Array.isArray(base)) return (Array.isArray(value) ? value : base) as T
  if (base !== null && value !== null && typeof base !== typeof value) return base
  return value as T
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function safeStorage() {
  return {
    get(key: string): string | null {
      try {
        return window.sessionStorage.getItem(key)
      } catch {
        return null
      }
    },
    set(key: string, value: string) {
      try {
        window.sessionStorage.setItem(key, value)
      } catch {
        /* ignore */
      }
    },
  }
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  const d = (...a: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
  d.cancel = () => t && clearTimeout(t)
  return d
}

export function nl2br(s: string) {
  return s.split('\n')
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice()
  const [it] = copy.splice(from, 1)
  copy.splice(to, 0, it)
  return copy
}

export function errorMessage(e: unknown): string {
  const raw =
    (e as { message?: string })?.message ||
    (typeof e === 'string' ? e : '') ||
    '알 수 없는 오류가 발생했어요.'
  const map: Record<string, string> = {
    RATE_LIMITED: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
    SPAM_DETECTED: '전송이 차단되었어요. 잠시 후 다시 시도해 주세요.',
    DUPLICATE: '같은 내용이 이미 등록되어 있어요.',
    GUESTBOOK_DISABLED: '지금은 축하글 작성이 닫혀 있어요.',
    UPLOADS_DISABLED: '지금은 사진 업로드가 닫혀 있어요.',
    INVALID_AUTHOR: '이름은 1~20자로 입력해 주세요.',
    INVALID_MESSAGE: '메시지는 1~500자로 입력해 주세요.',
    INVALID_PASSWORD: '비밀번호는 4~32자로 입력해 주세요.',
    WRONG_PASSWORD: '비밀번호가 일치하지 않아요.',
    CONSENT_REQUIRED: '개인정보 수집·이용에 동의해 주세요.',
    NOT_FOUND: '초대장을 찾을 수 없어요.',
    NOT_ADMIN: '이 계정에는 관리자 권한이 없어요.',
    INVALID_SLUG: '주소는 영어 소문자·숫자·하이픈(-)으로 3~50자로 정해 주세요.',
    SLUG_TAKEN: '이미 사용 중인 주소예요. 다른 주소를 정해 주세요.',
    TOO_MANY_VERSIONS: '버전은 최대 20개까지 만들 수 있어요.',
    CANNOT_DELETE_ROOT: '기본 버전은 삭제할 수 없어요.',
    USER_NOT_FOUND: '해당 이메일로 가입된 계정이 없어요. 먼저 가입(로그인)해야 해요.',
    'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않아요.',
    'The resource already exists': '같은 이름의 파일이 이미 있어요.',
    'Payload too large': '파일 용량이 너무 커요.',
  }
  for (const k of Object.keys(map)) if (raw.includes(k)) return map[k]
  if (/submit_rsvp|PGRST202/i.test(raw)) return '참석 회신 기능이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.'
  if (/mime type/i.test(raw)) return '지원하지 않는 이미지 형식이에요.'
  if (/exceeded the maximum allowed size|too large/i.test(raw)) return '파일 용량이 너무 커요.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(raw)) return '네트워크 연결을 확인해 주세요.'
  return raw
}
