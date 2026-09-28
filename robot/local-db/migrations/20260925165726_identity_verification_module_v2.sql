-- Verifikacija identiteta: JMBG + dokument -> rucna provjera -> odobrenje.
-- pgcrypto zivi u shemi `extensions`, pa se search_path mora navesti.
do $$ begin
  create type verif_state as enum ('draft','submitted','in_review','approved','rejected','expired');
  create type doc_kind as enum ('licna_karta','pasos','vozacka');
exception when duplicate_object then null; end $$;

do $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'jmbg_key';
  if v_id is null then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'jmbg_key', 'Kljuc za sifrovanje JMBG-a');
  end if;
end $$;

create or replace function public.jmbg_key() returns text
language sql stable security definer set search_path = vault, extensions, public as $fn$
  select decrypted_secret from vault.decrypted_secrets where name = 'jmbg_key' limit 1;
$fn$;
revoke execute on function public.jmbg_key() from anon, authenticated;

create or replace function public.jmbg_fingerprint(p_jmbg text) returns text
language sql stable security definer set search_path = extensions, public as $fn$
  select encode(extensions.digest(regexp_replace(coalesce(p_jmbg,''), '\D', '', 'g') || public.jmbg_key(), 'sha256'), 'hex');
$fn$;
revoke execute on function public.jmbg_fingerprint(text) from anon, authenticated;

create table if not exists public.identity_verifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  state          verif_state not null default 'draft',
  full_name      text not null,
  jmbg_enc       bytea,
  jmbg_fp        text,
  birth_date     date,
  gender         text,
  region_code    smallint,
  doc_type       doc_kind,
  doc_number     text,
  doc_front_path text,
  doc_back_path  text,
  selfie_path    text,
  auto_checks    jsonb not null default '{}',
  risk_flags     text[] not null default '{}',
  claimed_by     uuid references auth.users(id),
  claimed_until  timestamptz,
  reviewed_by    uuid references auth.users(id),
  reviewed_at    timestamptz,
  reject_reason  text,
  submitted_at   timestamptz,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists idv_one_open_idx on public.identity_verifications (user_id)
  where state not in ('approved','rejected','expired');
create unique index if not exists idv_unique_jmbg_idx on public.identity_verifications (jmbg_fp)
  where state = 'approved' and jmbg_fp is not null;
create index if not exists idv_queue_idx on public.identity_verifications (state, submitted_at)
  where state in ('submitted','in_review');

alter table public.identity_verifications enable row level security;
drop policy if exists idv_own_read on public.identity_verifications;
create policy idv_own_read on public.identity_verifications for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
revoke insert, update, delete on public.identity_verifications from authenticated, anon;
-- sifrovani broj ne smije izaci ni kroz SELECT vlastitog reda
revoke select (jmbg_enc) on public.identity_verifications from authenticated, anon;

alter table public.profiles
  add column if not exists identity_state verif_state not null default 'draft',
  add column if not exists identity_approved_at timestamptz;

create table if not exists public.verification_policy (
  id                 boolean primary key default true check (id),
  require_for_bids   boolean not null default true,
  require_for_jobs   boolean not null default true,
  require_for_chat   boolean not null default false,
  grandfather_before timestamptz,
  updated_at         timestamptz not null default now()
);
insert into public.verification_policy (id, grandfather_before)
values (true, now()) on conflict (id) do nothing;

alter table public.verification_policy enable row level security;
drop policy if exists verif_policy_read on public.verification_policy;
create policy verif_policy_read on public.verification_policy for select to authenticated using (true);
revoke insert, update, delete on public.verification_policy from authenticated, anon;

comment on table public.verification_policy is
  'Prekidaci: sta tacno trazi verifikaciju. grandfather_before stiti postojece naloge '
  'da im se platforma ne zakljuca preko noci.';;
