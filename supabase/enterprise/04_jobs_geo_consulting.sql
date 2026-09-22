-- ============================================================================
-- MODUL 4 — Poslovi, licitiranje, savjetovanje i geolokacija
-- ----------------------------------------------------------------------------
-- Nadograđuje postojeće listings/bids i postojeću funkciju distance_km().
-- Bidovanje već radi; ovdje se dodaju: prag za premium poslove (zaobilaženje
-- geografije), savjetovanja kao zaseban tip, i jedinstvena pretraga koja
-- poštuje radijus.
-- ============================================================================

do $$ begin
  create type engagement_kind as enum ('job', 'consultation');
  create type consultation_state as enum ('requested', 'accepted', 'declined', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------- 4.1 Premium / globalni doseg
create table if not exists public.job_visibility_settings (
  id                   boolean primary key default true check (id),   -- jedan red
  premium_threshold_km numeric(12,2) not null default 1500.00,        -- iznad ovoga = globalno
  default_radius_km    integer not null default 50,
  max_radius_km        integer not null default 300,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id)
);

insert into public.job_visibility_settings (id) values (true) on conflict do nothing;

alter table public.listings
  add column if not exists engagement_kind engagement_kind not null default 'job',
  add column if not exists is_premium boolean not null default false,
  add column if not exists is_global boolean not null default false,
  add column if not exists radius_km integer;

-- Posao iznad praga automatski postaje premium i vidi se svugdje.
create or replace function public.mark_premium_listing() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_threshold numeric;
begin
  select premium_threshold_km into v_threshold from public.job_visibility_settings where id;
  new.is_premium := coalesce(new.price, 0) >= v_threshold;
  if new.is_premium then new.is_global := true; end if;
  return new;
end $fn$;

drop trigger if exists listings_mark_premium on public.listings;
create trigger listings_mark_premium before insert or update of price on public.listings
  for each row execute function public.mark_premium_listing();

create index if not exists listings_global_idx on public.listings (status, created_at desc)
  where is_global and status = 'published';
create index if not exists listings_geo_idx on public.listings (lat, lng) where status = 'published';

-- ------------------------------------------------------------- 4.2 Geofencing
-- Pravilo vidljivosti na jednom mjestu: premium/online posao vide svi,
-- ostalo samo unutar radijusa. Koristi postojeću distance_km().
create or replace function public.listing_visible_to(
  p_listing public.listings, p_lat double precision, p_lng double precision, p_radius_km integer
) returns boolean
language sql immutable as $fn$
  select p_listing.is_global
      or p_listing.is_premium
      or p_listing.lat is null                                  -- online / bez lokacije
      or p_lat is null
      or public.distance_km(p_lat, p_lng, p_listing.lat, p_listing.lng) <= p_radius_km;
$fn$;

create or replace function public.search_jobs_geo(
  p_query text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default null,
  p_kind engagement_kind default 'job',
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid, title text, category text, location text, price numeric,
  distance_km numeric, is_premium boolean, bid_count integer, created_at timestamptz
)
language sql stable security definer set search_path = public as $fn$
  with cfg as (select default_radius_km, max_radius_km from public.job_visibility_settings where id),
  r as (select least(coalesce(p_radius_km, (select default_radius_km from cfg)),
                     (select max_radius_km from cfg)) as km)
  select l.id, l.title, l.category, l.location, l.price,
         case when l.lat is null or p_lat is null then null
              else round(public.distance_km(p_lat, p_lng, l.lat, l.lng)::numeric, 1) end,
         l.is_premium, l.bid_count, l.created_at
  from public.listings l, r
  where l.status = 'published'
    and l.engagement_kind = p_kind
    and (p_query is null or l.search_tsv @@ websearch_to_tsquery('simple', p_query))
    and public.listing_visible_to(l, p_lat, p_lng, r.km)
  order by l.is_premium desc,
           case when l.lat is null or p_lat is null then 1e9
                else public.distance_km(p_lat, p_lng, l.lat, l.lng) end,
           l.created_at desc
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$fn$;

-- --------------------------------------------------------- 4.3 Savjetovanja
-- Odvojeno od posla: nema escrowa po učinku nego termin, trajanje i satnica.
create table if not exists public.consultation_slots (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references auth.users(id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  price_km      numeric(12,2) not null check (price_km >= 0),
  is_online     boolean not null default true,
  location      text,
  is_booked     boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint slot_time_ok check (ends_at > starts_at)
);

create index if not exists consultation_slots_free_idx
  on public.consultation_slots (provider_id, starts_at) where not is_booked;

-- isti izvođač ne može imati dva termina koja se preklapaju
create extension if not exists btree_gist;
alter table public.consultation_slots drop constraint if exists consultation_slots_no_overlap;
alter table public.consultation_slots add constraint consultation_slots_no_overlap
  exclude using gist (provider_id with =, tstzrange(starts_at, ends_at) with &&);

create table if not exists public.consultations (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null unique references public.consultation_slots(id) on delete restrict,
  client_id    uuid not null references auth.users(id),
  provider_id  uuid not null references auth.users(id),
  state        consultation_state not null default 'requested',
  topic        text not null,
  price_km     numeric(12,2) not null,
  payment_id   uuid references public.job_payments(id),
  meeting_url  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.book_slot() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  update public.consultation_slots set is_booked = true
   where id = new.slot_id and not is_booked;
  if not found then raise exception 'TERMIN_JE_ZAUZET'; end if;
  return new;
end $fn$;

drop trigger if exists consultations_book_slot on public.consultations;
create trigger consultations_book_slot before insert on public.consultations
  for each row execute function public.book_slot();

-- ------------------------------------------------- 4.4 Kapija: ko smije objaviti
-- Objava posla i slanje ponude traže KYC + depozit. Pravilo je u bazi, pa
-- vrijedi i za direktan API poziv, ne samo za našu aplikaciju.
drop policy if exists listings_insert_verified on public.listings;
create policy listings_insert_verified on public.listings for insert to authenticated
  with check (user_id = auth.uid() and public.can_transact());

drop policy if exists bids_insert_verified on public.bids;
create policy bids_insert_verified on public.bids for insert to authenticated
  with check (bidder_id = auth.uid() and public.can_transact());

-- ----------------------------------------------------------------- 4.5 RLS
alter table public.consultation_slots enable row level security;
alter table public.consultations      enable row level security;
alter table public.job_visibility_settings enable row level security;

drop policy if exists slots_read on public.consultation_slots;
create policy slots_read on public.consultation_slots for select to authenticated using (true);

drop policy if exists slots_own_write on public.consultation_slots;
create policy slots_own_write on public.consultation_slots for all to authenticated
  using (provider_id = auth.uid()) with check (provider_id = auth.uid() and public.can_transact());

drop policy if exists consultations_party on public.consultations;
create policy consultations_party on public.consultations for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid() or public.has_permission('dispute.read'));

drop policy if exists consultations_book on public.consultations;
create policy consultations_book on public.consultations for insert to authenticated
  with check (client_id = auth.uid() and public.can_transact());

drop policy if exists visibility_read on public.job_visibility_settings;
create policy visibility_read on public.job_visibility_settings for select to authenticated using (true);

drop policy if exists visibility_write on public.job_visibility_settings;
create policy visibility_write on public.job_visibility_settings for update to authenticated
  using (public.has_permission('it.system.manage')) with check (public.has_permission('it.system.manage'));
