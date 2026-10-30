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

/** "upravo", "prije 5 min", "prije 3 h", "jučer", "prije 4 dana", else the short date, how apps talk about time. */
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

/** "1 recenzija", "3 recenzije", "5 recenzija": Bosnian plural for review counts. */
export const reviewsLabel = (n) => {
  const last = n % 10
  const lastTwo = n % 100
  return `${n} ${last === 1 && lastTwo !== 11 ? 'recenzija' : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? 'recenzije' : 'recenzija'}`
}

const pluralBs = (n, one, few, many) => {
  const last = n % 10
  const lastTwo = n % 100
  if (last === 1 && lastTwo !== 11) return one
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many
}

/** "8 uspješnih · 1 neuspješan" for a provider's decided jobs; a line may break only after the dot. */
export const jobOutcomesLabel = (done = 0, failed = 0) =>
  `${done}\u00a0${pluralBs(done, 'uspješan', 'uspješna', 'uspješnih')} · ${failed}\u00a0${pluralBs(failed, 'neuspješan', 'neuspješna', 'neuspješnih')}`
