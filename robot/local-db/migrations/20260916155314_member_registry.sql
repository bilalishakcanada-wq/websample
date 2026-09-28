-- Append-only register of every account ever created: the private member ID,
-- who it belonged to and when. Survives account deletion so admins can always
-- trace "which account was PB-XXXX-XXXX when something happened".
create table if not exists public.member_registry (
  member_id text primary key,
  user_id uuid not null,
  email text,
  full_name text,
  account_type text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deletion_note text
);
create index if not exists member_registry_user_idx on public.member_registry (user_id);
create index if not exists member_registry_email_idx on public.member_registry (lower(email));
alter table public.member_registry enable row level security;
drop policy if exists member_registry_admin_read on public.member_registry;
create policy member_registry_admin_read on public.member_registry for select using (public.is_admin());
-- no insert/update/delete policies: only the triggers below (definer) write here

create or replace function public.register_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.member_registry (member_id, user_id, email, full_name, account_type, created_at)
    values (new.member_id, new.user_id, new.email, new.full_name, new.account_type, coalesce(new.created_at, now()))
    on conflict (member_id) do update set email = excluded.email, full_name = excluded.full_name, account_type = excluded.account_type;
  elsif TG_OP = 'UPDATE' then
    update public.member_registry
    set email = new.email, full_name = new.full_name, account_type = new.account_type
    where member_id = new.member_id;
  elsif TG_OP = 'DELETE' then
    update public.member_registry
    set deleted_at = now(), deletion_note = 'Profil obrisan'
    where member_id = old.member_id;
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function public.register_member() from public, anon, authenticated;

drop trigger if exists register_member_insert on public.profiles;
create trigger register_member_insert after insert on public.profiles for each row execute function public.register_member();
drop trigger if exists register_member_update on public.profiles;
create trigger register_member_update after update of email, full_name, account_type on public.profiles for each row execute function public.register_member();
drop trigger if exists register_member_delete on public.profiles;
create trigger register_member_delete after delete on public.profiles for each row execute function public.register_member();

-- backfill existing accounts
insert into public.member_registry (member_id, user_id, email, full_name, account_type, created_at)
select member_id, user_id, email, full_name, account_type, created_at from public.profiles
on conflict (member_id) do nothing;

-- Admin lookup by member ID, email or name (also finds deleted accounts).
create or replace function public.admin_lookup_member(p_term text)
returns table (
  member_id text, user_id uuid, email text, full_name text, account_type text,
  created_at timestamptz, deleted_at timestamptz,
  account_status text, suspended_until timestamptz, suspension_reason text,
  listings bigint, bids bigint, messages bigint, reviews_received bigint, strikes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.member_id, r.user_id, r.email, r.full_name, r.account_type, r.created_at, r.deleted_at,
    p.account_status, p.suspended_until, p.suspension_reason,
    (select count(*) from public.listings l where l.user_id = r.user_id),
    (select count(*) from public.bids b where b.bidder_id = r.user_id),
    (select count(*) from public.messages m where m.sender_id = r.user_id),
    (select count(*) from public.reviews v where v.reviewee_id = r.user_id),
    (select count(*) from public.moderation_events e where e.user_id = r.user_id and e.action in ('masked','removed') and not e.dismissed)
  from public.member_registry r
  left join public.profiles p on p.user_id = r.user_id
  where public.is_admin()
    and (
      p_term is null or btrim(p_term) = ''
      or upper(r.member_id) like '%' || upper(btrim(p_term)) || '%'
      or lower(r.email) like '%' || lower(btrim(p_term)) || '%'
      or lower(coalesce(r.full_name, '')) like '%' || lower(btrim(p_term)) || '%'
      or r.user_id::text = btrim(p_term)
    )
  order by r.created_at desc
  limit 50;
$$;
revoke execute on function public.admin_lookup_member(text) from public, anon;
grant execute on function public.admin_lookup_member(text) to authenticated;;
