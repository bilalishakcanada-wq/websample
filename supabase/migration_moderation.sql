-- Rule #1 moderation engine. Final versions of every function (superseding earlier revisions).
-- Applied as Supabase migrations: moderation_scan_function(_v2), moderation_enforcement,
-- moderation_profile_strike_after, profile_bundles.

-- moderation_scan(text) -> {clean, kinds[], masked}
--   phones (+387 / 06x / spelled-out "nula šest jedan" / obfuscated "o6l 387 36l"),
--   emails ("(at)"/"[dot]" too), links, social networks in any declension, @handles, PB-XXXX-XXXX member IDs.

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  source_table text not null, source_id uuid,
  fields text[] not null default '{}', kinds text[] not null default '{}',
  snippet text,  -- always masked text
  action text not null check (action in ('masked','removed','flagged','suspended','lifted')),
  dismissed boolean not null default false, reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- RLS: admin all; owner may read their own events.

create table if not exists public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  kind text not null check (kind in ('avatar','portfolio')),
  media_url text not null, source_id uuid,
  status text not null default 'pending' check (status in ('pending','clean','flagged','error','unconfigured')),
  attempts int not null default 0, result jsonb,
  created_at timestamptz not null default now(), processed_at timestamptz
);
-- RLS: admin only (the Edge Function uses the service role).

create table if not exists public.moderation_settings (key text primary key, value text not null, updated_at timestamptz not null default now());
-- sweep_key: random secret shared between pg_cron and the moderate-media Edge Function.

-- is_suspended(): account_status = 'suspended' and (suspended_until is null or in the future)
-- apply_moderation_strike(uuid): strikes in the last 30 days -> 3: 7 days, 5: 30 days, 7: permanent; admins exempt.
-- lift_expired_suspensions(): hourly cron.  admin_lift_suspension(uuid): manual lift.
-- moderate_content(): BEFORE trigger (TG_ARGV = user column, text columns) -> masks hits, logs an event, applies a strike.
--   Installed on profiles(full_name, bio), listings(title, description), bids(message), reviews(comment),
--   portfolio_items(caption), messages(content — skipped once a bid is accepted in that conversation).
-- moderate_profile_after(): AFTER trigger on profiles applying the strike (row is mid-update in BEFORE).
-- enqueue_media_moderation(): avatar/portfolio images -> moderation_queue.
-- moderation_rescan(): nightly re-scan of profiles + listings with the current rules.
-- RLS with_check on listings/bids/messages/reviews/portfolio_items gains "and not is_suspended()".
-- Cron: moderation-lift-suspensions (hourly), moderation-rescan-nightly (03:30), moderation-media-sweep (*/5 via pg_net -> Edge Function).

-- public_profile_bundle(uuid): profile (display_name only), trust, badges, reviews, listings, portfolio in one call.
-- my_profile_bundle(): own profile incl. member_id + portfolio + verification + badges + trust + strikes + events.

-- Follow-ups applied afterwards:
--   assign_member_id() is SECURITY DEFINER (the upsert INSERT path runs it as the caller).
--   display_name_of / is_valid_full_name / moderation_scan pin search_path = public.
--   handle_verification_approved(): EXECUTE revoked from anon/authenticated (trigger-only).
--   match_providers_for_listing / conversation_contacts_allowed: authenticated only.

-- member_registry (append-only register of every account: member_id, user_id, email, name, created/deleted),
-- maintained by register_member() triggers on profiles; admin_lookup_member(term) searches it (admin only).

-- profiles.education / work_experience / specialties / transportation (text[]), exposed via public_profiles;
-- moderate_content() scans text[] columns element by element (profiles trigger covers them).
