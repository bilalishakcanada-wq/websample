/**
 * Katalog permisija — JEDAN izvor istine za cijelu platformu.
 *
 * Isti kodovi stoje u tabeli public.permissions (supabase/enterprise/01_rbac.sql).
 * Ako dodaješ permisiju: dodaj je OVDJE i u SQL seed, pa oboje deployuj zajedno.
 * Test `permissions.spec.ts` poredi ove dvije liste i pada ako se raziđu.
 */
export const PERMISSIONS = {
  KYC_QUEUE_READ:       'kyc.queue.read',
  KYC_CASE_CLAIM:       'kyc.case.claim',
  KYC_DOCUMENT_VIEW:    'kyc.document.view',
  KYC_APPROVE:          'kyc.decision.approve',
  KYC_REJECT:           'kyc.decision.reject',
  KYC_ESCALATE:         'kyc.decision.escalate',

  USER_READ:            'user.read',
  USER_PII_READ:        'user.pii.read',
  USER_SUSPEND:         'user.suspend',
  USER_DELETE:          'user.delete',

  DISPUTE_READ:         'dispute.read',
  DISPUTE_RESOLVE:      'dispute.resolve',
  REFUND_AUTHORIZE:     'refund.authorize',
  PAYOUT_RELEASE:       'payout.release',
  DEPOSIT_WAIVE:        'deposit.waive',
  FINANCE_FEES_READ:    'finance.fees.read',

  STRIKE_REVIEW:        'strike.review',
  STRIKE_REVOKE:        'strike.revoke',
  MODERATION_REVIEW:    'moderation.review',

  HR_STAFF_READ:        'hr.staff.read',
  HR_STAFF_MANAGE:      'hr.staff.manage',
  IT_SYSTEM_READ:       'it.system.read',
  IT_SYSTEM_MANAGE:     'it.system.manage',
  AUDIT_READ:           'audit.read',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Vanjske uloge (korisnici platforme) — nemaju nijednu internu permisiju. */
export const EXTERNAL_ROLES = ['USER', 'PROVIDER'] as const
/** Interne uloge (zaposleni). */
export const INTERNAL_ROLES = ['SUPPORT', 'TEAM_LEAD', 'HR', 'IT', 'MODERATOR', 'ADMIN'] as const

export type ExternalRole = (typeof EXTERNAL_ROLES)[number]
export type InternalRole = (typeof INTERNAL_ROLES)[number]
export type RoleName = ExternalRole | InternalRole

/**
 * Ogledalo tabele role_permissions. Baza ostaje mjerodavna u runtime-u
 * (guard čita stvarne permisije iz tokena/baze); ovo služi za tipove, testove
 * i za generisanje seed-a — da se dvije strane ne raziđu.
 */
export const ROLE_MATRIX: Record<InternalRole, readonly Permission[]> = {
  SUPPORT: [
    PERMISSIONS.KYC_QUEUE_READ, PERMISSIONS.KYC_CASE_CLAIM, PERMISSIONS.KYC_DOCUMENT_VIEW,
    PERMISSIONS.KYC_APPROVE, PERMISSIONS.KYC_REJECT, PERMISSIONS.KYC_ESCALATE,
    PERMISSIONS.USER_READ, PERMISSIONS.DISPUTE_READ,
    PERMISSIONS.STRIKE_REVIEW, PERMISSIONS.MODERATION_REVIEW,
  ],
  TEAM_LEAD: [
    PERMISSIONS.KYC_QUEUE_READ, PERMISSIONS.KYC_CASE_CLAIM, PERMISSIONS.KYC_DOCUMENT_VIEW,
    PERMISSIONS.KYC_APPROVE, PERMISSIONS.KYC_REJECT, PERMISSIONS.KYC_ESCALATE,
    PERMISSIONS.USER_READ, PERMISSIONS.USER_PII_READ, PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.DISPUTE_READ, PERMISSIONS.DISPUTE_RESOLVE, PERMISSIONS.REFUND_AUTHORIZE,
    PERMISSIONS.PAYOUT_RELEASE, PERMISSIONS.DEPOSIT_WAIVE, PERMISSIONS.FINANCE_FEES_READ,
    PERMISSIONS.STRIKE_REVIEW, PERMISSIONS.STRIKE_REVOKE, PERMISSIONS.MODERATION_REVIEW,
    PERMISSIONS.AUDIT_READ,
  ],
  HR: [PERMISSIONS.HR_STAFF_READ, PERMISSIONS.HR_STAFF_MANAGE, PERMISSIONS.USER_READ],
  IT: [PERMISSIONS.IT_SYSTEM_READ, PERMISSIONS.IT_SYSTEM_MANAGE, PERMISSIONS.AUDIT_READ, PERMISSIONS.USER_READ],
  // nasljeđe starog sistema: samo moderacija sadržaja
  MODERATOR: [PERMISSIONS.MODERATION_REVIEW, PERMISSIONS.USER_READ],
  ADMIN: Object.values(PERMISSIONS),
}

/**
 * Ključno pravilo: nijedna vanjska uloga ne dobija internu permisiju.
 * Provjerava se i u testu, da se greškom ne "posveti" korisnički nalog.
 */
export const isInternalRole = (role: string): role is InternalRole =>
  (INTERNAL_ROLES as readonly string[]).includes(role)

/** Permisije koje same po sebi znače dodir sa osjetljivim podacima → uvijek u audit. */
export const AUDITED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  PERMISSIONS.KYC_DOCUMENT_VIEW, PERMISSIONS.USER_PII_READ, PERMISSIONS.FINANCE_FEES_READ,
  PERMISSIONS.REFUND_AUTHORIZE, PERMISSIONS.PAYOUT_RELEASE, PERMISSIONS.DEPOSIT_WAIVE,
  PERMISSIONS.USER_DELETE, PERMISSIONS.USER_SUSPEND, PERMISSIONS.STRIKE_REVOKE,
])
