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

create or replace function public.staff_role()
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then 'admin'
    when public.is_moderator() then 'moderator'
    else null
  end;
$$;

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

insert into public.session_log (user_id, session_id, ip, user_agent, created_at)
select s.user_id, s.id, host(s.ip), left(s.user_agent, 400), s.created_at
from auth.sessions s
where not exists (select 1 from public.session_log l where l.session_id = s.id);

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
$$;;
