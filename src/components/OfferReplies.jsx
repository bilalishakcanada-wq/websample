import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send } from 'lucide-react'
import { bidService } from '../services/bidService'
import { contactInfoMessage, findProhibitedTerm, scanContactInfo } from '../utils/moderation'
import { formatBosnianDate } from '../utils/dateFormat'
import ActionError from './ActionError'

/**
 * Privatni razgovor ispod jedne ponude (kao Airtaskerov "reply" na ponudu):
 * vide ga samo klijent i izvođač te ponude, a pišu dok ponuda čeka odluku.
 * Pravilo #1 važi i ovdje — bez kontakata dok ponuda nije prihvaćena.
 * Ako tabela još ne postoji u bazi, komponenta ne prikazuje ništa.
 */
function OfferReplies({ bid, userId, canWrite }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  const queryClient = useQueryClient()
  // Jedan upit za sve ponude posla (ne jedan po ponudi). Privatno, pa se ne
  // sprema u localStorage; queryClient.clear() pri odjavi ga briše.
  const key = ['listing', bid.listing_id, 'replies']
  const { data: poPonudi, isError } = useQuery({
    queryKey: key,
    queryFn: () => bidService.listRepliesForListing(bid.listing_id),
    enabled: Boolean(bid.listing_id),
    meta: { persist: false },
  })
  // undefined = nije učitano, null = nije dostupno
  const replies = isError || poPonudi === null ? null : poPonudi === undefined ? undefined : (poPonudi[bid.id] ?? [])

  if (replies === null || replies === undefined) return null
  if (!canWrite && replies.length === 0) return null

  const send = async (event) => {
    event.preventDefault()
    setError('')
    if (findProhibitedTerm(draft)) { setError('Poruka sadrži sadržaj koji krši Pravila korištenja.'); return }
    const scan = scanContactInfo(draft)
    if (!scan.clean) { setError(contactInfoMessage(scan, 'poruka')); return }
    setSending(true)
    try {
      const row = await bidService.addReply(bid.id, draft)
      queryClient.setQueryData(key, (m) => ({ ...(m || {}), [bid.id]: [...((m && m[bid.id]) || []), row] }))
      setDraft('')
    } catch (requestError) {
      setError(requestError)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="offer-replies">
      <button type="button" className="link-button offer-replies-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MessageCircle size={15} /> {replies.length > 0 ? `Odgovori (${replies.length})` : 'Odgovori'}
      </button>
      {open && (
        <div className="offer-replies-body">
          {replies.map((reply) => (
            <p key={reply.id} className={`offer-reply ${reply.author_id === userId ? 'mine' : ''}`}>
              <span>{reply.body}</span>
              <small>{reply.author_id === userId ? 'Ti' : reply.author_id === bid.bidder_id ? 'Izvođač' : 'Klijent'} · {formatBosnianDate(reply.created_at)}</small>
            </p>
          ))}
          {canWrite && (
            <form className="offer-reply-form" onSubmit={send}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000}
                placeholder="Pitaj ili pojasni nešto o ovoj ponudi…" aria-label="Odgovor na ponudu" />
              <button type="submit" className="primary-button small-button" disabled={sending || !draft.trim()} aria-label="Pošalji odgovor"><Send size={15} /></button>
            </form>
          )}
          <ActionError error={error} />
          <small className="muted-text">Vidite samo ti i {userId === bid.bidder_id ? 'klijent' : 'ovaj izvođač'}. Kontakti se dijele tek nakon prihvatanja.</small>
        </div>
      )}
    </div>
  )
}

export default OfferReplies
