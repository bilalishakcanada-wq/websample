-- Trust levels, instant badges and "last seen".
--
-- trust_summary(user_id) is the single explainable answer to "how much can I
-- trust this person". Tiers, in order:
--   new         - joined within 7 days, no reviews yet
--   unverified  - trade not verified (however good the reviews are; good
--                 reviews alone never make a profile fully trusted)
--   verified    - trade verified by an admin
--   trusted     - verified + 3 or more reviews averaging 4.5+
--   top         - verified + 10 or more reviews averaging 4.8+
-- The 0-100 score reuses provider_metrics() (Bayesian-shrunk rating) so a
-- single 5-star review cannot inflate it.
--
-- Badges used to be awarded only by the nightly job; refresh_user_badges()
-- now runs from triggers on reviews and bid status changes, so a badge lands
-- the moment the qualifying event happens. The nightly job walks all users
-- as a safety net.

alter table public.profiles add column if not exists last_seen_at timestamptz;

create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public
as $$ update public.profiles set last_seen_at = now() where user_id = auth.uid(); $$;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

create or replace view public.public_profiles as
  select user_id, full_name, city, bio, avatar_url, created_at, display_uid,
         account_type, trades, verified_trade, last_seen_at
  from public.profiles where account_status = 'active';

-- See the applied migration `trust_levels_instant_badges_last_seen` for the
-- full bodies of refresh_user_badges(uuid), the two trigger functions, the
-- rewritten refresh_provider_badges() and trust_summary(uuid). Grants:
--   refresh_user_badges           -> no client role (trigger/owner only)
--   on_*_refresh_badges           -> no client role (trigger only)
--   trust_summary                 -> anon, authenticated (public profile data)
--   refresh_provider_badges       -> authenticated, admin-checked inside
