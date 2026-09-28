-- OAuth started in the installed web app (home-screen PWA on iOS) finishes in an in-app Safari
-- view that has its own storage. The callback page parks the session under a one-time nonce
-- the PWA generated; the PWA claims it when it regains focus. Rows live for 10 minutes at most.
create table if not exists public.auth_handoffs (
  nonce text primary key,
  access_token text not null,
  refresh_token text not null,
  created_at timestamptz not null default now()
);
alter table public.auth_handoffs enable row level security;
revoke all on public.auth_handoffs from anon, authenticated;

create or replace function public.store_auth_handoff(p_nonce text, p_access text, p_refresh text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_nonce is null or length(p_nonce) < 32 or p_access is null or p_refresh is null then raise exception 'bad handoff'; end if;
  delete from public.auth_handoffs where created_at < now() - interval '10 minutes';
  insert into public.auth_handoffs (nonce, access_token, refresh_token) values (p_nonce, p_access, p_refresh)
  on conflict (nonce) do update set access_token = excluded.access_token, refresh_token = excluded.refresh_token, created_at = now();
end $$;

create or replace function public.claim_auth_handoff(p_nonce text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.auth_handoffs;
begin
  delete from public.auth_handoffs where nonce = p_nonce and created_at > now() - interval '10 minutes' returning * into v;
  if v.nonce is null then return null; end if;
  return jsonb_build_object('access_token', v.access_token, 'refresh_token', v.refresh_token);
end $$;

grant execute on function public.store_auth_handoff(text, text, text) to anon, authenticated;
grant execute on function public.claim_auth_handoff(text) to anon, authenticated;;
