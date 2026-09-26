// Task schedule, the way Airtasker asks for it: on a date, before a date, or flexible,
// plus optional times of day. Stored on listings (date_type, due_date, time_of_day);
// jobs posted before those columns existed carry it as a "Kada: …" line in the description.

const DAYS = ['ned', 'pon', 'uto', 'sri', 'čet', 'pet', 'sub']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export const TIME_OF_DAY = [
  { id: 'morning', label: 'Jutro', hint: 'prije 10h' },
  { id: 'midday', label: 'Podne', hint: '10–14h' },
  { id: 'afternoon', label: 'Popodne', hint: '14–18h' },
  { id: 'evening', label: 'Veče', hint: 'poslije 18h' },
]

export const MAX_REQUIREMENTS = 3
export const REQUIREMENT_MAX_LENGTH = 60

/** Today in Bosnia as YYYY-MM-DD (the database judges expiry in Europe/Sarajevo time too). */
export const todayBa = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sarajevo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** "sub, 5. okt" — short, without relying on the browser's Bosnian locale data. */
export const shortDate = (iso) => {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`
}

/** Form fields (timing: date|before|flexible, date, timeOfDay[]) → listing columns. */
export const scheduleFromForm = (form) => {
  const dated = (form.timing === 'date' || form.timing === 'before') && form.date
  return {
    date_type: dated ? (form.timing === 'date' ? 'on' : 'before') : 'flexible',
    due_date: dated ? form.date : null,
    time_of_day: TIME_OF_DAY.map((t) => t.id).filter((id) => (form.timeOfDay || []).includes(id)),
  }
}

/** Listing → the schedule, from the columns or (older jobs) the "Kada:" line. */
export const readSchedule = (listing) => {
  if (!listing) return { dateType: 'flexible', dueDate: null, timeOfDay: [] }
  if (listing.date_type) {
    return { dateType: listing.date_type, dueDate: listing.due_date || null, timeOfDay: listing.time_of_day || [] }
  }
  const kada = ((listing.description || '').split('\n\nKada:')[1] || '').trim()
  const match = kada.match(/(\d{4}-\d{2}-\d{2})/)
  if (!match) return { dateType: 'flexible', dueDate: null, timeOfDay: [] }
  return { dateType: kada.startsWith('Prije') ? 'before' : 'on', dueDate: match[1], timeOfDay: [] }
}

/** Listing → the post-flow form fields. */
export const formScheduleFromListing = (listing) => {
  const s = readSchedule(listing)
  return {
    timing: s.dateType === 'on' ? 'date' : s.dateType === 'before' ? 'before' : 'flexible',
    date: s.dueDate || '',
    timeOfDay: s.timeOfDay,
  }
}

export const timeOfDayLabel = (ids = []) => TIME_OF_DAY.filter((t) => ids.includes(t.id)).map((t) => t.label.toLowerCase()).join(', ')

/** "Na dan sub, 5. okt · jutro" / "Prije pet, 11. okt" / "Fleksibilno". */
export const scheduleLabel = (listingOrSchedule) => {
  const s = listingOrSchedule?.dateType ? listingOrSchedule : readSchedule(listingOrSchedule)
  const base = s.dateType === 'on' && s.dueDate ? `Na dan ${shortDate(s.dueDate)}`
    : s.dateType === 'before' && s.dueDate ? `Prije ${shortDate(s.dueDate)}`
      : 'Fleksibilno'
  const times = timeOfDayLabel(s.timeOfDay)
  return times ? `${base} · ${times}` : base
}

/** Label for the post-flow form (before it becomes a listing). */
export const formScheduleLabel = (form) => {
  const cols = scheduleFromForm(form)
  return scheduleLabel({ dateType: cols.date_type, dueDate: cols.due_date, timeOfDay: cols.time_of_day })
}

/** An open job whose date has passed (the server flips it to 'expired' within minutes). */
export const isExpired = (listing) => {
  if (!listing) return false
  if (listing.status === 'expired') return true
  const { dueDate } = readSchedule(listing)
  return listing.status === 'published' && Boolean(dueDate) && dueDate < todayBa()
}

/** Days until the due date (0 = today), or null when flexible. */
export const daysUntilDue = (listing) => {
  const { dueDate } = readSchedule(listing)
  if (!dueDate) return null
  const ms = new Date(`${dueDate}T12:00:00`) - new Date(`${todayBa()}T12:00:00`)
  return Math.round(ms / 86400000)
}

/** Clean must-haves from the form: trimmed, unique, at most 3, each at most 60 characters. */
export const cleanRequirements = (list = []) => {
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const value = String(raw || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, REQUIREMENT_MAX_LENGTH)
    const key = value.toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    out.push(value)
    if (out.length === MAX_REQUIREMENTS) break
  }
  return out
}
