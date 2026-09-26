-- ============================================================================
-- Ponude šalju SAMO izvođači s potvrđenim identitetom — bez prelaznog roka
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Danas identity_ok() pušta i svaki nalog napravljen prije grandfather_before
-- (25.09.2026. 16:00 UTC), pa 6 od 7 postojećih naloga šalje ponude bez
-- verifikacije. Ovo za PONUDE uvodi strogu provjeru: odobren identitet ili
-- član tima. Objava posla (require_for_jobs) i dalje koristi identity_ok() s
-- prelaznim rokom — to je posebna odluka.
--
-- Oslanja se na ../migration_identity_state_protection.sql (na produkciji od
-- 25.09.2026. 22:54 UTC): bez nje bi korisnik sam sebi postavio
-- identity_state = 'approved' i prošao i ovu kapiju.
--
-- Provjera ide samo na INSERT (restriktivna politika + trigger s jasnom
-- porukom). Postojeći izvođači bez verifikacije i dalje mogu POVUĆI ponudu koju
-- su već poslali — ranije je FOR ALL politika tražila identitet i za to.
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

-- Jasna poruka (VERIFIKACIJA_POTREBNA) prije RLS-a; sučelje je prevodi i daje link.
create or replace function public.guard_identity_on_bid()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (select require_for_bids from public.verification_policy where id)
     and not public.identity_verified(new.bidder_id) then
    raise exception 'VERIFIKACIJA_POTREBNA: potvrdi identitet prije slanja ponude'
      using errcode = '42501', hint = 'identity_required';
  end if;
  return new;
end $fn$;

drop trigger if exists bids_identity_gate on public.bids;
create trigger bids_identity_gate before insert on public.bids
  for each row execute function public.guard_identity_on_bid();

-- Vlasnik ponude: bez identiteta u WITH CHECK, da povlačenje radi svima.
drop policy if exists bids_bidder_manage on public.bids;
create policy bids_bidder_manage on public.bids for all to authenticated
  using (auth.uid() = bidder_id)
  with check (auth.uid() = bidder_id and not public.is_suspended());

-- Identitet se traži pri svakom novom unosu, bez obzira na druge politike.
drop policy if exists bids_insert_identity on public.bids;
create policy bids_insert_identity on public.bids as restrictive for insert to authenticated
  with check (
    not (select require_for_bids from public.verification_policy where id)
    or public.identity_verified()
  );
