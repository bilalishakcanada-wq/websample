-- Supabase's default privileges grant EXECUTE to anon/authenticated on every new
-- function, and "revoke from public" does not undo an explicit role grant.
-- provider_metrics is an internal helper that bypasses RLS and exposes bid
-- statistics, so no client role should be able to call it directly; the wrapper
-- functions are SECURITY DEFINER and reach it as the owner.
revoke execute on function public.provider_metrics() from anon, authenticated;

-- Matching surfaces stay signed-in only.
revoke execute on function public.recommended_listings(integer) from anon;
revoke execute on function public.match_providers_for_listing(uuid, integer) from anon;;
