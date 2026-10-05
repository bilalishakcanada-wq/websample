-- Zero-trust grants: functions that only make sense for a signed-in person are no longer callable
-- by guests (the anon key). Postgres gives EXECUTE to PUBLIC by default and Supabase also grants
-- it to anon, so both are revoked and authenticated keeps it explicitly.
--
-- The functions already check auth.uid() inside and fail for guests; this removes the guest entry
-- point altogether (the Supabase security advisor flagged 48 such functions).
--
-- Stays open to guests on purpose:
--   * helpers used inside RLS policies (is_admin, is_staff, is_suspended, is_email_verified,
--     identity_ok, i_bid_on, listing_hidden_from_me, listing_image_count): a guest reading a
--     public table evaluates its policies, so revoking them would break browsing;
--   * public pages: search_listings, search_providers, ranked_providers, platform_stats,
--     category_price_stats, public_profile_bundle, trust_summary, bidder_metrics,
--     quote_requests_enabled;
--   * claim_auth_handoff (the installed app claims the login before it has a session) and
--     log_client_error (errors on public pages).
-- Trigger functions: Postgres checks EXECUTE only when a trigger is created, never when it fires,
-- so revoking guest access changes nothing for inserts and updates; it only clears the advisor.
-- Safe to run more than once.

do $$
declare
  f regprocedure;
  -- every overload of these names is covered, so older and newer argument lists are both locked
  signed_in_only text[] := array[
    'approve_work',
    'submit_work',
    'request_revision',
    'request_cancellation',
    'respond_cancellation',
    'open_dispute',
    -- job_transition namjerno nije ovdje: booking/04 ga zatvara i za prijavljene
    -- (interni korak akcija); ova lista bi ga ponovo otvorila
    'submit_identity',
    'identity_claim_next',
    'identity_decide',
    'identity_reveal',
    'my_inbox',
    'chat_state',
    'fee_percent_for',
    'store_auth_handoff',
    'is_moderator',
    'is_staff_user'
  ];
  triggers_only text[] := array[
    'guard_bid_status_change',
    'guard_chat_lifecycle',
    'guard_identity_on_bid',
    'guard_identity_on_listing',
    'guard_listing_delete',
    'on_bid_notify',
    'on_listing_question_notify',
    'on_message_notify',
    'on_notification_push',
    'on_profile_created_welcome',
    'on_review_notify',
    'sync_listing_bid_count'
  ];
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(signed_in_only)
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(triggers_only)
  loop
    execute format('revoke execute on function %s from public, anon', f);
  end loop;
end $$;
