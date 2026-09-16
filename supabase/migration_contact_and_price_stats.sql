-- Help centre contact form + data-driven cost guides.

-- Anyone (including visitors) may submit a contact message; only admins read.
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

create policy contact_messages_insert_any on public.contact_messages
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create policy contact_messages_admin_read on public.contact_messages
  for select to authenticated using (public.is_admin());

create policy contact_messages_admin_update on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);

-- Price ranges per category from real published listings (aggregates only).
create or replace function public.category_price_stats()
returns table (
  category text, listing_count bigint, priced_count bigint,
  min_price numeric, avg_price numeric, median_price numeric, max_price numeric
)
language sql stable security definer set search_path = public
as $$
  select l.category, count(*), count(l.price), min(l.price), round(avg(l.price), 0),
         round(percentile_cont(0.5) within group (order by l.price)::numeric, 0), max(l.price)
  from public.listings l
  where l.status = 'published' and l.category is not null
  group by l.category
  order by count(*) desc, l.category;
$$;

revoke execute on function public.category_price_stats() from public;
grant execute on function public.category_price_stats() to anon, authenticated;
