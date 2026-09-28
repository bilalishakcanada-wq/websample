-- Public contact form (help centre). Anyone may write; only admins may read.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200),
  topic text not null default 'other' check (topic in ('account', 'listing', 'payment', 'report', 'business', 'other')),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_insert_any on public.contact_messages;
create policy contact_messages_insert_any on public.contact_messages
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists contact_messages_admin_read on public.contact_messages;
create policy contact_messages_admin_read on public.contact_messages
  for select to authenticated
  using (public.is_admin());

drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update on public.contact_messages
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);

-- Cost guide: real price ranges per category from published listings.
-- Aggregates only, so it is safe for anonymous visitors.
create or replace function public.category_price_stats()
returns table (
  category text,
  listing_count bigint,
  priced_count bigint,
  min_price numeric,
  avg_price numeric,
  median_price numeric,
  max_price numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.category,
    count(*) as listing_count,
    count(l.price) as priced_count,
    min(l.price) as min_price,
    round(avg(l.price), 0) as avg_price,
    round(percentile_cont(0.5) within group (order by l.price)::numeric, 0) as median_price,
    max(l.price) as max_price
  from public.listings l
  where l.status = 'published' and l.category is not null
  group by l.category
  order by listing_count desc, l.category;
$$;

revoke execute on function public.category_price_stats() from public;
grant execute on function public.category_price_stats() to anon, authenticated;;
