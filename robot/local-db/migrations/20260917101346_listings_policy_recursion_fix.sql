create or replace function public.i_bid_on(p_listing_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bids b where b.listing_id = p_listing_id and b.bidder_id = auth.uid());
$$;
drop policy if exists listings_view_public_or_own on public.listings;
create policy listings_view_public_or_own on public.listings for select using (
  status = 'published' or auth.uid() = user_id or public.is_staff() or public.i_bid_on(id)
);;
