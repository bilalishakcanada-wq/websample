-- ============================================================
-- 1. Admins can see and act on everything
-- ============================================================
drop policy if exists messages_admin_manage on public.messages;
create policy messages_admin_manage on public.messages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists conversations_admin_manage on public.conversations;
create policy conversations_admin_manage on public.conversations for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists reviews_admin_manage on public.reviews;
create policy reviews_admin_manage on public.reviews for all using (public.is_admin()) with check (public.is_admin());

-- live feed: listings, reviews and profiles join the realtime publication
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'listings') then
    alter publication supabase_realtime add table public.listings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'reviews') then
    alter publication supabase_realtime add table public.reviews;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'moderation_events') then
    alter publication supabase_realtime add table public.moderation_events;
  end if;
end $$;

-- ============================================================
-- 2. AI trust assessment (admin-only column)
-- ============================================================
alter table public.profiles add column if not exists ai_assessment jsonb;
alter table public.profiles add column if not exists ai_assessed_at timestamptz;
insert into public.moderation_settings (key, value) values ('ai_auto_suspend', 'false') on conflict (key) do nothing;

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
    new.ai_assessment := old.ai_assessment;
    new.ai_assessed_at := old.ai_assessed_at;
    if new.onboarding_completed and not public.is_valid_full_name(new.full_name) then
      raise exception 'FULL_NAME_INVALID: full name must contain a first and a last name' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 3. Unified activity feed for the console
-- ============================================================
create or replace function public.admin_activity_feed(p_limit integer default 100, p_kind text default null, p_user uuid default null)
returns table (
  kind text, id uuid, user_id uuid, member_id text, full_name text, account_status text,
  title text, body text, status text, created_at timestamptz, ref_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
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
  )
  select f.kind, f.id, f.user_id, pr.member_id, pr.full_name, pr.account_status, f.title, f.body, f.status, f.created_at, f.ref_id
  from feed f
  left join public.profiles pr on pr.user_id = f.user_id
  where public.is_admin()
    and (p_kind is null or f.kind = p_kind)
    and (p_user is null or f.user_id = p_user)
  order by f.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;
revoke execute on function public.admin_activity_feed(integer, text, uuid) from public, anon;
grant execute on function public.admin_activity_feed(integer, text, uuid) to authenticated;

-- ============================================================
-- 4. Admin actions (all logged as moderation events)
-- ============================================================
create or replace function public.admin_suspend(p_user_id uuid, p_days integer default null, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := coalesce(nullif(btrim(p_reason), ''), case when p_days is null then 'Trajna suspenzija (administrator).' else 'Suspenzija ' || p_days || ' dana (administrator).' end);
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  perform set_config('poso.system_write', '1', true);
  update public.profiles
  set account_status = 'suspended',
      suspended_until = case when p_days is null then null else now() + make_interval(days => p_days) end,
      suspension_reason = v_reason
  where user_id = p_user_id;
  perform set_config('poso.system_write', '', true);
  insert into public.moderation_events (user_id, source_table, snippet, action, reviewed_by, reviewed_at)
  values (p_user_id, 'profiles', v_reason, 'suspended', auth.uid(), now());
end;
$$;
revoke execute on function public.admin_suspend(uuid, integer, text) from public, anon;
grant execute on function public.admin_suspend(uuid, integer, text) to authenticated;

-- Redact a message / bid / review / listing without deleting history.
create or replace function public.admin_redact(p_kind text, p_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_text constant text := '[uklonjeno od strane Poso.ba tima]';
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_kind = 'message' then
    update public.messages set content = v_text where id = p_id returning sender_id into v_user;
  elsif p_kind = 'bid' then
    update public.bids set message = v_text, status = case when status = 'pending' then 'rejected' else status end where id = p_id returning bidder_id into v_user;
  elsif p_kind = 'review' then
    delete from public.reviews where id = p_id returning reviewer_id into v_user;
  elsif p_kind = 'listing' then
    update public.listings set status = 'archived' where id = p_id returning user_id into v_user;
  else
    raise exception 'UNKNOWN_KIND';
  end if;
  if v_user is not null then
    insert into public.moderation_events (user_id, source_table, source_id, snippet, action, reviewed_by, reviewed_at)
    values (v_user, p_kind, p_id, coalesce(nullif(btrim(p_note), ''), 'Uklonio administrator'), 'removed', auth.uid(), now());
  end if;
end;
$$;
revoke execute on function public.admin_redact(text, uuid, text) from public, anon;
grant execute on function public.admin_redact(text, uuid, text) to authenticated;

-- ============================================================
-- 5. What the trust agent reads about one user (service role / admin)
-- ============================================================
create or replace function public.trust_agent_dossier(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (select jsonb_build_object('member_id', p.member_id, 'full_name', p.full_name, 'city', p.city, 'bio', p.bio, 'account_type', p.account_type,
                  'trades', p.trades, 'verified_trade', p.verified_trade, 'created_at', p.created_at, 'account_status', p.account_status,
                  'education', p.education, 'work_experience', p.work_experience, 'specialties', p.specialties, 'has_avatar', coalesce(p.avatar_url, '') <> '')
                from public.profiles p where p.user_id = p_user_id),
    'trust', (select to_jsonb(t) from public.trust_summary(p_user_id) t),
    'listings', coalesce((select jsonb_agg(jsonb_build_object('title', l.title, 'description', left(l.description, 300), 'category', l.category, 'price', l.price, 'status', l.status, 'created_at', l.created_at) order by l.created_at desc)
                 from (select * from public.listings where user_id = p_user_id order by created_at desc limit 15) l), '[]'),
    'bids', coalesce((select jsonb_agg(jsonb_build_object('amount', b.amount, 'message', left(b.message, 300), 'status', b.status, 'created_at', b.created_at) order by b.created_at desc)
                 from (select * from public.bids where bidder_id = p_user_id order by created_at desc limit 20) b), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('content', left(m.content, 300), 'created_at', m.created_at) order by m.created_at desc)
                 from (select * from public.messages where sender_id = p_user_id order by created_at desc limit 40) m), '[]'),
    'reviews_received', coalesce((select jsonb_agg(jsonb_build_object('rating', r.rating, 'comment', left(r.comment, 200), 'reviewer_id', r.reviewer_id, 'created_at', r.created_at))
                 from public.reviews r where r.reviewee_id = p_user_id), '[]'),
    'reviews_given', coalesce((select jsonb_agg(jsonb_build_object('rating', r.rating, 'comment', left(r.comment, 200), 'reviewee_id', r.reviewee_id, 'created_at', r.created_at))
                 from public.reviews r where r.reviewer_id = p_user_id), '[]'),
    'moderation_events', coalesce((select jsonb_agg(jsonb_build_object('action', e.action, 'kinds', e.kinds, 'snippet', e.snippet, 'created_at', e.created_at) order by e.created_at desc)
                 from (select * from public.moderation_events where user_id = p_user_id order by created_at desc limit 20) e), '[]'),
    'reports_against', coalesce((select jsonb_agg(jsonb_build_object('reason', rp.reason, 'status', rp.status, 'created_at', rp.created_at))
                 from public.reports rp where rp.target_id = p_user_id), '[]'),
    'reports_made', (select count(*) from public.reports rp where rp.reporter_id = p_user_id),
    'message_partners', (select count(distinct receiver_id) from public.messages where sender_id = p_user_id),
    'sessions_hint', (select jsonb_build_object('last_seen_at', p.last_seen_at) from public.profiles p where p.user_id = p_user_id)
  )
  where public.is_admin() or auth.role() = 'service_role' or auth.uid() is null;
$$;
revoke execute on function public.trust_agent_dossier(uuid) from public, anon;
grant execute on function public.trust_agent_dossier(uuid) to authenticated;

-- profiles the sweep should look at: never assessed, or active since the last assessment
create or replace function public.trust_agent_queue(p_limit integer default 10)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id
  from public.profiles p
  where p.account_status = 'active'
    and (
      p.ai_assessed_at is null
      or exists (select 1 from public.listings l where l.user_id = p.user_id and l.created_at > p.ai_assessed_at)
      or exists (select 1 from public.bids b where b.bidder_id = p.user_id and b.created_at > p.ai_assessed_at)
      or exists (select 1 from public.messages m where m.sender_id = p.user_id and m.created_at > p.ai_assessed_at)
      or exists (select 1 from public.moderation_events e where e.user_id = p.user_id and e.created_at > p.ai_assessed_at)
      or exists (select 1 from public.reports r where r.target_id = p.user_id and r.created_at > p.ai_assessed_at)
    )
  order by p.ai_assessed_at nulls first, p.last_seen_at desc nulls last
  limit greatest(1, least(p_limit, 50));
$$;
revoke execute on function public.trust_agent_queue(integer) from public, anon, authenticated;

-- 30-minute AI sweep (only fires when there is something to assess)
select cron.unschedule(jobid) from cron.job where jobname = 'trust-agent-sweep';
select cron.schedule('trust-agent-sweep', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/trust-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')
    ),
    body := '{"mode":"sweep","limit":10}'::jsonb,
    timeout_milliseconds := 120000
  )
  where exists (select 1 from public.trust_agent_queue(1));
$$);;
