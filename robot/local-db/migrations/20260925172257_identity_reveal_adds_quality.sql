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
    'signali', v_row.risk_flags,
    'kvalitet', v_row.quality,
    'bodovi', v_row.risk_score);
end $fn$;;
