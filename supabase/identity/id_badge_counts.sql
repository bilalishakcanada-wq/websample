-- ============================================================================
-- Značka "Lična karta verifikovana" i potvrđen identitet su ista stvar
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Vlasnik (04.10.2026.): ko ima značku "Lična karta verifikovana" smije
-- objavljivati poslove. Do sada su postojala dva odvojena puta:
--   * JMBG + dokument (identity_verifications) → profiles.identity_state = 'approved';
--     značku NE dodjeljuje;
--   * stranica Značke (verification_requests, kind 'identity') → značka id_verified;
--     identity_state NE mijenja.
-- Kapija (identity_verified(), koju koriste can_post_job() i ponude) gledala je samo
-- prvi put, pa bi korisnik sa značkom bio blokiran.
--
-- Ova datoteka:
--   1. identity_verified() prihvata i značku id_verified (dodjeljuje je samo tim:
--      user_badges i odobravanje verification_requests smije samo admin);
--   2. odobrenje kroz JMBG tok dodjeljuje i značku, pa svako ko smije objavljivati
--      ima značku na profilu;
--   3. dodjeljuje značku već odobrenim korisnicima.
-- Važi i za objavu posla i za ponude. Idempotentno.
-- ============================================================================

create or replace function public.identity_verified(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select p.identity_state = 'approved'
           or exists (select 1 from public.user_badges ub join public.badges b on b.id = ub.badge_id
                      where ub.user_id = p_user and b.code = 'id_verified')
           or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                      where ur.user_id = p_user and r.name in ('ADMIN', 'MODERATOR'))
    from public.profiles p where p.user_id = p_user
  ), false);
$fn$;

revoke execute on function public.identity_verified(uuid) from public, anon;
grant execute on function public.identity_verified(uuid) to authenticated;

create or replace function public.award_id_badge_on_identity_approved()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if new.state = 'approved' and old.state is distinct from new.state then
    perform public.set_badge(new.user_id, 'id_verified', true);
  end if;
  return new;
end $fn$;

revoke execute on function public.award_id_badge_on_identity_approved() from public, anon, authenticated;

create or replace trigger identity_approved_badge after update of state on public.identity_verifications
  for each row execute function public.award_id_badge_on_identity_approved();

select public.set_badge(p.user_id, 'id_verified', true)
from public.profiles p where p.identity_state = 'approved';
