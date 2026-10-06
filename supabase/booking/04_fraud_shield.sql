-- =============================================================================
-- Zadatak · booking/04 — zaštita od prevare oko ponuda, statusa posla, escrowa
-- i dokaza na licu mjesta.
--
-- Nadograđuje booking/01–03 (koji su već na živoj bazi). Imena stanja ostaju ista:
--   listings.status:      published → assigned → completed / cancelled
--   job_payments.status:  funded → requested → released / refunded (ili disputed)
--   job_payments.work_state: in_progress → submitted → completed (+ revision,
--                            cancel_requested, disputed, cancelled)
-- "FUNDS_RESERVED" i "IN_PROGRESS" iz specifikacije su kod nas jedan korak: red u
-- job_payments nastaje tek kad je novac skinut s balansa, i odmah je in_progress.
--
-- Šta zatvara (sve provjereno na živoj bazi 05.10.2026., samo čitanjem):
--   1. Vlasnik je mogao direktnim API pozivom mijenjati listings.status: vratiti
--      plaćen posao u 'published' (nove ponude), proglasiti ga 'completed' bez isplate
--      ili 'cancelled' sa krivicom izvođača (kvari mu uspješnost). booking/03 je to
--      imao, ali nije primijenjen jer je dugme "Posao završen" pisalo direktno.
--      Ovdje je pravilo uže, pa to dugme i dalje radi za stare poslove bez uplate.
--   2. job_transition() je bila izvršiva za svakog prijavljenog: strana koja je
--      tražila prekid mogla je sama sebi upisati 'cancelled' i zaključati ugovor
--      (novac zaglavi), ili preskočiti predaju rada bez dokaza.
--   3. Stari request_job_payment() i open_job_dispute() mijenjali su status uplate
--      mimo state machine-a (bez dokaza, bez zapisa u job_events, ugovor zaglavi).
--   4. bidder_metrics() je svakome (i gostima) otkrivala KO je sve dao ponudu na
--      neki posao — dovoljno da se izvođači nađu i dogovore cijenu. Sada samo
--      vlasniku posla i timu.
--   5. Ništa u bazi nije garantovalo da red u job_payments odgovara stvarno
--      skinutom novcu i prihvaćenoj ponudi; iznos/strane su se mogli promijeniti
--      kasnije bilo kojom budućom funkcijom.
--   6. Nije bilo dokaza da je izvođač bio na licu mjesta.
--
-- Idempotentno: može se pustiti više puta. Ne mijenja nijednu funkciju iz
-- payments/02, airtasker/04 ni offers/bid_replies (rade i prije i poslije ovoga).
-- =============================================================================

-- ------------------------------------------------------------- 1. Slijepe ponude
-- bids RLS je već slijep (izvođač vidi samo svoj red, vlasnik posla sve) — ovo
-- zatvara jedinu rupu sa strane: funkciju koja vraća listu ponuđača.
create or replace function public.bidder_metrics(p_listing_id uuid)
returns table (user_id uuid, avg_rating numeric, review_count bigint, completed_jobs bigint, success_rate numeric, is_verified boolean)
language sql stable security definer set search_path = public
as $$
  select m.user_id, m.avg_rating, m.review_count, m.completed_jobs, m.success_rate, m.is_verified
    from public.provider_metrics() m
   where m.user_id in (select b.bidder_id from public.bids b where b.listing_id = p_listing_id)
     and (exists (select 1 from public.listings l where l.id = p_listing_id and l.user_id = auth.uid())
          or public.is_staff());
$$;
-- gosti je i dalje smiju pozvati (stranica posla je javna), ali dobijaju prazno
grant execute on function public.bidder_metrics(uuid) to anon, authenticated;

-- --------------------------------------------- 2. Status posla mijenja samo sistem
-- Vlasnik smije samo ono što ne dira novac ni tuđu reputaciju:
--   objaviti / povući / zatvoriti otvoren posao, i za stari posao bez uplate
--   (prihvaćen prije Zadatak Pay-a) označiti "završen" ili "otkazan".
-- Sve ostalo ('assigned', 'archived', izlazak iz completed/cancelled, bilo kakva
-- promjena dok postoji uplata) radi isključivo SECURITY DEFINER funkcija ili admin.
create or replace function public.guard_listing_status()
returns trigger language plpgsql set search_path = public
as $$
declare v_accepted boolean;
begin
  -- funkcije platforme (SECURITY DEFINER → current_user je vlasnik), cron i admin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  -- polja koja računa sistem
  new.completed_at := old.completed_at;
  new.cancelled_at := old.cancelled_at;
  new.bid_count := old.bid_count;
  new.created_at := old.created_at;

  if new.status is not distinct from old.status then
    new.cancel_reason := old.cancel_reason;
    return new;
  end if;

  if exists (select 1 from public.job_payments p where p.listing_id = old.id) then
    raise exception 'STATUS_ZAKLJUCAN: posao ima uplatu na Zadatku; status se mijenja samo kroz tok posla'
      using errcode = '42501';
  end if;
  if old.status in ('assigned', 'completed', 'cancelled', 'archived') then
    raise exception 'STATUS_ZAKLJUCAN: posao je zatvoren (%)', old.status using errcode = '42501';
  end if;
  if new.status not in ('draft', 'published', 'paused', 'closed', 'cancelled', 'completed') then
    raise exception 'STATUS_ZABRANJEN: % postavlja samo sistem', new.status using errcode = '42501';
  end if;

  select exists (select 1 from public.bids b where b.listing_id = old.id and b.status = 'accepted') into v_accepted;
  if new.status = 'completed' and not v_accepted then
    raise exception 'STATUS_ZABRANJEN: posao bez prihvaćene ponude ne može biti završen' using errcode = '42501';
  end if;
  -- krivica izvođača (računa mu se u uspješnost) samo ako je izvođač uopšte postojao
  if new.status = 'cancelled' and new.cancel_reason = 'provider' and not v_accepted then
    new.cancel_reason := 'client';
  end if;
  return new;
end $$;

drop trigger if exists listings_status_guard on public.listings;
create trigger listings_status_guard before update on public.listings
  for each row execute function public.guard_listing_status();

-- ------------------------------------- 3. Escrow: red = stvarno skinut novac
alter table public.job_payments add column if not exists proof_required boolean not null default false;

-- Pri nastanku ugovora baza sama provjerava: ponuda je ta, strane su te, iznos je
-- tačno iznos ponude, naknada je izračunata tačno, i U ISTOJ TRANSAKCIJI je sa
-- balansa klijenta skinut tačno taj iznos. Bez toga nema "in_progress".
create or replace function public.guard_job_payment_insert()
returns trigger language plpgsql set search_path = public
as $$
declare v_bid public.bids; v_listing public.listings;
begin
  select * into v_bid from public.bids where id = new.bid_id;
  select * into v_listing from public.listings where id = new.listing_id;
  if v_bid.id is null or v_listing.id is null or v_bid.listing_id <> v_listing.id then
    raise exception 'ESCROW_NEISPRAVAN: ponuda ne pripada poslu' using errcode = 'P0001';
  end if;
  if new.client_id is distinct from v_listing.user_id or new.provider_id is distinct from v_bid.bidder_id
     or new.client_id = new.provider_id then
    raise exception 'ESCROW_NEISPRAVAN: strane ugovora ne odgovaraju poslu i ponudi' using errcode = 'P0001';
  end if;
  if new.amount is null or new.amount <= 0 or new.amount <> v_bid.amount then
    raise exception 'ESCROW_NEISPRAVAN: iznos % nije dogovoreni iznos ponude %', new.amount, v_bid.amount using errcode = 'P0001';
  end if;
  if new.fee_amount <> round(new.amount * new.fee_percent / 100, 2)
     or new.net_amount <> round(new.amount - new.amount * new.fee_percent / 100, 2) then
    raise exception 'ESCROW_NEISPRAVAN: naknada nije tačno obračunata' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.wallet_transactions w
     where w.user_id = new.client_id and w.kind = 'escrow_hold'
       and w.amount = -round(new.amount, 2) and w.created_at = now()   -- now() = početak ove transakcije
  ) then
    raise exception 'ESCROW_NIJE_OSIGURAN: iznos nije skinut s balansa klijenta' using errcode = 'P0001';
  end if;

  new.status := 'funded';
  new.work_state := 'in_progress';
  new.funded_at := now();
  -- posao na terenu (nije online): izvođač mora slikati prije i poslije, sa GPS-om
  new.proof_required := not (coalesce(v_listing.location, '') ~* '(online|daljin|remote)');
  return new;
end $$;

drop trigger if exists job_payments_insert_guard on public.job_payments;
create trigger job_payments_insert_guard before insert on public.job_payments
  for each row execute function public.guard_job_payment_insert();

-- Nakon nastanka: strane, ponuda, posao i postotak naknade se nikad ne mijenjaju.
-- Iznos smije samo rasti (odobreno povećanje cijene, payments/02), i samo ako je
-- razlika u istoj transakciji skinuta s balansa klijenta.
create or replace function public.guard_job_payment_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.listing_id is distinct from old.listing_id or new.bid_id is distinct from old.bid_id
     or new.client_id is distinct from old.client_id or new.provider_id is distinct from old.provider_id
     or new.fee_percent is distinct from old.fee_percent or new.funded_at is distinct from old.funded_at
     or new.created_at is distinct from old.created_at or new.proof_required is distinct from old.proof_required then
    raise exception 'ESCROW_ZAKLJUCAN: strane i uslovi ugovora se ne mijenjaju' using errcode = '42501';
  end if;
  if new.amount < old.amount then
    raise exception 'ESCROW_ZAKLJUCAN: osigurani iznos se ne smanjuje (povrat ide kroz spor ili prekid)' using errcode = '42501';
  end if;
  if new.amount > old.amount and not exists (
    select 1 from public.wallet_transactions w
     where w.user_id = old.client_id and w.kind = 'escrow_hold'
       and w.amount = -round(new.amount - old.amount, 2) and w.created_at = now()
  ) then
    raise exception 'ESCROW_NIJE_OSIGURAN: povećanje nije skinuto s balansa klijenta' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists job_payments_update_guard on public.job_payments;
create trigger job_payments_update_guard before update on public.job_payments
  for each row execute function public.guard_job_payment_update();

-- ------------------------------------------- 4. State machine samo kroz akcije
-- job_transition je interni korak akcija (submit_work, approve_work, open_dispute,
-- request_cancellation…). Direktno pozvana preskakala je njihove provjere.
revoke all on function public.job_transition(uuid, public.work_state, jsonb) from public, anon, authenticated;
revoke all on function public.job_transition_system(uuid, public.work_state, jsonb) from public, anon, authenticated;
-- stari putevi iz prvog Zadatak Pay-a: zamijenjeni sa submit_work i open_dispute
revoke all on function public.request_job_payment(uuid) from public, anon, authenticated;
revoke all on function public.open_job_dispute(uuid, text) from public, anon, authenticated;

-- ------------------------------------------------ 5. Foto dokaz na licu mjesta
-- Slika se pravi kamerom u aplikaciji (ne iz galerije), aplikacija na nju utisne
-- GPS i UTC vrijeme, a baza zapisuje i SVOJE vrijeme prijema, udaljenost od
-- lokacije posla i SHA-256 otisak fajla (ista slika se ne može predati dvaput).
create table if not exists public.work_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.job_payments(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('before', 'after')),
  photo_url text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m numeric not null check (accuracy_m >= 0),
  captured_at timestamptz not null,               -- vrijeme uređaja (UTC), utisnuto na slici
  received_at timestamptz not null default now(), -- vrijeme servera, ne može se lažirati
  distance_m numeric,                             -- od tačke posla; null ako posao nema koordinate
  source text not null default 'camera' check (source in ('camera', 'camera_file')),
  created_at timestamptz not null default now()
);
create unique index if not exists work_proofs_sha256_key on public.work_proofs (sha256);
create index if not exists work_proofs_payment_idx on public.work_proofs (payment_id, kind, received_at);

alter table public.work_proofs enable row level security;
revoke all on public.work_proofs from anon, authenticated;
grant select on public.work_proofs to authenticated;
drop policy if exists work_proofs_party_read on public.work_proofs;
create policy work_proofs_party_read on public.work_proofs for select to authenticated
  using (exists (select 1 from public.job_payments p
                  where p.id = work_proofs.payment_id and auth.uid() in (p.client_id, p.provider_id))
         or public.is_staff());

-- udaljenost u metrima (haversine) — za jednu tačku PostGIS nije potreban
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns numeric language sql immutable set search_path = public
as $$
  select round((2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )))::numeric, 0)
$$;

create or replace function public.add_work_proof(
  p_listing uuid, p_kind text, p_photo_url text, p_sha256 text,
  p_lat double precision, p_lng double precision, p_accuracy_m numeric,
  p_captured_at timestamptz, p_source text default 'camera')
returns public.work_proofs
language plpgsql security definer set search_path = public
as $$
declare v_pay public.job_payments; v_listing public.listings; v_row public.work_proofs;
begin
  select * into v_pay from public.job_payments where listing_id = p_listing for update;
  if v_pay.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_pay.provider_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_pay.status <> 'funded' or v_pay.work_state not in ('in_progress', 'revision') then
    raise exception 'DOKAZ_NIJE_MOGUC: slike se dodaju dok posao traje' using errcode = 'P0001';
  end if;
  if p_kind not in ('before', 'after') then raise exception 'BAD_KIND' using errcode = 'P0001'; end if;
  if p_kind = 'after' and not exists (select 1 from public.work_proofs where payment_id = v_pay.id and kind = 'before') then
    raise exception 'PRVO_SLIKA_PRIJE: prvo slikaj stanje prije početka rada' using errcode = 'P0001';
  end if;
  -- slika mora biti u izvođačevom folderu u našem skladištu, ne bilo koji link
  if p_photo_url is null or p_photo_url like '%..%'
     or position('/storage/v1/object/public/media/' || auth.uid()::text || '/proof/' in p_photo_url) = 0 then
    raise exception 'DOKAZ_NEISPRAVAN: slika nije poslana iz aplikacije' using errcode = 'P0001';
  end if;
  if p_sha256 is null or lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception 'DOKAZ_NEISPRAVAN: nedostaje otisak slike' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.work_proofs where sha256 = lower(p_sha256)) then
    raise exception 'DOKAZ_VEC_KORISTEN: ova slika je već predata' using errcode = 'P0001';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_lat = 0 and p_lng = 0) then
    raise exception 'GPS_OBAVEZAN: uključi lokaciju na telefonu' using errcode = 'P0001';
  end if;
  if p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 2000 then
    raise exception 'GPS_PRESLAB: lokacija nije dovoljno tačna (%) — izađi na otvoreno i pokušaj ponovo', p_accuracy_m using errcode = 'P0001';
  end if;
  -- slika je napravljena upravo sada (vrijeme uređaja se poredi sa serverom)
  if p_captured_at is null or p_captured_at < now() - interval '10 minutes' or p_captured_at > now() + interval '2 minutes' then
    raise exception 'DOKAZ_ZASTARIO: slika mora biti napravljena upravo sada (provjeri sat na telefonu)' using errcode = 'P0001';
  end if;
  if (select count(*) from public.work_proofs where payment_id = v_pay.id) >= 30 then
    raise exception 'PREVISE_SLIKA' using errcode = 'P0001';
  end if;

  select * into v_listing from public.listings where id = p_listing;
  insert into public.work_proofs (payment_id, provider_id, kind, photo_url, sha256, lat, lng, accuracy_m, captured_at, distance_m, source)
  values (v_pay.id, auth.uid(), p_kind, p_photo_url, lower(p_sha256), p_lat, p_lng, round(p_accuracy_m, 1), p_captured_at,
          case when v_listing.lat is not null and v_listing.lng is not null
               then public.geo_distance_m(v_listing.lat, v_listing.lng, p_lat, p_lng) end,
          case when p_source = 'camera_file' then 'camera_file' else 'camera' end)
  returning * into v_row;

  insert into public.job_events (payment_id, from_state, to_state, actor_id, actor_role, detail)
  values (v_pay.id, v_pay.work_state, v_pay.work_state, auth.uid(), 'provider',
          jsonb_build_object('dokaz', p_kind, 'lat', p_lat, 'lng', p_lng, 'tacnost_m', round(p_accuracy_m, 1),
                             'udaljenost_m', v_row.distance_m, 'sha256', v_row.sha256));
  return v_row;
end $$;
revoke all on function public.add_work_proof(uuid, text, text, text, double precision, double precision, numeric, timestamptz, text) from public, anon;
grant execute on function public.add_work_proof(uuid, text, text, text, double precision, double precision, numeric, timestamptz, text) to authenticated;

-- submit_work: isto kao booking/02, plus — za posao na terenu — slika PRIJE i
-- svježa slika POSLIJE (novija od zadnje predaje, da se ispravka ne preda starom slikom).
create or replace function public.submit_work(p_listing uuid, p_report text, p_evidence text[] default '{}'::text[])
returns public.job_payments
language plpgsql security definer set search_path = public
as $$
declare v_row public.job_payments; v_rev smallint; v_last timestamptz;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'NOVAC_NIJE_U_ESCROWU' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_report, ''))) < 20 and coalesce(array_length(p_evidence, 1), 0) = 0 then
    raise exception 'DOKAZ_JE_OBAVEZAN: prilozi slike ili napisi izvjestaj (min. 20 znakova)' using errcode = 'P0001';
  end if;

  if v_row.proof_required then
    if not exists (select 1 from public.work_proofs where payment_id = v_row.id and kind = 'before') then
      raise exception 'FOTO_PRIJE_OBAVEZAN: slikaj stanje prije početka rada (kamerom, sa lokacijom)' using errcode = 'P0001';
    end if;
    select max(submitted_at) into v_last from public.work_submissions where payment_id = v_row.id;
    if not exists (select 1 from public.work_proofs where payment_id = v_row.id and kind = 'after'
                     and received_at > coalesce(v_last, '-infinity'::timestamptz)) then
      raise exception 'FOTO_POSLIJE_OBAVEZAN: slikaj urađen posao (kamerom, sa lokacijom)' using errcode = 'P0001';
    end if;
  end if;

  v_rev := v_row.revision_count;
  insert into public.work_submissions (payment_id, provider_id, revision_no, report, evidence_urls)
  values (v_row.id, auth.uid(), v_rev, btrim(p_report), p_evidence);

  perform public.job_transition(v_row.id, 'submitted',
    jsonb_build_object('revision_no', v_rev, 'dokaza', coalesce(array_length(p_evidence, 1), 0)));

  update public.job_payments
     set submitted_at = now(), review_deadline = now() + interval '72 hours', status = 'requested'
   where id = v_row.id returning * into v_row;

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.client_id, 'job', 'Rad je predat na pregled',
     'Izvođač je označio posao završenim i priložio dokaz. Imaš 72 sata da pregledaš i odobriš — nakon toga se uplata oslobađa automatski.',
     '/listings/' || p_listing::text);
  return v_row;
end $$;

-- automatska isplata nakon 72 h (booking/02) — osigurati da je zakazana
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('auto-release-reviews', '*/15 * * * *', $c$ select public.auto_release_expired_reviews(); $c$);
  end if;
end $$;
