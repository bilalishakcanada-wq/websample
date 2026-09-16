// BiH phone helpers: "061387361" / "+38761387361" -> "061 387 361" / "+387 61 387 361".

export const digitsOnly = (value) => String(value || '').replace(/\D/g, '')

/** Format while typing. Keeps the user's choice of local (0xx) or international (+387) form. */
export const formatBosnianPhone = (value) => {
  const raw = String(value || '')
  let digits = digitsOnly(raw)
  const international = raw.trim().startsWith('+') || digits.startsWith('387') || digits.startsWith('00387')
  if (digits.startsWith('00387')) digits = digits.slice(5)
  else if (digits.startsWith('387')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  digits = digits.slice(0, 9)
  const groups = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8), digits.slice(8, 9)].filter(Boolean)
  if (international) return `+387${groups.length ? ` ${groups.join(' ')}` : ''}`
  return digits ? `0${groups.join(' ')}` : ''
}

/** True for an empty value or a plausible BiH number (mobile 06x, landline 03x/04x/05x). */
export const isValidBosnianPhone = (value) => {
  const digits = digitsOnly(value)
  if (!digits) return true
  const national = digits.startsWith('00387') ? `0${digits.slice(5)}` : digits.startsWith('387') ? `0${digits.slice(3)}` : digits
  return /^0[3-6]\d{6,7}$/.test(national)
}
