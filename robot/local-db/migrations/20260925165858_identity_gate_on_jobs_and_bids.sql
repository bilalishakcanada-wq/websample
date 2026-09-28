-- Kapija: sta se ne moze bez potvrdjenog identiteta.
-- Postojeci nalozi (stariji od grandfather_before) su izuzeti — inace bi se
-- platforma zakljucala svima preko noci, ukljucujuci vlasnika.
create or replace function public.identity_ok(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $fn$
  select coalesce((
    select p.identity_state = 'approved'
           or p.created_at < (select grandfather_before from public.verification_policy where id)
           or public.is_staff()
    from public.profiles p where p.user_id = p_user
  ), false);
$fn$;

grant execute on function public.identity_ok(uuid) to authenticated;

comment on function public.identity_ok(uuid) is
  'Identitet potvrdjen ILI je nalog stariji od prelaznog roka (grandfather_before) ILI je clan tima.';

-- objava posla
drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings for insert to authenticated
  with check (
    auth.uid() = user_id
    and (not (select require_for_jobs from public.verification_policy where id) or public.identity_ok())
  );

-- slanje ponude
drop policy if exists bids_bidder_manage on public.bids;
create policy bids_bidder_manage on public.bids for all to authenticated
  using (auth.uid() = bidder_id)
  with check (
    auth.uid() = bidder_id and not public.is_suspended()
    and (not (select require_for_bids from public.verification_policy where id) or public.identity_ok())
  );

-- jasna poruka umjesto tihog "row-level security" teksta
create or replace function public.guard_identity_on_listing() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (select require_for_jobs from public.verification_policy where id) and not public.identity_ok(new.user_id) then
    raise exception 'VERIFIKACIJA_POTREBNA: potvrdi identitet prije objave posla'
      using errcode = '42501', hint = 'identity_required';
  end if;
  return new;
end $fn$;

drop trigger if exists listings_identity_gate on public.listings;
create trigger listings_identity_gate before insert on public.listings
  for each row execute function public.guard_identity_on_listing();

create or replace function public.guard_identity_on_bid() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (select require_for_bids from public.verification_policy where id) and not public.identity_ok(new.bidder_id) then
    raise exception 'VERIFIKACIJA_POTREBNA: potvrdi identitet prije slanja ponude'
      using errcode = '42501', hint = 'identity_required';
  end if;
  return new;
end $fn$;

drop trigger if exists bids_identity_gate on public.bids;
create trigger bids_identity_gate before insert on public.bids
  for each row execute function public.guard_identity_on_bid();;
