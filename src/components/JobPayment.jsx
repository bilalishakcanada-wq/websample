import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, Lock, ShieldCheck, Wallet, X } from 'lucide-react'
import { paymentService } from '../services/paymentService'
import { accountService } from '../services/accountService'
import { haptic } from '../utils/native'
import { toast } from './Toaster'
import ActionError from './ActionError'

export const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

/**
 * Accept-and-pay sheet: the client sees exactly what is reserved from the balance, then
 * confirms. Mirrors the Airtasker "accept & pay" step. The provider's payout after the
 * platform fee is deliberately not shown here: that is between the provider and the platform.
 */
export function AcceptOfferSheet({ bid, providerName, onClose, onDone }) {
  const [wallet, setWallet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    accountService.myWallet().then(setWallet).catch(() => setWallet({ balance: 0 }))
  }, [bid])

  const balance = Number(wallet?.balance || 0)
  const amount = Number(bid.amount || 0)
  const enough = balance >= amount

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await paymentService.acceptAndFund(bid.id, amount)
      haptic('medium')
      toast(`Ponuda prihvaćena — ${money(amount)} je osigurano na Zadatku.`, { kind: 'success' })
      onDone?.()
      onClose()
    } catch (requestError) {
      setError(requestError)
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
          <div><h2>Prihvati ponudu i osiguraj uplatu</h2><p className="muted-text">Novac se čuva na Zadatku i isplaćuje izvođaču tek kad potvrdiš da je posao završen.</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>
        </div>

        <div className="pay-breakdown">
          <div><span>Izvođač</span><strong>{providerName || 'Korisnik Zadatka'}</strong></div>
          <div><span>Cijena posla</span><strong>{money(amount)}</strong></div>
          <div><span>Tvoj balans</span><strong className={enough ? '' : 'is-short'}>{wallet ? money(balance) : '…'}</strong></div>
          <div className="pay-breakdown-total"><span>Ostaje na balansu</span><strong>{wallet ? money(Math.max(0, balance - amount)) : '…'}</strong></div>
        </div>

        <p className="pay-note"><Check size={14} /> Plaćaš tačno cijenu posla, bez dodatnih troškova.</p>

        {wallet && !enough && (
          <div className="pay-short">
            <AlertTriangle size={16} />
            <div>
              <strong>Nedostaje {money(amount - balance)}</strong>
              <span>Uplata karticom stiže uskoro — do tada uplatu dogovaraš s timom (obično u roku od sat vremena), a ponuda te čeka. <Link to={`/pomoc?chat=1&msg=${encodeURIComponent(`Želim uplatiti ${money(amount - balance)} na balans da prihvatim ponudu. Kako da uplatim?`)}`}>Zatraži uplatu →</Link></span>
            </div>
          </div>
        )}

        <ActionError error={error} />
        <div className="pay-sheet-actions">
          <button type="button" className="ghost-button" onClick={onClose}>Odustani</button>
          <button data-testid="payment-confirm" type="button" className="primary-button" onClick={confirm} disabled={busy || !wallet || !enough}><Lock size={16} /> {busy ? 'Osiguravam…' : `Prihvati i osiguraj ${money(amount)}`}</button>
        </div>
        <p className="pay-fine"><Wallet size={12} /> Ako se posao otkaže prije završetka, cijeli iznos se vraća na tvoj balans.</p>
      </section>
    </div>
  )
}

/** Short explainer under the offer button for visitors. */
export function HowPaymentWorks() {
  return (
    <details className="pay-how">
      <summary><ShieldCheck size={14} /> Kako radi plaćanje na Zadatku?</summary>
      <ol>
        <li><strong>Klijent prihvati ponudu</strong> — cijena se rezerviše sa njegovog balansa i čuva na Zadatku.</li>
        <li><strong>Izvođač uradi posao</strong> i klikne „Predaj rad“.</li>
        <li><strong>Klijent odobri rad</strong> — novac odmah ide na balans izvođača, umanjen za naknadu platforme (9–15 % po nivou). Ako klijent ne odgovori za 72 sata, isplata ide automatski.</li>
        <li>Problem? <strong>„Prijavi problem“</strong> zamrzava novac dok Zadatak tim ne odluči. Otkazivanje prije početka vraća pun iznos.</li>
      </ol>
    </details>
  )
}
