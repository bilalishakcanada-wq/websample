-- ============================================================================
-- Budget held when a job is posted (no free jobs, no fake clients).
--
--  * Publishing a job takes its budget from the client's balance at once and keeps it on
--    Zadatak (listing_budget_holds). A job without a budget, or a client whose balance is
--    too low, can't be published: BUDZET_OBAVEZAN / BUDZET_NEDOVOLJNO.
--    The same goes for "Zatraži ponudu" (a private job is a listing too).
--  * Changing the budget of an open job takes or returns the difference.
--  * Accepting an offer turns the hold into the job's escrow (job_payments): an offer above
--    the budget takes the difference, one below it returns the difference.
--  * Closed, cancelled, expired, unpublished (draft) or deleted before an offer was accepted:
--    the whole budget goes back to the balance. A paused job keeps its hold.
--  * Jobs published before this file keep the old rule: the money is taken when an offer
--    is accepted.
--
-- Every movement is a wallet_transactions row (escrow_hold / escrow_refund).
-- Needs migration_zadatak_pay + booking/*. Idempotent: safe to run more than once.
-- ============================================================================

create table if not exists public.listing_budget_holds (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'held' check (status in ('held', 'applied', 'returned')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists listing_budget_holds_client_idx on public.listing_budget_holds (client_id, status);
alter table public.listing_budget_holds enable row level security;
drop policy if exists listing_budget_holds_read on public.listing_budget_holds;
create policy listing_budget_holds_read on public.listing_budget_holds for select
  using (client_id = auth.uid() or public.is_staff());
-- no write policies: only the triggers and accept_offer_and_fund below write here
revoke insert, update, delete on public.listing_budget_holds from public, anon, authenticated;

-- Takes, adjusts or returns the hold whenever a job's status or budget changes.
create or replace function public.sync_listing_budget_hold()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_hold public.listing_budget_holds;
  v_balance numeric;
  v_diff numeric;
  v_title text := left(coalesce(new.title, ''), 80);
begin
  -- once an offer is accepted the money is the job's escrow (job_payments)
  if exists (select 1 from public.job_payments p where p.listing_id = new.id) then return null; end if;
  select * into v_hold from public.listing_budget_holds where listing_id = new.id for update;

  if new.status = 'published' then
    if v_hold.status = 'held' then
      -- budget changed on an open job: take or return the difference
      if new.price is null or new.price <= 0 then
        raise exception 'BUDZET_OBAVEZAN: posao mora imati budžet' using errcode = 'P0001';
      end if;
      v_diff := round(new.price - v_hold.amount, 2);
      if v_diff > 0 then
        select balance into v_balance from public.profiles where user_id = new.user_id for update;
        if coalesce(v_balance, 0) < v_diff then
          raise exception 'BUDZET_NEDOVOLJNO: potrebno još % KM, na balansu je % KM', v_diff, coalesce(v_balance, 0) using errcode = 'P0001';
        end if;
        perform public.wallet_move(new.user_id, -v_diff, 'escrow_hold', 'Budžet povećan · ' || v_title, new.user_id);
      elsif v_diff < 0 then
        perform public.wallet_move(new.user_id, -v_diff, 'escrow_refund', 'Budžet smanjen · ' || v_title, new.user_id);
      end if;
      if v_diff <> 0 then
        update public.listing_budget_holds set amount = round(new.price, 2) where listing_id = new.id;
      end if;
    elsif tg_op = 'INSERT' or old.status is distinct from 'published' then
      -- newly published (or published again): take the whole budget now
      if new.price is null or new.price <= 0 then
        raise exception 'BUDZET_OBAVEZAN: posao mora imati budžet' using errcode = 'P0001';
      end if;
      select balance into v_balance from public.profiles where user_id = new.user_id for update;
      if coalesce(v_balance, 0) < new.price then
        raise exception 'BUDZET_NEDOVOLJNO: potrebno % KM, na balansu je % KM', round(new.price, 2), coalesce(v_balance, 0) using errcode = 'P0001';
      end if;
      perform public.wallet_move(new.user_id, -round(new.price, 2), 'escrow_hold', 'Budžet rezervisan · ' || v_title, new.user_id);
      insert into public.listing_budget_holds (listing_id, client_id, amount)
      values (new.id, new.user_id, round(new.price, 2))
      on conflict (listing_id) do update
        set amount = excluded.amount, status = 'held', created_at = now(), settled_at = null;
    end if;
    -- otherwise: a job published before holds existed keeps the old rule
  elsif new.status <> 'paused' and v_hold.status = 'held' then
    perform public.wallet_move(new.user_id, v_hold.amount, 'escrow_refund', 'Budžet vraćen · ' || v_title, new.user_id);
    update public.listing_budget_holds set status = 'returned', settled_at = now() where listing_id = new.id;
  end if;
  return null;
end $$;
revoke execute on function public.sync_listing_budget_hold() from public, anon, authenticated;

-- named so it runs before the other AFTER triggers (alerts, e-mails): a refused hold stops them all
drop trigger if exists budget_hold_on_listing on public.listings;
create trigger budget_hold_on_listing
  after insert or update of status, price on public.listings
  for each row execute function public.sync_listing_budget_hold();

-- A job deleted while its budget is held: the budget goes back first.
create or replace function public.refund_listing_budget_on_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_hold public.listing_budget_holds;
begin
  select * into v_hold from public.listing_budget_holds where listing_id = old.id and status = 'held' for update;
  -- no profile: the whole account is being deleted, there is no balance to return to
  if found and exists (select 1 from public.profiles where user_id = old.user_id) then
    perform public.wallet_move(old.user_id, v_hold.amount, 'escrow_refund', 'Budžet vraćen · ' || left(coalesce(old.title, ''), 80), old.user_id);
  end if;
  return old;
end $$;
revoke execute on function public.refund_listing_budget_on_delete() from public, anon, authenticated;

-- after guard_listing_delete (alphabetical), which refuses jobs with an escrow in progress
drop trigger if exists listings_zz_budget_refund on public.listings;
create trigger listings_zz_budget_refund
  before delete on public.listings
  for each row execute function public.refund_listing_budget_on_delete();

-- The escrow guard (booking/04) wants the whole offer taken from the balance in the same
-- transaction. With a hold, the budget was taken when the job was posted and only the
-- difference moves now: a hold settled ('applied') in this transaction counts as secured.
-- Users can't write listing_budget_holds, so only accept_offer_and_fund can make that row.
create or replace function public.guard_job_payment_insert()
returns trigger language plpgsql set search_path = public as $$
declare v_bid public.bids; v_listing public.listings;
begin
  select * into v_bid from public.bids where id = new.bid_id;
  select * into v_listing from public.listings where id = new.listing_id;
  if v_bid.id is null or v_listing.id is null or v_bid.listing_id <> v_listing.id then
    raise exception 'ESCROW_NEISPRAVAN: ponuda ne pripada poslu' using errcode = 'P0001';
  end if;
  if new.client_id is distinct from v_listing.user_id or new.provider_id is distinct from v_bid.bidder_id
     or new.client_id = new.provider_id then
    raise exception 'ESCROW_NEISPRAVAN: strane ugovora ne odgovaraju poslu i ponudi' using errcode = 'P0001';
  end if;
  if new.amount is null or new.amount <= 0 or new.amount <> v_bid.amount then
    raise exception 'ESCROW_NEISPRAVAN: iznos % nije dogovoreni iznos ponude %', new.amount, v_bid.amount using errcode = 'P0001';
  end if;
  if new.fee_amount <> round(new.amount * new.fee_percent / 100, 2)
     or new.net_amount <> round(new.amount - new.amount * new.fee_percent / 100, 2) then
    raise exception 'ESCROW_NEISPRAVAN: naknada nije tačno obračunata' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.wallet_transactions w
     where w.user_id = new.client_id and w.kind = 'escrow_hold'
       and w.amount = -round(new.amount, 2) and w.created_at = now()   -- now() = početak ove transakcije
  ) and not exists (
    select 1 from public.listing_budget_holds h
     where h.listing_id = new.listing_id and h.client_id = new.client_id
       and h.status = 'applied' and h.settled_at = now()
  ) then
    raise exception 'ESCROW_NIJE_OSIGURAN: iznos nije skinut s balansa klijenta' using errcode = 'P0001';
  end if;

  new.status := 'funded';
  new.work_state := 'in_progress';
  new.funded_at := now();
  -- posao na terenu (nije online): izvođač mora slikati prije i poslije, sa GPS-om
  new.proof_required := not (coalesce(v_listing.location, '') ~* '(online|daljin|remote)');
  return new;
end $$;

-- Accepting an offer: the held budget becomes the job's escrow; the difference to the
-- offer is taken or returned. Same as before for jobs without a hold.
create or replace function public.accept_offer_and_fund(p_bid_id uuid, p_expected_amount numeric default null)
returns public.job_payments language plpgsql security definer set search_path = '' as $$
declare v_bid public.bids; v_listing public.listings; v_fee numeric;
  v_row public.job_payments; v_listing_id uuid; v_client_name text;
  v_hold public.listing_budget_holds; v_diff numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select listing_id into v_listing_id from public.bids where id=p_bid_id;
  if not found then raise exception 'NO_BID'; end if;
  select * into v_listing from public.listings where id=v_listing_id;
  if not found or v_listing.user_id is distinct from auth.uid() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if public.is_suspended() then raise exception 'SUSPENDED' using errcode='42501'; end if;
  -- Serialize acceptances before any bid lock. Bid rows then precede the listing
  -- row, matching existing bid-count UPDATE triggers on concurrent withdrawals.
  perform pg_advisory_xact_lock(hashtextextended('booking:'||v_listing.id::text,0));
  perform id from public.bids where listing_id=v_listing.id order by id for update;
  select * into v_listing from public.listings where id=v_listing_id for update;
  if not found or v_listing.user_id is distinct from auth.uid() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into v_bid from public.bids where id=p_bid_id and listing_id=v_listing.id;
  if not found then raise exception 'NO_BID'; end if;
  select * into v_row from public.job_payments where listing_id=v_listing.id;
  if found then
    if v_row.bid_id=p_bid_id and v_row.client_id=auth.uid() then return v_row; end if;
    raise exception 'ALREADY_FUNDED';
  end if;
  if v_bid.bidder_id=v_listing.user_id then raise exception 'PONUDA_NA_SVOJ_OGLAS'; end if;
  if v_bid.status<>'pending' then raise exception 'BID_NOT_PENDING'; end if;
  if v_listing.status<>'published' then raise exception 'LISTING_NOT_OPEN'; end if;
  if v_bid.amount is null or v_bid.amount<=0 then raise exception 'BAD_AMOUNT'; end if;
  if p_expected_amount is null or v_bid.amount<>p_expected_amount then raise exception 'BID_AMOUNT_CHANGED'; end if;
  select * into v_hold from public.listing_budget_holds where listing_id=v_listing.id and status='held' for update;
  if found then
    v_diff := round(v_bid.amount - v_hold.amount, 2);
    if v_diff > 0 then
      perform public.wallet_move(v_listing.user_id,-v_diff,'escrow_hold','Doplata do prihvaćene ponude · '||v_listing.title);
    elsif v_diff < 0 then
      perform public.wallet_move(v_listing.user_id,-v_diff,'escrow_refund','Razlika do budžeta vraćena · '||v_listing.title);
    end if;
    update public.listing_budget_holds set status='applied', settled_at=now() where listing_id=v_listing.id;
  else
    perform public.wallet_move(v_listing.user_id,-v_bid.amount,'escrow_hold','Osigurana uplata · '||v_listing.title);
  end if;
  v_fee:=public.fee_percent_for(v_bid.bidder_id);
  insert into public.job_payments(listing_id,bid_id,client_id,provider_id,amount,fee_percent,fee_amount,net_amount)
    values(v_listing.id,v_bid.id,v_listing.user_id,v_bid.bidder_id,v_bid.amount,v_fee,
      round(v_bid.amount*v_fee/100,2),round(v_bid.amount-v_bid.amount*v_fee/100,2)) returning * into v_row;
  update public.bids set status='accepted' where id=v_bid.id;
  update public.bids set status='rejected' where listing_id=v_listing.id and id<>v_bid.id and status='pending';
  update public.listings set status='assigned' where id=v_listing.id;
  select public.display_name_of(full_name) into v_client_name from public.profiles where user_id=v_listing.user_id;
  insert into public.notifications(user_id,type,title,message,link) values
    (v_bid.bidder_id,'job','Ponuda prihvaćena — uplata osigurana',
      v_client_name||' je prihvatio/la tvoju ponudu za „'||v_listing.title||'“.','/listings/'||v_listing.id),
    (v_listing.user_id,'job','Uplata osigurana',v_bid.amount||' KM za „'||v_listing.title||'“ je osigurano.','/listings/'||v_listing.id);
  -- Existing notification/email triggers run within this same transaction.
  return v_row;
end $$;
revoke execute on function public.accept_offer_and_fund(uuid, numeric) from public, anon;
grant execute on function public.accept_offer_and_fund(uuid, numeric) to authenticated;

-- The app asks this before showing the "budget is held" rules on the posting form.
create or replace function public.budget_hold_enabled()
returns boolean language sql stable set search_path = '' as $$ select true $$;
grant execute on function public.budget_hold_enabled() to anon, authenticated;
