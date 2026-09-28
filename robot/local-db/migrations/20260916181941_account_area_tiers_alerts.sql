-- ============================================================
-- Account area: extra profile fields, tiers, payments view, task alerts
-- ============================================================
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists languages text[] not null default '{}';
alter table public.profiles add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

-- languages join the moderation trigger
drop trigger if exists moderate_profiles on public.profiles;
create trigger moderate_profiles before insert or update of full_name, bio, education, work_experience, specialties, transportation, languages on public.profiles
  for each row execute function public.moderate_content('user_id', 'full_name', 'bio', 'education', 'work_experience', 'specialties', 'languages');

-- public view gets languages
drop view if exists public.public_profiles;
create view public.public_profiles with (security_invoker = false) as
  select user_id, public.display_name_of(full_name) as display_name, city, bio, avatar_url, created_at,
         account_type, trades, verified_trade, last_seen_at, education, work_experience, specialties, transportation, languages
  from public.profiles where account_status = 'active';
grant select on public.public_profiles to anon, authenticated;

-- ------------------------------------------------------------
-- Tiers: based on agreed value of jobs completed in the last 30 days
-- ------------------------------------------------------------
create table if not exists public.tier_levels (
  code text primary key,
  rank int not null,
  label text not null,
  min_earned numeric not null,
  perks text[] not null default '{}',
  rank_bonus numeric not null default 0
);
insert into public.tier_levels (code, rank, label, min_earned, perks, rank_bonus) values
  ('bronze',   1, 'Bronzani nivo',   0,    array['Svi osnovni alati platforme', 'Standardna pozicija u rezultatima'], 0),
  ('silver',   2, 'Srebrni nivo',    600,  array['Bolja pozicija u pretrazi (+5)', 'Srebrna oznaka na profilu'], 5),
  ('gold',     3, 'Zlatni nivo',     1800, array['Prioritet u pretrazi (+12)', 'Zlatna oznaka na profilu', 'Prioritetna podrška'], 12),
  ('platinum', 4, 'Platinasti nivo', 3600, array['Najviši prioritet u pretrazi (+20)', 'Platinasta oznaka na profilu', 'Prioritetna podrška', 'Rani pristup novim funkcijama'], 20)
on conflict (code) do update set rank = excluded.rank, label = excluded.label, min_earned = excluded.min_earned, perks = excluded.perks, rank_bonus = excluded.rank_bonus;
alter table public.tier_levels enable row level security;
drop policy if exists tier_levels_read on public.tier_levels;
create policy tier_levels_read on public.tier_levels for select using (true);

-- agreed value of completed jobs where the user was the accepted provider, last 30 days
create or replace function public.earned_last_30(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(b.amount), 0)
  from public.bids b join public.listings l on l.id = b.listing_id
  where b.bidder_id = p_user_id and b.status = 'accepted' and l.status = 'completed'
    and l.completed_at > now() - interval '30 days';
$$;
revoke execute on function public.earned_last_30(uuid) from public, anon, authenticated;

create or replace function public.my_tier()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with e as (select public.earned_last_30(auth.uid()) as earned),
  cur as (select t.* from public.tier_levels t, e where t.min_earned <= e.earned order by t.rank desc limit 1),
  nxt as (select t.* from public.tier_levels t, cur where t.rank = cur.rank + 1)
  select jsonb_build_object(
    'earned', (select earned from e),
    'current', (select to_jsonb(cur) from cur),
    'next', (select to_jsonb(nxt) from nxt),
    'levels', (select jsonb_agg(to_jsonb(t) order by t.rank) from public.tier_levels t)
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.my_tier() from public, anon;
grant execute on function public.my_tier() to authenticated;

-- ------------------------------------------------------------
-- Payments view (agreed amounts; in-platform payments come later)
-- ------------------------------------------------------------
create or replace function public.my_payments()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'earned', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'amount', b.amount, 'completed_at', l.completed_at, 'status', l.status,
                                          'other', public.display_name_of(p.full_name)) order by l.completed_at desc nulls last)
      from public.bids b join public.listings l on l.id = b.listing_id left join public.profiles p on p.user_id = l.user_id
      where b.bidder_id = auth.uid() and b.status = 'accepted' and l.status in ('completed', 'published')
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'title', l.title, 'amount', b.amount, 'completed_at', l.completed_at, 'status', l.status,
                                          'other', public.display_name_of(p.full_name)) order by l.completed_at desc nulls last)
      from public.listings l join public.bids b on b.listing_id = l.id and b.status = 'accepted' left join public.profiles p on p.user_id = b.bidder_id
      where l.user_id = auth.uid() and l.status in ('completed', 'published')
    ), '[]'::jsonb),
    'net_earned', (select coalesce(sum(b.amount), 0) from public.bids b join public.listings l on l.id = b.listing_id
                   where b.bidder_id = auth.uid() and b.status = 'accepted' and l.status = 'completed'),
    'net_paid', (select coalesce(sum(b.amount), 0) from public.listings l join public.bids b on b.listing_id = l.id and b.status = 'accepted'
                 where l.user_id = auth.uid() and l.status = 'completed')
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.my_payments() from public, anon;
grant execute on function public.my_payments() to authenticated;

-- ------------------------------------------------------------
-- Task alerts (keyword / category / city)
-- ------------------------------------------------------------
create table if not exists public.task_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text,
  category text,
  city text,
  created_at timestamptz not null default now()
);
alter table public.task_alerts enable row level security;
drop policy if exists task_alerts_own on public.task_alerts;
create policy task_alerts_own on public.task_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- new published listing -> notification to everyone whose alert matches
create or replace function public.on_listing_published_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare a record;
begin
  if new.status <> 'published' or (TG_OP = 'UPDATE' and old.status = 'published') then return new; end if;
  for a in
    select distinct t.user_id from public.task_alerts t
    where t.user_id <> new.user_id
      and (t.keyword is null or t.keyword = '' or (new.title || ' ' || coalesce(new.description, '')) ilike '%' || t.keyword || '%')
      and (t.category is null or t.category = '' or t.category = new.category)
      and (t.city is null or t.city = '' or public.cities_match(t.city, new.location))
  loop
    insert into public.notifications (user_id, type, title, message)
    values (a.user_id, 'task_alert', 'Novi posao: ' || new.title, coalesce(new.location, '') || case when new.price is not null then ' · ' || new.price || ' KM' else '' end);
  end loop;
  return new;
end;
$$;
revoke execute on function public.on_listing_published_alerts() from public, anon, authenticated;
drop trigger if exists listing_published_alerts on public.listings;
create trigger listing_published_alerts after insert or update of status on public.listings
  for each row execute function public.on_listing_published_alerts();

-- tier bonus feeds the provider ranking
create or replace function public.ranked_providers(category_filter text default null, limit_count integer default 6)
returns table (
  user_id uuid, display_name text, city text, avatar_url text,
  avg_rating numeric, review_count bigint, badge_count bigint, is_verified boolean,
  success_rate numeric, completed_jobs bigint, active_listings bigint, score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with listing_stats as (
    select l.user_id, count(*) as active_listings, max(l.created_at) as last_activity
    from public.listings l
    where l.status = 'published' and (category_filter is null or l.category = category_filter)
    group by l.user_id
  ),
  tier as (
    select p.user_id, coalesce((select t.rank_bonus from public.tier_levels t where t.min_earned <= public.earned_last_30(p.user_id) order by t.rank desc limit 1), 0) as bonus
    from public.profiles p where p.account_type in ('provider', 'both')
  )
  select
    m.user_id, m.display_name, m.city, m.avatar_url,
    m.avg_rating, m.review_count, m.badge_count, m.is_verified,
    m.success_rate, m.completed_jobs,
    coalesce(ls.active_listings, 0) as active_listings,
    round(
      greatest(0, (m.weighted_rating - 3) * 12)
      + least(m.review_count, 20) * 2
      + (case when m.is_verified then 25 else 0 end)
      + m.badge_count * 5
      + least(m.completed_jobs, 20) * 2
      + (case when m.success_rate >= 90 and m.completed_jobs >= 3 then 10 else 0 end)
      + least(coalesce(ls.active_listings, 0), 10) * 3
      + (case when ls.last_activity > now() - interval '14 days' then 10 else 0 end)
      + coalesce(t.bonus, 0)
    , 2) as score
  from public.provider_metrics() m
  join listing_stats ls on ls.user_id = m.user_id
  left join tier t on t.user_id = m.user_id
  order by score desc, ls.last_activity desc
  limit limit_count;
$$;
grant execute on function public.ranked_providers(text, integer) to anon, authenticated;;
