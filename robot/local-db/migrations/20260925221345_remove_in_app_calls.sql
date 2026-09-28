-- Pozivi u aplikaciji se ukidaju: vlasnik ne želi tu opciju.
-- Uklanja se i serverska strana, ne samo dugmad — inače bi se poziv i dalje
-- mogao pokrenuti direktnim pozivom RPC-a, mimo sučelja.
-- U tabeli su bila samo 3 dana automatskih testova (12 redova), nema stvarnih razgovora.

select cron.unschedule('expire-stale-calls');

drop function if exists public.start_call(uuid, call_kind);
drop function if exists public.update_call(uuid, call_state, text, boolean);
drop function if exists public.expire_stale_calls();

drop table if exists public.calls;

drop type if exists call_kind;
drop type if exists call_state;;
