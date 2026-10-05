-- ============================================================================
-- Beta prekidač: objava posla i ponude bez lične karte
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Sve kapije identiteta već čitaju verification_policy:
--   * objava posla  → can_post_job() / listings_insert_own   (require_for_jobs)
--   * slanje ponude → bids_identity_gate / bids_insert_identity (require_for_bids)
-- Kad su oba polja false, provjere prolaze; kod verifikacije ostaje netaknut.
--
-- Prekidač je u bazi, ne u sajtu: sajt i repozitorij su javni, pa bi zastavica
-- u buildu (VITE_...) ili zaglavlje zahtjeva bili dostupni svakome. Ovdje ga
-- mijenja samo ADMIN (set_identity_beta), i svaka promjena ide u staff_actions.
--
-- NE dira isplate: request_payout() i dalje traži odobren identitet
-- (identity_verified), bez obzira na prekidač.
--
-- Na kraju datoteke prekidač se UKLJUČUJE (beta). Isključuje se iz admin
-- konzole (Identitet → "Uključi provjeru ponovo") ili:
--   update public.verification_policy set require_for_jobs = true, require_for_bids = true where id;
-- ============================================================================

create or replace function public.set_identity_beta(p_on boolean)
returns public.verification_policy
language plpgsql security definer set search_path = public as $fn$
declare v_row public.verification_policy;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  update public.verification_policy
     set require_for_jobs = not p_on,
         require_for_bids = not p_on,
         updated_at = now()
   where id
  returning * into v_row;
  perform public.log_staff_action(
    case when p_on then 'identity_beta_on' else 'identity_beta_off' end,
    null, jsonb_build_object('require_for_jobs', not p_on, 'require_for_bids', not p_on));
  return v_row;
end $fn$;

revoke execute on function public.set_identity_beta(boolean) from public, anon;
grant execute on function public.set_identity_beta(boolean) to authenticated;

-- Beta: uključeno odmah (bez prijave admina, jer migraciju pokreće vlasnik baze).
update public.verification_policy
   set require_for_jobs = false, require_for_bids = false, updated_at = now()
 where id;
