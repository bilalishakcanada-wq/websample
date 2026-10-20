-- Lokacija kao na Airtaskeru, 2: selidba, prevoz i dostava imaju dva mjesta, „Odakle“ i „Dokle“.
-- „Odakle“ je postojeće mjesto posla (location, lat/lng, tačna adresa u listing_addresses). „Dokle“ je novo:
-- dropoff_location je naziv mjesta koji vide svi (npr. „Otes, Ilidža“), dropoff_lat/lng je javna tačka
-- zaokružena na ~1 km, a tačna adresa (ulica i broj) je u listing_dropoff_addresses i vide je samo vlasnik
-- posla i izvođač čija je ponuda prihvaćena, isto kao kod „Odakle“. Pokrenuti poslije algorithms/01 i
-- locations/01. Može se pokrenuti više puta.
begin;

alter table public.listings
  add column if not exists dropoff_location text,
  add column if not exists dropoff_lat double precision,
  add column if not exists dropoff_lng double precision;
alter table public.listings drop constraint if exists listings_dropoff_location_len;
alter table public.listings add constraint listings_dropoff_location_len
  check (dropoff_location is null or length(dropoff_location) <= 120);

create table if not exists public.listing_dropoff_addresses (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  address text check (address is null or length(address) <= 200),
  lat double precision not null,
  lng double precision not null,
  accuracy_m real,
  source text not null default 'map' check (source in ('typed', 'gps', 'map')),
  updated_at timestamptz not null default now(),
  check (public.inside_bih(lat, lng))
);
alter table public.listing_dropoff_addresses enable row level security;
revoke all on public.listing_dropoff_addresses from anon, authenticated;
grant select on public.listing_dropoff_addresses to authenticated;
drop policy if exists listing_dropoff_addresses_read on public.listing_dropoff_addresses;
create policy listing_dropoff_addresses_read on public.listing_dropoff_addresses for select to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  or exists (select 1 from public.bids b where b.listing_id = listing_dropoff_addresses.listing_id and b.bidder_id = auth.uid() and b.status = 'accepted')
);

-- Javna tačka „Dokle“: tačna adresa zaokružena na ~1 km kad postoji, inače tačka upisanog mjesta.
-- Šta god aplikacija pošalje u dropoff_lat/lng, računa se ovdje. Promjena mjesta briše staru tačnu adresu.
create or replace function public.listing_dropoff_point()
returns trigger language plpgsql security definer set search_path = public as $$
declare c record;
begin
  new.dropoff_location := nullif(btrim(coalesce(new.dropoff_location, '')), '');
  if tg_op = 'UPDATE' and new.dropoff_location is distinct from old.dropoff_location then
    delete from public.listing_dropoff_addresses where listing_id = new.id;
  end if;
  if new.dropoff_location is null then
    new.dropoff_lat := null; new.dropoff_lng := null;
    return new;
  end if;
  if tg_op = 'INSERT' or new.dropoff_location is distinct from old.dropoff_location then
    if not (public.moderation_scan(new.dropoff_location) ->> 'clean')::boolean then
      raise exception 'Pravilo #1: mjesto ne smije sadržavati telefon, email ili link' using errcode = '22023';
    end if;
  end if;
  select a.lat, a.lng into c from public.listing_dropoff_addresses a where a.listing_id = new.id;
  if not found then
    select x.lat, x.lng into c from public.coords_for_location(new.dropoff_location) x;
  end if;
  new.dropoff_lat := case when c.lat is null then null else public.blurred(c.lat) end;
  new.dropoff_lng := case when c.lng is null then null else public.blurred(c.lng) end;
  return new;
end $$;
revoke all on function public.listing_dropoff_point() from public, anon, authenticated;
drop trigger if exists listings_dropoff_point on public.listings;
create trigger listings_dropoff_point
  before insert or update of dropoff_location, dropoff_lat, dropoff_lng on public.listings
  for each row execute function public.listing_dropoff_point();

-- Vlasnik posla postavlja tačnu adresu „Dokle“ (posao mora već imati mjesto „Dokle“).
create or replace function public.set_listing_dropoff_address(
  p_listing uuid, p_address text, p_lat double precision, p_lng double precision,
  p_accuracy_m real default null, p_source text default 'map')
returns void language plpgsql security definer set search_path = public as $$
declare v_address text := nullif(left(btrim(coalesce(p_address, '')), 200), '');
begin
  if auth.uid() is null then raise exception 'Prijavi se' using errcode = '42501'; end if;
  if not exists (select 1 from public.listings where id = p_listing and user_id = auth.uid() and dropoff_location is not null) then
    raise exception 'Samo vlasnik posla može postaviti adresu dostave' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or not public.inside_bih(p_lat, p_lng) then
    raise exception 'Tačka nije u Bosni i Hercegovini' using errcode = '22023';
  end if;
  if v_address is not null and not (public.moderation_scan(v_address) ->> 'clean')::boolean then
    raise exception 'Adresa ne smije sadržavati telefon, email ili link' using errcode = '22023';
  end if;
  insert into public.listing_dropoff_addresses (listing_id, address, lat, lng, accuracy_m, source, updated_at)
  values (p_listing, v_address, p_lat, p_lng, p_accuracy_m, coalesce(p_source, 'map'), now())
  on conflict (listing_id) do update set address = excluded.address, lat = excluded.lat, lng = excluded.lng,
    accuracy_m = excluded.accuracy_m, source = excluded.source, updated_at = now();
  -- the trigger reads the address just saved and rounds it
  update public.listings set dropoff_lat = p_lat where id = p_listing;
end $$;

create or replace function public.clear_listing_dropoff_address(p_listing uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.listings where id = p_listing and user_id = auth.uid()) then
    raise exception 'Samo vlasnik posla može obrisati adresu dostave' using errcode = '42501';
  end if;
  delete from public.listing_dropoff_addresses where listing_id = p_listing;
  update public.listings set dropoff_lat = null where id = p_listing;
end $$;

-- Tačna adresa „Dokle“: vlasniku i izvođaču čija je ponuda prihvaćena; svima ostalima ništa.
create or replace function public.listing_dropoff_address(p_listing uuid)
returns table(address text, lat double precision, lng double precision, accuracy_m real, source text)
language sql stable security definer set search_path = public as $$
  select a.address, a.lat, a.lng, a.accuracy_m, a.source
  from public.listing_dropoff_addresses a
  where a.listing_id = p_listing
    and (exists (select 1 from public.listings l where l.id = p_listing and l.user_id = auth.uid())
         or exists (select 1 from public.bids b where b.listing_id = p_listing and b.bidder_id = auth.uid() and b.status = 'accepted'));
$$;

revoke execute on function public.set_listing_dropoff_address(uuid, text, double precision, double precision, real, text) from public, anon;
revoke execute on function public.clear_listing_dropoff_address(uuid) from public, anon;
revoke execute on function public.listing_dropoff_address(uuid) from public, anon;
grant execute on function public.set_listing_dropoff_address(uuid, text, double precision, double precision, real, text) to authenticated;
grant execute on function public.clear_listing_dropoff_address(uuid) to authenticated;
grant execute on function public.listing_dropoff_address(uuid) to authenticated;

commit;
