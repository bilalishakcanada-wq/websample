-- ============================================================
-- In-app notifications for support: admins get one per incoming
-- support message, users get one per admin reply. External delivery
-- (Telegram / email) goes through the notify-admin Edge Function.
-- ============================================================
insert into public.moderation_settings (key, value) values ('notify_admin_external', 'true') on conflict (key) do nothing;

create or replace function public.on_support_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text;
  v_member text;
  v_admin uuid;
begin
  select public.display_name_of(full_name), member_id into v_name, v_member from public.profiles where user_id = new.user_id;

  if new.sender = 'user' then
    for v_admin in
      select ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name = 'ADMIN'
    loop
      insert into public.notifications (user_id, type, title, message)
      values (v_admin, 'support', 'Nova poruka podrške — ' || coalesce(v_name, 'korisnik'), left(new.message, 200));
    end loop;

    -- external ping (Telegram / email) — the function decides what is configured
    if (select value from public.moderation_settings where key = 'notify_admin_external') = 'true' then
      perform net.http_post(
        url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/notify-admin',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
        body := jsonb_build_object('kind', 'support', 'user_id', new.user_id, 'name', v_name, 'member_id', v_member, 'message', left(new.message, 500)),
        timeout_milliseconds := 15000
      );
    end if;
  elsif new.sender = 'admin' then
    insert into public.notifications (user_id, type, title, message)
    values (new.user_id, 'support_reply', 'Podrška je odgovorila', left(new.message, 200));
  end if;
  return new;
end;
$$;
revoke execute on function public.on_support_message_notify() from public, anon, authenticated;
drop trigger if exists support_message_notify on public.support_messages;
create trigger support_message_notify after insert on public.support_messages
  for each row execute function public.on_support_message_notify();

-- Admins also get pinged when the moderation engine suspends someone or the AI flags an account.
create or replace function public.on_moderation_event_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text;
  v_admin uuid;
begin
  if new.action not in ('suspended', 'flagged') then return new; end if;
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.user_id;
  for v_admin in
    select ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name = 'ADMIN'
  loop
    insert into public.notifications (user_id, type, title, message)
    values (v_admin, 'moderation', case when new.action = 'suspended' then 'Nalog suspendovan — ' else 'AI označio nalog — ' end || coalesce(v_name, 'korisnik'), left(coalesce(new.snippet, ''), 200));
  end loop;
  if (select value from public.moderation_settings where key = 'notify_admin_external') = 'true' then
    perform net.http_post(
      url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/notify-admin',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
      body := jsonb_build_object('kind', 'moderation', 'user_id', new.user_id, 'name', v_name, 'action', new.action, 'message', left(coalesce(new.snippet, ''), 500)),
      timeout_milliseconds := 15000
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.on_moderation_event_notify() from public, anon, authenticated;
drop trigger if exists moderation_event_notify on public.moderation_events;
create trigger moderation_event_notify after insert on public.moderation_events
  for each row execute function public.on_moderation_event_notify();

-- Admin view of all conversations with participants
create or replace function public.admin_conversations(p_limit integer default 100)
returns table (
  id uuid, listing_id uuid, listing_title text, created_at timestamptz,
  one_id uuid, one_name text, one_member text, two_id uuid, two_name text, two_member text,
  message_count bigint, last_message text, last_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.listing_id, l.title, c.created_at,
         c.participant_one, p1.full_name, p1.member_id,
         c.participant_two, p2.full_name, p2.member_id,
         (select count(*) from public.messages m where m.conversation_id = c.id),
         (select m.content from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1),
         (select max(m.created_at) from public.messages m where m.conversation_id = c.id)
  from public.conversations c
  left join public.listings l on l.id = c.listing_id
  left join public.profiles p1 on p1.user_id = c.participant_one
  left join public.profiles p2 on p2.user_id = c.participant_two
  where public.is_admin()
  order by coalesce((select max(m.created_at) from public.messages m where m.conversation_id = c.id), c.created_at) desc
  limit greatest(1, least(p_limit, 500));
$$;
revoke execute on function public.admin_conversations(integer) from public, anon;
grant execute on function public.admin_conversations(integer) to authenticated;

-- support threads with names / IDs
create or replace function public.admin_support_threads()
returns table (user_id uuid, full_name text, member_id text, email text, last_message text, last_sender text, last_at timestamptz, unread bigint)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, p.full_name, p.member_id, p.email,
         (select message from public.support_messages x where x.user_id = s.user_id order by created_at desc limit 1),
         (select sender from public.support_messages x where x.user_id = s.user_id order by created_at desc limit 1),
         max(s.created_at),
         count(*) filter (where s.sender = 'user' and s.read_at is null)
  from public.support_messages s
  left join public.profiles p on p.user_id = s.user_id
  where public.is_admin()
  group by s.user_id, p.full_name, p.member_id, p.email
  order by max(s.created_at) desc;
$$;
revoke execute on function public.admin_support_threads() from public, anon;
grant execute on function public.admin_support_threads() to authenticated;;
