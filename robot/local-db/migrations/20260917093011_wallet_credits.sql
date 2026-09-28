-- Credits wallet: every change is a ledger row; profiles.balance is the running total.
alter table public.profiles add column if not exists balance numeric(12, 2) not null default 0;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount <> 0),
  balance_after numeric(12, 2) not null,
  kind text not null check (kind in ('admin_credit', 'admin_debit', 'bonus', 'refund', 'fee', 'payout', 'purchase', 'promo')),
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_idx on public.wallet_transactions (user_id, created_at desc);
alter table public.wallet_transactions enable row level security;
drop policy if exists wallet_transactions_read on public.wallet_transactions;
create policy wallet_transactions_read on public.wallet_transactions for select using (user_id = auth.uid() or public.is_staff());
-- no insert/update/delete policies: the ledger is written only through admin_adjust_balance()

-- users can never change their own balance
create or replace function public.protect_profile_system_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('poso.system_write', true), '') <> '1'
     and auth.role() is distinct from 'service_role'
     and not public.is_admin() then
    new.subscription_status := old.subscription_status;
    new.account_status := old.account_status;
    new.suspended_until := old.suspended_until;
    new.suspension_reason := old.suspension_reason;
    new.member_id := old.member_id;
    new.verified_trade := old.verified_trade;
    new.created_at := old.created_at;
    new.ai_assessment := old.ai_assessment;
    new.ai_assessed_at := old.ai_assessed_at;
    new.balance := old.balance;
    if new.onboarding_completed and not public.is_valid_full_name(new.full_name) then
      raise exception 'FULL_NAME_INVALID: full name must contain a first and a last name' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

-- admin adds (positive) or removes (negative) credits; the user gets a notification
create or replace function public.admin_adjust_balance(p_user_id uuid, p_amount numeric, p_kind text default 'admin_credit', p_note text default null)
returns public.wallet_transactions language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric(12, 2);
  v_row public.wallet_transactions;
  v_kind text := coalesce(p_kind, case when p_amount >= 0 then 'admin_credit' else 'admin_debit' end);
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then raise exception 'BAD_AMOUNT'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user_id) then raise exception 'NO_PROFILE'; end if;

  perform set_config('poso.system_write', '1', true);
  update public.profiles set balance = round(balance + p_amount, 2) where user_id = p_user_id returning balance into v_balance;
  perform set_config('poso.system_write', '', true);
  if v_balance < 0 then raise exception 'INSUFFICIENT' using errcode = 'P0001'; end if;

  insert into public.wallet_transactions (user_id, amount, balance_after, kind, note, actor_id)
  values (p_user_id, round(p_amount, 2), v_balance, v_kind, nullif(btrim(p_note), ''), auth.uid())
  returning * into v_row;

  insert into public.notifications (user_id, type, title, message)
  values (p_user_id, 'wallet',
          case when p_amount > 0 then 'Dodano ti je ' || trim(to_char(p_amount, 'FM999G999D00')) || ' KM kredita' else 'Skinuto ' || trim(to_char(abs(p_amount), 'FM999G999D00')) || ' KM kredita' end,
          coalesce(nullif(btrim(p_note), ''), 'Poso.ba tim') || ' · novo stanje: ' || trim(to_char(v_balance, 'FM999G999D00')) || ' KM');
  perform public.log_staff_action('wallet_adjust', p_user_id, jsonb_build_object('amount', p_amount, 'kind', v_kind, 'note', p_note, 'balance_after', v_balance));
  return v_row;
end;
$$;
revoke execute on function public.admin_adjust_balance(uuid, numeric, text, text) from public, anon;

-- the user's own wallet: balance, stats and the ledger in one call
create or replace function public.my_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', (select balance from public.profiles where user_id = auth.uid()),
    'credited_total', (select coalesce(sum(amount), 0) from public.wallet_transactions where user_id = auth.uid() and amount > 0),
    'spent_total', (select coalesce(-sum(amount), 0) from public.wallet_transactions where user_id = auth.uid() and amount < 0),
    'credited_30d', (select coalesce(sum(amount), 0) from public.wallet_transactions where user_id = auth.uid() and amount > 0 and created_at > now() - interval '30 days'),
    'spent_30d', (select coalesce(-sum(amount), 0) from public.wallet_transactions where user_id = auth.uid() and amount < 0 and created_at > now() - interval '30 days'),
    'count', (select count(*) from public.wallet_transactions where user_id = auth.uid()),
    'transactions', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'balance_after', t.balance_after, 'kind', t.kind, 'note', t.note, 'created_at', t.created_at) order by t.created_at desc), '[]'::jsonb)
                     from (select * from public.wallet_transactions where user_id = auth.uid() order by created_at desc limit 100) t)
  );
$$;
revoke execute on function public.my_wallet() from public, anon;

-- staff view: platform-wide ledger + totals
create or replace function public.admin_wallet_overview(p_limit integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then jsonb_build_object(
    'total_balance', (select coalesce(sum(balance), 0) from public.profiles),
    'accounts_with_credit', (select count(*) from public.profiles where balance > 0),
    'credited_30d', (select coalesce(sum(amount), 0) from public.wallet_transactions where amount > 0 and created_at > now() - interval '30 days'),
    'spent_30d', (select coalesce(-sum(amount), 0) from public.wallet_transactions where amount < 0 and created_at > now() - interval '30 days'),
    'transactions', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'user_id', t.user_id, 'full_name', p.full_name, 'member_id', p.member_id, 'avatar_url', p.avatar_url, 'amount', t.amount, 'balance_after', t.balance_after, 'kind', t.kind, 'note', t.note, 'actor_name', a.full_name, 'created_at', t.created_at) order by t.created_at desc), '[]'::jsonb)
                     from (select * from public.wallet_transactions order by created_at desc limit greatest(1, least(p_limit, 500))) t
                     left join public.profiles p on p.user_id = t.user_id
                     left join public.profiles a on a.user_id = t.actor_id),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name, 'member_id', p.member_id, 'avatar_url', p.avatar_url, 'balance', p.balance) order by p.balance desc), '[]'::jsonb)
            from (select * from public.profiles where balance > 0 order by balance desc limit 10) p)
  ) end;
$$;
revoke execute on function public.admin_wallet_overview(integer) from public, anon;;
