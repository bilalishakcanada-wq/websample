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
