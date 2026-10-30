import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Clock, Hourglass, Landmark, Lock, PauseCircle, Wallet } from 'lucide-react'
import { accountService } from '../../services/accountService'

const DAYS = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota']
const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar']
const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`
const day = (value) => { const d = new Date(value); return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}` }
const dayTime = (value) => { const d = new Date(value); return `${day(d)} u ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
// the team sends payouts within 2 working days; weekends don't count
const plusWorkingDays = (value, count) => {
  const d = new Date(value)
  while (count > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) count -= 1 }
  return d
}
const RECENT_MS = 14 * 24 * 3600 * 1000

/** Steps of one payment: done, the current one, and what is left. */
function Steps({ labels, done, paused }) {
  return (
    <ol className="otw-steps">
      {labels.map((label, index) => {
        const state = index < done ? 'done' : index === done ? (paused ? 'paused' : 'now') : 'todo'
        return (
          <li key={label} className={`otw-step is-${state}`}>
            <span className="otw-dot">{state === 'done' ? <Check size={12} strokeWidth={3} /> : state === 'paused' ? <PauseCircle size={12} /> : null}</span>
            <small>{label}</small>
          </li>
        )
      })}
    </ol>
  )
}

function jobItem(row, userId) {
  const title = row.listing?.title || 'posao'
  const link = `/listings/${row.listing_id}`
  if (row.provider_id === userId) {
    const base = { id: row.id, link, icon: Wallet, incoming: true, amount: row.net_amount ?? row.amount, title: `Zarada · ${title}`, labels: ['Klijent uplatio', 'Posao predan', 'Na tvom balansu'] }
    if (row.status === 'disputed') return { ...base, done: 2, paused: true, eta: 'Na čekanju dok tim ne riješi spor' }
    if (row.status === 'requested') return { ...base, done: 2, eta: row.review_deadline ? `Stiže najkasnije: ${dayTime(row.review_deadline)}` : 'Stiže čim klijent potvrdi posao', hint: 'Klijent ima 72 sata da potvrdi posao. Ako ne odgovori, novac stiže automatski.' }
    return { ...base, done: 1, eta: 'Stiže kad predaš posao i klijent ga potvrdi', hint: 'Novac je već uplaćen i čuva se na Zadatku. Klijent ga ne može povući bez razloga.' }
  }
  const base = { id: row.id, link, icon: Lock, incoming: false, amount: row.amount, title: `Rezervisano · ${title}`, labels: ['Rezervisano', 'Posao predan', 'Isplaćeno izvođaču'] }
  if (row.status === 'disputed') return { ...base, done: 2, paused: true, eta: 'Na čekanju dok tim ne riješi spor' }
  if (row.status === 'requested') return { ...base, done: 2, eta: row.review_deadline ? `Rok za pregled: ${dayTime(row.review_deadline)}` : 'Pregledaj predani posao', hint: 'Ako ne odgovoriš u roku, novac se automatski isplaćuje izvođaču.' }
  return { ...base, done: 1, eta: 'Isplaćuje se izvođaču tek kad potvrdiš da je posao završen' }
}

function payoutItem(row) {
  const base = { id: row.id, icon: Landmark, incoming: true, amount: row.amount_km, title: `Isplata na račun •••• ${String(row.iban || '').slice(-4)}`, labels: ['Zahtjev poslan', 'Tim šalje uplatu', 'Na tvom računu'] }
  if (row.status === 'requested') return { ...base, open: true, done: 1, eta: `Stiže najkasnije: ${day(plusWorkingDays(row.created_at, 2))}`, hint: 'Isplate šaljemo radnim danima, obično za 1–2 radna dana.' }
  if (row.status === 'paid') return { ...base, done: 3, eta: `Poslano: ${day(row.reviewed_at || row.created_at)}`, hint: 'Ako novac još nije na računu, banci ponekad treba još jedan radni dan.' }
  return { ...base, done: 1, paused: true, rejected: true, eta: 'Odbijeno, iznos je vraćen na tvoj balans', hint: row.note || '' }
}

/** Everything not settled yet, one row per job payment or bank payout. */
export function pendingItems(data, userId) {
  if (!data) return []
  const { now } = data
  return [
    ...data.payouts
      .filter((row) => row.status === 'requested' || ((row.status === 'paid' || row.status === 'rejected') && now - new Date(row.reviewed_at || row.created_at).getTime() < RECENT_MS))
      .map(payoutItem),
    ...data.jobs.map((row) => jobItem(row, userId)),
  ]
}

/** For the balance card: job money held from the balance, and earnings not on the balance yet. */
export function pendingTotals(data, userId) {
  const jobs = data?.jobs || []
  const sum = (rows, pick) => rows.reduce((total, row) => total + Number(pick(row) || 0), 0)
  return {
    reserved: sum(jobs.filter((row) => row.client_id === userId), (row) => row.amount),
    incoming: sum(jobs.filter((row) => row.provider_id === userId), (row) => row.net_amount ?? row.amount),
  }
}

/**
 * "Na putu": money that is not settled yet, with the step it is on and when it arrives.
 * Hidden when nothing is pending, so a new account never sees an empty box.
 */
function MoneyOnTheWay({ items, onCancelled }) {
  const [error, setError] = useState('')
  if (items.length === 0) return null

  const cancel = async (id) => {
    setError('')
    try { await accountService.cancelPayout(id); onCancelled?.('Zahtjev za isplatu je otkazan, iznos je vraćen na balans.') } catch (requestError) { setError(requestError.message) }
  }

  return (
    <section className="otw" aria-label="Novac na putu">
      <h2 className="account-sub"><Hourglass size={17} /> Na putu</h2>
      {error && <div className="form-error">{error}</div>}
      <ul className="otw-list">
        {items.map((item) => {
          const Icon = item.icon
          const title = item.link ? <Link to={item.link}>{item.title}</Link> : item.title
          return (
            <li key={item.id} className={`otw-item${item.rejected ? ' is-rejected' : ''}${item.done >= 3 ? ' is-done' : ''}`}>
              <div className="otw-row">
                <span className="otw-icon"><Icon size={17} /></span>
                <div className="otw-text">
                  <strong>{title}</strong>
                  <span className="otw-eta"><Clock size={13} /> {item.eta}</span>
                </div>
                <b className="otw-amount">{money(item.amount)}</b>
              </div>
              <Steps labels={item.labels} done={item.done} paused={item.paused} />
              {(item.hint || item.open) && (
                <p className="otw-hint">
                  {item.hint}
                  {item.open && <> <button type="button" className="adm-userlink" onClick={() => cancel(item.id)}>Otkaži isplatu</button></>}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default MoneyOnTheWay
