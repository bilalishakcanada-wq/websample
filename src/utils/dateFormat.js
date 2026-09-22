// Some browsers/runtimes ship incomplete ICU data for 'bs-BA' (Intl.DateTimeFormat falls back
// to broken output like "2026 M09" instead of real month names), so format Bosnian dates manually.
const BOSNIAN_MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar']

export const formatBosnianDate = (value) => {
  if (!value) return 'Nedavno'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Nedavno'
  return `${date.getDate()}. ${BOSNIAN_MONTHS[date.getMonth()]} ${date.getFullYear()}.`
}

export const formatBosnianMonthYear = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${BOSNIAN_MONTHS[date.getMonth()]} ${date.getFullYear()}.`
}

/** "upravo", "prije 5 min", "prije 3 h", "jučer", "prije 4 dana", else the short date — how apps talk about time. */
export const timeAgo = (value) => {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'upravo'
  if (min < 60) return `prije ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `prije ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'jučer'
  if (days < 7) return `prije ${days} dana`
  return formatBosnianDate(value)
}
