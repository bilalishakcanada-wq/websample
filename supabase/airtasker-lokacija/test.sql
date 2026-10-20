-- Scenario check for 01–03 on the robot's local database (robot/local-db/setup.sh):
-- klijent@ posts a 40 KM job in Sarajevo, izvodjac@ is in Mostar (~70 km).
-- psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/airtasker-lokacija/test.sql
-- Every ERROR line is an expected refusal; the 'expect' column says what each line should show.
\set ON_ERROR_STOP 0
\set c `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -Atc "select user_id from profiles where email = 'klijent@test.zadatak'"`
\set p `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -Atc "select user_id from profiles where email = 'izvodjac@test.zadatak'"`
\set n `psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -Atc "select user_id from profiles where email = 'novi@test.zadatak'"`
set session_replication_role = replica;
delete from public.listings where id in ('5e100000-0000-0000-0000-000000000001', '5e100000-0000-0000-0000-000000000002');
delete from public.task_alerts where user_id in (:'p', :'n');
set session_replication_role = origin;
delete from public.device_locations where user_id = :'p';
insert into public.device_locations (user_id, lat, lng, updated_at) values (:'p', 43.343, 17.808, now())
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();

-- 1. no reach: a provider 70 km away offers and asks on a cheap job
set session_replication_role = replica;
insert into public.listings (id, user_id, title, description, category, location, price, status, lat, lng) values
  ('5e100000-0000-0000-0000-000000000001', :'c', 'Test bez dosega', 'Opis posla za test bez dosega', 'Vodoinstalater', 'Sarajevo', 40, 'published', 43.856, 18.413);
set session_replication_role = origin;
select 'no limit: t' as expect, public.listing_reach_km(40, null) is null as ok;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'no_limit, ~70 km, can offer' as expect, reason, distance_km, can_offer from public.listing_reach('5e100000-0000-0000-0000-000000000001');
select 'question saved' as expect;
insert into public.listing_questions (listing_id, user_id, body) values ('5e100000-0000-0000-0000-000000000001', :'p', 'Koji je tačan kvar na česmi?');
select 'bid saved' as expect;
insert into public.bids (listing_id, bidder_id, amount, message) values ('5e100000-0000-0000-0000-000000000001', :'p', 40, 'Mogu doći sutra ujutro');
rollback;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'ERROR MOLBA_NIJE_MOGUCA' as expect; select public.request_travel('5e100000-0000-0000-0000-000000000001', 'gorivo', 20);
rollback;

-- 2. Odakle / Dokle
begin; select set_config('request.jwt.claim.sub', :'c', true); set local role authenticated;
insert into public.listings (id, user_id, title, description, category, location, dropoff_location, price, status)
values ('5e100000-0000-0000-0000-000000000002', :'c', 'Test selidba kauča', 'Treba prevesti kauč iz stana u stan', 'Selidbe i transport', 'Sarajevo', 'Mostar', 60, 'published');
select 'dropoff point ~Mostar, rounded' as expect, dropoff_location, dropoff_lat, dropoff_lng from public.listings where id = '5e100000-0000-0000-0000-000000000002';
select 'street saved' as expect, public.set_listing_dropoff_address('5e100000-0000-0000-0000-000000000002', 'Maršala Tita 10', 43.34567, 17.81234, 10, 'typed');
select 'public point = rounded street (43.35, 17.81)' as expect, dropoff_lat, dropoff_lng from public.listings where id = '5e100000-0000-0000-0000-000000000002';
select 'owner sees street' as expect, address from public.listing_dropoff_address('5e100000-0000-0000-0000-000000000002');
commit;
begin; select set_config('request.jwt.claim.sub', :'p', true); set local role authenticated;
select 'provider sees nothing (0 rows)' as expect, count(*) from public.listing_dropoff_address('5e100000-0000-0000-0000-000000000002');
select 'provider table read: 0 rows' as expect, count(*) from public.listing_dropoff_addresses;
select 'ERROR not owner' as expect; select public.set_listing_dropoff_address('5e100000-0000-0000-0000-000000000002', 'x', 43.3, 17.8);
rollback;
begin; select set_config('request.jwt.claim.sub', :'c', true); set local role authenticated;
select 'ERROR Rule 1 in place name' as expect;
update public.listings set dropoff_location = 'Mostar zovi 061 123 456' where id = '5e100000-0000-0000-0000-000000000002';
rollback;
begin; select set_config('request.jwt.claim.sub', :'c', true); set local role authenticated;
update public.listings set dropoff_location = 'Zenica' where id = '5e100000-0000-0000-0000-000000000002';
select 'new place: street gone, point ~Zenica' as expect, dropoff_lat, dropoff_lng, (select count(*) from public.listing_dropoff_addresses where listing_id = '5e100000-0000-0000-0000-000000000002') as streets from public.listings where id = '5e100000-0000-0000-0000-000000000002';
update public.listings set dropoff_location = null where id = '5e100000-0000-0000-0000-000000000002';
select 'cleared: all null' as expect, dropoff_location, dropoff_lat from public.listings where id = '5e100000-0000-0000-0000-000000000002';
commit;

-- 3. alerts: Mostar +100 km catches a Sarajevo job (~70 km), Mostar only and +25 km don't; online-only doesn't
insert into public.task_alerts (user_id, city, radius_km, mode) values (:'p', 'Mostar', 100, 'all');
insert into public.task_alerts (user_id, city, radius_km, mode) values (:'n', 'Mostar', 25, 'all');
insert into public.task_alerts (user_id, city, mode) values (:'n', 'Mostar', 'in_person');
insert into public.task_alerts (user_id, mode) values (:'n', 'remote');
select 'ERROR bad mode' as expect; insert into public.task_alerts (user_id, mode) values (:'n', 'svugdje');
select 'matches: p t, n f f f' as expect, t.user_id = :'p' as is_p, t.city, t.radius_km, t.mode, public.task_alert_matches(t, l) as hit
from public.task_alerts t, public.listings l where l.id = '5e100000-0000-0000-0000-000000000001' and t.user_id in (:'p', :'n') order by is_p desc, t.radius_km nulls last;
select 'online job reaches remote + all, not in_person' as expect, t.mode, t.radius_km, public.task_alert_matches(t, jsonb_populate_record(l, '{"location": "Online / na daljinu"}')) as hit
from public.task_alerts t, public.listings l where l.id = '5e100000-0000-0000-0000-000000000001' and t.user_id in (:'p', :'n') order by t.mode, t.radius_km;

set session_replication_role = replica;
delete from public.listings where id in ('5e100000-0000-0000-0000-000000000001', '5e100000-0000-0000-0000-000000000002');
delete from public.task_alerts where user_id in (:'p', :'n');
set session_replication_role = origin;
