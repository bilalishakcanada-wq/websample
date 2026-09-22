-- ============================================================================
-- BOOKING ENGINE 02 — radnje (predaja rada, odobrenje, prekid, spor, 72 h)
-- ----------------------------------------------------------------------------
-- Svaka radnja: zaključaj → provjeri pravo → promijeni stanje → tek onda novac.
-- Novac se dira SAMO kroz postojeće release_job_payment / cancel_job_payment,
-- koji su zakrpljeni u supabase/security/01 (FOR UPDATE + compare-and-swap).
-- ============================================================================

-- --------------------------------------------------- 2.1 Izvođač predaje rad
create or replace function public.submit_work(
  p_listing uuid, p_report text, p_evidence text[] default '{}'
) returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_rev smallint;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'NOVAC_NIJE_U_ESCROWU' using errcode = 'P0001'; end if;

  -- dokaz je uslov, ne preporuka (CHECK na tabeli je druga brana)
  if length(btrim(coalesce(p_report, ''))) < 20 and coalesce(array_length(p_evidence, 1), 0) = 0 then
    raise exception 'DOKAZ_JE_OBAVEZAN: priloži slike ili napiši izvještaj (min. 20 znakova)'
      using errcode = 'P0001';
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

-- ------------------------------------------------- 2.2 Klijent odobrava rad
create or replace function public.approve_work(p_listing uuid)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.client_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  perform public.job_transition(v_row.id, 'completed', '{}'::jsonb);
  return public.release_job_payment(p_listing);   -- zakrpljena funkcija radi isplatu
end $fn$;

-- --------------------------------------------- 2.3 Klijent traži ispravku
create or replace function public.request_revision(p_listing uuid, p_reason text)
returns public.job_payments
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_max smallint := 3;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if v_row.client_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'RAZLOG_JE_OBAVEZAN' using errcode = 'P0001'; end if;

  -- bez ograničenja bi klijent mogao tražiti ispravke unedogled i tako
  -- držati novac zaključanim zauvijek — to je ghosting na drugi način
  if v_row.revision_count >= v_max then
    raise exception 'ISKORISTENE_SVE_ISPRAVKE: otvori spor ako rad i dalje nije po dogovoru'
      using errcode = 'P0001';
  end if;

  perform public.job_transition(v_row.id, 'revision', jsonb_build_object('razlog', p_reason));
  update public.job_payments
     set revision_count = revision_count + 1, review_deadline = null, status = 'funded'
   where id = v_row.id returning * into v_row;

  insert into public.notifications (user_id, type, title, message, link) values
    (v_row.provider_id, 'job', 'Klijent traži ispravku',
     left(p_reason, 200), '/listings/' || p_listing::text);
  return v_row;
end $fn$;

-- ============================================================================
-- 2.4 Sporazumni prekid — KRAJ JEDNOSTRANOG OTKAZIVANJA
-- ----------------------------------------------------------------------------
-- Dosad je cancel_job_payment dozvoljavao i klijentu i izvođaču da sami vrate
-- novac klijentu dok je posao "funded". Od sada: traži se pristanak druge strane.
-- ============================================================================
create or replace function public.request_cancellation(p_listing uuid, p_reason_code text, p_detail text default null)
returns public.cancellation_requests
language plpgsql security definer set search_path = public as $fn$
declare v_row public.job_payments; v_req public.cancellation_requests;
begin
  select * into v_row from public.job_payments where listing_id = p_listing for update;
  if v_row.id is null then raise exception 'NEMA_UGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_row.client_id, v_row.provider_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- stanje i rok se pamte PRIJE prelaza: odbijen prekid mora vratiti ugovor tačno
  -- tu gdje je bio. Inače bi predani rad "nestao" i klijent bi stalnim zahtjevima
  -- za prekid beskonačno resetovao rok od 72 h — ghosting na zaobilaznicu.
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
  if auth.uid() not in (v_row.client_id, v_row.provider_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_req from public.cancellation_requests
   where payment_id = v_row.id and state = 'pending' for update;
  if v_req.id is null then raise exception 'NEMA_ZAHTJEVA' using errcode = 'P0001'; end if;
  -- na svoj zahtjev se ne odgovara: to bi bilo jednostrano otkazivanje na zaobilaznicu
  if v_req.requested_by = auth.uid() then
    raise exception 'NA_SVOJ_ZAHTJEV_SE_NE_ODGOVARA' using errcode = '42501';
  end if;

  update public.cancellation_requests
     set state = case when p_accept then 'accepted' else 'declined' end,
         responded_by = auth.uid(), responded_at = now()
   where id = v_req.id;

  if p_accept then
    perform public.job_transition(v_row.id, 'cancelled', jsonb_build_object('napomena', p_note));
    return public.cancel_job_payment(p_listing, 'Sporazumni prekid');
  else
    -- v_row je pročitan prije prelaza, pa se mora osvježiti: inače pozivalac
    -- dobije staro stanje i frontend nacrta pogrešan ekran
    select * into v_row from public.job_transition(v_row.id, coalesce(v_req.prev_state, 'in_progress'),
      jsonb_build_object('odbijeno', true, 'napomena', p_note));
    -- vrati i preostali rok za pregled, netaknut
    update public.job_payments set review_deadline = v_req.restore_deadline
     where id = v_row.id returning * into v_row;
    insert into public.notifications (user_id, type, title, message, link) values
      (v_req.requested_by, 'job', 'Prekid nije prihvaćen',
       'Druga strana nije pristala na prekid. Ako se ne možete dogovoriti, otvori spor.',
       '/listings/' || p_listing::text);
    return v_row;
  end if;
end $fn$;

-- ------------------------------------------------------------- 2.5 Spor
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
    raise exception 'OPIS_SPORA_JE_OBAVEZAN: opiši šta se desilo (min. 20 znakova)' using errcode = 'P0001';
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
end $fn$;

-- ================================================ 2.6 Automatsko odobrenje (72 h)
-- Rješava "mrtvog klijenta": izvođač je predao rad, klijent nestao.
create or replace function public.auto_release_expired_reviews()
returns integer
language plpgsql security definer set search_path = public as $fn$
declare r record; v_count integer := 0; v_failed integer := 0;
begin
  for r in
    select id, listing_id, provider_id, client_id, net_amount
      from public.job_payments
     where work_state = 'submitted' and status = 'requested'
       and review_deadline is not null and review_deadline < now()
     order by review_deadline
     limit 200
     for update skip locked
  loop
    begin
      perform public.job_transition_system(r.id, 'completed', jsonb_build_object('razlog', 'istekao rok od 72 h'));
      update public.job_payments set auto_released = true where id = r.id;

      -- isplata: ista pravila kao ručno oslobađanje (CAS + lock iz security/01)
      update public.job_payments
         set status = 'released', released_at = now()
       where id = r.id and status in ('funded', 'requested', 'disputed');
      if found then
        perform public.wallet_move(r.provider_id, r.net_amount, 'job_income',
          'Automatska isplata — klijent nije odgovorio u roku od 72 h', null);
        perform set_config('poso.system_write', '1', true);
        update public.listings set status = 'completed', completed_at = now() where id = r.listing_id;
        perform set_config('poso.system_write', '', true);

        insert into public.notifications (user_id, type, title, message, link) values
          (r.provider_id, 'job', 'Uplata oslobođena automatski 💸',
           'Klijent nije odgovorio u roku od 72 sata, pa je uplata prebačena na tvoj balans.',
           '/account/novcanik'),
          (r.client_id, 'job', 'Posao je automatski odobren',
           'Nisi pregledao/la predani rad u roku od 72 sata, pa je uplata oslobođena izvođaču.',
           '/listings/' || r.listing_id::text);
        v_count := v_count + 1;
      end if;
    exception when others then
      -- jedan problematičan ugovor ne smije zaustaviti ostale, ALI tihi otkaz je
      -- gori od pada: bez ovoga bi pokvaren posao vraćao 0 ("nema šta za obraditi")
      -- i izvođači bi mjesecima ne dobijali novac a da niko ne primijeti.
      v_failed := v_failed + 1;
      insert into public.job_events (payment_id, to_state, actor_role, detail)
      values (r.id, 'submitted', 'system', jsonb_build_object('greska', sqlerrm));
    end;
  end loop;

  if v_failed > 0 then
    raise warning 'auto_release: % ugovora nije obrađeno (greške u job_events)', v_failed;
    if to_regclass('public.security_alerts') is not null then
      insert into public.security_alerts (user_id, kind, severity, details)
      select r2.client_id, 'auto_release_failed', 2,
             jsonb_build_object('neuspjelih', v_failed, 'obradjenih', v_count)
        from public.job_payments r2 limit 1;
    end if;
  end if;
  return v_count;
end $fn$;

select cron.schedule('auto-release-reviews', '*/15 * * * *',
  $$ select public.auto_release_expired_reviews(); $$)
where not exists (select 1 from cron.job where jobname = 'auto-release-reviews');
