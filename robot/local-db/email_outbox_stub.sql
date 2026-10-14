-- The live mail outbox (Resend, send-transactional-email) is not part of the local test database.
-- This stand-in has the same shape, so supabase/communication/03_email_confirmation.sql applies here
-- and the app's email-confirmation calls answer as they do live. Nothing is sent: no edge functions run locally.
create schema if not exists zadatak_private;
create table if not exists zadatak_private.transactional_email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source_id uuid not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  recipient_email text not null,
  payload_data jsonb not null default '{}'::jsonb,
  mail_request jsonb,
  status text not null default 'queued',
  attempts integer not null default 0,
  claim_id uuid,
  lease_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 days',
  finished_at timestamptz,
  provider_id text,
  error_code text,
  unique (event_type, source_id, recipient_id)
);
create or replace function zadatak_private.dispatch_transactional_emails(p_event_id uuid default null)
returns integer language sql as $$ select 0 $$;
