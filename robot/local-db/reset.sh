#!/usr/bin/env bash
# Puts the local test accounts back into their starting state (identity approved, 5000 KM for the
# client, nobody suspended). The identity test leaves the worker "submitted", so run this between test rounds.
set -euo pipefail
export PGPASSWORD=postgres
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set session_replication_role = replica;  -- triggers would revert balance / identity_state
update profiles set onboarding_completed = true, city = 'Sarajevo' where email in ('klijent@test.poso','izvodjac@test.poso','admin@test.poso');
update profiles set account_type = 'provider', trades = array['Vodoinstalater','Električar'] where email = 'izvodjac@test.poso';
update profiles set identity_state = 'approved' where email in ('klijent@test.poso','izvodjac@test.poso','admin@test.poso');
update profiles set balance = 5000 where email = 'klijent@test.poso';
-- the robot types odd text; a Rule #1 suspension would stop the next run from sending offers
update profiles set account_status = 'active', suspended_until = null where email like '%@test.poso';
reset session_replication_role;
SQL
