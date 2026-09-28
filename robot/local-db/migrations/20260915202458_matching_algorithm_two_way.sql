-- Client side: who should do this job?
create or replace function public.match_providers_for_listing(
  p_listing_id uuid,
  limit_count integer default 6
)
returns table (
  user_id uuid,
  full_name text,
  city text,
  avatar_url text,
  display_uid text,
  avg_rating numeric,
  review_count bigint,
  is_verified boolean,
  match_score numeric,
  reasons text[]
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
    -- how often has this provider bid on jobs in the same category
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
      (t.location is not null and m.city is not null
        and (t.location ilike '%' || m.city || '%' or m.city ilike '%' || t.location || '%')) as city_match,
      (m.days_since_activity <= 14) as recently_active,
      (m.days_since_joined <= 30 and m.total_bids = 0) as newcomer
    from public.provider_metrics() m
    cross join target t
    left join affinity a on a.bidder_id = m.user_id
    where m.user_id <> t.owner_id
  )
  select
    s.user_id,
    s.full_name,
    s.city,
    s.avatar_url,
    s.display_uid,
    s.avg_rating,
    s.review_count,
    s.is_verified,
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
    , 2) as match_score,
    (
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
    ) as reasons
  from scored s
  order by match_score desc, s.weighted_rating desc
  limit greatest(1, least(limit_count, 24));
$$;

revoke execute on function public.match_providers_for_listing(uuid, integer) from public;
grant execute on function public.match_providers_for_listing(uuid, integer) to authenticated;


-- Provider side: which jobs are worth my time?
-- Scoped to auth.uid() so nobody can pull another user's recommendations.
create or replace function public.recommended_listings(limit_count integer default 8)
returns table (
  id uuid,
  title text,
  category text,
  location text,
  price numeric,
  currency text,
  created_at timestamptz,
  bid_count bigint,
  match_score numeric,
  reasons text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select p.user_id, p.city
    from public.profiles p
    where p.user_id = auth.uid()
  ),
  my_categories as (
    select l.category, count(*) as bids_in_category
    from public.bids b
    join public.listings l on l.id = b.listing_id
    where b.bidder_id = auth.uid()
    group by l.category
  ),
  candidates as (
    select
      l.id, l.title, l.category, l.location, l.price, l.currency, l.created_at,
      (select count(*) from public.bids b where b.listing_id = l.id) as bid_count,
      round(extract(epoch from now() - l.created_at) / 86400.0, 2) as days_old
    from public.listings l
    cross join me
    where l.status = 'published'
      and l.user_id <> me.user_id
      and not exists (
        select 1 from public.bids b
        where b.listing_id = l.id and b.bidder_id = me.user_id
      )
  ),
  scored as (
    select
      c.*,
      coalesce(mc.bids_in_category, 0) as bids_in_category,
      (c.location is not null and me.city is not null
        and (c.location ilike '%' || me.city || '%' or me.city ilike '%' || c.location || '%')) as city_match
    from candidates c
    cross join me
    left join my_categories mc on mc.category = c.category
  )
  select
    s.id, s.title, s.category, s.location, s.price, s.currency, s.created_at, s.bid_count,
    round(
      least(s.bids_in_category, 4) * 10
      + (case when s.city_match then 25 else 0 end)
      + greatest(0, 20 - s.days_old * 2)
      + greatest(0, 15 - s.bid_count * 5)
      + (case when s.price is not null then 5 else 0 end)
    , 2) as match_score,
    array_remove(array[
      case when s.bids_in_category > 0 then 'Odgovara tvojim prethodnim poslovima' end,
      case when s.city_match then 'U tvom gradu' end,
      case when s.days_old <= 2 then 'Objavljeno nedavno' end,
      case when s.bid_count = 0 then 'Još nema ponuda — budi prvi' end,
      case when s.bid_count between 1 and 2 then 'Malo konkurencije' end,
      case when s.price is not null then 'Budžet je naveden' end
    ], null) as reasons
  from scored s
  order by match_score desc, s.created_at desc
  limit greatest(1, least(limit_count, 30));
$$;

revoke execute on function public.recommended_listings(integer) from public;
grant execute on function public.recommended_listings(integer) to authenticated;;
