-- =====================================================================
--  여러 버전의 청첩장
--  - 기본 청첩장(부모) 아래에 버전(자식)을 여러 개 만들 수 있습니다.
--  - 버전마다 주소(slug)·내용·게시 상태가 따로 있고,
--    축하글·하객 사진·운영 스위치·관리자는 기본 청첩장 하나로 함께 씁니다.
-- =====================================================================

alter table public.invitations
  add column if not exists parent_id uuid references public.invitations(id) on delete cascade,
  add column if not exists name text not null default '기본 버전';

create index if not exists invitations_parent_idx on public.invitations (parent_id);

-- 버전이 속한 기본 청첩장 id (축하글·사진·관리자 기준)
create or replace function public.root_invitation_id(inv uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(i.parent_id, i.id) from public.invitations i where i.id = inv;
$$;

-- 관리자 확인: 기본 청첩장의 관리자면 모든 버전의 관리자
create or replace function public.is_invitation_admin(inv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitation_admins a
    where a.invitation_id = public.root_invitation_id(inv) and a.user_id = auth.uid()
  );
$$;

-- 그룹 안에 게시된 버전이 하나라도 있는지
create or replace function public.group_is_published(root uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.invitations i where (i.id = root or i.parent_id = root) and i.is_published);
$$;

grant update (name) on public.invitations to authenticated;

-- ---------------------------------------------------------------------
-- 하객용 RPC — 버전 주소로 들어와도 축하글·사진은 기본 청첩장에 모입니다
-- ---------------------------------------------------------------------

create or replace function public.get_public_invitation(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', r.id,
    'version_id', i.id,
    'slug', i.slug,
    'content', i.published,
    'published_at', i.published_at,
    'guestbook_enabled', r.guestbook_enabled,
    'guestbook_public', r.guestbook_public,
    'uploads_enabled', r.uploads_enabled,
    'uploads_public', r.uploads_public,
    'uploads_require_approval', r.uploads_require_approval
  )
  from public.invitations i
  join public.invitations r on r.id = coalesce(i.parent_id, i.id)
  where i.slug = p_slug and i.is_published and i.published is not null;
$$;

create or replace function public.list_guestbook(p_slug text, p_limit int default 100, p_before timestamptz default null)
returns table (id uuid, author text, message text, created_at timestamptz, has_password boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.author, g.message, g.created_at, (g.password_hash is not null)
  from public.invitations i
  join public.invitations r on r.id = coalesce(i.parent_id, i.id)
  join public.guestbook_entries g on g.invitation_id = r.id
  where i.slug = p_slug and i.is_published and r.guestbook_public
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
  ver public.invitations;
  inv public.invitations;
  ip text := public.request_ip_hash();
  a text := btrim(regexp_replace(coalesce(p_author, ''), '[[:cntrl:]]', '', 'g'));
  m text := btrim(regexp_replace(coalesce(p_message, ''), '[\x00-\x09\x0B-\x1F\x7F]', '', 'g'));
  new_id uuid;
begin
  select * into ver from public.invitations where slug = p_slug and is_published;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into inv from public.invitations where id = coalesce(ver.parent_id, ver.id);
  if not inv.guestbook_enabled then raise exception 'GUESTBOOK_DISABLED'; end if;

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
  perform public.hit_rate_limit('guestbook-inv', inv.id::text, 200, interval '10 minutes');

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

create or replace function public.register_guest_photo(
  p_slug text, p_path text, p_author text default null, p_message text default null,
  p_width int default null, p_height int default null, p_bytes int default null, p_consent boolean default false
) returns json language plpgsql security definer set search_path = public as $$
declare
  ver public.invitations;
  inv public.invitations;
  ip text := public.request_ip_hash();
  st text;
  new_id uuid;
begin
  select * into ver from public.invitations where slug = p_slug and is_published;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into inv from public.invitations where id = coalesce(ver.parent_id, ver.id);
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
  from public.invitations i
  join public.invitations r on r.id = coalesce(i.parent_id, i.id)
  join public.guest_photos p on p.invitation_id = r.id
  where i.slug = p_slug and i.is_published and r.uploads_public and p.status = 'approved'
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

create or replace function public.guest_upload_allowed(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.invitations r
    where r.parent_id is null and r.uploads_enabled and public.group_is_published(r.id)
      and p_name ~ ('^' || r.id::text || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif)$')
  );
$$;

create or replace function public.guest_photo_public(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.guest_photos p join public.invitations r on r.id = p.invitation_id
    where p.storage_path = p_name and p.status = 'approved' and r.uploads_public and public.group_is_published(r.id)
  );
$$;

-- ---------------------------------------------------------------------
-- 버전 만들기 / 삭제
-- ---------------------------------------------------------------------

create or replace function public.create_invitation_version(p_source uuid, p_name text, p_slug text)
returns json language plpgsql security definer set search_path = public as $$
declare
  src public.invitations;
  root uuid;
  nid uuid;
  sl text := lower(btrim(p_slug));
begin
  if not public.is_invitation_admin(p_source) then raise exception 'NOT_ADMIN'; end if;
  if sl !~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$' then raise exception 'INVALID_SLUG'; end if;
  if exists (select 1 from public.invitations where slug = sl) then raise exception 'SLUG_TAKEN'; end if;
  select * into src from public.invitations where id = p_source;
  root := coalesce(src.parent_id, src.id);
  if (select count(*) from public.invitations where parent_id = root) >= 20 then raise exception 'TOO_MANY_VERSIONS'; end if;
  insert into public.invitations (slug, parent_id, name, draft)
  values (sl, root, coalesce(nullif(btrim(p_name), ''), sl), src.draft)
  returning id into nid;
  return json_build_object('id', nid, 'slug', sl);
end;
$$;

create or replace function public.delete_invitation_version(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_invitation_admin(p_id) then raise exception 'NOT_ADMIN'; end if;
  if (select parent_id from public.invitations where id = p_id) is null then raise exception 'CANNOT_DELETE_ROOT'; end if;
  delete from public.invitations where id = p_id;
end;
$$;

revoke execute on function public.root_invitation_id(uuid), public.group_is_published(uuid),
  public.create_invitation_version(uuid, text, text), public.delete_invitation_version(uuid) from public, anon;
grant execute on function public.create_invitation_version(uuid, text, text) to authenticated;
grant execute on function public.delete_invitation_version(uuid) to authenticated;
