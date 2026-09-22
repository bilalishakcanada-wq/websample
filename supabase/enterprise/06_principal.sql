-- ============================================================================
-- 06 — Sigurnosni kontekst (pokreni POSLIJE 01–05)
-- ----------------------------------------------------------------------------
-- Spaja RBAC (01), KYC (02) i depozite (03) u jedan poziv. Zato je u zasebnom
-- fajlu: ovisi o funkcijama iz svih prethodnih, pa ide zadnji.
-- ============================================================================

-- Backend (PrincipalMiddleware) i frontend traže isto: ko je ovo, šta smije,
-- smije li uopšte poslovati. Jedan round-trip umjesto četiri upita.
create or replace function public.principal_for(p_user uuid default auth.uid())
returns table (
  roles text[], permissions text[], is_internal boolean,
  kyc_verified boolean, can_transact boolean
)
language sql stable security definer set search_path = public as $fn$
  select
    coalesce((select array_agg(distinct r.name)
              from public.user_roles ur join public.roles r on r.id = ur.role_id
              where ur.user_id = p_user), '{}'),
    coalesce((select array_agg(distinct rp.permission_code)
              from public.user_roles ur
              join public.role_permissions rp on rp.role_id = ur.role_id
              join public.roles r on r.id = ur.role_id
              left join public.staff_members sm on sm.user_id = ur.user_id
              where ur.user_id = p_user
                and (not r.is_internal or coalesce(sm.is_active, false))), '{}'),
    exists (select 1 from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            join public.staff_members sm on sm.user_id = ur.user_id and sm.is_active
            where ur.user_id = p_user and r.is_internal),
    public.is_kyc_verified(p_user),
    public.can_transact(p_user);
$fn$;

comment on function public.principal_for(uuid) is
  'Cijeli sigurnosni kontekst korisnika u jednom pozivu: uloge, permisije, da li je '
  'zaposleni, da li je KYC odobren i smije li uopšte poslovati.';

revoke execute on function public.principal_for(uuid) from anon;
