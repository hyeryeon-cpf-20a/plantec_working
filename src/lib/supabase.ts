import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = ((import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined)?.trim()

/** 백엔드가 설정되지 않았다면 null — 저장 기능을 가짜로 흉내 내지 않고 "연결 필요" 상태를 보여 줍니다. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'event-invite-admin' },
      })
    : null

export const isBackendConfigured = !!supabase
export const SUPABASE_URL = url ?? ''

export function requireClient(): SupabaseClient {
  if (!supabase) throw new Error('BACKEND_NOT_CONFIGURED')
  return supabase
}
