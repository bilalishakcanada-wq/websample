/** Business identity required for every outbound email. Auth SMTP is configured separately. */
export const BUSINESS_EMAIL_FROM = '"Zadatak" <info@zadatak.com>'

/** Fail closed on stale/missing secrets; never fall back to another domain. */
export function configuredEmailSender(value: string | undefined): typeof BUSINESS_EMAIL_FROM | undefined {
  return value?.trim() === BUSINESS_EMAIL_FROM ? BUSINESS_EMAIL_FROM : undefined
}
