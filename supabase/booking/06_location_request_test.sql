-- Scenario check for 06_location_request.sql on a local copy (db-only-setup.sh): request, cooldown, decline, share with a
-- time limit, refusal after expiry, "Stigao sam", and who may call what. Run with psql; every ERROR line is an expected refusal.
\set ON_ERROR_STOP 0
set session_replication_role = replica;
insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','c@t'),('22222222-2222-2222-2222-222222222222','p@t') on conflict do nothing;
insert into public.listings(id,user_id,title) values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','T') on conflict do nothing;
insert into public.bids(id,listing_id,bidder_id,amount) values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',100) on conflict do nothing;
insert into public.job_payments(listing_id,bid_id,client_id,provider_id,amount,fee_percent,fee_amount,net_amount) values ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222',100,10,10,90) on conflict do nothing;
set session_replication_role = origin;
delete from notifications;
-- client requests
begin; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true); set local role authenticated;
select 'req1', public.request_live_location('33333333-3333-3333-3333-333333333333') is not null;
commit;
begin; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true); set local role authenticated;
select 'req2 cooldown'; select public.request_live_location('33333333-3333-3333-3333-333333333333');
rollback;
-- provider sees request, declines
begin; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true); set local role authenticated;
select 'prov sees', state from job_location_requests;
select 'client cant decline? (provider here)'; select public.decline_location_request('33333333-3333-3333-3333-333333333333');
select 'after decline', state from job_location_requests;
commit;
-- provider shares 30 min
begin; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true); set local role authenticated;
select 'share', public.share_live_location('33333333-3333-3333-3333-333333333333',43.85,18.4,10,null,null,30) is not null;
select 'req gone', count(*) from job_location_requests;
select 'row', share_until > now() + interval '29 min' from job_live_locations;
commit;
-- client tries request while sharing
begin; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true); set local role authenticated;
select 'client sees', count(*) from job_live_locations;
select public.request_live_location('33333333-3333-3333-3333-333333333333');
rollback;
-- expire
update job_live_locations set share_until = now() - interval '1 min', updated_at = now() - interval '10 s';
begin; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true); set local role authenticated;
select 'client sees expired', count(*) from job_live_locations; rollback;
begin; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true); set local role authenticated;
select 'old point after expiry'; select public.share_live_location('33333333-3333-3333-3333-333333333333',43.85,18.4); rollback;
begin; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true); set local role authenticated;
select 'restart 60', public.share_live_location('33333333-3333-3333-3333-333333333333',43.85,18.4,10,null,null,60) is not null;
select 'arrived'; select public.arrived_live_location('33333333-3333-3333-3333-333333333333');
select 'rows after arrive', count(*) from job_live_locations;
commit;
-- client can't share / arrive
begin; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true); set local role authenticated;
select public.arrived_live_location('33333333-3333-3333-3333-333333333333'); rollback;
begin; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true); set local role authenticated;
select public.request_live_location('33333333-3333-3333-3333-333333333333'); rollback;
select title, user_id from notifications order by created_at, title;
-- direct insert blocked
begin; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true); set local role authenticated;
insert into job_location_requests(payment_id,client_id,provider_id) select id,client_id,provider_id from job_payments; rollback;
