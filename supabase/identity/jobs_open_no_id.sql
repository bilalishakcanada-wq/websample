-- ============================================================================
-- Posao objavljuje svako, bez lične karte; ponude i dalje samo potvrđeni izvođači
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Odluka vlasnika (04.10.2026.): verifikaciju identiteta prolaze samo izvođači.
-- Klijent objavljuje posao bez ikakve provjere.
--
-- Danas objava posla koristi identity_ok() s prelaznim rokom: nalozi otvoreni
-- poslije 25.09.2026. 16:00 UTC ne mogu objaviti posao bez potvrđene lične
-- karte. Ova datoteka:
--   * isključuje prekidač verification_policy.require_for_jobs;
--   * listings_insert_own: vlastiti user_id, nalog nije suspendovan, a identitet
--     samo ako se prekidač ikad opet uključi (tada strogo, identity_verified());
--   * trigger listings_identity_gate daje jasne poruke (SUSPENDED / VERIFIKACIJA_POTREBNA);
--   * can_post_job() — sučelje pita istu funkciju koju pita baza.
--
-- Vraća i provjeru suspenzije pri objavi: identity_gate_on_jobs_and_bids
-- (25.09.2026.) ju je izostavila, pa suspendovan nalog danas može objaviti posao.
--
-- PONUDE se ne mijenjaju: bids_require_verified.sql (produkcija od 26.09.2026.)
-- i dalje traži odobren identitet ili člana tima.
-- Idempotentno: može se pokrenuti više puta.
-- ============================================================================

-- Iz bids_require_verified.sql (već na produkciji); ponavlja se da datoteka radi i sama.
create or replace function public.identity_verified(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select p.identity_state = 'approved'
           or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                      where ur.user_id = p_user and r.name in ('ADMIN', 'MODERATOR'))
    from public.profiles p where p.user_id = p_user
  ), false);
$fn$;

revoke execute on function public.identity_verified(uuid) from public, anon;
grant execute on function public.identity_verified(uuid) to authenticated;

update public.verification_policy set require_for_jobs = false where id;

-- Smije li korisnik objaviti posao (bez obzira na suspenziju): da, osim ako se
-- prekidač ikad opet uključi — tada samo odobren identitet ili tim.
create or replace function public.can_post_job(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select not coalesce((select require_for_jobs from public.verification_policy where id), false)
         or public.identity_verified(p_user);
$fn$;

revoke execute on function public.can_post_job(uuid) from public, anon;
grant execute on function public.can_post_job(uuid) to authenticated;

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings for insert to authenticated
  with check (auth.uid() = user_id and not public.is_suspended() and public.can_post_job());

-- Jasna poruka prije RLS-a; sučelje je prevodi.
create or replace function public.guard_identity_on_listing()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if public.is_suspended() then
    raise exception 'SUSPENDED: nalog je suspendovan' using errcode = '42501';
  end if;
  if not public.can_post_job(new.user_id) then
    raise exception 'VERIFIKACIJA_POTREBNA: potvrdi identitet prije objave posla'
      using errcode = '42501', hint = 'identity_required';
  end if;
  return new;
end $fn$;

drop trigger if exists listings_identity_gate on public.listings;
create trigger listings_identity_gate before insert on public.listings
  for each row execute function public.guard_identity_on_listing();
