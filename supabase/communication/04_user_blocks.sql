-- Blokiranje korisnika (18.10.2026.)
--
-- Google Play pravilo za sadržaj korisnika (UGC): aplikacija mora imati i PRIJAVU i
-- BLOKIRANJE korisnika, kao dvije odvojene, jasno označene radnje. Prijava već postoji
-- (public.reports); ovo dodaje blokiranje.
--
-- Kad A blokira B (u bilo kojem smjeru):
--   * nijedno od njih ne može drugom poslati poruku,
--   * B ne može slati ponude na A-ove poslove niti postavljati pitanja na njima (i obrnuto).
-- Osoblje (is_staff) nije pogođeno, da podrška i sporovi rade i dalje.
-- Fajl se smije pokrenuti više puta.

begin;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

-- svako vidi i mijenja samo svoju listu blokiranih; blokirani ne vidi ko ga je blokirao
drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks for select to authenticated
  using (auth.uid() = blocker_id);
drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks for insert to authenticated
  with check (auth.uid() = blocker_id);
drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks for delete to authenticated
  using (auth.uid() = blocker_id);

revoke all on public.user_blocks from anon;
grant select, insert, delete on public.user_blocks to authenticated;

create or replace function public.is_blocked_between(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.user_blocks
     where (blocker_id = p_a and blocked_id = p_b)
        or (blocker_id = p_b and blocked_id = p_a)
  );
$fn$;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- poruke
create or replace function public.guard_blocked_message() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_staff() and public.is_blocked_between(new.sender_id, new.receiver_id) then
    raise exception 'KORISNIK_BLOKIRAN: poruke izmedju ovih korisnika su blokirane'
      using errcode = '42501', hint = 'user_blocked';
  end if;
  return new;
end $fn$;
revoke all on function public.guard_blocked_message() from public, anon, authenticated;

drop trigger if exists messages_block_gate on public.messages;
create trigger messages_block_gate before insert on public.messages
  for each row execute function public.guard_blocked_message();

-- ---------------------------------------------------------------- ponude i pitanja na oglasu
create or replace function public.guard_blocked_listing_action() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_owner uuid; v_actor uuid;
begin
  select user_id into v_owner from public.listings where id = new.listing_id;
  -- odvojene naredbe: plpgsql pripremi izraz tek kad ga izvrši, pa ne traži bidder_id na pitanjima
  if tg_table_name = 'bids' then v_actor := new.bidder_id; else v_actor := new.user_id; end if;
  if v_owner is not null and not public.is_staff() and public.is_blocked_between(v_owner, v_actor) then
    raise exception 'KORISNIK_BLOKIRAN: vlasnik posla i ovaj korisnik su blokirani'
      using errcode = '42501', hint = 'user_blocked';
  end if;
  return new;
end $fn$;
revoke all on function public.guard_blocked_listing_action() from public, anon, authenticated;

drop trigger if exists bids_block_gate on public.bids;
create trigger bids_block_gate before insert on public.bids
  for each row execute function public.guard_blocked_listing_action();

drop trigger if exists listing_questions_block_gate on public.listing_questions;
create trigger listing_questions_block_gate before insert on public.listing_questions
  for each row execute function public.guard_blocked_listing_action();

select 'Gotovo: blokiranje korisnika je uključeno.' as rezultat;

commit;
