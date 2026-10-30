-- Poruka sa stranice Kontakt dođe do tima: obavijest (zvonce) svakom adminu i, kad je
-- notify_admin_external uključen, email/Telegram preko funkcije notify-admin (s adresom za odgovor).
-- Do sada su ove poruke samo stajale u tabeli contact_messages i niko ih nije vidio.

create or replace function public.on_contact_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_admin uuid;
begin
  for v_admin in
    select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name = 'ADMIN'
  loop
    insert into public.notifications (user_id, type, title, message)
    values (v_admin, 'support', 'Nova poruka s Kontakt stranice: ' || new.name, left(new.message, 200));
  end loop;

  if (select value from public.moderation_settings where key = 'notify_admin_external') = 'true' then
    perform net.http_post(
      url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/notify-admin',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
      body := jsonb_build_object('kind', 'contact', 'user_id', new.user_id, 'name', new.name, 'email', new.email, 'message', left(new.message, 2000)),
      timeout_milliseconds := 15000
    );
  end if;
  return new;
end;
$$;

create or replace trigger contact_message_notify after insert on public.contact_messages
  for each row execute function public.on_contact_message_notify();
