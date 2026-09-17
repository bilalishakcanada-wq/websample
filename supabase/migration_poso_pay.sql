-- Poso.ba Pay — secure payments, the Airtasker way (migration poso_pay).
--
--   1. client accepts an offer  -> the offer amount moves from the client's balance into escrow
--                                   (job_payments.status = 'funded', listing -> 'assigned')
--   2. provider does the work   -> "Zatraži isplatu"  (status = 'requested')
--   3. client releases          -> provider's balance += amount - fee (tier %), listing -> 'completed'
--   4. cancel before release    -> full refund to the client; a disagreement -> 'disputed', staff resolve
--
-- Every movement is a wallet_transactions row; the platform fee is stored on job_payments.

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft', 'published', 'assigned', 'paused', 'closed', 'archived', 'completed', 'cancelled'));

alter table public.wallet_transactions drop constraint if exists wallet_transactions_kind_check;
alter table public.wallet_transactions add constraint wallet_transactions_kind_check
  check (kind in ('admin_credit', 'admin_debit', 'bonus', 'refund', 'fee', 'payout', 'purchase', 'promo', 'escrow_hold', 'escrow_refund', 'job_income'));

create table if not exists public.job_payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  bid_id uuid not null references public.bids(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  fee_percent numeric(5, 2) not null,
  fee_amount numeric(12, 2) not null,
  net_amount numeric(12, 2) not null,
  status text not null default 'funded' check (status in ('funded', 'requested', 'released', 'refunded', 'disputed')),
  funded_at timestamptz not null default now(),
  requested_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  dispute_reason text,
  dispute_by uuid,
  resolved_by uuid,
  resolution text,
  created_at timestamptz not null default now()
);
create index if not exists job_payments_client_idx on public.job_payments (client_id, created_at desc);
create index if not exists job_payments_provider_idx on public.job_payments (provider_id, created_at desc);
create index if not exists job_payments_status_idx on public.job_payments (status);
alter table public.job_payments enable row level security;
drop policy if exists job_payments_read on public.job_payments;
create policy job_payments_read on public.job_payments for select
  using (client_id = auth.uid() or provider_id = auth.uid() or public.is_staff());
-- no write policies: everything goes through the functions below
alter publication supabase_realtime add table public.job_payments;

-- the provider chosen for a job may see it whatever its status
drop policy if exists listings_view_public_or_own on public.listings;
create policy listings_view_public_or_own on public.listings for select using (
  status = 'published' or auth.uid() = user_id or public.is_staff()
  or exists (select 1 from public.bids b where b.listing_id = listings.id and b.bidder_id = auth.uid())
);
drop policy if exists listing_images_read on public.listing_images;
create policy listing_images_read on public.listing_images for select using (
  user_id = auth.uid() or public.is_staff()
  or exists (select 1 from public.listings l where l.id = listing_id and l.status in ('published', 'assigned', 'completed'))
);

-- fee for a provider right now, from the tier table
create or replace function public.fee_percent_for(p_user_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select t.fee_percent from public.fee_tiers t
                   where t.min_30d_km <= public.provider_earnings_30d(p_user_id)
                   order by t.sort desc limit 1), 15);
$$;

-- internal: move money on a balance + ledger row (system write, no RLS)
create or replace function public.wallet_move(p_user_id uuid, p_amount numeric, p_kind text, p_note text, p_actor uuid default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_balance numeric(12, 2);
begin
  perform set_config('poso.system_write', '1', true);
  update public.profiles set balance = round(balance + p_amount, 2) where user_id = p_user_id returning balance into v_balance;
  perform set_config('poso.system_write', '', true);
  if v_balance is null then raise exception 'NO_PROFILE'; end if;
  if v_balance < 0 then raise exception 'INSUFFICIENT' using errcode = 'P0001'; end if;
  insert into public.wallet_transactions (user_id, amount, balance_after, kind, note, actor_id)
  values (p_user_id, round(p_amount, 2), v_balance, p_kind, p_note, coalesce(p_actor, auth.uid()));
  return v_balance;
end;
$$;
revoke execute on function public.wallet_move(uuid, numeric, text, text, uuid) from public, anon, authenticated;

-- 1. accept an offer and secure the money
create or replace function public.accept_offer_and_fund(p_bid_id uuid)
returns public.job_payments language plpgsql security definer set search_path = public as $$
declare
  v_bid public.bids;
  v_listing public.listings;
  v_fee numeric;
  v_row public.job_payments;
  v_client_name text;
begin
  select * into v_bid from public.bids where id = p_bid_id;
  if v_bid is null then raise exception 'NO_BID'; end if;
  select * into v_listing from public.listings where id = v_bid.listing_id;
  if v_listing.user_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode = '42501'; end if;
  if v_bid.status <> 'pending' then raise exception 'BID_NOT_PENDING'; end if;
  if v_listing.status <> 'published' then raise exception 'LISTING_NOT_OPEN'; end if;
  if exists (select 1 from public.job_payments where listing_id = v_listing.id) then raise exception 'ALREADY_FUNDED'; end if;
  if v_bid.amount is null or v_bid.amount <= 0 then raise exception 'BAD_AMOUNT'; end if;

  -- money out of the client's balance into escrow (raises INSUFFICIENT when short)
  perform public.wallet_move(v_listing.user_id, -v_bid.amount, 'escrow_hold', 'Osigurana uplata · ' || v_listing.title);

  v_fee := public.fee_percent_for(v_bid.bidder_id);
  insert into public.job_payments (listing_id, bid_id, client_id, provider_id, amount, fee_percent, fee_amount, net_amount)
  values (v_listing.id, v_bid.id, v_listing.user_id, v_bid.bidder_id, v_bid.amount, v_fee, round(v_bid.amount * v_fee / 100, 2), round(v_bid.amount - v_bid.amount * v_fee / 100, 2))
  returning * into v_row;

  update public.bids set status = 'accepted' where id = v_bid.id;
  update public.bids set status = 'rejected' where listing_id = v_listing.id and id <> v_bid.id and status = 'pending';
  update public.listings set status = 'assigned' where id = v_listing.id;

  select public.display_name_of(full_name) into v_client_name from public.profiles where user_id = v_listing.user_id;
  insert into public.notifications (user_id, type, title, message) values
    (v_bid.bidder_id, 'job', 'Ponuda prihvaćena — uplata osigurana 🎉', v_client_name || ' je prihvatio/la tvoju ponudu za „' || v_listing.title || '“. ' || trim(to_char(v_bid.amount, 'FM999G999D00')) || ' KM je osigurano na Poso.ba; po završetku dobijaš ' || trim(to_char(v_row.net_amount, 'FM999G999D00')) || ' KM.'),
    (v_listing.user_id, 'job', 'Uplata osigurana', trim(to_char(v_bid.amount, 'FM999G999D00')) || ' KM za „' || v_listing.title || '“ se čuva na Poso.ba dok ne potvrdiš da je posao završen.');
  return v_row;
end;
$$;
revoke execute on function public.accept_offer_and_fund(uuid) from public, anon;

-- 2. provider asks for the money
create or replace function public.request_job_payment(p_listing_id uuid)
returns public.job_payments language plpgsql security definer set search_path = public as $$
declare v_row public.job_payments; v_title text; v_name text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or v_row.provider_id <> auth.uid() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'BAD_STATUS'; end if;
  update public.job_payments set status = 'requested', requested_at = now() where id = v_row.id returning * into v_row;
  select title into v_title from public.listings where id = p_listing_id;
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = v_row.provider_id;
  insert into public.notifications (user_id, type, title, message)
  values (v_row.client_id, 'job', 'Izvođač traži isplatu', v_name || ' javlja da je „' || v_title || '“ završen. Provjeri posao i oslobodi uplatu od ' || trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM.');
  return v_row;
end;
$$;
revoke execute on function public.request_job_payment(uuid) from public, anon;

-- 3. client releases: provider gets amount - fee, job completed
create or replace function public.release_job_payment(p_listing_id uuid)
returns public.job_payments language plpgsql security definer set search_path = public as $$
declare v_row public.job_payments; v_title text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or (v_row.client_id <> auth.uid() and not public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status not in ('funded', 'requested', 'disputed') then raise exception 'BAD_STATUS'; end if;
  select title into v_title from public.listings where id = p_listing_id;

  perform public.wallet_move(v_row.provider_id, v_row.net_amount, 'job_income', 'Isplata za posao · ' || v_title || ' (naknada ' || v_row.fee_percent || ' %)', auth.uid());
  update public.job_payments set status = 'released', released_at = now(), resolved_by = case when public.is_admin() and client_id <> auth.uid() then auth.uid() end
  where id = v_row.id returning * into v_row;
  perform set_config('poso.system_write', '1', true);
  update public.listings set status = 'completed', completed_at = now() where id = p_listing_id;
  perform set_config('poso.system_write', '', true);

  insert into public.notifications (user_id, type, title, message) values
    (v_row.provider_id, 'job', 'Uplata oslobođena 💸', trim(to_char(v_row.net_amount, 'FM999G999D00')) || ' KM je na tvom balansu za „' || v_title || '“ (' || trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM − ' || v_row.fee_percent || ' % naknade).'),
    (v_row.client_id, 'job', 'Posao završen', 'Uplata za „' || v_title || '“ je isplaćena izvođaču. Hvala — ostavi recenziju!');
  return v_row;
end;
$$;
revoke execute on function public.release_job_payment(uuid) from public, anon;

-- 4a. cancel while the money is only held: full refund to the client
create or replace function public.cancel_job_payment(p_listing_id uuid, p_reason text default null)
returns public.job_payments language plpgsql security definer set search_path = public as $$
declare v_row public.job_payments; v_title text; v_by text;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or (auth.uid() not in (v_row.client_id, v_row.provider_id) and not public.is_admin()) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status <> 'funded' then raise exception 'BAD_STATUS'; end if;
  select title into v_title from public.listings where id = p_listing_id;
  v_by := case when auth.uid() = v_row.provider_id then 'provider' when auth.uid() = v_row.client_id then 'client' else 'other' end;

  perform public.wallet_move(v_row.client_id, v_row.amount, 'escrow_refund', 'Povrat osigurane uplate · ' || v_title, auth.uid());
  update public.job_payments set status = 'refunded', refunded_at = now(), resolution = coalesce(nullif(btrim(p_reason), ''), 'Otkazano (' || v_by || ')') where id = v_row.id returning * into v_row;
  perform set_config('poso.system_write', '1', true);
  update public.listings set status = 'cancelled', cancelled_at = now(), cancel_reason = v_by where id = p_listing_id;
  perform set_config('poso.system_write', '', true);

  insert into public.notifications (user_id, type, title, message) values
    (v_row.client_id, 'job', 'Posao otkazan — novac vraćen', trim(to_char(v_row.amount, 'FM999G999D00')) || ' KM za „' || v_title || '“ je vraćeno na tvoj balans.'),
    (v_row.provider_id, 'job', 'Posao otkazan', '„' || v_title || '“ je otkazan' || case when v_by = 'client' then ' od strane klijenta.' when v_by = 'provider' then '.' else ' od strane tima.' end);
  return v_row;
end;
$$;
revoke execute on function public.cancel_job_payment(uuid, text) from public, anon;

-- 4b. disagreement: freeze and call the team
create or replace function public.open_job_dispute(p_listing_id uuid, p_reason text)
returns public.job_payments language plpgsql security definer set search_path = public, extensions as $$
declare v_row public.job_payments; v_title text; v_name text; v_staff uuid; v_other uuid;
begin
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or auth.uid() not in (v_row.client_id, v_row.provider_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if v_row.status not in ('funded', 'requested') then raise exception 'BAD_STATUS'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'REASON_REQUIRED'; end if;
  select title into v_title from public.listings where id = p_listing_id;
  select public.display_name_of(full_name) into v_name from public.profiles where user_id = auth.uid();
  update public.job_payments set status = 'disputed', disputed_at = now(), dispute_reason = left(p_reason, 1000), dispute_by = auth.uid() where id = v_row.id returning * into v_row;
  v_other := case when auth.uid() = v_row.client_id then v_row.provider_id else v_row.client_id end;
  insert into public.notifications (user_id, type, title, message)
  values (v_other, 'job', 'Prijavljen problem sa poslom', v_name || ' je prijavio/la problem za „' || v_title || '“. Uplata je zamrznuta dok Poso.ba tim ne pregleda slučaj.');
  for v_staff in select distinct ur.user_id from public.user_roles ur join public.roles r on r.id = ur.role_id where r.name in ('ADMIN', 'MODERATOR') loop
    insert into public.notifications (user_id, type, title, message)
    values (v_staff, 'support', 'Spor oko uplate — ' || v_title, v_name || ': ' || left(p_reason, 160));
  end loop;
  return v_row;
end;
$$;
revoke execute on function public.open_job_dispute(uuid, text) from public, anon;

-- staff decision: release to the provider, refund the client, or split
create or replace function public.admin_resolve_job(p_listing_id uuid, p_action text, p_provider_share numeric default null, p_note text default null)
returns public.job_payments language plpgsql security definer set search_path = public as $$
declare v_row public.job_payments; v_title text; v_to_provider numeric; v_to_client numeric; v_fee numeric;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_row from public.job_payments where listing_id = p_listing_id;
  if v_row is null or v_row.status in ('released', 'refunded') then raise exception 'BAD_STATUS'; end if;
  select title into v_title from public.listings where id = p_listing_id;

  if p_action = 'release' then
    return public.release_job_payment(p_listing_id);
  elsif p_action = 'refund' then
    perform public.wallet_move(v_row.client_id, v_row.amount, 'escrow_refund', 'Povrat po odluci tima · ' || v_title, auth.uid());
    update public.job_payments set status = 'refunded', refunded_at = now(), resolved_by = auth.uid(), resolution = coalesce(p_note, 'Tim: povrat klijentu') where id = v_row.id returning * into v_row;
    perform set_config('poso.system_write', '1', true);
    update public.listings set status = 'cancelled', cancelled_at = now(), cancel_reason = 'other' where id = p_listing_id;
    perform set_config('poso.system_write', '', true);
  elsif p_action = 'split' then
    if p_provider_share is null or p_provider_share < 0 or p_provider_share > v_row.amount then raise exception 'BAD_SHARE'; end if;
    v_fee := round(p_provider_share * v_row.fee_percent / 100, 2);
    v_to_provider := round(p_provider_share - v_fee, 2);
    v_to_client := round(v_row.amount - p_provider_share, 2);
    if v_to_provider > 0 then perform public.wallet_move(v_row.provider_id, v_to_provider, 'job_income', 'Djelimična isplata po odluci tima · ' || v_title, auth.uid()); end if;
    if v_to_client > 0 then perform public.wallet_move(v_row.client_id, v_to_client, 'escrow_refund', 'Djelimični povrat po odluci tima · ' || v_title, auth.uid()); end if;
    update public.job_payments set status = 'released', released_at = now(), resolved_by = auth.uid(), fee_amount = v_fee, net_amount = v_to_provider,
      resolution = coalesce(p_note, 'Tim: podjela ' || p_provider_share || ' KM izvođaču') where id = v_row.id returning * into v_row;
    perform set_config('poso.system_write', '1', true);
    update public.listings set status = 'completed', completed_at = now() where id = p_listing_id;
    perform set_config('poso.system_write', '', true);
  else
    raise exception 'BAD_ACTION';
  end if;

  insert into public.notifications (user_id, type, title, message) values
    (v_row.client_id, 'job', 'Tim je riješio spor', 'Odluka za „' || v_title || '“: ' || coalesce(v_row.resolution, p_action) || '. Detalji su na tvom balansu.'),
    (v_row.provider_id, 'job', 'Tim je riješio spor', 'Odluka za „' || v_title || '“: ' || coalesce(v_row.resolution, p_action) || '. Detalji su na tvom balansu.');
  perform public.log_staff_action('job_resolve', v_row.client_id, jsonb_build_object('listing_id', p_listing_id, 'action', p_action, 'provider_share', p_provider_share, 'note', p_note));
  return v_row;
end;
$$;
revoke execute on function public.admin_resolve_job(uuid, text, numeric, text) from public, anon;

-- payment history now reads the real ledger of jobs
drop function if exists public.my_payment_history();
create or replace function public.my_payment_history()
returns table (listing_id uuid, title text, role text, other_name text, amount numeric, fee_percent numeric, net numeric, completed_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select j.listing_id, l.title,
         case when j.provider_id = auth.uid() then 'earned' else 'paid' end,
         case when j.provider_id = auth.uid() then public.display_name_of(pc.full_name) else public.display_name_of(pp.full_name) end,
         j.amount,
         case when j.provider_id = auth.uid() then j.fee_percent else null end,
         case when j.provider_id = auth.uid() then j.net_amount else j.amount end,
         coalesce(j.released_at, j.refunded_at, j.requested_at, j.funded_at),
         j.status
  from public.job_payments j
  join public.listings l on l.id = j.listing_id
  left join public.profiles pc on pc.user_id = j.client_id
  left join public.profiles pp on pp.user_id = j.provider_id
  where j.client_id = auth.uid() or j.provider_id = auth.uid()
  order by coalesce(j.released_at, j.refunded_at, j.requested_at, j.funded_at) desc;
$$;
revoke execute on function public.my_payment_history() from public, anon;

-- staff: escrow overview
create or replace function public.admin_job_payments(p_limit integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_staff() then jsonb_build_object(
    'held', (select coalesce(sum(amount), 0) from public.job_payments where status in ('funded', 'requested', 'disputed')),
    'disputed', (select count(*) from public.job_payments where status = 'disputed'),
    'released_30d', (select coalesce(sum(amount), 0) from public.job_payments where status = 'released' and released_at > now() - interval '30 days'),
    'fees_30d', (select coalesce(sum(fee_amount), 0) from public.job_payments where status = 'released' and released_at > now() - interval '30 days'),
    'fees_total', (select coalesce(sum(fee_amount), 0) from public.job_payments where status = 'released'),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', j.id, 'listing_id', j.listing_id, 'title', l.title, 'status', j.status, 'amount', j.amount, 'fee_percent', j.fee_percent, 'fee_amount', j.fee_amount, 'net_amount', j.net_amount,
        'client_id', j.client_id, 'client_name', pc.full_name, 'client_member', pc.member_id, 'provider_id', j.provider_id, 'provider_name', pp.full_name, 'provider_member', pp.member_id,
        'funded_at', j.funded_at, 'requested_at', j.requested_at, 'released_at', j.released_at, 'refunded_at', j.refunded_at, 'disputed_at', j.disputed_at, 'dispute_reason', j.dispute_reason,
        'dispute_by', case when j.dispute_by = j.client_id then 'client' when j.dispute_by = j.provider_id then 'provider' end, 'resolution', j.resolution
      ) order by case when j.status = 'disputed' then 0 else 1 end, j.created_at desc), '[]'::jsonb)
      from (select * from public.job_payments order by created_at desc limit greatest(1, least(p_limit, 500))) j
      join public.listings l on l.id = j.listing_id
      left join public.profiles pc on pc.user_id = j.client_id
      left join public.profiles pp on pp.user_id = j.provider_id)
  ) end;
$$;
revoke execute on function public.admin_job_payments(integer) from public, anon;

-- fix (migration listings_policy_recursion_fix): listings select policy uses i_bid_on(id)
-- (security definer) instead of a direct bids subquery to avoid policy recursion.
create or replace function public.i_bid_on(p_listing_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bids b where b.listing_id = p_listing_id and b.bidder_id = auth.uid());
$$;
