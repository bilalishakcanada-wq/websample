-- ISPRAVKA: prethodna verzija je referencirala new.body, a kolona se zove content.
-- Trigger bi pucao pri SVAKOM update-u poruke (npr. oznacavanje procitanom).
-- Dozvoljeno je mijenjati samo read_at i polja za skrivanje; sadrzaj nikad.
create or replace function public.guard_message_immutable() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'PORUKE_SE_NE_BRISU: prepiska je dokaz u sporu' using errcode = 'P0001';
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
