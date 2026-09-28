-- ============================================================
-- 1. Job outcomes on listings: completed / cancelled (+ who caused it)
-- ============================================================
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status = any (array['draft','published','paused','closed','archived','completed','cancelled']));
alter table public.listings add column if not exists completed_at timestamptz;
alter table public.listings add column if not exists cancelled_at timestamptz;
alter table public.listings add column if not exists cancel_reason text
  check (cancel_reason is null or cancel_reason in ('provider','client','other'));

create or replace function public.stamp_listing_outcome()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.cancelled_at := null;
    new.cancel_reason := null;
  elsif new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancel_reason := coalesce(new.cancel_reason, 'other');
  end if;
  return new;
end;
$$;
revoke execute on function public.stamp_listing_outcome() from public, anon, authenticated;
drop trigger if exists stamp_listing_outcome_trigger on public.listings;
create trigger stamp_listing_outcome_trigger
  before update of status on public.listings
  for each row execute function public.stamp_listing_outcome();

-- ============================================================
-- 2. Provider metrics: display name, real success rate
-- ============================================================
drop function if exists public.match_providers_for_listing(uuid, integer);
drop function if exists public.ranked_providers(text, integer);
drop function if exists public.trust_summary(uuid);
drop function if exists public.provider_metrics();

create function public.provider_metrics()
returns table (
  user_id uuid, display_name text, city text, avatar_url text, account_type text,
  avg_rating numeric, review_count bigint, weighted_rating numeric,
  total_bids bigint, accepted_bids bigint, acceptance_rate numeric,
  completed_jobs bigint, failed_jobs bigint, success_rate numeric,
  portfolio_count bigint, badge_count bigint, is_verified boolean,
  days_since_activity numeric, days_since_joined numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with prior as (
    select coalesce(avg(rating), 4.5) as mean_rating, 5::numeric as weight
    from public.reviews
  ),
  rev as (
    select reviewee_id, avg(rating) as avg_rating, count(*) as review_count
    from public.reviews
    group by reviewee_id
  ),
  bid as (
    select b.bidder_id,
           count(*) as total_bids,
           count(*) filter (where b.status = 'accepted') as accepted_bids,
           count(*) filter (where b.status = 'accepted' and l.status = 'completed') as completed_jobs,
           count(*) filter (where b.status = 'accepted' and l.status = 'cancelled' and l.cancel_reason = 'provider') as failed_jobs,
           max(b.created_at) as last_bid_at
    from public.bids b
    join public.listings l on l.id = b.listing_id
    group by b.bidder_id
  ),
  port as (
    select user_id, count(*) as portfolio_count
    from public.portfolio_items
    group by user_id
  ),
  badge as (
    select ub.user_id,
           count(*) as badge_count,
           bool_or(b.code = 'verified') as is_verified
    from public.user_badges ub
    join public.badges b on b.id = ub.badge_id
    group by ub.user_id
  )
  select
    p.user_id,
    public.display_name_of(p.full_name) as display_name,
    p.city,
    p.avatar_url,
    p.account_type,
    round(coalesce(rev.avg_rating, 0), 2) as avg_rating,
    coalesce(rev.review_count, 0) as review_count,
    round(
      ((coalesce(rev.avg_rating, 0) * coalesce(rev.review_count, 0)) + (prior.mean_rating * prior.weight))
      / (coalesce(rev.review_count, 0) + prior.weight)
    , 3) as weighted_rating,
    coalesce(bid.total_bids, 0) as total_bids,
    coalesce(bid.accepted_bids, 0) as accepted_bids,
    case when coalesce(bid.total_bids, 0) = 0 then null
         else round(bid.accepted_bids::numeric / bid.total_bids, 3) end as acceptance_rate,
    coalesce(bid.completed_jobs, 0) as completed_jobs,
    coalesce(bid.failed_jobs, 0) as failed_jobs,
    case when coalesce(bid.completed_jobs, 0) + coalesce(bid.failed_jobs, 0) = 0 then null
         else round(bid.completed_jobs::numeric / (bid.completed_jobs + bid.failed_jobs) * 100) end as success_rate,
    coalesce(port.portfolio_count, 0) as portfolio_count,
    coalesce(badge.badge_count, 0) as badge_count,
    coalesce(badge.is_verified, false) as is_verified,
    round(extract(epoch from now() - coalesce(bid.last_bid_at, p.created_at)) / 86400.0, 2) as days_since_activity,
    round(extract(epoch from now() - p.created_at) / 86400.0, 2) as days_since_joined
  from public.profiles p
  cross join prior
  left join rev on rev.reviewee_id = p.user_id
  left join bid on bid.bidder_id = p.user_id
  left join port on port.user_id = p.user_id
  left join badge on badge.user_id = p.user_id
  where p.account_status = 'active';
$$;
revoke execute on function public.provider_metrics() from public, anon, authenticated;

create function public.ranked_providers(category_filter text default null, limit_count integer default 6)
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
    where l.status = 'published'
      and (category_filter is null or l.category = category_filter)
    group by l.user_id
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
    , 2) as score
  from public.provider_metrics() m
  join listing_stats ls on ls.user_id = m.user_id
  order by score desc, ls.last_activity desc
  limit limit_count;
$$;
grant execute on function public.ranked_providers(text, integer) to anon, authenticated;

create function public.match_providers_for_listing(p_listing_id uuid, limit_count integer default 6)
returns table (
  user_id uuid, display_name text, city text, avatar_url text,
  avg_rating numeric, review_count bigint, is_verified boolean, success_rate numeric,
  match_score numeric, reasons text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select id, user_id as owner_id, category, location
    from public.listings
    where id = p_listing_id
  ),
  affinity as (
    select b.bidder_id, count(*) as category_bids
    from public.bids b
    join public.listings l on l.id = b.listing_id
    join target t on l.category = t.category
    group by b.bidder_id
  ),
  scored as (
    select
      m.*,
      coalesce(a.category_bids, 0) as category_bids,
      public.cities_match(m.city, t.location) as city_match,
      (m.days_since_activity <= 14) as recently_active,
      (m.days_since_joined <= 30 and m.total_bids = 0) as newcomer
    from public.provider_metrics() m
    cross join target t
    left join affinity a on a.bidder_id = m.user_id
    where m.user_id <> t.owner_id
      and m.account_type in ('provider', 'both')
  )
  select
    s.user_id, s.display_name, s.city, s.avatar_url,
    s.avg_rating, s.review_count, s.is_verified, s.success_rate,
    round(
      least(s.category_bids, 5) * 8
      + (case when s.city_match then 25 else 0 end)
      + greatest(0, (s.weighted_rating - 3) * 10)
      + coalesce(s.acceptance_rate, 0) * 15
      + (case when s.is_verified then 20 else 0 end)
      + s.badge_count * 4
      + least(s.completed_jobs, 10) * 2
      + (case when s.success_rate >= 90 and s.completed_jobs >= 3 then 8 else 0 end)
      + least(s.portfolio_count, 5) * 3
      + (case when s.recently_active then 10 else 0 end)
      + (case when s.newcomer then 8 else 0 end)
    , 2) as match_score,
    array_remove(array[
      case when s.category_bids > 0 then 'Već je radio slične poslove' end,
      case when s.city_match then 'Iz istog grada' end,
      case when s.review_count > 0 then s.avg_rating::text || ' ocjena (' || s.review_count || ')' end,
      case when s.is_verified then 'Verifikovan profil' end,
      case when s.success_rate is not null and s.completed_jobs >= 3 then s.success_rate::int || '% uspješnih poslova' end,
      case when s.portfolio_count > 0 then 'Ima portfolio radova' end,
      case when s.recently_active then 'Aktivan nedavno' end,
      case when s.newcomer then 'Novi izvođač na platformi' end
    ], null) as reasons
  from scored s
  order by match_score desc, s.weighted_rating desc
  limit greatest(1, least(limit_count, 24));
$$;
grant execute on function public.match_providers_for_listing(uuid, integer) to authenticated;

-- ============================================================
-- 3. Badge catalog: special badges
-- ============================================================
insert into public.badges (code, label, description, icon) values
  ('founder',        'Osnivački član',  'Među prvih 100 korisnika Poso.ba. Trajna oznaka.', 'crown'),
  ('flawless',       'Bez greške',      '10+ završenih poslova i 100% uspješnost.', 'gem'),
  ('local_hero',     'Lokalni heroj',   '10+ završenih poslova u istom gradu.', 'map-pinned'),
  ('veteran',        'Veteran',         'Više od godinu dana na platformi i 20+ završenih poslova.', 'medal'),
  ('trusted_client', 'Pouzdan klijent', '5+ završenih poslova kao klijent i redovno ostavlja recenzije.', 'handshake')
on conflict (code) do update set label = excluded.label, description = excluded.description, icon = excluded.icon;

-- ============================================================
-- 4. Badge engine: instant re-evaluation with the new rules
-- ============================================================
create or replace function public.refresh_user_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avg numeric;
  v_count bigint;
  v_joined timestamptz;
  v_accepted bigint;
  v_resolved bigint;
  v_resp_count bigint;
  v_resp_avg numeric;
  v_completed bigint;
  v_failed bigint;
  v_city_max bigint;
  v_rank bigint;
  v_client_done bigint;
  v_reviews_given bigint;
begin
  select avg(rating), count(*) into v_avg, v_count
  from public.reviews where reviewee_id = p_user_id;

  select created_at into v_joined from public.profiles where user_id = p_user_id;

  select count(*) filter (where status = 'accepted'),
         count(*) filter (where status in ('accepted','rejected','withdrawn'))
    into v_accepted, v_resolved
  from public.bids where bidder_id = p_user_id;

  select count(*) filter (where l.status = 'completed'),
         count(*) filter (where l.status = 'cancelled' and l.cancel_reason = 'provider')
    into v_completed, v_failed
  from public.bids b join public.listings l on l.id = b.listing_id
  where b.bidder_id = p_user_id and b.status = 'accepted';

  select coalesce(max(n), 0) into v_city_max from (
    select count(*) as n
    from public.bids b join public.listings l on l.id = b.listing_id
    where b.bidder_id = p_user_id and b.status = 'accepted' and l.status = 'completed' and l.location is not null
    group by public.city_key(l.location)
  ) c;

  select count(*) + 1 into v_rank from public.profiles where created_at < v_joined;

  select count(*) into v_client_done from public.listings where user_id = p_user_id and status = 'completed';
  select count(*) into v_reviews_given from public.reviews where reviewer_id = p_user_id;

  select count(*), avg(response_minutes) into v_resp_count, v_resp_avg
  from (
    select extract(epoch from (m.created_at - lag(m.created_at) over (partition by m.conversation_id order by m.created_at))) / 60 as response_minutes,
           m.sender_id,
           lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender
    from public.messages m
    where m.conversation_id in (select conversation_id from public.messages where sender_id = p_user_id)
  ) pairs
  where sender_id = p_user_id and prev_sender is not null and prev_sender <> p_user_id;

  -- helper: award or revoke one badge
  perform public.set_badge(p_user_id, 'top_rated',      coalesce(v_count,0) >= 10 and coalesce(v_avg,0) >= 4.8);
  perform public.set_badge(p_user_id, 'rising_talent',  v_joined > now() - interval '30 days' and coalesce(v_count,0) between 1 and 9 and coalesce(v_avg,0) >= 4.5);
  perform public.set_badge(p_user_id, 'reliable',       coalesce(v_accepted,0) >= 3 and coalesce(v_resolved,0) > 0 and v_accepted::numeric / v_resolved >= 0.8);
  perform public.set_badge(p_user_id, 'fast_responder', coalesce(v_resp_count,0) >= 3 and coalesce(v_resp_avg, 9999) <= 60);
  perform public.set_badge(p_user_id, 'flawless',       coalesce(v_completed,0) >= 10 and coalesce(v_failed,0) = 0);
  perform public.set_badge(p_user_id, 'local_hero',     v_city_max >= 10);
  perform public.set_badge(p_user_id, 'veteran',        v_joined <= now() - interval '365 days' and coalesce(v_completed,0) >= 20);
  perform public.set_badge(p_user_id, 'trusted_client', v_client_done >= 5 and v_reviews_given >= 3);
  -- founder is permanent: only ever awarded, never revoked
  if v_rank <= 100 then
    perform public.set_badge(p_user_id, 'founder', true);
  end if;
end;
$$;
revoke execute on function public.refresh_user_badges(uuid) from public, anon, authenticated;

create or replace function public.set_badge(p_user_id uuid, p_code text, p_award boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_award then
    insert into public.user_badges (user_id, badge_id)
    select p_user_id, id from public.badges where code = p_code
    on conflict do nothing;
  else
    delete from public.user_badges ub using public.badges b
    where ub.badge_id = b.id and b.code = p_code and ub.user_id = p_user_id;
  end if;
end;
$$;
revoke execute on function public.set_badge(uuid, text, boolean) from public, anon, authenticated;

-- Listing outcome changes re-evaluate both sides instantly.
create or replace function public.on_listing_outcome_refresh_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bidder uuid;
begin
  if new.status in ('completed','cancelled') and old.status is distinct from new.status then
    perform public.refresh_user_badges(new.user_id);
    for v_bidder in select bidder_id from public.bids where listing_id = new.id and status = 'accepted' loop
      perform public.refresh_user_badges(v_bidder);
    end loop;
  end if;
  return new;
end;
$$;
revoke execute on function public.on_listing_outcome_refresh_badges() from public, anon, authenticated;
drop trigger if exists listing_outcome_refresh_badges on public.listings;
create trigger listing_outcome_refresh_badges
  after update of status on public.listings
  for each row execute function public.on_listing_outcome_refresh_badges();

-- New profiles get their founder badge on the spot.
create or replace function public.on_profile_created_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_user_badges(new.user_id);
  return new;
end;
$$;
revoke execute on function public.on_profile_created_badges() from public, anon, authenticated;
drop trigger if exists profile_created_badges on public.profiles;
create trigger profile_created_badges
  after insert on public.profiles
  for each row execute function public.on_profile_created_badges();

-- ============================================================
-- 5. Trust summary with success rate + client-side stats
-- ============================================================
create function public.trust_summary(p_user_id uuid)
returns table (
  tier text, label text, score integer, verified_trade text,
  avg_rating numeric, review_count bigint,
  completed_jobs bigint, failed_jobs bigint, success_rate numeric, accepted_bids bigint,
  jobs_posted bigint, jobs_completed_as_client bigint, client_completion_rate numeric,
  badges text[], reasons text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select * from public.provider_metrics() where user_id = p_user_id
  ),
  p as (
    select verified_trade, created_at, last_seen_at, account_type from public.profiles where user_id = p_user_id
  ),
  b as (
    select coalesce(array_agg(bg.code order by bg.code), '{}') as codes
    from public.user_badges ub join public.badges bg on bg.id = ub.badge_id
    where ub.user_id = p_user_id
  ),
  cl as (
    select
      count(*) filter (where status <> 'draft') as jobs_posted,
      count(*) filter (where status = 'completed') as jobs_done,
      count(*) filter (where status = 'cancelled' and exists (select 1 from public.bids bb where bb.listing_id = l.id and bb.status = 'accepted')) as jobs_cancelled
    from public.listings l where l.user_id = p_user_id
  ),
  s as (
    select
      m.*, p.verified_trade, p.last_seen_at, b.codes, cl.jobs_posted, cl.jobs_done, cl.jobs_cancelled,
      (
        (case when m.is_verified then 35 else 0 end)
        + least(round(greatest(0, (m.weighted_rating - 3)) * 12)::int, 24)
        + least(m.review_count::int, 15)
        + (case when m.success_rate >= 90 and m.completed_jobs >= 3 then 10 else 0 end)
        + (case when m.portfolio_count > 0 then 6 else 0 end)
        + (case when 'top_rated' = any(b.codes) then 10 else 0 end)
      )::int as raw_score
    from m cross join p cross join b cross join cl
  )
  select
    case
      when s.is_verified and s.review_count >= 10 and s.avg_rating >= 4.8 then 'top'
      when s.is_verified and s.review_count >= 3 and s.avg_rating >= 4.5 then 'trusted'
      when s.is_verified then 'verified'
      when s.days_since_joined <= 7 and s.review_count = 0 then 'new'
      else 'unverified'
    end as tier,
    case
      when s.is_verified and s.review_count >= 10 and s.avg_rating >= 4.8 then 'Top majstor'
      when s.is_verified and s.review_count >= 3 and s.avg_rating >= 4.5 then 'Pouzdan majstor'
      when s.is_verified then 'Verifikovan majstor'
      when s.days_since_joined <= 7 and s.review_count = 0 then 'Novi korisnik'
      else 'Nije verifikovan'
    end as label,
    least(100, s.raw_score) as score,
    s.verified_trade,
    s.avg_rating,
    s.review_count,
    s.completed_jobs,
    s.failed_jobs,
    s.success_rate,
    s.accepted_bids,
    s.jobs_posted,
    s.jobs_done as jobs_completed_as_client,
    case when s.jobs_done + s.jobs_cancelled = 0 then null
         else round(s.jobs_done::numeric / (s.jobs_done + s.jobs_cancelled) * 100) end as client_completion_rate,
    s.codes as badges,
    array_remove(array[
      case when s.is_verified then 'Identitet i struka provjereni' else 'Struka još nije provjerena' end,
      case when s.review_count >= 3 then s.avg_rating::text || ' prosjek iz ' || s.review_count || ' recenzija' end,
      case when s.review_count between 1 and 2 then 'Tek nekoliko recenzija' end,
      case when s.review_count = 0 then 'Još nema recenzija' end,
      case when s.completed_jobs >= 1 then s.completed_jobs || ' završenih poslova' end,
      case when s.success_rate is not null and s.completed_jobs + s.failed_jobs >= 3 then s.success_rate::int || '% uspješnost' end,
      case when s.portfolio_count > 0 then 'Ima portfolio radova' end,
      case when s.last_seen_at > now() - interval '7 days' then 'Aktivan ove sedmice' end
    ], null) as reasons
  from s;
$$;
grant execute on function public.trust_summary(uuid) to anon, authenticated;

-- Give existing users their founder badges.
select public.refresh_user_badges(user_id) from public.profiles;;
