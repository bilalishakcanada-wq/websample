-- CASE vraca text, a kolona je enum — treba izricit cast
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
     set state = (case when p_approve then 'approved' else 'rejected' end)::verif_state,
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
end $fn$;;
