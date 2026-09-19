-- =========================================================================
-- Poso.ba — Web Push notifications
--   * push_subscriptions: one row per browser/device the user allowed
--   * notifications.link / dedupe_key: where a notification opens + debounce
--   * new in-app notifications for messages and offers
--   * every notifications insert fans out to the send-push edge function
--   * VAPID private key lives in Supabase Vault (vapid_private_jwk); the
--     public key is in moderation_settings (vapid_public_key) and in the app
-- =========================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- upsert from the browser (endpoint is the device identity)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, last_used_at = now();
end $$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- ---------- notifications: link + dedupe ----------
alter table public.notifications add column if not exists link text;
alter table public.notifications add column if not exists dedupe_key text;
create index if not exists notifications_dedupe_idx on public.notifications(user_id, dedupe_key, created_at desc);

-- ---------- new message -> notification for the receiver (debounced per conversation) ----------
create or replace function public.on_message_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_key text;
begin
  if new.receiver_id is null or new.receiver_id = new.sender_id then return new; end if;
  v_key := 'msg:' || new.conversation_id::text;
  -- one unread notification per conversation is enough
  if exists (select 1 from public.notifications where user_id = new.receiver_id and dedupe_key = v_key and read_at is null and created_at > now() - interval '6 hours') then
    return new;
  end if;
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.sender_id;
  insert into public.notifications (user_id, type, title, message, link, dedupe_key)
  values (new.receiver_id, 'message', 'Nova poruka — ' || coalesce(v_name, 'korisnik'), left(new.content, 140), '/messages?c=' || new.conversation_id::text, v_key);
  return new;
end $$;
drop trigger if exists on_message_notify on public.messages;
create trigger on_message_notify after insert on public.messages for each row execute function public.on_message_notify();

-- ---------- new offer -> notification for the job owner; accepted -> for the bidder ----------
create or replace function public.on_bid_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_name text; v_amount text;
begin
  select user_id, title into v_owner, v_title from public.listings where id = new.listing_id;
  v_amount := case when new.amount is null then '?' else rtrim(rtrim(new.amount::text, '0'), '.') end;
  if TG_OP = 'INSERT' then
    if v_owner is null or v_owner = new.bidder_id then return new; end if;
    select public.display_name_of(full_name) into v_name from public.profiles where user_id = new.bidder_id;
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (v_owner, 'offer', 'Nova ponuda: ' || v_amount || ' KM', coalesce(v_name, 'Izvođač') || ' · ' || coalesce(v_title, ''), '/listings/' || new.listing_id::text, 'bid:' || new.id::text);
  elsif TG_OP = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (user_id, type, title, message, link, dedupe_key)
    values (new.bidder_id, 'offer_accepted', 'Ponuda prihvaćena 🎉', coalesce(v_title, 'Posao') || ' — uplata je osigurana, možeš početi.', '/listings/' || new.listing_id::text, 'bidacc:' || new.id::text);
  end if;
  return new;
end $$;
drop trigger if exists on_bid_notify on public.bids;
create trigger on_bid_notify after insert or update of status on public.bids for each row execute function public.on_bid_notify();

-- ---------- fan-out: every notification -> send-push (only if the user has a device) ----------
create or replace function public.on_notification_push()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then return new; end if;
  if exists (select 1 from public.profiles where user_id = new.user_id and notify_push = false) then return new; end if;
  perform net.http_post(
    url := 'https://kshzsnceukbpwpgpicsh.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sweep-key', (select value from public.moderation_settings where key = 'sweep_key')),
    body := jsonb_build_object('notification_id', new.id, 'user_id', new.user_id, 'type', new.type, 'title', new.title, 'message', new.message, 'link', new.link),
    timeout_milliseconds := 10000
  );
  return new;
end $$;
drop trigger if exists on_notification_push on public.notifications;
create trigger on_notification_push after insert on public.notifications for each row execute function public.on_notification_push();

-- ---------- keys ----------
-- select vault.create_secret('<private JWK json>', 'vapid_private_jwk');
-- insert into public.moderation_settings (key, value) values ('vapid_public_key', '<raw base64url>');
create or replace function public.vapid_private_jwk()
returns text language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_jwk' limit 1;
$$;
revoke execute on function public.vapid_private_jwk() from public, anon, authenticated;
grant execute on function public.vapid_private_jwk() to service_role;
