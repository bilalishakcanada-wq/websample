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
