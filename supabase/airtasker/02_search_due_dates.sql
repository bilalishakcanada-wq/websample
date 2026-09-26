-- ============================================================================
-- Search returns the task schedule and can sort by "Rok uskoro" (due soonest).
-- Same ranking as before (migration_search_ranking.sql); only additions:
--   * three extra output columns: date_type, due_date, time_of_day
--   * jobs whose date has passed never show up, even before the expiry job runs
--   * p_sort = 'due_soon': dated jobs by nearest date first, flexible ones after
-- The return type changes, so both functions are dropped and recreated.
-- Needs 01_task_schedule_and_expiry.sql first.
-- ============================================================================

drop function if exists public.search_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer);
drop function if exists public.search_listings_core(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer, boolean);

create function public.search_listings_core(p_query text, p_category text, p_lat double precision, p_lng double precision, p_radius_km double precision, p_include_remote boolean, p_min_price numeric, p_max_price numeric, p_has_budget boolean, p_no_offers boolean, p_sort text, p_limit integer, p_offset integer, p_fuzzy boolean)
 returns table(id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text, status text, created_at timestamp with time zone, lat double precision, lng double precision, is_remote boolean, cover_url text, image_count integer, offers integer, distance_km double precision, text_rank real, poster_rating numeric, poster_reviews integer, poster_completed integer, score numeric, total_count bigint, date_type text, due_date date, time_of_day text[])
 language sql stable security definer
 set search_path to 'public'
as $function$
  with params as (
    select public.search_tsquery(p_query) as q,
           public.fold_text(coalesce(p_query, '')) as folded,
           nullif(btrim(coalesce(p_category, '')), '') as cat,
           (p_lat is not null and p_lng is not null) as has_origin,
           coalesce(p_radius_km, 0) as radius,
           least(greatest(coalesce(p_limit, 50), 1), 200) as lim,
           greatest(coalesce(p_offset, 0), 0) as off,
           coalesce(p_sort, 'recommended') as sort,
           public.today_ba() as today
  ),
  me as (
    select coalesce(p.trades, '{}'::text[]) as trades from public.profiles p where p.user_id = auth.uid()
  ),
  pool as (
    select l.id, l.user_id, l.title, l.description, l.category, l.location, l.price, l.currency, l.status, l.created_at, l.lat, l.lng, l.bid_count, l.search_tsv, l.date_type, l.due_date, l.time_of_day
    from public.listings l cross join params pa
    where not p_fuzzy and l.status = 'published'
      and (l.due_date is null or l.due_date >= pa.today)
      and (pa.q is null or l.search_tsv @@ pa.q or pa.folded operator(extensions.<%) public.fold_text(l.title))
      and (pa.cat is null or l.category = pa.cat)
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      and (not p_has_budget or l.price is not null)
      and (not p_no_offers or l.bid_count = 0)
    order by l.created_at desc
    limit 3000
  ),
  fuzzy_pool as (
    select w.id, w.user_id, w.title, w.description, w.category, w.location, w.price, w.currency, w.status, w.created_at, w.lat, w.lng, w.bid_count, w.search_tsv, w.date_type, w.due_date, w.time_of_day
    from (
      select l.* from public.listings l cross join params pa
      where p_fuzzy and l.status = 'published'
        and (l.due_date is null or l.due_date >= pa.today)
        and (pa.cat is null or l.category = pa.cat)
        and (p_min_price is null or l.price >= p_min_price)
        and (p_max_price is null or l.price <= p_max_price)
        and (not p_has_budget or l.price is not null)
        and (not p_no_offers or l.bid_count = 0)
      order by l.created_at desc
      limit 5000
    ) w cross join params pa
    where extensions.word_similarity(pa.folded, public.fold_text(w.title)) >= 0.4
       or extensions.word_similarity(pa.folded, public.fold_text(coalesce(w.category, ''))) >= 0.4
  ),
  filtered as (
    select l.id, l.user_id, l.title, l.description, l.category, l.location, l.price, l.currency, l.status, l.created_at,
           l.lat, l.lng, l.bid_count, l.date_type, l.due_date, l.time_of_day,
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
      )::numeric, 4) as score
    from enriched e
  )
  select s.id, s.user_id, s.title, s.description, s.category, s.location, s.price, s.currency, s.status, s.created_at,
         s.lat, s.lng, s.is_remote, s.cover_url, s.image_count, s.bid_count as offers, s.distance_km, s.text_rank,
         s.poster_rating, s.poster_reviews, s.poster_completed, s.score, count(*) over () as total_count,
         s.date_type, s.due_date, s.time_of_day
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

create function public.search_listings(p_query text default ''::text, p_category text default ''::text, p_lat double precision default null::double precision, p_lng double precision default null::double precision, p_radius_km double precision default null::double precision, p_include_remote boolean default true, p_min_price numeric default null::numeric, p_max_price numeric default null::numeric, p_has_budget boolean default false, p_no_offers boolean default false, p_sort text default 'recommended'::text, p_limit integer default 50, p_offset integer default 0)
 returns table(id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text, status text, created_at timestamp with time zone, lat double precision, lng double precision, is_remote boolean, cover_url text, image_count integer, offers integer, distance_km double precision, text_rank real, poster_rating numeric, poster_reviews integer, poster_completed integer, score numeric, total_count bigint, date_type text, due_date date, time_of_day text[])
 language plpgsql stable security definer
 set search_path to 'public'
as $function$
begin
  return query select * from public.search_listings_core(p_query, p_category, p_lat, p_lng, p_radius_km, p_include_remote, p_min_price, p_max_price, p_has_budget, p_no_offers, p_sort, p_limit, p_offset, false);
  if not found and coalesce(btrim(p_query), '') <> '' and coalesce(p_offset, 0) = 0 then
    return query select * from public.search_listings_core(p_query, p_category, p_lat, p_lng, p_radius_km, p_include_remote, p_min_price, p_max_price, p_has_budget, p_no_offers, p_sort, p_limit, p_offset, true);
  end if;
end $function$;

-- same grants as before: the wrapper is public, the core is internal
revoke execute on function public.search_listings_core(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.search_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer) to anon, authenticated;
