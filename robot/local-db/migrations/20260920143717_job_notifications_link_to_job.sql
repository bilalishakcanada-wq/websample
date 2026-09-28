-- Job/payment notifications now carry a link to the job, so a tap on the push opens the right screen.
CREATE OR REPLACE FUNCTION public.accept_offer_and_fund(p_bid_id uuid)
 RETURNS job_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_bid public.bids;
  v_listing public.listings;
  v_fee numeric;
  v_row public.job_payments;
  v_client_name text;
begin
  select * into v_bid from public.bids where id = p_bid_id;
  if v_bid is null then raise exception 'NO_BID'; end if;
  select * into v_listing from public.listings where id = v_bid.listing_id;
  if v_listing.user_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_bid.status <> 'pending' then raise exception 'BID_NOT_PENDING'; end if;
  if v_listing.status <> 'published' then raise exception 'LISTING_NOT_OPEN'; end if;
  if exists (select 1 from public.job_payments where listing_id = v_listing.id) then raise exception 'ALREADY_FUNDED'; end if;
  if v_bid.amount is null or v_bid.amount <= 0 then raise exception 'BAD_AMOUNT'; end if;

  perform public.wallet_move(v_listing.user_id, -v_bid.amount, 'escrow_hold', 'Osigurana uplata · ' || v_listing.title);

  v_fee := public.fee_percent_for(v_bid.bidder_id);
  insert into public.job_payments (listing_id, bid_id, client_id, provider_id, amount, fee_percent, fee_amount, net_amount)
  values (v_listing.id, v_bid.id, v_listing.user_id, v_bid.bidder_id, v_bid.amount, v_fee, round(v_bid.amount * v_fee / 100, 2), round(v_bid.amount - v_bid.amount * v_fee / 100, 2))
  returning * into v_row;

  update public.bids set status = 'accepted' where id = v_bid.id;
  update public.bids set status = 'rejected' where listing_id = v_listing.id and id <> v_bid.id and status = 'pending';
  update public.listings set status = 'assigned' where id = v_listing.id;

  select public.display_name_of(full_name) into v_client_name from public.profiles where user_id = v_listing.user_id;
  insert into public.notifications (user_id, type, title, message, link) values
    (v_bid.bidder_id, 'job', 'Ponuda prihvaćena — uplata osigurana 🎉', v_client_name || ' je prihvatio/la tvoju ponudu za „' || v_listing.title || '“. ' || trim(to_char(v_bid.amount, 'FM999G999D00')) || ' KM je osigurano na Poso.ba; po završetku dobijaš ' || trim(to_char(v_row.net_amount, 'FM999G999D00')) || ' KM.', '/listings/' || v_listing.id::text),
    (v_listing.user_id, 'job', 'Uplata osigurana', trim(to_char(v_bid.amount, 'FM999G999D00')) || ' KM za „' || v_listing.title || '“ se čuva na Poso.ba dok ne potvrdiš da je posao završen.', '/listings/' || v_listing.id::text);
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_job_payment(p_listing_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS job_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_row public.job_payments; v_title text; v_by text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or (auth.uid() not in (v_row.client_id, v_row.provider_id) and not public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'BAD_STATUS'; end if;
  select title into v_title from public.listings where id = p_listing_id;
  v_by := case when auth.uid() = v_row.provider_id then 'provider' when auth.uid() = v_row.client_id then 'client' else 'other' end;

  perform public.wallet_move(v_row.client_id, v_row.amount, 'escrow_refund', 'Povrat osigurane uplate · ' || v_title, auth.uid());
  update public.job_payments set status = 'refunded', refunded_at = now(), resolution = coalesce(nullif(btrim(p_reason), ''), 'Otkazano (' || v_by || ')') where id = v_row.id returning * into v_row;
  perform set_config('poso.system_write', '1', true);
  update public.listings set status = 'cancelled', cancelled_at = now(), cancel_reason = v_by where id = p_listing_id;
  perform set_config('poso.system_write', '', true);

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.client_id, 'job', 'Posao otkazan — novac vraćen', trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM za „' || v_title || '“ je vraćeno na tvoj balans.', '/listings/' || p_listing_id::text),
    (v_row.provider_id, 'job', 'Posao otkazan', '„' || v_title || '“ je otkazan' || case when v_by = 'client' then ' od strane klijenta.' when v_by = 'provider' then '.' else ' od strane tima.' end, '/listings/' || p_listing_id::text);
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.open_job_dispute(p_listing_id uuid, p_reason text)
 RETURNS job_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$
declare v_row public.job_payments; v_title text; v_name text; v_staff uuid; v_other uuid;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or auth.uid() not in (v_row.client_id, v_row.provider_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status not in ('funded', 'requested') then raise exception 'BAD_STATUS'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
  select title into v_title from public.listings where id = p_listing_id;
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = auth.uid();
  update public.job_payments set status = 'disputed', disputed_at = now(), dispute_reason = left(p_reason, 1000), dispute_by = auth.uid() where id = v_row.id returning * into v_row;
  v_other := case when auth.uid() = v_row.client_id then v_row.provider_id else v_row.client_id end;
  insert into public.notifications (user_id, type, title, message, link)
  values (v_other, 'job', 'Prijavljen problem sa poslom', v_name || ' je prijavio/la problem za „' || v_title || '“. Uplata je zamrznuta dok Poso.ba tim ne pregleda slučaj.', '/listings/' || p_listing_id::text);
  for v_staff in select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name in ('ADMIN', 'MODERATOR') loop
    insert into public.notifications (user_id, type, title, message, link)
    values (v_staff, 'support', 'Spor oko uplate — ' || v_title, v_name || ': ' || left(p_reason, 160), '/admin');
  end loop;
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_job_payment(p_listing_id uuid)
 RETURNS job_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_row public.job_payments; v_title text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or (v_row.client_id <> auth.uid() and not public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status not in ('funded', 'requested', 'disputed') then raise exception 'BAD_STATUS'; end if;
  select title into v_title from public.listings where id = p_listing_id;

  perform public.wallet_move(v_row.provider_id, v_row.net_amount, 'job_income', 'Isplata za posao · ' || v_title || ' (naknada ' || v_row.fee_percent || ' %)', auth.uid());
  update public.job_payments set status = 'released', released_at = now(), resolved_by = case when public.is_admin() and client_id <> auth.uid() then auth.uid() end
  where id = v_row.id returning * into v_row;
  perform set_config('poso.system_write', '1', true);
  update public.listings set status = 'completed', completed_at = now() where id = p_listing_id;
  perform set_config('poso.system_write', '', true);

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.provider_id, 'job', 'Uplata oslobođena 💸', trim(to_char(v_row.net_amount, 'FM999G999D00')) || ' KM je na tvom balansu za „' || v_title || '“ (' || trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM − ' || v_row.fee_percent || ' % naknade).', '/account/novcanik'),
    (v_row.client_id, 'job', 'Posao završen', 'Uplata za „' || v_title || '“ je isplaćena izvođaču. Hvala — ostavi recenziju!', '/listings/' || p_listing_id::text);
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_job_payment(p_listing_id uuid)
 RETURNS job_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare v_row public.job_payments; v_title text; v_name text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or v_row.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'BAD_STATUS'; end if;
  update public.job_payments set status = 'requested', requested_at = now() where id = v_row.id returning * into v_row;
  select title into v_title from public.listings where id = p_listing_id;
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = v_row.provider_id;
  insert into public.notifications (user_id, type, title, message, link)
  values (v_row.client_id, 'job', 'Izvođač traži isplatu', v_name || ' javlja da je „' || v_title || '“ završen. Provjeri posao i oslobodi uplatu od ' || trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM.', '/listings/' || p_listing_id::text);
  return v_row;
end;
$function$;;
