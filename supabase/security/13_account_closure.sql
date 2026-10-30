-- Zatvaranje naloga (sd, 30.10.2026.): privremena deaktivacija ili trajno brisanje, oboje tek uz
-- kod poslan na email naloga i obavezan razlog.
--
--   * account_closure_codes: jedan važeći kod po korisniku (samo SHA-256 otisak, nikad sam kod),
--     vrijedi 15 minuta, najviše 5 pogrešnih pokušaja. Piše i čita ga samo funkcija delete-account.
--   * account_closure_reasons: zašto ljudi odlaze. Kod brisanja user_id postaje null (ostaje samo
--     razlog), kod deaktivacije ostaje. Čita ga samo admin.
--   * Deaktiviran nalog: profiles.account_status = 'disabled'. Javni profil nestaje (public_profiles
--     i public_profile_cards prikazuju samo 'active'), objavljeni poslovi se pauziraju, ponude na čekanju
--     se povlače. Dok je deaktiviran, server odbija sve osim my_deactivation(); nalog se vraća
--     dugmetom "Ponovo aktiviraj" (funkcija delete-account, action 'reactivate').
-- Smije se pokrenuti više puta.

create table if not exists public.account_closure_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('delete', 'deactivate')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  -- najviše 5 kodova na sat
  window_start timestamptz not null default now(),
  sent_in_window int not null default 1
);
alter table public.account_closure_codes enable row level security;
revoke all on public.account_closure_codes from anon, authenticated;

create table if not exists public.account_closure_reasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  mode text not null check (mode in ('delete', 'deactivate')),
  reason text not null check (reason in ('complicated', 'no_jobs', 'no_providers', 'notifications', 'privacy', 'bad_experience', 'other_account', 'break', 'other')),
  detail text check (detail is null or char_length(detail) <= 500),
  created_at timestamptz not null default now()
);
alter table public.account_closure_reasons enable row level security;
revoke all on public.account_closure_reasons from anon;
grant select on public.account_closure_reasons to authenticated;
drop policy if exists account_closure_reasons_admin_read on public.account_closure_reasons;
create policy account_closure_reasons_admin_read on public.account_closure_reasons for select to authenticated using (public.is_admin());

-- šta je deaktivacija pauzirala, da se zna od kada je nalog ugašen
alter table public.profiles add column if not exists deactivated_at timestamptz;

create or replace function public.my_deactivation()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('since', p.deactivated_at)
  from public.profiles p
  where p.user_id = auth.uid() and p.account_status = 'disabled';
$$;
revoke execute on function public.my_deactivation() from public, anon;
grant execute on function public.my_deactivation() to authenticated;

create or replace function public.is_deactivated()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and account_status = 'disabled');
$$;
revoke execute on function public.is_deactivated() from public, anon;
grant execute on function public.is_deactivated() to authenticated, service_role;

-- isto kao security/10_suspension_lockout.sql, plus deaktiviran nalog
create or replace function public.block_suspended_request()
returns void
language plpgsql stable set search_path = public as $$
declare v_path text := coalesce(current_setting('request.path', true), '');
begin
  if auth.uid() is null then return; end if;
  if v_path like '%/rpc/my_suspension' or v_path like '%/rpc/my_deactivation' then return; end if;
  if public.is_suspended() then
    raise exception 'SUSPENDED' using errcode = '42501', hint = 'Nalog je privremeno suspendovan.';
  end if;
  if public.is_deactivated() then
    raise exception 'DEACTIVATED' using errcode = '42501', hint = 'Nalog je deaktiviran.';
  end if;
end;
$$;
revoke execute on function public.block_suspended_request() from public;
grant execute on function public.block_suspended_request() to anon, authenticated, service_role;

notify pgrst, 'reload config';
