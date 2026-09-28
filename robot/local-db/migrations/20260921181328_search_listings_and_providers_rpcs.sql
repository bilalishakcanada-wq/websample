-- Turns free text into a prefix tsquery: "krec sob" → 'krec':* & 'sob':*
create or replace function public.search_tsquery(p_query text)
returns tsquery language sql immutable parallel safe as $$
  select case when coalesce(btrim(p_query), '') = '' then null
    else (select to_tsquery('simple'::regconfig, string_agg(t || ':*', ' & '))
          from unnest(regexp_split_to_array(public.fold_text(p_query), '[^a-z0-9]+')) t
          where t <> '' and length(t) >= 2)
  end;
$$;

-- ============================================================================
-- search_listings: one call, ranked and paged server-side.
--   text relevance (weighted tsvector + trigram typo tolerance), freshness,
--   distance from the searcher, competition (offers), completeness, the poster's
--   track record, and — when signed in — the searcher's own trades.
-- The candidate set is the newest 3000 open jobs that pass the filters, which keeps
-- every call inside the index-only window (target < 50 ms).
-- ============================================================================
create or replace function public.search_listings(
  p_query text default '', p_category text default '',
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_include_remote boolean default true, p_min_price numeric default null, p_max_price numeric default null,
  p_has_budget boolean default false, p_no_offers boolean default false,
  p_sort text default 'recommended', p_limit integer default 50, p_offset integer default 0)
returns table(
  id uuid, user_id uuid, title text, description text, category text, location text, price numeric, currency text,
  status text, created_at timestamptz, lat double precision, lng double precision, is_remote boolean,
  cover_url text, image_count integer, offers integer, distance_km double precision, text_rank real,
  poster_rating numeric, poster_reviews integer, poster_completed integer, score numeric, total_count bigint)
language sql stable security definer set search_path = public as $$
  with params as (
    select public.search_tsquery(p_query) as q,
           public.fold_text(coalesce(p_query, '')) as folded,
           nullif(btrim(coalesce(p_category, '')), '') as cat,
           (p_lat is not null and p_lng is not null) as has_origin,
           coalesce(p_radius_km, 0) as radius,
           least(greatest(coalesce(p_limit, 50), 1), 200) as lim,
           greatest(coalesce(p_offset, 0), 0) as off,
           coalesce(p_sort, 'recommended') as sort
  ),
  me as (
    select coalesce(p.trades, '{}'::text[]) as trades from public.profiles p where p.user_id = auth.uid()
  ),
  filtered as (
    select l.id, l.user_id, l.title, l.description, l.category, l.location, l.price, l.currency, l.status, l.created_at,
           l.lat, l.lng, l.bid_count,
           (public.fold_text(coalesce(l.location, '')) like '%online%' or public.fold_text(coalesce(l.location, '')) like '%daljin%') as is_remote,
           case when pa.q is null then 0.5::real else least(1, ts_rank_cd(l.search_tsv, pa.q) * 4)::real end as text_rank
    from public.listings l cross join params pa
    where l.status = 'published'
      and (pa.q is null or l.search_tsv @@ pa.q or public.fold_text(l.title) operator(extensions.%) pa.folded)
      and (pa.cat is null or l.category = pa.cat)
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      and (not p_has_budget or l.price is not null)
      and (not p_no_offers or l.bid_count = 0)
    order by l.created_at desc
    limit 3000
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
         s.poster_rating, s.poster_reviews, s.poster_completed, s.score, count(*) over () as total_count
  from scored s cross join params pa
  order by
    case when pa.sort = 'recommended' then s.score end desc nulls last,
    case when pa.sort = 'closest' then coalesce(s.distance_km, 1e9) end asc,
    case when pa.sort = 'offers' then s.bid_count end desc,
    case when pa.sort = 'price_asc' then coalesce(s.price, 1e12) end asc,
    case when pa.sort = 'price_desc' then s.price end desc nulls last,
    case when pa.sort = 'oldest' then s.created_at end asc,
    s.created_at desc
  limit (select lim from params) offset (select off from params);
$$;
grant execute on function public.search_listings(text, text, double precision, double precision, double precision, boolean, numeric, numeric, boolean, boolean, text, integer, integer) to anon, authenticated;

-- ============================================================================
-- search_providers: the best people for a need — relevance (name / trades / bio),
-- distance, rating, response speed, success history, verification, activity.
-- ============================================================================
create or replace function public.search_providers(
  p_query text default '', p_category text default '',
  p_lat double precision default null, p_lng double precision default null, p_radius_km double precision default null,
  p_limit integer default 24, p_offset integer default 0)
returns table(
  user_id uuid, display_name text, city text, avatar_url text, trades text[],
  avg_rating numeric, review_count bigint, completed_jobs bigint, success_rate numeric, acceptance_rate numeric,
  response_score numeric, median_reply_min double precision, is_verified boolean, distance_km double precision,
  score numeric, reasons text[], total_count bigint)
language sql stable security definer set search_path = public as $$
  with params as (
    select public.search_tsquery(p_query) as q,
           public.fold_text(coalesce(p_query, '')) as folded,
           nullif(public.fold_text(coalesce(p_category, '')), '') as cat,
           (p_lat is not null and p_lng is not null) as has_origin,
           coalesce(p_radius_km, 0) as radius,
           least(greatest(coalesce(p_limit, 24), 1), 100) as lim,
           greatest(coalesce(p_offset, 0), 0) as off
  ),
  cand as (
    select s.*, p.trades, p.search_tsv,
           case when pa.q is null then 0.5::real else least(1, ts_rank_cd(p.search_tsv, pa.q) * 4)::real end as text_rank,
           case when pa.has_origin then public.distance_km(p_lat, p_lng, s.lat, s.lng) end as distance_km,
           (pa.cat is not null and exists (select 1 from unnest(coalesce(p.trades, '{}'::text[])) t
                where public.fold_text(t) = pa.cat or pa.cat like '%' || public.fold_text(t) || '%' or public.fold_text(t) like '%' || split_part(pa.cat, '/', 1) || '%')) as trade_match
    from public.provider_stats s
    join public.profiles p on p.user_id = s.user_id
    cross join params pa
    where s.account_type in ('provider', 'both')
      and (auth.uid() is null or s.user_id <> auth.uid())
      and (pa.q is null or p.search_tsv @@ pa.q or public.fold_text(coalesce(p.full_name, '')) operator(extensions.%) pa.folded)
  ),
  in_range as (
    select c.* from cand c cross join params pa
    where not pa.has_origin or pa.radius = 0 or (c.distance_km is not null and c.distance_km <= pa.radius)
  ),
  scored as (
    select r.*,
      round((
        3.0 * r.text_rank
      + 2.0 * (case when r.trade_match then 1 when (select cat from params) is null then 0.5 else 0.15 end)
      + 1.5 * (case when r.distance_km is null then 0.5 else greatest(0, 1 - r.distance_km / 120.0) end)
      + 2.0 * greatest(0, (r.weighted_rating - 3) / 2.0)
      + 1.5 * coalesce(r.response_score, 0.5)
      + 1.5 * least(1, 0.15 * least(r.completed_jobs, 5) + (case when r.success_rate >= 90 and r.completed_jobs >= 3 then 0.25 else 0 end))
      + 0.5 * (case when r.is_verified then 1 else 0 end)
      + 0.5 * (case when r.days_since_activity <= 7 then 1 when r.days_since_activity <= 30 then 0.5 else 0 end)
      )::numeric, 4) as score
    from in_range r
  )
  select s.user_id, s.display_name, s.city, s.avatar_url, s.trades,
         s.avg_rating, s.review_count, s.completed_jobs, s.success_rate, s.acceptance_rate,
         s.response_score, s.median_reply_min, s.is_verified, s.distance_km, s.score,
         array_remove(array[
           case when s.trade_match then 'Radi upravo ovu vrstu posla' end,
           case when s.distance_km is not null and s.distance_km <= 15 then 'U blizini' end,
           case when s.review_count > 0 then s.avg_rating::text || ' ★ (' || s.review_count || ')' end,
           case when s.median_reply_min is not null and s.median_reply_min <= 30 then 'Odgovara za pola sata' end,
           case when s.completed_jobs > 0 then s.completed_jobs || ' završenih poslova' end,
           case when s.is_verified then 'Verifikovan' end,
           case when s.days_since_activity <= 7 then 'Aktivan ove sedmice' end
         ], null) as reasons,
         count(*) over () as total_count
  from scored s
  order by s.score desc, s.weighted_rating desc
  limit (select lim from params) offset (select off from params);
$$;
grant execute on function public.search_providers(text, text, double precision, double precision, double precision, integer, integer) to anon, authenticated;;
