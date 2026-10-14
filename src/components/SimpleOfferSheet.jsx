import { useState } from 'react'
import { CalendarDays, CheckCircle2, MapPin } from 'lucide-react'
import ActionError from './ActionError'
import './SimpleOfferSheet.css'

const km = (value) => `${Number(value).toLocaleString('bs-BA')} KM`

/** Poruka uz prijavu, napisana umjesto majstora (bez brojeva telefona i kontakta, da prođe Pravilo #1). */
export function simpleOfferMessage(amount) {
  return `Dobar dan! Mogu uraditi ovaj posao za ${Number(amount)} KM. Imam iskustva s ovakvim poslovima i mogu doći kad Vama odgovara.`
}

/** Cijene koje majstor bira jednim dodirom: budžet klijenta, ili tipične cijene za kategoriju. */
function priceChoices(listing, priceStats, rejectedAmount) {
  if (listing.price != null) {
    const budget = Math.round(Number(listing.price))
    // klijent je odbio budžet: ponudi malo nižu cijenu umjesto iste
    if (rejectedAmount != null && Number(rejectedAmount) >= budget) return [Math.round(budget * 0.9), Math.round(budget * 0.8)]
    return [budget]
  }
  if (priceStats?.median) {
    const median = Math.round(priceStats.median)
    return [...new Set([Math.round(median * 0.85), median, Math.round(median * 1.2)])].filter((value) => value > 0)
  }
  return []
}

/**
 * Jednostavan način: prijava na posao u jednom dodiru. Cijena je već izabrana,
 * poruku ne treba kucati, sve je krupno. Za "Drugu cijenu" otvori se jedno polje.
 */
function SimpleOfferSheet({ listing, priceStats, feePercent, when, sending, error, rejectedAmount = null, onSubmit, onClose }) {
  const choices = priceChoices(listing, priceStats, rejectedAmount)
  const preselected = choices.length === 1 ? choices[0] : choices.length === 3 ? choices[1] : choices[0] ?? null
  const [amount, setAmount] = useState(preselected == null ? '' : String(preselected))
  const [custom, setCustom] = useState(choices.length === 0)
  const value = Number(amount)
  const valid = Number.isFinite(value) && value > 0

  const submit = (event) => {
    event.preventDefault()
    if (!valid || sending) return
    onSubmit({ amount: String(value), message: simpleOfferMessage(value) })
  }

  return (
    <form className="simple-offer" onSubmit={submit} data-testid="simple-offer">
      <h2 id="offer-title">{rejectedAmount != null ? 'Pošalji novu cijenu' : 'Prijavi se na posao'}</h2>
      <div className="simple-offer-job">
        <strong>{listing.title}</strong>
        {listing.location && <span><MapPin size={20} /> {listing.location}</span>}
        {when && <span><CalendarDays size={20} /> {when}</span>}
      </div>

      <p className="simple-offer-label">{rejectedAmount != null ? `Klijent je odbio ${km(rejectedAmount)}. Izaberi novu cijenu:` : listing.price != null ? 'Klijent nudi:' : 'Izaberi svoju cijenu:'}</p>
      {choices.length > 0 && (
        <div className="simple-offer-prices" role="radiogroup" aria-label="Cijena">
          {choices.map((choice) => (
            <button
              key={choice} type="button" role="radio" aria-checked={!custom && value === choice}
              className={!custom && value === choice ? 'active' : ''}
              onClick={() => { setCustom(false); setAmount(String(choice)) }}
            >
              {!custom && value === choice && <CheckCircle2 size={26} />} {km(choice)}
            </button>
          ))}
          <button type="button" className={`simple-offer-other ${custom ? 'active' : ''}`} onClick={() => { setCustom(true); setAmount('') }}>Druga cijena</button>
        </div>
      )}
      {custom && (
        <label className="simple-offer-input">
          <span>Tvoja cijena (KM)</span>
          <input data-testid="simple-offer-amount" type="number" min="1" step="1" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus={choices.length > 0} />
        </label>
      )}
      {valid && feePercent != null && (
        <p className="simple-offer-net">Tebi ostaje <strong>{km(Math.round(value * (1 - feePercent / 100) * 100) / 100)}</strong></p>
      )}
      <p className="simple-offer-note">Klijent dobija kratku poruku da možeš uraditi posao. Ništa ne moraš kucati.</p>

      <ActionError error={error} />
      <button data-testid="simple-offer-submit" type="submit" className="simple-offer-send" disabled={!valid || sending}>
        {sending ? 'Šaljem…' : valid ? `Pošalji prijavu · ${km(value)}` : 'Upiši cijenu'}
      </button>
      <button type="button" className="simple-offer-cancel" onClick={onClose}>Odustani</button>
    </form>
  )
}

export default SimpleOfferSheet
