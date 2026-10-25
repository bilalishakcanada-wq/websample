-- Suspendovan nalog (admin_suspend_for: dani + sati + razlog) ne može ništa dok suspenzija traje.
--
-- Do sada su suspenziju provjeravala samo pravila za upis (objava, ponude, poruke, uplate), pa je
-- suspendovan korisnik i dalje mogao čitati poslove, poruke i sve ostalo. Sada:
--   * block_suspended_request(): PostgREST je pokreće prije SVAKOG zahtjeva (tabele i RPC).
--     Suspendovan, prijavljen korisnik dobija 403 'SUSPENDED' za sve osim my_suspension().
--     Gosti (bez prijave), service_role i nesuspendovani nalozi prolaze kao i prije.
--   * my_suspension(): jedino što suspendovan nalog smije pitati — do kada traje i zašto.
--     Aplikacija na osnovu toga prikazuje samo odbrojavanje.
-- Istek je automatski: is_suspended() gleda suspended_until > now(), pa nalog proradi u sekundi
-- isteka, i prije nego hourly cron (lift_expired_suspensions) vrati status na 'active'.
-- Smije se pokrenuti više puta.

create or replace function public.my_suspension()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('until', p.suspended_until, 'reason', p.suspension_reason)
  from public.profiles p
  where p.user_id = auth.uid()
    and p.account_status = 'suspended'
    and (p.suspended_until is null or p.suspended_until > now());
$$;
revoke execute on function public.my_suspension() from public, anon;
grant execute on function public.my_suspension() to authenticated;

create or replace function public.block_suspended_request()
returns void
language plpgsql stable set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if coalesce(current_setting('request.path', true), '') like '%/rpc/my_suspension' then return; end if;
  if public.is_suspended() then
    raise exception 'SUSPENDED' using errcode = '42501', hint = 'Nalog je privremeno suspendovan.';
  end if;
end;
$$;
revoke execute on function public.block_suspended_request() from public;
grant execute on function public.block_suspended_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.block_suspended_request';
notify pgrst, 'reload config';
