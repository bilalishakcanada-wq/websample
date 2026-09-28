create or replace function public.job_transition(
  p_payment uuid, p_to work_state, p_detail jsonb default '{}'
) returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_role text; v_allowed boolean; v_from work_state;
begin
  select * into v_row from public.job_payments where id = p_payment for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;

  v_role := case
    when auth.uid() = v_row.client_id then 'client'
    when auth.uid() = v_row.provider_id then 'provider'
    when public.is_staff() then 'support'
    else null end;
  if v_role is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  select exists (
    select 1 from public.work_transitions t
     where t.from_state = v_row.work_state and t.to_state = p_to
       and (t.actor = v_role or (t.actor = 'either' and v_role in ('client','provider')))
  ) into v_allowed;
  if not v_allowed then
    raise exception 'NEDOZVOLJEN_PRELAZ: % -> % za ulogu %', v_row.work_state, p_to, v_role
      using errcode = 'P0001';
  end if;

  -- staro stanje se pamti PRIJE UPDATE-a; inace bi dnevnik bio "submitted -> submitted"
  v_from := v_row.work_state;
  update public.job_payments set work_state = p_to where id = p_payment returning * into v_row;
  insert into public.job_events (payment_id, from_state, to_state, actor_id, actor_role, detail)
  values (p_payment, v_from, p_to, auth.uid(), v_role, p_detail);
  return v_row;
end $fn$;

create or replace function public.job_transition_system(p_payment uuid, p_to work_state, p_detail jsonb default '{}')
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_from work_state;
begin
  select work_state into v_from from public.job_payments where id = p_payment for update;
  if not exists (select 1 from public.work_transitions
                 where from_state = v_from and to_state = p_to and actor = 'system') then
    raise exception 'NEDOZVOLJEN_SISTEMSKI_PRELAZ: % -> %', v_from, p_to;
  end if;
  update public.job_payments set work_state = p_to where id = p_payment;
  insert into public.job_events (payment_id, from_state, to_state, actor_role, detail)
  values (p_payment, v_from, p_to, 'system', p_detail);
end $fn$;

revoke execute on function public.job_transition_system(uuid, work_state, jsonb) from anon, authenticated;

create or replace function public.submit_work(p_listing uuid, p_report text, p_evidence text[] default '{}')
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_rev smallint;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'NOVAC_NIJE_U_ESCROWU' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_report, ''))) < 20 and coalesce(array_length(p_evidence, 1), 0) = 0 then
    raise exception 'DOKAZ_JE_OBAVEZAN: prilozi slike ili napisi izvjestaj (min. 20 znakova)' using errcode = 'P0001';
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
end $fn$;

create or replace function public.approve_work(p_listing uuid)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.client_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  perform public.job_transition(v_row.id, 'completed', '{}'::jsonb);
  return public.release_job_payment(p_listing);
end $fn$;

create or replace function public.request_revision(p_listing uuid, p_reason text)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_max smallint := 3;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.client_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'RAZLOG_JE_OBAVEZAN' using errcode = 'P0001'; end if;
  if v_row.revision_count >= v_max then
    raise exception 'ISKORISTENE_SVE_ISPRAVKE: otvori spor ako rad i dalje nije po dogovoru' using errcode = 'P0001';
  end if;

  perform public.job_transition(v_row.id, 'revision', jsonb_build_object('razlog', p_reason));
  update public.job_payments
     set revision_count = revision_count + 1, review_deadline = null, status = 'funded'
   where id = v_row.id returning * into v_row;

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.provider_id, 'job', 'Klijent traži ispravku', left(p_reason, 200), '/listings/' || p_listing::text);
  return v_row;
end $fn$;

create or replace function public.request_cancellation(p_listing uuid, p_reason_code text, p_detail text default null)
returns public.cancellation_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.cancellation_requests;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_row.client_id, v_row.provider_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  insert into public.cancellation_requests (payment_id, requested_by, reason_code, detail, prev_state, restore_deadline)
  values (v_row.id, auth.uid(), p_reason_code, p_detail, v_row.work_state, v_row.review_deadline)
  returning * into v_req;

  perform public.job_transition(v_row.id, 'cancel_requested',
    jsonb_build_object('razlog', p_reason_code, 'iz_stanja', v_row.work_state));

  insert into public.notifications (user_id, type, title, message, link) values
    (case when auth.uid() = v_row.client_id then v_row.provider_id else v_row.client_id end,
     'job', 'Zatražen je prekid posla',
     'Druga strana traži sporazumni prekid. Dok ne odgovoriš, novac ostaje osiguran na Poso.ba.',
     '/listings/' || p_listing::text);
  return v_req;
end $fn$;

create or replace function public.respond_cancellation(p_listing uuid, p_accept boolean, p_note text default null)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.cancellation_requests;
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

  if p_accept then
    perform public.job_transition(v_row.id, 'cancelled', jsonb_build_object('napomena', p_note));
    return public.cancel_job_payment(p_listing, 'Sporazumni prekid');
  else
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
end $fn$;

create or replace function public.open_dispute(
  p_listing uuid, p_reason_code text, p_claim text, p_evidence text[] default '{}'
) returns public.disputes
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_dispute public.disputes; v_role text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  v_role := case when auth.uid() = v_row.client_id then 'client'
                 when auth.uid() = v_row.provider_id then 'provider' else null end;
  if v_role is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_claim, ''))) < 20 then
    raise exception 'OPIS_SPORA_JE_OBAVEZAN: opisi sta se desilo (min. 20 znakova)' using errcode = 'P0001';
  end if;

  perform public.job_transition(v_row.id, 'disputed', jsonb_build_object('razlog', p_reason_code));
  update public.job_payments set status = 'disputed', disputed_at = now(),
         dispute_by = auth.uid(), dispute_reason = p_reason_code, review_deadline = null
   where id = v_row.id;

  insert into public.disputes (payment_id, opened_by, opened_role, reason_code, claim, evidence_urls)
  values (v_row.id, auth.uid(), v_role, p_reason_code, btrim(p_claim), p_evidence)
  returning * into v_dispute;

  insert into public.notifications (user_id, type, title, message, link) values
    (case when v_role = 'client' then v_row.provider_id else v_row.client_id end,
     'job', 'Otvoren je spor',
     'Posao je zamrznut dok Poso.ba tim ne pregleda dokaze i prepisku. Novac ostaje osiguran.',
     '/listings/' || p_listing::text);
  return v_dispute;
end $fn$;;
