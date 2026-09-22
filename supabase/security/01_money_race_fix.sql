-- ============================================================================
-- SIGURNOSNA ZAKRPA 01 — dvostruka isplata iz escrowa (KRITIČNO)
-- ----------------------------------------------------------------------------
-- NALAZ (dokazano na kopiji funkcija, PostgreSQL, dvije paralelne sesije):
--
--   release_job_payment, cancel_job_payment, admin_resolve_job i
--   accept_offer_and_fund rade po obrascu:
--
--       select * into v_row from job_payments where listing_id = ...;   -- bez lock-a
--       if v_row.status <> 'funded' then raise ...                      -- provjera na
--       perform wallet_move(...);                                        -- zastarjelom
--       update job_payments set status = '...';                          -- snapshotu
--
--   Između SELECT-a i UPDATE-a druga transakcija vidi isti stari status. Pod
--   READ COMMITTED izolacijom obje prođu provjeru i obje isplate novac.
--
--   Izmjereno:
--     • dva puta "Oslobodi uplatu"      → 1.800 KM isplaćeno iz escrowa od 1.000
--     • "Oslobodi" + "Otkaži" paralelno → 1.900 KM (izvođač 900 + klijent 1.000)
--
--   Napadač ne treba saučesnika: klijent je ovlašten i za oslobađanje i za
--   otkazivanje, pa dva istovremena zahtjeva iz istog browsera prazne escrow.
--   (accept_offer_and_fund je slučajno zaštićen — UNIQUE(listing_id) obori drugi
--   INSERT — ali se oslanja na sreću, pa se i on zaključava.)
--
-- ZAKRPA, tri sloja:
--   1. SELECT ... FOR UPDATE — druga transakcija čeka umjesto da čita staro stanje.
--   2. Uslovni UPDATE (compare-and-swap) — status se mijenja samo ako je još
--      uvijek namirljiv; ako nije, funkcija puca prije nego dodirne novac.
--   3. Trigger koji brani izlazak iz konačnog stanja — da i buduća funkcija
--      napisana bez lock-a ne može platiti dva puta.
-- ============================================================================

-- --------------------------------------------- SLOJ 3: konačna stanja su konačna
create or replace function public.guard_payment_transition() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if old.status in ('released', 'refunded') and new.status is distinct from old.status then
    raise exception 'PLACANJE_JE_VEC_NAMIRENO: iz stanja % se ne izlazi', old.status
      using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists job_payments_transition_guard on public.job_payments;
create trigger job_payments_transition_guard before update on public.job_payments
  for each row execute function public.guard_payment_transition();

-- ------------------------------------------------------- 1) Oslobađanje uplate
create or replace function public.release_job_payment(p_listing_id uuid)
returns public.job_payments
language plpgsql security definer set search_path to 'public' as $fn$
declare v_row public.job_payments; v_title text;
begin
  -- SLOJ 1: zaključaj red plaćanja; paralelni zahtjev čeka ovdje
  select * into v_row from public.job_payments where listing_id = p_listing_id for update;
  if v_row is null or (v_row.client_id <> auth.uid() and not public.is_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_row.status not in ('funded', 'requested', 'disputed') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;
  select title into v_title from public.listings where id = p_listing_id;

  -- SLOJ 2: compare-and-swap PRIJE novca. Ko izgubi trku, ovdje stane.
  update public.job_payments
     set status = 'released', released_at = now(),
         resolved_by = case when public.is_admin() and client_id <> auth.uid() then auth.uid() end
   where id = v_row.id and status in ('funded', 'requested', 'disputed')
  returning * into v_row;
  if not found then
    raise exception 'VEC_NAMIRENO: uplata je već obrađena' using errcode = 'P0001';
  end if;

  -- tek sada novac; ako ovo pukne, cijela transakcija se poništi
  perform public.wallet_move(v_row.provider_id, v_row.net_amount, 'job_income',
    'Isplata za posao · ' || v_title || ' (naknada ' || v_row.fee_percent || ' %)', auth.uid());

  perform set_config('poso.system_write', '1', true);
  update public.listings set status = 'completed', completed_at = now() where id = p_listing_id;
  perform set_config('poso.system_write', '', true);

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.provider_id, 'job', 'Uplata oslobođena 💸', trim(to_char(v_row.net_amount, 'FM999G999D00')) || ' KM je na tvom balansu za „' || v_title || '“ (' || trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM − ' || v_row.fee_percent || ' % naknade).', '/account/novcanik'),
    (v_row.client_id, 'job', 'Posao završen', 'Uplata za „' || v_title || '“ je isplaćena izvođaču. Hvala — ostavi recenziju!', '/listings/' || p_listing_id::text);
  return v_row;
end $fn$;

-- ------------------------------------------------------------ 2) Otkazivanje
create or replace function public.cancel_job_payment(p_listing_id uuid, p_reason text default null)
returns public.job_payments
language plpgsql security definer set search_path to 'public' as $fn$
declare v_row public.job_payments; v_title text; v_by text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id for update;
  if v_row is null or (auth.uid() not in (v_row.client_id, v_row.provider_id) and not public.is_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_row.status <> 'funded' then raise exception 'BAD_STATUS' using errcode = 'P0001'; end if;
  select title into v_title from public.listings where id = p_listing_id;
  v_by := case when auth.uid() = v_row.provider_id then 'provider'
               when auth.uid() = v_row.client_id then 'client' else 'other' end;

  update public.job_payments
     set status = 'refunded', refunded_at = now(),
         resolution = coalesce(nullif(btrim(p_reason), ''), 'Otkazano (' || v_by || ')')
   where id = v_row.id and status = 'funded'
  returning * into v_row;
  if not found then
    raise exception 'VEC_NAMIRENO: uplata je već obrađena' using errcode = 'P0001';
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

-- ----------------------------------------------------- 3) Odluka tima o sporu
create or replace function public.admin_resolve_job(
  p_listing_id uuid, p_action text, p_provider_share numeric default null, p_note text default null
) returns public.job_payments
language plpgsql security definer set search_path to 'public' as $fn$
declare v_row public.job_payments; v_title text; v_to_provider numeric; v_to_client numeric; v_fee numeric;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  if p_action = 'release' then
    return public.release_job_payment(p_listing_id);   -- ta funkcija sama zaključava
  end if;

  select * into v_row from public.job_payments where listing_id = p_listing_id for update;
  if v_row is null or v_row.status in ('released', 'refunded') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;
  select title into v_title from public.listings where id = p_listing_id;

  if p_action = 'refund' then
    update public.job_payments
       set status = 'refunded', refunded_at = now(), resolved_by = auth.uid(),
           resolution = coalesce(p_note, 'Tim: povrat klijentu')
     where id = v_row.id and status not in ('released', 'refunded')
    returning * into v_row;
    if not found then raise exception 'VEC_NAMIRENO' using errcode = 'P0001'; end if;

    perform public.wallet_move(v_row.client_id, v_row.amount, 'escrow_refund',
      'Povrat po odluci tima · ' || v_title, auth.uid());
    perform set_config('poso.system_write', '1', true);
    update public.listings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'other' where id = p_listing_id;
    perform set_config('poso.system_write', '', true);

  elsif p_action = 'split' then
    if p_provider_share is null or p_provider_share < 0 or p_provider_share > v_row.amount then
      raise exception 'BAD_SHARE';
    end if;
    v_fee := round(p_provider_share * v_row.fee_percent / 100, 2);
    v_to_provider := round(p_provider_share - v_fee, 2);
    v_to_client := round(v_row.amount - p_provider_share, 2);

    update public.job_payments
       set status = 'released', released_at = now(), resolved_by = auth.uid(),
           fee_amount = v_fee, net_amount = v_to_provider,
           resolution = coalesce(p_note, 'Tim: podjela ' || p_provider_share || ' KM izvođaču')
     where id = v_row.id and status not in ('released', 'refunded')
    returning * into v_row;
    if not found then raise exception 'VEC_NAMIRENO' using errcode = 'P0001'; end if;

    if v_to_provider > 0 then
      perform public.wallet_move(v_row.provider_id, v_to_provider, 'job_income',
        'Djelimična isplata po odluci tima · ' || v_title, auth.uid());
    end if;
    if v_to_client > 0 then
      perform public.wallet_move(v_row.client_id, v_to_client, 'escrow_refund',
        'Djelimični povrat po odluci tima · ' || v_title, auth.uid());
    end if;
    perform set_config('poso.system_write', '1', true);
    update public.listings set status = 'completed', completed_at = now() where id = p_listing_id;
    perform set_config('poso.system_write', '', true);
  else
    raise exception 'BAD_ACTION';
  end if;

  insert into public.notifications (user_id, type, title, message) values
    (v_row.client_id, 'job', 'Tim je riješio spor', 'Odluka za „' || v_title || '“: ' || coalesce(v_row.resolution, p_action) || '. Detalji su na tvom balansu.'),
    (v_row.provider_id, 'job', 'Tim je riješio spor', 'Odluka za „' || v_title || '“: ' || coalesce(v_row.resolution, p_action) || '. Detalji su na tvom balansu.');
  perform public.log_staff_action('job_resolve', v_row.client_id,
    jsonb_build_object('listing_id', p_listing_id, 'action', p_action, 'provider_share', p_provider_share, 'note', p_note));
  return v_row;
end $fn$;

-- ------------------------------------------------ 4) Prihvatanje ponude (escrow)
-- UNIQUE(listing_id) je dosad slučajno spašavao; sada se oslanja na lock,
-- a ponuda se zaključava da se ista ne može prihvatiti dva puta.
create or replace function public.accept_offer_and_fund(p_bid_id uuid)
returns public.job_payments
language plpgsql security definer set search_path to 'public' as $fn$
declare v_bid public.bids; v_listing public.listings; v_fee numeric; v_row public.job_payments; v_client_name text;
begin
  select * into v_bid from public.bids where id = p_bid_id for update;
  if v_bid is null then raise exception 'NO_BID'; end if;
  select * into v_listing from public.listings where id = v_bid.listing_id for update;
  if v_listing.user_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_bid.status <> 'pending' then raise exception 'BID_NOT_PENDING'; end if;
  if v_listing.status <> 'published' then raise exception 'LISTING_NOT_OPEN'; end if;
  if exists (select 1 from public.job_payments where listing_id = v_listing.id) then raise exception 'ALREADY_FUNDED'; end if;
  if v_bid.amount is null or v_bid.amount <= 0 then raise exception 'BAD_AMOUNT'; end if;

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
