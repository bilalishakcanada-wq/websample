create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  message text not null,
  stack text,
  url text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created_idx on public.client_errors(created_at desc);
alter table public.client_errors enable row level security;
-- staff may read them from the console; nobody writes directly (RPC below)
drop policy if exists client_errors_staff_read on public.client_errors;
create policy client_errors_staff_read on public.client_errors for select to authenticated using (public.is_staff());

create or replace function public.log_client_error(p_message text, p_stack text default null, p_url text default null, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- keep the table small: ignore floods from one origin (max 30 rows a minute overall)
  if (select count(*) from public.client_errors where created_at > now() - interval '1 minute') >= 30 then return; end if;
  insert into public.client_errors (user_id, message, stack, url, user_agent)
  values (auth.uid(), left(coalesce(p_message, ''), 500), left(p_stack, 3000), left(p_url, 500), left(p_user_agent, 200));
end $$;
grant execute on function public.log_client_error(text, text, text, text) to anon, authenticated;;
