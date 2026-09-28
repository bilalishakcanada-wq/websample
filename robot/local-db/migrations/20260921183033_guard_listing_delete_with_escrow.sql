-- A job with money held in escrow cannot be deleted (the cascade would swallow the funds):
-- the client must release or cancel the payment first.
create or replace function public.guard_listing_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.job_payments jp where jp.listing_id = old.id and jp.status in ('funded', 'requested', 'disputed')) then
    raise exception 'PAYMENT_IN_PROGRESS: prvo oslobodi ili otkaži osiguranu uplatu' using errcode = 'P0001';
  end if;
  return old;
end $$;
drop trigger if exists guard_listing_delete on public.listings;
create trigger guard_listing_delete before delete on public.listings
for each row execute function public.guard_listing_delete();;
