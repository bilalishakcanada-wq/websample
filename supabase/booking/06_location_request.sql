-- ============================================================================
-- BOOKING 06 — klijent traži lokaciju, izvođač bira koliko dugo je dijeli
-- ----------------------------------------------------------------------------
-- Nadogradnja na 05 („Izvođač je na putu“). Pravila:
--   • klijent posla u toku može ZATRAŽITI lokaciju; izvođač dobije obavijest
--     i sam odluči: „Dijeli lokaciju“ ili „Ne sada“ (klijent dobije odgovor);
--   • zahtjev nikad ne uključuje GPS: dijeljenje pokreće samo izvođač;
--   • izvođač bira trajanje (30 min / 1 h / 2 h); poslije toga se dijeljenje
--     samo gasi, i baza više ne prima tačke (ni sa starijih verzija aplikacije);
--   • „Stigao sam“ gasi dijeljenje i javi klijentu da je izvođač stigao;
--   • novi zahtjev najranije 2 minute poslije prethodnog (bez spama).
-- Treba 05_live_location.sql. Bezbjedno ponovo pokrenuti.
-- ============================================================================

-- ----------------------------------------------- koliko dugo traje dijeljenje
alter table public.job_live_locations add column if not exists share_until timestamptz;

drop policy if exists live_location_parties on public.job_live_locations;
create policy live_location_parties on public.job_live_locations for select to authenticated
  using ((client_id = auth.uid() or provider_id = auth.uid() or public.is_staff())
         and updated_at > now() - interval '3 hours'
         and (share_until is null or share_until > now()));

-- ------------------------------------------------------------- zahtjevi
create table if not exists public.job_location_requests (
  payment_id   uuid primary key references public.job_payments(id) on delete cascade,
  client_id    uuid not null references auth.users(id) on delete cascade,
  provider_id  uuid not null references auth.users(id) on delete cascade,
  state        text not null default 'pending' check (state in ('pending', 'declined')),
  requested_at timestamptz not null default now(),
  answered_at  timestamptz
);

alter table public.job_location_requests enable row level security;
drop policy if exists location_request_parties on public.job_location_requests;
create policy location_request_parties on public.job_location_requests for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid() or public.is_staff());
revoke all on public.job_location_requests from anon, authenticated;
grant select on public.job_location_requests to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.job_location_requests;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- ------------------------------------------------ klijent traži lokaciju
create or replace function public.request_live_location(p_listing uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $fn$
declare v_pay public.job_payments; v_prev timestamptz;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_pay from public.job_payments where listing_id = p_listing for update;
  if v_pay.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_pay.client_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_pay.status <> 'funded' or v_pay.work_state not in ('in_progress', 'revision') then
    raise exception 'LOKACIJA_NIJE_MOGUCA: lokaciju možeš tražiti samo dok je posao u toku' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.job_live_locations
              where payment_id = v_pay.id and updated_at > now() - interval '3 minutes'
                and (share_until is null or share_until > now())) then
    raise exception 'LOKACIJA_NIJE_MOGUCA: izvođač već dijeli lokaciju' using errcode = 'P0001';
  end if;

  select requested_at into v_prev from public.job_location_requests where payment_id = v_pay.id;
  if v_prev is not null and v_prev > now() - interval '2 minutes' then
    raise exception 'LOKACIJA_NIJE_MOGUCA: zahtjev je već poslan, pokušaj ponovo za 2 minute' using errcode = 'P0001';
  end if;

  insert into public.job_location_requests as r (payment_id, client_id, provider_id)
  values (v_pay.id, v_pay.client_id, v_pay.provider_id)
  on conflict (payment_id) do update set state = 'pending', requested_at = now(), answered_at = null;

  insert into public.notifications (user_id, type, title, message, link) values
    (v_pay.provider_id, 'job', 'Klijent traži tvoju lokaciju',
     'Otvori posao i odluči da li dijeliš lokaciju dok dolaziš. Bez tvog pristanka ništa se ne dijeli.',
     '/listings/' || p_listing::text);
  return now();
end $fn$;

-- ------------------------------------------ izvođač: „Ne sada“
create or replace function public.decline_location_request(p_listing uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_pay public.job_payments;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_pay from public.job_payments where listing_id = p_listing;
  if v_pay.id is null or v_pay.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.job_location_requests set state = 'declined', answered_at = now()
   where payment_id = v_pay.id and state = 'pending';
  if found then
    insert into public.notifications (user_id, type, title, message, link) values
      (v_pay.client_id, 'job', 'Izvođač trenutno ne dijeli lokaciju',
       'Izvođač je vidio tvoj zahtjev. Javit će se kad krene, a možeš mu pisati u porukama.',
       '/listings/' || p_listing::text);
  end if;
end $fn$;

-- --------------- izvođač šalje tačku (05 + trajanje + zahtjev se zatvara)
drop function if exists public.share_live_location(uuid, double precision, double precision, real, real, real);
create or replace function public.share_live_location(
  p_listing uuid, p_lat double precision, p_lng double precision,
  p_accuracy_m real default null, p_heading real default null, p_speed_mps real default null,
  p_minutes integer default null
) returns timestamptz
language plpgsql security definer set search_path = public as $fn$
declare v_pay public.job_payments; v_row public.job_live_locations; v_new boolean; v_expired boolean;
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
  if p_minutes is not null and p_minutes not between 5 and 180 then
    raise exception 'LOKACIJA_NEISPRAVNA' using errcode = 'P0001';
  end if;

  select * into v_row from public.job_live_locations where payment_id = v_pay.id for update;
  v_expired := v_row.payment_id is not null and v_row.updated_at >= now() - interval '3 hours'
               and v_row.share_until is not null and v_row.share_until <= now();
  -- isteklo vrijeme se ne produžava tačkama: izvođač mora ponovo kliknuti „Dijeli“ (tada šalje p_minutes)
  if v_expired and p_minutes is null then
    raise exception 'LOKACIJA_ISTEKLA: vrijeme dijeljenja je isteklo' using errcode = 'P0001';
  end if;
  -- novi polazak: nema reda, pauza duža od 3 h, ili ponovno pokretanje poslije isteka
  v_new := v_row.payment_id is null or v_row.updated_at < now() - interval '3 hours' or v_expired;

  -- najviše jedna tačka u 3 sekunde po poslu (telefon u autu ne smije zatrpati bazu)
  if not v_new and v_row.updated_at > now() - interval '3 seconds' and p_minutes is null then return v_row.updated_at; end if;

  insert into public.job_live_locations as l
    (payment_id, provider_id, client_id, lat, lng, accuracy_m, heading, speed_mps, share_until)
  values (v_pay.id, v_pay.provider_id, v_pay.client_id, p_lat, p_lng,
          least(greatest(p_accuracy_m, 0), 100000), p_heading, greatest(p_speed_mps, 0),
          case when p_minutes is null then null else now() + make_interval(mins => p_minutes) end)
  on conflict (payment_id) do update set
    lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m,
    heading = excluded.heading, speed_mps = excluded.speed_mps, updated_at = now(),
    started_at = case when v_new then now() else l.started_at end,
    share_until = case when p_minutes is not null then excluded.share_until
                       when v_new then null else l.share_until end;

  -- zahtjev klijenta je ispunjen
  delete from public.job_location_requests where payment_id = v_pay.id;

  -- klijent dobije jednu obavijest po polasku, ne po tački
  if v_new then
    insert into public.notifications (user_id, type, title, message, link) values
      (v_pay.client_id, 'job', 'Izvođač je krenuo',
       'Izvođač dijeli lokaciju dok dolazi. Otvori posao da ga vidiš na mapi.',
       '/listings/' || p_listing::text);
  end if;
  return now();
end $fn$;

-- ------------------------------------------------- izvođač: „Stigao sam“
create or replace function public.arrived_live_location(p_listing uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_pay public.job_payments;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_pay from public.job_payments where listing_id = p_listing;
  if v_pay.id is null or v_pay.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  delete from public.job_live_locations where payment_id = v_pay.id;
  delete from public.job_location_requests where payment_id = v_pay.id;
  if v_pay.status = 'funded' and v_pay.work_state in ('in_progress', 'revision') then
    insert into public.notifications (user_id, type, title, message, link) values
      (v_pay.client_id, 'job', 'Izvođač je stigao',
       'Izvođač je javio da je stigao na mjesto posla. Dijeljenje lokacije je ugašeno.',
       '/listings/' || p_listing::text);
  end if;
end $fn$;

-- --------------------------- kad posao više nije „u toku“, i zahtjevi nestaju
create or replace function public.live_location_cleanup()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.status <> 'funded' or new.work_state not in ('in_progress', 'revision') then
    delete from public.job_live_locations where payment_id = new.id;
    delete from public.job_location_requests where payment_id = new.id;
  end if;
  return new;
end $fn$;

revoke all on function public.request_live_location(uuid) from public, anon;
revoke all on function public.decline_location_request(uuid) from public, anon;
revoke all on function public.share_live_location(uuid, double precision, double precision, real, real, real, integer) from public, anon;
revoke all on function public.arrived_live_location(uuid) from public, anon;
revoke all on function public.live_location_cleanup() from public, anon, authenticated;
grant execute on function public.request_live_location(uuid) to authenticated;
grant execute on function public.decline_location_request(uuid) to authenticated;
grant execute on function public.share_live_location(uuid, double precision, double precision, real, real, real, integer) to authenticated;
grant execute on function public.arrived_live_location(uuid) to authenticated;

notify pgrst, 'reload schema';
