-- ============================================================================
-- Doseg ponuda (reach) and travel costs
--
-- A poorly paid in-person job can only be taken by providers close by; the better it pays,
-- the further away a provider may be. The poster can add a travel allowance ("Platiću put":
-- gorivo, taksi, prevoz) and that counts toward the pay, so it widens the reach.
--
--   pay = price + travel_allowance        (straight-line km from the provider's city)
--   price not set ("Po dogovoru")  -> 25 km (+ travel allowance tiers if one is set)
--   pay  <  50 KM                  -> 15 km
--   pay  <  100 KM                 -> 25 km
--   pay  <  200 KM                 -> 40 km
--   pay  <  400 KM                 -> 70 km
--   pay  <  800 KM                 -> 120 km
--   pay >= 800 KM                  -> cijela BiH (no limit)
--   online jobs                    -> no limit
--
-- The provider's position is their profile city. The rule is enforced on bid insert.
-- Needs 01 and 02. Idempotent.
-- ============================================================================

-- listings.travel_allowance is added in 01 (search in 02 returns it)

-- km a provider may be from the job, or null for no limit
create or replace function public.listing_reach_km(p_price numeric, p_travel numeric)
returns numeric language sql immutable set search_path = public
as $$
  select case
    when p_price is null and coalesce(p_travel, 0) = 0 then 25
    when coalesce(p_price, 0) + coalesce(p_travel, 0) < 50 then 15
    when coalesce(p_price, 0) + coalesce(p_travel, 0) < 100 then 25
    when coalesce(p_price, 0) + coalesce(p_travel, 0) < 200 then 40
    when coalesce(p_price, 0) + coalesce(p_travel, 0) < 400 then 70
    when coalesce(p_price, 0) + coalesce(p_travel, 0) < 800 then 120
    else null
  end::numeric
$$;

create or replace function public.listing_is_remote(p_location text)
returns boolean language sql stable set search_path = public
as $$
  select public.fold_text(coalesce(p_location, '')) like '%online%' or public.fold_text(coalesce(p_location, '')) like '%daljin%'
$$;

-- Where the signed-in person stands for one job: the reach, their distance and whether they may offer.
-- reason: ok | remote | no_limit | no_job_location | no_city | too_far | own_job | signed_out
create or replace function public.listing_reach(p_listing uuid)
returns table (reach_km numeric, distance_km numeric, can_offer boolean, reason text, my_city text)
language plpgsql stable security definer set search_path = public
as $$
declare
  l record;
  me record;
  d double precision;
  r numeric;
begin
  select id, user_id, location, lat, lng, price, travel_allowance into l from public.listings where id = p_listing;
  if l.id is null then return; end if;
  r := public.listing_reach_km(l.price, l.travel_allowance);
  if public.listing_is_remote(l.location) then
    return query select null::numeric, null::numeric, true, 'remote'::text, null::text; return;
  end if;
  if auth.uid() is null then
    return query select r, null::numeric, true, 'signed_out'::text, null::text; return;
  end if;
  select p.city, c.lat, c.lng into me
  from public.profiles p left join lateral public.coords_for_location(p.city) c on true
  where p.user_id = auth.uid();
  if l.user_id = auth.uid() then
    return query select r, null::numeric, false, 'own_job'::text, me.city; return;
  end if;
  if l.lat is null or l.lng is null then
    return query select r, null::numeric, true, 'no_job_location'::text, me.city; return;
  end if;
  if me.lat is null then
    return query select r, null::numeric, r is null, case when r is null then 'no_limit' else 'no_city' end, me.city; return;
  end if;
  d := public.distance_km(me.lat, me.lng, l.lat, l.lng);
  return query select r, round(d::numeric, 1), (r is null or d <= r),
    case when r is null then 'no_limit' when d <= r then 'ok' else 'too_far' end, me.city;
end $$;

revoke execute on function public.listing_reach(uuid) from public, anon;
grant execute on function public.listing_reach(uuid) to anon, authenticated;

-- enforce on new offers
create or replace function public.guard_bid_reach()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  l record;
  me record;
  d double precision;
  r numeric;
begin
  select location, lat, lng, price, travel_allowance into l from public.listings where id = new.listing_id;
  if l is null or public.listing_is_remote(l.location) or l.lat is null or l.lng is null then return new; end if;
  r := public.listing_reach_km(l.price, l.travel_allowance);
  if r is null then return new; end if;
  select c.lat, c.lng into me
  from public.profiles p left join lateral public.coords_for_location(p.city) c on true
  where p.user_id = new.bidder_id;
  if me.lat is null then
    raise exception 'GRAD_POTREBAN: dodaj svoj grad u profil da vidimo koliko si daleko od posla'
      using errcode = 'P0001';
  end if;
  d := public.distance_km(me.lat, me.lng, l.lat, l.lng);
  if d > r then
    raise exception 'PREDALEKO: udaljen/a si % km, a za ovaj posao ponude mogu slati izvođači do % km', round(d::numeric), r
      using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke execute on function public.guard_bid_reach() from public, anon, authenticated;

drop trigger if exists bids_reach_guard on public.bids;
create trigger bids_reach_guard
  before insert on public.bids
  for each row execute function public.guard_bid_reach();

-- Recommended jobs for providers (home feed): same scoring as before, but no jobs whose date
-- has passed and none outside the provider's reach.
create or replace function public.recommended_listings(limit_count integer default 8)
 returns table(id uuid, title text, category text, location text, price numeric, currency text, created_at timestamp with time zone, bid_count bigint, match_score numeric, reasons text[])
 language sql stable security definer
 set search_path to 'public'
as $function$
  with me as (
    select p.user_id, p.city, coalesce(p.trades, '{}'::text[]) as trades, c.lat, c.lng
    from public.profiles p left join lateral public.coords_for_location(p.city) c on true
    where p.user_id = auth.uid()
  ),
  my_categories as (
    select l.category, count(*) as bids_in_category
    from public.bids b join public.listings l on l.id = b.listing_id
    where b.bidder_id = auth.uid()
    group by l.category
  ),
  candidates as (
    select l.id, l.title, l.category, l.location, l.price, l.currency, l.created_at, l.lat, l.lng,
           l.bid_count::bigint as bid_count,
           round((extract(epoch from now() - l.created_at) / 86400.0)::numeric, 2) as days_old,
           (select count(*) from public.listing_images li where li.listing_id = l.id) as photos,
           (public.fold_text(coalesce(l.location, '')) like '%online%' or public.fold_text(coalesce(l.location, '')) like '%daljin%') as is_remote
    from public.listings l cross join me
    where l.status = 'published' and l.user_id <> me.user_id
      and (l.due_date is null or l.due_date >= public.today_ba())
      and (public.listing_is_remote(l.location) or l.lat is null or me.lat is null
           or public.listing_reach_km(l.price, l.travel_allowance) is null
           or public.distance_km(me.lat, me.lng, l.lat, l.lng) <= public.listing_reach_km(l.price, l.travel_allowance))
      and not exists (select 1 from public.bids b where b.listing_id = l.id and b.bidder_id = me.user_id)
    order by l.created_at desc
    limit 2000
  ),
  scored as (
    select c.*,
      coalesce(mc.bids_in_category, 0) as bids_in_category,
      public.cities_match(me.city, c.location) as city_match,
      case when c.is_remote then null else public.distance_km(me.lat, me.lng, c.lat, c.lng)::numeric end as distance_km,
      exists (select 1 from unnest(me.trades) t where public.fold_text(t) = public.fold_text(c.category) or public.fold_text(c.category) like '%' || public.fold_text(t) || '%' or public.fold_text(t) like '%' || public.fold_text(split_part(c.category, '/', 1)) || '%') as trade_match
    from candidates c cross join me
    left join my_categories mc on mc.category = c.category
  ),
  raw as (
    select s.*,
      ((case when s.trade_match then 25 else 0 end)
      + least(s.bids_in_category, 4) * 8
      + (case when s.is_remote then 12 when s.distance_km is null then (case when s.city_match then 22 else 0 end) else greatest(0, 22 - s.distance_km / 4) end)
      + greatest(0, 18 - s.days_old * 2)
      + greatest(0, 15 - s.bid_count * 5)
      + (case when s.price is not null then 5 else 0 end)
      + (case when s.photos > 0 then 3 else 0 end))::numeric as points   -- max 120
    from scored s
  )
  select
    r.id, r.title, r.category, r.location, r.price, r.currency, r.created_at, r.bid_count,
    round(least(100, r.points / 1.2), 0) as match_score,
    array_remove(array[
      case when r.trade_match then 'Odgovara tvojim vještinama' end,
      case when r.bids_in_category > 0 then 'Slično poslovima na koje si nudio/la' end,
      case when r.distance_km is not null and r.distance_km <= 15 then 'U blizini' when r.city_match then 'U tvom gradu' when r.distance_km is not null then round(r.distance_km)::int || ' km od tebe' end,
      case when r.days_old <= 2 then 'Objavljeno nedavno' end,
      case when r.bid_count = 0 then 'Još nema ponuda — budi prvi' end,
      case when r.bid_count between 1 and 2 then 'Malo konkurencije' end,
      case when r.price is not null then 'Budžet je naveden' end,
      case when r.photos > 0 then 'Ima slike' end
    ], null) as reasons
  from raw r
  order by match_score desc, r.created_at desc
  limit greatest(1, least(limit_count, 30));
$function$;
