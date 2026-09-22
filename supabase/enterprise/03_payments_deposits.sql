-- ============================================================================
-- MODUL 3 — Finansije, depoziti i escrow
-- ----------------------------------------------------------------------------
-- Nadogradnja postojećih tabela job_payments i wallet_transactions.
--
-- TRI VAŽNE NAPOMENE PRIJE KODA:
--
-- 1) "Onemogućen povrat" u softveru znači: platforma sama ne može vratiti novac
--    nakon isplate. To je ovdje implementirano i nepremostivo bez odobrenja
--    Team Leada. ALI: chargeback koji korisnik pokrene kod SVOJE banke ne može
--    se ugasiti kodom — to je pravo vlasnika kartice na nivou kartične sheme.
--    Zato postoji tabela chargebacks: kad banka javi spor, bilježimo ga i
--    prilažemo dokaze (potpisan ugovor, liveness, isporuka). Odbrana od
--    chargebacka je dokumentacija, ne zabrana u bazi.
--
-- 2) Skrivanje naknada: klijent vidi samo konačnu cijenu — to je standard
--    (Airtasker, Uber). Ovdje je izvedeno na nivou baze (oduzeta prava na
--    kolone), ne samo u UI-u. Račun/faktura i dalje mora pokazati ukupan
--    naplaćen iznos, a za pravna lica i PDV — to ide u invoices.
--
-- 3) Depozit od 2.000 / 4.000 KM je ozbiljna prepreka za ulazak. Šema podržava
--    i djelimično oslobađanje (deposit.waive) ako se odlučite na blaži start.
-- ============================================================================

do $$ begin
  create type deposit_state as enum ('none', 'pending', 'held', 'partially_released', 'released', 'forfeited');
  create type payment_state as enum ('created', 'funded', 'work_done', 'released', 'refunded', 'disputed', 'charged_back');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- 3.1 Depoziti
create table if not exists public.deposit_requirements (
  party_kind      party_kind primary key,
  amount_km       numeric(12,2) not null,
  effective_from  timestamptz not null default now()
);

insert into public.deposit_requirements (party_kind, amount_km) values
  ('business',   4000.00),
  ('individual', 2000.00)
on conflict (party_kind) do update set amount_km = excluded.amount_km;

create table if not exists public.deposit_accounts (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  party_kind     party_kind not null,
  required_km    numeric(12,2) not null,
  held_km        numeric(12,2) not null default 0 check (held_km >= 0),
  waived_km      numeric(12,2) not null default 0 check (waived_km >= 0),
  state          deposit_state not null default 'none',
  waived_by      uuid references auth.users(id),
  waive_reason   text,
  held_at        timestamptz,
  released_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.deposit_movements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount_km    numeric(12,2) not null,           -- + uplata, − povrat/naplata
  kind         text not null,                    -- 'top_up' | 'release' | 'forfeit' | 'waive'
  reference    text,                             -- PSP referenca
  actor_id     uuid references auth.users(id),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists deposit_movements_user_idx on public.deposit_movements (user_id, created_at desc);

-- Pokrivenost depozita = uplaćeno + oprošteno >= traženo.
create or replace function public.has_deposit(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce((select held_km + waived_km >= required_km
                   from public.deposit_accounts where user_id = p_user), false);
$fn$;

-- Jedna kapija za cijelu platformu: smije li korisnik uopšte poslovati?
create or replace function public.can_transact(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $fn$
  select public.is_kyc_verified(p_user)
     and public.has_deposit(p_user)
     and not exists (select 1 from public.profiles
                     where user_id = p_user
                       and (account_status <> 'active' or coalesce(suspended_until, now() - interval '1s') > now()));
$fn$;

comment on function public.can_transact(uuid) is
  'KYC odobren + depozit pokriven + nalog nije suspendovan. Koristi se u RLS-u za objavu posla, ponudu i isplatu.';

-- ------------------------------------------------- 3.2 Escrow — zabrana povrata
alter table public.job_payments
  add column if not exists released_final boolean not null default false,
  add column if not exists refund_authorized_by uuid references auth.users(id),
  add column if not exists refund_authorized_at timestamptz,
  add column if not exists refund_case_id uuid;

-- Srce zahtjeva: kad je novac jednom isplaćen, status se više ne može vratiti
-- na 'refunded' bez izričitog odobrenja Team Leada (upisanog u isti red).
create or replace function public.guard_payment_finality() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  -- isplata je konačna
  if old.status = 'released' and old.released_final then
    if new.status = 'refunded' then
      if new.refund_authorized_by is null or new.refund_authorized_at is null then
        raise exception 'POVRAT_ZABRANJEN: isplaćen posao se ne može vratiti bez odobrenja Team Leada'
          using errcode = 'P0001';
      end if;
      -- odobrenje mora biti stvarno i od nekoga ko ima to ovlaštenje
      if not exists (
        select 1 from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.staff_members sm on sm.user_id = ur.user_id and sm.is_active
        where ur.user_id = new.refund_authorized_by and rp.permission_code = 'refund.authorize'
      ) then
        raise exception 'POVRAT_ZABRANJEN: odobritelj nema ovlaštenje refund.authorize' using errcode = 'P0001';
      end if;
      perform public.audit('payment.refund_after_release', 'job_payment', new.id, 'refund.authorize',
                           jsonb_build_object('amount', new.amount, 'authorized_by', new.refund_authorized_by));
    elsif new.status <> old.status then
      raise exception 'ZAKLJUCANO: isplaćen posao mijenja status samo u refunded (uz odobrenje)'
        using errcode = 'P0001';
    end if;
  end if;

  -- iznosi se ne prepravljaju nakon uplate u escrow
  if old.status in ('funded', 'released') and
     (new.amount <> old.amount or new.fee_percent <> old.fee_percent or new.fee_amount <> old.fee_amount) then
    raise exception 'ZAKLJUCANO: iznos i provizija se ne mijenjaju nakon uplate' using errcode = 'P0001';
  end if;

  if new.status = 'released' and old.status <> 'released' then
    new.released_final := true;
    new.released_at := coalesce(new.released_at, now());
  end if;
  return new;
end $fn$;

drop trigger if exists job_payments_finality on public.job_payments;
create trigger job_payments_finality before update on public.job_payments
  for each row execute function public.guard_payment_finality();

-- Finansijski zapis se NIKAD ne briše — ni isplaćen, ni vraćen, ni otkazan.
-- (Prva verzija je puštala brisanje vraćenog plaćanja; test T6 je to otkrio.)
-- Storniranje se radi novim redom, ne brisanjem starog.
create or replace function public.guard_payment_delete() returns trigger
language plpgsql as $fn$
begin
  raise exception 'ZAKLJUCANO: finansijski zapis se ne briše (storniraj novim zapisom)'
    using errcode = 'P0001';
end $fn$;

drop trigger if exists job_payments_no_delete on public.job_payments;
create trigger job_payments_no_delete before delete on public.job_payments
  for each row execute function public.guard_payment_delete();

-- ------------------------------------------------------------ 3.3 Chargebackovi
create table if not exists public.chargebacks (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references public.job_payments(id),
  psp_case_ref  text not null unique,
  amount_km     numeric(12,2) not null,
  reason_code   text,
  opened_at     timestamptz not null default now(),
  evidence_due  timestamptz,
  evidence      jsonb not null default '{}',     -- ugovor, liveness, isporuka, prepiska
  outcome       text,                            -- 'won' | 'lost' | 'pending'
  closed_at     timestamptz
);

comment on table public.chargebacks is
  'Spor pokrenut kod banke korisnika. Ne može se spriječiti kodom — brani se dokazima.';

-- ------------------------------------------------- 3.4 Skrivanje naknada od klijenta
-- Provizija i neto iznos postoje u bazi, ali ih klijent NE MOŽE pročitati.
--
-- PAŽNJA (provjereno na lokalnom Postgresu): samo "REVOKE SELECT (kolona)" NE RADI
-- ako roli već postoji dozvola na nivou cijele tabele — Postgres je tiho ignoriše i
-- kolona ostaje čitljiva. Supabase daje upravo takav table-level GRANT roli
-- authenticated. Zato prvo skidamo dozvolu sa tabele, pa je vraćamo nabrojanim
-- kolonama. Poslije ovoga `select *` na job_payments pada s greškom — namjerno,
-- da se propust vidi odmah, a ne da tiho procuri.
revoke select on public.job_payments from authenticated, anon;
grant select (
  id, listing_id, bid_id, client_id, provider_id, amount, status,
  funded_at, requested_at, released_at, refunded_at, disputed_at,
  dispute_reason, dispute_by, resolved_by, resolution, created_at,
  released_final
) on public.job_payments to authenticated;

-- POSLJEDICA ZA APLIKACIJU: src/services/paymentService.js trenutno radi
--   supabase.from('job_payments').select('*')
-- što će sada pasti. Zamijeniti sa pogledom ispod:
--   supabase.from('my_payments_client').select('*')   // za klijenta
--   supabase.from('my_payments_provider').select('*') // za izvođača

-- Klijent i izvođač čitaju svoj pogled. Klijent vidi samo ukupno.
create or replace view public.my_payments_client
with (security_invoker = true) as
  select p.id, p.listing_id, p.bid_id, p.provider_id,
         p.amount as total_km,           -- jedini iznos koji klijent vidi
         p.status, p.funded_at, p.released_at, p.created_at
  from public.job_payments p
  where p.client_id = auth.uid();

-- Izvođač vidi šta će mu sjesti na račun (neto), jer to je njegov prihod.
create or replace view public.my_payments_provider
with (security_invoker = true) as
  select p.id, p.listing_id, p.bid_id, p.client_id,
         p.net_amount as payout_km,
         p.status, p.funded_at, p.released_at, p.created_at
  from public.job_payments p
  where p.provider_id = auth.uid();

grant select on public.my_payments_client, public.my_payments_provider to authenticated;

-- Puna slika sa provizijom — samo za one koji imaju finance.fees.read.
create or replace function public.payment_breakdown(p_payment uuid)
returns table (amount numeric, fee_percent numeric, fee_amount numeric, net_amount numeric)
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.has_permission('finance.fees.read') then
    raise exception 'FORBIDDEN: nedostaje finance.fees.read' using errcode = '42501';
  end if;
  perform public.audit('payment.breakdown.read', 'job_payment', p_payment, 'finance.fees.read');
  return query select p.amount, p.fee_percent, p.fee_amount, p.net_amount
               from public.job_payments p where p.id = p_payment;
end $fn$;

-- --------------------------------------- 3.4b Realtime bez curenja provizije
-- job_payments je danas u publikaciji supabase_realtime, a Realtime šalje CIJELI
-- red — uključujući fee_amount i net_amount — svakome ko sluša taj kanal.
-- Kolonske dozvole tu ne pomažu. Rješenje: klijent više ne sluša job_payments
-- nego payment_events, gdje ide samo ono što smije vidjeti.
create table if not exists public.payment_events (
  id          bigserial primary key,
  payment_id  uuid not null references public.job_payments(id) on delete cascade,
  listing_id  uuid not null,
  client_id   uuid not null,
  provider_id uuid not null,
  status      text not null,
  total_km    numeric(12,2) not null,   -- ukupno; NIKAD provizija ni neto
  happened_at timestamptz not null default now()
);

create index if not exists payment_events_listing_idx on public.payment_events (listing_id, happened_at desc);

alter table public.payment_events enable row level security;

drop policy if exists payment_events_party on public.payment_events;
create policy payment_events_party on public.payment_events for select to authenticated
  using (client_id = auth.uid() or provider_id = auth.uid());

create or replace function public.emit_payment_event() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.payment_events (payment_id, listing_id, client_id, provider_id, status, total_km)
    values (new.id, new.listing_id, new.client_id, new.provider_id, new.status, new.amount);
  end if;
  return new;
end $fn$;

drop trigger if exists job_payments_emit_event on public.job_payments;
create trigger job_payments_emit_event after insert or update on public.job_payments
  for each row execute function public.emit_payment_event();

-- Izvedi ova dva reda pri deployu (ne mogu unutar transakcije sa svime ostalim):
--   alter publication supabase_realtime drop table public.job_payments;
--   alter publication supabase_realtime add table public.payment_events;
-- i u paymentService.js promijeni pretplatu sa table: 'job_payments' na 'payment_events'.

-- ---------------------------------------------------------------- 3.5 Fakture
-- Zakon traži dokument sa ukupno naplaćenim iznosom; za pravna lica i PDV.
create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  payment_id   uuid not null references public.job_payments(id),
  user_id      uuid not null references auth.users(id),
  number       text not null unique,
  party_kind   party_kind not null,
  total_km     numeric(12,2) not null,
  vat_km       numeric(12,2) not null default 0,
  pdf_path     text,
  issued_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------- 3.6 RLS
alter table public.deposit_accounts    enable row level security;
alter table public.deposit_movements   enable row level security;
alter table public.chargebacks         enable row level security;
alter table public.invoices            enable row level security;
alter table public.deposit_requirements enable row level security;

drop policy if exists deposit_req_read on public.deposit_requirements;
create policy deposit_req_read on public.deposit_requirements for select to authenticated using (true);

drop policy if exists deposit_own_read on public.deposit_accounts;
create policy deposit_own_read on public.deposit_accounts for select to authenticated
  using (user_id = auth.uid() or public.has_permission('dispute.read'));

drop policy if exists deposit_waive on public.deposit_accounts;
create policy deposit_waive on public.deposit_accounts for update to authenticated
  using (public.has_permission('deposit.waive')) with check (public.has_permission('deposit.waive'));

drop policy if exists deposit_mov_read on public.deposit_movements;
create policy deposit_mov_read on public.deposit_movements for select to authenticated
  using (user_id = auth.uid() or public.has_permission('dispute.read'));

drop policy if exists chargebacks_staff on public.chargebacks;
create policy chargebacks_staff on public.chargebacks for select to authenticated
  using (public.has_permission('dispute.read'));

drop policy if exists invoices_own on public.invoices;
create policy invoices_own on public.invoices for select to authenticated
  using (user_id = auth.uid() or public.has_permission('finance.fees.read'));
