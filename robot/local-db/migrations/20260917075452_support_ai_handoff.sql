alter table public.support_messages
  add column if not exists needs_human boolean not null default true,
  add column if not exists handoff boolean not null default false;

-- staff are pinged only for messages the assistant did not handle (needs_human) — the
-- AI hand-off calls support_handoff() explicitly with a summary
create or replace function public.on_support_message_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text;
  v_member text;
  v_staff uuid;
begin
  select public.display_name_of(full_name), member_id into v_name, v_member from public.profiles where user_id = new.user_id;

  if new.sender = 'user' and coalesce(new.needs_human, true) then
    for v_staff in
      select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name in ('ADMIN', 'MODERATOR')
    loop
      insert into public.notifications (user_id, type, title, message)
      values (v_staff, 'support', 'Nova poruka podrške — ' || coalesce(v_name, 'korisnik'), left(new.message, 200));
    end loop;

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

-- called by the support-assistant function (service role) when the AI hands a thread to a person
create or replace function public.support_handoff(p_user_id uuid, p_summary text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text;
  v_member text;
  v_staff uuid;
begin
  select public.display_name_of(full_name), member_id into v_name, v_member from public.profiles where user_id = p_user_id;
  for v_staff in
    select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name in ('ADMIN', 'MODERATOR')
  loop
    insert into public.notifications (user_id, type, title, message)
    values (v_staff, 'support', 'AI predaje razgovor — ' || coalesce(v_name, 'korisnik'), left(p_summary, 200));
  end loop;
  if (select value from public.moderation_settings where key = 'notify_admin_external') = 'true' then
    perform net.http_post(
      url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/notify-admin',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
      body := jsonb_build_object('kind', 'support', 'user_id', p_user_id, 'name', v_name, 'member_id', v_member, 'message', 'AI predaje razgovor: ' || left(p_summary, 400)),
      timeout_milliseconds := 15000
    );
  end if;
end;
$$;
revoke execute on function public.support_handoff(uuid, text) from public, anon, authenticated;;
