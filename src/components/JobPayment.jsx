import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, Check, CircleDollarSign, Handshake, Lock, ShieldCheck, Wallet, X } from 'lucide-react'
import { paymentService } from '../services/paymentService'
import { accountService } from '../services/accountService'
import { formatBosnianDate } from '../utils/dateFormat'
import { haptic } from '../utils/native'

export const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

const STEPS = [
  { id: 'accepted', label: 'Ponuda prihvaćena', icon: Handshake },
  { id: 'funded', label: 'Uplata osigurana', icon: Lock },
  { id: 'done', label: 'Posao urađen', icon: BadgeCheck },
  { id: 'released', label: 'Uplata oslobođena', icon: CircleDollarSign },
]
const stepIndex = (status) => ({ funded: 1, requested: 2, disputed: 2, released: 3, refunded: 1 }[status] ?? 0)

/**
 * Accept-and-pay sheet: the client sees exactly what is reserved from the balance and
 * what the provider will receive, then confirms. Mirrors the Airtasker "accept & pay" step.
 */
export function AcceptOfferSheet({ bid, providerName, onClose, onDone }) {
  const [wallet, setWallet] = useState(null)
  const [fee, setFee] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    accountService.myWallet().then(setWallet).catch(() => setWallet({ balance: 0 }))
    paymentService.feePercentFor(bid.bidder_id).then(setFee)
  }, [bid])

  const balance = Number(wallet?.balance || 0)
  const amount = Number(bid.amount || 0)
  const enough = balance >= amount
  const net = fee == null ? null : amount - amount * fee / 100

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await paymentService.acceptAndFund(bid.id)
      haptic('medium')
      onDone?.()
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="offer-sheet pay-sheet" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="pay-sheet-head">
          <span className="pay-sheet-icon"><ShieldCheck size={20} /></span>
          <div><h2>Prihvati ponudu i osiguraj uplatu</h2><p className="muted-text">Novac se čuva na Poso.ba i isplaćuje izvođaču tek kad potvrdiš da je posao završen.</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>

        <div className="pay-breakdown">
          <div><span>Izvođač</span><strong>{providerName || 'Korisnik Poso.ba'}</strong></div>
          <div><span>Cijena posla</span><strong>{money(amount)}</strong></div>
          <div><span>Tvoj balans</span><strong className={enough ? '' : 'is-short'}>{wallet ? money(balance) : '…'}</strong></div>
          <div className="pay-breakdown-total"><span>Ostaje na balansu</span><strong>{wallet ? money(Math.max(0, balance - amount)) : '…'}</strong></div>
        </div>

        {fee != null && (
          <p className="pay-note"><Check size={14} /> Izvođač nakon završetka dobija <strong>{money(net)}</strong> ({fee} % naknade platforme plaća izvođač, ti plaćaš tačno cijenu posla).</p>
        )}

        {wallet && !enough && (
          <div className="pay-short">
            <AlertTriangle size={16} />
            <div>
              <strong>Nedostaje {money(amount - balance)}</strong>
              <span>Uplati na balans pa se vrati ovdje — ponuda te čeka. <Link to="/account/novcanik">Otvori balans →</Link></span>
            </div>
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
        <div className="pay-sheet-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Odustani</button>
          <button type="button" className="primary-button" onClick={confirm} disabled={busy || !wallet || !enough}><Lock size={16} /> {busy ? 'Osiguravam…' : `Prihvati i osiguraj ${money(amount)}`}</button>
        </div>
        <p className="pay-fine"><Wallet size={12} /> Ako se posao otkaže prije završetka, cijeli iznos se vraća na tvoj balans.</p>
      </section>
    </div>
  )
}

/** Payment card on the job page: timeline, breakdown and the right action for the viewer. */
export function JobPaymentCard({ payment, role, onChanged }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [dispute, setDispute] = useState(null) // null | 'open' | text
  const current = stepIndex(payment.status)

  const run = async (key, fn) => {
    setBusy(key)
    setError('')
    try { await fn(); haptic('medium'); onChanged?.() } catch (requestError) { setError(requestError.message) } finally { setBusy('') }
  }

  const release = () => {
    if (!window.confirm(`Potvrdi da je posao završen i oslobodi ${money(payment.amount)} izvođaču. Ovo se ne može poništiti.`)) return
    run('release', () => paymentService.releasePayment(payment.listing_id))
  }
  const cancel = () => {
    const why = window.prompt(role === 'client' ? 'Zašto otkazuješ? (novac se vraća na tvoj balans)' : 'Zašto odustaješ od posla? (klijentu se vraća novac; računa se u tvoju uspješnost)')
    if (why === null) return
    run('cancel', () => paymentService.cancelJob(payment.listing_id, why))
  }
  const sendDispute = () => run('dispute', async () => { await paymentService.openDispute(payment.listing_id, dispute); setDispute(null) })

  return (
    <section className="job-card pay-card">
      <div className="pay-card-head">
        <h2><ShieldCheck size={18} /> Poso.ba Pay</h2>
        <span className={`pill pay-status-${payment.status}`}>
          {{ funded: 'Uplata osigurana', requested: 'Čeka oslobađanje', released: 'Isplaćeno', refunded: 'Vraćeno klijentu', disputed: 'Spor — tim pregleda' }[payment.status]}
        </span>
      </div>

      <ol className="pay-steps">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const state = payment.status === 'refunded' && index > 1 ? 'off' : index < current ? 'done' : index === current ? (payment.status === 'released' ? 'done' : 'active') : 'todo'
          return (
            <li key={step.id} className={`pay-step ${state}`}>
              <span className="pay-step-dot">{state === 'done' ? <Check size={14} /> : <Icon size={14} />}</span>
              <span className="pay-step-label">{step.label}</span>
            </li>
          )
        })}
      </ol>

      <div className="pay-breakdown">
        <div><span>Cijena posla</span><strong>{money(payment.amount)}</strong></div>
        <div><span>Naknada platforme ({payment.fee_percent} %)</span><strong>− {money(payment.fee_amount)}</strong></div>
        <div className="pay-breakdown-total"><span>Izvođač dobija</span><strong>{money(payment.net_amount)}</strong></div>
      </div>

      <p className="pay-note muted-text">
        {payment.status === 'funded' && (role === 'client'
          ? `Novac je rezervisan na Poso.ba od ${formatBosnianDate(payment.funded_at)}. Kad posao bude urađen, oslobodi uplatu — izvođač je dobija odmah.`
          : `Klijent je platio i novac je sigurno rezervisan (${formatBosnianDate(payment.funded_at)}). Uradi posao, pa zatraži isplatu.`)}
        {payment.status === 'requested' && (role === 'client'
          ? `Izvođač javlja da je posao završen (${formatBosnianDate(payment.requested_at)}). Provjeri i oslobodi uplatu — ili prijavi problem.`
          : `Zatražio si isplatu ${formatBosnianDate(payment.requested_at)}. Čeka se da klijent potvrdi.`)}
        {payment.status === 'released' && `Uplata oslobođena ${formatBosnianDate(payment.released_at)}. ${role === 'provider' ? `${money(payment.net_amount)} je na tvom balansu.` : 'Hvala — ostavi recenziju izvođaču.'}`}
        {payment.status === 'refunded' && `Posao otkazan ${formatBosnianDate(payment.refunded_at)} — ${money(payment.amount)} vraćeno klijentu. ${payment.resolution || ''}`}
        {payment.status === 'disputed' && `Prijavljen problem ${formatBosnianDate(payment.disputed_at)}. Uplata je zamrznuta; Poso.ba tim pregleda razgovor i dokaze i donosi odluku (obično u roku 48 h).`}
      </p>

      {error && <div className="form-error">{error}</div>}

      {dispute !== null && (
        <div className="pay-dispute">
          <textarea value={dispute} onChange={(event) => setDispute(event.target.value)} rows={3} maxLength={1000} placeholder="Šta se desilo? Budi konkretan — tim gleda i poruke i slike." />
          <div className="pay-sheet-actions">
            <button type="button" className="ghost-button" onClick={() => setDispute(null)}>Odustani</button>
            <button type="button" className="danger-button" onClick={sendDispute} disabled={busy === 'dispute' || dispute.trim().length < 5}><AlertTriangle size={15} /> Pošalji timu</button>
          </div>
        </div>
      )}

      {dispute === null && (
        <div className="pay-actions">
          {role === 'client' && ['funded', 'requested'].includes(payment.status) && (
            <button type="button" className="primary-button" onClick={release} disabled={Boolean(busy)}><CircleDollarSign size={16} /> {busy === 'release' ? 'Oslobađam…' : `Oslobodi ${money(payment.amount)}`}</button>
          )}
          {role === 'provider' && payment.status === 'funded' && (
            <button type="button" className="primary-button" onClick={() => run('request', () => paymentService.requestPayment(payment.listing_id))} disabled={Boolean(busy)}><BadgeCheck size={16} /> {busy === 'request' ? 'Šaljem…' : 'Posao je urađen — zatraži isplatu'}</button>
          )}
          {payment.status === 'funded' && (
            <button type="button" className="ghost-button" onClick={cancel} disabled={Boolean(busy)}>{role === 'client' ? 'Otkaži i vrati novac' : 'Odustani od posla'}</button>
          )}
          {['funded', 'requested'].includes(payment.status) && (
            <button type="button" className="ghost-button danger" onClick={() => setDispute('')} disabled={Boolean(busy)}><AlertTriangle size={15} /> Prijavi problem</button>
          )}
        </div>
      )}
    </section>
  )
}

/** Short explainer under the offer button for visitors. */
export function HowPaymentWorks() {
  return (
    <details className="pay-how">
      <summary><ShieldCheck size={14} /> Kako radi plaćanje na Poso.ba?</summary>
      <ol>
        <li><strong>Klijent prihvati ponudu</strong> — cijena se rezerviše sa njegovog balansa i čuva na Poso.ba.</li>
        <li><strong>Izvođač uradi posao</strong> i klikne „Zatraži isplatu“.</li>
        <li><strong>Klijent oslobodi uplatu</strong> — novac odmah ide na balans izvođača, umanjen za naknadu platforme (9–15 % po nivou).</li>
        <li>Problem? <strong>„Prijavi problem“</strong> zamrzava novac dok Poso.ba tim ne odluči. Otkazivanje prije početka vraća pun iznos.</li>
      </ol>
    </details>
  )
}
