import type { InvitationContent } from './types'

const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']
const DAYS_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export interface DateParts {
  y: number
  m: number // 1-12
  d: number
  hh: number
  mm: number
  weekday: number // 0 = Sunday
}

export function parseWedding(w: InvitationContent['wedding']): DateParts {
  const [y, m, d] = (w.date || '2027-05-15').split('-').map((n) => parseInt(n, 10))
  const [hh, mm] = (w.time || '12:00').split(':').map((n) => parseInt(n, 10))
  const safe = {
    y: Number.isFinite(y) ? y : 2027,
    m: Number.isFinite(m) ? m : 5,
    d: Number.isFinite(d) ? d : 15,
    hh: Number.isFinite(hh) ? hh : 12,
    mm: Number.isFinite(mm) ? mm : 0,
  }
  const weekday = new Date(Date.UTC(safe.y, safe.m - 1, safe.d)).getUTCDay()
  return { ...safe, weekday }
}

/** 해당 시간대에서 UTC 와의 차이(ms) */
function tzOffset(utcMs: number, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const parts = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]))
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second)
    return asUtc - utcMs
  } catch {
    return 9 * 3600 * 1000 // Asia/Seoul
  }
}

/** 예식 시각(절대 시각, ms) */
export function weddingInstant(w: InvitationContent['wedding']): number {
  const p = parseWedding(w)
  const guess = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm)
  const off = tzOffset(guess, w.timezone || 'Asia/Seoul')
  return guess - off
}

export function formatEnDate(p: DateParts) {
  return `${MONTHS_EN[p.m - 1]} ${String(p.d).padStart(2, '0')}, ${p.y}`
}

export function monthNameEn(m: number) {
  return MONTHS_EN[m - 1]
}

export function weekdayKo(p: DateParts) {
  return DAYS_KO[p.weekday] + '요일'
}

export function weekdayEn(p: DateParts) {
  return DAYS_EN[p.weekday]
}

export function formatKoTime(p: DateParts) {
  const ampm = p.hh < 12 ? '오전' : '오후'
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12
  return `${ampm} ${h12}시${p.mm ? ` ${p.mm}분` : ''}`
}

export function formatKoDate(p: DateParts) {
  return `${p.y}년 ${p.m}월 ${p.d}일 ${weekdayKo(p)}`
}

export function formatKoFull(p: DateParts) {
  return `${formatKoDate(p)} ${formatKoTime(p)}`
}

export function calendarMatrix(y: number, m: number, weekStart: 'sun' | 'mon' = 'sun'): (number | null)[][] {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const offset = weekStart === 'sun' ? first : (first + 6) % 7
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

export interface Countdown {
  past: boolean
  today: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
  dday: number // 날짜 기준 D-day (당일 0)
}

export function countdown(w: InvitationContent['wedding'], now = Date.now()): Countdown {
  const target = weddingInstant(w)
  const diff = target - now
  const p = parseWedding(w)
  // 예식 날짜(현지 자정) 기준 D-day
  const tz = w.timezone || 'Asia/Seoul'
  const nowLocal = now + tzOffset(now, tz)
  const todayUtc = Math.floor(nowLocal / 86400000)
  const weddingDay = Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000)
  const dday = weddingDay - todayUtc
  const abs = Math.max(0, diff)
  return {
    past: diff <= 0,
    today: dday === 0,
    dday,
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
  }
}
