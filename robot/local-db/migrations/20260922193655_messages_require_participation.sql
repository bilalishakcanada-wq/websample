-- NALAZ (dokazano pozivom API-ja): politika za slanje poruke provjeravala je samo
-- `auth.uid() = sender_id`, ali NE i da je posiljalac ucesnik tog razgovora.
-- Posljedica: svaki prijavljeni korisnik mogao je ubaciti poruku u BILO CIJI
-- razgovor i, birajuci receiver_id, poslati obavijest bilo kome na platformi.
-- Rupa je starija od danasnjih izmjena (ista je bila u messages_manage_own).
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and auth.uid() in (c.participant_one, c.participant_two)
         -- primalac mora biti druga strana istog razgovora
         and receiver_id in (c.participant_one, c.participant_two)
         and receiver_id <> sender_id
    )
  );

-- Ista provjera i u trigeru: RLS ne vrijedi za service_role ni za pozive iz
-- SECURITY DEFINER funkcija, pa brana mora postojati i tu.
create or replace function public.guard_chat_lifecycle() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare v_state text; v_conv public.conversations;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;
  if v_conv.id is null then
    raise exception 'NEMA_RAZGOVORA' using errcode = 'P0001';
  end if;

  if not public.is_staff() then
    if new.sender_id not in (v_conv.participant_one, v_conv.participant_two)
       or new.receiver_id not in (v_conv.participant_one, v_conv.participant_two)
       or new.receiver_id = new.sender_id then
      raise exception 'NISI_UCESNIK_RAZGOVORA' using errcode = '42501';
    end if;

    v_state := public.chat_state(new.conversation_id);
    if v_state = 'locked' then
      raise exception 'CHAT_JOS_NIJE_OTVOREN: dopisivanje pocinje kada klijent prihvati ponudu i osigura uplatu. Do tada koristi javna pitanja na oglasu.'
        using errcode = '42501', hint = 'chat_locked';
    elsif v_state = 'readonly' then
      raise exception 'CHAT_JE_ZAKLJUCAN: posao je namiren, prepiska ostaje dostupna samo za citanje. Ako ima spora, otvori ga na stranici posla.'
        using errcode = '42501', hint = 'chat_readonly';
    end if;
  end if;
  return new;
end $fn$;;
