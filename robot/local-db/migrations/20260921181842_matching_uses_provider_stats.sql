-- Provider suggestions for a job: precomputed stats + real distance + response speed.
CREATE OR REPLACE FUNCTION public.match_providers_for_listing(p_listing_id uuid, limit_count integer DEFAULT 6)
 RETURNS TABLE(user_id uuid, display_name text, city text, avatar_url text, avg_rating numeric, review_count bigint, is_verified boolean, success_rate numeric, match_score numeric, reasons text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with target as (
    select l.id, l.user_id as owner_id, l.category, l.location, public.fold_text(coalesce(l.category, '')) as cat,
           public.fold_text(split_part(coalesce(l.category, ''), '/', 1)) as category_head,
           coalesce(l.lat, c.lat) as lat, coalesce(l.lng, c.lng) as lng
    from public.listings l left join lateral public.coords_for_location(l.location) c on true
    where l.id = p_listing_id
  ),
  affinity as (
    select b.bidder_id, count(*) as category_bids
    from public.bids b join public.listings l on l.id = b.listing_id join target t on l.category = t.category
    group by b.bidder_id
  ),
  scored as (
    select s.*, p.trades,
      coalesce(a.category_bids, 0) as category_bids,
      exists (select 1 from unnest(coalesce(p.trades, '{}'::text[])) tr
              where public.fold_text(tr) = t.cat or t.cat like '%' || public.fold_text(tr) || '%' or (t.category_head <> '' and public.fold_text(tr) like '%' || t.category_head || '%')) as trade_match,
      public.cities_match(s.city, t.location) as city_match,
      public.distance_km(t.lat, t.lng, s.lat, s.lng)::numeric as distance_km,
      (s.days_since_activity <= 14) as recently_active,
      (s.days_since_joined <= 30 and s.total_bids = 0) as newcomer
    from public.provider_stats s
    join public.profiles p on p.user_id = s.user_id
    cross join target t
    left join affinity a on a.bidder_id = s.user_id
    where s.user_id <> t.owner_id and s.account_type in ('provider', 'both')
  )
  select
    s.user_id, s.display_name, s.city, s.avatar_url, s.avg_rating, s.review_count, s.is_verified, s.success_rate,
    round((
      least(s.category_bids, 5) * 8
      + (case when s.trade_match then 22 else 0 end)
      + (case when s.city_match then 15 else 0 end)
      + (case when s.distance_km is null then 5 else greatest(0, 20 - s.distance_km / 3) end)
      + greatest(0, (s.weighted_rating - 3) * 10)
      + coalesce(s.acceptance_rate, 0) * 12
      + coalesce(s.response_score, 0.5) * 16
      + (case when s.is_verified then 15 else 0 end)
      + s.badge_count * 3
      + least(s.completed_jobs, 10) * 2
      + (case when s.success_rate >= 90 and s.completed_jobs >= 3 then 8 else 0 end)
      + least(s.portfolio_count, 5) * 2
      + (case when s.recently_active then 8 else 0 end)
      + (case when s.newcomer then 6 else 0 end)
    )::numeric, 2) as match_score,
    array_remove(array[
      case when s.trade_match then 'Radi upravo ovu vrstu posla' end,
      case when s.category_bids > 0 then 'Već je radio slične poslove' end,
      case when s.distance_km is not null and s.distance_km <= 15 then 'U blizini' when s.city_match then 'Iz istog grada' end,
      case when s.review_count > 0 then s.avg_rating::text || ' ocjena (' || s.review_count || ')' end,
      case when s.median_reply_min is not null and s.median_reply_min <= 30 then 'Odgovara za pola sata' end,
      case when s.is_verified then 'Verifikovan profil' end,
      case when s.success_rate is not null and s.completed_jobs >= 3 then s.success_rate::int || '% uspješnih poslova' end,
      case when s.portfolio_count > 0 then 'Ima portfolio radova' end,
      case when s.recently_active then 'Aktivan nedavno' end,
      case when s.newcomer then 'Novi izvođač na platformi' end
    ], null) as reasons
  from scored s
  order by match_score desc, s.weighted_rating desc
  limit greatest(1, least(limit_count, 24));
$function$;

-- Jobs for a provider: trades, history, real distance from their city, freshness, competition.
CREATE OR REPLACE FUNCTION public.recommended_listings(limit_count integer DEFAULT 8)
 RETURNS TABLE(id uuid, title text, category text, location text, price numeric, currency text, created_at timestamp with time zone, bid_count bigint, match_score numeric, reasons text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
$function$;;
