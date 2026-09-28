-- Predaja prima i otisak slike, mjere kvaliteta i oznaku uređaja, pa odmah
-- izračuna bodove rizika. Odbija slike koje se ne mogu pročitati — nema smisla
-- trošiti moderatorovo vrijeme na mutnu fotografiju.
create or replace function public.submit_identity(
  p_full_name text, p_jmbg text, p_doc_type doc_kind, p_doc_number text,
  p_front text, p_back text default null, p_selfie text default null,
  p_phash text default null, p_quality jsonb default null, p_device text default null
) returns public.identity_verifications
language plpgsql security definer set search_path = extensions, public as $fn$
declare
  v_check jsonb; v_fp text; v_row public.identity_verifications;
  v_flags text[] := '{}'; v_uzrast int; v_rizik jsonb;
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

  -- slika koja se ne moze procitati ne ide u red
  if p_quality is not null and (p_quality->>'ostrina')::numeric < 55 then
    raise exception 'SLIKA_MUTNA: slika dokumenta je previše mutna da bi se pročitala'
      using errcode = 'P0001', hint = 'blurry';
  end if;

  v_uzrast := extract(year from age(current_date, (v_check->>'datum_rodjenja')::date));
  if v_uzrast < 18 then
    raise exception 'MALOLJETAN: platformu mogu koristiti samo punoljetne osobe' using errcode = 'P0001';
  end if;

  v_fp := public.jmbg_fingerprint(p_jmbg);

  if exists (select 1 from public.identity_verifications
              where jmbg_fp = v_fp and state = 'approved' and user_id <> auth.uid()) then
    raise exception 'JMBG_VEC_KORISTEN: ovaj broj je već verifikovan na drugom nalogu'
      using errcode = 'P0001', hint = 'jmbg_taken';
  end if;
  if p_phash is not null and exists (select 1 from public.identity_verifications
              where doc_phash = p_phash and state = 'approved' and user_id <> auth.uid()) then
    raise exception 'DOKUMENT_VEC_KORISTEN: ista slika dokumenta je već verifikovana na drugom nalogu'
      using errcode = 'P0001', hint = 'doc_taken';
  end if;

  if public.normalize_person_name(p_full_name) is distinct from public.normalize_person_name(
       (select full_name from public.profiles where user_id = auth.uid())) then
    v_flags := array_append(v_flags, 'ime_se_razlikuje_od_profila');
  end if;
  if exists (select 1 from public.identity_verifications where jmbg_fp = v_fp and user_id <> auth.uid()) then
    v_flags := array_append(v_flags, 'isti_broj_vec_pokusan_na_drugom_nalogu');
  end if;
  if v_uzrast > 90 then v_flags := array_append(v_flags, 'neuobicajena_starost'); end if;

  update public.identity_verifications set state = 'expired', updated_at = now()
   where user_id = auth.uid() and state not in ('approved','rejected','expired');

  insert into public.identity_verifications (
    user_id, state, full_name, jmbg_enc, jmbg_fp, birth_date, gender, region_code,
    doc_type, doc_number, doc_front_path, doc_back_path, selfie_path,
    auto_checks, risk_flags, submitted_at, doc_phash, quality, device_fp)
  values (
    auth.uid(), 'submitted', btrim(p_full_name),
    extensions.pgp_sym_encrypt(regexp_replace(p_jmbg, '\D', '', 'g'), public.jmbg_key()),
    v_fp, (v_check->>'datum_rodjenja')::date, v_check->>'pol', (v_check->>'regija')::smallint,
    p_doc_type, nullif(btrim(p_doc_number), ''), p_front, p_back, p_selfie,
    v_check, v_flags, now(), p_phash, p_quality, p_device)
  returning * into v_row;

  v_rizik := public.identity_risk(v_row.id);
  update public.identity_verifications set risk_score = (v_rizik->>'bodovi')::smallint
   where id = v_row.id returning * into v_row;

  update public.profiles set identity_state = 'submitted', updated_at = now() where user_id = auth.uid();

  insert into public.notifications (user_id, type, title, message, link)
  values (auth.uid(), 'moderation', 'Podaci su poslani na provjeru',
          'Naš tim provjerava tvoj identitet. Javljamo ti se čim završi — obično u roku 24 sata.',
          '/account/verifikacija');
  return v_row;
end $fn$;

grant execute on function public.submit_identity(text, text, doc_kind, text, text, text, text, text, jsonb, text) to authenticated;

-- red sada ide po riziku: najopasnije prvo
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
      order by risk_score desc, submitted_at
      for update skip locked limit 1)
  returning * into v_row;
  return v_row;
end $fn$;;
