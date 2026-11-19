import { requireClient, supabase } from './supabase'
import { normalizeContent } from './normalize'
import { defaultContent } from './defaults'
import { prepareImage } from './image'
import type { InvitationContent, PublicInvitation } from './types'
import { uid } from './util'

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ------------------------------------------------------------------ public (하객)

export async function fetchPublicInvitation(slug: string): Promise<PublicInvitation | null> {
  const sb = requireClient()
  const data = unwrap(await sb.rpc('get_public_invitation', { p_slug: slug })) as PublicInvitation | null
  if (!data) return null
  return { ...data, content: normalizeContent(data.content) }
}

// ------------------------------------------------------------------ admin (관리자)

export interface AdminInvitation {
  id: string
  slug: string
  name: string
  parent_id: string | null
  /** 이미지·관리자가 모이는 기본 초대장 id */
  data_id: string
  draft: InvitationContent
  published: InvitationContent | null
  is_published: boolean
  published_at: string | null
  draft_updated_at: string
  guestbook_enabled: boolean
  guestbook_public: boolean
  uploads_enabled: boolean
  uploads_public: boolean
  uploads_require_approval: boolean
}

export type AdminFlags = Pick<
  AdminInvitation,
  'guestbook_enabled' | 'guestbook_public' | 'uploads_enabled' | 'uploads_public' | 'uploads_require_approval'
>

export async function claimInvitation(slug: string) {
  const sb = requireClient()
  return unwrap(await sb.rpc('claim_invitation', { p_slug: slug })) as { status: string; id: string }
}

export async function loadAdminInvitation(slug: string): Promise<AdminInvitation> {
  const sb = requireClient()
  const row = unwrap(await sb.from('invitations').select('*').eq('slug', slug).maybeSingle()) as
    | (Omit<AdminInvitation, 'draft' | 'published'> & { draft: unknown; published: unknown })
    | null
  if (!row) throw new Error('NOT_ADMIN')
  // 버전이면 운영 스위치는 기본 초대장 값을 사용
  if (row.parent_id) {
    const root = unwrap(
      await sb
        .from('invitations')
        .select('guestbook_enabled, guestbook_public, uploads_enabled, uploads_public, uploads_require_approval')
        .eq('id', row.parent_id)
        .single(),
    ) as AdminFlags
    Object.assign(row, root)
  }
  ;(row as { data_id: string }).data_id = row.parent_id ?? row.id
  const empty = !row.draft || (typeof row.draft === 'object' && !Array.isArray((row.draft as { sections?: unknown }).sections))
  return {
    ...row,
    draft: empty ? defaultContent() : normalizeContent(row.draft),
    published: row.published ? normalizeContent(row.published) : null,
  }
}

// ------------------------------------------------------------------ 여러 버전

export interface VersionInfo {
  id: string
  slug: string
  name: string
  parent_id: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
}

export async function listInvitationGroup(dataId: string): Promise<VersionInfo[]> {
  const sb = requireClient()
  const rows: VersionInfo[] =
    unwrap(
      await sb
        .from('invitations')
        .select('id, slug, name, parent_id, is_published, published_at, created_at')
        .or(`id.eq.${dataId},parent_id.eq.${dataId}`)
        .order('created_at', { ascending: true }),
    ) ?? []
  return rows.sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0))
}

export async function createVersion(sourceId: string, name: string, slug: string) {
  const sb = requireClient()
  return unwrap(await sb.rpc('create_invitation_version', { p_source: sourceId, p_name: name, p_slug: slug })) as { id: string; slug: string }
}

export async function deleteVersion(id: string) {
  const sb = requireClient()
  unwrap(await sb.rpc('delete_invitation_version', { p_id: id }))
}

export async function renameVersion(id: string, name: string) {
  const sb = requireClient()
  unwrap(await sb.from('invitations').update({ name }).eq('id', id).select('id').single())
}

export async function saveDraft(id: string, draft: InvitationContent): Promise<string> {
  const sb = requireClient()
  const now = new Date().toISOString()
  const res = await sb.from('invitations').update({ draft, draft_updated_at: now }).eq('id', id).select('draft_updated_at').single()
  return (unwrap(res) as { draft_updated_at: string }).draft_updated_at
}

export async function updateFlags(id: string, flags: Partial<AdminFlags>) {
  const sb = requireClient()
  unwrap(await sb.from('invitations').update(flags).eq('id', id).select('id').single())
}

export async function publish(id: string, note?: string) {
  const sb = requireClient()
  return unwrap(await sb.rpc('publish_invitation', { p_invitation: id, p_note: note ?? null })) as {
    version_id: string
    published_at: string
  }
}

export async function unpublish(id: string) {
  const sb = requireClient()
  unwrap(await sb.rpc('unpublish_invitation', { p_invitation: id }))
}

export interface VersionRow {
  id: string
  note: string | null
  created_at: string
  content: InvitationContent
}

export async function listVersions(invitationId: string): Promise<VersionRow[]> {
  const sb = requireClient()
  return (
    unwrap(
      await sb
        .from('invitation_versions')
        .select('id, note, created_at, content')
        .eq('invitation_id', invitationId)
        .order('created_at', { ascending: false })
        .limit(50),
    ) ?? []
  )
}

export async function restoreVersion(versionId: string, publishNow: boolean): Promise<InvitationContent> {
  const sb = requireClient()
  const res = unwrap(await sb.rpc('restore_version', { p_version: versionId, p_publish: publishNow })) as { content: unknown }
  return normalizeContent(res.content)
}

export interface MediaAsset {
  id: string
  path: string
  width: number | null
  height: number | null
  bytes: number | null
  created_at: string
}

export async function listMedia(invitationId: string): Promise<MediaAsset[]> {
  const sb = requireClient()
  return (
    unwrap(
      await sb.from('media_assets').select('*').eq('invitation_id', invitationId).order('created_at', { ascending: false }),
    ) ?? []
  )
}

export async function uploadMedia(invitationId: string, file: File): Promise<MediaAsset> {
  const sb = requireClient()
  const prepared = await prepareImage(file, 2400, 0.86)
  const path = `${invitationId}/${uid()}.${prepared.ext}`
  const up = await sb.storage.from('media').upload(path, prepared.blob, {
    contentType: prepared.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (up.error) throw new Error(up.error.message)
  return unwrap(
    await sb
      .from('media_assets')
      .insert({ invitation_id: invitationId, path, width: prepared.width, height: prepared.height, bytes: prepared.blob.size })
      .select('*')
      .single(),
  )
}

export async function deleteMedia(asset: MediaAsset) {
  const sb = requireClient()
  const rm = await sb.storage.from('media').remove([asset.path])
  if (rm.error) throw new Error(rm.error.message)
  unwrap(await sb.from('media_assets').delete().eq('id', asset.id).select('id'))
}

export async function listAdmins(invitationId: string) {
  const sb = requireClient()
  return (unwrap(await sb.rpc('list_invitation_admins', { p_invitation: invitationId })) ?? []) as {
    user_id: string
    email: string
    created_at: string
  }[]
}

export async function addAdmin(invitationId: string, email: string) {
  const sb = requireClient()
  return unwrap(await sb.rpc('add_invitation_admin', { p_invitation: invitationId, p_email: email }))
}

export { supabase }
