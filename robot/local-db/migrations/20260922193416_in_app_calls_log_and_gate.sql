-- MODUL 2 — audio/video pozivi unutar aplikacije.
--
-- Signalizacija (SDP/ICE) ide preko Supabase Realtime broadcast kanala:
-- prolazna je po prirodi i ne treba je cuvati, a izbjegava se poseban
-- Socket.io server koji bi trebalo postaviti, cuvati i osiguravati.
-- U bazi ostaju SAMO metapodaci poziva — oni su dokaz u sporu.
--
-- NAPOMENA O INFRASTRUKTURI: peer-to-peer ne prolazi uvijek. Iza simetricnog
-- NAT-a (dio mobilnih mreza) treba TURN relej, koji je placen servis
-- (Cloudflare Calls, Twilio, Metered) ili vlastiti coturn. Bez TURN-a dio
-- poziva nece uspjeti — tipicno 10-20 %.

do $$ begin
  create type call_kind as enum ('audio', 'video');
  create type call_state as enum ('ringing', 'active', 'ended', 'missed', 'declined', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.calls (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id      uuid references public.listings(id) on delete set null,
  caller_id       uuid not null references auth.users(id),
  callee_id       uuid not null references auth.users(id),
  kind            call_kind not null,
  state           call_state not null default 'ringing',
  started_at      timestamptz not null default now(),
  answered_at     timestamptz,
  ended_at        timestamptz,
  duration_sec    integer,
  end_reason      text,
  used_relay      boolean,              -- je li poziv morao preko TURN-a
  created_at      timestamptz not null default now(),
  constraint calls_not_self check (caller_id <> callee_id)
);

create index if not exists calls_conversation_idx on public.calls (conversation_id, started_at desc);
create index if not exists calls_party_idx on public.calls (caller_id, callee_id, started_at desc);

alter table public.calls enable row level security;

drop policy if exists calls_party_read on public.calls;
create policy calls_party_read on public.calls for select to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid() or public.is_staff());
-- bez INSERT/UPDATE politike: sve ide kroz RPC ispod

-- Poziv se moze zapoceti SAMO dok je posao u toku (isto pravilo kao chat).
create or replace function public.start_call(p_conversation uuid, p_kind call_kind)
returns public.calls
language plpgsql security definer set search_path = public as $fn$
declare v_conv public.conversations; v_state text; v_callee uuid; v_row public.calls; v_recent int;
begin
  select * into v_conv from public.conversations where id = p_conversation;
  if v_conv.id is null then raise exception 'NEMA_RAZGOVORA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_conv.participant_one, v_conv.participant_two) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_state := public.chat_state(p_conversation);
  if v_state <> 'open' then
    raise exception 'POZIVI_NISU_DOSTUPNI: pozivi rade samo dok je posao u toku (stanje: %)', v_state
      using errcode = '42501', hint = 'calls_' || v_state;
  end if;

  -- ogranicenje ucestalosti: sprjecava uznemiravanje uzastopnim zvonjenjem
  select count(*) into v_recent from public.calls
   where caller_id = auth.uid() and started_at > now() - interval '5 minutes';
  if v_recent >= 5 then
    raise exception 'PREVISE_POZIVA: sacekaj nekoliko minuta prije novog poziva'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;

  -- samo jedan aktivan poziv po razgovoru
  update public.calls set state = 'missed', ended_at = now(), end_reason = 'novi poziv'
   where conversation_id = p_conversation and state in ('ringing', 'active');

  v_callee := case when auth.uid() = v_conv.participant_one
                   then v_conv.participant_two else v_conv.participant_one end;

  insert into public.calls (conversation_id, listing_id, caller_id, callee_id, kind)
  values (p_conversation, v_conv.listing_id, auth.uid(), v_callee, p_kind)
  returning * into v_row;

  insert into public.notifications (user_id, type, title, message, link)
  values (v_callee, 'message',
          case when p_kind = 'video' then 'Video poziv' else 'Audio poziv' end,
          'Druga strana te zove u vezi posla.', '/messages');
  return v_row;
end $fn$;

-- Oznacavanje odgovora/zavrsetka. Trajanje racuna baza, ne klijent.
create or replace function public.update_call(
  p_call uuid, p_state call_state, p_reason text default null, p_used_relay boolean default null
) returns public.calls
language plpgsql security definer set search_path = public as $fn$
declare v_row public.calls;
begin
  select * into v_row from public.calls where id = p_call for update;
  if v_row.id is null then raise exception 'NEMA_POZIVA' using errcode = 'P0001'; end if;
  if auth.uid() not in (v_row.caller_id, v_row.callee_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_row.state in ('ended', 'missed', 'declined', 'failed') then
    return v_row;                                   -- vec zavrsen, ne diramo
  end if;

  update public.calls
     set state = p_state,
         answered_at = case when p_state = 'active' and answered_at is null then now() else answered_at end,
         ended_at = case when p_state in ('ended','missed','declined','failed') then now() else ended_at end,
         duration_sec = case when p_state in ('ended','missed','declined','failed')
                             then greatest(0, extract(epoch from (now() - coalesce(answered_at, now())))::int)
                             else duration_sec end,
         end_reason = coalesce(p_reason, end_reason),
         used_relay = coalesce(p_used_relay, used_relay)
   where id = p_call
  returning * into v_row;
  return v_row;
end $fn$;

grant execute on function public.start_call(uuid, call_kind) to authenticated;
grant execute on function public.update_call(uuid, call_state, text, boolean) to authenticated;;
