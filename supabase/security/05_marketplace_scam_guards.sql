-- ============================================================================
-- Zaštita od prevara u toku: ponuda → prihvatanje → uplata → rad → isplata
-- ----------------------------------------------------------------------------
-- Nalazi iz žive baze (26.09.2026.), svaki provjeren čitanjem izvora funkcija
-- i politika na produkciji:
--
-- 1. cancel_job_payment na produkciji NEMA brane iz booking/03_guards.sql §3.3.
--    Klijent ili izvođač sam vraća novac klijentu dok je posao "funded" —
--    izvođač odradi posao, klijent klikne otkaži i dobije novac nazad.
-- 2. Vlasnik oglasa može mijenjati IZNOS tuđe ponude (`bids_listing_owner_update`
--    pušta UPDATE svih kolona), pa ponudu od 500 KM spusti na 5 KM i prihvati je.
-- 3. Izvođač može promijeniti iznos ponude dok klijent gleda potvrdu, pa klijent
--    plati više nego što je vidio (accept_offer_and_fund ne zna koji je iznos
--    klijent odobrio).
-- 4. Ponuda na vlastiti oglas + prihvatanje = lažni "završeni poslovi" za
--    bedževe i rang.
-- 5. Recenziju može ostaviti bilo ko bilo kome (`reviews_manage_own` provjerava
--    samo reviewer_id), bez ijednog posla — lažne ocjene i napadi na konkurenciju.
-- ============================================================================

-- ------------------------------------------ 1. Nema jednostranog povrata novca
-- Isto pravilo kao booking/03 §3.3, na tijelu funkcije kakvo je danas na produkciji.
-- Sučelje već ide kroz request_cancellation/respond_cancellation (WorkFlow.jsx);
-- respond_cancellation prvo prebaci ugovor u 'cancelled', pa ova provjera prolazi.
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

  if not public.is_admin() then
    select exists (
      select 1 from public.cancellation_requests c
       where c.payment_id = v_row.id and c.state = 'accepted'
    ) into v_mutual;
    if v_row.work_state not in ('cancelled', 'cancel_requested') or not v_mutual then
      raise exception 'JEDNOSTRANO_OTKAZIVANJE_NIJE_MOGUCE: posao je u toku. '
        'Pošalji zahtjev za sporazumni prekid ili otvori spor.'
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
  if not found then
    raise exception 'VEC_NAMIRENO: uplata je vec obradjena' using errcode = 'P0001';
  end if;

  perform public.wallet_move(v_row.client_id, v_row.amount, 'escrow_refund',
    'Povrat osigurane uplate · ' || v_title, auth.uid());

  perform set_config('poso.system_write', '1', true);
  update public.listings set status = 'cancelled', cancelled_at = now(), cancel_reason = v_by where id = p_listing_id;
  perform set_config('poso.system_write', '', true);

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.client_id, 'job', 'Posao otkazan — novac vraćen', trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM za „' || v_title || '“ je vraćeno na tvoj balans.', '/listings/' || p_listing_id::text),
    (v_row.provider_id, 'job', 'Posao otkazan', '„' || v_title || '“ je otkazan' || case when v_by = 'client' then ' od strane klijenta.' when v_by = 'provider' then '.' else ' od strane tima.' end, '/listings/' || p_listing_id::text);
  return v_row;
end $fn$;

-- ------------------------------------------------- 2 + 4. Ponuda je izvođačeva
-- Vlasnik oglasa smije ponudu samo ODBITI. Iznos, poruka i kome ponuda pripada
-- ne mijenjaju se nakon slanja osim od strane samog izvođača (dok je 'pending').
-- 'accepted' nastaje isključivo kroz accept_offer_and_fund() (SECURITY DEFINER,
-- current_user nije 'authenticated'), nikad direktnim UPDATE-om.
create or replace function public.protect_bid_fields() returns trigger
language plpgsql set search_path = public as $fn$
declare v_owner uuid;
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  select user_id into v_owner from public.listings where id = new.listing_id;

  if tg_op = 'INSERT' then
    if new.bidder_id = v_owner then
      raise exception 'PONUDA_NA_SVOJ_OGLAS: ne možeš slati ponudu na vlastiti posao' using errcode = '42501';
    end if;
    new.status := 'pending';
    return new;
  end if;

  if new.listing_id is distinct from old.listing_id or new.bidder_id is distinct from old.bidder_id then
    raise exception 'PONUDA_ZAKLJUCANA' using errcode = '42501';
  end if;

  if auth.uid() is distinct from old.bidder_id then
    if new.amount is distinct from old.amount or new.message is distinct from old.message then
      raise exception 'PONUDA_ZAKLJUCANA: iznos i opis ponude mijenja samo izvođač' using errcode = '42501';
    end if;
    if new.status is distinct from old.status and not (old.status = 'pending' and new.status = 'rejected') then
      raise exception 'BID_STATUS_FORBIDDEN: ponuda se prihvata samo uz osiguranu uplatu' using errcode = '42501';
    end if;
  end if;
  return new;
end $fn$;

drop trigger if exists protect_bid_fields on public.bids;
create trigger protect_bid_fields before insert or update on public.bids
  for each row execute function public.protect_bid_fields();

revoke execute on function public.protect_bid_fields() from public, anon, authenticated;

-- ------------------------------------ 3 + 4. Klijent plaća tačno ono što je vidio
-- Novi argument p_expected_amount: iznos koji je klijent vidio na ekranu potvrde.
-- Ako se ponuda u međuvremenu promijenila, ništa se ne naplaćuje.
-- Stara verzija sa jednim argumentom se briše da ne ostane zaobilaznica.
drop function if exists public.accept_offer_and_fund(uuid);

create or replace function public.accept_offer_and_fund(p_bid_id uuid, p_expected_amount numeric default null)
returns public.job_payments
language plpgsql security definer set search_path to 'public' as $fn$
declare v_bid public.bids; v_listing public.listings; v_fee numeric; v_row public.job_payments; v_client_name text;
begin
  select * into v_bid from public.bids where id = p_bid_id for update;
  if v_bid is null then raise exception 'NO_BID'; end if;
  select * into v_listing from public.listings where id = v_bid.listing_id for update;
  if v_listing.user_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_bid.bidder_id = v_listing.user_id then raise exception 'PONUDA_NA_SVOJ_OGLAS' using errcode = '42501'; end if;
  if v_bid.status <> 'pending' then raise exception 'BID_NOT_PENDING'; end if;
  if v_listing.status <> 'published' then raise exception 'LISTING_NOT_OPEN'; end if;
  if exists (select 1 from public.job_payments where listing_id = v_listing.id) then raise exception 'ALREADY_FUNDED'; end if;
  if v_bid.amount is null or v_bid.amount <= 0 then raise exception 'BAD_AMOUNT'; end if;
  if p_expected_amount is not null and v_bid.amount <> p_expected_amount then
    raise exception 'PONUDA_PROMIJENJENA: izvođač je promijenio iznos na % KM', v_bid.amount using errcode = 'P0001';
  end if;

  perform public.wallet_move(v_listing.user_id, -v_bid.amount, 'escrow_hold', 'Osigurana uplata · ' || v_listing.title);

  v_fee := public.fee_percent_for(v_bid.bidder_id);
  insert into public.job_payments (listing_id, bid_id, client_id, provider_id, amount, fee_percent, fee_amount, net_amount)
  values (v_listing.id, v_bid.id, v_listing.user_id, v_bid.bidder_id, v_bid.amount, v_fee,
          round(v_bid.amount * v_fee / 100, 2), round(v_bid.amount - v_bid.amount * v_fee / 100, 2))
  returning * into v_row;

  update public.bids set status = 'accepted' where id = v_bid.id;
  update public.bids set status = 'rejected' where listing_id = v_listing.id and id <> v_bid.id and status = 'pending';
  update public.listings set status = 'assigned' where id = v_listing.id;

  select public.display_name_of(full_name) into v_client_name from public.profiles where user_id = v_listing.user_id;
  insert into public.notifications (user_id, type, title, message, link) values
    (v_bid.bidder_id, 'job', 'Ponuda prihvaćena — uplata osigurana 🎉', v_client_name || ' je prihvatio/la tvoju ponudu za „' || v_listing.title || '“. ' || trim(to_char(v_bid.amount, 'FM999G999D00')) || ' KM je osigurano na Poso.ba; po završetku dobijaš ' || trim(to_char(v_row.net_amount, 'FM999G999D00')) || ' KM.', '/listings/' || v_listing.id::text),
    (v_listing.user_id, 'job', 'Uplata osigurana', trim(to_char(v_bid.amount, 'FM999G999D00')) || ' KM za „' || v_listing.title || '“ se čuva na Poso.ba dok ne potvrdiš da je posao završen.', '/listings/' || v_listing.id::text);
  return v_row;
end $fn$;

revoke execute on function public.accept_offer_and_fund(uuid, numeric) from public, anon;
grant execute on function public.accept_offer_and_fund(uuid, numeric) to authenticated;

-- ---------------------------------------- 5. Recenzija samo za plaćen posao
-- Kao na velikim platformama: ocjenu ostavlja samo druga strana posla koji je
-- prošao kroz Poso.ba i isplaćen je (uključujući djelimičnu isplatu po odluci tima).
create or replace function public.can_review(p_listing uuid, p_reviewee uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.job_payments jp
     where jp.listing_id = p_listing and jp.status = 'released'
       and ((jp.client_id = auth.uid() and jp.provider_id = p_reviewee)
         or (jp.provider_id = auth.uid() and jp.client_id = p_reviewee))
  );
$fn$;

revoke execute on function public.can_review(uuid, uuid) from public, anon;
grant execute on function public.can_review(uuid, uuid) to authenticated;

drop policy if exists reviews_manage_own on public.reviews;

drop policy if exists reviews_insert_after_paid_job on public.reviews;
create policy reviews_insert_after_paid_job on public.reviews for insert to authenticated
  with check (auth.uid() = reviewer_id and not public.is_suspended()
              and public.can_review(listing_id, reviewee_id));

drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews for update to authenticated
  using (auth.uid() = reviewer_id and not public.is_suspended())
  with check (auth.uid() = reviewer_id and public.can_review(listing_id, reviewee_id));

drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews for delete to authenticated
  using (auth.uid() = reviewer_id);
