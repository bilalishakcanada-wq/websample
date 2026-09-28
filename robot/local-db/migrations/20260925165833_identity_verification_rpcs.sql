-- ---------------------------------------------- korisnik predaje na provjeru
create or replace function public.submit_identity(
  p_full_name text, p_jmbg text, p_doc_type doc_kind, p_doc_number text,
  p_front text, p_back text default null, p_selfie text default null
) returns public.identity_verifications
language plpgsql security definer set search_path = extensions, public as $fn$
declare
  v_check jsonb; v_fp text; v_row public.identity_verifications;
  v_flags text[] := '{}'; v_profile_name text; v_uzrast int;
begin
  if auth.uid() is null then raise exception 'NEPRIJAVLJEN' using errcode = '42501'; end if;

  v_check := public.jmbg_check(p_jmbg);
  if not (v_check->>'valid')::boolean then
    raise exception 'JMBG_NEISPRAVAN: %', coalesce(v_check->'greske'->>0, 'broj nije ispravan')
      using errcode = 'P0001', hint = 'jmbg_invalid';
  end if;
  if coalesce(trim(p_full_name), '') = '' or p_full_name !~ '\S+\s+\S+' then
    raise exception 'IME_I_PREZIME_OBAVEZNI' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_front), '') = '' then
    raise exception 'SLIKA_DOKUMENTA_OBAVEZNA' using errcode = 'P0001';
  end if;

  -- punoljetstvo: platforma radi sa novcem i ugovorima
  v_uzrast := extract(year from age(current_date, (v_check->>'datum_rodjenja')::date));
  if v_uzrast < 18 then
    raise exception 'MALOLJETAN: platformu mogu koristiti samo punoljetne osobe' using errcode = 'P0001';
  end if;

  v_fp := public.jmbg_fingerprint(p_jmbg);

  -- isti JMBG vec odobren na drugom nalogu = pokusaj drugog naloga
  if exists (select 1 from public.identity_verifications
              where jmbg_fp = v_fp and state = 'approved' and user_id <> auth.uid()) then
    raise exception 'JMBG_VEC_KORISTEN: ovaj broj je već verifikovan na drugom nalogu'
      using errcode = 'P0001', hint = 'jmbg_taken';
  end if;

  -- signali za moderatora (ne odbijaju, samo skrecu paznju)
  select display_name_of(full_name) into v_profile_name from public.profiles where user_id = auth.uid();
  if public.normalize_person_name(p_full_name) is distinct from public.normalize_person_name(
       (select full_name from public.profiles where user_id = auth.uid())) then
    v_flags := array_append(v_flags, 'ime_se_razlikuje_od_profila');
  end if;
  if exists (select 1 from public.identity_verifications where jmbg_fp = v_fp and user_id <> auth.uid()) then
    v_flags := array_append(v_flags, 'isti_broj_vec_pokusan_na_drugom_nalogu');
  end if;
  if v_uzrast > 90 then v_flags := array_append(v_flags, 'neuobicajena_starost'); end if;

  -- zatvori raniji otvoreni predmet, pa upisi novi
  update public.identity_verifications set state = 'expired', updated_at = now()
   where user_id = auth.uid() and state not in ('approved','rejected','expired');

  insert into public.identity_verifications (
    user_id, state, full_name, jmbg_enc, jmbg_fp, birth_date, gender, region_code,
    doc_type, doc_number, doc_front_path, doc_back_path, selfie_path,
    auto_checks, risk_flags, submitted_at)
  values (
    auth.uid(), 'submitted', btrim(p_full_name),
    extensions.pgp_sym_encrypt(regexp_replace(p_jmbg, '\D', '', 'g'), public.jmbg_key()),
    v_fp, (v_check->>'datum_rodjenja')::date, v_check->>'pol', (v_check->>'regija')::smallint,
    p_doc_type, nullif(btrim(p_doc_number), ''), p_front, p_back, p_selfie,
    v_check, v_flags, now())
  returning * into v_row;

  update public.profiles set identity_state = 'submitted', updated_at = now() where user_id = auth.uid();

  insert into public.notifications (user_id, type, title, message, link)
  values (auth.uid(), 'moderation', 'Podaci su poslani na provjeru',
          'Naš tim provjerava tvoj identitet. Javljamo ti se čim završi — obično u roku 24 sata.',
          '/account/verifikacija');
  return v_row;
end $fn$;

-- ------------------------------------------------ moderator preuzima predmet
create or replace function public.identity_claim_next(p_minutes int default 15)
returns public.identity_verifications
language plpgsql security definer set search_path = public as $fn$
declare v_row public.identity_verifications;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;

  update public.identity_verifications c
     set claimed_by = auth.uid(), claimed_until = now() + make_interval(mins => p_minutes),
         state = 'in_review', updated_at = now()
   where c.id = (
     select id from public.identity_verifications
      where state in ('submitted','in_review')
        and (claimed_until is null or claimed_until < now())
      order by submitted_at
      for update skip locked limit 1)
  returning * into v_row;
  return v_row;
end $fn$;

-- --------------------------- otvaranje broja/dokumenta OSTAVLJA TRAG, uvijek
create or replace function public.identity_reveal(p_case uuid)
returns jsonb
language plpgsql security definer set search_path = extensions, public as $fn$
declare v_row public.identity_verifications; v_jmbg text;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_row from public.identity_verifications where id = p_case;
  if v_row.id is null then raise exception 'NEMA_PREDMETA'; end if;

  v_jmbg := extensions.pgp_sym_decrypt(v_row.jmbg_enc, public.jmbg_key());

  perform public.log_staff_action('identity_reveal', v_row.user_id,
    jsonb_build_object('case_id', p_case, 'kada', now()));

  return jsonb_build_object(
    'jmbg', v_jmbg, 'ime', v_row.full_name, 'datum_rodjenja', v_row.birth_date,
    'pol', v_row.gender, 'dokument', v_row.doc_type, 'broj_dokumenta', v_row.doc_number,
    'slike', jsonb_build_object('lice', v_row.doc_front_path, 'nalicje', v_row.doc_back_path, 'selfi', v_row.selfie_path),
    'signali', v_row.risk_flags);
end $fn$;

-- ------------------------------------------------------------- odluka tima
create or replace function public.identity_decide(p_case uuid, p_approve boolean, p_reason text default null)
returns public.identity_verifications
language plpgsql security definer set search_path = public as $fn$
declare v_row public.identity_verifications;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_row from public.identity_verifications where id = p_case for update;
  if v_row.id is null then raise exception 'NEMA_PREDMETA'; end if;
  if v_row.state in ('approved','rejected') then raise exception 'VEC_RIJESENO' using errcode = 'P0001'; end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then
    raise exception 'RAZLOG_ODBIJANJA_OBAVEZAN' using errcode = 'P0001';
  end if;

  update public.identity_verifications
     set state = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now(), reject_reason = p_reason,
         approved_at = case when p_approve then now() else null end,
         claimed_by = null, claimed_until = null, updated_at = now()
   where id = p_case returning * into v_row;

  update public.profiles
     set identity_state = v_row.state,
         identity_approved_at = case when p_approve then now() else null end,
         updated_at = now()
   where user_id = v_row.user_id;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_row.user_id, 'moderation',
    case when p_approve then 'Identitet je potvrđen ✅' else 'Verifikacija nije prošla' end,
    case when p_approve then 'Sada možeš objavljivati poslove i slati ponude.'
         else coalesce(p_reason, 'Podaci se nisu poklopili. Možeš poslati ponovo sa jasnijom slikom dokumenta.') end,
    '/account/verifikacija');

  perform public.log_staff_action(case when p_approve then 'identity_approve' else 'identity_reject' end,
    v_row.user_id, jsonb_build_object('case_id', p_case, 'razlog', p_reason));
  return v_row;
end $fn$;

grant execute on function public.submit_identity(text, text, doc_kind, text, text, text, text) to authenticated;
grant execute on function public.identity_claim_next(int) to authenticated;
grant execute on function public.identity_reveal(uuid) to authenticated;
grant execute on function public.identity_decide(uuid, boolean, text) to authenticated;;
