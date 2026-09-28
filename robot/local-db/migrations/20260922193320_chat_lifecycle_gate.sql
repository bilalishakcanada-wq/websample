-- MODUL 1 — chat vezan za zivotni ciklus posla.
--
-- Gdje se ovo provjerava: u bazi, ne u Node middlewareu. Frontend salje INSERT
-- direktno na PostgREST (messageService.send), pa bi svaki sloj iznad baze
-- napadac jednostavno preskocio.
--
-- Stanja:
--   'locked'   pred-faza: ponuda jos nije prihvacena i novac nije u escrowu
--   'open'     posao je u toku
--   'readonly' posao zavrsen ili otkazan: prepiska se cita, ali se ne dopisuje
--
-- Razgovori bez oglasa (podrska, direktne poruke) ostaju otvoreni.
create or replace function public.chat_state(p_conversation uuid)
returns text
language sql stable security definer set search_path = public as $fn$
  select case
    when c.listing_id is null then 'open'
    when jp.id is null then
      case when exists (
        select 1 from public.bids b
         where b.listing_id = c.listing_id and b.status = 'accepted'
           and b.bidder_id in (c.participant_one, c.participant_two)
      ) then 'open' else 'locked' end
    when jp.status in ('funded', 'requested', 'disputed') then 'open'
    else 'readonly'
  end
  from public.conversations c
  left join public.job_payments jp on jp.listing_id = c.listing_id
  where c.id = p_conversation;
$fn$;

comment on function public.chat_state(uuid) is
  'open = dopisivanje dozvoljeno, readonly = samo citanje (posao namiren), locked = pred-faza.';

create or replace function public.guard_chat_lifecycle() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_state text;
begin
  if public.is_staff() then return new; end if;     -- podrska smije pisati uvijek

  v_state := public.chat_state(new.conversation_id);

  if v_state = 'locked' then
    raise exception 'CHAT_JOS_NIJE_OTVOREN: dopisivanje pocinje kada klijent prihvati ponudu i osigura uplatu. Do tada koristi javna pitanja na oglasu.'
      using errcode = '42501', hint = 'chat_locked';
  elsif v_state = 'readonly' then
    raise exception 'CHAT_JE_ZAKLJUCAN: posao je namiren, prepiska ostaje dostupna samo za citanje. Ako ima spora, otvori ga na stranici posla.'
      using errcode = '42501', hint = 'chat_readonly';
  end if;
  return new;
end $fn$;

-- BEFORE INSERT, prije moderacije sadrzaja: nema smisla filtrirati poruku
-- koja uopste ne smije nastati
drop trigger if exists messages_lifecycle_gate on public.messages;
create trigger messages_lifecycle_gate before insert on public.messages
  for each row execute function public.guard_chat_lifecycle();

-- Frontend cita stanje da zna hoce li prikazati polje za pisanje ili natpis
grant execute on function public.chat_state(uuid) to authenticated;;
