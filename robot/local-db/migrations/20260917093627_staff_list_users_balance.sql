drop function if exists public.staff_list_users(text, text, integer);
create or replace function public.staff_list_users(p_term text default '', p_status text default null, p_limit integer default 100)
returns table (
  user_id uuid, member_id text, full_name text, email text, city text, avatar_url text, account_type text,
  account_status text, suspended_until timestamptz, suspension_reason text, created_at timestamptz, last_seen_at timestamptz,
  roles text[], strikes bigint, listings bigint, bids bigint, ai_risk text, ai_score integer, ai_assessed_at timestamptz, balance numeric
)
language sql stable security definer set search_path = public as $$
  with me as (select public.is_admin() as admin, public.is_staff() as staff),
  term as (select nullif(lower(btrim(coalesce(p_term, ''))), '') as t)
  select p.user_id, p.member_id, p.full_name,
         case when me.admin then p.email end,
         p.city, p.avatar_url, p.account_type, p.account_status, p.suspended_until, p.suspension_reason, p.created_at, p.last_seen_at,
         (select coalesce(array_agg(r.name order by r.name), '{}') from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p.user_id and r.name in ('ADMIN', 'MODERATOR')),
         (select count(*) from public.moderation_events e where e.user_id = p.user_id and e.action in ('masked', 'removed') and not e.dismissed and e.created_at > now() - interval '30 days'),
         (select count(*) from public.listings l where l.user_id = p.user_id),
         (select count(*) from public.bids b where b.bidder_id = p.user_id),
         p.ai_assessment ->> 'risk_level',
         (p.ai_assessment ->> 'trust_score')::integer,
         p.ai_assessed_at,
         case when me.admin then p.balance end
  from public.profiles p, me, term
  where me.staff
    and (p_status is null or p.account_status = p_status)
    and (term.t is null
         or lower(p.full_name) like '%' || term.t || '%'
         or lower(p.member_id) like '%' || term.t || '%'
         or (me.admin and lower(p.email) like '%' || term.t || '%')
         or p.user_id::text = term.t
         or lower(coalesce(p.city, '')) like '%' || term.t || '%')
  order by p.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;
revoke execute on function public.staff_list_users(text, text, integer) from public, anon;;
