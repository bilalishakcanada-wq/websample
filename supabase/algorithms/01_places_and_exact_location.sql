-- =============================================================================
-- Algoritmi 01: svaki grad u BiH ima tačku, i tačna lokacija (adresa ili GPS)
-- =============================================================================
-- 1. city_coords dobija sve 141 općine (do sada ih je 50 bilo bez tačke: Tomislavgrad, Žepče, Orašje,
--    Srbac, Sokolac, Olovo, Jablanica …) i uobičajene druge nazive (Banjaluka, Bosanski Novi …).
-- 2. coords_for_location prepoznaje i samo ime naselja bez općine ("Hrasnica").
-- 3. cities_match više ne pada na razmaku ili kvačici ("Banjaluka" = "Banja Luka", "Bihac" = "Bihać").
-- 4. Tačna lokacija posla (listing_addresses) i majstora (profile_locations): ulica i broj ili GPS tačka.
--    Tačnu tačku vidi samo vlasnik posla i majstor čija je ponuda prihvaćena. Javno se pokazuje ista tačka
--    zaokružena na ~1 km, pa pretraga po udaljenosti, preporuke i uparivanje mjere od stvarnog mjesta,
--    a niko ne može iz oglasa saznati kućni broj.
-- Smije se pokrenuti više puta.
-- =============================================================================

-- ---------------------------------------------------------------- 1. svi gradovi
-- Sjedište svake općine koja nema tačku: naselje istog imena, pa naselje označeno kao grad, pa najveće.
insert into public.city_coords (name, lat, lng)
select distinct on (b.municipality) b.municipality, b.lat, b.lng
from public.bih_locations b
where not exists (select 1 from public.city_coords c where c.folded = public.fold_text(b.municipality))
order by b.municipality, (public.fold_loose(b.settlement_name) = public.fold_loose(b.municipality)) desc,
         (b.kind = 'grad') desc, b.population desc
on conflict (name) do nothing;

-- Imena koja ljudi pišu drugačije od službenog (stari nazivi, spojeno, sa dodatkom).
insert into public.city_coords (name, lat, lng)
select a.alias, c.lat, c.lng
from (values
  ('Banjaluka', 'Banja Luka'), ('Bosanski Novi', 'Novi Grad'), ('Bosanski Brod', 'Brod'),
  ('Bosanska Dubica', 'Kozarska Dubica'), ('Bosanska Kostajnica', 'Kostajnica'), ('Skender Vakuf', 'Kneževo'),
  ('Gornji Vakuf', 'Gornji Vakuf-Uskoplje'), ('Uskoplje', 'Gornji Vakuf-Uskoplje'), ('Prozor', 'Prozor-Rama'),
  ('Rama', 'Prozor-Rama'), ('Brčko Distrikt', 'Brčko'), ('Brčko distrikt BiH', 'Brčko'), ('Istočno Sarajevo', 'Istočno Sarajevo'),
  ('Lukavica', 'Istočno Novo Sarajevo'), ('Ustikolina', 'Foča-Ustikolina'), ('Domaljevac', 'Domaljevac-Šamac'),
  ('Bosanska Gradiška', 'Gradiška'), ('Duvno', 'Tomislavgrad'), ('Kupres RS', 'Kupres (RS)'), ('Trnovo RS', 'Trnovo (RS)')
) as a(alias, canonical)
join public.city_coords c on c.name = a.canonical
where a.alias <> a.canonical
on conflict (name) do nothing;

-- ---------------------------------------------------------------- 2. tačka za upisano mjesto
-- tačno ime grada → "Naselje, Općina" → najduže ime grada u tekstu → samo ime naselja (najveće takvo)
create or replace function public.coords_for_location(p_location text)
returns table(lat double precision, lng double precision)
language sql stable parallel safe set search_path = public as $$
  with f as (select public.fold_text(coalesce(p_location, '')) as t, public.fold_loose(coalesce(p_location, '')) as k)
  select x.lat, x.lng from (
    select c.lat, c.lng, 0 as pri, 0 as len from public.city_coords c, f where f.t <> '' and c.folded = f.t
    union all
    select b.lat, b.lng, 1, 0 from public.bih_locations b, f where f.k <> '' and b.label_key = f.k
    union all
    select c.lat, c.lng, 2, -length(c.folded) from public.city_coords c, f
    where f.t <> '' and (' ' || regexp_replace(f.t, '[,./;:]+', ' ', 'g') || ' ') like ('% ' || c.folded || ' %')
    union all
    -- samo ime naselja: kad je jedino takvo u BiH, ili kad je jedno od istoimenih jasno veće
    select n.lat, n.lng, 3, -n.population from (
      select b.lat, b.lng, b.population, count(*) over () as same_name
      from public.bih_locations b, f where f.k <> '' and b.name_key = f.k
    ) n where n.same_name = 1 or n.population > 0
  ) x
  order by x.pri, x.len
  limit 1;
$$;

-- ---------------------------------------------------------------- 3. isti grad
create or replace function public.place_key(p text)
returns text language sql immutable parallel safe set search_path = public as $$
  select nullif(replace(public.fold_loose(split_part(coalesce(p, ''), ',', 1)), ' ', ''), '');
$$;

create or replace function public.cities_match(a text, b text)
returns boolean language sql immutable set search_path = public as $$
  select case
    when public.place_key(a) is null or public.place_key(b) is null then false
    else replace(public.fold_loose(b), ' ', '') like '%' || public.place_key(a) || '%'
      or replace(public.fold_loose(a), ' ', '') like '%' || public.place_key(b) || '%'
  end;
$$;

-- ---------------------------------------------------------------- 4. tačna lokacija
-- Granice BiH sa malo rezerve; tačka van njih je greška (GPS u inostranstvu, zamijenjen lat/lng).
create or replace function public.inside_bih(p_lat double precision, p_lng double precision)
returns boolean language sql immutable parallel safe set search_path = public as $$
  select p_lat between 42.4 and 45.4 and p_lng between 15.6 and 19.8;
$$;

-- Javna tačka: zaokružena na dvije decimale (oko 1,1 km sjever-jug, 0,8 km istok-zapad).
create or replace function public.blurred(p double precision)
returns double precision language sql immutable parallel safe set search_path = public as $$
  select round(p::numeric, 2)::double precision;
$$;

create table if not exists public.listing_addresses (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  address text check (address is null or length(address) <= 200),
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  source text not null default 'map' check (source in ('typed', 'gps', 'map')),
  updated_at timestamptz not null default now(),
  check (public.inside_bih(lat, lng))
);
alter table public.listing_addresses enable row level security;
revoke all on public.listing_addresses from anon, authenticated;
grant select on public.listing_addresses to authenticated;
drop policy if exists listing_addresses_read on public.listing_addresses;
create policy listing_addresses_read on public.listing_addresses for select to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  or exists (select 1 from public.bids b where b.listing_id = listing_addresses.listing_id and b.bidder_id = auth.uid() and b.status = 'accepted')
);

create table if not exists public.profile_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  address text check (address is null or length(address) <= 200),
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  source text not null default 'map' check (source in ('typed', 'gps', 'map')),
  updated_at timestamptz not null default now(),
  check (public.inside_bih(lat, lng))
);
alter table public.profile_locations enable row level security;
revoke all on public.profile_locations from anon, authenticated;
grant select on public.profile_locations to authenticated;
drop policy if exists profile_locations_own on public.profile_locations;
create policy profile_locations_own on public.profile_locations for select to authenticated using (user_id = auth.uid());

-- Vlasnik posla postavlja tačnu lokaciju. Javna tačka posla postaje ta lokacija zaokružena na ~1 km.
create or replace function public.set_listing_address(
  p_listing uuid, p_address text, p_lat double precision, p_lng double precision,
  p_accuracy_m real default null, p_source text default 'map')
returns void language plpgsql security definer set search_path = public as $$
declare v_address text := nullif(left(btrim(coalesce(p_address, '')), 200), '');
begin
  if auth.uid() is null then raise exception 'Prijavi se' using errcode = '42501'; end if;
  if not exists (select 1 from public.listings where id = p_listing and user_id = auth.uid()) then
    raise exception 'Samo vlasnik posla može postaviti adresu' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or not public.inside_bih(p_lat, p_lng) then
    raise exception 'Tačka nije u Bosni i Hercegovini' using errcode = '22023';
  end if;
  if v_address is not null and not (public.moderation_scan(v_address) ->> 'clean')::boolean then
    raise exception 'Adresa ne smije sadržavati telefon, email ili link' using errcode = '22023';
  end if;
  insert into public.listing_addresses (listing_id, address, lat, lng, accuracy_m, source, updated_at)
  values (p_listing, v_address, p_lat, p_lng, p_accuracy_m, coalesce(p_source, 'map'), now())
  on conflict (listing_id) do update set address = excluded.address, lat = excluded.lat, lng = excluded.lng,
    accuracy_m = excluded.accuracy_m, source = excluded.source, updated_at = now();
  update public.listings set lat = public.blurred(p_lat), lng = public.blurred(p_lng) where id = p_listing;
end $$;

create or replace function public.clear_listing_address(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  if not exists (select 1 from public.listings where id = p_listing and user_id = auth.uid()) then
    raise exception 'Samo vlasnik posla može obrisati adresu' using errcode = '42501';
  end if;
  delete from public.listing_addresses where listing_id = p_listing;
  select x.lat, x.lng into c from public.listings l, lateral public.coords_for_location(l.location) x where l.id = p_listing;
  update public.listings set lat = c.lat, lng = c.lng where id = p_listing;
end $$;

-- Tačna adresa posla: vlasniku i majstoru čija je ponuda prihvaćena; svima ostalima ništa.
create or replace function public.listing_address(p_listing uuid)
returns table(address text, lat double precision, lng double precision, accuracy_m real, source text)
language sql stable security definer set search_path = public as $$
  select a.address, a.lat, a.lng, a.accuracy_m, a.source
  from public.listing_addresses a
  where a.listing_id = p_listing
    and (exists (select 1 from public.listings l where l.id = p_listing and l.user_id = auth.uid())
         or exists (select 1 from public.bids b where b.listing_id = p_listing and b.bidder_id = auth.uid() and b.status = 'accepted'));
$$;

-- Izmjena posla iz aplikacije šalje tačku grada (listingService.updateListing). Dok posao ima tačnu adresu,
-- javna tačka ostaje zaokružena adresa; promjena mjesta briše staru adresu (bila je u drugom mjestu).
create or replace function public.listing_exact_point()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if tg_op <> 'UPDATE' then return new; end if;
  if new.location is distinct from old.location then
    delete from public.listing_addresses where listing_id = new.id;
    return new;
  end if;
  select x.lat, x.lng into a from public.listing_addresses x where x.listing_id = new.id;
  if found then new.lat := public.blurred(a.lat); new.lng := public.blurred(a.lng); end if;
  return new;
end $$;
revoke all on function public.listing_exact_point() from public, anon, authenticated;
drop trigger if exists listings_zz_exact_point on public.listings;
-- "zz": radi poslije listings_settlement_point (okidači istog tipa idu abecedno)
create trigger listings_zz_exact_point before update of location, lat, lng on public.listings
  for each row execute function public.listing_exact_point();

-- Majstor (ili klijent) postavlja gdje je: koristi se za preporuke poslova, uparivanje i "blizu mene".
create or replace function public.set_my_location(
  p_address text, p_lat double precision, p_lng double precision, p_accuracy_m real default null, p_source text default 'map')
returns void language plpgsql security definer set search_path = public as $$
declare v_address text := nullif(left(btrim(coalesce(p_address, '')), 200), '');
begin
  if auth.uid() is null then raise exception 'Prijavi se' using errcode = '42501'; end if;
  if p_lat is null or p_lng is null or not public.inside_bih(p_lat, p_lng) then
    raise exception 'Tačka nije u Bosni i Hercegovini' using errcode = '22023';
  end if;
  insert into public.profile_locations (user_id, address, lat, lng, accuracy_m, source, updated_at)
  values (auth.uid(), v_address, p_lat, p_lng, p_accuracy_m, coalesce(p_source, 'map'), now())
  on conflict (user_id) do update set address = excluded.address, lat = excluded.lat, lng = excluded.lng,
    accuracy_m = excluded.accuracy_m, source = excluded.source, updated_at = now();
end $$;

create or replace function public.clear_my_location()
returns void language sql security definer set search_path = public as $$
  delete from public.profile_locations where user_id = auth.uid();
$$;

-- Tačka osobe za algoritme: njena tačna lokacija zaokružena na ~1 km, inače tačka njenog grada.
create or replace function public.person_point(p_user uuid)
returns table(lat double precision, lng double precision)
language sql stable security definer set search_path = public as $$
  select coalesce(public.blurred(pl.lat), c.lat), coalesce(public.blurred(pl.lng), c.lng)
  from public.profiles p
  left join public.profile_locations pl on pl.user_id = p.user_id
  left join lateral public.coords_for_location(p.city) c on true
  where p.user_id = p_user;
$$;

revoke all on function public.set_listing_address(uuid, text, double precision, double precision, real, text) from public, anon;
revoke all on function public.clear_listing_address(uuid) from public, anon;
revoke all on function public.listing_address(uuid) from public, anon;
revoke all on function public.set_my_location(text, double precision, double precision, real, text) from public, anon;
revoke all on function public.clear_my_location() from public, anon;
revoke all on function public.person_point(uuid) from public, anon, authenticated;
grant execute on function public.set_listing_address(uuid, text, double precision, double precision, real, text) to authenticated;
grant execute on function public.clear_listing_address(uuid) to authenticated;
grant execute on function public.listing_address(uuid) to authenticated;
grant execute on function public.set_my_location(text, double precision, double precision, real, text) to authenticated;
grant execute on function public.clear_my_location() to authenticated;

-- ---------------------------------------------------------------- 5. keš za pretvaranje adrese u tačku
-- Puni ga Edge funkcija `geocode` (OpenStreetMap Nominatim traži da se odgovori keširaju).
create table if not exists public.geocode_cache (
  query_key text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from anon, authenticated;

-- ---------------------------------------------------------------- 6. doseg ponude od tačne lokacije majstora
-- Majstor koji je postavio svoju lokaciju (profile_locations) mjeri se od nje (zaokružene na ~1 km), ne od centra grada.
create or replace function public.guard_bid_reach()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  select p.city, coalesce(public.blurred(pl.lat), c.lat) as lat, coalesce(public.blurred(pl.lng), c.lng) as lng into me
  from public.profiles p
  left join public.profile_locations pl on pl.user_id = p.user_id
  left join lateral public.coords_for_location(p.city) c on true
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
end $function$;

create or replace function public.listing_reach(p_listing uuid)
 RETURNS TABLE(reach_km numeric, distance_km numeric, can_offer boolean, reason text, my_city text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  select p.city, coalesce(public.blurred(pl.lat), c.lat) as lat, coalesce(public.blurred(pl.lng), c.lng) as lng into me
  from public.profiles p
  left join public.profile_locations pl on pl.user_id = p.user_id
  left join lateral public.coords_for_location(p.city) c on true
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
end $function$;

