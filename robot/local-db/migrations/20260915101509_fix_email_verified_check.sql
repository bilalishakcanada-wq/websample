create or replace function public.is_email_verified()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email_confirmed_at is not null
  );
$$;

grant execute on function public.is_email_verified() to authenticated;

drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own" on public.listings for insert
  with check (auth.uid() = user_id and (status <> 'published' or public.is_email_verified()));

drop policy if exists "listings_update_own" on public.listings;
create policy "listings_update_own" on public.listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (status <> 'published' or public.is_email_verified()));;
