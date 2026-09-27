-- ============================================================================
-- Kao na Airtaskeru: povećanje cijene tokom posla i pravila otkazivanja
-- ----------------------------------------------------------------------------
-- POVEĆANJE CIJENE: izvođač traži dodatni iznos uz razlog ("ispostavilo se da
-- treba još jedna utičnica"). Klijent odobri i dodatni iznos se odmah osigura
-- s njegovog balansa, ili odbije. Bez odobrenja se ništa ne naplaćuje, a klijent
-- odgovara na tačno taj zahtjev (id), pa ga izvođač ne može podmetnuti drugim.
--
-- OTKAZIVANJE: ko traži prekid kaže ko je odgovoran (on sam ili druga strana),
-- a druga strana to prihvata ili odbija (tada ostaje spor). Odgovorna strana:
--   * plaća naknadu za otkazivanje: 10 % cijene, najviše 50 KM, osim ako je
--     prekid zatražen u prvom satu nakon prihvatanja ponude;
--   * ako je to izvođač, posao mu se računa kao neuspješan (stopa uspješnosti);
--   * upisuje se na oglasu (listings.cancel_reason = 'client' | 'provider').
-- Klijentova naknada se zadrži od povrata. Izvođačeva se skine s balansa, a ono
-- što nedostaje naplati se od prve sljedeće zarade.
-- ============================================================================

-- ---------------------------------------------------------------- 0. Vrste stavki
alter table public.wallet_transactions drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions add constraint wallet_transactions_kind_check check (kind = any (array[
  'admin_credit', 'admin_debit', 'bonus', 'refund', 'fee', 'payout', 'purchase', 'promo',
  'escrow_hold', 'escrow_refund', 'job_income',
  'card_topup', 'payout_hold', 'payout_return', 'cancel_fee'
]));

-- naknada za otkazivanje umanjuje i iznos koji se smije isplatiti
create or replace function public.withdrawable_km(p_user uuid default auth.uid()) returns numeric
language sql stable security definer set search_path = public as $fn$
  select greatest(0, least(
    coalesce((select balance from public.profiles where user_id = p_user), 0),
    coalesce((select sum(amount) from public.wallet_transactions
               where user_id = p_user and kind in ('job_income', 'payout_hold', 'payout_return', 'payout', 'cancel_fee')), 0)
  ));
$fn$;
revoke execute on function public.withdrawable_km(uuid) from public, anon, authenticated;

-- ======================================================= 1. POVEĆANJE CIJENE
create table if not exists public.price_increase_requests (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references public.job_payments(id) on delete cascade,
  requested_by  uuid not null references auth.users(id) on delete cascade,
  amount_km     numeric(12,2) not null check (amount_km between 1 and 2000),
  reason        text not null check (char_length(btrim(reason)) between 10 and 1000),
  state         text not null default 'pending' check (state in ('pending', 'accepted', 'declined', 'withdrawn')),
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists price_increase_one_pending_idx on public.price_increase_requests (payment_id) where state = 'pending';

alter table public.price_increase_requests enable row level security;
drop policy if exists price_increase_party on public.price_increase_requests;
create policy price_increase_party on public.price_increase_requests for select to authenticated
  using (exists (select 1 from public.job_payments jp where jp.id = payment_id
                  and (auth.uid() in (jp.client_id, jp.provider_id) or public.is_staff())));
revoke insert, update, delete on public.price_increase_requests from anon, authenticated;

create or replace function public.request_price_increase(p_listing uuid, p_amount numeric, p_reason text)
returns public.price_increase_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.price_increase_requests; v_title text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() is distinct from v_row.provider_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_row.status <> 'funded' or v_row.work_state not in ('in_progress', 'revision') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;
  p_amount := round(p_amount, 2);
  if p_amount is null or p_amount < 1 or p_amount > 2000 then
    raise exception 'POVECANJE_IZNOS: dodatni iznos mora biti između 1 i 2.000 KM' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.price_increase_requests where payment_id = v_row.id and state = 'pending') then
    raise exception 'POVECANJE_VEC_CEKA: već postoji zahtjev koji čeka odgovor' using errcode = 'P0001';
  end if;
  if (select count(*) from public.price_increase_requests where payment_id = v_row.id) >= 3 then
    raise exception 'POVECANJE_LIMIT: najviše 3 zahtjeva za povećanje po poslu' using errcode = 'P0001';
  end if;

  insert into public.price_increase_requests (payment_id, requested_by, amount_km, reason)
  values (v_row.id, auth.uid(), p_amount, btrim(p_reason))
  returning * into v_req;

  select title into v_title from public.listings where id = p_listing;
  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.client_id, 'job', 'Izvođač traži povećanje cijene',
     '+' || trim(to_char(p_amount, 'FM999G999D00')) || ' KM za „' || v_title || '“. Ništa se ne naplaćuje dok ne odobriš.',
     '/listings/' || p_listing::text);
  return v_req;
end $fn$;

create or replace function public.cancel_price_increase(p_request uuid)
returns public.price_increase_requests
language plpgsql security definer set search_path = public as $fn$
declare v_req public.price_increase_requests;
begin
  update public.price_increase_requests set state = 'withdrawn', responded_at = now()
   where id = p_request and requested_by = auth.uid() and state = 'pending'
  returning * into v_req;
  if v_req.id is null then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;
  return v_req;
end $fn$;

-- Klijent odgovara na TAČNO ovaj zahtjev. Prihvatanje odmah osigura dodatni iznos
-- s balansa klijenta (INSUFFICIENT ako nema dovoljno) i podigne cijenu posla.
create or replace function public.respond_price_increase(p_request uuid, p_accept boolean)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_req public.price_increase_requests; v_row public.job_payments; v_title text; v_amount numeric;
begin
  select * into v_req from public.price_increase_requests where id = p_request for update;
  if v_req.id is null then raise exception 'NEMA_ZAHTJEVA' using errcode = 'P0001'; end if;
  select * into v_row from public.job_payments where id = v_req.payment_id for update;
  if auth.uid() is distinct from v_row.client_id then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_req.state <> 'pending' then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;
  select title into v_title from public.listings where id = v_row.listing_id;

  if not p_accept then
    update public.price_increase_requests set state = 'declined', responded_at = now() where id = v_req.id;
    insert into public.notifications (user_id, type, title, message, link) values
      (v_row.provider_id, 'job', 'Povećanje cijene nije prihvaćeno',
       'Klijent nije odobrio dodatnih ' || trim(to_char(v_req.amount_km, 'FM999G999D00')) || ' KM za „' || v_title || '“. Posao ide po dogovorenoj cijeni.',
       '/listings/' || v_row.listing_id::text);
    return v_row;
  end if;

  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_row.status <> 'funded' or v_row.work_state not in ('in_progress', 'revision', 'submitted') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;

  perform public.wallet_move(v_row.client_id, -v_req.amount_km, 'escrow_hold',
    'Povećanje cijene · ' || v_title);

  v_amount := v_row.amount + v_req.amount_km;
  update public.job_payments
     set amount = v_amount,
         fee_amount = round(v_amount * fee_percent / 100, 2),
         net_amount = round(v_amount - v_amount * fee_percent / 100, 2)
   where id = v_row.id
  returning * into v_row;
  update public.price_increase_requests set state = 'accepted', responded_at = now() where id = v_req.id;

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.provider_id, 'job', 'Povećanje cijene odobreno 🎉',
     'Klijent je odobrio +' || trim(to_char(v_req.amount_km, 'FM999G999D00')) || ' KM. Nova cijena je ' || trim(to_char(v_amount, 'FM999G999D00')) || ' KM i osigurana je na Poso.ba.',
     '/listings/' || v_row.listing_id::text);
  return v_row;
end $fn$;

revoke execute on function public.request_price_increase(uuid, numeric, text) from public, anon;
revoke execute on function public.cancel_price_increase(uuid) from public, anon;
revoke execute on function public.respond_price_increase(uuid, boolean) from public, anon;
grant execute on function public.request_price_increase(uuid, numeric, text),
  public.cancel_price_increase(uuid), public.respond_price_increase(uuid, boolean) to authenticated;

-- ===================================================== 2. PRAVILA OTKAZIVANJA
alter table public.cancellation_requests add column if not exists responsible text
  check (responsible in ('client', 'provider'));
alter table public.cancellation_requests add column if not exists fee_km numeric(12,2) not null default 0;

create table if not exists public.cancellation_fees (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  payment_id  uuid references public.job_payments(id) on delete set null,
  amount_km   numeric(12,2) not null check (amount_km > 0),
  collected_km numeric(12,2) not null default 0,
  status      text not null default 'owed' check (status in ('owed', 'paid', 'waived')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists cancellation_fees_owed_idx on public.cancellation_fees (user_id) where status = 'owed';

alter table public.cancellation_fees enable row level security;
drop policy if exists cancellation_fees_own on public.cancellation_fees;
create policy cancellation_fees_own on public.cancellation_fees for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.cancellation_fees from anon, authenticated;

-- 10 % cijene, najviše 50 KM; bez naknade ako je prekid zatražen u prvom satu.
create or replace function public.cancellation_fee_for(p_payment public.job_payments)
returns numeric language sql stable set search_path = public as $fn$
  select case when p_payment.funded_at is not null and now() < p_payment.funded_at + interval '1 hour' then 0
              else least(50, round(p_payment.amount * 0.10, 2)) end;
$fn$;
revoke execute on function public.cancellation_fee_for(public.job_payments) from public, anon, authenticated;

-- Naplati dugovane naknade koliko balans dozvoljava (najstarije prve).
create or replace function public.collect_cancellation_fees(p_user uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare f public.cancellation_fees; v_balance numeric; v_take numeric;
begin
  for f in select * from public.cancellation_fees where user_id = p_user and status = 'owed' order by created_at for update loop
    select balance into v_balance from public.profiles where user_id = p_user;
    v_take := least(coalesce(v_balance, 0), f.amount_km - f.collected_km);
    exit when v_take <= 0;
    perform public.wallet_move(p_user, -v_take, 'cancel_fee', 'Naknada za otkazan posao', p_user);
    update public.cancellation_fees
       set collected_km = collected_km + v_take,
           status = case when collected_km + v_take >= amount_km then 'paid' else 'owed' end,
           paid_at = case when collected_km + v_take >= amount_km then now() end
     where id = f.id;
  end loop;
end $fn$;
revoke execute on function public.collect_cancellation_fees(uuid) from public, anon, authenticated;

-- Svaka nova zarada prvo pokrije dugovanu naknadu.
create or replace function public.collect_fees_on_income() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.kind = 'job_income' and exists (select 1 from public.cancellation_fees where user_id = new.user_id and status = 'owed') then
    perform public.collect_cancellation_fees(new.user_id);
  end if;
  return null;
end $fn$;
revoke execute on function public.collect_fees_on_income() from public, anon, authenticated;

drop trigger if exists wallet_collect_cancellation_fees on public.wallet_transactions;
create trigger wallet_collect_cancellation_fees after insert on public.wallet_transactions
  for each row when (new.kind = 'job_income') execute function public.collect_fees_on_income();

-- request_cancellation sa odgovornom stranom. p_responsible: 'me' (ja prekidam)
-- ili 'other' (druga strana nije ispoštovala dogovor). Stari poziv sa tri
-- argumenta i dalje radi i znači 'me'.
drop function if exists public.request_cancellation(uuid, text, text);
create or replace function public.request_cancellation(p_listing uuid, p_reason_code text, p_detail text default null, p_responsible text default 'me')
returns public.cancellation_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.cancellation_requests; v_me text; v_resp text; v_fee numeric;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_row.client_id, v_row.provider_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(p_responsible, 'me') not in ('me', 'other') then raise exception 'BAD_RESPONSIBLE' using errcode = 'P0001'; end if;

  v_me := case when auth.uid() = v_row.client_id then 'client' else 'provider' end;
  v_resp := case when coalesce(p_responsible, 'me') = 'me' then v_me
                 when v_me = 'client' then 'provider' else 'client' end;
  v_fee := public.cancellation_fee_for(v_row);

  insert into public.cancellation_requests (payment_id, requested_by, reason_code, detail, prev_state, restore_deadline, responsible, fee_km)
  values (v_row.id, auth.uid(), p_reason_code, p_detail, v_row.work_state, v_row.review_deadline, v_resp, v_fee)
  returning * into v_req;

  perform public.job_transition(v_row.id, 'cancel_requested',
    jsonb_build_object('razlog', p_reason_code, 'iz_stanja', v_row.work_state, 'odgovoran', v_resp));

  insert into public.notifications (user_id, type, title, message, link) values
    (case when auth.uid() = v_row.client_id then v_row.provider_id else v_row.client_id end,
     'job', 'Zatražen je prekid posla',
     case when v_resp = v_me then 'Druga strana traži sporazumni prekid i preuzima odgovornost.'
          else 'Druga strana traži prekid i navodi da si ti odgovoran/na. Ako se ne slažeš, odbij ili otvori spor.' end
     || ' Dok ne odgovoriš, novac ostaje osiguran na Poso.ba.',
     '/listings/' || p_listing::text);
  return v_req;
end $fn$;

revoke execute on function public.request_cancellation(uuid, text, text, text) from public, anon;
grant execute on function public.request_cancellation(uuid, text, text, text) to authenticated;

-- Kad druga strana prihvati: povrat klijentu (cancel_job_payment), zatim naknada
-- odgovorne strane i upis ko je odgovoran (to broji stopu uspješnosti izvođača).
create or replace function public.respond_cancellation(p_listing uuid, p_accept boolean, p_note text default null)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.cancellation_requests; v_resp text; v_title text; v_fee_id uuid;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_row.client_id, v_row.provider_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select * into v_req from public.cancellation_requests where payment_id = v_row.id and state = 'pending' for update;
  if v_req.id is null then raise exception 'NEMA_ZAHTJEVA' using errcode = 'P0001'; end if;
  if v_req.requested_by = auth.uid() then raise exception 'NA_SVOJ_ZAHTJEV_SE_NE_ODGOVARA' using errcode = '42501'; end if;

  update public.cancellation_requests
     set state = case when p_accept then 'accepted' else 'declined' end,
         responded_by = auth.uid(), responded_at = now()
   where id = v_req.id;

  if not p_accept then
    select * into v_row from public.job_transition(v_row.id, coalesce(v_req.prev_state, 'in_progress'),
      jsonb_build_object('odbijeno', true, 'napomena', p_note));
    update public.job_payments set review_deadline = v_req.restore_deadline
     where id = v_row.id returning * into v_row;
    insert into public.notifications (user_id, type, title, message, link) values
      (v_req.requested_by, 'job', 'Prekid nije prihvaćen',
       'Druga strana nije pristala na prekid. Ako se ne možete dogovoriti, otvori spor.',
       '/listings/' || p_listing::text);
    return v_row;
  end if;

  perform public.job_transition(v_row.id, 'cancelled', jsonb_build_object('napomena', p_note));
  v_row := public.cancel_job_payment(p_listing, 'Sporazumni prekid');

  -- stari zahtjevi (prije ovih pravila) nemaju odgovornu stranu: ko je tražio
  v_resp := coalesce(v_req.responsible,
                     case when v_req.requested_by = v_row.client_id then 'client' else 'provider' end);
  update public.price_increase_requests set state = 'withdrawn', responded_at = now()
   where payment_id = v_row.id and state = 'pending';

  perform set_config('poso.system_write', '1', true);
  update public.listings set cancel_reason = v_resp where id = p_listing;
  perform set_config('poso.system_write', '', true);
  perform public.refresh_user_badges(v_row.provider_id);
  perform public.refresh_user_badges(v_row.client_id);

  if v_req.fee_km > 0 then
    select title into v_title from public.listings where id = p_listing;
    insert into public.cancellation_fees (user_id, payment_id, amount_km)
    values (case when v_resp = 'client' then v_row.client_id else v_row.provider_id end, v_row.id, v_req.fee_km)
    returning id into v_fee_id;
    perform public.collect_cancellation_fees(case when v_resp = 'client' then v_row.client_id else v_row.provider_id end);
    insert into public.notifications (user_id, type, title, message, link) values
      (case when v_resp = 'client' then v_row.client_id else v_row.provider_id end, 'wallet',
       'Naknada za otkazivanje',
       trim(to_char(v_req.fee_km, 'FM999G999D00')) || ' KM za otkazan posao „' || v_title || '“'
       || case when v_resp = 'provider' then '. Ako nemaš dovoljno na balansu, ostatak se naplati od sljedeće zarade.' else '.' end,
       '/account/novcanik');
  end if;
  return v_row;
end $fn$;

revoke execute on function public.respond_cancellation(uuid, boolean, text) from public, anon;
grant execute on function public.respond_cancellation(uuid, boolean, text) to authenticated;
