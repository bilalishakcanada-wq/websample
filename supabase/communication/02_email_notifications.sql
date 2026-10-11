-- Zadatak — obavijesti mailom (nova ponuda, prihvaćena ponuda, poruka, uplata…)
--
-- Svaka obavijest u aplikaciji (public.notifications) čija vrsta zaslužuje mail ide i na mail,
-- preko Edge funkcije send-email, osim ako je korisnik isključio mailove (profiles.notify_email).
-- Funkcija sama pazi na učestalost (isti mail najviše jednom u 15 minuta, 20 dnevno) i bilježi
-- svako slanje u email_log. Dok send-email nema pošiljaoca (SMTP_* ili RESEND_API_KEY),
-- samo odgovori "no sender" i ništa se ne šalje.
--
-- Pokreće se jednom, u cjelini. Ponovno pokretanje ništa ne kvari.

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid,
  type text not null,
  link text not null default '',
  variant text,
  status text not null default 'sent',
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists email_log_user_type_link_idx on public.email_log (user_id, type, link, sent_at desc);
create index if not exists email_log_user_sent_idx on public.email_log (user_id, sent_at desc);

-- samo servisna uloga (Edge funkcija) čita i piše
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

create or replace function public.on_notification_email()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.type is null or new.type not in (
    'offer', 'offer_accepted', 'offer_rejected', 'quote_request', 'message', 'job', 'task_expired',
    'task_alert', 'wallet', 'review', 'badge', 'moderation', 'support', 'support_reply'
  ) then return new; end if;
  if exists (select 1 from public.profiles where user_id = new.user_id and notify_email = false) then return new; end if;
  perform net.http_post(
    url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
    body := jsonb_build_object('notification_id', new.id, 'user_id', new.user_id, 'type', new.type, 'title', new.title, 'message', new.message, 'link', new.link),
    timeout_milliseconds := 10000
  );
  return new;
end $$;
revoke execute on function public.on_notification_email() from public, anon, authenticated;

drop trigger if exists on_notification_email on public.notifications;
create trigger on_notification_email after insert on public.notifications
  for each row execute function public.on_notification_email();
