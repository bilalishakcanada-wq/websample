-- ============================================================================
-- BOOKING ENGINE 03 — brane (nepromjenjiv chat, zaključan status, zabrana povrata)
-- ----------------------------------------------------------------------------
-- Ovdje su tri rupe nađene u auditu. Sve tri se zatvaraju u bazi, jer frontend
-- zove PostgREST direktno — provjera u React kodu ne štiti ništa.
-- ============================================================================

-- ======================================================= 3.1 Nepromjenjiv chat
-- NALAZ: politika `messages_manage_own` je bila FOR ALL sa `auth.uid() = sender_id`,
-- što znači da je pošiljalac mogao OBRISATI i IZMIJENITI svoju poruku.
-- Podrška presuđuje na osnovu prepiske — a prepiska se mogla prekrojiti poslije
-- svađe. To ruši cijeli sistem sporova.
drop policy if exists messages_manage_own on public.messages;

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (auth.uid() = sender_id);
-- namjerno NEMA UPDATE ni DELETE politike za korisnika

-- Druga brana: i admin i service_role idu kroz trigger. Poruka se ne mijenja,
-- tačka. Moderacija sadržaja se rješava skrivanjem (hidden_at), ne brisanjem.
alter table public.messages
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id),
  add column if not exists hidden_reason text;

create or replace function public.guard_message_immutable() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'PORUKE_SE_NE_BRISU: prepiska je dokaz u sporu' using errcode = 'P0001';
  end if;
  -- dozvoljeno je samo označiti poruku skrivenom i označiti je pročitanom
  if new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.created_at is distinct from old.created_at then
    raise exception 'PORUKE_SE_NE_MIJENJAJU: prepiska je dokaz u sporu' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists messages_immutable on public.messages;
create trigger messages_immutable before update or delete on public.messages
  for each row execute function public.guard_message_immutable();

-- ================================================== 3.2 Status posla je sistemski
-- NALAZ: `listings_update_own` dozvoljava vlasniku UPDATE bilo koje kolone,
-- uključujući `status`. Vlasnik je mogao poslati posao nazad u 'published' dok
-- novac stoji u escrowu, ili ga proglasiti 'completed' bez isplate.
create or replace function public.protect_listing_system_fields() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if coalesce(current_setting('poso.system_write', true), '') <> '1'
     and auth.role() is distinct from 'service_role'
     and not public.is_admin() then
    new.status := old.status;
    new.completed_at := old.completed_at;
    new.cancelled_at := old.cancelled_at;
    new.created_at := old.created_at;
    new.bid_count := old.bid_count;
  end if;
  return new;
end $fn$;

drop trigger if exists listings_protect_system on public.listings;
create trigger listings_protect_system before update on public.listings
  for each row execute function public.protect_listing_system_fields();

-- Sadržaj posla se ne mijenja nakon što je novac osiguran — inače bi klijent
-- mogao prepisati zadatak nakon dogovora ("pomjeranje golova").
create or replace function public.guard_listing_locked_after_funding() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if exists (select 1 from public.job_payments p
              where p.listing_id = new.id and p.status in ('funded', 'requested', 'disputed'))
     and (new.title is distinct from old.title
          or new.description is distinct from old.description
          or new.price is distinct from old.price)
     and not public.is_admin() then
    raise exception 'POSAO_JE_ZAKLJUCAN: opis i cijena se ne mijenjaju dok je uplata osigurana'
      using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists listings_locked_after_funding on public.listings;
create trigger listings_locked_after_funding before update on public.listings
  for each row execute function public.guard_listing_locked_after_funding();

-- ========================================== 3.3 Zabrana jednostranog povrata
-- Ovo je ono što ste tražili kao "middleware koji blokira klijenta da dođe do
-- rute za povrat dok je posao IN_PROGRESS". U ovoj arhitekturi to NE smije biti
-- Express middleware (frontend zove Supabase direktno i zaobišao bi ga), nego
-- brana u samoj funkciji za povrat.
create or replace function public.cancel_job_payment(p_listing_id uuid, p_reason text default null)
returns public.job_payments
language plpgsql security definer set search_path to 'public' as $fn$
declare v_row public.job_payments; v_title text; v_by text; v_mutual boolean;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id for update;
  if v_row is null or (auth.uid() not in (v_row.client_id, v_row.provider_id) and not public.is_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_row.status <> 'funded' then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;

  -- BRANA: rad je počeo → povrat traži pristanak druge strane ili odluku tima
  if not public.is_admin() then
    select exists (
      select 1 from public.cancellation_requests c
       where c.payment_id = v_row.id and c.state = 'accepted'
    ) into v_mutual;

    if v_row.work_state not in ('cancelled', 'cancel_requested') or not v_mutual then
      raise exception 'JEDNOSTRANO_OTKAZIVANJE_NIJE_MOGUCE: posao je u toku. '
        'Pošalji zahtjev za sporazumni prekid (request_cancellation) ili otvori spor.'
        using errcode = '42501', hint = 'mutual_cancellation_required';
    end if;
  end if;

  select title into v_title from public.listings where id = p_listing_id;
  v_by := case when auth.uid() = v_row.provider_id then 'provider'
               when auth.uid() = v_row.client_id then 'client' else 'other' end;

  update public.job_payments
     set status = 'refunded', refunded_at = now(),
         resolution = coalesce(nullif(btrim(p_reason), ''), 'Otkazano (' || v_by || ')')
   where id = v_row.id and status = 'funded'
  returning * into v_row;
  if not found then raise exception 'VEC_NAMIRENO' using errcode = 'P0001'; end if;

  perform public.wallet_move(v_row.client_id, v_row.amount, 'escrow_refund',
    'Povrat osigurane uplate · ' || v_title, auth.uid());

  perform set_config('poso.system_write', '1', true);
  update public.listings set status = 'cancelled', cancelled_at = now(), cancel_reason = v_by where id = p_listing_id;
  perform set_config('poso.system_write', '', true);

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.client_id, 'job', 'Posao otkazan — novac vraćen', trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM za „' || v_title || '“ je vraćeno na tvoj balans.', '/listings/' || p_listing_id::text),
    (v_row.provider_id, 'job', 'Posao otkazan', '„' || v_title || '“ je otkazan.', '/listings/' || p_listing_id::text);
  return v_row;
end $fn$;

-- ---------------------------------------- 3.4 Posljedica napuštanja posla
-- Izvođač koji pristane na prekid nakon što je rad počeo dobija strajk
-- (šifarnik i sistem strajkova su u supabase/enterprise/05_trust_safety.sql).
create or replace function public.on_cancellation_accepted() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_pay public.job_payments; v_had_work boolean;
begin
  if new.state <> 'accepted' or old.state = 'accepted' then return new; end if;
  select * into v_pay from public.job_payments where id = new.payment_id;

  select exists (select 1 from public.work_submissions where payment_id = new.payment_id) into v_had_work;

  -- ko je tražio prekid nakon predanog rada, snosi posljedicu
  if v_had_work and to_regclass('public.contract_terminations') is not null then
    insert into public.contract_terminations (listing_id, reporter_id, accused_id, reason_code, detail)
    select v_pay.listing_id,
           case when new.requested_by = v_pay.client_id then v_pay.provider_id else v_pay.client_id end,
           new.requested_by, 'abandoned',
           'Sporazumni prekid nakon predanog rada (automatski prijavljeno)'
    where exists (select 1 from public.termination_reasons where code = 'abandoned');
  end if;
  return new;
end $fn$;

drop trigger if exists cancellation_accepted_strike on public.cancellation_requests;
create trigger cancellation_accepted_strike after update on public.cancellation_requests
  for each row execute function public.on_cancellation_accepted();
