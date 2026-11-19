-- =====================================================================
--  Spring Wedding Invitation — schema, security policies and RPCs
--  관리자(신랑·신부)와 하객의 권한을 서버(Postgres RLS)에서 분리합니다.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  draft jsonb not null default '{}'::jsonb,          -- 편집 중인 내용 (관리자만)
  published jsonb,                                    -- 하객에게 보이는 내용
  is_published boolean not null default false,
  published_at timestamptz,
  draft_updated_at timestamptz not null default now(),
  -- 즉시 적용되는 운영 스위치 (게시 없이 바로 반영)
  guestbook_enabled boolean not null default true,   -- 축하글 작성 허용
  guestbook_public boolean not null default true,    -- 축하글 목록 공개
  uploads_enabled boolean not null default true,     -- 하객 사진 업로드 허용
  uploads_public boolean not null default true,      -- 승인된 하객 사진 공개
  uploads_require_approval boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.invitation_admins (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (invitation_id, user_id)
);

create table public.invitation_versions (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  content jsonb not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.invitation_versions (invitation_id, created_at desc);

-- 관리자 이미지 라이브러리 (media 버킷)
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  path text not null unique,
  width int,
  height int,
  bytes int,
  created_at timestamptz not null default now()
);
create index on public.media_assets (invitation_id, created_at desc);

create table public.guestbook_entries (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  author text not null check (char_length(author) between 1 and 20),
  message text not null check (char_length(message) between 1 and 500),
  password_hash text,
  is_hidden boolean not null default false,
  delete_requested boolean not null default false,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index on public.guestbook_entries (invitation_id, created_at desc);

create table public.guest_photos (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  storage_path text not null unique,
  author text check (char_length(author) <= 20),
  message text check (char_length(message) <= 100),
  status text not null default 'pending' check (status in ('pending','approved','hidden')),
  width int,
  height int,
  bytes int,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index on public.guest_photos (invitation_id, status, created_at desc);

create table public.rate_limits (
  bucket text not null,
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, key, window_start)
);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function public.is_invitation_admin(inv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitation_admins a
    where a.invitation_id = inv and a.user_id = auth.uid()
  );
$$;

-- 요청 IP (PostgREST 가 전달하는 헤더) 를 해시하여 사용 — 원문 IP 는 저장하지 않음
create or replace function public.request_ip_hash()
returns text language plpgsql stable set search_path = public, extensions as $$
declare
  h json;
  ip text;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;
  -- Supabase 호스팅은 Cloudflare 뒤에 있으므로 위조할 수 없는 cf-connecting-ip 를 우선 사용
  ip := coalesce(
    nullif(h->>'cf-connecting-ip', ''),
    nullif(h->>'x-real-ip', ''),
    nullif(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), ''),
    'unknown'
  );
  return encode(extensions.digest(trim(ip) || ':spring-wedding', 'sha256'), 'hex');
end;
$$;

-- 고정 창(window) 방식 요청 횟수 제한. 초과 시 예외.
create or replace function public.hit_rate_limit(p_bucket text, p_key text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = public as $$
declare
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  n int;
begin
  insert into public.rate_limits as r (bucket, key, window_start, hits)
  values (p_bucket, p_key, ws, 1)
  on conflict (bucket, key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if n > p_max then
    raise exception 'RATE_LIMITED' using errcode = 'P0001', hint = '잠시 후 다시 시도해 주세요.';
  end if;
  -- 오래된 기록 정리 (가볍게)
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- 하객(anon)은 테이블에 직접 접근할 수 없고, 아래 RPC 로만 필요한 데이터를 받습니다.
-- ---------------------------------------------------------------------

alter table public.invitations enable row level security;
alter table public.invitation_admins enable row level security;
alter table public.invitation_versions enable row level security;
alter table public.media_assets enable row level security;
alter table public.guestbook_entries enable row level security;
alter table public.guest_photos enable row level security;
alter table public.rate_limits enable row level security;

create policy "admins read invitation" on public.invitations
  for select to authenticated using (public.is_invitation_admin(id));
create policy "admins update invitation" on public.invitations
  for update to authenticated using (public.is_invitation_admin(id)) with check (public.is_invitation_admin(id));

create policy "admins see co-admins" on public.invitation_admins
  for select to authenticated using (public.is_invitation_admin(invitation_id));

create policy "admins read versions" on public.invitation_versions
  for select to authenticated using (public.is_invitation_admin(invitation_id));
create policy "admins delete versions" on public.invitation_versions
  for delete to authenticated using (public.is_invitation_admin(invitation_id));

create policy "admins manage media" on public.media_assets
  for all to authenticated using (public.is_invitation_admin(invitation_id)) with check (public.is_invitation_admin(invitation_id));

create policy "admins read guestbook" on public.guestbook_entries
  for select to authenticated using (public.is_invitation_admin(invitation_id));
create policy "admins update guestbook" on public.guestbook_entries
  for update to authenticated using (public.is_invitation_admin(invitation_id)) with check (public.is_invitation_admin(invitation_id));
create policy "admins delete guestbook" on public.guestbook_entries
  for delete to authenticated using (public.is_invitation_admin(invitation_id));

create policy "admins read guest photos" on public.guest_photos
  for select to authenticated using (public.is_invitation_admin(invitation_id));
create policy "admins update guest photos" on public.guest_photos
  for update to authenticated using (public.is_invitation_admin(invitation_id)) with check (public.is_invitation_admin(invitation_id));
create policy "admins delete guest photos" on public.guest_photos
  for delete to authenticated using (public.is_invitation_admin(invitation_id));
-- rate_limits: 정책 없음 = 클라이언트 접근 불가

-- 컬럼 단위 권한: 관리자도 slug/id 등 핵심 키는 클라이언트에서 바꾸지 않음
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;
grant update (draft, draft_updated_at, guestbook_enabled, guestbook_public, uploads_enabled, uploads_public, uploads_require_approval)
  on public.invitations to authenticated;
revoke all on public.invitation_admins, public.invitation_versions, public.media_assets,
  public.guestbook_entries, public.guest_photos, public.rate_limits from anon;
revoke all on public.rate_limits from authenticated;
revoke insert on public.guestbook_entries, public.guest_photos, public.invitation_versions from authenticated;
revoke update on public.guestbook_entries from authenticated;
grant update (is_hidden, delete_requested) on public.guestbook_entries to authenticated;
revoke update on public.guest_photos from authenticated;
grant update (status) on public.guest_photos to authenticated;

-- ---------------------------------------------------------------------
-- Public RPCs (하객용)
-- ---------------------------------------------------------------------

-- 게시된 청첩장 내용만 반환 (초안/관리자 정보는 절대 포함하지 않음)
create or replace function public.get_public_invitation(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', i.id,
    'slug', i.slug,
    'content', i.published,
    'published_at', i.published_at,
    'guestbook_enabled', i.guestbook_enabled,
    'guestbook_public', i.guestbook_public,
    'uploads_enabled', i.uploads_enabled,
    'uploads_public', i.uploads_public,
    'uploads_require_approval', i.uploads_require_approval
  )
  from public.invitations i
  where i.slug = p_slug and i.is_published and i.published is not null;
$$;

create or replace function public.list_guestbook(p_slug text, p_limit int default 100, p_before timestamptz default null)
returns table (id uuid, author text, message text, created_at timestamptz, has_password boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.author, g.message, g.created_at, (g.password_hash is not null)
  from public.guestbook_entries g
  join public.invitations i on i.id = g.invitation_id
  where i.slug = p_slug and i.is_published and i.guestbook_public
    and not g.is_hidden
    and (p_before is null or g.created_at < p_before)
  order by g.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

create or replace function public.submit_guestbook(
  p_slug text, p_author text, p_message text, p_password text default null,
  p_honeypot text default null, p_elapsed_ms int default null
) returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  inv public.invitations;
  ip text := public.request_ip_hash();
  a text := btrim(regexp_replace(coalesce(p_author, ''), '[[:cntrl:]]', '', 'g'));
  m text := btrim(regexp_replace(coalesce(p_message, ''), '[\x00-\x09\x0B-\x1F\x7F]', '', 'g'));
  new_id uuid;
begin
  select * into inv from public.invitations where slug = p_slug and is_published;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not inv.guestbook_enabled then raise exception 'GUESTBOOK_DISABLED'; end if;

  -- 스팸 방지: 숨겨진 입력칸(honeypot)에 값이 있거나 너무 빠른 제출은 거부
  if coalesce(p_honeypot, '') <> '' then raise exception 'SPAM_DETECTED'; end if;
  if p_elapsed_ms is not null and p_elapsed_ms < 1500 then raise exception 'SPAM_DETECTED'; end if;

  if char_length(a) < 1 or char_length(a) > 20 then raise exception 'INVALID_AUTHOR'; end if;
  if char_length(m) < 1 or char_length(m) > 500 then raise exception 'INVALID_MESSAGE'; end if;
  if (select count(*) from regexp_matches(m, 'https?://', 'g')) > 1 then raise exception 'SPAM_DETECTED'; end if;
  if p_password is not null and p_password <> '' and (char_length(p_password) < 4 or char_length(p_password) > 32) then
    raise exception 'INVALID_PASSWORD';
  end if;

  perform public.hit_rate_limit('guestbook', ip, 5, interval '10 minutes');
  perform public.hit_rate_limit('guestbook-day', ip, 30, interval '1 day');
  -- 초대장 전체 상한 (IP 를 바꿔가며 보내는 공격 대비)
  perform public.hit_rate_limit('guestbook-inv', inv.id::text, 200, interval '10 minutes');

  -- 동일 내용 반복 게시 방지
  if exists (select 1 from public.guestbook_entries
             where invitation_id = inv.id and message = m and created_at > now() - interval '1 hour') then
    raise exception 'DUPLICATE';
  end if;

  insert into public.guestbook_entries (invitation_id, author, message, password_hash, ip_hash)
  values (inv.id, a, m,
          case when coalesce(p_password, '') <> '' then extensions.crypt(p_password, extensions.gen_salt('bf')) end,
          ip)
  returning id into new_id;

  return json_build_object('id', new_id, 'public', inv.guestbook_public);
end;
$$;

-- 하객 본인 삭제(비밀번호) 또는 삭제 요청(비밀번호 없이 작성한 경우)
create or replace function public.guest_delete_guestbook(p_id uuid, p_password text default null)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  e public.guestbook_entries;
begin
  perform public.hit_rate_limit('guestbook-delete', public.request_ip_hash(), 10, interval '10 minutes');
  select * into e from public.guestbook_entries where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if e.password_hash is null then
    update public.guestbook_entries set delete_requested = true where id = p_id;
    return 'requested';
  end if;
  if p_password is null or extensions.crypt(p_password, e.password_hash) <> e.password_hash then
    raise exception 'WRONG_PASSWORD';
  end if;
  delete from public.guestbook_entries where id = p_id;
  return 'deleted';
end;
$$;

-- 하객 사진: 스토리지 업로드 후 등록
create or replace function public.register_guest_photo(
  p_slug text, p_path text, p_author text default null, p_message text default null,
  p_width int default null, p_height int default null, p_bytes int default null, p_consent boolean default false
) returns json language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
  ip text := public.request_ip_hash();
  st text;
  new_id uuid;
begin
  select * into inv from public.invitations where slug = p_slug and is_published;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not inv.uploads_enabled then raise exception 'UPLOADS_DISABLED'; end if;
  if not coalesce(p_consent, false) then raise exception 'CONSENT_REQUIRED'; end if;
  if p_path !~ ('^' || inv.id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif)$') then
    raise exception 'INVALID_PATH';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'guest-photos' and o.name = p_path) then
    raise exception 'FILE_NOT_FOUND';
  end if;
  if char_length(coalesce(p_author, '')) > 20 or char_length(coalesce(p_message, '')) > 100 then
    raise exception 'INVALID_INPUT';
  end if;

  perform public.hit_rate_limit('photo', ip, 40, interval '10 minutes');
  perform public.hit_rate_limit('photo-inv', inv.id::text, 600, interval '10 minutes');

  st := case when inv.uploads_require_approval then 'pending' else 'approved' end;
  insert into public.guest_photos (invitation_id, storage_path, author, message, status, width, height, bytes, ip_hash)
  values (inv.id, p_path, nullif(btrim(p_author), ''), nullif(btrim(p_message), ''), st, p_width, p_height, p_bytes, ip)
  returning id into new_id;
  return json_build_object('id', new_id, 'status', st);
end;
$$;

create or replace function public.list_guest_photos(p_slug text, p_limit int default 200)
returns table (id uuid, storage_path text, author text, message text, width int, height int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.storage_path, p.author, p.message, p.width, p.height, p.created_at
  from public.guest_photos p
  join public.invitations i on i.id = p.invitation_id
  where i.slug = p_slug and i.is_published and i.uploads_public and p.status = 'approved'
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- 하객 사진 스토리지 업로드 허용 여부 (스토리지 정책에서 사용)
create or replace function public.guest_upload_allowed(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitations i
    where i.is_published and i.uploads_enabled
      and p_name ~ ('^' || i.id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif)$')
  );
$$;

create or replace function public.guest_photo_public(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.guest_photos p join public.invitations i on i.id = p.invitation_id
    where p.storage_path = p_name and p.status = 'approved' and i.uploads_public and i.is_published
  );
$$;

create or replace function public.guest_photo_admin(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitation_admins a
    where a.user_id = auth.uid() and p_name like (a.invitation_id::text || '/%')
  );
$$;

-- ---------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------

-- 초대장에 관리자가 아직 한 명도 없으면, 처음 로그인한 계정이 관리자가 됩니다.
create or replace function public.claim_invitation(p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into inv from public.invitations where slug = p_slug for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from public.invitation_admins where invitation_id = inv.id and user_id = auth.uid()) then
    return json_build_object('status', 'already_admin', 'id', inv.id);
  end if;
  if exists (select 1 from public.invitation_admins where invitation_id = inv.id) then
    raise exception 'NOT_ADMIN';
  end if;
  insert into public.invitation_admins (invitation_id, user_id) values (inv.id, auth.uid());
  return json_build_object('status', 'claimed', 'id', inv.id);
end;
$$;

create or replace function public.add_invitation_admin(p_invitation uuid, p_email text)
returns json language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid;
begin
  if not public.is_invitation_admin(p_invitation) then raise exception 'NOT_ADMIN'; end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if uid is null then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.invitation_admins (invitation_id, user_id) values (p_invitation, uid) on conflict do nothing;
  return json_build_object('user_id', uid);
end;
$$;

create or replace function public.list_invitation_admins(p_invitation uuid)
returns table (user_id uuid, email text, created_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select a.user_id, u.email::text, a.created_at
  from public.invitation_admins a join auth.users u on u.id = a.user_id
  where a.invitation_id = p_invitation and public.is_invitation_admin(p_invitation)
  order by a.created_at;
$$;

create or replace function public.publish_invitation(p_invitation uuid, p_note text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  c jsonb;
  vid uuid;
begin
  if not public.is_invitation_admin(p_invitation) then raise exception 'NOT_ADMIN'; end if;
  select draft into c from public.invitations where id = p_invitation;
  update public.invitations
     set published = c, is_published = true, published_at = now()
   where id = p_invitation;
  insert into public.invitation_versions (invitation_id, content, note, created_by)
  values (p_invitation, c, p_note, auth.uid()) returning id into vid;
  -- 버전은 최근 50개만 보관
  delete from public.invitation_versions
   where invitation_id = p_invitation
     and id not in (select id from public.invitation_versions where invitation_id = p_invitation order by created_at desc limit 50);
  return json_build_object('version_id', vid, 'published_at', now());
end;
$$;

create or replace function public.unpublish_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_invitation_admin(p_invitation) then raise exception 'NOT_ADMIN'; end if;
  update public.invitations set is_published = false where id = p_invitation;
end;
$$;

-- 이전 버전 복원: 초안으로 가져오고, p_publish 이면 바로 게시
create or replace function public.restore_version(p_version uuid, p_publish boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare
  v public.invitation_versions;
begin
  select * into v from public.invitation_versions where id = p_version;
  if not found or not public.is_invitation_admin(v.invitation_id) then raise exception 'NOT_ADMIN'; end if;
  update public.invitations set draft = v.content, draft_updated_at = now() where id = v.invitation_id;
  if p_publish then
    update public.invitations set published = v.content, is_published = true, published_at = now()
     where id = v.invitation_id;
  end if;
  return json_build_object('content', v.content);
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_public_invitation(text) to anon, authenticated;
grant execute on function public.list_guestbook(text, int, timestamptz) to anon, authenticated;
grant execute on function public.submit_guestbook(text, text, text, text, text, int) to anon, authenticated;
grant execute on function public.guest_delete_guestbook(uuid, text) to anon, authenticated;
grant execute on function public.register_guest_photo(text, text, text, text, int, int, int, boolean) to anon, authenticated;
grant execute on function public.list_guest_photos(text, int) to anon, authenticated;
grant execute on function public.guest_upload_allowed(text) to anon, authenticated;
grant execute on function public.guest_photo_public(text) to anon, authenticated;
grant execute on function public.guest_photo_admin(text) to anon, authenticated;
grant execute on function public.is_invitation_admin(uuid) to authenticated;
grant execute on function public.claim_invitation(text) to authenticated;
grant execute on function public.add_invitation_admin(uuid, text) to authenticated;
grant execute on function public.list_invitation_admins(uuid) to authenticated;
grant execute on function public.publish_invitation(uuid, text) to authenticated;
grant execute on function public.unpublish_invitation(uuid) to authenticated;
grant execute on function public.restore_version(uuid, boolean) to authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage
--  media        : 관리자가 올린 웨딩 사진 (공개 읽기, 관리자만 쓰기)
--  guest-photos : 하객 업로드 (비공개, 승인된 사진만 하객 열람)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 15728640, array['image/jpeg','image/png','image/webp','image/gif']),
  ('guest-photos', 'guest-photos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_invitation_admin(nullif(split_part(name, '/', 1), '')::uuid));
create policy "media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_invitation_admin(nullif(split_part(name, '/', 1), '')::uuid));
create policy "media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_invitation_admin(nullif(split_part(name, '/', 1), '')::uuid));
create policy "media admin select" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_invitation_admin(nullif(split_part(name, '/', 1), '')::uuid));

create policy "guest photo upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'guest-photos' and public.guest_upload_allowed(name));
create policy "guest photo read approved" on storage.objects for select to anon, authenticated
  using (bucket_id = 'guest-photos' and (public.guest_photo_public(name) or public.guest_photo_admin(name)));
create policy "guest photo admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'guest-photos' and public.guest_photo_admin(name));

-- ---------------------------------------------------------------------
-- 기본 초대장 (내용은 관리자 화면 첫 로그인 시 기본 템플릿으로 채워집니다)
-- ---------------------------------------------------------------------
insert into public.invitations (slug) values ('event') on conflict (slug) do nothing;
