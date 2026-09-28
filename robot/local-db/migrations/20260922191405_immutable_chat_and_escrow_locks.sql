-- NALAZ: politika messages_manage_own je bila FOR ALL, pa je posiljalac mogao
-- IZMIJENITI i OBRISATI svoju poruku. Podrska presudjuje po prepisci, a prepiska
-- se mogla prekrojiti poslije svadje. Provjereno: UI nigdje ne brise ni mijenja
-- poruke, pa ovo nista ne lomi.
drop policy if exists messages_manage_own on public.messages;

drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (auth.uid() = sender_id);

alter table public.messages
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references auth.users(id),
  add column if not exists hidden_reason text;

create or replace function public.guard_message_immutable() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'PORUKE_SE_NE_BRISU: prepiska je dokaz u sporu' using errcode = 'P0001';
  end if;
  if new.body is distinct from old.body
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.created_at is distinct from old.created_at then
    raise exception 'PORUKE_SE_NE_MIJENJAJU: prepiska je dokaz u sporu' using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists messages_immutable on public.messages;
create trigger messages_immutable before update or delete on public.messages
  for each row execute function public.guard_message_immutable();

-- Opis i cijena se ne mijenjaju dok je uplata osigurana ("pomjeranje golova").
-- Namjerno NE diram listings.status: listingService.setOutcome() ga mijenja
-- direktno s klijenta, pa bi opsta zastita slomila dugme "Oznaci kao zavrseno".
create or replace function public.guard_listing_locked_after_funding() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if exists (select 1 from public.job_payments p
              where p.listing_id = new.id and p.status in ('funded', 'requested', 'disputed'))
     and (new.title is distinct from old.title
          or new.description is distinct from old.description
          or new.price is distinct from old.price)
     and not public.is_admin() then
    raise exception 'POSAO_JE_ZAKLJUCAN: opis i cijena se ne mijenjaju dok je uplata osigurana'
      using errcode = 'P0001';
  end if;
  return new;
end $fn$;

drop trigger if exists listings_locked_after_funding on public.listings;
create trigger listings_locked_after_funding before update on public.listings
  for each row execute function public.guard_listing_locked_after_funding();;
