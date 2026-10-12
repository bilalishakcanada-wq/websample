-- =============================================================================
-- Algoritmi 03: uparivanje majstora i preporuke poslova
-- =============================================================================
-- Šta se mijenja (izmjereno, vidi supabase/algorithms/README.md):
--  * majstor iz druge struke više ne dolazi ispred majstora iz prave struke: prvo idu majstori kojima posao
--    odgovara (kategorija, tekst oglasa ili značenje), pa tek onda ostali, svaka grupa po bodovima;
--  * struka se prepoznaje i iz teksta oglasa ("Pukla cijev" objavljeno kao "Majstor za sve" je posao za
--    vodoinstalatera), i po značenju kad postoje vektori (04);
--  * ocjena se računa tek kad je ima: majstor bez ocjena više nije "bolji" od majstora sa jednom četvorkom;
--  * majstori kojima je posao van dosega (ne mogu ni poslati ponudu) idu iza onih koji mogu;
--  * udaljenost se mjeri od tačne lokacije majstora i posla kad je postave (zaokruženo na ~1 km).
-- Smije se pokrenuti više puta.
-- =============================================================================

create or replace function public.match_providers_for_listing(p_listing_id uuid, limit_count integer default 6)
returns table(user_id uuid, display_name text, city text, avatar_url text, avg_rating numeric, review_count bigint,
              is_verified boolean, success_rate numeric, match_score numeric, reasons text[])
language sql stable security definer set search_path = public, extensions as $$
  with target as (
    select l.id, l.user_id as owner_id, l.category, l.location, l.search_tsv,
           public.fold_text(coalesce(l.category, '')) as cat,
           public.fold_text(split_part(coalesce(l.category, ''), '/', 1)) as category_head,
           coalesce(l.lat, c.lat) as lat, coalesce(l.lng, c.lng) as lng,
           public.listing_is_remote(l.location) as remote,
           public.listing_reach_km(l.price, l.travel_allowance) as reach_km,
           e.embedding
    from public.listings l
    left join lateral public.coords_for_location(l.location) c on true
    left join public.listing_embeddings e on e.listing_id = l.id
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
              where public.fold_text(tr) = t.cat or t.cat like '%' || public.fold_text(tr) || '%'
                 or (t.category_head <> '' and public.fold_text(tr) like '%' || t.category_head || '%')) as trade_match,
      -- tekst oglasa sadrži riječi majstorove struke
      coalesce(t.search_tsv @@ public.trade_query(p.trades), false) as text_match,
      case when t.embedding is not null and pe.embedding is not null then 1 - (t.embedding <=> pe.embedding) end as sem_sim,
      t.remote, t.reach_km,
      public.cities_match(s.city, t.location) as city_match,
      public.distance_km(t.lat, t.lng, coalesce(public.blurred(pl.lat), s.lat), coalesce(public.blurred(pl.lng), s.lng))::numeric as distance_km,
      (s.days_since_activity <= 14) as recently_active,
      (s.days_since_joined <= 30 and s.total_bids = 0) as newcomer
    from public.provider_stats s
    join public.profiles p on p.user_id = s.user_id
    cross join target t
    left join affinity a on a.bidder_id = s.user_id
    left join public.profile_locations pl on pl.user_id = s.user_id
    left join public.profile_embeddings pe on pe.user_id = s.user_id
    where s.user_id <> t.owner_id and s.account_type in ('provider', 'both')
  ),
  ranked as (
    select s.*,
      (s.trade_match or s.text_match or s.category_bids > 0 or coalesce(s.sem_sim, 0) >= 0.45) as fits,
      -- može li uopšte poslati ponudu: posao plaća doseg (15 km ispod 50 KM … cijela BiH od 800 KM)
      (s.remote or s.reach_km is null or s.distance_km is null or s.distance_km <= s.reach_km) as in_reach,
      round((
        (case when s.trade_match then 30 when s.text_match then 22 else 0 end)
        + greatest(0, least(1, (coalesce(s.sem_sim, 0) - 0.30) / 0.30)) * 20
        + least(s.category_bids, 5) * 8
        + (case when s.city_match then 10 else 0 end)
        + (case when s.distance_km is null then 5 else greatest(0, 20 - s.distance_km / 3) end)
        -- ocjena vrijedi punih bodova tek od 3 recenzije
        + greatest(0, (s.weighted_rating - 3) * 10) * least(1, s.review_count / 3.0)
        + coalesce(s.acceptance_rate, 0) * 12
        + coalesce(s.response_score, 0.5) * 16
        + (case when s.is_verified then 15 else 0 end)
        + s.badge_count * 3
        + least(s.completed_jobs, 10) * 2
        + (case when s.success_rate >= 90 and s.completed_jobs >= 3 then 8 else 0 end)
        + least(s.portfolio_count, 5) * 2
        + (case when s.recently_active then 8 else 0 end)
        + (case when s.newcomer then 6 else 0 end)
      )::numeric, 2) as points
    from scored s
  )
  select
    s.user_id, s.display_name, s.city, s.avatar_url, s.avg_rating, s.review_count, s.is_verified, s.success_rate,
    s.points as match_score,
    array_remove(array[
      case when s.trade_match or s.text_match or coalesce(s.sem_sim, 0) >= 0.45 then 'Radi upravo ovu vrstu posla' end,
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
  from ranked s
  order by s.fits desc, s.in_reach desc, s.points desc, s.weighted_rating desc
  limit greatest(1, least(limit_count, 24));
$$;

-- Poslovi za majstora: struka (kategorija, tekst oglasa, značenje), istorija ponuda, stvarna udaljenost od
-- njegove tačne lokacije ili grada, svježina, konkurencija, rok.
create or replace function public.recommended_listings(limit_count integer default 8)
returns table(id uuid, title text, category text, location text, price numeric, currency text, created_at timestamptz,
              bid_count bigint, match_score numeric, reasons text[])
language sql stable security definer set search_path = public, extensions as $$
  with me as (
    select p.user_id, p.city, coalesce(p.trades, '{}'::text[]) as trades, pt.lat, pt.lng,
           public.trade_query(p.trades) as trade_q, pe.embedding
    from public.profiles p
    left join lateral public.person_point(p.user_id) pt on true
    left join public.profile_embeddings pe on pe.user_id = p.user_id
    where p.user_id = auth.uid()
  ),
  my_categories as (
    select l.category, count(*) as bids_in_category
    from public.bids b join public.listings l on l.id = b.listing_id
    where b.bidder_id = auth.uid()
    group by l.category
  ),
  candidates as (
    select l.id, l.title, l.category, l.location, l.price, l.currency, l.created_at, l.lat, l.lng, l.search_tsv,
           l.bid_count::bigint as bid_count, l.due_date - public.today_ba() as days_left,
           round((extract(epoch from now() - l.created_at) / 86400.0)::numeric, 2) as days_old,
           l.image_count as photos,
           public.listing_is_remote(l.location) as is_remote
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
      exists (select 1 from unnest(me.trades) t where public.fold_text(t) = public.fold_text(c.category) or public.fold_text(c.category) like '%' || public.fold_text(t) || '%' or public.fold_text(t) like '%' || public.fold_text(split_part(c.category, '/', 1)) || '%') as trade_match,
      coalesce(c.search_tsv @@ me.trade_q, false) as text_match,
      case when me.embedding is not null and le.embedding is not null then 1 - (le.embedding <=> me.embedding) end as sem_sim
    from candidates c cross join me
    left join my_categories mc on mc.category = c.category
    left join public.listing_embeddings le on le.listing_id = c.id
  ),
  raw as (
    select s.*,
      ((case when s.trade_match then 25 when s.text_match then 20 else 0 end)
      + greatest(0, least(1, (coalesce(s.sem_sim, 0) - 0.30) / 0.30)) * 15
      + least(s.bids_in_category, 4) * 8
      + (case when s.is_remote then 12 when s.distance_km is null then (case when s.city_match then 22 else 0 end) else greatest(0, 22 - s.distance_km / 4) end)
      + greatest(0, 18 - s.days_old * 2)
      + greatest(0, 15 - s.bid_count * 5)
      + (case when s.price is not null then 5 else 0 end)
      + (case when s.photos > 0 then 3 else 0 end)
      + (case when s.days_left <= 1 then 10 when s.days_left <= 3 then 5 else 0 end))::numeric as points   -- max 145
    from scored s
  )
  select
    r.id, r.title, r.category, r.location, r.price, r.currency, r.created_at, r.bid_count,
    round(least(100, r.points / 1.2), 0) as match_score,
    array_remove(array[
      case when r.trade_match or r.text_match or coalesce(r.sem_sim, 0) >= 0.45 then 'Odgovara tvojim vještinama' end,
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
$$;

-- Najbolji majstori (početna stranica): ocjena tek kad je ima, kao i u uparivanju.
create or replace function public.ranked_providers(category_filter text default null, limit_count integer default 6)
returns table(user_id uuid, display_name text, city text, avatar_url text, avg_rating numeric, review_count bigint,
              badge_count bigint, is_verified boolean, success_rate numeric, completed_jobs bigint, active_listings bigint, score numeric)
language sql stable security definer set search_path = public as $$
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
      greatest(0, (m.weighted_rating - 3) * 12) * least(1, m.review_count / 3.0)
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
