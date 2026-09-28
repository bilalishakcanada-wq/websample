-- A bidder may edit their own pending offer or withdraw it; only the listing owner (through the
-- accept/reject RPCs) moves an offer to accepted / rejected.
create or replace function public.guard_bid_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.listings where id = new.listing_id;
  if auth.uid() is not null and auth.uid() = old.bidder_id and auth.uid() <> v_owner and not public.is_admin() then
    if old.status <> 'pending' then
      raise exception 'BID_LOCKED: ponuda se više ne može mijenjati';
    end if;
    if new.status not in ('pending', 'withdrawn') then
      raise exception 'BID_STATUS_FORBIDDEN';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_bid_status_change on public.bids;
create trigger guard_bid_status_change before update on public.bids
for each row execute function public.guard_bid_status_change();;
