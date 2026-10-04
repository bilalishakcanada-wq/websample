-- ============================================================================
-- Posao objavljuju SAMO korisnici s potvrđenim identitetom — bez prelaznog roka
-- ----------------------------------------------------------------------------
-- Primijenjeno na produkciju 04.10.2026. (migracija jobs_require_verified), po
-- odobrenju vlasnika: obje strane trebaju potvrđenu ličnu kartu.
--
-- Danas objava posla koristi identity_ok(), koja pušta i svaki nalog napravljen
-- prije grandfather_before (25.09.2026. 16:00 UTC). Ovo uvodi za OBJAVU POSLA
-- isto pravilo koje ponude imaju od 26.09.2026. (bids_require_verified.sql):
-- odobren identitet ili član tima (ADMIN / MODERATOR).
--
-- Usput vraća i provjeru suspenzije: migracija identity_gate_on_jobs_and_bids
-- (25.09.2026.) je pri ponovnom pravljenju listings_insert_own izostavila
-- "not is_suspended()", pa suspendovan nalog i danas može objaviti posao.
--
-- Pregledanje ostaje otvoreno svima. Provjera ide samo na INSERT u listings:
-- već objavljene poslove vlasnik i dalje može uređivati, zatvarati i brisati.
--
-- Oslanja se na:
--   * migration_identity_state_protection.sql (produkcija od 25.09.2026.) —
--     korisnik ne može sam sebi upisati identity_state = 'approved';
--   * identity_verified() iz bids_require_verified.sql (produkcija od 26.09.2026.);
--     ovdje se ponavlja da datoteka radi i sama.
--
-- Sučelje pita can_post_job(); dok ova datoteka nije primijenjena, pada nazad
-- na identity_ok() — tako forma uvijek govori isto što i baza.
-- Idempotentno: može se pokrenuti više puta.
-- ============================================================================

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

-- Jedno mjesto koje kaže smije li korisnik objaviti posao (pravila + identitet).
-- Sučelje i baza pitaju istu funkciju.
create or replace function public.can_post_job(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select not coalesce((select require_for_jobs from public.verification_policy where id), true)
         or public.identity_verified(p_user);
$fn$;

revoke execute on function public.can_post_job(uuid) from public, anon;
grant execute on function public.can_post_job(uuid) to authenticated;

-- Jasna poruka (VERIFIKACIJA_POTREBNA) prije RLS-a; sučelje je prevodi i daje link.
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

-- Restriktivna politika: vrijedi uz listings_insert_own (vlastiti user_id), koja
-- ostaje netaknuta. Trigger iznad daje poruku; politika drži i kad bi trigger
-- nekad bio uklonjen.
drop policy if exists listings_insert_identity on public.listings;
create policy listings_insert_identity on public.listings as restrictive for insert to authenticated
  with check (public.can_post_job() and not public.is_suspended());
