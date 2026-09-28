-- Provider matching for a job: add the declared trades ("Vještine") as a signal — a moler with
-- "Moler" in their trades ranks above a random active provider even before their first bid.
CREATE OR REPLACE FUNCTION public.match_providers_for_listing(p_listing_id uuid, limit_count integer DEFAULT 6)
 RETURNS TABLE(user_id uuid, display_name text, city text, avatar_url text, avg_rating numeric, review_count bigint, is_verified boolean, success_rate numeric, match_score numeric, reasons text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with target as (
    select id, user_id as owner_id, category, location,
           lower(split_part(coalesce(category, ''), '/', 1)) as category_head
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
  trades as (
    select p.user_id,
           bool_or(lower(tr) = lower(t.category) or lower(t.category) like '%' || lower(tr) || '%' or lower(tr) like '%' || t.category_head || '%') as trade_match
    from public.profiles p cross join target t, unnest(coalesce(p.trades, array[]::text[])) as tr
    where t.category_head <> ''
    group by p.user_id
  ),
  scored as (
    select
      m.*,
      coalesce(a.category_bids, 0) as category_bids,
      coalesce(tr.trade_match, false) as trade_match,
      public.cities_match(m.city, t.location) as city_match,
      (m.days_since_activity <= 14) as recently_active,
      (m.days_since_joined <= 30 and m.total_bids = 0) as newcomer
    from public.provider_metrics() m
    cross join target t
    left join affinity a on a.bidder_id = m.user_id
    left join trades tr on tr.user_id = m.user_id
    where m.user_id <> t.owner_id
      and m.account_type in ('provider', 'both')
  )
  select
    s.user_id, s.display_name, s.city, s.avatar_url,
    s.avg_rating, s.review_count, s.is_verified, s.success_rate,
    round(
      least(s.category_bids, 5) * 8
      + (case when s.trade_match then 22 else 0 end)
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
      case when s.trade_match then 'Radi upravo ovu vrstu posla' end,
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
$function$;;
