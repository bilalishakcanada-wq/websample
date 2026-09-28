-- ============================================================
-- 1. Tables
-- ============================================================
create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  source_table text not null,
  source_id uuid,
  fields text[] not null default '{}',
  kinds text[] not null default '{}',
  snippet text,                      -- always the masked text, never the raw contact
  action text not null check (action in ('masked','removed','flagged','suspended','lifted')),
  dismissed boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists moderation_events_user_idx on public.moderation_events (user_id, created_at desc);
alter table public.moderation_events enable row level security;
drop policy if exists moderation_events_admin on public.moderation_events;
create policy moderation_events_admin on public.moderation_events for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists moderation_events_own_read on public.moderation_events;
create policy moderation_events_own_read on public.moderation_events for select using (auth.uid() = user_id);

create table if not exists public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null check (kind in ('avatar','portfolio')),
  media_url text not null,
  source_id uuid,
  status text not null default 'pending' check (status in ('pending','clean','flagged','error','unconfigured')),
  attempts int not null default 0,
  result jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists moderation_queue_status_idx on public.moderation_queue (status, created_at);
alter table public.moderation_queue enable row level security;
drop policy if exists moderation_queue_admin on public.moderation_queue;
create policy moderation_queue_admin on public.moderation_queue for all using (public.is_admin()) with check (public.is_admin());

create table if not exists public.moderation_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.moderation_settings enable row level security;
drop policy if exists moderation_settings_admin on public.moderation_settings;
create policy moderation_settings_admin on public.moderation_settings for all using (public.is_admin()) with check (public.is_admin());
insert into public.moderation_settings (key, value)
values ('sweep_key', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ============================================================
-- 2. Suspension helpers
-- ============================================================
create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and account_status = 'suspended'
      and (suspended_until is null or suspended_until > now())
  );
$$;
grant execute on function public.is_suspended() to anon, authenticated;

-- System writes (moderation, cron) may change protected profile fields.
create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('poso.system_write', true), '') <> '1'
     and auth.role() is distinct from 'service_role'
     and not public.is_admin() then
    new.subscription_status := old.subscription_status;
    new.account_status := old.account_status;
    new.suspended_until := old.suspended_until;
    new.suspension_reason := old.suspension_reason;
    new.member_id := old.member_id;
    new.verified_trade := old.verified_trade;
    new.created_at := old.created_at;
    if new.onboarding_completed and not public.is_valid_full_name(new.full_name) then
      raise exception 'FULL_NAME_INVALID: full name must contain a first and a last name' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- Escalating strikes: 3 in 30 days -> 7 days, 5 -> 30 days, 7 -> permanent.
create or replace function public.apply_moderation_strike(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_strikes int;
  v_until timestamptz;
  v_reason text;
  v_current_until timestamptz;
  v_current_status text;
begin
  select count(*) into v_strikes
  from public.moderation_events
  where user_id = p_user_id
    and action in ('masked','removed')
    and not dismissed
    and created_at > now() - interval '30 days';

  if v_strikes < 3 then return; end if;

  if v_strikes >= 7 then
    v_until := null;
    v_reason := 'Trajna suspenzija: ' || v_strikes || ' kršenja Pravila #1 u 30 dana.';
  elsif v_strikes >= 5 then
    v_until := now() + interval '30 days';
    v_reason := 'Suspenzija 30 dana: ' || v_strikes || ' kršenja Pravila #1 u 30 dana.';
  else
    v_until := now() + interval '7 days';
    v_reason := 'Suspenzija 7 dana: ' || v_strikes || ' kršenja Pravila #1 u 30 dana.';
  end if;

  select account_status, suspended_until into v_current_status, v_current_until
  from public.profiles where user_id = p_user_id;

  -- never shorten an existing suspension
  if v_current_status = 'suspended' and (v_current_until is null or (v_until is not null and v_current_until >= v_until)) then
    return;
  end if;

  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'suspended', suspended_until = v_until, suspension_reason = v_reason
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);

  insert into public.moderation_events (user_id, source_table, fields, kinds, snippet, action)
  values (p_user_id, 'profiles', '{}', '{}', v_reason, 'suspended');
end;
$$;
revoke execute on function public.apply_moderation_strike(uuid) from public, anon, authenticated;

create or replace function public.lift_expired_suspensions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  perform set_config('poso.system_write', '1', true);
  with lifted as (
    update public.profiles
    set account_status = 'active', suspended_until = null, suspension_reason = null
    where account_status = 'suspended' and suspended_until is not null and suspended_until <= now()
    returning user_id
  )
  insert into public.moderation_events (user_id, source_table, snippet, action)
  select user_id, 'profiles', 'Suspenzija istekla — nalog ponovo aktivan.', 'lifted' from lifted;
  get diagnostics v_count = row_count;
  perform set_config('poso.system_write', '', true);
  return v_count;
end;
$$;
revoke execute on function public.lift_expired_suspensions() from public, anon, authenticated;

-- Admin action: lift a suspension by hand (or dismiss a false positive).
create or replace function public.admin_lift_suspension(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'active', suspended_until = null, suspension_reason = null
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);
  insert into public.moderation_events (user_id, source_table, snippet, action, reviewed_by, reviewed_at)
  values (p_user_id, 'profiles', 'Suspenziju ukinuo administrator.', 'lifted', auth.uid(), now());
end;
$$;
revoke execute on function public.admin_lift_suspension(uuid) from public, anon;
grant execute on function public.admin_lift_suspension(uuid) to authenticated;

-- ============================================================
-- 3. Write-time moderation on every user-written text field
-- ============================================================
create or replace function public.conversation_contacts_allowed(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when c.listing_id is null then false
      else exists (
        select 1 from public.bids b
        where b.listing_id = c.listing_id
          and b.status = 'accepted'
          and b.bidder_id in (c.participant_one, c.participant_two)
      )
    end
    from public.conversations c where c.id = p_conversation_id
  ), false);
$$;
grant execute on function public.conversation_contacts_allowed(uuid) to authenticated;

-- Generic trigger: TG_ARGV[0] = user column, TG_ARGV[1..] = text columns to scan.
create or replace function public.moderate_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb := to_jsonb(new);
  old_rec jsonb := case when TG_OP = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  col text;
  scan jsonb;
  all_kinds text[] := '{}';
  hit_fields text[] := '{}';
  snippet text := '';
  v_user uuid;
  i int;
begin
  v_user := (rec->>TG_ARGV[0])::uuid;

  -- Messages inside an accepted-bid conversation may share contact details.
  if TG_TABLE_NAME = 'messages' and public.conversation_contacts_allowed((rec->>'conversation_id')::uuid) then
    return new;
  end if;

  for i in 1..(TG_NARGS - 1) loop
    col := TG_ARGV[i];
    if rec->>col is null or rec->>col = '' then continue; end if;
    if TG_OP = 'UPDATE' and (old_rec->>col) is not distinct from (rec->>col) then continue; end if;

    scan := public.moderation_scan(rec->>col);
    if not (scan->>'clean')::boolean then
      all_kinds := all_kinds || array(select jsonb_array_elements_text(scan->'kinds'));
      hit_fields := array_append(hit_fields, col);
      rec := jsonb_set(rec, array[col], to_jsonb(scan->>'masked'));
      snippet := snippet || case when snippet = '' then '' else ' | ' end || left(scan->>'masked', 160);
    end if;
  end loop;

  if cardinality(hit_fields) > 0 then
    new := jsonb_populate_record(new, rec);
    insert into public.moderation_events (user_id, source_table, source_id, fields, kinds, snippet, action)
    values (
      v_user, TG_TABLE_NAME, nullif(rec->>'id', '')::uuid, hit_fields,
      array(select distinct k from unnest(all_kinds) k order by k), snippet, 'masked'
    );
    perform public.apply_moderation_strike(v_user);
  end if;
  return new;
end;
$$;
revoke execute on function public.moderate_content() from public, anon, authenticated;

drop trigger if exists check_message_contact_trigger on public.messages;
drop function if exists public.check_message_contact_info();

drop trigger if exists moderate_profiles on public.profiles;
create trigger moderate_profiles before insert or update of full_name, bio on public.profiles
  for each row execute function public.moderate_content('user_id', 'full_name', 'bio');
drop trigger if exists moderate_listings on public.listings;
create trigger moderate_listings before insert or update of title, description on public.listings
  for each row execute function public.moderate_content('user_id', 'title', 'description');
drop trigger if exists moderate_bids on public.bids;
create trigger moderate_bids before insert or update of message on public.bids
  for each row execute function public.moderate_content('bidder_id', 'message');
drop trigger if exists moderate_reviews on public.reviews;
create trigger moderate_reviews before insert or update of comment on public.reviews
  for each row execute function public.moderate_content('reviewer_id', 'comment');
drop trigger if exists moderate_portfolio on public.portfolio_items;
create trigger moderate_portfolio before insert or update of caption on public.portfolio_items
  for each row execute function public.moderate_content('user_id', 'caption');
drop trigger if exists moderate_messages on public.messages;
create trigger moderate_messages before insert or update of content on public.messages
  for each row execute function public.moderate_content('sender_id', 'content');

-- Suspended accounts cannot post, bid, message, review or upload.
alter policy listings_insert_own on public.listings
  with check ((auth.uid() = user_id) and (status <> 'published' or public.is_email_verified()) and not public.is_suspended());
alter policy listings_update_own on public.listings
  with check ((auth.uid() = user_id) and (status <> 'published' or public.is_email_verified()) and not public.is_suspended());
alter policy bids_bidder_manage on public.bids
  with check ((auth.uid() = bidder_id) and not public.is_suspended());
alter policy messages_manage_own on public.messages
  with check ((auth.uid() = sender_id) and not public.is_suspended());
alter policy reviews_manage_own on public.reviews
  with check ((auth.uid() = reviewer_id) and not public.is_suspended());
alter policy portfolio_manage_own on public.portfolio_items
  with check ((auth.uid() = user_id) and not public.is_suspended());

-- ============================================================
-- 4. Media (profile picture / portfolio) goes to the AI queue
-- ============================================================
create or replace function public.enqueue_media_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'profiles' then
    if coalesce(new.avatar_url, '') <> '' and new.avatar_url is distinct from old.avatar_url then
      insert into public.moderation_queue (user_id, kind, media_url, source_id)
      values (new.user_id, 'avatar', new.avatar_url, new.id);
    end if;
  elsif TG_TABLE_NAME = 'portfolio_items' then
    if coalesce(new.media_type, 'image') <> 'video' and coalesce(new.media_url, '') <> '' then
      insert into public.moderation_queue (user_id, kind, media_url, source_id)
      values (new.user_id, 'portfolio', new.media_url, new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.enqueue_media_moderation() from public, anon, authenticated;
drop trigger if exists enqueue_avatar_moderation on public.profiles;
create trigger enqueue_avatar_moderation after update of avatar_url on public.profiles
  for each row execute function public.enqueue_media_moderation();
drop trigger if exists enqueue_portfolio_moderation on public.portfolio_items;
create trigger enqueue_portfolio_moderation after insert on public.portfolio_items
  for each row execute function public.enqueue_media_moderation();

-- ============================================================
-- 5. Periodic re-scan of stored text with the current rules
-- ============================================================
create or replace function public.moderation_rescan()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  scan_name jsonb;
  scan_bio jsonb;
  scan_title jsonb;
  scan_desc jsonb;
  v_count int := 0;
begin
  for r in select id, user_id, full_name, bio from public.profiles where account_status = 'active' loop
    scan_name := public.moderation_scan(r.full_name);
    scan_bio := public.moderation_scan(r.bio);
    if not (scan_name->>'clean')::boolean or not (scan_bio->>'clean')::boolean then
      update public.profiles set full_name = scan_name->>'masked', bio = scan_bio->>'masked' where id = r.id;
      insert into public.moderation_events (user_id, source_table, source_id, fields, kinds, snippet, action)
      values (r.user_id, 'profiles', r.id,
              array_remove(array[case when not (scan_name->>'clean')::boolean then 'full_name' end, case when not (scan_bio->>'clean')::boolean then 'bio' end], null),
              array(select distinct k from jsonb_array_elements_text(coalesce(scan_name->'kinds','[]'::jsonb) || coalesce(scan_bio->'kinds','[]'::jsonb)) k),
              left(coalesce(scan_bio->>'masked', ''), 160), 'masked');
      perform public.apply_moderation_strike(r.user_id);
      v_count := v_count + 1;
    end if;
  end loop;

  for r in select id, user_id, title, description from public.listings where status in ('published','draft','paused') loop
    scan_title := public.moderation_scan(r.title);
    scan_desc := public.moderation_scan(r.description);
    if not (scan_title->>'clean')::boolean or not (scan_desc->>'clean')::boolean then
      update public.listings set title = scan_title->>'masked', description = scan_desc->>'masked' where id = r.id;
      insert into public.moderation_events (user_id, source_table, source_id, fields, kinds, snippet, action)
      values (r.user_id, 'listings', r.id,
              array_remove(array[case when not (scan_title->>'clean')::boolean then 'title' end, case when not (scan_desc->>'clean')::boolean then 'description' end], null),
              array(select distinct k from jsonb_array_elements_text(coalesce(scan_title->'kinds','[]'::jsonb) || coalesce(scan_desc->'kinds','[]'::jsonb)) k),
              left(coalesce(scan_desc->>'masked', ''), 160), 'masked');
      perform public.apply_moderation_strike(r.user_id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.moderation_rescan() from public, anon, authenticated;

-- ============================================================
-- 6. Schedules: hourly suspension lift, nightly rescan, 5-minute AI media sweep
-- ============================================================
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname in ('moderation-lift-suspensions','moderation-rescan-nightly','moderation-media-sweep');
select cron.schedule('moderation-lift-suspensions', '15 * * * *', $$select public.lift_expired_suspensions();$$);
select cron.schedule('moderation-rescan-nightly', '30 3 * * *', $$select public.moderation_rescan();$$);
select cron.schedule('moderation-media-sweep', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/moderate-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')
    ),
    body := '{"mode":"sweep"}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from public.moderation_queue where status in ('pending','unconfigured') and attempts < 5);
$$);;
