#!/usr/bin/env bash
# Private local copy of the Zadatak database with test accounts, for the robot and the e2e tests.
# Nothing here touches the live site. Needs Docker and Node (the Supabase CLI runs through npx).
#   bash robot/local-db/setup.sh            (from the repo root)
# Afterwards .env.local points the site at the local database; build and serve with
#   npx vite build && npx vite preview --port 4175
# Test logins (password Test12345!): klijent@test.zadatak (client, ID approved, 5000 KM),
# izvodjac@test.zadatak (worker, ID approved), admin@test.zadatak (ADMIN), novi@test.zadatak (fresh account),
# majstor@test.zadatak (worker with every badge a job can require: the tester shortcut, only in this local copy).
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../.." && pwd)
HERE="$REPO/robot/local-db"
export PGPASSWORD=postgres
P="psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -q"

docker info >/dev/null 2>&1 || { (sudo -n dockerd >/tmp/dockerd.log 2>&1 || dockerd >/tmp/dockerd.log 2>&1 &); sleep 8; }
cd "$HERE"
npx -y supabase@2 start -x studio,imgproxy,logflare,vector,supavisor,edge-runtime,mailpit,postgres-meta

$P -c "create extension if not exists pg_cron; create extension if not exists pg_net; create extension if not exists pg_trgm schema extensions; create extension if not exists unaccent schema extensions;"
# 1. the base schema, then the live database's migrations (snapshot of supabase_migrations, 2026-09-26)
$P -f "$REPO/supabase/schema.sql" >/dev/null 2>&1 || true
for f in "$HERE"/migrations/*.sql; do $P -f "$f" >/dev/null || { echo "FAILED at $f"; exit 1; }; done
# 2. SQL applied live after the snapshot, in the live order, then the 06.10.2026 rollout of everything
#    else (supabase/rollout/: the same file that goes to the live database), then SQL that open work adds
#    (only files present in this checkout)
for f in identity/bids_require_verified security/05_marketplace_scam_guards payments/01_card_topup_and_payouts \
         airtasker/01_task_schedule_and_expiry airtasker/02_search_due_dates airtasker/03_saved_tasks airtasker/05_quote_requests \
         branding/01_zadatak_rebrand security/08_safe_file_links identity/jobs_require_verified identity/beta_skip_identity \
         badges/01_badge_ranking rollout/2026-10-06_all_pending; do
  [ -f "$REPO/supabase/$f.sql" ] || continue
  echo "applying supabase/$f.sql"
  $P -f "$REPO/supabase/$f.sql" >/dev/null || { echo "FAILED at supabase/$f.sql"; exit 1; }
done
# the live site runs the beta without ID checks; the tests cover the ID gate, so it stays on here
$P -c "update public.verification_policy set require_for_jobs = true, require_for_bids = true where id;"

# 3. database checks (Rule #1 false positives, …)
$P -f "$HERE/checks.sql"

STATUS=$(npx -y supabase@2 status -o json)
SR=$(echo "$STATUS" | python3 -c "import sys,json;print(json.load(sys.stdin)['SERVICE_ROLE_KEY'])")
ANON=$(echo "$STATUS" | python3 -c "import sys,json;print(json.load(sys.stdin)['ANON_KEY'])")
for u in klijent izvodjac admin novi majstor; do
  curl -s -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SR" -H "Authorization: Bearer $SR" -H 'content-type: application/json' \
    -d "{\"email\":\"$u@test.zadatak\",\"password\":\"Test12345!\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Test $u Korisnik\"}}" >/dev/null
done
bash "$HERE/reset.sh"
$P <<'SQL'
insert into user_roles(user_id, role_id) select p.user_id, r.id from profiles p, roles r where p.email = 'admin@test.zadatak' and r.name = 'ADMIN' on conflict do nothing;
SQL
printf 'VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_ANON_KEY=%s\nVITE_NO_PWA=1\n' "$ANON" > "$REPO/.env.local"
echo "ROBOT_SUPABASE_ANON_KEY=$ANON" > "$HERE/.anon"
echo "Local database ready; .env.local written (gitignored)."
