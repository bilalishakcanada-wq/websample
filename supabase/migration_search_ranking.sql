-- ============================================================================
-- Poso.ba — search & matching in Postgres (applied 2026-09-21 through the Supabase
-- migration history: search_ranking_foundation, provider_stats_and_bid_counts,
-- search_listings_and_providers_rpcs, search_tsquery_light_stemming,
-- search_listings_fuzzy_fallback, matching_uses_provider_stats,
-- alerts_skip_e2e_listings, guard_listing_delete_with_escrow).
-- This file is the readable copy for the repo; the live definitions are the source of truth.
-- ============================================================================

-- ============================================================================
-- Search & ranking foundation: folded text, full-text + trigram indexes,
-- geo helpers, city coordinates, hot-path B-tree indexes.
-- ============================================================================
create extension if not exists pg_trgm with schema extensions;
create extension if not exists btree_gin with schema extensions;
create extension if not exists btree_gin with schema extensions;

-- Bosnian-aware folding: lower-case and strip č ć š ž đ so "krečenje", "Krecenje" and "KREČENJE" match.
create or replace function public.fold_text(p text)
returns text language sql immutable parallel safe strict as $$
  select translate(lower(p), 'čćšžđ', 'ccszd');
$$;

-- Search vector on listings: title weighs most, then category, then description.
alter table public.listings
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', public.fold_text(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('simple', public.fold_text(coalesce(category, ''))), 'B') ||
    setweight(to_tsvector('simple', public.fold_text(coalesce(description, ''))), 'C')
  ) stored;
create index if not exists listings_search_tsv_gin on public.listings using gin (search_tsv);
create index if not exists listings_title_trgm on public.listings using gin (public.fold_text(title) extensions.gin_trgm_ops);

-- Search vector on profiles: name, trades, bio, city (provider search).
alter table public.profiles
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', public.fold_text(coalesce(full_name, ''))), 'A') ||
    setweight(to_tsvector('simple', public.fold_text(coalesce(array_to_string(trades, ' '), ''))), 'A') ||
    setweight(to_tsvector('simple', public.fold_text(coalesce(city, ''))), 'B') ||
    setweight(to_tsvector('simple', public.fold_text(coalesce(bio, ''))), 'C')
  ) stored;
create index if not exists profiles_search_tsv_gin on public.profiles using gin (search_tsv);

-- Hot paths (each a covering B-tree for the query the app actually runs).
create index if not exists listings_status_created_idx on public.listings (status, created_at desc);
create index if not exists listings_category_status_idx on public.listings (category, status);
create index if not exists listings_owner_status_idx on public.listings (user_id, status);
create index if not exists bids_listing_status_idx on public.bids (listing_id, status);
create index if not exists bids_bidder_created_idx on public.bids (bidder_id, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (receiver_id) where read_at is null;
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);
create index if not exists conversations_p1_idx on public.conversations (participant_one);
create index if not exists conversations_p2_idx on public.conversations (participant_two);
create index if not exists conversations_listing_idx on public.conversations (listing_id);
create index if not exists listing_questions_listing_idx on public.listing_questions (listing_id, created_at);
create index if not exists listing_images_listing_idx on public.listing_images (listing_id, position);

-- Distance in km between two points (haversine), null when either side is unknown.
create or replace function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as $$
  select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 2 * 6371 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
  end;
$$;

-- City → coordinates (the same table the front end ships), so a provider's city and a job's
-- location can be measured against each other server-side.
create table if not exists public.city_coords (
  name text primary key,
  folded text generated always as (public.fold_text(name)) stored,
  lat double precision not null,
  lng double precision not null
);
create index if not exists city_coords_folded_idx on public.city_coords (folded);
alter table public.city_coords enable row level security;
drop policy if exists city_coords_read on public.city_coords;
create policy city_coords_read on public.city_coords for select using (true);
insert into public.city_coords (name, lat, lng) values
('Sarajevo', 43.8563, 18.4131),
('Banja Luka', 44.7722, 17.191),
('Tuzla', 44.5384, 18.6671),
('Zenica', 44.2034, 17.9077),
('Mostar', 43.3438, 17.8078),
('Bijeljina', 44.7569, 19.2144),
('Brčko', 44.8725, 18.8103),
('Bihać', 44.8169, 15.8708),
('Prijedor', 44.9797, 16.7139),
('Trebinje', 42.7118, 18.3446),
('Doboj', 44.7333, 18.1333),
('Cazin', 44.9667, 15.9431),
('Velika Kladuša', 45.1839, 15.8058),
('Gradačac', 44.8783, 18.4258),
('Zavidovići', 44.4453, 18.1497),
('Gračanica', 44.7031, 18.3097),
('Živinice', 44.4494, 18.6489),
('Visoko', 43.9889, 18.1783),
('Konjic', 43.6519, 17.9622),
('Kakanj', 44.125, 18.12),
('Travnik', 44.2264, 17.6658),
('Goražde', 43.6667, 18.9764),
('Foča', 43.5069, 18.7758),
('Livno', 43.8269, 17.0078),
('Čapljina', 43.1108, 17.6931),
('Široki Brijeg', 43.3833, 17.5917),
('Ljubuški', 43.1972, 17.5453),
('Stolac', 43.0842, 17.9578),
('Bugojno', 44.0572, 17.4508),
('Fojnica', 43.9628, 17.8967),
('Vareš', 44.1633, 18.3275),
('Kiseljak', 43.9428, 18.0783),
('Kreševo', 43.8778, 18.0567),
('Ilidža', 43.83, 18.31),
('Vogošća', 43.9006, 18.3419),
('Hadžići', 43.8222, 18.2058),
('Ilijaš', 43.9536, 18.2711),
('Novi Grad Sarajevo', 43.85, 18.35),
('Centar Sarajevo', 43.86, 18.41),
('Stari Grad Sarajevo', 43.86, 18.43),
('Novo Sarajevo', 43.85, 18.39),
('Lukavac', 44.5392, 18.5308),
('Srebrenik', 44.7069, 18.4886),
('Tešanj', 44.6122, 17.9864),
('Maglaj', 44.5486, 18.0972),
('Odžak', 45.0111, 18.3231),
('Modriča', 44.9539, 18.3039),
('Šamac', 45.0603, 18.4653),
('Derventa', 44.9775, 17.9081),
('Teslić', 44.6069, 17.8592),
('Prnjavor', 44.8686, 17.6631),
('Gradiška', 45.145, 17.2544),
('Laktaši', 44.9086, 17.3011),
('Čelinac', 44.7256, 17.3239),
('Kotor Varoš', 44.6183, 17.3711),
('Šipovo', 44.2806, 17.0864),
('Mrkonjić Grad', 44.4167, 17.0833),
('Ključ', 44.5333, 16.775),
('Sanski Most', 44.7667, 16.6667),
('Bosanska Krupa', 44.8833, 16.15),
('Bosanski Petrovac', 44.5544, 16.37),
('Drvar', 44.3739, 16.3806),
('Glamoč', 44.0453, 16.8489),
('Kupres', 43.9908, 17.1122),
('Bosansko Grahovo', 44.1789, 16.3625),
('Jajce', 44.3417, 17.2717),
('Donji Vakuf', 44.1433, 17.4028),
('Novi Travnik', 44.1733, 17.6572),
('Busovača', 44.0994, 17.8797),
('Vitez', 44.155, 17.7889),
('Kladanj', 44.2258, 18.6906),
('Kalesija', 44.4442, 18.8922),
('Sapna', 44.4917, 18.9769),
('Teočak', 44.6, 19.0167),
('Zvornik', 44.3833, 19.1),
('Bratunac', 44.1858, 19.3322),
('Srebrenica', 44.1039, 19.2978),
('Vlasenica', 44.1817, 18.9411),
('Han Pijesak', 44.0844, 18.95),
('Rogatica', 43.7986, 19.0044),
('Višegrad', 43.7828, 19.2903),
('Rudo', 43.6197, 19.3667),
('Čajniče', 43.5561, 19.0731),
('Pale', 43.8167, 18.57),
('Trnovo', 43.6667, 18.45),
('Istočno Sarajevo', 43.8236, 18.3572),
('Nevesinje', 43.2586, 18.1131),
('Gacko', 43.1667, 18.5333),
('Bileća', 42.8761, 18.4297),
('Ravno', 42.8833, 17.9667),
('Neum', 42.9247, 17.6158),
('Čitluk', 43.2286, 17.7),
('Posušje', 43.4728, 17.3283)
 on conflict (name) do update set lat = excluded.lat, lng = excluded.lng;

-- Coordinates for a free-text location ("Novi Grad Sarajevo", "Online / na daljinu", "Tuzla Kanton"):
-- exact city first, then the first city name contained in the text.
create or replace function public.coords_for_location(p_location text)
returns table(lat double precision, lng double precision) language sql stable parallel safe as $$
  with f as (select public.fold_text(coalesce(p_location, '')) as t)
  select c.lat, c.lng from public.city_coords c, f
  where f.t <> '' and (c.folded = f.t or f.t like '%' || c.folded || '%')
  order by (c.folded = f.t) desc, length(c.folded) desc
  limit 1;
$$;

-- array_to_string is only STABLE; this wrapper lets trades live in a generated tsvector column
create or replace function public.join_words(p text[])
returns text language sql immutable parallel safe as $$ select coalesce(array_to_string(p, ' '), ''); $$;

-- ---------------------------------------------------------------------------
-- Denormalised offer count (kept by trigger) so ranking never counts bids per row
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists bid_count integer not null default 0;
create or replace function public.sync_listing_bid_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ids uuid[];
begin
  v_ids := array_remove(array[coalesce(new.listing_id, null), coalesce(old.listing_id, null)], null);
  update public.listings l
     set bid_count = (select count(*) from public.bids b where b.listing_id = l.id and b.status in ('pending', 'accepted'))
   where l.id = any (v_ids);
  return null;
end $$;
drop trigger if exists sync_listing_bid_count on public.bids;
create trigger sync_listing_bid_count after insert or update of status or delete on public.bids
for each row execute function public.sync_listing_bid_count();

-- ---------------------------------------------------------------------------
-- provider_stats: precomputed provider signals (rating with prior, acceptance/success
-- history, response speed from bids + message replies, home coordinates); pg_cron every 10 min
-- ---------------------------------------------------------------------------
-- see migration provider_stats_and_bid_counts (materialized view over provider_metrics()
-- + median_bid_hours, median_reply_min, response_score, lat/lng) and
-- select cron.schedule('refresh-provider-stats', '*/10 * * * *', $$select public.refresh_provider_stats()$$);

-- ---------------------------------------------------------------------------
-- Query parsing: prefix tsquery with light Bosnian stemming
-- ---------------------------------------------------------------------------
create or replace function public.search_tsquery(p_query text)
returns tsquery language sql immutable parallel safe as $$
  select case when coalesce(btrim(p_query), '') = '' then null
    else (select to_tsquery('simple'::regconfig, string_agg(
              (case when length(t) >= 7 then left(t, length(t) - 2) when length(t) = 6 then left(t, 5) else t end) || ':*', ' & '))
          from unnest(regexp_split_to_array(public.fold_text(p_query), '[^a-z0-9]+')) t
          where t <> '' and length(t) >= 2)
  end;
$$;

-- search_listings(p_query, p_category, p_lat, p_lng, p_radius_km, p_include_remote, p_min_price,
--                 p_max_price, p_has_budget, p_no_offers, p_sort, p_limit, p_offset)
--   score = 3.0·text + 1.6·freshness(72h half-life) + 1.2·proximity(0..120 km) + 1.1·competition
--         + 0.8·completeness + 0.9·poster track record + 1.4·searcher's trades
--   strict pass = GIN tsvector + trigram index; fuzzy pass (word_similarity ≥ 0.4) only when strict is empty.
-- search_providers(p_query, p_category, p_lat, p_lng, p_radius_km, p_limit, p_offset)
--   score = 3.0·text + 2.0·trade + 1.5·distance + 2.0·rating + 1.5·response speed + 1.5·success + verified + activity
-- match_providers_for_listing / recommended_listings: now on provider_stats + real km distance.
-- Full bodies: Supabase → Database → Functions (search_listings_core, search_listings, search_providers).

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
create or replace function public.guard_listing_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.job_payments jp where jp.listing_id = old.id and jp.status in ('funded', 'requested', 'disputed')) then
    raise exception 'PAYMENT_IN_PROGRESS: prvo oslobodi ili otkaži osiguranu uplatu' using errcode = 'P0001';
  end if;
  return old;
end $$;
drop trigger if exists guard_listing_delete on public.listings;
create trigger guard_listing_delete before delete on public.listings
for each row execute function public.guard_listing_delete();
