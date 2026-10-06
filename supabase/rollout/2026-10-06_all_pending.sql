-- =============================================================================
-- Zadatak · sve što čeka na živu bazu (06.10.2026.)
--
-- Jedan fajl umjesto dvanaest. Pokreće se jednom, u Supabase SQL Editoru (Run).
-- Sve ide u jednoj transakciji: ako bilo šta ne prođe, baza ostaje kakva je bila.
-- Smije se pokrenuti i više puta. Na kraju piše "Gotovo".
--
-- Sadržaj (redoslijed je bitan):
--   1. security/07          lažne "brojeve telefona" u običnim rečenicama više ne kažnjava
--   2. performance/01       brža pretraga po gradu i udaljenosti
--   3. airtasker/04         doseg ponude po cijeni + "Platiću put", preporuke bez isteklih poslova
--   4. offers/bid_replies   poruke ispod ponude, obavijest kad izvođač izmijeni ponudu
--   5. payments/02          povećanje cijene tokom posla, pravila i naknada za otkazivanje
--   6. identity/id_badge_counts   značka "Lična karta verifikovana" vrijedi kao potvrđen identitet
--   7. offers/job_conditions      uslovi posla (tražene značke) i pogodnosti
--   8. booking/04           zaštita od prevare: zaključan status, provjeren escrow, foto dokaz
--   9. booking/05           "Izvođač je na putu": lokacija uživo
--  10. marketplace/01       izdvojeni oglasi (Hitno/VIP), nova cijena nakon odbijene ponude
--  11. security/06          privatni dokumenti, slike iz poruka i dokazi rada
--  12. security/09          funkcije samo za prijavljene (mora biti zadnje)
--
-- Generisano skriptom supabase/rollout/build.sh iz gornjih fajlova; ne mijenjati ručno.
-- =============================================================================

begin;
-- ako je neka tabela zauzeta, odustani za 15 s umjesto da sajt čeka (pokreni ponovo)
set local lock_timeout = '15s';

-- =============================================================================
-- supabase/security/07_phone_run_false_positives.sql
-- =============================================================================

-- Rule #1 false positives: ordinary sentences were treated as phone numbers.
--
-- phone_run_hit() (migration moderation_scan_digit_run_rule, 2026-09-22) reads letters that look
-- like digits (o→0, i→1, z→2, e→3, a→4, s→5, b→6, t→7, g→9, q→9) and joins them across spaces.
-- A run made only of such letters then counts as a phone number, so everyday Bosnian without
-- diacritics is masked and earns a Rule #1 strike (3 strikes in 30 days = 7-day suspension):
--   "Zato sto se ne javite ranije?"              → zato sto se   → 247057053 (9 digits)
--   "Ostale stolice i tabla se nose na ..."       → masked twice
--   "Test sa telefona"                            → masked
-- Found by the test robot (robot/README.md) when a worker got suspended for normal offers.
--
-- Fix: a run only counts when it really contains digits: at least 4 real digits (0-9), and real
-- digits make up at least half of it. Obfuscated numbers such as "o61 2e4 s67" or "O6I-234-567"
-- are still caught; runs of plain words are not. The regex rules for real numbers are unchanged.
-- Safe to re-run.

create or replace function public.phone_run_hit(p_norm text)
 returns boolean
 language plpgsql
 immutable
 set search_path to 'public'
as $function$
declare m text[]; d text; real_digits int;
begin
  for m in
    select regexp_matches(p_norm,
      '([0-9oOlIsSbBgGzZtTaAeEqQ][0-9oOlIsSbBgGzZtTaAeEqQ\s._()/·•–—-]{5,}[0-9oOlIsSbBgGzZtTaAeEqQ])', 'g')
  loop
    real_digits := length(regexp_replace(m[1], '[^0-9]', '', 'g'));
    d := translate(lower(m[1]), 'oisbgztaeq', '0158627439');
    d := regexp_replace(d, '[^0-9]', '', 'g');
    -- words made of digit-like letters ("zato sto se") are not a number
    continue when real_digits < 4 or real_digits * 2 < length(d);
    -- BiH mobilni/fiksni: 0 + 7-9 cifara, ili 387 + 8-9 cifara
    if d ~ '^0\d{7,9}$' or d ~ '^(00)?387\d{8,9}$' or d ~ '^\d{9,11}$' then
      return true;
    end if;
  end loop;
  return false;
end $function$;

-- Review (read-only, for staff): phone-only strikes of the last 30 days. The snippet shows where the
-- text was masked; "[uklonjeno]" in the middle of ordinary words (e.g. "[uklonjeno]fona") is this bug.
-- select e.created_at, e.user_id, e.source_table, e.snippet
--   from public.moderation_events e
--  where e.kinds = array['phone'] and not e.dismissed and e.created_at > now() - interval '30 days'
--  order by e.created_at desc;


-- =============================================================================
-- supabase/performance/01_search_radius_first.sql
-- =============================================================================

-- Faster, correct radius search for jobs ("Pretraži poslove" with a city and a distance).
--
-- Before: search_listings_core took the 3000 newest published jobs in the whole country, then
-- measured the distance to each and dropped the far ones. A nearby job older than the 3000 newest
-- in BiH was never found, and every search measured thousands of rows.
-- After: a latitude/longitude box around the origin is applied first, so the existing
-- (status, lat, lng) index keeps only nearby jobs; the exact haversine distance still decides.
-- Same signature and grants; identical results whenever all jobs fit in the newest 3000 (today).
--
-- Measured on the local copy (25 km around Sarajevo, jobs spread over BiH, 2% remote):
--     jobs      before     after (closest)   after (recommended)
--     2 000     ~125 ms    ~28 ms            ~20 ms      identical results
--    20 000     ~180 ms    ~61 ms            ~100-140 ms finds nearby jobs the old one missed
--   200 000     ~340 ms    ~240 ms           ~470-540 ms finds nearby jobs the old one missed
-- At 200 000 "recommended" is slower because it now really scores up to 3000 nearby jobs
-- instead of 3000 random ones; that cost is the per-job rating/photo lookups, not distance.
--
-- PostGIS geography + GiST was considered: within one country (distances under 400 km) the box +
-- haversine gives the same answer, the distance part is no longer the slow part, and PostGIS
-- would need an extension, a new column and a change to how jobs are saved.
-- Safe to run more than once.

create or replace function public.search_listings_core(p_query text, p_category text, p_lat double precision, p_lng double precision, p_radius_km double precision, p_include_remote boolean, p_min_price numeric, p_max_price numeric, p_has_budget boolean, p_no_offers boolean, p_sort text, p_limit integer, p_offset integer, p_fuzzy boolean)
 returns table(id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text, status text, created_at timestamp with time zone, lat double precision, lng double precision, is_remote boolean, cover_url text, image_count integer, offers integer, distance_km double precision, text_rank real, poster_rating numeric, poster_reviews integer, poster_completed integer, score numeric, total_count bigint, date_type text, due_date date, time_of_day text[], travel_allowance numeric)
 language sql stable security definer
 set search_path to 'public'
as $function$
  with params as (
    select public.search_tsquery(p_query) as q,
           public.fold_text(coalesce(p_query, '')) as folded,
           nullif(btrim(coalesce(p_category, '')), '') as cat,
           (p_lat is not null and p_lng is not null) as has_origin,
           coalesce(p_radius_km, 0) as radius,
           -- bounding box around the origin, in degrees: one degree of latitude is ~111.32 km, a degree of
           -- longitude shrinks with cos(latitude). The box is a superset of the circle, so the exact
           -- haversine test further down still decides; the box only lets the (status, lat, lng) index
           -- skip jobs that are obviously too far before anything is computed for them.
           coalesce(p_radius_km, 0) / 111.32 as lat_span,
           coalesce(p_radius_km, 0) / (111.32 * greatest(cos(radians(coalesce(p_lat, 0))), 0.01)) as lng_span,
           least(greatest(coalesce(p_limit, 50), 1), 200) as lim,
           greatest(coalesce(p_offset, 0), 0) as off,
           coalesce(p_sort, 'recommended') as sort,
           public.today_ba() as today
  ),
  me as (
    select coalesce(p.trades, '{}'::text[]) as trades from public.profiles p where p.user_id = auth.uid()
  ),
  pool as (
    select l.id, l.user_id, l.title, l.description, l.category, l.location, l.price, l.currency, l.status, l.created_at, l.lat, l.lng, l.bid_count, l.search_tsv, l.date_type, l.due_date, l.time_of_day, l.travel_allowance
    from public.listings l cross join params pa
    where not p_fuzzy and l.status = 'published'
      and (l.due_date is null or l.due_date >= pa.today)
      and l.invited_provider is null
      and (pa.q is null or l.search_tsv @@ pa.q or pa.folded operator(extensions.<%) public.fold_text(l.title))
      and (pa.cat is null or l.category = pa.cat)
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      and (not p_has_budget or l.price is not null)
      and (not p_no_offers or l.bid_count = 0)
      -- radius first, newest-3000 second: before this a radius search only looked at the 3000 newest
      -- jobs in the whole country, so at scale nearby older jobs could be missed. Remote jobs are
      -- saved without coordinates (coordsForLocation returns null for them), so "lat is null" keeps
      -- them on the same index; jobs without coordinates that are not remote drop out in in_range
      -- exactly as before.
      and (not pa.has_origin or pa.radius = 0
             or (l.lat between p_lat - pa.lat_span and p_lat + pa.lat_span and l.lng between p_lng - pa.lng_span and p_lng + pa.lng_span)
             or (p_include_remote and l.lat is null))
    order by l.created_at desc
    limit 3000
  ),
  fuzzy_pool as (
    select w.id, w.user_id, w.title, w.description, w.category, w.location, w.price, w.currency, w.status, w.created_at, w.lat, w.lng, w.bid_count, w.search_tsv, w.date_type, w.due_date, w.time_of_day, w.travel_allowance
    from (
      select l.* from public.listings l cross join params pa
      where p_fuzzy and l.status = 'published'
        and (l.due_date is null or l.due_date >= pa.today)
        and l.invited_provider is null
        and (pa.cat is null or l.category = pa.cat)
        and (p_min_price is null or l.price >= p_min_price)
        and (p_max_price is null or l.price <= p_max_price)
        and (not p_has_budget or l.price is not null)
        and (not p_no_offers or l.bid_count = 0)
        and (not pa.has_origin or pa.radius = 0
               or (l.lat between p_lat - pa.lat_span and p_lat + pa.lat_span and l.lng between p_lng - pa.lng_span and p_lng + pa.lng_span)
               or (p_include_remote and l.lat is null))
      order by l.created_at desc
      limit 5000
    ) w cross join params pa
    where extensions.word_similarity(pa.folded, public.fold_text(w.title)) >= 0.4
       or extensions.word_similarity(pa.folded, public.fold_text(coalesce(w.category, ''))) >= 0.4
  ),
  filtered as (
    select l.id, l.user_id, l.title, l.description, l.category, l.location, l.price, l.currency, l.status, l.created_at,
           l.lat, l.lng, l.bid_count, l.date_type, l.due_date, l.time_of_day, l.travel_allowance,
           (public.fold_text(coalesce(l.location, '')) like '%online%' or public.fold_text(coalesce(l.location, '')) like '%daljin%') as is_remote,
           case when pa.q is null then 0.5::real
                else greatest(least(1, ts_rank_cd(l.search_tsv, pa.q) * 4), extensions.word_similarity(pa.folded, public.fold_text(l.title)) * 0.8)::real end as text_rank
    from (select * from pool union all select * from fuzzy_pool) l cross join params pa
  ),
  measured as (
    select f.*,
           case when pa.has_origin and not f.is_remote then public.distance_km(p_lat, p_lng, f.lat, f.lng) end as distance_km
    from filtered f cross join params pa
  ),
  in_range as (
    select m.* from measured m cross join params pa
    where not pa.has_origin
       or (m.is_remote and p_include_remote)
       or (not m.is_remote and m.distance_km is not null and (pa.radius = 0 or m.distance_km <= pa.radius))
  ),
  enriched as (
    select r.*,
           (select li.url from public.listing_images li where li.listing_id = r.id order by li.position limit 1) as cover_url,
           (select count(*)::int from public.listing_images li where li.listing_id = r.id) as image_count,
           coalesce((select round(avg(rv.rating), 2) from public.reviews rv where rv.reviewee_id = r.user_id), 0) as poster_rating,
           coalesce((select count(*)::int from public.reviews rv where rv.reviewee_id = r.user_id), 0) as poster_reviews,
           coalesce((select count(*)::int from public.listings pl where pl.user_id = r.user_id and pl.status = 'completed'), 0) as poster_completed,
           exists (select 1 from me, unnest(me.trades) t where public.fold_text(t) = public.fold_text(r.category)
                     or public.fold_text(r.category) like '%' || public.fold_text(t) || '%'
                     or public.fold_text(t) like '%' || public.fold_text(split_part(r.category, '/', 1)) || '%') as trade_match,
           (select count(*) > 0 from me where cardinality(me.trades) > 0) as has_trades
    from in_range r
  ),
  scored as (
    select e.*,
      round((
        3.0 * e.text_rank
      + 1.6 * exp(-extract(epoch from now() - e.created_at) / 3600.0 / 72.0)
      + 1.2 * (case when e.is_remote then 0.8 when e.distance_km is null then 0.5 else greatest(0, 1 - e.distance_km / 120.0) end)
      + 1.1 * (case when e.bid_count = 0 then 1 when e.bid_count <= 2 then 0.8 when e.bid_count <= 5 then 0.5 else 0.25 end)
      + 0.8 * ((case when e.price is not null then 0.4 else 0 end) + (case when length(coalesce(e.description, '')) > 80 then 0.3 else 0 end) + (case when e.image_count > 0 then 0.3 else 0 end))
      + 0.9 * least(1, 0.4 + 0.1 * least(e.poster_completed, 4) + (case when e.poster_reviews > 0 and e.poster_rating >= 4.5 then 0.2 else 0 end))
      + 1.4 * (case when not e.has_trades then 0.5 when e.trade_match then 1 else 0.2 end)
      + 0.7 * (case when e.due_date is null then 0 when e.due_date - pa.today <= 1 then 1 when e.due_date - pa.today <= 3 then 0.5 else 0 end)
      )::numeric, 4) as score
    from enriched e cross join params pa
  )
  select s.id, s.user_id, s.title, s.description, s.category, s.location, s.price, s.currency, s.status, s.created_at,
         s.lat, s.lng, s.is_remote, s.cover_url, s.image_count, s.bid_count as offers, s.distance_km, s.text_rank,
         s.poster_rating, s.poster_reviews, s.poster_completed, s.score, count(*) over () as total_count,
         s.date_type, s.due_date, s.time_of_day, s.travel_allowance
  from scored s cross join params pa
  order by
    case when pa.sort = 'recommended' then s.score end desc nulls last,
    case when pa.sort = 'closest' then coalesce(s.distance_km, 1e9) end asc,
    case when pa.sort = 'offers' then s.bid_count end desc,
    case when pa.sort = 'price_asc' then coalesce(s.price, 1e12) end asc,
    case when pa.sort = 'price_desc' then s.price end desc nulls last,
    case when pa.sort = 'oldest' then s.created_at end asc,
    case when pa.sort = 'due_soon' then coalesce(s.due_date, date '9999-12-31') end asc,
    s.created_at desc
  limit (select lim from params) offset (select off from params);
$function$;



-- =============================================================================
-- supabase/airtasker/04_reach_and_travel.sql
-- =============================================================================

-- ============================================================================
-- Doseg ponuda (reach) and travel costs
--
-- A poorly paid in-person job can only be taken by providers close by; the better it pays,
-- the further away a provider may be. The poster can add a travel allowance ("Platiću put":
-- gorivo, taksi, prevoz) and that counts toward the pay, so it widens the reach.
--
--   pay = price + travel_allowance        (straight-line km from the provider's city)
--   price not set ("Po dogovoru")  -> 25 km, or more if the travel allowance alone reaches a wider tier
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

-- km a provider may be from the job, or null for no limit.
-- "Po dogovoru" never drops below the 25 km no-budget reach: travel money only widens it.
create or replace function public.listing_reach_km(p_price numeric, p_travel numeric)
returns numeric language sql immutable set search_path = public
as $$
  select case
    when t.pay >= 800 then null
    else greatest(
      case when t.pay < 50 then 15 when t.pay < 100 then 25 when t.pay < 200 then 40 when t.pay < 400 then 70 else 120 end,
      case when p_price is null then 25 else 0 end)
  end::numeric
  from (select coalesce(p_price, 0) + coalesce(p_travel, 0) as pay) t
$$;

create or replace function public.listing_is_remote(p_location text)
returns boolean language sql stable set search_path = public
as $$
  select public.fold_text(coalesce(p_location, '')) like '%online%' or public.fold_text(coalesce(p_location, '')) like '%daljin%'
$$;

-- Where the signed-in person stands for one job: the reach, their distance and whether they may offer.
-- reason: ok | remote | no_limit | no_job_location | no_city | unknown_city | too_far | own_job | signed_out | invited
-- unknown_city: the profile city is set but not on our map; distance can't be measured, so it doesn't block.
-- A private quote request (05) has no reach: only the invited provider may offer, from anywhere.
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
  select id, user_id, location, lat, lng, price, travel_allowance, invited_provider into l from public.listings where id = p_listing;
  if l.id is null then return; end if;
  if l.invited_provider is not null then
    if auth.uid() = l.invited_provider then
      return query select null::numeric, null::numeric, true, 'invited'::text, null::text;
    elsif auth.uid() = l.user_id then
      return query select null::numeric, null::numeric, false, 'own_job'::text, null::text;
    end if;
    return;
  end if;
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
    if r is not null and coalesce(btrim(me.city), '') <> '' then
      return query select r, null::numeric, true, 'unknown_city'::text, me.city; return;
    end if;
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
  select location, lat, lng, price, travel_allowance, invited_provider into l from public.listings where id = new.listing_id;
  -- private quote requests have no reach limit; 05 makes sure only the invited provider offers
  if l is null or l.invited_provider is not null or public.listing_is_remote(l.location) or l.lat is null or l.lng is null then return new; end if;
  r := public.listing_reach_km(l.price, l.travel_allowance);
  if r is null then return new; end if;
  select p.city, c.lat, c.lng into me
  from public.profiles p left join lateral public.coords_for_location(p.city) c on true
  where p.user_id = new.bidder_id;
  if me.lat is null then
    if coalesce(btrim(me.city), '') = '' then
      raise exception 'GRAD_POTREBAN: dodaj svoj grad u profil da vidimo koliko si daleko od posla'
        using errcode = 'P0001';
    end if;
    return new;  -- a city we can't place on the map: distance unknown, so don't block the offer
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
-- has passed, none outside the provider's reach and no private quote requests. Jobs due
-- today or tomorrow get up to 10 extra points ("Treba brzo"), like Airtasker's urgent tasks.
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
           l.bid_count::bigint as bid_count, l.due_date - public.today_ba() as days_left,
           round((extract(epoch from now() - l.created_at) / 86400.0)::numeric, 2) as days_old,
           (select count(*) from public.listing_images li where li.listing_id = l.id) as photos,
           (public.fold_text(coalesce(l.location, '')) like '%online%' or public.fold_text(coalesce(l.location, '')) like '%daljin%') as is_remote
    from public.listings l cross join me
    where l.status = 'published' and l.user_id <> me.user_id
      and l.invited_provider is null
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
      + (case when s.photos > 0 then 3 else 0 end)
      + (case when s.days_left <= 1 then 10 when s.days_left <= 3 then 5 else 0 end))::numeric as points   -- max 130
    from scored s
  )
  select
    r.id, r.title, r.category, r.location, r.price, r.currency, r.created_at, r.bid_count,
    round(least(100, r.points / 1.2), 0) as match_score,
    array_remove(array[
      case when r.trade_match then 'Odgovara tvojim vještinama' end,
      case when r.bids_in_category > 0 then 'Slično poslovima na koje si nudio/la' end,
      case when r.distance_km is not null and r.distance_km <= 15 then 'U blizini' when r.city_match then 'U tvom gradu' when r.distance_km is not null then round(r.distance_km)::int || ' km od tebe' end,
      case when r.days_left <= 1 then 'Treba brzo' when r.days_left <= 3 then 'Rok za ' || r.days_left || ' dana' end,
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


-- =============================================================================
-- supabase/offers/bid_replies.sql
-- =============================================================================

-- ============================================================================
-- Privatni odgovori ispod ponude + obavijest kad izvođač izmijeni ponudu
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Kao Airtasker: klijent i izvođač mogu kratko razmijeniti poruke ispod JEDNE
-- ponude prije prihvatanja (pojašnjenje cijene, termina, šta je uključeno).
-- Vide ih samo njih dvoje (i tim). Pišu se samo dok je ponuda 'pending' —
-- poslije prihvatanja razgovor ide u chat. Pravilo #1 (bez kontakata) provodi
-- postojeći moderate_content(), isti kao za ponude i pitanja.
--
-- Izmjena same ponude ne treba novu dozvolu: bids_bidder_manage već pušta
-- izvođača da mijenja svoju ponudu dok je 'pending', guard_bid_status_change
-- je zaključava poslije odluke, a moderate_bids provjerava novi opis. Ovdje se
-- samo dodaje obavijest klijentu da je ponuda izmijenjena.
-- ============================================================================

create table if not exists public.bid_replies (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists bid_replies_bid_idx on public.bid_replies (bid_id, created_at);

alter table public.bid_replies enable row level security;

-- Je li pozivalac izvođač te ponude ili vlasnik posla.
create or replace function public.is_bid_party(p_bid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.bids b join public.listings l on l.id = b.listing_id
    where b.id = p_bid and auth.uid() in (b.bidder_id, l.user_id)
  );
$fn$;

revoke execute on function public.is_bid_party(uuid) from public, anon;
grant execute on function public.is_bid_party(uuid) to authenticated;

drop policy if exists bid_replies_read on public.bid_replies;
create policy bid_replies_read on public.bid_replies for select to authenticated
  using (public.is_bid_party(bid_id) or public.is_staff());

drop policy if exists bid_replies_write on public.bid_replies;
create policy bid_replies_write on public.bid_replies for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_suspended()
    and public.is_bid_party(bid_id)
    and exists (select 1 from public.bids b where b.id = bid_id and b.status = 'pending')
  );

-- Bez izmjene i brisanja: ono što je rečeno uz ponudu ostaje zapisano.
revoke all on public.bid_replies from anon;
grant select, insert on public.bid_replies to authenticated;

-- Pravilo #1: maskira kontakte i zabranjen sadržaj, dodijeli opomenu.
drop trigger if exists moderate_bid_replies on public.bid_replies;
create trigger moderate_bid_replies before insert on public.bid_replies
  for each row execute function public.moderate_content('author_id', 'body');

-- Kratko pojašnjenje, ne zamjena za chat: najviše 20 poruka po autoru i ponudi.
create or replace function public.limit_bid_replies()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (select count(*) from public.bid_replies where bid_id = new.bid_id and author_id = new.author_id) >= 20 then
    raise exception 'PREVISE_ODGOVORA' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists limit_bid_replies on public.bid_replies;
create trigger limit_bid_replies before insert on public.bid_replies
  for each row execute function public.limit_bid_replies();

-- Druga strana dobije obavijest.
create or replace function public.on_bid_reply_notify()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_bidder uuid; v_owner uuid; v_listing uuid; v_title text;
begin
  select b.bidder_id, l.user_id, l.id, l.title into v_bidder, v_owner, v_listing, v_title
  from public.bids b join public.listings l on l.id = b.listing_id where b.id = new.bid_id;

  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (
    case when new.author_id = v_bidder then v_owner else v_bidder end,
    'offer_reply',
    case when new.author_id = v_bidder then 'Izvođač je odgovorio uz ponudu' else 'Klijent ti je pisao uz ponudu' end,
    coalesce(v_title, 'Posao') || ' · ' || left(new.body, 80),
    '/listings/' || v_listing::text,
    'bidreply:' || new.id::text
  ) on conflict do nothing;
  return new;
end $fn$;

drop trigger if exists bid_reply_notify on public.bid_replies;
create trigger bid_reply_notify after insert on public.bid_replies
  for each row execute function public.on_bid_reply_notify();

-- Klijent saznaje kad izvođač promijeni cijenu ili opis ponude.
create or replace function public.on_bid_edited_notify()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_owner uuid; v_title text;
begin
  if new.status = 'pending' and (new.amount is distinct from old.amount or new.message is distinct from old.message) then
    select user_id, title into v_owner, v_title from public.listings where id = new.listing_id;
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (
      v_owner, 'offer_updated',
      'Ponuda izmijenjena: ' || rtrim(rtrim(new.amount::text, '0'), '.') || ' KM',
      coalesce(v_title, 'Posao'),
      '/listings/' || new.listing_id::text,
      'bidupd:' || new.id::text || ':' || extract(epoch from now())::bigint::text
    ) on conflict do nothing;
  end if;
  return new;
end $fn$;

drop trigger if exists bid_edited_notify on public.bids;
create trigger bid_edited_notify after update of amount, message on public.bids
  for each row execute function public.on_bid_edited_notify();

revoke execute on function public.limit_bid_replies(), public.on_bid_reply_notify(), public.on_bid_edited_notify()
  from public, anon, authenticated;


-- =============================================================================
-- supabase/payments/02_price_increase_and_cancellation_policy.sql
-- =============================================================================

-- ============================================================================
-- Kao na Airtaskeru: povećanje cijene tokom posla i pravila otkazivanja
-- ----------------------------------------------------------------------------
-- POVEĆANJE CIJENE: izvođač traži dodatni iznos uz razlog ("ispostavilo se da
-- treba još jedna utičnica"). Klijent odobri i dodatni iznos se odmah osigura
-- s njegovog balansa, ili odbije. Bez odobrenja se ništa ne naplaćuje, a klijent
-- odgovara na tačno taj zahtjev (id), pa ga izvođač ne može podmetnuti drugim.
--
-- OTKAZIVANJE: ko traži prekid kaže ko je odgovoran (on sam ili druga strana),
-- a druga strana to prihvata ili odbija (tada ostaje spor). Odgovorna strana:
--   * plaća naknadu za otkazivanje: 10 % cijene, najviše 50 KM, osim ako je
--     prekid zatražen u prvom satu nakon prihvatanja ponude;
--   * ako je to izvođač, posao mu se računa kao neuspješan (stopa uspješnosti);
--   * upisuje se na oglasu (listings.cancel_reason = 'client' | 'provider').
-- Klijentova naknada se zadrži od povrata. Izvođačeva se skine s balansa, a ono
-- što nedostaje naplati se od prve sljedeće zarade.
-- ============================================================================

-- ---------------------------------------------------------------- 0. Vrste stavki
alter table public.wallet_transactions drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions add constraint wallet_transactions_kind_check check (kind = any (array[
  'admin_credit', 'admin_debit', 'bonus', 'refund', 'fee', 'payout', 'purchase', 'promo',
  'escrow_hold', 'escrow_refund', 'job_income',
  'card_topup', 'payout_hold', 'payout_return', 'cancel_fee'
]));

-- naknada za otkazivanje umanjuje i iznos koji se smije isplatiti
create or replace function public.withdrawable_km(p_user uuid default auth.uid()) returns numeric
language sql stable security definer set search_path = public as $fn$
  select greatest(0, least(
    coalesce((select balance from public.profiles where user_id = p_user), 0),
    coalesce((select sum(amount) from public.wallet_transactions
               where user_id = p_user and kind in ('job_income', 'payout_hold', 'payout_return', 'payout', 'cancel_fee')), 0)
  ));
$fn$;
revoke execute on function public.withdrawable_km(uuid) from public, anon, authenticated;

-- ======================================================= 1. POVEĆANJE CIJENE
create table if not exists public.price_increase_requests (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references public.job_payments(id) on delete cascade,
  requested_by  uuid not null references auth.users(id) on delete cascade,
  amount_km     numeric(12,2) not null check (amount_km between 1 and 2000),
  reason        text not null check (char_length(btrim(reason)) between 10 and 1000),
  state         text not null default 'pending' check (state in ('pending', 'accepted', 'declined', 'withdrawn')),
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists price_increase_one_pending_idx on public.price_increase_requests (payment_id) where state = 'pending';

alter table public.price_increase_requests enable row level security;
drop policy if exists price_increase_party on public.price_increase_requests;
create policy price_increase_party on public.price_increase_requests for select to authenticated
  using (exists (select 1 from public.job_payments jp where jp.id = payment_id
                  and (auth.uid() in (jp.client_id, jp.provider_id) or public.is_staff())));
revoke insert, update, delete on public.price_increase_requests from anon, authenticated;

create or replace function public.request_price_increase(p_listing uuid, p_amount numeric, p_reason text)
returns public.price_increase_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.price_increase_requests; v_title text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() is distinct from v_row.provider_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_row.status <> 'funded' or v_row.work_state not in ('in_progress', 'revision') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount < 1 or p_amount > 2000 then
    raise exception 'POVECANJE_IZNOS: dodatni iznos mora biti između 1 i 2.000 KM' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.price_increase_requests where payment_id = v_row.id and state = 'pending') then
    raise exception 'POVECANJE_VEC_CEKA: već postoji zahtjev koji čeka odgovor' using errcode = 'P0001';
  end if;
  if (select count(*) from public.price_increase_requests where payment_id = v_row.id) >= 3 then
    raise exception 'POVECANJE_LIMIT: najviše 3 zahtjeva za povećanje po poslu' using errcode = 'P0001';
  end if;

  insert into public.price_increase_requests (payment_id, requested_by, amount_km, reason)
  values (v_row.id, auth.uid(), p_amount, btrim(p_reason))
  returning * into v_req;

  select title into v_title from public.listings where id = p_listing;
  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.client_id, 'job', 'Izvođač traži povećanje cijene',
     '+' || trim(to_char(p_amount, 'FM999G999D00')) || ' KM za „' || v_title || '“. Ništa se ne naplaćuje dok ne odobriš.',
     '/listings/' || p_listing::text);
  return v_req;
end $fn$;

create or replace function public.cancel_price_increase(p_request uuid)
returns public.price_increase_requests
language plpgsql security definer set search_path = public as $fn$
declare v_req public.price_increase_requests;
begin
  update public.price_increase_requests set state = 'withdrawn', responded_at = now()
   where id = p_request and requested_by = auth.uid() and state = 'pending'
  returning * into v_req;
  if v_req.id is null then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;
  return v_req;
end $fn$;

-- Klijent odgovara na TAČNO ovaj zahtjev. Prihvatanje odmah osigura dodatni iznos
-- s balansa klijenta (INSUFFICIENT ako nema dovoljno) i podigne cijenu posla.
create or replace function public.respond_price_increase(p_request uuid, p_accept boolean)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_req public.price_increase_requests; v_row public.job_payments; v_title text; v_amount numeric;
begin
  select * into v_req from public.price_increase_requests where id = p_request for update;
  if v_req.id is null then raise exception 'NEMA_ZAHTJEVA' using errcode = 'P0001'; end if;
  select * into v_row from public.job_payments where id = v_req.payment_id for update;
  if auth.uid() is distinct from v_row.client_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_req.state <> 'pending' then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;
  select title into v_title from public.listings where id = v_row.listing_id;

  if not p_accept then
    update public.price_increase_requests set state = 'declined', responded_at = now() where id = v_req.id;
    insert into public.notifications (user_id, type, title, message, link) values
      (v_row.provider_id, 'job', 'Povećanje cijene nije prihvaćeno',
       'Klijent nije odobrio dodatnih ' || trim(to_char(v_req.amount_km, 'FM999G999D00')) || ' KM za „' || v_title || '“. Posao ide po dogovorenoj cijeni.',
       '/listings/' || v_row.listing_id::text);
    return v_row;
  end if;

  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_row.status <> 'funded' or v_row.work_state not in ('in_progress', 'revision', 'submitted') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;

  perform public.wallet_move(v_row.client_id, -v_req.amount_km, 'escrow_hold',
    'Povećanje cijene · ' || v_title);

  v_amount := v_row.amount + v_req.amount_km;
  update public.job_payments
     set amount = v_amount,
         fee_amount = round(v_amount * fee_percent / 100, 2),
         net_amount = round(v_amount - v_amount * fee_percent / 100, 2)
   where id = v_row.id
  returning * into v_row;
  update public.price_increase_requests set state = 'accepted', responded_at = now() where id = v_req.id;

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.provider_id, 'job', 'Povećanje cijene odobreno 🎉',
     'Klijent je odobrio +' || trim(to_char(v_req.amount_km, 'FM999G999D00')) || ' KM. Nova cijena je ' || trim(to_char(v_amount, 'FM999G999D00')) || ' KM i osigurana je na Zadatku.',
     '/listings/' || v_row.listing_id::text);
  return v_row;
end $fn$;

revoke execute on function public.request_price_increase(uuid, numeric, text) from public, anon;
revoke execute on function public.cancel_price_increase(uuid) from public, anon;
revoke execute on function public.respond_price_increase(uuid, boolean) from public, anon;
grant execute on function public.request_price_increase(uuid, numeric, text),
  public.cancel_price_increase(uuid), public.respond_price_increase(uuid, boolean) to authenticated;

-- ===================================================== 2. PRAVILA OTKAZIVANJA
alter table public.cancellation_requests add column if not exists responsible text
  check (responsible in ('client', 'provider'));
alter table public.cancellation_requests add column if not exists fee_km numeric(12,2) not null default 0;

create table if not exists public.cancellation_fees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  payment_id  uuid references public.job_payments(id) on delete set null,
  amount_km   numeric(12,2) not null check (amount_km > 0),
  collected_km numeric(12,2) not null default 0,
  status      text not null default 'owed' check (status in ('owed', 'paid', 'waived')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists cancellation_fees_owed_idx on public.cancellation_fees (user_id) where status = 'owed';

alter table public.cancellation_fees enable row level security;
drop policy if exists cancellation_fees_own on public.cancellation_fees;
create policy cancellation_fees_own on public.cancellation_fees for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.cancellation_fees from anon, authenticated;

-- 10 % cijene, najviše 50 KM; bez naknade ako je prekid zatražen u prvom satu.
create or replace function public.cancellation_fee_for(p_payment public.job_payments)
returns numeric language sql stable set search_path = public as $fn$
  select case when p_payment.funded_at is not null and now() < p_payment.funded_at + interval '1 hour' then 0
              else least(50, round(p_payment.amount * 0.10, 2)) end;
$fn$;
revoke execute on function public.cancellation_fee_for(public.job_payments) from public, anon, authenticated;

-- Naplati dugovane naknade koliko balans dozvoljava (najstarije prve).
create or replace function public.collect_cancellation_fees(p_user uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare f public.cancellation_fees; v_balance numeric; v_take numeric;
begin
  for f in select * from public.cancellation_fees where user_id = p_user and status = 'owed' order by created_at for update loop
    select balance into v_balance from public.profiles where user_id = p_user;
    v_take := least(coalesce(v_balance, 0), f.amount_km - f.collected_km);
    exit when v_take <= 0;
    perform public.wallet_move(p_user, -v_take, 'cancel_fee', 'Naknada za otkazan posao', p_user);
    update public.cancellation_fees
       set collected_km = collected_km + v_take,
           status = case when collected_km + v_take >= amount_km then 'paid' else 'owed' end,
           paid_at = case when collected_km + v_take >= amount_km then now() end
     where id = f.id;
  end loop;
end $fn$;
revoke execute on function public.collect_cancellation_fees(uuid) from public, anon, authenticated;

-- Svaka nova zarada prvo pokrije dugovanu naknadu.
create or replace function public.collect_fees_on_income() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.kind = 'job_income' and exists (select 1 from public.cancellation_fees where user_id = new.user_id and status = 'owed') then
    perform public.collect_cancellation_fees(new.user_id);
  end if;
  return null;
end $fn$;
revoke execute on function public.collect_fees_on_income() from public, anon, authenticated;

drop trigger if exists wallet_collect_cancellation_fees on public.wallet_transactions;
create trigger wallet_collect_cancellation_fees after insert on public.wallet_transactions
  for each row when (new.kind = 'job_income') execute function public.collect_fees_on_income();

-- request_cancellation sa odgovornom stranom. p_responsible: 'me' (ja prekidam)
-- ili 'other' (druga strana nije ispoštovala dogovor). Stari poziv sa tri
-- argumenta i dalje radi i znači 'me'.
drop function if exists public.request_cancellation(uuid, text, text);
create or replace function public.request_cancellation(p_listing uuid, p_reason_code text, p_detail text default null, p_responsible text default 'me')
returns public.cancellation_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.cancellation_requests; v_me text; v_resp text; v_fee numeric;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_row.client_id, v_row.provider_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(p_responsible, 'me') not in ('me', 'other') then raise exception 'BAD_RESPONSIBLE' using errcode = 'P0001'; end if;

  v_me := case when auth.uid() = v_row.client_id then 'client' else 'provider' end;
  v_resp := case when coalesce(p_responsible, 'me') = 'me' then v_me
                 when v_me = 'client' then 'provider' else 'client' end;
  v_fee := public.cancellation_fee_for(v_row);

  insert into public.cancellation_requests (payment_id, requested_by, reason_code, detail, prev_state, restore_deadline, responsible, fee_km)
  values (v_row.id, auth.uid(), p_reason_code, p_detail, v_row.work_state, v_row.review_deadline, v_resp, v_fee)
  returning * into v_req;

  perform public.job_transition(v_row.id, 'cancel_requested',
    jsonb_build_object('razlog', p_reason_code, 'iz_stanja', v_row.work_state, 'odgovoran', v_resp));

  insert into public.notifications (user_id, type, title, message, link) values
    (case when auth.uid() = v_row.client_id then v_row.provider_id else v_row.client_id end,
     'job', 'Zatražen je prekid posla',
     case when v_resp = v_me then 'Druga strana traži sporazumni prekid i preuzima odgovornost.'
          else 'Druga strana traži prekid i navodi da si ti odgovoran/na. Ako se ne slažeš, odbij ili otvori spor.' end
     || ' Dok ne odgovoriš, novac ostaje osiguran na Zadatku.',
     '/listings/' || p_listing::text);
  return v_req;
end $fn$;

revoke execute on function public.request_cancellation(uuid, text, text, text) from public, anon;
grant execute on function public.request_cancellation(uuid, text, text, text) to authenticated;

-- Kad druga strana prihvati: povrat klijentu (cancel_job_payment), zatim naknada
-- odgovorne strane i upis ko je odgovoran (to broji stopu uspješnosti izvođača).
create or replace function public.respond_cancellation(p_listing uuid, p_accept boolean, p_note text default null)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.cancellation_requests; v_resp text; v_title text; v_fee_id uuid;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_row.client_id, v_row.provider_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into v_req from public.cancellation_requests where payment_id = v_row.id and state = 'pending' for update;
  if v_req.id is null then raise exception 'NEMA_ZAHTJEVA' using errcode = 'P0001'; end if;
  if v_req.requested_by = auth.uid() then raise exception 'NA_SVOJ_ZAHTJEV_SE_NE_ODGOVARA' using errcode = '42501'; end if;

  update public.cancellation_requests
     set state = case when p_accept then 'accepted' else 'declined' end,
         responded_by = auth.uid(), responded_at = now()
   where id = v_req.id;

  if not p_accept then
    select * into v_row from public.job_transition(v_row.id, coalesce(v_req.prev_state, 'in_progress'),
      jsonb_build_object('odbijeno', true, 'napomena', p_note));
    update public.job_payments set review_deadline = v_req.restore_deadline
     where id = v_row.id returning * into v_row;
    insert into public.notifications (user_id, type, title, message, link) values
      (v_req.requested_by, 'job', 'Prekid nije prihvaćen',
       'Druga strana nije pristala na prekid. Ako se ne možete dogovoriti, otvori spor.',
       '/listings/' || p_listing::text);
    return v_row;
  end if;

  perform public.job_transition(v_row.id, 'cancelled', jsonb_build_object('napomena', p_note));
  v_row := public.cancel_job_payment(p_listing, 'Sporazumni prekid');

  -- stari zahtjevi (prije ovih pravila) nemaju odgovornu stranu: ko je tražio
  v_resp := coalesce(v_req.responsible,
                     case when v_req.requested_by = v_row.client_id then 'client' else 'provider' end);
  update public.price_increase_requests set state = 'withdrawn', responded_at = now()
   where payment_id = v_row.id and state = 'pending';

  perform set_config('poso.system_write', '1', true);
  update public.listings set cancel_reason = v_resp where id = p_listing;
  perform set_config('poso.system_write', '', true);
  perform public.refresh_user_badges(v_row.provider_id);
  perform public.refresh_user_badges(v_row.client_id);

  if v_req.fee_km > 0 then
    select title into v_title from public.listings where id = p_listing;
    insert into public.cancellation_fees (user_id, payment_id, amount_km)
    values (case when v_resp = 'client' then v_row.client_id else v_row.provider_id end, v_row.id, v_req.fee_km)
    returning id into v_fee_id;
    perform public.collect_cancellation_fees(case when v_resp = 'client' then v_row.client_id else v_row.provider_id end);
    insert into public.notifications (user_id, type, title, message, link) values
      (case when v_resp = 'client' then v_row.client_id else v_row.provider_id end, 'wallet',
       'Naknada za otkazivanje',
       trim(to_char(v_req.fee_km, 'FM999G999D00')) || ' KM za otkazan posao „' || v_title || '“'
       || case when v_resp = 'provider' then '. Ako nemaš dovoljno na balansu, ostatak se naplati od sljedeće zarade.' else '.' end,
       '/account/novcanik');
  end if;
  return v_row;
end $fn$;

revoke execute on function public.respond_cancellation(uuid, boolean, text) from public, anon;
grant execute on function public.respond_cancellation(uuid, boolean, text) to authenticated;


-- =============================================================================
-- supabase/identity/id_badge_counts.sql
-- =============================================================================

-- ============================================================================
-- Značka "Lična karta verifikovana" i potvrđen identitet su ista stvar
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Vlasnik (04.10.2026.): ko ima značku "Lična karta verifikovana" smije
-- objavljivati poslove. Do sada su postojala dva odvojena puta:
--   * JMBG + dokument (identity_verifications) → profiles.identity_state = 'approved';
--     značku NE dodjeljuje;
--   * stranica Značke (verification_requests, kind 'identity') → značka id_verified;
--     identity_state NE mijenja.
-- Kapija (identity_verified(), koju koriste can_post_job() i ponude) gledala je samo
-- prvi put, pa bi korisnik sa značkom bio blokiran.
--
-- Ova datoteka:
--   1. identity_verified() prihvata i značku id_verified (dodjeljuje je samo tim:
--      user_badges i odobravanje verification_requests smije samo admin);
--   2. odobrenje kroz JMBG tok dodjeljuje i značku, pa svako ko smije objavljivati
--      ima značku na profilu;
--   3. dodjeljuje značku već odobrenim korisnicima.
-- Važi i za objavu posla i za ponude. Idempotentno.
-- ============================================================================

create or replace function public.identity_verified(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select p.identity_state = 'approved'
           or exists (select 1 from public.user_badges ub join public.badges b on b.id = ub.badge_id
                      where ub.user_id = p_user and b.code = 'id_verified')
           or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                      where ur.user_id = p_user and r.name in ('ADMIN', 'MODERATOR'))
    from public.profiles p where p.user_id = p_user
  ), false);
$fn$;

revoke execute on function public.identity_verified(uuid) from public, anon;
grant execute on function public.identity_verified(uuid) to authenticated;

create or replace function public.award_id_badge_on_identity_approved()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.state = 'approved' and old.state is distinct from new.state then
    perform public.set_badge(new.user_id, 'id_verified', true);
  end if;
  return new;
end $fn$;

revoke execute on function public.award_id_badge_on_identity_approved() from public, anon, authenticated;

create or replace trigger identity_approved_badge after update of state on public.identity_verifications
  for each row execute function public.award_id_badge_on_identity_approved();

select public.set_badge(p.user_id, 'id_verified', true)
from public.profiles p where p.identity_state = 'approved';


-- =============================================================================
-- supabase/offers/job_conditions.sql
-- =============================================================================

-- ============================================================================
-- Uslovi i pogodnosti posla: klijent traži značke, baza ih provjerava
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Klijent pri objavi posla bira:
--   * USLOVE  — značke koje izvođač mora imati da bi poslao ponudu
--               (telefon, uvjerenje o nekažnjavanju, licence…);
--   * POGODNOSTI — šta klijent obezbjeđuje (materijal, alat, parking, obrok).
--     Plaćanje puta/goriva već postoji kao listings.travel_allowance (airtasker/01).
--
-- Sve stoji u listings.conditions (jsonb):
--   {"requires": ["licence_electrician", "police_check"], "perks": ["materials", "parking"]}
--
-- Gradi se na postojećem: značke su badges/user_badges (dodjeljuje ih samo tim
-- ili sistemski okidači), identitet je identity_verified(). Lična karta je ionako
-- uslov za svaku ponudu (bids_require_verified.sql), pa se "id_verified" ne bira.
--
-- Provjera ponude ide u bazu (okidač + restriktivna politika), ne samo u sučelje:
-- izvođač bez tražene značke ne može poslati ponudu ni direktnim API pozivom.
-- Nema zaobilaznice za testere u ovoj datoteci — testni nalozi sa svim značkama
-- postoje samo u privatnoj test bazi (robot/local-db).
-- Idempotentno: može se pokrenuti više puta.
-- ============================================================================

-- 1. Katalog: koje značke klijent smije tražiti i koje pogodnosti postoje.
--    Funkcija je immutable da bi je check constraint smio koristiti.
create or replace function public.job_requirement_codes()
returns text[]
language sql immutable set search_path = public as $fn$
  select array['mobile_verified', 'police_check', 'payment_verified',
               'licence_electrician', 'licence_plumber', 'licence_gas',
               'licence_hvac', 'licence_construction', 'licence_driver'];
$fn$;

create or replace function public.job_perk_codes()
returns text[]
language sql immutable set search_path = public as $fn$
  select array['materials', 'tools', 'parking', 'meal', 'transport_help'];
$fn$;

create or replace function public.job_conditions_valid(p jsonb)
returns boolean
language sql immutable set search_path = public as $fn$
  select jsonb_typeof(p) = 'object'
     and not exists (select 1 from jsonb_object_keys(p) k where k not in ('requires', 'perks'))
     and (not p ? 'requires' or (
           jsonb_typeof(p->'requires') = 'array'
           and jsonb_array_length(p->'requires') <= 5
           and not exists (select 1 from jsonb_array_elements(p->'requires') e
                           where jsonb_typeof(e) <> 'string' or not (e #>> '{}') = any (public.job_requirement_codes()))))
     and (not p ? 'perks' or (
           jsonb_typeof(p->'perks') = 'array'
           and jsonb_array_length(p->'perks') <= 6
           and not exists (select 1 from jsonb_array_elements(p->'perks') e
                           where jsonb_typeof(e) <> 'string' or not (e #>> '{}') = any (public.job_perk_codes()))));
$fn$;

grant execute on function public.job_requirement_codes() to anon, authenticated;
grant execute on function public.job_perk_codes() to anon, authenticated;
grant execute on function public.job_conditions_valid(jsonb) to anon, authenticated;

-- 2. Kolona na poslu
alter table public.listings add column if not exists conditions jsonb not null default '{}'::jsonb;
alter table public.listings drop constraint if exists listings_conditions_check;
alter table public.listings add constraint listings_conditions_check check (public.job_conditions_valid(conditions));

-- 3. Akreditivi korisnika: kodovi značaka koje drži + 'id_verified' kad je identitet
--    potvrđen (isto pravilo kao kapija za ponude). SECURITY DEFINER jer
--    identity_state nije javan; drugi korisnik dobija samo javne značke.
create or replace function public.user_credentials(p_user uuid default auth.uid())
returns text[]
language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(distinct code order by code), '{}')
  from (
    select b.code from public.user_badges ub join public.badges b on b.id = ub.badge_id
    where ub.user_id = p_user
    union all
    select 'id_verified'
    where (p_user = auth.uid() or public.is_admin())
      and public.identity_verified(p_user)
  ) c;
$fn$;

revoke execute on function public.user_credentials(uuid) from public, anon;
grant execute on function public.user_credentials(uuid) to authenticated;

-- 4. Šta prijavljeni korisnik trenutno smije (jedno mjesto za sučelje).
create or replace function public.my_permissions()
returns jsonb
language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'credentials', to_jsonb(public.user_credentials(auth.uid())),
    'identity_verified', public.identity_verified(auth.uid()),
    'suspended', public.is_suspended(),
    'can_post_job', public.identity_verified(auth.uid()) and not public.is_suspended(),
    'can_bid', public.identity_verified(auth.uid()) and not public.is_suspended()
  )
  where auth.uid() is not null;
$fn$;

revoke execute on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

-- 5. Nedostajuće značke za ponudu na ovaj posao (prazno = smije).
create or replace function public.job_missing_requirements(p_listing uuid, p_user uuid default auth.uid())
returns text[]
language sql stable security definer set search_path = public as $fn$
  select coalesce(array_agg(r order by r), '{}')
  from public.listings l,
       jsonb_array_elements_text(coalesce(l.conditions->'requires', '[]'::jsonb)) r
  where l.id = p_listing
    and not exists (select 1 from public.user_badges ub join public.badges b on b.id = ub.badge_id
                    where ub.user_id = p_user and b.code = r);
$fn$;

revoke execute on function public.job_missing_requirements(uuid, uuid) from public, anon, authenticated;

create or replace function public.bid_meets_conditions(p_listing uuid, p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select cardinality(public.job_missing_requirements(p_listing, p_user)) = 0;
$fn$;

revoke execute on function public.bid_meets_conditions(uuid, uuid) from public, anon;
grant execute on function public.bid_meets_conditions(uuid, uuid) to authenticated;

-- 6. Kapija na ponudama: okidač daje jasnu poruku (USLOV_POSLA + kodovi),
--    restriktivna politika drži i kad bi okidač nekad bio uklonjen.
create or replace function public.guard_bid_conditions()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_missing text[];
begin
  v_missing := public.job_missing_requirements(new.listing_id, new.bidder_id);
  if cardinality(v_missing) > 0 then
    raise exception 'USLOV_POSLA: nedostaju značke %', array_to_string(v_missing, ',')
      using errcode = '42501', hint = 'conditions_required', detail = array_to_string(v_missing, ',');
  end if;
  return new;
end $fn$;

revoke execute on function public.guard_bid_conditions() from public, anon, authenticated;

drop trigger if exists bids_conditions_gate on public.bids;
create trigger bids_conditions_gate before insert on public.bids
  for each row execute function public.guard_bid_conditions();

drop policy if exists bids_insert_conditions on public.bids;
create policy bids_insert_conditions on public.bids as restrictive for insert to authenticated
  with check (public.bid_meets_conditions(listing_id, auth.uid()));

-- 7. Uslovi se ne mijenjaju kad je izvođač već izabran (ponuda prihvaćena).
create or replace function public.lock_conditions_after_assign()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.conditions is distinct from old.conditions
     and exists (select 1 from public.bids b where b.listing_id = new.id and b.status = 'accepted') then
    raise exception 'USLOVI_ZAKLJUCANI: izvođač je već izabran' using errcode = '42501';
  end if;
  return new;
end $fn$;

revoke execute on function public.lock_conditions_after_assign() from public, anon, authenticated;

drop trigger if exists listings_conditions_lock on public.listings;
create trigger listings_conditions_lock before update of conditions on public.listings
  for each row execute function public.lock_conditions_after_assign();


-- =============================================================================
-- supabase/booking/04_fraud_shield.sql
-- =============================================================================

-- =============================================================================
-- Zadatak · booking/04 — zaštita od prevare oko ponuda, statusa posla, escrowa
-- i dokaza na licu mjesta.
--
-- Nadograđuje booking/01–03 (koji su već na živoj bazi). Imena stanja ostaju ista:
--   listings.status:      published → assigned → completed / cancelled
--   job_payments.status:  funded → requested → released / refunded (ili disputed)
--   job_payments.work_state: in_progress → submitted → completed (+ revision,
--                            cancel_requested, disputed, cancelled)
-- "FUNDS_RESERVED" i "IN_PROGRESS" iz specifikacije su kod nas jedan korak: red u
-- job_payments nastaje tek kad je novac skinut s balansa, i odmah je in_progress.
--
-- Šta zatvara (sve provjereno na živoj bazi 05.10.2026., samo čitanjem):
--   1. Vlasnik je mogao direktnim API pozivom mijenjati listings.status: vratiti
--      plaćen posao u 'published' (nove ponude), proglasiti ga 'completed' bez isplate
--      ili 'cancelled' sa krivicom izvođača (kvari mu uspješnost). booking/03 je to
--      imao, ali nije primijenjen jer je dugme "Posao završen" pisalo direktno.
--      Ovdje je pravilo uže, pa to dugme i dalje radi za stare poslove bez uplate.
--   2. job_transition() je bila izvršiva za svakog prijavljenog: strana koja je
--      tražila prekid mogla je sama sebi upisati 'cancelled' i zaključati ugovor
--      (novac zaglavi), ili preskočiti predaju rada bez dokaza.
--   3. Stari request_job_payment() i open_job_dispute() mijenjali su status uplate
--      mimo state machine-a (bez dokaza, bez zapisa u job_events, ugovor zaglavi).
--   4. bidder_metrics() je svakome (i gostima) otkrivala KO je sve dao ponudu na
--      neki posao — dovoljno da se izvođači nađu i dogovore cijenu. Sada samo
--      vlasniku posla i timu.
--   5. Ništa u bazi nije garantovalo da red u job_payments odgovara stvarno
--      skinutom novcu i prihvaćenoj ponudi; iznos/strane su se mogli promijeniti
--      kasnije bilo kojom budućom funkcijom.
--   6. Nije bilo dokaza da je izvođač bio na licu mjesta.
--
-- Idempotentno: može se pustiti više puta. Ne mijenja nijednu funkciju iz
-- payments/02, airtasker/04 ni offers/bid_replies (rade i prije i poslije ovoga).
-- =============================================================================

-- ------------------------------------------------------------- 1. Slijepe ponude
-- bids RLS je već slijep (izvođač vidi samo svoj red, vlasnik posla sve) — ovo
-- zatvara jedinu rupu sa strane: funkciju koja vraća listu ponuđača.
create or replace function public.bidder_metrics(p_listing_id uuid)
returns table (user_id uuid, avg_rating numeric, review_count bigint, completed_jobs bigint, success_rate numeric, is_verified boolean)
language sql stable security definer set search_path = public
as $$
  select m.user_id, m.avg_rating, m.review_count, m.completed_jobs, m.success_rate, m.is_verified
    from public.provider_metrics() m
   where m.user_id in (select b.bidder_id from public.bids b where b.listing_id = p_listing_id)
     and (exists (select 1 from public.listings l where l.id = p_listing_id and l.user_id = auth.uid())
          or public.is_staff());
$$;
-- gosti je i dalje smiju pozvati (stranica posla je javna), ali dobijaju prazno
grant execute on function public.bidder_metrics(uuid) to anon, authenticated;

-- --------------------------------------------- 2. Status posla mijenja samo sistem
-- Vlasnik smije samo ono što ne dira novac ni tuđu reputaciju:
--   objaviti / povući / zatvoriti otvoren posao, i za stari posao bez uplate
--   (prihvaćen prije Zadatak Pay-a) označiti "završen" ili "otkazan".
-- Sve ostalo ('assigned', 'archived', izlazak iz completed/cancelled, bilo kakva
-- promjena dok postoji uplata) radi isključivo SECURITY DEFINER funkcija ili admin.
create or replace function public.guard_listing_status()
returns trigger language plpgsql set search_path = public
as $$
declare v_accepted boolean;
begin
  -- funkcije platforme (SECURITY DEFINER → current_user je vlasnik), cron i admin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  -- polja koja računa sistem
  new.completed_at := old.completed_at;
  new.cancelled_at := old.cancelled_at;
  new.bid_count := old.bid_count;
  new.created_at := old.created_at;

  if new.status is not distinct from old.status then
    new.cancel_reason := old.cancel_reason;
    return new;
  end if;

  if exists (select 1 from public.job_payments p where p.listing_id = old.id) then
    raise exception 'STATUS_ZAKLJUCAN: posao ima uplatu na Zadatku; status se mijenja samo kroz tok posla'
      using errcode = '42501';
  end if;
  if old.status in ('assigned', 'completed', 'cancelled', 'archived') then
    raise exception 'STATUS_ZAKLJUCAN: posao je zatvoren (%)', old.status using errcode = '42501';
  end if;
  if new.status not in ('draft', 'published', 'paused', 'closed', 'cancelled', 'completed') then
    raise exception 'STATUS_ZABRANJEN: % postavlja samo sistem', new.status using errcode = '42501';
  end if;

  select exists (select 1 from public.bids b where b.listing_id = old.id and b.status = 'accepted') into v_accepted;
  if new.status = 'completed' and not v_accepted then
    raise exception 'STATUS_ZABRANJEN: posao bez prihvaćene ponude ne može biti završen' using errcode = '42501';
  end if;
  -- krivica izvođača (računa mu se u uspješnost) samo ako je izvođač uopšte postojao
  if new.status = 'cancelled' and new.cancel_reason = 'provider' and not v_accepted then
    new.cancel_reason := 'client';
  end if;
  return new;
end $$;

drop trigger if exists listings_status_guard on public.listings;
create trigger listings_status_guard before update on public.listings
  for each row execute function public.guard_listing_status();

-- ------------------------------------- 3. Escrow: red = stvarno skinut novac
alter table public.job_payments add column if not exists proof_required boolean not null default false;

-- Pri nastanku ugovora baza sama provjerava: ponuda je ta, strane su te, iznos je
-- tačno iznos ponude, naknada je izračunata tačno, i U ISTOJ TRANSAKCIJI je sa
-- balansa klijenta skinut tačno taj iznos. Bez toga nema "in_progress".
create or replace function public.guard_job_payment_insert()
returns trigger language plpgsql set search_path = public
as $$
declare v_bid public.bids; v_listing public.listings;
begin
  select * into v_bid from public.bids where id = new.bid_id;
  select * into v_listing from public.listings where id = new.listing_id;
  if v_bid.id is null or v_listing.id is null or v_bid.listing_id <> v_listing.id then
    raise exception 'ESCROW_NEISPRAVAN: ponuda ne pripada poslu' using errcode = 'P0001';
  end if;
  if new.client_id is distinct from v_listing.user_id or new.provider_id is distinct from v_bid.bidder_id
     or new.client_id = new.provider_id then
    raise exception 'ESCROW_NEISPRAVAN: strane ugovora ne odgovaraju poslu i ponudi' using errcode = 'P0001';
  end if;
  if new.amount is null or new.amount <= 0 or new.amount <> v_bid.amount then
    raise exception 'ESCROW_NEISPRAVAN: iznos % nije dogovoreni iznos ponude %', new.amount, v_bid.amount using errcode = 'P0001';
  end if;
  if new.fee_amount <> round(new.amount * new.fee_percent / 100, 2)
     or new.net_amount <> round(new.amount - new.amount * new.fee_percent / 100, 2) then
    raise exception 'ESCROW_NEISPRAVAN: naknada nije tačno obračunata' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.wallet_transactions w
     where w.user_id = new.client_id and w.kind = 'escrow_hold'
       and w.amount = -round(new.amount, 2) and w.created_at = now()   -- now() = početak ove transakcije
  ) then
    raise exception 'ESCROW_NIJE_OSIGURAN: iznos nije skinut s balansa klijenta' using errcode = 'P0001';
  end if;

  new.status := 'funded';
  new.work_state := 'in_progress';
  new.funded_at := now();
  -- posao na terenu (nije online): izvođač mora slikati prije i poslije, sa GPS-om
  new.proof_required := not (coalesce(v_listing.location, '') ~* '(online|daljin|remote)');
  return new;
end $$;

drop trigger if exists job_payments_insert_guard on public.job_payments;
create trigger job_payments_insert_guard before insert on public.job_payments
  for each row execute function public.guard_job_payment_insert();

-- Nakon nastanka: strane, ponuda, posao i postotak naknade se nikad ne mijenjaju.
-- Iznos smije samo rasti (odobreno povećanje cijene, payments/02), i samo ako je
-- razlika u istoj transakciji skinuta s balansa klijenta.
create or replace function public.guard_job_payment_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.listing_id is distinct from old.listing_id or new.bid_id is distinct from old.bid_id
     or new.client_id is distinct from old.client_id or new.provider_id is distinct from old.provider_id
     or new.fee_percent is distinct from old.fee_percent or new.funded_at is distinct from old.funded_at
     or new.created_at is distinct from old.created_at or new.proof_required is distinct from old.proof_required then
    raise exception 'ESCROW_ZAKLJUCAN: strane i uslovi ugovora se ne mijenjaju' using errcode = '42501';
  end if;
  if new.amount < old.amount then
    raise exception 'ESCROW_ZAKLJUCAN: osigurani iznos se ne smanjuje (povrat ide kroz spor ili prekid)' using errcode = '42501';
  end if;
  if new.amount > old.amount and not exists (
    select 1 from public.wallet_transactions w
     where w.user_id = old.client_id and w.kind = 'escrow_hold'
       and w.amount = -round(new.amount - old.amount, 2) and w.created_at = now()
  ) then
    raise exception 'ESCROW_NIJE_OSIGURAN: povećanje nije skinuto s balansa klijenta' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists job_payments_update_guard on public.job_payments;
create trigger job_payments_update_guard before update on public.job_payments
  for each row execute function public.guard_job_payment_update();

-- ------------------------------------------- 4. State machine samo kroz akcije
-- job_transition je interni korak akcija (submit_work, approve_work, open_dispute,
-- request_cancellation…). Direktno pozvana preskakala je njihove provjere.
revoke all on function public.job_transition(uuid, public.work_state, jsonb) from public, anon, authenticated;
revoke all on function public.job_transition_system(uuid, public.work_state, jsonb) from public, anon, authenticated;
-- stari putevi iz prvog Zadatak Pay-a: zamijenjeni sa submit_work i open_dispute
revoke all on function public.request_job_payment(uuid) from public, anon, authenticated;
revoke all on function public.open_job_dispute(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------ 5. Foto dokaz na licu mjesta
-- Slika se pravi kamerom u aplikaciji (ne iz galerije), aplikacija na nju utisne
-- GPS i UTC vrijeme, a baza zapisuje i SVOJE vrijeme prijema, udaljenost od
-- lokacije posla i SHA-256 otisak fajla (ista slika se ne može predati dvaput).
create table if not exists public.work_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.job_payments(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('before', 'after')),
  photo_url text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m numeric not null check (accuracy_m >= 0),
  captured_at timestamptz not null,               -- vrijeme uređaja (UTC), utisnuto na slici
  received_at timestamptz not null default now(), -- vrijeme servera, ne može se lažirati
  distance_m numeric,                             -- od tačke posla; null ako posao nema koordinate
  source text not null default 'camera' check (source in ('camera', 'camera_file')),
  created_at timestamptz not null default now()
);
create unique index if not exists work_proofs_sha256_key on public.work_proofs (sha256);
create index if not exists work_proofs_payment_idx on public.work_proofs (payment_id, kind, received_at);

alter table public.work_proofs enable row level security;
revoke all on public.work_proofs from anon, authenticated;
grant select on public.work_proofs to authenticated;
drop policy if exists work_proofs_party_read on public.work_proofs;
create policy work_proofs_party_read on public.work_proofs for select to authenticated
  using (exists (select 1 from public.job_payments p
                  where p.id = work_proofs.payment_id and auth.uid() in (p.client_id, p.provider_id))
         or public.is_staff());

-- udaljenost u metrima (haversine) — za jednu tačku PostGIS nije potreban
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns numeric language sql immutable set search_path = public
as $$
  select round((2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::numeric, 0)
$$;

create or replace function public.add_work_proof(
  p_listing uuid, p_kind text, p_photo_url text, p_sha256 text,
  p_lat double precision, p_lng double precision, p_accuracy_m numeric,
  p_captured_at timestamptz, p_source text default 'camera')
returns public.work_proofs
language plpgsql security definer set search_path = public
as $$
declare v_pay public.job_payments; v_listing public.listings; v_row public.work_proofs;
begin
  select * into v_pay from public.job_payments where listing_id = p_listing for update;
  if v_pay.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_pay.provider_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_pay.status <> 'funded' or v_pay.work_state not in ('in_progress', 'revision') then
    raise exception 'DOKAZ_NIJE_MOGUC: slike se dodaju dok posao traje' using errcode = 'P0001';
  end if;
  if p_kind not in ('before', 'after') then raise exception 'BAD_KIND' using errcode = 'P0001'; end if;
  if p_kind = 'after' and not exists (select 1 from public.work_proofs where payment_id = v_pay.id and kind = 'before') then
    raise exception 'PRVO_SLIKA_PRIJE: prvo slikaj stanje prije početka rada' using errcode = 'P0001';
  end if;
  -- slika mora biti u izvođačevom folderu u našem skladištu, ne bilo koji link:
  -- privatni bucket (security/06: vide je samo klijent, izvođač i tim) ili, za aplikaciju
  -- prije privatnog skladišta, javni "media" bucket
  if p_photo_url is null or p_photo_url like '%..%'
     or not (p_photo_url like 'private:uploads/' || auth.uid()::text || '/work/' || p_listing::text || '/%'
             or position('/storage/v1/object/public/media/' || auth.uid()::text || '/proof/' in p_photo_url) > 0) then
    raise exception 'DOKAZ_NEISPRAVAN: slika nije poslana iz aplikacije' using errcode = 'P0001';
  end if;
  if p_sha256 is null or lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception 'DOKAZ_NEISPRAVAN: nedostaje otisak slike' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.work_proofs where sha256 = lower(p_sha256)) then
    raise exception 'DOKAZ_VEC_KORISTEN: ova slika je već predata' using errcode = 'P0001';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_lat = 0 and p_lng = 0) then
    raise exception 'GPS_OBAVEZAN: uključi lokaciju na telefonu' using errcode = 'P0001';
  end if;
  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 2000 then
    raise exception 'GPS_PRESLAB: lokacija nije dovoljno tačna (%) — izađi na otvoreno i pokušaj ponovo', p_accuracy_m using errcode = 'P0001';
  end if;
  -- slika je napravljena upravo sada (vrijeme uređaja se poredi sa serverom)
  if p_captured_at is null or p_captured_at < now() - interval '10 minutes' or p_captured_at > now() + interval '2 minutes' then
    raise exception 'DOKAZ_ZASTARIO: slika mora biti napravljena upravo sada (provjeri sat na telefonu)' using errcode = 'P0001';
  end if;
  if (select count(*) from public.work_proofs where payment_id = v_pay.id) >= 30 then
    raise exception 'PREVISE_SLIKA' using errcode = 'P0001';
  end if;

  select * into v_listing from public.listings where id = p_listing;
  insert into public.work_proofs (payment_id, provider_id, kind, photo_url, sha256, lat, lng, accuracy_m, captured_at, distance_m, source)
  values (v_pay.id, auth.uid(), p_kind, p_photo_url, lower(p_sha256), p_lat, p_lng, round(p_accuracy_m, 1), p_captured_at,
          case when v_listing.lat is not null and v_listing.lng is not null
               then public.geo_distance_m(v_listing.lat, v_listing.lng, p_lat, p_lng) end,
          case when p_source = 'camera_file' then 'camera_file' else 'camera' end)
  returning * into v_row;

  insert into public.job_events (payment_id, from_state, to_state, actor_id, actor_role, detail)
  values (v_pay.id, v_pay.work_state, v_pay.work_state, auth.uid(), 'provider',
          jsonb_build_object('dokaz', p_kind, 'lat', p_lat, 'lng', p_lng, 'tacnost_m', round(p_accuracy_m, 1),
                             'udaljenost_m', v_row.distance_m, 'sha256', v_row.sha256));
  return v_row;
end $$;
revoke all on function public.add_work_proof(uuid, text, text, text, double precision, double precision, numeric, timestamptz, text) from public, anon;
grant execute on function public.add_work_proof(uuid, text, text, text, double precision, double precision, numeric, timestamptz, text) to authenticated;

-- submit_work: isto kao booking/02, plus — za posao na terenu — slika PRIJE i
-- svježa slika POSLIJE (novija od zadnje predaje, da se ispravka ne preda starom slikom).
create or replace function public.submit_work(p_listing uuid, p_report text, p_evidence text[] default '{}'::text[])
returns public.job_payments
language plpgsql security definer set search_path = public
as $$
declare v_row public.job_payments; v_rev smallint; v_last timestamptz;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'NOVAC_NIJE_U_ESCROWU' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_report, ''))) < 20 and coalesce(array_length(p_evidence, 1), 0) = 0 then
    raise exception 'DOKAZ_JE_OBAVEZAN: prilozi slike ili napisi izvjestaj (min. 20 znakova)' using errcode = 'P0001';
  end if;

  if v_row.proof_required then
    if not exists (select 1 from public.work_proofs where payment_id = v_row.id and kind = 'before') then
      raise exception 'FOTO_PRIJE_OBAVEZAN: slikaj stanje prije početka rada (kamerom, sa lokacijom)' using errcode = 'P0001';
    end if;
    select max(submitted_at) into v_last from public.work_submissions where payment_id = v_row.id;
    if not exists (select 1 from public.work_proofs where payment_id = v_row.id and kind = 'after'
                     and received_at > coalesce(v_last, '-infinity'::timestamptz)) then
      raise exception 'FOTO_POSLIJE_OBAVEZAN: slikaj urađen posao (kamerom, sa lokacijom)' using errcode = 'P0001';
    end if;
  end if;

  v_rev := v_row.revision_count;
  insert into public.work_submissions (payment_id, provider_id, revision_no, report, evidence_urls)
  values (v_row.id, auth.uid(), v_rev, btrim(p_report), p_evidence);

  perform public.job_transition(v_row.id, 'submitted',
    jsonb_build_object('revision_no', v_rev, 'dokaza', coalesce(array_length(p_evidence, 1), 0)));

  update public.job_payments
     set submitted_at = now(), review_deadline = now() + interval '72 hours', status = 'requested'
   where id = v_row.id returning * into v_row;

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.client_id, 'job', 'Rad je predat na pregled',
     'Izvođač je označio posao završenim i priložio dokaz. Imaš 72 sata da pregledaš i odobriš — nakon toga se uplata oslobađa automatski.',
     '/listings/' || p_listing::text);
  return v_row;
end $$;

-- automatska isplata nakon 72 h (booking/02) — osigurati da je zakazana
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('auto-release-reviews', '*/15 * * * *', $c$ select public.auto_release_expired_reviews(); $c$);
  end if;
end $$;


-- =============================================================================
-- supabase/booking/05_live_location.sql
-- =============================================================================

-- ============================================================================
-- BOOKING 05 — „Izvođač je na putu“: lokacija uživo za klijenta
-- ----------------------------------------------------------------------------
-- Izvođač sam uključi dijeljenje kad krene na posao; klijent tog posla vidi
-- tačku na mapi uživo (Supabase Realtime). Pravila:
--   • samo izvođač na plaćenom poslu u toku (in_progress / revision) šalje;
--   • vide samo klijent i izvođač tog posla (i tim podrške);
--   • čuva se SAMO zadnja tačka (nema istorije kretanja);
--   • gasi se samo: kad izvođač preda rad, kad se posao završi/prekine/ode u
--     spor, kad bilo ko od njih dvoje klikne „Zaustavi“, ili nakon 3 h tišine.
-- Lokacija se ne šalje iz pozadine: radi dok izvođač ima otvoren Zadatak.
-- Bezbjedno ponovo pokrenuti.
-- ============================================================================

create table if not exists public.job_live_locations (
  payment_id  uuid primary key references public.job_payments(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  client_id   uuid not null references auth.users(id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy_m  real,
  heading     real,
  speed_mps   real,
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.job_live_locations enable row level security;
drop policy if exists live_location_parties on public.job_live_locations;
create policy live_location_parties on public.job_live_locations for select to authenticated
  using ((client_id = auth.uid() or provider_id = auth.uid() or public.is_staff())
         and updated_at > now() - interval '3 hours');

-- pisanje samo kroz funkcije ispod
revoke all on public.job_live_locations from anon, authenticated;
grant select on public.job_live_locations to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.job_live_locations;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ------------------------------------------------------ izvođač šalje tačku
create or replace function public.share_live_location(
  p_listing uuid, p_lat double precision, p_lng double precision,
  p_accuracy_m real default null, p_heading real default null, p_speed_mps real default null
) returns timestamptz
language plpgsql security definer set search_path = public as $fn$
declare v_pay public.job_payments; v_last timestamptz;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_pay from public.job_payments where listing_id = p_listing;
  if v_pay.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_pay.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_pay.status <> 'funded' or v_pay.work_state not in ('in_progress', 'revision') then
    raise exception 'LOKACIJA_NIJE_MOGUCA: dijeljenje lokacije radi samo dok je posao u toku' using errcode = 'P0001';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'LOKACIJA_NEISPRAVNA' using errcode = 'P0001';
  end if;

  -- najviše jedna tačka u 3 sekunde po poslu (telefon u autu ne smije zatrpati bazu)
  select updated_at into v_last from public.job_live_locations where payment_id = v_pay.id;
  if v_last is not null and v_last > now() - interval '3 seconds' then return v_last; end if;

  insert into public.job_live_locations as l
    (payment_id, provider_id, client_id, lat, lng, accuracy_m, heading, speed_mps)
  values (v_pay.id, v_pay.provider_id, v_pay.client_id, p_lat, p_lng,
          least(greatest(p_accuracy_m, 0), 100000), p_heading, greatest(p_speed_mps, 0))
  on conflict (payment_id) do update set
    lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
    heading = excluded.heading, speed_mps = excluded.speed_mps, updated_at = now(),
    -- nakon pauze duže od 3 h ovo je novi polazak
    started_at = case when l.updated_at < now() - interval '3 hours' then now() else l.started_at end;

  -- klijent dobije jednu obavijest po polasku, ne po tački
  if v_last is null or v_last < now() - interval '3 hours' then
    insert into public.notifications (user_id, type, title, message, link) values
      (v_pay.client_id, 'job', 'Izvođač je krenuo',
       'Izvođač dijeli lokaciju dok dolazi. Otvori posao da ga vidiš na mapi.',
       '/listings/' || p_listing::text);
  end if;
  return now();
end $fn$;

-- --------------------------------------- bilo koja strana gasi dijeljenje
create or replace function public.stop_live_location(p_listing uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
begin
  delete from public.job_live_locations l
   using public.job_payments p
   where p.listing_id = p_listing and l.payment_id = p.id
     and (p.provider_id = auth.uid() or p.client_id = auth.uid());
end $fn$;

-- ------------------------- gasi se samo kad posao više nije „u toku“
create or replace function public.live_location_cleanup()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.status <> 'funded' or new.work_state not in ('in_progress', 'revision') then
    delete from public.job_live_locations where payment_id = new.id;
  end if;
  return new;
end $fn$;

drop trigger if exists live_location_cleanup on public.job_payments;
create trigger live_location_cleanup after update of status, work_state on public.job_payments
  for each row execute function public.live_location_cleanup();

revoke all on function public.share_live_location(uuid, double precision, double precision, real, real, real) from public, anon;
revoke all on function public.stop_live_location(uuid) from public, anon;
revoke all on function public.live_location_cleanup() from public, anon, authenticated;
grant execute on function public.share_live_location(uuid, double precision, double precision, real, real, real) to authenticated;
grant execute on function public.stop_live_location(uuid) to authenticated;


-- =============================================================================
-- supabase/marketplace/01_promoted_and_rebids.sql
-- =============================================================================

-- =============================================================================
-- Zadatak · marketplace/01 — izdvojeni oglasi (Hitno / VIP) i nova cijena nakon
-- odbijene ponude.
--
-- 1. Izdvojeni oglas: klijent plaća sa Zadatak Pay balansa (kartice dolaze kasnije).
--      Hitno  5 KM, 3 dana  — žuto istaknut u listi, uvijek iznad običnih oglasa
--      VIP   15 KM, 7 dana  — prvi u listi, veći zlatni pin koji pulsira na mapi
--    Cijene i trajanje su u tabeli promotion_plans (admin ih mijenja bez novog koda).
--    listings.promotion_tier / promoted_until mijenja SAMO promote_listing(): direktan
--    API poziv ih ne može postaviti, pa se izdvajanje ne može dobiti bez plaćanja.
--    is_promoted je izračunato polje (PostgREST: select=*,is_promoted): istekla
--    promocija se sama gasi, bez cron-a.
--    promoted_listings() vraća aktivne izdvojene oglase sa ISTIM filterima kao
--    pretraga (tekst, kategorija, grad + radijus, online), pa ih stranica pretrage
--    stavlja na vrh. search_listings ostaje netaknut (nema sukoba s performance/01).
--
-- 2. Nova cijena nakon odbijene ponude: tabela bids nikad nije imala unique pravilo,
--    ali sučelje je izvođača nakon "Odbij" zaključavalo zauvijek. Sada sme poslati
--    novu cijenu, uz pravila protiv spama:
--      - najviše jedna ponuda na čekanju po poslu (staru mijenja "Izmijeni ponudu"),
--      - nova cijena mora biti drugačija od odbijene,
--      - najviše 3 nove cijene nakon odbijanja (4 ukupno) i 8 ponuda ukupno po poslu.
--    Obavijest o odbijanju dok je posao još otvoren sada kaže "pošalji novu cijenu"
--    i vodi na posao (ranije: "Klijent je izabrao drugog izvođača" i link na pretragu).
--    Kad klijent prihvati nekog drugog, poruka ostaje stara.
--
-- Slijepe ponude iz booking/04 ostaju: izvođač i dalje vidi samo svoje ponude.
-- Idempotentno: može se pustiti više puta, prije ili poslije ostalih fajlova.
-- =============================================================================

-- ------------------------------------------------------------ 1a. Planovi
create table if not exists public.promotion_plans (
  tier     text primary key check (tier in ('hitno', 'vip')),
  label    text not null,
  price_km numeric(8, 2) not null check (price_km > 0),
  days     integer not null check (days between 1 and 60),
  rank     smallint not null
);
insert into public.promotion_plans (tier, label, price_km, days, rank) values
  ('hitno', 'Hitno', 5, 3, 1),
  ('vip', 'VIP', 15, 7, 2)
on conflict (tier) do nothing;

alter table public.promotion_plans enable row level security;
drop policy if exists promotion_plans_read on public.promotion_plans;
create policy promotion_plans_read on public.promotion_plans for select using (true);
drop policy if exists promotion_plans_admin on public.promotion_plans;
create policy promotion_plans_admin on public.promotion_plans for all using (public.is_admin()) with check (public.is_admin());
grant select on public.promotion_plans to anon, authenticated;

-- ------------------------------------------------------- 1b. Kolone na poslu
alter table public.listings add column if not exists promotion_tier text not null default 'standard';
alter table public.listings add column if not exists promoted_until timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_promotion_tier_check') then
    alter table public.listings add constraint listings_promotion_tier_check check (promotion_tier in ('standard', 'hitno', 'vip'));
  end if;
end $$;
create index if not exists listings_promoted_idx on public.listings (promoted_until) where promotion_tier <> 'standard';

create or replace function public.is_promoted(l public.listings)
returns boolean language sql stable set search_path = public
as $$ select l.promotion_tier <> 'standard' and l.promoted_until is not null and l.promoted_until > now() $$;
grant execute on function public.is_promoted(public.listings) to anon, authenticated;

-- izdvajanje se kupuje samo kroz promote_listing(); klijent ga ne može sam upisati
create or replace function public.guard_listing_promotion()
returns trigger language plpgsql set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.promotion_tier := 'standard';
    new.promoted_until := null;
  else
    new.promotion_tier := old.promotion_tier;
    new.promoted_until := old.promoted_until;
  end if;
  return new;
end $$;
drop trigger if exists listings_promotion_guard on public.listings;
create trigger listings_promotion_guard before insert or update of promotion_tier, promoted_until on public.listings
  for each row execute function public.guard_listing_promotion();

-- ------------------------------------------------- 1c. Zapis svake kupovine
create table if not exists public.listing_promotions (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  tier       text not null,
  price_km   numeric(8, 2) not null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz not null
);
create index if not exists listing_promotions_listing_idx on public.listing_promotions (listing_id);
create index if not exists listing_promotions_user_idx on public.listing_promotions (user_id, starts_at desc);
alter table public.listing_promotions enable row level security;
drop policy if exists listing_promotions_read on public.listing_promotions;
create policy listing_promotions_read on public.listing_promotions for select using (user_id = auth.uid() or public.is_staff());
grant select on public.listing_promotions to authenticated;

-- ------------------------------------------------------ 1d. Kupovina
create or replace function public.promote_listing(p_listing_id uuid, p_tier text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.promotion_plans;
  v_listing public.listings;
  v_current_rank smallint;
  v_balance numeric;
  v_until timestamptz;
begin
  if v_uid is null then raise exception 'PRIJAVA_POTREBNA' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;

  select * into v_plan from public.promotion_plans where tier = p_tier;
  if v_plan.tier is null then raise exception 'IZDVAJANJE_NEPOZNATO: nepoznat paket' using errcode = 'P0001'; end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if v_listing.id is null or v_listing.user_id <> v_uid then
    raise exception 'IZDVAJANJE_NIJE_TVOJ: izdvojiti možeš samo svoj posao' using errcode = '42501';
  end if;
  if v_listing.status <> 'published' or (v_listing.due_date is not null and v_listing.due_date < public.today_ba()) then
    raise exception 'IZDVAJANJE_ZATVOREN: posao više ne prima ponude' using errcode = 'P0001';
  end if;
  if v_listing.invited_provider is not null then
    raise exception 'IZDVAJANJE_PRIVATNI: privatni zahtjev vidi samo jedan izvođač' using errcode = 'P0001';
  end if;
  if v_listing.promoted_until is not null and v_listing.promoted_until > now() then
    select rank into v_current_rank from public.promotion_plans where tier = v_listing.promotion_tier;
    if coalesce(v_current_rank, 0) >= v_plan.rank then
      raise exception 'IZDVAJANJE_VEC_AKTIVNO: posao je već izdvojen' using errcode = 'P0001';
    end if;
  end if;

  -- skida tačno cijenu paketa; INSUFFICIENT ako nema dovoljno (cijela kupovina se poništava)
  v_balance := public.wallet_move(v_uid, -v_plan.price_km, 'purchase',
    'Izdvojeni oglas (' || v_plan.label || ', ' || v_plan.days || ' dana) · ' || left(v_listing.title, 80), v_uid);
  v_until := now() + make_interval(days => v_plan.days);

  update public.listings set promotion_tier = v_plan.tier, promoted_until = v_until where id = v_listing.id;
  insert into public.listing_promotions (listing_id, user_id, tier, price_km, ends_at)
  values (v_listing.id, v_uid, v_plan.tier, v_plan.price_km, v_until);

  return jsonb_build_object('tier', v_plan.tier, 'promoted_until', v_until, 'balance', v_balance);
end $$;
revoke all on function public.promote_listing(uuid, text) from public, anon;
grant execute on function public.promote_listing(uuid, text) to authenticated;

-- paketi + moj balans u jednom pozivu (forma za objavu; ujedno provjera da je ovaj fajl na bazi)
create or replace function public.promotion_options()
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'plans', coalesce((select jsonb_agg(jsonb_build_object('tier', tier, 'label', label, 'price_km', price_km, 'days', days) order by rank)
                         from public.promotion_plans), '[]'::jsonb),
    'balance', (select balance from public.profiles where user_id = auth.uid())
  );
$$;
grant execute on function public.promotion_options() to anon, authenticated;

-- ------------------------------------------- 1e. Izdvojeni u radijusu pretrage
-- Isti filteri kao search_listings_core (tekst, kategorija, grad + radijus, online, budžet),
-- samo nad malim skupom aktivnih izdvojenih oglasa. VIP prije Hitno, pa bliži, pa noviji.
create or replace function public.promoted_listings(
  p_query text default '', p_category text default '', p_lat double precision default null, p_lng double precision default null,
  p_radius_km double precision default null, p_include_remote boolean default true,
  p_min_price numeric default null, p_max_price numeric default null, p_has_budget boolean default false, p_no_offers boolean default false,
  p_limit integer default 6)
returns table(id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text, status text,
  created_at timestamptz, lat double precision, lng double precision, is_remote boolean, cover_url text, image_count integer, offers integer,
  distance_km double precision, date_type text, due_date date, time_of_day text[], travel_allowance numeric,
  promotion_tier text, promoted_until timestamptz)
language sql stable security definer set search_path = public
as $$
  with pa as (
    select public.search_tsquery(p_query) as q,
           public.fold_text(coalesce(p_query, '')) as folded,
           nullif(btrim(coalesce(p_category, '')), '') as cat,
           (p_lat is not null and p_lng is not null) as has_origin,
           coalesce(p_radius_km, 0) as radius,
           public.today_ba() as today
  ),
  base as (
    select l.*,
           (public.fold_text(coalesce(l.location, '')) like '%online%' or public.fold_text(coalesce(l.location, '')) like '%daljin%') as remote
    from public.listings l cross join pa
    where l.promotion_tier <> 'standard' and l.promoted_until > now()
      and l.status = 'published' and l.invited_provider is null
      and (l.due_date is null or l.due_date >= pa.today)
      and (pa.q is null or l.search_tsv @@ pa.q or pa.folded operator(extensions.<%) public.fold_text(l.title))
      and (pa.cat is null or l.category = pa.cat)
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      and (not coalesce(p_has_budget, false) or l.price is not null)
      and (not coalesce(p_no_offers, false) or l.bid_count = 0)
  ),
  measured as (
    select b.*, case when pa.has_origin and not b.remote then public.distance_km(p_lat, p_lng, b.lat, b.lng) end as dist
    from base b cross join pa
  )
  select m.id, m.user_id, m.title, m.description, m.category, m.location, m.price, m.currency, m.status, m.created_at,
         m.lat, m.lng, m.remote,
         (select li.url from public.listing_images li where li.listing_id = m.id order by li.position limit 1),
         (select count(*)::int from public.listing_images li where li.listing_id = m.id),
         m.bid_count, m.dist, m.date_type, m.due_date, m.time_of_day, m.travel_allowance,
         m.promotion_tier, m.promoted_until
  from measured m cross join pa
  where not pa.has_origin or pa.radius = 0
     or (m.remote and coalesce(p_include_remote, true))
     or (not m.remote and m.dist is not null and m.dist <= pa.radius)
  order by (select pp.rank from public.promotion_plans pp where pp.tier = m.promotion_tier) desc nulls last,
           coalesce(m.dist, 0) asc, m.created_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;
grant execute on function public.promoted_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, integer) to anon, authenticated;

-- ------------------------------------- 2a. Nova cijena nakon odbijene ponude
create or replace function public.guard_bid_rebid()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_pending int; v_accepted int; v_rejected int; v_total int;
  v_last_rejected numeric;
begin
  -- dvije ponude istog izvođača na isti posao u istom trenutku: jedna čeka drugu
  perform pg_advisory_xact_lock(hashtextextended(new.listing_id::text || ':' || new.bidder_id::text, 0));

  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'accepted'),
         count(*) filter (where status = 'rejected'),
         count(*)
    into v_pending, v_accepted, v_rejected, v_total
    from public.bids where listing_id = new.listing_id and bidder_id = new.bidder_id;

  if v_accepted > 0 then
    raise exception 'POSAO_VEC_TVOJ: tvoja ponuda je već prihvaćena' using errcode = 'P0001';
  end if;
  if v_pending > 0 then
    raise exception 'PONUDA_VEC_CEKA: već imaš ponudu na čekanju; izmijeni nju' using errcode = 'P0001';
  end if;
  if v_rejected >= 3 or v_total >= 8 then
    raise exception 'PREVISE_PONUDA: na ovaj posao si poslao/la previše ponuda' using errcode = 'P0001';
  end if;

  select amount into v_last_rejected from public.bids
   where listing_id = new.listing_id and bidder_id = new.bidder_id and status = 'rejected'
   order by created_at desc limit 1;
  if v_last_rejected is not null and new.amount = v_last_rejected then
    raise exception 'ISTA_CIJENA: klijent je već odbio % KM; pošalji drugačiju cijenu', rtrim(rtrim(v_last_rejected::text, '0'), '.') using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists bids_rebid_guard on public.bids;
create trigger bids_rebid_guard before insert on public.bids
  for each row execute function public.guard_bid_rebid();

-- ------------------------------------------ 2b. Obavijest o odbijenoj ponudi
create or replace function public.on_bid_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_title text; v_status text; v_name text; v_amount text; v_taken boolean;
begin
  select user_id, title, status into v_owner, v_title, v_status from public.listings where id = new.listing_id;
  v_amount := case when new.amount is null then '?' else rtrim(rtrim(new.amount::text, '0'), '.') end;
  if TG_OP = 'INSERT' then
    if v_owner is null or v_owner = new.bidder_id then return new; end if;
    select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.bidder_id;
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (v_owner, 'offer', 'Nova ponuda: ' || v_amount || ' KM', coalesce(v_name, 'Izvođač') || ' · ' || coalesce(v_title, ''), '/listings/' || new.listing_id::text, 'bid:' || new.id::text);
  elsif TG_OP = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (new.bidder_id, 'offer_accepted', 'Ponuda prihvaćena 🎉', coalesce(v_title, 'Posao') || ' — uplata je osigurana, možeš početi.', '/listings/' || new.listing_id::text, 'bidacc:' || new.id::text)
    on conflict do nothing;
  elsif TG_OP = 'UPDATE' and new.status = 'rejected' and old.status = 'pending' then
    v_taken := v_status is distinct from 'published'
      or exists (select 1 from public.bids b where b.listing_id = new.listing_id and b.status = 'accepted');
    if v_taken then
      insert into public.notifications (user_id, type, title, message, link, dedupe_key)
      values (new.bidder_id, 'offer_rejected', 'Klijent je izabrao drugog izvođača', coalesce(v_title, 'Posao') || ' — hvala na ponudi. Novi poslovi stižu svaki dan.', '/search', 'bidrej:' || new.id::text)
      on conflict do nothing;
    else
      insert into public.notifications (user_id, type, title, message, link, dedupe_key)
      values (new.bidder_id, 'offer_rejected', 'Klijent je odbio ponudu od ' || v_amount || ' KM', coalesce(v_title, 'Posao') || ' — posao je još otvoren. Pošalji novu cijenu.', '/listings/' || new.listing_id::text, 'bidrej:' || new.id::text)
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

-- trigger funkcije se ne zovu direktno (isto kao security/09)
revoke execute on function public.guard_listing_promotion() from public, anon, authenticated;
revoke execute on function public.guard_bid_rebid() from public, anon, authenticated;
revoke execute on function public.on_bid_notify() from public, anon, authenticated;


-- =============================================================================
-- supabase/security/06_private_uploads.sql
-- =============================================================================

-- Privatni fajlovi (27.09.2026., dopunjeno 06.10.2026.)
--
-- Do sada su dokumenti za značke (uvjerenje o nekažnjavanju, licence, lična karta za značku),
-- slike u porukama, slike kao dokaz rada i foto dokaz na licu mjesta (booking/04) išli u bucket
-- "media", koji je javan. Lični dokumenti za verifikaciju identiteta (JMBG tok) su već u
-- privatnom "identity" bucketu (25.09.2026.).
--
-- Provjera na produkciji 06.10.2026. (samo čitanje): u "media" je 10 fajlova; pored slika
-- oglasa tu su i dva dokumenta za značku "Lična karta", dvije licence, slika iz poruke i dvije
-- slike dokaza rada. Pravilo media_read_public je dozvoljavalo SVAKOME (i bez prijave) da
-- izlista cijeli bucket i tako nađe linkove na te fajlove.
--
-- Nova pravila:
--   * nove takve datoteke idu u privatni bucket "uploads"; aplikacija čuva referencu
--     "private:uploads/<putanja>" i otvara je kratkotrajnim potpisanim linkom. Otvoriti je mogu:
--       <korisnik>/...                          -> vlasnik (postojeće pravilo uploads_select_own)
--       <korisnik>/chat/<razgovor>/...          -> oba učesnika razgovora
--       <korisnik>/work/<oglas>/...             -> klijent i izvođač tog posla (i foto dokaz)
--       sve                                     -> Zadatak tim (admin, moderator)
--   * "media" se više ne može izlistati: popis vide samo vlasnik fajla i tim, a za goste samo
--     slike oglasa i portfolija. Javni linkovi na postojeće slike rade kao i prije.
--   * "media" prima samo slike, video za portfolio i PDF (stara aplikacija u kešu telefona još
--     šalje dokumente tamo dok se ne osvježi); HTML, SVG i ostalo se odbija.
--   * private_uploads_enabled() kaže sajtu da su ova pravila na bazi; dok je nema, sajt
--     koristi stari put, pa redoslijed objave sajta i ove datoteke nije bitan.
--
-- Smije se pokrenuti više puta.

-- 1 -------------------------------------------------------------------------
update storage.buckets
   set public = false,
       file_size_limit = 15728640,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
                                  'image/heic', 'image/heif', 'application/pdf']
 where id = 'uploads';

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
                                  'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime',
                                  'application/pdf']
 where id = 'media';

-- 2 -------------------------------------------------------------------------
drop policy if exists uploads_read_staff on storage.objects;
create policy uploads_read_staff on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and public.is_staff());

drop policy if exists uploads_read_chat on storage.objects;
create policy uploads_read_chat on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = 'chat'
    and exists (
      select 1 from public.conversations c
      where c.id::text = (storage.foldername(name))[3]
        and auth.uid() in (c.participant_one, c.participant_two)
    )
  );

drop policy if exists uploads_read_work on storage.objects;
create policy uploads_read_work on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[2] = 'work'
    and exists (
      select 1 from public.job_payments jp
      where jp.listing_id::text = (storage.foldername(name))[3]
        and auth.uid() in (jp.client_id, jp.provider_id)
    )
  );

-- 3 -------------------------------------------------------------------------
-- Javni linkovi (/object/public/media/...) ne prolaze kroz ovo pravilo; ono važi za popis
-- (list) i preuzimanje preko API-ja. Brisanje slike oglasa (vlasnik) ga i dalje prolazi.
drop policy if exists media_read_public on storage.objects;
create policy media_read_public on storage.objects for select
  using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[2] = 'listings'                -- slike oglasa
      or name ~ '^[0-9a-f-]{36}/[0-9]+\.[A-Za-z0-9]+$'          -- portfolio (<korisnik>/<vrijeme>.<ext>)
      or (storage.foldername(name))[1] = auth.uid()::text      -- svoje fajlove
      or public.is_staff()
    )
  );

-- 4 -------------------------------------------------------------------------
create or replace function public.private_uploads_enabled()
returns boolean language sql immutable set search_path = '' as $$ select true $$;
grant execute on function public.private_uploads_enabled() to anon, authenticated;


-- =============================================================================
-- supabase/security/09_signed_in_only_functions.sql
-- =============================================================================

-- Zero-trust grants: functions that only make sense for a signed-in person are no longer callable
-- by guests (the anon key). Postgres gives EXECUTE to PUBLIC by default and Supabase also grants
-- it to anon, so both are revoked and authenticated keeps it explicitly.
--
-- The functions already check auth.uid() inside and fail for guests; this removes the guest entry
-- point altogether (the Supabase security advisor flagged 48 such functions).
--
-- Stays open to guests on purpose:
--   * helpers used inside RLS policies (is_admin, is_staff, is_suspended, is_email_verified,
--     identity_ok, i_bid_on, listing_hidden_from_me, listing_image_count): a guest reading a
--     public table evaluates its policies, so revoking them would break browsing;
--   * public pages: search_listings, search_providers, ranked_providers, platform_stats,
--     category_price_stats, public_profile_bundle, trust_summary, bidder_metrics,
--     quote_requests_enabled;
--   * claim_auth_handoff (the installed app claims the login before it has a session) and
--     log_client_error (errors on public pages).
-- Trigger functions: Postgres checks EXECUTE only when a trigger is created, never when it fires,
-- so revoking guest access changes nothing for inserts and updates; it only clears the advisor.
-- Safe to run more than once.

do $$
declare
  f regprocedure;
  -- every overload of these names is covered, so older and newer argument lists are both locked
  signed_in_only text[] := array[
    'approve_work',
    'submit_work',
    'request_revision',
    'request_cancellation',
    'respond_cancellation',
    'open_dispute',
    -- job_transition namjerno nije ovdje: booking/04 ga zatvara i za prijavljene
    -- (interni korak akcija); ova lista bi ga ponovo otvorila
    'submit_identity',
    'identity_claim_next',
    'identity_decide',
    'identity_reveal',
    'my_inbox',
    'chat_state',
    'fee_percent_for',
    'store_auth_handoff',
    'is_moderator',
    'is_staff_user'
  ];
  triggers_only text[] := array[
    'guard_bid_status_change',
    'guard_chat_lifecycle',
    'guard_identity_on_bid',
    'guard_identity_on_listing',
    'guard_listing_delete',
    'on_bid_notify',
    'on_listing_question_notify',
    'on_message_notify',
    'on_notification_push',
    'on_profile_created_welcome',
    'on_review_notify',
    'sync_listing_bid_count'
  ];
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(signed_in_only)
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(triggers_only)
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;


-- =============================================================================
-- Provjera: ako išta od gornjeg nedostaje, cijela transakcija se poništava
-- =============================================================================
do $verify$
declare
  missing text[] := '{}';
begin
  if public.phone_run_hit('Zato sto se ne javite ranije?') or not public.phone_run_hit('061 234 567') then
    missing := missing || 'security/07'::text;
  end if;
  if pg_get_functiondef('public.search_listings_core(text,text,double precision,double precision,double precision,boolean,numeric,numeric,boolean,boolean,text,integer,integer,boolean)'::regprocedure) not like '%lat_span%' then
    missing := missing || 'performance/01'::text;
  end if;
  if to_regprocedure('public.listing_reach(uuid)') is null
     or not exists (select 1 from pg_trigger where tgname = 'bids_reach_guard') then
    missing := missing || 'airtasker/04'::text;
  end if;
  if to_regclass('public.bid_replies') is null
     or not exists (select 1 from pg_trigger where tgname = 'bid_edited_notify') then
    missing := missing || 'offers/bid_replies'::text;
  end if;
  if to_regclass('public.price_increase_requests') is null
     or to_regprocedure('public.request_cancellation(uuid,text,text,text)') is null
     or to_regprocedure('public.request_cancellation(uuid,text,text)') is not null then
    missing := missing || 'payments/02'::text;
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'identity_approved_badge')
     or pg_get_functiondef('public.identity_verified(uuid)'::regprocedure) not like '%id_verified%' then
    missing := missing || 'identity/id_badge_counts'::text;
  end if;
  if not public.job_conditions_valid('{"requires":["licence_gas"],"perks":["materials"]}')
     or not exists (select 1 from pg_trigger where tgname = 'bids_conditions_gate')
     or not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'bids_insert_conditions') then
    missing := missing || 'offers/job_conditions'::text;
  end if;
  if to_regclass('public.work_proofs') is null
     or not exists (select 1 from pg_trigger where tgname = 'listings_status_guard')
     or not exists (select 1 from pg_trigger where tgname = 'job_payments_insert_guard')
     or has_function_privilege('authenticated', 'public.job_transition(uuid,public.work_state,jsonb)', 'execute') then
    missing := missing || 'booking/04'::text;
  end if;
  if to_regclass('public.job_live_locations') is null
     or to_regprocedure('public.share_live_location(uuid,double precision,double precision,real,real,real)') is null then
    missing := missing || 'booking/05'::text;
  end if;
  if (select count(*) from public.promotion_plans) < 2
     or to_regprocedure('public.promote_listing(uuid,text)') is null
     or not exists (select 1 from pg_trigger where tgname = 'bids_rebid_guard') then
    missing := missing || 'marketplace/01'::text;
  end if;
  if to_regprocedure('public.private_uploads_enabled()') is null
     or coalesce((select b.public from storage.buckets b where b.id = 'uploads'), true)
     or not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'uploads_read_work') then
    missing := missing || 'security/06'::text;
  end if;
  if has_function_privilege('anon', 'public.my_inbox()', 'execute')
     or has_function_privilege('anon', 'public.request_cancellation(uuid,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.submit_work(uuid,text,text[])', 'execute') then
    missing := missing || 'security/09'::text;
  end if;
  if cardinality(missing) > 0 then
    raise exception 'PROVJERA_NIJE_PROSLA: %', array_to_string(missing, ', ');
  end if;
end $verify$;

-- zapis u listu migracija (vidi se u Supabase → Database → Migrations); ako ne uspije, ne smeta
do $record$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version, name, statements)
    values ('20261006180000', 'rollout_2026_10_06_all_pending',
            array['-- supabase/rollout/2026-10-06_all_pending.sql (github.com/bilalishakcanada-wq/websample)'])
    on conflict (version) do nothing;
  end if;
exception when others then
  raise notice 'zapis migracije preskočen: %', sqlerrm;
end $record$;

commit;

select 'Gotovo: sve je primijenjeno na živu bazu.' as rezultat;
