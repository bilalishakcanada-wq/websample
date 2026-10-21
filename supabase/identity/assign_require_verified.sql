-- ============================================================================
-- Dodjela posla traži potvrđen identitet obje strane (kad je provjera uključena)
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Admin prekidač (Identitet → „Obavezna verifikacija za sve", set_identity_beta)
-- već zaključava objavu posla (require_for_jobs) i slanje ponude (require_for_bids).
-- Ostala je rupa kod DODJELE: ponuda poslana dok je provjera bila isključena mogla
-- se prihvatiti i poslije uključivanja, pa bi posao dobio izvođač bez lične karte,
-- a dao ga klijent bez lične karte.
--
-- Ovdje: kad ponuda prelazi u 'accepted' (accept_offer_and_fund i svaki drugi put),
--   * klijent (vlasnik posla) mora imati potvrđen identitet ako je require_for_jobs;
--   * izvođač (autor ponude) mora imati potvrđen identitet ako je require_for_bids.
-- Greška poništi cijelu transakciju, pa se ni novac ne rezerviše.
--
-- Kad je prekidač isključen, ništa se ne mijenja. Već dodijeljeni poslovi se ne diraju.
-- Oslanja se na identity_verified() (bids_require_verified.sql / id_badge_counts.sql).
-- Idempotentno: može se pokrenuti više puta.
-- ============================================================================

create or replace function public.guard_identity_on_accept()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_policy public.verification_policy; v_client uuid;
begin
  if new.status is distinct from 'accepted' or old.status is not distinct from 'accepted' then
    return new;
  end if;
  select * into v_policy from public.verification_policy where id;
  select user_id into v_client from public.listings where id = new.listing_id;
  if coalesce(v_policy.require_for_jobs, true) and not public.identity_verified(v_client) then
    raise exception 'VERIFIKACIJA_POTREBNA: potvrdi identitet prije dodjele posla'
      using errcode = '42501', hint = 'identity_required';
  end if;
  if coalesce(v_policy.require_for_bids, true) and not public.identity_verified(new.bidder_id) then
    raise exception 'IZVODJAC_NIJE_VERIFIKOVAN: izvođač još nije potvrdio identitet'
      using errcode = '42501';
  end if;
  return new;
end $fn$;

drop trigger if exists bids_accept_identity_gate on public.bids;
create trigger bids_accept_identity_gate before update of status on public.bids
  for each row execute function public.guard_identity_on_accept();
