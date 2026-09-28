-- ============================================================================
-- Uplata karticom (Monri) i isplata na bankovni račun
-- ----------------------------------------------------------------------------
-- UPLATA: korisnik upiše iznos → Edge funkcija `card-topup-start` otvori red u
-- card_payments i vrati formu za Monri → korisnik plati na Monri stranici →
-- Monri pozove `card-topup-callback` (potpisano ključem trgovca) → funkcija
-- card_payment_complete() jednom i samo jednom upiše novac na balans.
-- Povratak korisnika na sajt NIKAD ne upisuje novac — samo potpisan callback.
--
-- ISPLATA: Monri u BiH ne šalje novac na tuđe račune, pa isplata ide bankovnim
-- nalogom firme. Korisnik zatraži isplatu → iznos se odmah skine s balansa i
-- drži (payout_hold) → tim uplati nalogom i označi "isplaćeno" sa referencom,
-- ili odbije i novac se vrati na balans.
--
-- Pravila protiv prevara:
--   * isplatiti se može samo ZARAĐENO (job_income), ne novac uplaćen karticom —
--     inače bi ukradena kartica postala gotovina na tuđem računu;
--   * ime vlasnika računa mora odgovarati imenu na profilu, a identitet mora
--     biti potvrđen;
--   * najviše jedan otvoren zahtjev za isplatu po korisniku.
-- ============================================================================

-- -------------------------------------------------------------- 1. Vrste stavki
alter table public.wallet_transactions drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions add constraint wallet_transactions_kind_check check (kind = any (array[
  'admin_credit', 'admin_debit', 'bonus', 'refund', 'fee', 'payout', 'purchase', 'promo',
  'escrow_hold', 'escrow_refund', 'job_income',
  'card_topup', 'payout_hold', 'payout_return'
]));

-- ------------------------------------------------------------ 2. Uplate karticom
create table if not exists public.card_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  order_number  text not null unique,
  amount_km     numeric(12,2) not null check (amount_km between 5 and 2000),
  status        text not null default 'created'
                check (status in ('created', 'approved', 'declined', 'cancelled', 'expired')),
  provider      text not null default 'monri',
  test_mode     boolean not null default true,
  provider_ref  text,
  response      jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists card_payments_user_idx on public.card_payments (user_id, created_at desc);

alter table public.card_payments enable row level security;
drop policy if exists card_payments_own on public.card_payments;
create policy card_payments_own on public.card_payments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- bez INSERT/UPDATE politike: redove pišu samo Edge funkcije (service role)
revoke insert, update, delete on public.card_payments from anon, authenticated;

-- Jedina tačka gdje uplata karticom postaje novac na balansu. Poziva je samo
-- `card-topup-callback` nakon provjere Monri potpisa. Idempotentna: Monri
-- ponavlja callback dok ne dobije 200, pa drugi poziv ne smije upisati ponovo.
create or replace function public.card_payment_complete(
  p_order text, p_approved boolean, p_amount_minor bigint, p_ref text, p_response jsonb
) returns text
language plpgsql security definer set search_path = public as $fn$
declare v_row public.card_payments;
begin
  select * into v_row from public.card_payments where order_number = p_order for update;
  if v_row.id is null then raise exception 'NEPOZNATA_NARUDZBA'; end if;
  if v_row.status <> 'created' then return v_row.status; end if;   -- već obrađeno

  if p_approved and p_amount_minor <> round(v_row.amount_km * 100) then
    -- iznos koji je Monri naplatio mora biti tačno onaj koji smo tražili
    update public.card_payments set status = 'declined', completed_at = now(),
           provider_ref = p_ref, response = p_response || jsonb_build_object('poso_error', 'amount_mismatch')
     where id = v_row.id;
    return 'declined';
  end if;

  update public.card_payments
     set status = case when p_approved then 'approved' else 'declined' end,
         completed_at = now(), provider_ref = p_ref, response = p_response
   where id = v_row.id;

  if p_approved then
    perform public.wallet_move(v_row.user_id, v_row.amount_km, 'card_topup',
      'Uplata karticom · ' || v_row.order_number || case when v_row.test_mode then ' (TEST)' else '' end, v_row.user_id);
    insert into public.notifications (user_id, type, title, message, link)
    values (v_row.user_id, 'wallet', 'Uplata je stigla',
            trim(to_char(v_row.amount_km, 'FM999G999D00')) || ' KM je dodano na tvoj balans.', '/account/novcanik');
  end if;
  return case when p_approved then 'approved' else 'declined' end;
end $fn$;

revoke execute on function public.card_payment_complete(text, boolean, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.card_payment_complete(text, boolean, bigint, text, jsonb) to service_role;

-- ------------------------------------------------------- 3. Zahtjevi za isplatu
create table if not exists public.payout_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount_km    numeric(12,2) not null check (amount_km >= 20),
  holder_name  text not null,
  bank_name    text,
  iban         text not null,
  status       text not null default 'requested' check (status in ('requested', 'paid', 'rejected', 'cancelled')),
  bank_ref     text,
  note         text,
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists payout_requests_one_open_idx on public.payout_requests (user_id) where status = 'requested';
create index if not exists payout_requests_queue_idx on public.payout_requests (status, created_at);

alter table public.payout_requests enable row level security;
drop policy if exists payout_requests_own on public.payout_requests;
create policy payout_requests_own on public.payout_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.payout_requests from anon, authenticated;

-- Koliko korisnik smije isplatiti: zarada od poslova minus ono što je već
-- isplaćeno ili je na čekanju, i nikad više od stanja.
create or replace function public.withdrawable_km(p_user uuid default auth.uid()) returns numeric
language sql stable security definer set search_path = public as $fn$
  select greatest(0, least(
    coalesce((select balance from public.profiles where user_id = p_user), 0),
    coalesce((select sum(amount) from public.wallet_transactions
               where user_id = p_user and kind in ('job_income', 'payout_hold', 'payout_return', 'payout')), 0)
  ));
$fn$;

create or replace function public.request_payout(p_amount numeric) returns public.payout_requests
language plpgsql security definer set search_path = public as $fn$
declare v_acc public.payout_accounts; v_name text; v_row public.payout_requests; v_staff uuid;
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if not public.identity_verified(auth.uid()) then
    raise exception 'VERIFIKACIJA_POTREBNA: potvrdi identitet prije isplate' using errcode = '42501', hint = 'identity_required';
  end if;
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount < 20 then raise exception 'ISPLATA_MIN: najmanja isplata je 20 KM'; end if;
  if p_amount > public.withdrawable_km(auth.uid()) then
    raise exception 'ISPLATA_PREKO_ZARADE: isplatiti se može samo zarada od poslova';
  end if;

  select * into v_acc from public.payout_accounts where user_id = auth.uid();
  if v_acc.user_id is null then raise exception 'NEMA_RACUNA_ZA_ISPLATU'; end if;
  select full_name into v_name from public.profiles where user_id = auth.uid();
  if public.normalize_person_name(v_acc.holder_name) <> public.normalize_person_name(v_name) then
    raise exception 'IME_RACUNA_SE_NE_POKLAPA: račun mora glasiti na tvoje ime';
  end if;
  if exists (select 1 from public.payout_requests where user_id = auth.uid() and status = 'requested') then
    raise exception 'ISPLATA_VEC_CEKA: već imaš zahtjev za isplatu na čekanju';
  end if;

  perform public.wallet_move(auth.uid(), -p_amount, 'payout_hold', 'Isplata na račun ' || right(v_acc.iban, 4) || ' — čeka obradu');
  insert into public.payout_requests (user_id, amount_km, holder_name, bank_name, iban)
  values (auth.uid(), p_amount, v_acc.holder_name, v_acc.bank_name, v_acc.iban)
  returning * into v_row;

  for v_staff in select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name = 'ADMIN' loop
    insert into public.notifications (user_id, type, title, message, link)
    values (v_staff, 'support', 'Novi zahtjev za isplatu', trim(to_char(p_amount, 'FM999G999D00')) || ' KM · ' || v_acc.holder_name, '/admin');
  end loop;
  return v_row;
end $fn$;

create or replace function public.cancel_payout(p_id uuid) returns public.payout_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.payout_requests;
begin
  update public.payout_requests set status = 'cancelled', reviewed_at = now()
   where id = p_id and user_id = auth.uid() and status = 'requested'
  returning * into v_row;
  if v_row.id is null then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;
  perform public.wallet_move(v_row.user_id, v_row.amount_km, 'payout_return', 'Otkazana isplata');
  return v_row;
end $fn$;

-- Tim: isplaćeno (uz referencu bankovnog naloga) ili odbijeno (novac nazad).
create or replace function public.staff_resolve_payout(p_id uuid, p_paid boolean, p_bank_ref text default null, p_note text default null)
returns public.payout_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.payout_requests;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_paid and coalesce(btrim(p_bank_ref), '') = '' then raise exception 'REFERENCA_JE_OBAVEZNA'; end if;
  if not p_paid and coalesce(btrim(p_note), '') = '' then raise exception 'RAZLOG_JE_OBAVEZAN'; end if;

  update public.payout_requests
     set status = case when p_paid then 'paid' else 'rejected' end,
         bank_ref = p_bank_ref, note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id and status = 'requested'
  returning * into v_row;
  if v_row.id is null then raise exception 'VEC_NAMIRENO' using errcode = 'P0001'; end if;

  if not p_paid then
    perform public.wallet_move(v_row.user_id, v_row.amount_km, 'payout_return', 'Isplata odbijena: ' || p_note, auth.uid());
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_row.user_id, 'wallet',
          case when p_paid then 'Isplata je poslana' else 'Isplata nije prošla' end,
          case when p_paid then trim(to_char(v_row.amount_km, 'FM999G999D00')) || ' KM je poslano na račun ' || right(v_row.iban, 4) || '. Stiže obično za 1–2 radna dana.'
               else 'Iznos je vraćen na tvoj balans. Razlog: ' || p_note end,
          '/account/novcanik');
  perform public.log_staff_action(case when p_paid then 'payout_paid' else 'payout_rejected' end, v_row.user_id,
    jsonb_build_object('payout_id', v_row.id, 'amount', v_row.amount_km, 'bank_ref', p_bank_ref, 'note', p_note));
  return v_row;
end $fn$;

create or replace function public.admin_payout_queue() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select case when not public.is_admin() then null else coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'user_id', q.user_id, 'full_name', p.full_name, 'member_id', p.member_id,
    'amount_km', q.amount_km, 'holder_name', q.holder_name, 'bank_name', q.bank_name, 'iban', q.iban,
    'status', q.status, 'bank_ref', q.bank_ref, 'note', q.note, 'created_at', q.created_at, 'reviewed_at', q.reviewed_at
  ) order by (q.status = 'requested') desc, q.created_at desc), '[]'::jsonb) end
  from (select * from public.payout_requests order by created_at desc limit 100) q
  left join public.profiles p on p.user_id = q.user_id;
$fn$;

-- Stanje za ekran Balans: koliko se smije isplatiti i otvoren zahtjev, ako postoji.
create or replace function public.my_payout_state() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select jsonb_build_object(
    'withdrawable', public.withdrawable_km(auth.uid()),
    'has_account', exists (select 1 from public.payout_accounts where user_id = auth.uid()),
    'verified', public.identity_verified(auth.uid()),
    'open', (select to_jsonb(q) - 'holder_name' from public.payout_requests q
              where q.user_id = auth.uid() and q.status = 'requested' limit 1)
  );
$fn$;

revoke execute on function public.withdrawable_km(uuid) from public, anon, authenticated;
revoke execute on function public.request_payout(numeric) from public, anon;
revoke execute on function public.cancel_payout(uuid) from public, anon;
revoke execute on function public.staff_resolve_payout(uuid, boolean, text, text) from public, anon;
revoke execute on function public.admin_payout_queue() from public, anon;
revoke execute on function public.my_payout_state() from public, anon;
grant execute on function public.request_payout(numeric), public.cancel_payout(uuid),
  public.staff_resolve_payout(uuid, boolean, text, text), public.admin_payout_queue(), public.my_payout_state()
  to authenticated;
