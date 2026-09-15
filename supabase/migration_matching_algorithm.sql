-- Two-way matching algorithm for Poso.ba.
--
-- Design notes (the marketplace is young: few reviews, few bids), so the
-- scoring has to be useful on day one and improve as data arrives:
--
--  * Ratings use Bayesian shrinkage towards the platform mean with a prior
--    weight of 5. A provider with one 5-star review does not outrank an
--    established provider, and a provider with no reviews starts at a neutral
--    4.5 instead of 0 (which would bury every new member permanently).
--  * Cities are free text on both sides ("Sarajevo, Sarajevo Canton,
--    Bosnia-Herzegovina" vs "Novi Grad Sarajevo"), so each side is reduced to
--    its leading city token before comparison.
--  * Every result carries a `reasons` array so the UI can explain the match
--    instead of showing an opaque number.
--  * recommended_listings() is scoped to auth.uid() and takes no user
--    parameter, so nobody can request another user's recommendations.

-- ---------------------------------------------------------------- city match
create or replace function public.city_key(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(lower(split_part(coalesce(value, ''), ',', 1))), '');
$$;

create or replace function public.cities_match(a text, b text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when public.city_key(a) is null or public.city_key(b) is null then false
    else lower(b) like '%' || public.city_key(a) || '%'
      or lower(a) like '%' || public.city_key(b) || '%'
  end;
$$;

-- ----------------------------------------------------------- provider signals
create or replace function public.provider_metrics()
returns table (
  user_id uuid, full_name text, city text, avatar_url text, display_uid text,
  avg_rating numeric, review_count bigint, weighted_rating numeric,
  total_bids bigint, accepted_bids bigint, acceptance_rate numeric,
  portfolio_count bigint, badge_count bigint, is_verified boolean,
  days_since_activity numeric, days_since_joined numeric
)
language sql stable security definer set search_path = public
as $$
  with prior as (
    select coalesce(avg(rating), 4.5) as mean_rating, 5::numeric as weight
    from public.reviews
  ),
  rev as (
    select reviewee_id, avg(rating) as avg_rating, count(*) as review_count
    from public.reviews group by reviewee_id
  ),
  bid as (
    select bidder_id, count(*) as total_bids,
           count(*) filter (where status = 'accepted') as accepted_bids,
           max(created_at) as last_bid_at
    from public.bids group by bidder_id
  ),
  port as (
    select user_id, count(*) as portfolio_count
    from public.portfolio_items group by user_id
  ),
  badge as (
    select ub.user_id, count(*) as badge_count,
           bool_or(b.code = 'verified') as is_verified
    from public.user_badges ub
    join public.badges b on b.id = ub.badge_id
    group by ub.user_id
  )
  select
    p.user_id, p.full_name, p.city, p.avatar_url, p.display_uid,
    round(coalesce(rev.avg_rating, 0), 2),
    coalesce(rev.review_count, 0),
    round(
      ((coalesce(rev.avg_rating, 0) * coalesce(rev.review_count, 0)) + (prior.mean_rating * prior.weight))
      / (coalesce(rev.review_count, 0) + prior.weight)
    , 3),
    coalesce(bid.total_bids, 0),
    coalesce(bid.accepted_bids, 0),
    case when coalesce(bid.total_bids, 0) = 0 then null
         else round(bid.accepted_bids::numeric / bid.total_bids, 3) end,
    coalesce(port.portfolio_count, 0),
    coalesce(badge.badge_count, 0),
    coalesce(badge.is_verified, false),
    round(extract(epoch from now() - coalesce(bid.last_bid_at, p.created_at)) / 86400.0, 2),
    round(extract(epoch from now() - p.created_at) / 86400.0, 2)
  from public.profiles p
  cross join prior
  left join rev on rev.reviewee_id = p.user_id
  left join bid on bid.bidder_id = p.user_id
  left join port on port.user_id = p.user_id
  left join badge on badge.user_id = p.user_id
  where p.account_status = 'active';
$$;

-- ------------------------------------------- client side: who should do this?
create or replace function public.match_providers_for_listing(
  p_listing_id uuid, limit_count integer default 6
)
returns table (
  user_id uuid, full_name text, city text, avatar_url text, display_uid text,
  avg_rating numeric, review_count bigint, is_verified boolean,
  match_score numeric, reasons text[]
)
language sql stable security definer set search_path = public
as $$
  with target as (
    select id, user_id as owner_id, category, location
    from public.listings where id = p_listing_id
  ),
  affinity as (
    select b.bidder_id, count(*) as category_bids
    from public.bids b
    join public.listings l on l.id = b.listing_id
    join target t on l.category = t.category
    group by b.bidder_id
  ),
  scored as (
    select m.*,
      coalesce(a.category_bids, 0) as category_bids,
      public.cities_match(m.city, t.location) as city_match,
      (m.days_since_activity <= 14) as recently_active,
      (m.days_since_joined <= 30 and m.total_bids = 0) as newcomer
    from public.provider_metrics() m
    cross join target t
    left join affinity a on a.bidder_id = m.user_id
    where m.user_id <> t.owner_id
  )
  select s.user_id, s.full_name, s.city, s.avatar_url, s.display_uid,
    s.avg_rating, s.review_count, s.is_verified,
    round(
      least(s.category_bids, 5) * 8
      + (case when s.city_match then 25 else 0 end)
      + greatest(0, (s.weighted_rating - 3) * 10)
      + coalesce(s.acceptance_rate, 0) * 15
      + (case when s.is_verified then 20 else 0 end)
      + s.badge_count * 4
      + least(s.portfolio_count, 5) * 3
      + (case when s.recently_active then 10 else 0 end)
      + (case when s.newcomer then 8 else 0 end)
    , 2),
    array_remove(array[
      case when s.category_bids > 0 then 'Već je radio slične poslove' end,
      case when s.city_match then 'Iz istog grada' end,
      case when s.review_count > 0 then s.avg_rating::text || ' ocjena (' || s.review_count || ')' end,
      case when s.is_verified then 'Verifikovan profil' end,
      case when s.acceptance_rate is not null and s.acceptance_rate >= 0.5 then 'Često dobija poslove' end,
      case when s.portfolio_count > 0 then 'Ima portfolio radova' end,
      case when s.recently_active then 'Aktivan nedavno' end,
      case when s.newcomer then 'Novi izvođač na platformi' end
    ], null)
  from scored s
  order by match_score desc, s.weighted_rating desc
  limit greatest(1, least(limit_count, 24));
$$;

-- --------------------------------------- provider side: which jobs suit me?
create or replace function public.recommended_listings(limit_count integer default 8)
returns table (
  id uuid, title text, category text, location text, price numeric,
  currency text, created_at timestamptz, bid_count bigint,
  match_score numeric, reasons text[]
)
language sql stable security definer set search_path = public
as $$
  with me as (
    select p.user_id, p.city from public.profiles p where p.user_id = auth.uid()
  ),
  my_categories as (
    select l.category, count(*) as bids_in_category
    from public.bids b
    join public.listings l on l.id = b.listing_id
    where b.bidder_id = auth.uid()
    group by l.category
  ),
  candidates as (
    select l.id, l.title, l.category, l.location, l.price, l.currency, l.created_at,
      (select count(*) from public.bids b where b.listing_id = l.id) as bid_count,
      round(extract(epoch from now() - l.created_at) / 86400.0, 2) as days_old
    from public.listings l
    cross join me
    where l.status = 'published'
      and l.user_id <> me.user_id
      and not exists (
        select 1 from public.bids b where b.listing_id = l.id and b.bidder_id = me.user_id
      )
  ),
  scored as (
    select c.*, coalesce(mc.bids_in_category, 0) as bids_in_category,
      public.cities_match(me.city, c.location) as city_match
    from candidates c
    cross join me
    left join my_categories mc on mc.category = c.category
  )
  select s.id, s.title, s.category, s.location, s.price, s.currency, s.created_at, s.bid_count,
    round(
      least(s.bids_in_category, 4) * 10
      + (case when s.city_match then 25 else 0 end)
      + greatest(0, 20 - s.days_old * 2)
      + greatest(0, 15 - s.bid_count * 5)
      + (case when s.price is not null then 5 else 0 end)
    , 2),
    array_remove(array[
      case when s.bids_in_category > 0 then 'Odgovara tvojim prethodnim poslovima' end,
      case when s.city_match then 'U tvom gradu' end,
      case when s.days_old <= 2 then 'Objavljeno nedavno' end,
      case when s.bid_count = 0 then 'Još nema ponuda — budi prvi' end,
      case when s.bid_count between 1 and 2 then 'Malo konkurencije' end,
      case when s.price is not null then 'Budžet je naveden' end
    ], null)
  from scored s
  order by match_score desc, s.created_at desc
  limit greatest(1, least(limit_count, 30));
$$;

-- ------------------------------------------------------------------- grants
-- Supabase's default privileges grant EXECUTE to anon/authenticated on every
-- new function, and "revoke from public" does NOT undo an explicit role grant,
-- so each role has to be revoked by name.
revoke execute on function public.provider_metrics() from public, anon, authenticated;
revoke execute on function public.recommended_listings(integer) from public, anon;
revoke execute on function public.match_providers_for_listing(uuid, integer) from public, anon;
grant execute on function public.recommended_listings(integer) to authenticated;
grant execute on function public.match_providers_for_listing(uuid, integer) to authenticated;
