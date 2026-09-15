-- Supabase's default privileges grant EXECUTE to anon and authenticated on
-- every newly created function. An earlier hardening pass only did
-- "revoke execute ... from public", which does not remove an explicit grant to
-- a named role, so these stayed reachable over /rest/v1/rpc/*.

-- Trigger functions fire as the table owner; no client role needs to call them.
revoke execute on function public.check_message_contact_info() from anon, authenticated;
revoke execute on function public.handle_bid_accepted() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- refresh_provider_badges() rewrites badges for every user. It is run by
-- pg_cron (as the owner, no JWT) and from the admin screen, so it stays
-- callable for signed-in users but refuses non-admins, and anon loses access.
-- The admin check is inside the function body (see migration_matching_algorithm
-- companion migration applied as harden_trigger_and_job_function_grants):
--
--   if auth.uid() is not null and not public.is_admin() then
--     raise exception 'Nedozvoljen pristup.' using errcode = '42501';
--   end if;
revoke execute on function public.refresh_provider_badges() from anon;
grant execute on function public.refresh_provider_badges() to authenticated;

-- Deliberately left callable:
--   is_admin(), is_email_verified()  -> referenced by RLS policies, which are
--                                       evaluated as the calling role
--   ranked_providers(...)            -> powers the public homepage
