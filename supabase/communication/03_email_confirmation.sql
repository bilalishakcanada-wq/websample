-- Email confirmation for Google (and any other OAuth) sign-ups.
--
-- Email + password sign-ups are confirmed by Supabase Auth itself ("Confirm email" in the
-- dashboard). Google marks its own address as confirmed, so Supabase sends nothing; this adds
-- our own link, sent through the Resend outbox (send-transactional-email, event EMAIL_CONFIRM).
-- Only accounts created after this runs are asked: the trigger adds a pending row at sign-up.

create table if not exists zadatak_private.email_confirmations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text,
  token_expires_at timestamptz,
  last_sent_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table zadatak_private.email_confirmations enable row level security;
revoke all on zadatak_private.email_confirmations from anon, authenticated;

create or replace function zadatak_private.on_oauth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'email' then
    insert into zadatak_private.email_confirmations(user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_needs_email_confirmation on auth.users;
create trigger on_auth_user_needs_email_confirmation after insert on auth.users
  for each row execute function zadatak_private.on_oauth_user_created();

-- The outbox learns the new mail type; the confirmation goes out even with email notifications off.
alter table zadatak_private.transactional_email_outbox drop constraint if exists transactional_email_outbox_event_type_check;
alter table zadatak_private.transactional_email_outbox add constraint transactional_email_outbox_event_type_check
  check (event_type = any (array['JOB_PUBLISHED','NEW_BID_RECEIVED','JOB_ACCEPTED','JOB_COMPLETED','NEW_MESSAGE','NOTIFICATION','EMAIL_CONFIRM']));

create or replace function zadatak_private.queue_transactional_email(p_type text, p_source uuid, p_recipient uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_email text; v_id uuid;
begin
  -- Never use profiles.email: users can edit it independently of verified Auth.
  select email into v_email from auth.users where id=p_recipient and email_confirmed_at is not null;
  if coalesce(v_email,'')='' or (p_type <> 'EMAIL_CONFIRM'
    and exists(select 1 from public.profiles where user_id=p_recipient and notify_email=false)) then return; end if;
  insert into zadatak_private.transactional_email_outbox(event_type,source_id,recipient_id,recipient_email,payload_data)
    values(p_type,p_source,p_recipient,v_email,p_data)
    on conflict(event_type,source_id,recipient_id) do nothing returning id into v_id;
  if v_id is not null then perform zadatak_private.dispatch_transactional_emails(v_id); end if;
end $function$;

create or replace function zadatak_private.claim_transactional_email(p_id uuid, p_type text, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_row zadatak_private.transactional_email_outbox;
begin
  select * into v_row from zadatak_private.transactional_email_outbox where id=p_id for update;
  if not found or v_row.event_type is distinct from p_type or v_row.recipient_email is distinct from p_email
    or v_row.status not in('queued','processing') or (v_row.lease_until is not null and v_row.lease_until>now()) then return null; end if;
  if v_row.expires_at<=now() or v_row.attempts>=8 then
    update zadatak_private.transactional_email_outbox set status='failed',error_code='RETRY_EXHAUSTED',finished_at=now() where id=p_id;
    return null;
  end if;
  if not exists(select 1 from auth.users where id=v_row.recipient_id and email=v_row.recipient_email and email_confirmed_at is not null)
    or (v_row.event_type <> 'EMAIL_CONFIRM' and exists(select 1 from public.profiles where user_id=v_row.recipient_id and notify_email=false)) then
    update zadatak_private.transactional_email_outbox set status='skipped',error_code='RECIPIENT_UNAVAILABLE',finished_at=now() where id=p_id;
    return null;
  end if;
  update zadatak_private.transactional_email_outbox set status='processing',claim_id=gen_random_uuid(),
    lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=p_id returning * into v_row;
  return to_jsonb(v_row);
end $function$;

-- { pending, sent } for the signed-in account: the app shows the "confirm your email" screen while pending.
create or replace function public.email_confirmation_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('pending', c.user_id is not null, 'sent', c.last_sent_at is not null)
  from (select 1) one
  left join zadatak_private.email_confirmations c on c.user_id = auth.uid() and c.confirmed_at is null;
$$;

-- Sends (or re-sends) the confirmation link: 'sent', 'wait' (one mail a minute) or 'not_needed'.
create or replace function public.send_email_confirmation()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_row zadatak_private.email_confirmations; v_token text;
begin
  select * into v_row from zadatak_private.email_confirmations
    where user_id = auth.uid() and confirmed_at is null for update;
  if not found then return 'not_needed'; end if;
  if v_row.last_sent_at > now() - interval '1 minute' then return 'wait'; end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update zadatak_private.email_confirmations set
    token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
    token_expires_at = now() + interval '24 hours', last_sent_at = now()
    where user_id = v_row.user_id;
  perform zadatak_private.queue_transactional_email('EMAIL_CONFIRM', gen_random_uuid(), v_row.user_id,
    jsonb_build_object('token', v_token));
  return 'sent';
end $$;

-- The link from the mail; works signed out too (the mail may be opened on another device).
create or replace function public.confirm_email(p_token text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return false; end if;
  update zadatak_private.email_confirmations set confirmed_at = now(), token_hash = null, token_expires_at = null
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and token_expires_at > now() and confirmed_at is null;
  return found;
end $$;

-- Database rules that need a confirmed email also wait for this link.
create or replace function public.is_email_verified()
returns boolean language sql security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and email_confirmed_at is not null
  ) and not exists (
    select 1 from zadatak_private.email_confirmations
    where user_id = auth.uid() and confirmed_at is null
  );
$$;

revoke all on function public.email_confirmation_status(), public.send_email_confirmation(), public.confirm_email(text) from public, anon;
grant execute on function public.email_confirmation_status(), public.send_email_confirmation() to authenticated;
grant execute on function public.confirm_email(text) to anon, authenticated;
