-- ISPRAVKA GRESKE KOJU SAM UVEO: listings -> conversations -> messages su svi
-- ON DELETE CASCADE. Kad korisnik obrise svoj oglas, kaskada pokusa obrisati
-- poruke, a guard je to odbijao i rusio cijelo brisanje. Posljedica: korisnici
-- nisu mogli obrisati oglas koji ima razgovor. (Uhvatio E2E test.)
--
-- Rjesenje: kod kaskade je roditeljski razgovor vec obrisan u istoj naredbi, pa
-- se to moze razlikovati od direktnog brisanja poruke od strane korisnika.
create or replace function public.guard_message_immutable() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    -- kaskada (obrisan razgovor/oglas) je dozvoljena; direktno brisanje poruke nije
    if exists (select 1 from public.conversations c where c.id = old.conversation_id) then
      raise exception 'PORUKE_SE_NE_BRISU: prepiska je dokaz u sporu' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if new.content is distinct from old.content
     or new.sender_id is distinct from old.sender_id
     or new.receiver_id is distinct from old.receiver_id
     or new.conversation_id is distinct from old.conversation_id
     or new.attachment_url is distinct from old.attachment_url
     or new.created_at is distinct from old.created_at then
    raise exception 'PORUKE_SE_NE_MIJENJAJU: prepiska je dokaz u sporu' using errcode = 'P0001';
  end if;
  return new;
end $fn$;;
