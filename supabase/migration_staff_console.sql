-- Staff console: moderator role, staff audit log, badge management, timed suspensions,
-- session/IP log and the full per-user dossier used by the admin/mod panel.
-- Applied live on the Supabase project (migration staff_console); kept here as the mirror.

-- ---------------------------------------------------------------------------
-- roles: MODERATOR + helpers
-- ---------------------------------------------------------------------------
insert into public.roles (name, description)
select 'MODERATOR', 'Moderator — limited staff tools (suspend, moderation queue, reports, support)'
where not exists (select 1 from public.roles where name = 'MODERATOR');

create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'MODERATOR'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name in ('ADMIN', 'MODERATOR')
  );
$$;

create or replace function public.is_staff_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.name in ('ADMIN', 'MODERATOR')
  );
$$;

-- 'admin' | 'moderator' | null — what the frontend uses to pick the panel
create or replace function public.staff_role()
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'admin'
    when public.is_moderator() then 'moderator'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- staff audit log — every staff action, visible to admins (mods see their own)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staff_actions_target_idx on public.staff_actions (target_user_id, created_at desc);
create index if not exists staff_actions_created_idx on public.staff_actions (created_at desc);
alter table public.staff_actions enable row level security;
drop policy if exists staff_actions_read on public.staff_actions;
create policy staff_actions_read on public.staff_actions for select using (public.is_admin() or actor_id = auth.uid());

create or replace function public.log_staff_action(p_action text, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.staff_actions (actor_id, action, target_user_id, details)
  values (auth.uid(), p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.log_staff_action(text, uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- staff notes on a user (internal, never shown to the user)
-- ---------------------------------------------------------------------------
create table if not exists public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists staff_notes_user_idx on public.staff_notes (user_id, created_at desc);
alter table public.staff_notes enable row level security;
drop policy if exists staff_notes_select on public.staff_notes;
create policy staff_notes_select on public.staff_notes for select using (public.is_staff());
drop policy if exists staff_notes_insert on public.staff_notes;
create policy staff_notes_insert on public.staff_notes for insert with check (public.is_staff() and author_id = auth.uid());
drop policy if exists staff_notes_delete on public.staff_notes;
create policy staff_notes_delete on public.staff_notes for delete using (public.is_admin() or author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- session log: every login (auth.sessions insert) with IP + device. Kept after
-- account deletion on purpose so abuse can still be traced by IP.
-- ---------------------------------------------------------------------------
create table if not exists public.session_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists session_log_user_idx on public.session_log (user_id, created_at desc);
create index if not exists session_log_ip_idx on public.session_log (ip);
alter table public.session_log enable row level security;
drop policy if exists session_log_staff_read on public.session_log;
create policy session_log_staff_read on public.session_log for select using (public.is_staff());

create or replace function public.log_auth_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.session_log (user_id, session_id, ip, user_agent, created_at)
  values (new.user_id, new.id, host(new.ip), left(new.user_agent, 400), coalesce(new.created_at, now()));
  return new;
end;
$$;
drop trigger if exists on_auth_session_created on auth.sessions;
create trigger on_auth_session_created after insert on auth.sessions
for each row execute function public.log_auth_session();

-- backfill from the sessions that already exist
insert into public.session_log (user_id, session_id, ip, user_agent, created_at)
select s.user_id, s.id, host(s.ip), left(s.user_agent, 400), s.created_at
from auth.sessions s
where not exists (select 1 from public.session_log l where l.session_id = s.id);

-- approximate IP location cache (filled by the staff panel on demand)
create table if not exists public.ip_geo (
  ip text primary key,
  country text,
  country_code text,
  region text,
  city text,
  isp text,
  lat double precision,
  lng double precision,
  fetched_at timestamptz not null default now()
);
alter table public.ip_geo enable row level security;
drop policy if exists ip_geo_staff on public.ip_geo;
create policy ip_geo_staff on public.ip_geo for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- badges: kinds, colours, manual grants that automatic refreshes never undo
-- ---------------------------------------------------------------------------
alter table public.badges
  add column if not exists kind text not null default 'custom',
  add column if not exists color text,
  add column if not exists sort_order integer not null default 100,
  add column if not exists created_by uuid;
alter table public.badges drop constraint if exists badges_kind_check;
alter table public.badges add constraint badges_kind_check check (kind in ('identity', 'licence', 'activity', 'custom'));
alter table public.badges drop constraint if exists badges_code_format;
alter table public.badges add constraint badges_code_format check (code ~ '^[a-z0-9_]{3,40}$');

update public.badges set kind = 'identity', sort_order = 10 where code in ('verified', 'mobile_verified', 'id_verified', 'police_check', 'payment_verified');
update public.badges set kind = 'licence', sort_order = 20 where code like 'licence_%';
update public.badges set kind = 'activity', sort_order = 30 where code in ('top_rated', 'fast_responder', 'rising_talent', 'reliable', 'founder', 'flawless', 'local_hero', 'veteran', 'trusted_client');

alter table public.user_badges
  add column if not exists manual boolean not null default false,
  add column if not exists note text,
  add column if not exists awarded_by uuid;

-- automatic revokes skip badges a human granted
create or replace function public.set_badge(p_user_id uuid, p_code text, p_award boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_award then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where code = p_code
    on conflict do nothing;
  else
    delete from public.user_badges ub using public.badges b
    where ub.badge_id = b.id and b.code = p_code and ub.user_id = p_user_id and ub.manual = false;
  end if;
end;
$$;

create or replace function public.admin_grant_badge(p_user_id uuid, p_code text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_label text;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select label into v_label from public.badges where code = p_code;
  if v_label is null then raise exception 'UNKNOWN_BADGE'; end if;
  insert into public.user_badges (user_id, badge_id, manual, note, awarded_by)
  select p_user_id, id, true, nullif(btrim(p_note), ''), auth.uid() from public.badges where code = p_code
  on conflict (user_id, badge_id) do update set manual = true, note = excluded.note, awarded_by = excluded.awarded_by;
  insert into public.notifications (user_id, type, title, message)
  values (p_user_id, 'badge', 'Nova značka: ' || v_label, 'Poso.ba tim ti je dodijelio značku „' || v_label || '“. Vidi se na tvom javnom profilu.');
  perform public.log_staff_action('badge_grant', p_user_id, jsonb_build_object('code', p_code, 'note', p_note));
end;
$$;

create or replace function public.admin_revoke_badge(p_user_id uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.user_badges ub using public.badges b
  where ub.badge_id = b.id and b.code = p_code and ub.user_id = p_user_id;
  perform public.log_staff_action('badge_revoke', p_user_id, jsonb_build_object('code', p_code));
end;
$$;

-- create / edit a badge in the catalogue (system badges keep their code)
create or replace function public.admin_save_badge(p_code text, p_label text, p_description text, p_icon text, p_color text default null, p_kind text default 'custom')
returns public.badges language plpgsql security definer set search_path = public as $$
declare v_row public.badges;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_code !~ '^[a-z0-9_]{3,40}$' then raise exception 'BAD_CODE'; end if;
  if length(btrim(p_label)) < 2 then raise exception 'BAD_LABEL'; end if;
  insert into public.badges (code, label, description, icon, color, kind, created_by)
  values (p_code, btrim(p_label), nullif(btrim(p_description), ''), coalesce(nullif(p_icon, ''), 'award'), nullif(p_color, ''), coalesce(p_kind, 'custom'), auth.uid())
  on conflict (code) do update
    set label = excluded.label, description = excluded.description, icon = excluded.icon, color = excluded.color
  returning * into v_row;
  perform public.log_staff_action('badge_save', null, jsonb_build_object('code', p_code, 'label', p_label));
  return v_row;
end;
$$;

create or replace function public.admin_delete_badge(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if exists (select 1 from public.badges where code = p_code and kind <> 'custom') then raise exception 'SYSTEM_BADGE'; end if;
  delete from public.badges where code = p_code;
  perform public.log_staff_action('badge_delete', null, jsonb_build_object('code', p_code));
end;
$$;

create or replace function public.admin_badge_catalog()
returns table (id uuid, code text, label text, description text, icon text, color text, kind text, sort_order integer, holders bigint, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.code, b.label, b.description, b.icon, b.color, b.kind, b.sort_order,
         (select count(*) from public.user_badges ub where ub.badge_id = b.id), b.created_at
  from public.badges b
  where public.is_staff()
  order by b.sort_order, b.created_at;
$$;

-- ---------------------------------------------------------------------------
-- suspensions with hour precision; moderators may act on members, not on staff
-- ---------------------------------------------------------------------------
create or replace function public.staff_guard_target(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF' using errcode = '42501'; end if;
  if public.is_staff_user(p_user_id) and not public.is_admin() then raise exception 'FORBIDDEN_STAFF' using errcode = '42501'; end if;
end;
$$;
revoke execute on function public.staff_guard_target(uuid) from public, anon, authenticated;

create or replace function public.duration_label(p_hours integer)
returns text language sql immutable as $$
  select case
    when p_hours is null then 'trajno'
    when p_hours % 24 = 0 then (p_hours / 24)::text || case when p_hours / 24 = 1 then ' dan' else ' dana' end
    else p_hours::text || case
      when p_hours = 1 then ' sat'
      when p_hours % 10 in (2, 3, 4) and p_hours % 100 not in (12, 13, 14) then ' sata'
      else ' sati' end
  end;
$$;

create or replace function public.admin_suspend_for(p_user_id uuid, p_hours integer default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_reason text := coalesce(nullif(btrim(p_reason), ''), case when p_hours is null then 'Trajna suspenzija (Poso.ba tim).' else 'Suspenzija ' || public.duration_label(p_hours) || ' (Poso.ba tim).' end);
begin
  perform public.staff_guard_target(p_user_id);
  if p_hours is not null and p_hours < 1 then raise exception 'BAD_DURATION'; end if;
  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'suspended',
      suspended_until = case when p_hours is null then null else now() + make_interval(hours => p_hours) end,
      suspension_reason = v_reason
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);
  insert into public.moderation_events (user_id, source_table, snippet, action, reviewed_by, reviewed_at)
  values (p_user_id, 'profiles', v_reason, 'suspended', auth.uid(), now());
  perform public.log_staff_action('suspend', p_user_id, jsonb_build_object('hours', p_hours, 'reason', v_reason));
end;
$$;

-- old day-based entry point keeps working
create or replace function public.admin_suspend(p_user_id uuid, p_days integer default null, p_reason text default null)
returns void language sql security definer set search_path = public as $$
  select public.admin_suspend_for(p_user_id, case when p_days is null then null else p_days * 24 end, p_reason);
$$;

create or replace function public.admin_lift_suspension(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.staff_guard_target(p_user_id);
  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'active', suspended_until = null, suspension_reason = null
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);
  insert into public.moderation_events (user_id, source_table, snippet, action, reviewed_by, reviewed_at)
  values (p_user_id, 'profiles', 'Suspenziju ukinuo Poso.ba tim.', 'lifted', auth.uid(), now());
  perform public.log_staff_action('lift', p_user_id, '{}'::jsonb);
end;
$$;

create or replace function public.admin_redact(p_kind text, p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_text constant text := '[uklonjeno od strane Poso.ba tima]';
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_kind = 'message' then
    select sender_id into v_user from public.messages where id = p_id;
  elsif p_kind = 'bid' then
    select bidder_id into v_user from public.bids where id = p_id;
  elsif p_kind = 'review' then
    select reviewer_id into v_user from public.reviews where id = p_id;
  elsif p_kind = 'listing' then
    select user_id into v_user from public.listings where id = p_id;
  else
    raise exception 'UNKNOWN_KIND';
  end if;
  if v_user is null then return; end if;
  if public.is_staff_user(v_user) and not public.is_admin() then raise exception 'FORBIDDEN_STAFF' using errcode = '42501'; end if;

  if p_kind = 'message' then
    update public.messages set content = v_text where id = p_id;
  elsif p_kind = 'bid' then
    update public.bids set message = v_text, status = case when status = 'pending' then 'rejected' else status end where id = p_id;
  elsif p_kind = 'review' then
    delete from public.reviews where id = p_id;
  elsif p_kind = 'listing' then
    update public.listings set status = 'archived' where id = p_id;
  end if;
  insert into public.moderation_events (user_id, source_table, source_id, snippet, action, reviewed_by, reviewed_at)
  values (v_user, p_kind, p_id, coalesce(nullif(btrim(p_note), ''), 'Uklonio Poso.ba tim'), 'removed', auth.uid(), now());
  perform public.log_staff_action('redact', v_user, jsonb_build_object('kind', p_kind, 'id', p_id, 'note', p_note));
end;
$$;

-- suspensions can now be as short as one hour — lift them promptly
select cron.alter_job((select jobid from cron.job where jobname = 'moderation-lift-suspensions'), schedule := '*/10 * * * *');

-- ---------------------------------------------------------------------------
-- roles management (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_role not in ('ADMIN', 'MODERATOR') then raise exception 'BAD_ROLE'; end if;
  if p_user_id = auth.uid() then raise exception 'SELF' using errcode = '42501'; end if;
  if p_grant then
    insert into public.user_roles (user_id, role_id)
    select p_user_id, id from public.roles where name = p_role
    on conflict (user_id, role_id) do nothing;
    insert into public.notifications (user_id, type, title, message)
    values (p_user_id, 'role', case when p_role = 'ADMIN' then 'Dobio/la si administratorska prava' else 'Dobio/la si moderatorska prava' end,
            case when p_role = 'ADMIN' then 'Admin panel je u meniju pod „Admin“.' else 'Mod panel je u meniju pod „Mod“. Hvala što pomažeš zajednici!' end);
  else
    delete from public.user_roles ur using public.roles r
    where ur.role_id = r.id and r.name = p_role and ur.user_id = p_user_id;
  end if;
  perform public.log_staff_action(lower(p_role) || case when p_grant then '_grant' else '_revoke' end, p_user_id, '{}'::jsonb);
end;
$$;

create or replace function public.admin_list_staff()
returns table (user_id uuid, full_name text, email text, member_id text, avatar_url text, roles text[], last_seen_at timestamptz, actions_30d bigint, joined_staff_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.user_id, p.full_name, p.email, p.member_id, p.avatar_url,
         array_agg(r.name order by r.name),
         p.last_seen_at,
         (select count(*) from public.staff_actions a where a.actor_id = p.user_id and a.created_at > now() - interval '30 days'),
         min(ur.created_at)
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id and r.name in ('ADMIN', 'MODERATOR')
  join public.profiles p on p.user_id = ur.user_id
  where public.is_admin()
  group by p.user_id, p.full_name, p.email, p.member_id, p.avatar_url, p.last_seen_at
  order by min(ur.created_at);
$$;

create or replace function public.admin_staff_actions(p_limit integer default 100)
returns table (id uuid, actor_id uuid, actor_name text, action text, target_user_id uuid, target_name text, target_member text, details jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.actor_id, ap.full_name, a.action, a.target_user_id, tp.full_name, tp.member_id, a.details, a.created_at
  from public.staff_actions a
  left join public.profiles ap on ap.user_id = a.actor_id
  left join public.profiles tp on tp.user_id = a.target_user_id
  where public.is_admin() or a.actor_id = auth.uid()
  order by a.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

-- ---------------------------------------------------------------------------
-- staff-facing reads (moderators never touch profiles/messages tables directly)
-- ---------------------------------------------------------------------------
create or replace function public.staff_list_users(p_term text default '', p_status text default null, p_limit integer default 100)
returns table (
  user_id uuid, member_id text, full_name text, email text, city text, avatar_url text, account_type text,
  account_status text, suspended_until timestamptz, suspension_reason text, created_at timestamptz, last_seen_at timestamptz,
  roles text[], strikes bigint, listings bigint, bids bigint, ai_risk text, ai_score integer, ai_assessed_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with me as (select public.is_admin() as admin, public.is_staff() as staff),
  term as (select nullif(lower(btrim(coalesce(p_term, ''))), '') as t)
  select p.user_id, p.member_id, p.full_name,
         case when me.admin then p.email end,
         p.city, p.avatar_url, p.account_type, p.account_status, p.suspended_until, p.suspension_reason, p.created_at, p.last_seen_at,
         (select coalesce(array_agg(r.name order by r.name), '{}') from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.user_id and r.name in ('ADMIN', 'MODERATOR')),
         (select count(*) from public.moderation_events e where e.user_id = p.user_id and e.action in ('masked', 'removed') and not e.dismissed and e.created_at > now() - interval '30 days'),
         (select count(*) from public.listings l where l.user_id = p.user_id),
         (select count(*) from public.bids b where b.bidder_id = p.user_id),
         p.ai_assessment ->> 'risk_level',
         (p.ai_assessment ->> 'trust_score')::integer,
         p.ai_assessed_at
  from public.profiles p, me, term
  where me.staff
    and (p_status is null or p.account_status = p_status)
    and (term.t is null
         or lower(p.full_name) like '%' || term.t || '%'
         or lower(p.member_id) like '%' || term.t || '%'
         or (me.admin and lower(p.email) like '%' || term.t || '%')
         or p.user_id::text = term.t
         or lower(coalesce(p.city, '')) like '%' || term.t || '%')
  order by p.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.staff_moderation_events(p_limit integer default 200)
returns table (id uuid, user_id uuid, source_table text, source_id uuid, fields text[], kinds text[], snippet text, action text, dismissed boolean, created_at timestamptz, full_name text, member_id text, email text, account_status text)
language sql stable security definer set search_path = public as $$
  select e.id, e.user_id, e.source_table, e.source_id, e.fields, e.kinds, e.snippet, e.action, e.dismissed, e.created_at,
         p.full_name, p.member_id, case when public.is_admin() then p.email end, p.account_status
  from public.moderation_events e
  left join public.profiles p on p.user_id = e.user_id
  where public.is_staff()
  order by e.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

-- the live feed and support threads open up to moderators (email only for admins)
create or replace function public.admin_activity_feed(p_limit integer default 100, p_kind text default null, p_user uuid default null)
returns table (kind text, id uuid, user_id uuid, member_id text, full_name text, account_status text, title text, body text, status text, created_at timestamptz, ref_id uuid)
language sql stable security definer set search_path = public as $$
  with feed as (
    select 'listing' as kind, l.id, l.user_id, l.title, left(coalesce(l.description, ''), 240) as body, l.status, l.created_at, l.id as ref_id
    from public.listings l
    union all
    select 'bid', b.id, b.bidder_id, 'Ponuda ' || b.amount || ' KM', left(coalesce(b.message, ''), 240), b.status, b.created_at, b.listing_id
    from public.bids b
    union all
    select 'message', m.id, m.sender_id, 'Poruka', left(coalesce(m.content, ''), 240), null, m.created_at, m.conversation_id
    from public.messages m
    union all
    select 'review', r.id, r.reviewer_id, 'Recenzija ' || r.rating || '/5', left(coalesce(r.comment, ''), 240), null, r.created_at, r.reviewee_id
    from public.reviews r
    union all
    select 'profile', p.id, p.user_id, 'Novi nalog', coalesce(p.city, ''), p.account_type, p.created_at, p.user_id
    from public.profiles p
    union all
    select 'moderation', e.id, e.user_id, 'Pravilo #1 · ' || e.action, left(coalesce(e.snippet, ''), 240), array_to_string(e.kinds, ', '), e.created_at, e.source_id
    from public.moderation_events e
    union all
    select 'report', rp.id, rp.reporter_id, 'Prijava: ' || rp.target_type, left(coalesce(rp.reason, ''), 240), rp.status, rp.created_at, rp.target_id
    from public.reports rp
    union all
    select 'login', s.id, s.user_id, 'Prijava na nalog', coalesce(s.ip, '') || ' · ' || left(coalesce(s.user_agent, ''), 80), null, s.created_at, null
    from public.session_log s
  )
  select f.kind, f.id, f.user_id, pr.member_id, pr.full_name, pr.account_status, f.title, f.body, f.status, f.created_at, f.ref_id
  from feed f
  left join public.profiles pr on pr.user_id = f.user_id
  where public.is_staff()
    and (p_kind is null or f.kind = p_kind)
    and (p_user is null or f.user_id = p_user)
    and (p_kind is not null or p_user is not null or f.kind <> 'login')
  order by f.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.admin_support_threads()
returns table (user_id uuid, full_name text, member_id text, email text, last_message text, last_sender text, last_at timestamptz, unread bigint)
language sql stable security definer set search_path = public as $$
  select s.user_id, p.full_name, p.member_id, case when public.is_admin() then p.email end,
         (select message from public.support_messages x where x.user_id = s.user_id order by created_at desc limit 1),
         (select sender from public.support_messages x where x.user_id = s.user_id order by created_at desc limit 1),
         max(s.created_at),
         count(*) filter (where s.sender = 'user' and s.read_at is null)
  from public.support_messages s
  left join public.profiles p on p.user_id = s.user_id
  where public.is_staff()
  group by s.user_id, p.full_name, p.member_id, p.email
  order by max(s.created_at) desc;
$$;

-- support pings reach moderators too
create or replace function public.on_support_message_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text;
  v_member text;
  v_staff uuid;
begin
  select public.display_name_of(full_name), member_id into v_name, v_member from public.profiles where user_id = new.user_id;

  if new.sender = 'user' then
    for v_staff in
      select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name in ('ADMIN', 'MODERATOR')
    loop
      insert into public.notifications (user_id, type, title, message)
      values (v_staff, 'support', 'Nova poruka podrške — ' || coalesce(v_name, 'korisnik'), left(new.message, 200));
    end loop;

    if (select value from public.moderation_settings where key = 'notify_admin_external') = 'true' then
      perform net.http_post(
        url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/notify-admin',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
        body := jsonb_build_object('kind', 'support', 'user_id', new.user_id, 'name', v_name, 'member_id', v_member, 'message', left(new.message, 500)),
        timeout_milliseconds := 15000
      );
    end if;
  elsif new.sender = 'admin' then
    insert into public.notifications (user_id, type, title, message)
    values (new.user_id, 'support_reply', 'Podrška je odgovorila', left(new.message, 200));
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- the dossier: everything about one account in a single call
-- ---------------------------------------------------------------------------
create or replace function public.admin_user_dossier(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_admin boolean := public.is_admin();
  v jsonb;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select jsonb_build_object(
    'viewer_is_admin', v_admin,
    'profile', (
      select jsonb_build_object(
        'user_id', p.user_id, 'member_id', p.member_id, 'full_name', p.full_name, 'display_name', public.display_name_of(p.full_name),
        'email', case when v_admin then p.email end, 'phone', case when v_admin then p.phone end, 'phone_verified_at', p.phone_verified_at,
        'city', p.city, 'bio', p.bio, 'avatar_url', p.avatar_url, 'account_type', p.account_type, 'account_status', p.account_status,
        'suspended_until', p.suspended_until, 'suspension_reason', p.suspension_reason, 'created_at', p.created_at, 'last_seen_at', p.last_seen_at,
        'onboarding_completed', p.onboarding_completed, 'trades', p.trades, 'verified_trade', p.verified_trade,
        'birth_date', case when v_admin then p.birth_date end,
        'tax_id_masked', case when v_admin and p.tax_id is not null then repeat('•', greatest(length(p.tax_id) - 4, 0)) || right(p.tax_id, 4) end,
        'languages', p.languages, 'transportation', p.transportation, 'education', p.education, 'work_experience', p.work_experience, 'specialties', p.specialties,
        'ai_assessment', p.ai_assessment, 'ai_assessed_at', p.ai_assessed_at
      ) from public.profiles p where p.user_id = p_user_id
    ),
    'auth', (
      select jsonb_build_object(
        'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at,
        'phone', case when v_admin then u.phone end, 'phone_confirmed_at', u.phone_confirmed_at, 'banned_until', u.banned_until,
        'providers', (select coalesce(jsonb_agg(distinct i.provider), '[]'::jsonb) from auth.identities i where i.user_id = u.id)
      ) from auth.users u where u.id = p_user_id
    ),
    'registry', (select jsonb_build_object('deleted_at', r.deleted_at, 'deletion_note', r.deletion_note, 'email', case when v_admin then r.email end, 'full_name', r.full_name, 'created_at', r.created_at) from public.member_registry r where r.user_id = p_user_id),
    'roles', (select coalesce(jsonb_agg(r.name), '[]'::jsonb) from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_user_id),
    'stats', jsonb_build_object(
      'listings', (select count(*) from public.listings where user_id = p_user_id),
      'listings_published', (select count(*) from public.listings where user_id = p_user_id and status = 'published'),
      'listings_completed', (select count(*) from public.listings where user_id = p_user_id and status = 'completed'),
      'listings_cancelled', (select count(*) from public.listings where user_id = p_user_id and status = 'cancelled'),
      'bids', (select count(*) from public.bids where bidder_id = p_user_id),
      'bids_accepted', (select count(*) from public.bids where bidder_id = p_user_id and status = 'accepted'),
      'jobs_completed', (select count(*) from public.bids b join public.listings l on l.id = b.listing_id where b.bidder_id = p_user_id and b.status = 'accepted' and l.status = 'completed'),
      'earnings_30d', coalesce((select public.provider_earnings_30d(p_user_id)), 0),
      'messages_sent', (select count(*) from public.messages where sender_id = p_user_id),
      'conversations', (select count(*) from public.conversations where participant_one = p_user_id or participant_two = p_user_id),
      'reviews_received', (select count(*) from public.reviews where reviewee_id = p_user_id),
      'avg_rating', (select round(avg(rating)::numeric, 2) from public.reviews where reviewee_id = p_user_id),
      'reviews_given', (select count(*) from public.reviews where reviewer_id = p_user_id),
      'strikes_30d', (select count(*) from public.moderation_events where user_id = p_user_id and action in ('masked', 'removed') and not dismissed and created_at > now() - interval '30 days'),
      'strikes_total', (select count(*) from public.moderation_events where user_id = p_user_id and action in ('masked', 'removed') and not dismissed),
      'suspensions', (select count(*) from public.moderation_events where user_id = p_user_id and action = 'suspended'),
      'support_messages', (select count(*) from public.support_messages where user_id = p_user_id and sender = 'user'),
      'reports_made', (select count(*) from public.reports where reporter_id = p_user_id),
      'reports_against', (select count(*) from public.reports r where r.target_id = p_user_id or r.target_id in (select id from public.listings where user_id = p_user_id)),
      'logins', (select count(*) from public.session_log where user_id = p_user_id),
      'distinct_ips', (select count(distinct ip) from public.session_log where user_id = p_user_id),
      'portfolio', (select count(*) from public.portfolio_items where user_id = p_user_id)
    ),
    'trust', (select to_jsonb(t) from public.trust_summary(p_user_id) t),
    'badges', (
      select coalesce(jsonb_agg(jsonb_build_object('code', b.code, 'label', b.label, 'description', b.description, 'icon', b.icon, 'kind', b.kind, 'color', b.color, 'awarded_at', ub.awarded_at, 'manual', ub.manual, 'note', ub.note) order by b.sort_order, ub.awarded_at desc), '[]'::jsonb)
      from public.user_badges ub join public.badges b on b.id = ub.badge_id where ub.user_id = p_user_id
    ),
    'verifications', (
      select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'kind', v.kind, 'licence_type', v.licence_type, 'trade', v.trade, 'status', v.status, 'document_url', case when v_admin then v.document_url end, 'created_at', v.created_at) order by v.created_at desc), '[]'::jsonb)
      from public.verification_requests v where v.user_id = p_user_id
    ),
    'moderation', (
      select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'action', e.action, 'source_table', e.source_table, 'kinds', e.kinds, 'fields', e.fields, 'snippet', e.snippet, 'dismissed', e.dismissed, 'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb)
      from (select * from public.moderation_events where user_id = p_user_id order by created_at desc limit 60) e
    ),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'ip', s.ip, 'user_agent', s.user_agent, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from (select * from public.session_log where user_id = p_user_id order by created_at desc limit 50) s
    ),
    'active_sessions', (
      select coalesce(jsonb_agg(jsonb_build_object('ip', host(s.ip), 'user_agent', s.user_agent, 'created_at', s.created_at, 'refreshed_at', s.refreshed_at) order by s.refreshed_at desc nulls last), '[]'::jsonb)
      from auth.sessions s where s.user_id = p_user_id and (s.not_after is null or s.not_after > now())
    ),
    'shared_ips', (
      select coalesce(jsonb_agg(jsonb_build_object('ip', x.ip, 'user_id', x.user_id, 'full_name', pp.full_name, 'member_id', pp.member_id, 'account_status', pp.account_status)), '[]'::jsonb)
      from (
        select distinct o.ip, o.user_id
        from public.session_log o
        where o.user_id <> p_user_id and o.ip in (select ip from public.session_log where user_id = p_user_id and ip is not null)
        limit 20
      ) x left join public.profiles pp on pp.user_id = x.user_id
    ),
    'conversations', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'listing_id', c.listing_id, 'listing_title', l.title,
        'partner_id', partner.user_id, 'partner_name', partner.full_name, 'partner_member', partner.member_id,
        'message_count', (select count(*) from public.messages m where m.conversation_id = c.id),
        'sent_by_user', (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id = p_user_id),
        'last_at', (select max(m.created_at) from public.messages m where m.conversation_id = c.id),
        'last_message', case when v_admin then (select m.content from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) end
      ) order by coalesce((select max(m.created_at) from public.messages m where m.conversation_id = c.id), c.created_at) desc), '[]'::jsonb)
      from public.conversations c
      left join public.listings l on l.id = c.listing_id
      left join public.profiles partner on partner.user_id = case when c.participant_one = p_user_id then c.participant_two else c.participant_one end
      where c.participant_one = p_user_id or c.participant_two = p_user_id
    ),
    'listings', (
      select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'status', l.status, 'category', l.category, 'location', l.location, 'price', l.price, 'created_at', l.created_at) order by l.created_at desc), '[]'::jsonb)
      from (select * from public.listings where user_id = p_user_id order by created_at desc limit 40) l
    ),
    'bids', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'amount', b.amount, 'status', b.status, 'message', left(b.message, 160), 'listing_id', b.listing_id, 'listing_title', l.title, 'created_at', b.created_at) order by b.created_at desc), '[]'::jsonb)
      from (select * from public.bids where bidder_id = p_user_id order by created_at desc limit 40) b left join public.listings l on l.id = b.listing_id
    ),
    'reviews_received', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment, 'from_name', public.display_name_of(rp.full_name), 'from_id', r.reviewer_id, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reviews where reviewee_id = p_user_id order by created_at desc limit 30) r left join public.profiles rp on rp.user_id = r.reviewer_id
    ),
    'reviews_given', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment, 'to_name', public.display_name_of(rp.full_name), 'to_id', r.reviewee_id, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reviews where reviewer_id = p_user_id order by created_at desc limit 30) r left join public.profiles rp on rp.user_id = r.reviewee_id
    ),
    'support', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'sender', s.sender, 'message', s.message, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from (select * from public.support_messages where user_id = p_user_id order by created_at desc limit 40) s
    ),
    'reports_made', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason, 'status', r.status, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reports where reporter_id = p_user_id order by created_at desc limit 30) r
    ),
    'reports_against', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type, 'target_id', r.target_id, 'reason', r.reason, 'status', r.status, 'created_at', r.created_at, 'reporter_name', public.display_name_of(rp.full_name)) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.reports x where x.target_id = p_user_id or x.target_id in (select id from public.listings where user_id = p_user_id) order by created_at desc limit 30) r
      left join public.profiles rp on rp.user_id = r.reporter_id
    ),
    'payout', (
      select case when v_admin then jsonb_build_object('holder_name', a.holder_name, 'bank_name', a.bank_name, 'iban_masked', left(a.iban, 4) || ' •••• •••• ' || right(a.iban, 4), 'billing_city', a.billing_city, 'created_at', a.created_at) end
      from public.payout_accounts a where a.user_id = p_user_id
    ),
    'notes', (
      select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'author_id', n.author_id, 'author_name', ap.full_name, 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
      from public.staff_notes n left join public.profiles ap on ap.user_id = n.author_id where n.user_id = p_user_id
    ),
    'staff_actions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'action', a.action, 'details', a.details, 'actor_id', a.actor_id, 'actor_name', ap.full_name, 'created_at', a.created_at) order by a.created_at desc), '[]'::jsonb)
      from (select * from public.staff_actions where target_user_id = p_user_id order by created_at desc limit 40) a left join public.profiles ap on ap.user_id = a.actor_id
    )
  ) into v;
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: what moderators may touch directly
-- ---------------------------------------------------------------------------
drop policy if exists moderation_events_staff_select on public.moderation_events;
create policy moderation_events_staff_select on public.moderation_events for select using (public.is_staff());
drop policy if exists moderation_events_staff_update on public.moderation_events;
create policy moderation_events_staff_update on public.moderation_events for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists moderation_queue_staff_select on public.moderation_queue;
create policy moderation_queue_staff_select on public.moderation_queue for select using (public.is_staff());
drop policy if exists reports_staff_select on public.reports;
create policy reports_staff_select on public.reports for select using (public.is_staff());
drop policy if exists reports_staff_update on public.reports;
create policy reports_staff_update on public.reports for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages for select using (auth.uid() = user_id or public.is_staff());
drop policy if exists support_messages_admin_insert on public.support_messages;
create policy support_messages_admin_insert on public.support_messages for insert with check (public.is_staff() and sender = 'admin');
drop policy if exists support_messages_admin_update on public.support_messages;
create policy support_messages_admin_update on public.support_messages for update using (public.is_staff()) with check (public.is_staff());

-- panel KPIs
create or replace function public.staff_overview()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_staff() then jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'online_now', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'suspended', (select count(*) from public.profiles where account_status = 'suspended'),
    'listings_open', (select count(*) from public.listings where status = 'published'),
    'listings_completed', (select count(*) from public.listings where status = 'completed'),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'support_unread', (select count(*) from public.support_messages where sender = 'user' and read_at is null),
    'strikes_24h', (select count(*) from public.moderation_events where action in ('masked', 'removed') and not dismissed and created_at > now() - interval '24 hours'),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'logins_24h', (select count(*) from public.session_log where created_at > now() - interval '24 hours')
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- owner guard (migration staff_console_owner_guard): the first admin ever
-- granted is the owner — nobody can remove that role or suspend that account.
-- admin_list_staff() also returns is_owner. my_profile_bundle / public_profile_bundle
-- badge objects now carry kind + color (migration bundles_badge_kind_color).
-- ---------------------------------------------------------------------------
create or replace function public.owner_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id
  where r.name = 'ADMIN' order by ur.created_at, ur.user_id limit 1;
$$;
-- admin_set_role: `if not p_grant and p_role = 'ADMIN' and p_user_id = public.owner_user_id() then raise exception 'OWNER'`
-- staff_guard_target: `if p_user_id = public.owner_user_id() then raise exception 'OWNER'`

-- hardening (migration staff_console_hardening): staff RPCs revoked from anon,
-- owner_user_id() + log_auth_session() revoked from everyone (internal only),
-- duration_label() gets a fixed search_path.

-- ---------- client error log (beta crash reports) ----------
-- create table public.client_errors (id uuid pk, user_id uuid, message text, stack text, url text, user_agent text, created_at timestamptz);
-- RLS: staff read only; writes only through public.log_client_error(p_message, p_stack, p_url, p_user_agent)
-- (security definer, 30 rows/minute cap, granted to anon + authenticated). Called from src/utils/errorReporter.js.
