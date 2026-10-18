import { useState } from 'react'
import { Car, Check, Fuel, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { travelKindLabel, travelService, TRAVEL_KINDS } from '../services/travelService'
import { useBackToClose } from '../hooks/useBackToClose'
import { keys } from '../hooks/queryKeys'
import { scanContactInfo, contactInfoMessage } from '../utils/moderation'
import ActionError from './ActionError'
import { toast } from './Toaster'
import './TravelRequest.css'

const AMOUNTS = [10, 20, 30, 50]
const km = (value) => `${Math.round(Number(value))} km`
const money = (value) => `${Number(value).toLocaleString('bs-BA')} KM`

/** Travel requests on one job: the owner gets all of them, a provider only their own (the database decides). */
export function useTravelRequests(listingId, userId) {
  return useQuery({
    queryKey: keys.travelRequests(listingId, userId),
    queryFn: () => travelService.forListing(listingId),
    enabled: Boolean(listingId && userId),
    staleTime: 15 * 1000,
    meta: { persist: false },
  })
}

/** CTA on the offer button for a provider who is too far, by the state of their request. */
export const travelCta = (request) => (!request ? 'Zamoli da plati prevoz'
  : request.status === 'pending' ? 'Molba poslana, čeka klijenta'
    : request.status === 'declined' ? 'Klijent ne plaća prevoz' : 'Pošalji ponudu')

/**
 * Provider, too far from the job: the only thing they can send is a request that the client
 * pays the trip (gorivo, taksi, prevoz). No offer, no question, no message until the client agrees.
 */
export function TravelRequestSheet({ listing, distanceKm, onClose, onSent }) {
  const [kind, setKind] = useState('gorivo')
  const [amount, setAmount] = useState('20')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  useBackToClose(true, onClose)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const scan = scanContactInfo(note)
    if (!scan.clean) { setError(contactInfoMessage(scan, 'poruka')); return }
    setSending(true)
    try {
      await travelService.send({ listingId: listing.id, kind, amount, note })
      toast('Molba je poslana. Javićemo ti kad klijent odgovori.', { kind: 'success' })
      onSent?.()
    } catch (requestError) {
      setError(requestError)
      setSending(false)
    }
  }

  return (
    <div className="dlg-backdrop" onClick={onClose} role="presentation">
      <form className="dlg tr-sheet" role="dialog" aria-modal="true" aria-labelledby="tr-title" data-testid="travel-sheet" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <span className="dlg-handle" aria-hidden="true" />
        <h2 id="tr-title">Zamoli da plati prevoz</h2>
        <p>
          {distanceKm != null ? `Udaljen/a si oko ${km(distanceKm)} od posla. ` : ''}
          Za ovu cijenu ponude šalju samo izvođači iz blizine. Ako klijent pristane da plati prevoz, možeš poslati ponudu.
        </p>
        <div className="tr-kinds" role="radiogroup" aria-label="Šta treba platiti">
          {TRAVEL_KINDS.map((item) => (
            <button key={item.value} type="button" role="radio" aria-checked={kind === item.value} className={`tr-chip ${kind === item.value ? 'active' : ''}`} onClick={() => setKind(item.value)}>
              {item.value === 'gorivo' ? <Fuel size={16} /> : <Car size={16} />} {item.label}
            </button>
          ))}
        </div>
        <label className="tr-label" htmlFor="tr-amount">Koliko (KM)</label>
        <div className="tr-amounts">
          {AMOUNTS.map((value) => (
            <button key={value} type="button" className={`tr-chip ${Number(amount) === value ? 'active' : ''}`} onClick={() => setAmount(String(value))}>{value} KM</button>
          ))}
          <input id="tr-amount" className="dlg-input tr-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} aria-label="Iznos za prevoz u KM" />
        </div>
        <label className="tr-label" htmlFor="tr-note">Poruka (nije obavezno)</label>
        <textarea id="tr-note" className="dlg-input" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="npr. Dolazim iz Zenice svojim autom, gorivo u oba smjera." />
        <ActionError error={error} />
        <div className="dlg-actions">
          <button type="submit" className="dlg-confirm" data-testid="travel-send" disabled={sending}>{sending ? 'Šaljem…' : 'Pošalji molbu'}</button>
          <button type="button" className="dlg-cancel" onClick={onClose}>Odustani</button>
        </div>
      </form>
    </div>
  )
}

/** Provider: where their request stands. */
export function TravelRequestStatus({ request }) {
  if (!request) return null
  const what = `${travelKindLabel(request.kind).toLowerCase()} ${money(request.amount)}`
  const [title, text, tone] = request.status === 'accepted'
    ? ['Klijent plaća prevoz', `Dogovoreno: ${what}. Sada možeš poslati ponudu.`, 'ok']
    : request.status === 'declined'
      ? ['Klijent ne plaća prevoz', 'Molba je odbijena. Pogledaj poslove bliže tebi.', 'no']
      : ['Molba za prevoz je poslana', `Tražiš ${what}. Čeka se odgovor klijenta.`, 'wait']
  return (
    <div className={`tr-status is-${tone}`} data-testid="travel-status">
      <Car size={20} />
      <div><strong>{title}</strong><span>{text}</span></div>
    </div>
  )
}

/** Owner: requests from providers who are too far, with Prihvati / Odbij. */
export function TravelRequestsOwner({ listingId, userId, requests = [] }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState('')
  if (requests.length === 0) return null

  const answer = async (request, accept) => {
    setBusy(request.id)
    try {
      await travelService.answer(request.id, accept)
      toast(accept ? 'Prihvaćeno. Izvođač sada može poslati ponudu.' : 'Molba je odbijena.', { kind: accept ? 'success' : 'info' })
      await queryClient.invalidateQueries({ queryKey: keys.travelRequests(listingId, userId) })
    } catch (error) {
      toast(error.message, { kind: 'error' })
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="tr-owner" data-testid="travel-requests">
      <h2>Molbe za plaćen prevoz</h2>
      <p>Ovi izvođači su predaleko za ovu cijenu. Ako platiš prevoz, mogu ti poslati ponudu.</p>
      {requests.map((request) => (
        <article key={request.id} className="tr-item">
          <div className="tr-item-head">
            <strong>{request.provider?.display_name || 'Izvođač'}</strong>
            {request.distance_km != null && <span>{km(request.distance_km)} daleko</span>}
          </div>
          <div className="tr-item-ask">{travelKindLabel(request.kind)}: <b>{money(request.amount)}</b></div>
          {request.note && <p className="tr-item-note">{request.note}</p>}
          {request.status === 'pending' ? (
            <div className="tr-item-actions">
              <button type="button" className="primary-button" disabled={busy === request.id} onClick={() => answer(request, true)}><Check size={16} /> Prihvati</button>
              <button type="button" className="secondary-button" disabled={busy === request.id} onClick={() => answer(request, false)}><X size={16} /> Odbij</button>
            </div>
          ) : <span className={`tr-item-state is-${request.status}`}>{request.status === 'accepted' ? 'Prihvaćeno, plaćaš prevoz' : 'Odbijeno'}</span>}
        </article>
      ))}
    </section>
  )
}
