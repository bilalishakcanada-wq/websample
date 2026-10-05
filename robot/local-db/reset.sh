#!/usr/bin/env bash
# Puts the local test accounts back into their starting state (identity approved, 5000 KM for the
# client, nobody suspended). The identity test leaves the worker "submitted", so run this between test rounds.
set -euo pipefail
export PGPASSWORD=postgres
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set session_replication_role = replica;  -- triggers would revert balance / identity_state
update profiles set onboarding_completed = true, city = 'Sarajevo' where email in ('klijent@test.zadatak','izvodjac@test.zadatak','admin@test.zadatak');
update profiles set account_type = 'provider', trades = array['Vodoinstalater','Električar'] where email in ('izvodjac@test.zadatak','majstor@test.zadatak');
update profiles set onboarding_completed = true, city = 'Sarajevo' where email = 'majstor@test.zadatak';
update profiles set identity_state = 'approved' where email in ('klijent@test.zadatak','izvodjac@test.zadatak','admin@test.zadatak','majstor@test.zadatak');
update profiles set balance = 5000 where email = 'klijent@test.zadatak';
-- the robot types odd text; a Rule #1 suspension would stop the next run from sending offers
update profiles set account_status = 'active', suspended_until = null where email like '%@test.zadatak';
reset session_replication_role;
-- majstor@ holds every badge a client can require (test shortcut instead of uploading documents);
-- izvodjac@ holds none of them, so the job-conditions test sees both sides
select set_badge(p.user_id, c, true) from profiles p, unnest(array['id_verified','mobile_verified','police_check','payment_verified',
  'licence_electrician','licence_plumber','licence_gas','licence_hvac','licence_construction','licence_driver']) c
where p.email = 'majstor@test.zadatak';
delete from user_badges ub using badges b, profiles p
where ub.badge_id = b.id and ub.user_id = p.user_id and p.email = 'izvodjac@test.zadatak'
  and (b.code like 'licence_%' or b.code in ('police_check','mobile_verified','payment_verified'));
SQL
