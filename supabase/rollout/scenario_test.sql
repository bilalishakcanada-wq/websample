-- Scenario test for the rollout bundle (2026-10-06_all_pending.sql), run on a LOCAL copy only:
--   psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/rollout/scenario_test.sql
-- Plays clients and workers through every feature of the bundle at once (conditions, reach, rebids,
-- escrow guards, photo proof, price increase, live location, cancellation fee, promotion, offer replies,
-- private files, signed-in-only functions). Everything happens in one transaction that is rolled back.
-- Prints "SCENARIO OK" at the end; any failed expectation stops the script with "TEST FAIL".
\set QUIET on
begin;
set local lock_timeout = '10s';

-- ------------------------------------------------------------------ helpers (rolled back)
create function public.t_expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'TEST FAIL: expected error % from: %', p_pattern, p_sql;
exception when others then
  if sqlerrm like 'TEST FAIL%' then raise; end if;
  if sqlerrm !~ p_pattern then raise exception 'TEST FAIL: expected % but got "%" from: %', p_pattern, sqlerrm, p_sql; end if;
end $$;
create function public.t_check(p_ok boolean, p_what text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'TEST FAIL: %', p_what; end if;
end $$;
grant execute on function public.t_expect_error(text, text), public.t_check(boolean, text) to anon, authenticated;

-- ------------------------------------------------------------------ people
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role, created_at, updated_at) values
  ('00000000-0000-4000-a000-0000000000c1', 't-klijent@scenario.test', now(), '{"full_name":"Klijent Test"}', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-4000-a000-0000000000b1', 't-izvodjac@scenario.test', now(), '{"full_name":"Izvodjac Bezznacke","account_type":"provider"}', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-4000-a000-0000000000b2', 't-majstor@scenario.test', now(), '{"full_name":"Majstor Plinar","account_type":"provider"}', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-4000-a000-0000000000b3', 't-mostar@scenario.test', now(), '{"full_name":"Daleki Izvodjac","account_type":"provider"}', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-4000-a000-0000000000d1', 't-stranac@scenario.test', now(), '{"full_name":"Neki Stranac"}', 'authenticated', 'authenticated', now(), now()),
  ('00000000-0000-4000-a000-0000000000e1', 't-znacka@scenario.test', now(), '{"full_name":"Samo Znacka"}', 'authenticated', 'authenticated', now(), now());

set local session_replication_role = replica;   -- profile system fields are protected by triggers
update public.profiles set identity_state = 'approved', city = 'Sarajevo', onboarding_completed = true
 where user_id in ('00000000-0000-4000-a000-0000000000c1', '00000000-0000-4000-a000-0000000000b1', '00000000-0000-4000-a000-0000000000b2', '00000000-0000-4000-a000-0000000000d1');
update public.profiles set identity_state = 'approved', city = 'Mostar', onboarding_completed = true where user_id = '00000000-0000-4000-a000-0000000000b3';
update public.profiles set balance = 1000 where user_id = '00000000-0000-4000-a000-0000000000c1';
reset session_replication_role;
set local session_replication_role = origin;

select public.set_badge('00000000-0000-4000-a000-0000000000b2', 'licence_gas', true);
select public.set_badge('00000000-0000-4000-a000-0000000000e1', 'id_verified', true);
update public.verification_policy set require_for_jobs = true, require_for_bids = true where id;

-- ------------------------------------------------------------------ identity/id_badge_counts
select public.t_check(public.identity_verified('00000000-0000-4000-a000-0000000000e1'), 'id_verified badge counts as verified identity');
select public.t_check(not public.identity_verified('00000000-0000-4000-a000-0000000000b9'), 'unknown user is not verified');

-- ------------------------------------------------------------------ security/07
select public.t_check(not public.phone_run_hit('Zato sto se ne javite ranije?'), 'ordinary sentence is not a phone number');
select public.t_check(not public.phone_run_hit('Ostale stolice i tabla se nose'), 'ordinary sentence 2');
select public.t_check(public.phone_run_hit('061 234 567'), 'real phone number is caught');
select public.t_check(public.phone_run_hit('o61 2e4 s67'), 'obfuscated phone number is caught');

-- ------------------------------------------------------------------ client posts two jobs
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
insert into public.listings (id, user_id, title, description, category, location, price, status, lat, lng, conditions)
values ('00000000-0000-4000-a000-00000000a001', '00000000-0000-4000-a000-0000000000c1', 'Servis plinskog bojlera',
        'Treba servisirati plinski bojler u stanu, ima dokumentacija.', 'Plin', 'Sarajevo', 100, 'published', 43.8563, 18.4131,
        '{"requires":["licence_gas"],"perks":["parking"]}'),
       ('00000000-0000-4000-a000-00000000a002', '00000000-0000-4000-a000-0000000000c1', 'Montaža police u dnevnom boravku',
        'Treba montirati dvije police na zid od cigle, imam sav materijal.', 'Montaža', 'Sarajevo', 30, 'published', 43.8563, 18.4131, '{}');
-- a client can't buy promotion by writing the columns directly
update public.listings set promotion_tier = 'vip', promoted_until = now() + interval '30 days' where id = '00000000-0000-4000-a000-00000000a002';
select public.t_check((select promotion_tier = 'standard' and promoted_until is null from public.listings where id = '00000000-0000-4000-a000-00000000a002'), 'promotion columns are guarded');
-- conditions must be valid codes
select public.t_expect_error($$update public.listings set conditions = '{"requires":["hacker"]}' where id = '00000000-0000-4000-a000-00000000a002'$$, 'listings_conditions_check');
-- a job without an accepted offer can't be marked done
select public.t_expect_error($$update public.listings set status = 'completed' where id = '00000000-0000-4000-a000-00000000a002'$$, 'STATUS_ZABRANJEN');
-- pause and publish again is still the owner's call
update public.listings set status = 'paused' where id = '00000000-0000-4000-a000-00000000a002';
update public.listings set status = 'published' where id = '00000000-0000-4000-a000-00000000a002';
select public.t_check((select status = 'published' from public.listings where id = '00000000-0000-4000-a000-00000000a002'), 'owner can pause and publish');

-- ------------------------------------------------------------------ offers: conditions, reach, rebids
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
select public.t_expect_error($$insert into public.bids (listing_id, bidder_id, amount, message) values ('00000000-0000-4000-a000-00000000a001', '00000000-0000-4000-a000-0000000000b1', 80, 'Mogu sutra ujutro, imam iskustva.')$$, 'USLOV_POSLA');
insert into public.bids (id, listing_id, bidder_id, amount, message) values ('00000000-0000-4000-a000-00000000b101', '00000000-0000-4000-a000-00000000a002', '00000000-0000-4000-a000-0000000000b1', 30, 'Mogu danas popodne, imam bušilicu.');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b3","role":"authenticated"}';
select public.t_expect_error($$insert into public.bids (listing_id, bidder_id, amount, message) values ('00000000-0000-4000-a000-00000000a002', '00000000-0000-4000-a000-0000000000b3', 30, 'Dolazim iz Mostara.')$$, 'PREDALEKO');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
insert into public.bids (id, listing_id, bidder_id, amount, message) values ('00000000-0000-4000-a000-00000000b201', '00000000-0000-4000-a000-00000000a001', '00000000-0000-4000-a000-0000000000b2', 90, 'Licencirani plinar, servis sa zapisnikom.');
select public.t_expect_error($$insert into public.bids (listing_id, bidder_id, amount, message) values ('00000000-0000-4000-a000-00000000a001', '00000000-0000-4000-a000-0000000000b2', 95, 'Još jedna ponuda.')$$, 'PONUDA_VEC_CEKA');

-- blind bids: the worker sees only his own offer and no list of other bidders
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
select public.t_check((select count(*) from public.bidder_metrics('00000000-0000-4000-a000-00000000a001')) = 0, 'bidder list hidden from other workers');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.t_check((select count(*) from public.bidder_metrics('00000000-0000-4000-a000-00000000a001')) = 1, 'owner sees bidder metrics');
update public.bids set status = 'rejected' where id = '00000000-0000-4000-a000-00000000b201';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
select public.t_check((select title like 'Klijent je odbio ponudu od 90 KM%' and link = '/listings/00000000-0000-4000-a000-00000000a001'
                         from public.notifications where user_id = '00000000-0000-4000-a000-0000000000b2' and type = 'offer_rejected'), 'rejection invites a new price');
select public.t_expect_error($$insert into public.bids (listing_id, bidder_id, amount, message) values ('00000000-0000-4000-a000-00000000a001', '00000000-0000-4000-a000-0000000000b2', 90, 'Ista cijena.')$$, 'ISTA_CIJENA');
insert into public.bids (id, listing_id, bidder_id, amount, message) values ('00000000-0000-4000-a000-00000000b202', '00000000-0000-4000-a000-00000000a001', '00000000-0000-4000-a000-0000000000b2', 85, 'Može 85 KM, uključen zapisnik.');

-- ------------------------------------------------------------------ offer replies (bid_replies)
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
insert into public.bid_replies (bid_id, body) values ('00000000-0000-4000-a000-00000000b101', 'Možete li doći poslije 17h?');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
select public.t_check((select count(*) from public.bid_replies where bid_id = '00000000-0000-4000-a000-00000000b101') = 1, 'worker sees the reply under his offer');
update public.bids set amount = 35 where id = '00000000-0000-4000-a000-00000000b101';
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}';
select public.t_check((select count(*) from public.bid_replies) = 0, 'a stranger sees no offer replies');
select public.t_expect_error($$insert into public.bid_replies (bid_id, body) values ('00000000-0000-4000-a000-00000000b101', 'upadam')$$, 'row-level security');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.t_check(exists (select 1 from public.notifications where user_id = '00000000-0000-4000-a000-0000000000c1' and type = 'offer_updated'), 'client told when an offer changes');

-- ------------------------------------------------------------------ promotion (marketplace/01)
select public.t_check((public.promotion_options()->'plans'->0->>'tier') = 'hitno', 'promotion plans visible');
select public.promote_listing('00000000-0000-4000-a000-00000000a002', 'hitno');
select public.t_expect_error($$select public.promote_listing('00000000-0000-4000-a000-00000000a002', 'hitno')$$, 'IZDVAJANJE_VEC_AKTIVNO');
select public.promote_listing('00000000-0000-4000-a000-00000000a002', 'vip');
select public.t_check((select balance from public.profiles where user_id = '00000000-0000-4000-a000-0000000000c1') = 980, 'promotion paid from the balance (5 + 15 KM)');
select public.t_check((select count(*) from public.promoted_listings('', '', 43.85, 18.41, 25)) = 1, 'promoted job shows in its radius');
select public.t_check((select count(*) from public.promoted_listings('', '', 44.54, 18.67, 25)) = 0, 'promoted job not shown far away');

-- ------------------------------------------------------------------ accept + escrow (booking/04)
select public.accept_offer_and_fund('00000000-0000-4000-a000-00000000b202', 85);
select public.t_check((select status = 'funded' and work_state = 'in_progress' and proof_required from public.job_payments where listing_id = '00000000-0000-4000-a000-00000000a001'), 'contract funded, photo proof required on site');
select public.t_expect_error($$update public.listings set status = 'published' where id = '00000000-0000-4000-a000-00000000a001'$$, 'STATUS_ZAKLJUCAN');
select public.t_expect_error($$update public.listings set conditions = '{}' where id = '00000000-0000-4000-a000-00000000a001'$$, 'USLOVI_ZAKLJUCANI');
select public.t_expect_error($$select public.job_transition((select id from public.job_payments where listing_id = '00000000-0000-4000-a000-00000000a001'), 'cancelled', '{}'::jsonb)$$, 'permission denied');
reset role;
-- an escrow row without money taken in the same transaction is refused even for the database owner
select public.t_expect_error($$insert into public.job_payments (listing_id, bid_id, client_id, provider_id, amount, fee_percent, fee_amount, net_amount)
  values ('00000000-0000-4000-a000-00000000a002', '00000000-0000-4000-a000-00000000b101', '00000000-0000-4000-a000-0000000000c1', '00000000-0000-4000-a000-0000000000b1', 35, 10, 3.5, 31.5)$$, 'ESCROW_NIJE_OSIGURAN');
set local role authenticated;

-- ------------------------------------------------------------------ live location (booking/05)
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
select public.share_live_location('00000000-0000-4000-a000-00000000a001', 43.85, 18.40, 12, 90, 8);
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.t_check((select count(*) from public.job_live_locations) = 1, 'client sees the worker on the way');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}';
select public.t_check((select count(*) from public.job_live_locations) = 0, 'a stranger does not');
select public.t_expect_error($$select public.share_live_location('00000000-0000-4000-a000-00000000a001', 43.85, 18.40)$$, 'FORBIDDEN');

-- ------------------------------------------------------------------ price increase (payments/02 + booking/04 guard)
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
select public.request_price_increase('00000000-0000-4000-a000-00000000a001', 20, 'Treba zamijeniti ventil, nije bio u dogovoru.');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.respond_price_increase((select id from public.price_increase_requests where state = 'pending'), true);
select public.t_check((select amount = 105 and fee_amount = round(105 * fee_percent / 100, 2) from public.job_payments where listing_id = '00000000-0000-4000-a000-00000000a001'), 'price raised to 105 KM and secured');
select public.t_check((select balance from public.profiles where user_id = '00000000-0000-4000-a000-0000000000c1') = 875, 'balance after 85 + 20 KM escrow');

-- ------------------------------------------------------------------ photo proof (booking/04 + private files)
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b2","role":"authenticated"}';
select public.t_expect_error($$select public.submit_work('00000000-0000-4000-a000-00000000a001', 'Bojler je servisiran, zapisnik u prilogu.', '{}')$$, 'FOTO_PRIJE_OBAVEZAN');
select public.t_expect_error($$select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'after', 'private:uploads/00000000-0000-4000-a000-0000000000b2/work/00000000-0000-4000-a000-00000000a001/after.jpg', repeat('a', 64), 43.8563, 18.4131, 15, now())$$, 'PRVO_SLIKA_PRIJE');
select public.t_expect_error($$select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'before', 'https://evil.example/x.jpg', repeat('b', 64), 43.8563, 18.4131, 15, now())$$, 'DOKAZ_NEISPRAVAN');
select public.t_expect_error($$select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'before', 'private:uploads/00000000-0000-4000-a000-0000000000b1/work/00000000-0000-4000-a000-00000000a001/x.jpg', repeat('b', 64), 43.8563, 18.4131, 15, now())$$, 'DOKAZ_NEISPRAVAN');
select public.t_expect_error($$select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'before', 'private:uploads/00000000-0000-4000-a000-0000000000b2/work/00000000-0000-4000-a000-00000000a001/../../x.jpg', repeat('b', 64), 43.8563, 18.4131, 15, now())$$, 'DOKAZ_NEISPRAVAN');
select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'before', 'private:uploads/00000000-0000-4000-a000-0000000000b2/work/00000000-0000-4000-a000-00000000a001/proof-before-1.jpg', repeat('c', 64), 43.8565, 18.4133, 15, now());
-- the old public path (app versions before private files) still works
select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'before', 'http://127.0.0.1:54321/storage/v1/object/public/media/00000000-0000-4000-a000-0000000000b2/proof/p/before-2.jpg', repeat('d', 64), 43.8565, 18.4133, 15, now());
select public.t_expect_error($$select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'after', 'private:uploads/00000000-0000-4000-a000-0000000000b2/work/00000000-0000-4000-a000-00000000a001/again.jpg', repeat('c', 64), 43.8565, 18.4133, 15, now())$$, 'DOKAZ_VEC_KORISTEN');
select public.t_expect_error($$select public.submit_work('00000000-0000-4000-a000-00000000a001', 'Bojler je servisiran, zapisnik u prilogu.', '{}')$$, 'FOTO_POSLIJE_OBAVEZAN');
select public.add_work_proof('00000000-0000-4000-a000-00000000a001', 'after', 'private:uploads/00000000-0000-4000-a000-0000000000b2/work/00000000-0000-4000-a000-00000000a001/proof-after-1.jpg', repeat('e', 64), 43.8565, 18.4133, 15, now());
select public.t_check((select distance_m < 100 from public.work_proofs where sha256 = repeat('e', 64)), 'distance from the job is recorded');
select public.submit_work('00000000-0000-4000-a000-00000000a001', 'Bojler je servisiran, zapisnik u prilogu.',
  array['private:uploads/00000000-0000-4000-a000-0000000000b2/work/00000000-0000-4000-a000-00000000a001/zapisnik.jpg']);
select public.t_check((select count(*) from public.job_live_locations) = 0, 'live location stops when work is handed in');

-- ------------------------------------------------------------------ private files (security/06)
reset role;
insert into storage.objects (bucket_id, name, owner_id) values
  ('uploads', '00000000-0000-4000-a000-0000000000b2/work/00000000-0000-4000-a000-00000000a001/proof-after-1.jpg', '00000000-0000-4000-a000-0000000000b2'),
  ('media', '00000000-0000-4000-a000-0000000000c1/identity-doc-1790884804565.jpeg', '00000000-0000-4000-a000-0000000000c1'),
  ('media', '00000000-0000-4000-a000-0000000000c1/listings/00000000-0000-4000-a000-00000000a002/slika.jpg', '00000000-0000-4000-a000-0000000000c1'),
  ('media', '00000000-0000-4000-a000-0000000000c1/1790884804565.webp', '00000000-0000-4000-a000-0000000000c1');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.t_check((select count(*) from storage.objects where bucket_id = 'uploads') = 1, 'client opens the photo proof of his job');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}';
select public.t_check((select count(*) from storage.objects where bucket_id = 'uploads') = 0, 'a stranger cannot');
select public.t_check((select count(*) from storage.objects where bucket_id = 'media' and name like '00000000-0000-4000-a000-0000000000c1/%') = 2, 'others list only job photos and portfolio in media');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select public.t_check((select count(*) from storage.objects where bucket_id = 'media' and name like '%identity-doc%') = 0, 'guests cannot list old documents');
select public.t_check(public.private_uploads_enabled(), 'site can see private files are on');

-- ------------------------------------------------------------------ signed-in only (security/09)
select public.t_expect_error($$select * from public.my_inbox()$$, 'permission denied');
select public.t_expect_error($$select public.request_cancellation('00000000-0000-4000-a000-00000000a001', 'other')$$, 'permission denied');
select public.t_check((select count(*) from public.search_listings('', '', 43.8563, 18.4131, 25, true, null, null, false, false, 'closest', 50, 0)) >= 0, 'guests still search');
reset role;

-- ------------------------------------------------------------------ approve + payout
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.approve_work('00000000-0000-4000-a000-00000000a001');
select public.t_check((select status = 'released' from public.job_payments where listing_id = '00000000-0000-4000-a000-00000000a001'), 'payment released');
select public.t_check((select status = 'completed' from public.listings where id = '00000000-0000-4000-a000-00000000a001'), 'job completed');
reset role;
select public.t_check((select balance from public.profiles where user_id = '00000000-0000-4000-a000-0000000000b2') > 0, 'worker earned');

-- ------------------------------------------------------------------ cancellation with a fee (payments/02)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.accept_offer_and_fund('00000000-0000-4000-a000-00000000b101', 35);
reset role;
set local session_replication_role = replica;   -- pretend the job was funded two hours ago (after the free first hour)
update public.job_payments set funded_at = now() - interval '2 hours' where listing_id = '00000000-0000-4000-a000-00000000a002';
set local session_replication_role = origin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
select public.request_cancellation('00000000-0000-4000-a000-00000000a002', 'other', 'Ne mogu doći, razbolio sam se.', 'me');
select public.t_check((select responsible = 'provider' and fee_km = 3.5 from public.cancellation_requests where state = 'pending'), 'worker who cancels pays 10%');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}';
select public.respond_cancellation('00000000-0000-4000-a000-00000000a002', true, 'U redu.');
reset role;
select public.t_check((select status = 'refunded' from public.job_payments where listing_id = '00000000-0000-4000-a000-00000000a002'), 'client refunded');
select public.t_check((select cancel_reason = 'provider' from public.listings where id = '00000000-0000-4000-a000-00000000a002'), 'worker recorded as responsible');
select public.t_check(exists (select 1 from public.cancellation_fees where user_id = '00000000-0000-4000-a000-0000000000b1' and amount_km = 3.5), 'fee owed by the worker');
select public.t_check((select balance from public.profiles where user_id = '00000000-0000-4000-a000-0000000000c1') = 875, 'client gets the 35 KM back (875 = 980 - 85 - 20)');

-- ------------------------------------------------------------------ feeds
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-0000000000b1","role":"authenticated"}';
select public.t_check((select count(*) from public.recommended_listings(20)) >= 0, 'recommended feed works');
select public.t_check((select can_offer from public.listing_reach('00000000-0000-4000-a000-00000000a001')) is not null, 'reach check answers');
reset role;

select 'SCENARIO OK' as result;
rollback;
