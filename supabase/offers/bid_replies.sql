-- ============================================================================
-- Privatni odgovori ispod ponude + obavijest kad izvođač izmijeni ponudu
-- ----------------------------------------------------------------------------
-- NIJE PRIMIJENJENO. Čeka izričito odobrenje vlasnika.
--
-- Kao Airtasker: klijent i izvođač mogu kratko razmijeniti poruke ispod JEDNE
-- ponude prije prihvatanja (pojašnjenje cijene, termina, šta je uključeno).
-- Vide ih samo njih dvoje (i tim). Pišu se samo dok je ponuda 'pending' —
-- poslije prihvatanja razgovor ide u chat. Pravilo #1 (bez kontakata) provodi
-- postojeći moderate_content(), isti kao za ponude i pitanja.
--
-- Izmjena same ponude ne treba novu dozvolu: bids_bidder_manage već pušta
-- izvođača da mijenja svoju ponudu dok je 'pending', guard_bid_status_change
-- je zaključava poslije odluke, a moderate_bids provjerava novi opis. Ovdje se
-- samo dodaje obavijest klijentu da je ponuda izmijenjena.
-- ============================================================================

create table if not exists public.bid_replies (
  id uuid primary key default gen_random_uuid(),
  bid_id uuid not null references public.bids(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists bid_replies_bid_idx on public.bid_replies (bid_id, created_at);

alter table public.bid_replies enable row level security;

-- Je li pozivalac izvođač te ponude ili vlasnik posla.
create or replace function public.is_bid_party(p_bid uuid)
returns boolean
language sql stable security definer set search_path = public as $fn$
  select exists (
    select 1 from public.bids b join public.listings l on l.id = b.listing_id
    where b.id = p_bid and auth.uid() in (b.bidder_id, l.user_id)
  );
$fn$;

revoke execute on function public.is_bid_party(uuid) from public, anon;
grant execute on function public.is_bid_party(uuid) to authenticated;

drop policy if exists bid_replies_read on public.bid_replies;
create policy bid_replies_read on public.bid_replies for select to authenticated
  using (public.is_bid_party(bid_id) or public.is_staff());

drop policy if exists bid_replies_write on public.bid_replies;
create policy bid_replies_write on public.bid_replies for insert to authenticated
  with check (
    author_id = auth.uid()
    and not public.is_suspended()
    and public.is_bid_party(bid_id)
    and exists (select 1 from public.bids b where b.id = bid_id and b.status = 'pending')
  );

-- Bez izmjene i brisanja: ono što je rečeno uz ponudu ostaje zapisano.
revoke all on public.bid_replies from anon;
grant select, insert on public.bid_replies to authenticated;

-- Pravilo #1: maskira kontakte i zabranjen sadržaj, dodijeli opomenu.
drop trigger if exists moderate_bid_replies on public.bid_replies;
create trigger moderate_bid_replies before insert on public.bid_replies
  for each row execute function public.moderate_content('author_id', 'body');

-- Kratko pojašnjenje, ne zamjena za chat: najviše 20 poruka po autoru i ponudi.
create or replace function public.limit_bid_replies()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if (select count(*) from public.bid_replies where bid_id = new.bid_id and author_id = new.author_id) >= 20 then
    raise exception 'PREVISE_ODGOVORA' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists limit_bid_replies on public.bid_replies;
create trigger limit_bid_replies before insert on public.bid_replies
  for each row execute function public.limit_bid_replies();

-- Druga strana dobije obavijest.
create or replace function public.on_bid_reply_notify()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_bidder uuid; v_owner uuid; v_listing uuid; v_title text;
begin
  select b.bidder_id, l.user_id, l.id, l.title into v_bidder, v_owner, v_listing, v_title
  from public.bids b join public.listings l on l.id = b.listing_id where b.id = new.bid_id;

  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (
    case when new.author_id = v_bidder then v_owner else v_bidder end,
    'offer_reply',
    case when new.author_id = v_bidder then 'Izvođač je odgovorio uz ponudu' else 'Klijent ti je pisao uz ponudu' end,
    coalesce(v_title, 'Posao') || ' · ' || left(new.body, 80),
    '/listings/' || v_listing::text,
    'bidreply:' || new.id::text
  ) on conflict do nothing;
  return new;
end $fn$;

drop trigger if exists bid_reply_notify on public.bid_replies;
create trigger bid_reply_notify after insert on public.bid_replies
  for each row execute function public.on_bid_reply_notify();

-- Klijent saznaje kad izvođač promijeni cijenu ili opis ponude.
create or replace function public.on_bid_edited_notify()
returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_owner uuid; v_title text;
begin
  if new.status = 'pending' and (new.amount is distinct from old.amount or new.message is distinct from old.message) then
    select user_id, title into v_owner, v_title from public.listings where id = new.listing_id;
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (
      v_owner, 'offer_updated',
      'Ponuda izmijenjena: ' || rtrim(rtrim(new.amount::text, '0'), '.') || ' KM',
      coalesce(v_title, 'Posao'),
      '/listings/' || new.listing_id::text,
      'bidupd:' || new.id::text || ':' || extract(epoch from now())::bigint::text
    ) on conflict do nothing;
  end if;
  return new;
end $fn$;

drop trigger if exists bid_edited_notify on public.bids;
create trigger bid_edited_notify after update of amount, message on public.bids
  for each row execute function public.on_bid_edited_notify();

revoke execute on function public.limit_bid_replies(), public.on_bid_reply_notify(), public.on_bid_edited_notify()
  from public, anon, authenticated;
