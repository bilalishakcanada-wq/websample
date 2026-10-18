-- Scenario check for 01_device_location_and_travel_requests.sql on the robot's local database
-- (robot/local-db/setup.sh): klijent@ posts a 40 KM job in Sarajevo, izvodjac@ is in Mostar (~70 km).
-- psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/reach/01_test.sql
-- Every ERROR line is an expected refusal; the 'expect' column says what each line should show.
\set ON_ERROR_STOP 0
\set c `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -Atc "select user_id from profiles where email = 'klijent@test.zadatak'"`
\set p `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -Atc "select user_id from profiles where email = 'izvodjac@test.zadatak'"`
set session_replication_role = replica;
delete from public.listings where id in ('5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002');
insert into public.listings (id, user_id, title, description, category, location, price, status, lat, lng) values
  ('5e000000-0000-0000-0000-000000000001', :'c', 'Test doseg malo', 'Opis posla za test dosega', 'Vodoinstalater', 'Sarajevo', 40, 'published', 43.856, 18.413),
  ('5e000000-0000-0000-0000-000000000002', :'c', 'Test doseg veliko', 'Opis posla za test dosega', 'Vodoinstalater', 'Sarajevo', 400, 'published', 43.856, 18.413);
set session_replication_role = origin;
delete from public.device_locations where user_id = :'p';

select 'tiers' as expect, public.listing_reach_km(40, null) = 10 and public.listing_reach_km(100, null) = 25
  and public.listing_reach_km(200, 0) = 50 and public.listing_reach_km(300, 0) is null and public.listing_reach_km(null, null) = 25
  and public.listing_reach_km(40, 20) = 25 as ok;

begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'outside BiH is ignored: f' as expect, public.report_device_location(48.2, 16.37);
select 'Mostar saved: t' as expect, public.report_device_location(43.343, 17.808, 30);
select 'too_far ~70 km' as expect, reason, distance_km, reach_km from public.listing_reach('5e000000-0000-0000-0000-000000000001');
select 'no_limit on 400 KM' as expect, reason, can_offer from public.listing_reach('5e000000-0000-0000-0000-000000000002');
commit;

begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR PREDALEKO bid' as expect;
insert into public.bids (listing_id, bidder_id, amount, message) values ('5e000000-0000-0000-0000-000000000001', :'p', 40, 'Mogu doći sutra ujutro');
rollback;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR PREDALEKO question' as expect;
insert into public.listing_questions (listing_id, user_id, body) values ('5e000000-0000-0000-0000-000000000001', :'p', 'Koji je tačan kvar?');
rollback;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR not too far on 400 KM job' as expect;
select public.request_travel('5e000000-0000-0000-0000-000000000002', 'gorivo', 20);
rollback;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR amount' as expect; select public.request_travel('5e000000-0000-0000-0000-000000000001', 'gorivo', 5000);
rollback;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR Rule 1 note' as expect; select public.request_travel('5e000000-0000-0000-0000-000000000001', 'gorivo', 20, 'zovi me 061 123 456');
rollback;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'request sent' as expect, public.request_travel('5e000000-0000-0000-0000-000000000001', 'taksi', 25, 'Dolazim autobusom pa taksijem') is not null as ok;
commit;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR second request' as expect; select public.request_travel('5e000000-0000-0000-0000-000000000001', 'taksi', 25);
rollback;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR provider cannot accept own request' as expect;
select public.answer_travel_request((select id from public.travel_requests where listing_id = '5e000000-0000-0000-0000-000000000001'), true);
rollback;

begin; select set_config('request.jwt.claim.sub', :'c', true); set local role authenticated;
select 'client sees 1 pending' as expect, count(*), max(status) from public.travel_requests where listing_id = '5e000000-0000-0000-0000-000000000001';
select 'client notified' as expect, count(*) from public.notifications where user_id = :'c' and title = 'Molba za plaćen prevoz' and created_at > now() - interval '1 minute';
select 'accepted' as expect, public.answer_travel_request((select id from public.travel_requests where listing_id = '5e000000-0000-0000-0000-000000000001'), true);
commit;

begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'travel_ok' as expect, reason, can_offer from public.listing_reach('5e000000-0000-0000-0000-000000000001');
select 'bid goes through' as expect;
insert into public.bids (listing_id, bidder_id, amount, message) values ('5e000000-0000-0000-0000-000000000001', :'p', 40, 'Mogu doći sutra ujutro') returning status;
rollback;

begin; set local role anon;
select 'signed out: reach only' as expect, reason, reach_km from public.listing_reach('5e000000-0000-0000-0000-000000000001');
select 'ERROR anon cannot read' as expect; select count(*) from public.travel_requests;
rollback;

-- clean up
delete from public.listings where id in ('5e000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000002');
delete from public.device_locations where user_id = :'p';
