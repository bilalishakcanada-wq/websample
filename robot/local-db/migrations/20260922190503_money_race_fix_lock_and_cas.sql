-- Sprječava dvostruku isplatu iz escrowa (dokazano: 1000 KM escrow -> 1800/1900 KM isplaceno).
-- Tri sloja: FOR UPDATE, uslovni UPDATE (compare-and-swap) prije dodira novca,
-- i trigger koji brani izlazak iz konacnog stanja.

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

create or replace function public.release_job_payment(p_listing_id uuid)
returns public.job_payments
language plpgsql security definer set search_path to 'public' as $fn$
declare v_row public.job_payments; v_title text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id for update;
  if v_row is null or (v_row.client_id <> auth.uid() and not public.is_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_row.status not in ('funded', 'requested', 'disputed') then
    raise exception 'BAD_STATUS' using errcode = 'P0001';
  end if;
  select title into v_title from public.listings where id = p_listing_id;

  update public.job_payments
     set status = 'released', released_at = now(),
         resolved_by = case when public.is_admin() and client_id <> auth.uid() then auth.uid() end
   where id = v_row.id and status in ('funded', 'requested', 'disputed')
  returning * into v_row;
  if not found then
    raise exception 'VEC_NAMIRENO: uplata je vec obradjena' using errcode = 'P0001';
  end if;

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
end $fn$;;
