revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles from public, anon, authenticated;
alter view public.public_profiles set (security_barrier = true);

revoke execute on function public.jmbg_key() from public, anon, authenticated;
revoke execute on function public.jmbg_fingerprint(text) from public, anon, authenticated;
revoke execute on function public.job_transition_system(uuid, work_state, jsonb) from public, anon, authenticated;
revoke execute on function public.identity_purge_due() from public, anon, authenticated;
revoke execute on function public.auto_release_expired_reviews() from public, anon, authenticated;

do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.identity_risk(uuid)'::regprocedure);
  v_def := replace(v_def, 'FUNCTION public.identity_risk(', 'FUNCTION public.identity_risk_calc(');
  execute v_def;
end $$;
revoke execute on function public.identity_risk_calc(uuid) from public, anon, authenticated;

create or replace function public.identity_risk(p_case uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return public.identity_risk_calc(p_case);
end $$;
revoke execute on function public.identity_risk(uuid) from public, anon;
grant execute on function public.identity_risk(uuid) to authenticated;

do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.submit_identity(text, text, doc_kind, text, text, text, text, text, jsonb, text)'::regprocedure);
  if position('public.identity_risk(v_row.id)' in v_def) = 0 then
    raise exception 'submit_identity se promijenio; provjeri poziv identity_risk ručno';
  end if;
  execute replace(v_def, 'public.identity_risk(v_row.id)', 'public.identity_risk_calc(v_row.id)');
end $$;;
