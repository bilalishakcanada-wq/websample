# Enterprise modules: rollout plan

Status on 25.09.2026: **none of `supabase/enterprise/01–06` is applied to production.**
Nothing was applied while writing this plan. Every statement about production
below comes from read-only catalog queries against project `kshzsnceukbpwpgpicsh`
(migration list, `pg_policies`, `pg_trigger`, column/table grants) on that date.

## TL;DR

The files cannot be applied as written. Four problems make them either unsafe or
silently ineffective:

1. **`02_kyc.sql` duplicates the identity module that went live today.** Production
   already has `identity_state`, `identity_ok()`, a claim/reveal/decide queue,
   `staff_actions` audit and document retention. 02 adds a second queue, a second
   profile state (`kyc_state`) and a second audit table. Because `can_transact()`
   reads `kyc_state`, every user already approved through the identity module would
   count as **unverified**.
2. **`03` breaks the payment screens on deploy.** It revokes table-level `SELECT` on
   `job_payments`. `paymentService.js:30` does `select('*')`, so the payment card
   fails for everyone. The replacement column list and both views also leave out the
   booking columns (`work_state`, `submitted_at`, `review_deadline`,
   `revision_count`, `auto_released`) that `WorkFlow.jsx` needs, so the fix the
   README describes (switching to `my_payments_client`) isn't enough on its own.
3. **Nobody can hold a deposit.** No function, policy or PSP flow creates or tops up
   a `deposit_accounts` row, so `has_deposit()` and therefore `can_transact()` are
   false for every user. Consultation slots and bookings (04) require
   `can_transact()`, so they can't be used at all.
4. **The job/bid gate in 04 does nothing.** `listings_insert_verified` and
   `bids_insert_verified` are *permissive* policies. Postgres ORs them with the live
   `listings_insert_own` and `bids_bidder_manage`, which already let users insert.
   If they were made restrictive to fix that, point 3 would block every new job and
   bid on the platform.

A separate hole in production today should be fixed **before any of this**, because
02, 03 and 05 all add more trust columns to `profiles` in the same way:

> **`profiles.identity_state` is writable by its owner.** `authenticated` has
> table-level `UPDATE` on `profiles`, `profiles_update_own` allows any change to the
> caller's own row, and `protect_profile_system_fields()` doesn't reset
> `identity_state` or `identity_approved_at`. A signed-in user can most likely PATCH
> their own profile to `identity_state = 'approved'` and pass `identity_ok()`.
> (Inferred from grants, policy and trigger source. I didn't send the request.)
>
> Related: `identity_ok(p_user)` returns true whenever the **caller** is staff
> (`public.is_staff()` looks at `auth.uid()`, not `p_user`), so any check a staff
> member runs on behalf of another user passes.

## What each file needs

### 01_rbac.sql: additive. Safe once three things are added.

| Issue | Fix |
|---|---|
| The two existing ADMIN/MODERATOR users have no `staff_members` row. ADMIN and MODERATOR become `is_internal`, so `has_permission()` returns false for them on every new feature. | Seed `staff_members` for the current staff in the same migration. |
| `public.audit()` is `SECURITY DEFINER` and executable by `PUBLIC`, so any user can write fake rows into the append-only audit log. | `revoke execute ... from public, anon, authenticated` on `audit`, `sync_admin_permissions`. Follow the pattern in `migration_harden_function_grants.sql`. |
| MODERATOR gets no permissions in SQL, but `server/src/rbac/permissions.ts` gives it `moderation.review` + `user.read`. | Add those two rows to the seed. |

`roles.name` is unique in production, so the `on conflict (name)` in the seed works.

### 02_kyc.sql: don't apply as is. Merge it into the identity module.

- **Drop** `kyc_cases`, `kyc_documents`, `kyc_claim_next`, `kyc_decide`,
  `kyc_document_open`, `kyc_purge_*` and `profiles.kyc_state`. The identity module
  already does each of these (`identity_claim_next`, `identity_reveal`,
  `identity_decide`, `identity_purge_queue`).
- **Keep** as additions to identity: `kyc_checks` (liveness, face match, sanctions),
  `bank_name_matches`, and the AI-detection columns and thresholds on
  `moderation_queue`. Point their `case_id` FKs at the identity case table.
- **Redefine** `is_kyc_verified(p)` as `identity_state = 'approved'` on the profile.
  Owner decision: should grandfathered accounts count as verified, i.e. use
  `identity_ok()`?
- `normalize_person_name` already exists in production with `set search_path =
  public`. 02's `create or replace` would drop that hardening. Leave it out.
- `moderation_thresholds` and `kyc_purge_queue` have **no RLS** and inherit
  Supabase's default grants. Anyone could raise the AI-rejection thresholds or read
  KYC storage paths. Enable RLS on both if they're kept.

### 03_payments_deposits.sql: split into two parts.

**3a (additive, low risk):** deposit tables, `chargebacks`, `invoices`,
`payment_events` plus its trigger, `payment_breakdown()`.

**3b (breaking, ships with a frontend release):** the column revoke, the views and
the realtime swap. Before 3b:

- Add the booking columns to the column grant and to both views, or have
  `paymentService` read only the views and extend them.
- `JobPayment.jsx:128-129` shows the fee breakdown to the client, and
  `PricingPage.jsx` publishes the fee tiers. Hiding fees in the database while the
  pricing page advertises them is a **product decision to make first**.
- The realtime publication change (`drop job_payments`, `add payment_events`) and
  the `paymentService.js:105` subscription change have to go out together, or live
  updates stop.

Conflicts with the booking/security migrations already live:

| 03 adds | Production already has | Result |
|---|---|---|
| `guard_payment_finality`: refund after release allowed with Team Lead approval | `guard_payment_transition`: **no** status change out of `released`/`refunded`, ever | The approval path can never run. Pick one rule. If refund-after-release is wanted, change the existing guard. |
| `released_final` default `false` | 5 payments already `released` | The finality lock doesn't cover them until backfilled: `update job_payments set released_final = true where status = 'released'`. |
| `job_payments_no_delete` trigger | FKs `listing_id`, `client_id`, `provider_id`, `bid_id` all `ON DELETE CASCADE` | Deleting an account (`delete-account` function to `auth.users`) or a listing or bid with any payment would **fail**. The FKs need `restrict`/`set null` and an anonymisation path first. |

Deposit decisions for the owner:

- Are 2,000 / 4,000 KM real requirements?
- How is a deposit paid (PSP, bank transfer confirmed by staff)?
- Do existing users get grandfathered, the way `verification_policy.grandfather_before` works?

Until those are answered, nothing should call `can_transact()` in a policy.

### 04_jobs_geo_consulting.sql: apply without the gate.

- **Leave out** `listings_insert_verified` / `bids_insert_verified` (see TL;DR 4).
  The gate belongs in the last phase.
- `btree_gist` isn't installed. The migration has to create it (in `extensions`),
  or the exclusion constraint fails.
- `is_premium` / `is_global` can be set by the listing owner through
  `listings_update_own`. `protect_listing_system_fields` was deliberately *not*
  applied (see `booking/03_guards.sql:64`). Anyone can make a listing global.
  Reset these two columns in a trigger.
- `consultations_book` trusts the client's `provider_id` and `price_km`. `book_slot()`
  should copy both from the slot.
- `search_jobs_geo` is a new, parallel search next to the live
  `search_listings` RPCs. Nothing in the frontend calls it yet.

### 05_trust_safety.sql: apply after 04, with fixes.

- It depends on 04 (`contract_terminations.consultation_id` FK to `consultations`)
  and on 02/03 at runtime (`recompute_trust_badge` calls `is_kyc_verified`,
  `has_deposit`).
- The **second strike system**: production already has `apply_moderation_strike` /
  `moderation_events`. Decide whether moderation strikes count toward the
  3-strike suspension. Otherwise a user can have two separate strike counts.
- New `profiles` columns (`strike_count`, `public_warning_at`, `trust_badge_at`)
  must be added to `protect_profile_system_fields`. Otherwise users can clear their
  own warning and give themselves the trust badge (same hole as `identity_state`).
- `public_trust_signals` is `security_invoker` over `profiles`. Profiles RLS only
  lets a user see their own row (plus admins), so **other users and anon see
  nothing** and the public warning never shows. Use a definer function or a
  non-invoker view that exposes only these three booleans.
- `terminations_report` lets anyone report anyone about any listing. Require the
  reporter to be the listing owner or the funded provider.
- `apply_strike_effects` sets `account_status = 'suspended'`. That value is allowed
  by the live check constraint, so no conflict there.

### 06_principal.sql: restrict it.

`principal_for(p_user)` is callable by every signed-in user for **any** `p_user`, so
it leaks another user's roles, permissions and KYC state. Revoke it from
`authenticated` (only the service role needs it) or force `p_user = auth.uid()`.

### server/src: nothing to deploy yet.

`server/src/rbac/*` and `booking/booking.controller.ts` are NestJS TypeScript, but
the server that runs is plain Express (`server/index.js`). There's no `@nestjs/*`
dependency, no app module or bootstrap, and `booking/supabase.service.ts` and the
`permissions.spec.ts` mentioned in `permissions.ts` don't exist. Wiring it up is a
separate project. The database rules don't depend on it. Its only DB requirement is
`principal_for` and `audit_log` (01 + 06).

## Cross-cutting

- None of the enterprise SECURITY DEFINER functions revoke `EXECUTE` from `PUBLIC`.
  Every one of them needs the same grant hardening the repo applied on 15.09
  (`harden_*` migrations). Examples: `recompute_trust_badge`, `kyc_purge_expired`,
  `sync_*`.
- `normalize_person_name`, `guard_payment_delete` and `listing_visible_to` lack
  `set search_path`. The advisor will flag them.
- Apply each file with `apply_migration` so each runs in its own transaction and
  appears in the migration list. The README calls the files idempotent, and they
  mostly are. But re-running 01 re-grants ADMIN every permission, and re-running 03
  resets `deposit_requirements` amounts.

## Recommended order

| # | Step | Risk | Blocked on |
|---|---|---|---|
| 0 | Hotfix: add `identity_state`, `identity_approved_at` to `protect_profile_system_fields`. Fix `identity_ok` to check `p_user`'s staff status. | Low | Nothing. Do now. |
| 1 | Owner decisions: deposits (amount, payment method, grandfathering), hide fees or not, whether moderation strikes count, whether grandfathered users count as KYC-verified. | — | Owner |
| 2 | Create a Supabase branch (paid feature) and run steps 3–8 there, then `npx playwright test` against it. | — | — |
| 3 | 01 RBAC + staff seed + grant revokes + MODERATOR perms | Low | — |
| 4 | 02 reduced: KYC extras on top of identity, `is_kyc_verified` wrapper | Low | Step 1 (grandfathering) |
| 5 | 03a additive finance + `released_final` backfill + reconcile with `guard_payment_transition`. Hold the no-delete trigger until the FK/anonymisation change is in. | Medium | Step 1 |
| 6 | 04 without the gate policies, + `btree_gist`, + consultation and premium fixes | Low | — |
| 7 | 05 with the protected-column, public-view and reporter fixes | Medium | 6 |
| 8 | 06 restricted to service role | Low | 3–5 |
| 9 | 03b fee hiding + views with booking columns + realtime swap + frontend release, in one window | **High** | Step 1 (fees), frontend PR |
| 10 | Turn on `can_transact()` in the existing listing/bid policies, behind a grandfather date like `verification_policy` | **High** | A working deposit top-up flow |

Rollback: steps 3–8 are additive (new tables, functions, policies), so rolling back
means dropping them. Steps 9 and 10 change what existing users can do. Write their
rollback scripts in `supabase/rollback/` before applying, as was done for booking.
