import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Send, UserRound, Users } from 'lucide-react'
import { usePublicProfile } from '../hooks/queries'
import { listingService } from '../services/listingService'
import { confirmDialog } from '../utils/dialog'
import { toast } from './Toaster'
import './TaskExtras.css'

const firstNameOf = (name) => (name || '').trim().split(/\s+/)[0] || ''

function Face({ profile }) {
  return profile?.avatar_url
    ? <img className="tx-invite-face" src={profile.avatar_url} alt="" loading="lazy" decoding="async" />
    : <span className="tx-invite-face" aria-hidden="true"><UserRound size={18} /></span>
}

/**
 * "Zatraži ponudu" while posting: the job goes privately to one provider (Airtasker's
 * "Request a quote"). `onClear` turns it back into a normal public job.
 */
export function InviteBanner({ providerId, onClear }) {
  const { data } = usePublicProfile(providerId)
  if (!providerId) return null
  const profile = data?.profile
  const first = firstNameOf(profile?.display_name)
  return (
    <div className="tx-invite" role="note">
      <Face profile={profile} />
      <span className="tx-invite-text">
        <strong>Zahtjev za ponudu{profile?.display_name ? `: ${profile.display_name}` : ''}</strong>
        <small>Samo {first || 'ovaj izvođač'} vidi posao i može poslati ponudu.</small>
      </span>
      {onClear && <button type="button" onClick={onClear}>Objavi svima</button>}
    </div>
  )
}

/**
 * Job page card for a private quote request. The client sees who it went to and can open
 * the job to everyone; the invited provider can decline. Nobody else ever sees the job.
 */
export function QuoteRequestCard({ listing, userId, isOwner, myBid, onChanged, phone = false }) {
  const invited = listing?.invited_provider
  const { data } = usePublicProfile(isOwner ? invited : null)
  const [busy, setBusy] = useState(false)
  if (!invited) return null
  const isInvited = Boolean(userId) && userId === invited
  if (!isOwner && !isInvited) return null

  const declined = Boolean(listing.invite_declined_at)
  const open = listing.status === 'published'
  const name = data?.profile?.display_name || 'Izvođač'
  const primary = phone ? 'ap-btn ap-btn-primary' : 'primary-button'
  const quiet = phone ? 'ap-btn ap-btn-light' : 'ghost-button'

  const run = async (action, done) => {
    setBusy(true)
    try {
      await action()
      toast(done, { kind: 'success' })
      await onChanged?.()
    } catch (error) {
      toast(error.message, { kind: 'error' })
    } finally {
      setBusy(false)
    }
  }
  const openToAll = async () => {
    const ok = await confirmDialog({
      title: 'Objaviti posao svima?',
      text: 'Posao ulazi u pretragu i izvođači u blizini dobijaju obavijest. Ponude koje već imaš ostaju.',
      confirmLabel: 'Objavi svima',
    })
    if (ok) run(() => listingService.openToEveryone(listing.id), 'Posao je sada otvoren svima.')
  }
  const decline = async () => {
    const ok = await confirmDialog({
      title: 'Odbiti zahtjev?',
      text: 'Klijent dobija obavijest da ne možeš preuzeti posao i može ga objaviti drugim izvođačima.',
      confirmLabel: 'Odbij zahtjev',
      danger: true,
    })
    if (ok) run(() => listingService.declineQuote(listing.id), 'Klijent je obaviješten.')
  }

  if (isOwner) {
    return (
      <section className={`tx-quote ${declined ? 'is-declined' : ''} ${phone ? 'is-phone' : 'job-card'}`}>
        <h2><Lock size={17} /> {declined ? `${name} ne može preuzeti ovaj posao` : 'Privatni zahtjev za ponudu'}</h2>
        <p>
          {declined
            ? 'Objavi posao svima i ponude stižu od drugih izvođača.'
            : <>Posao vidi samo <Link to={`/korisnik/${invited}`}>{name}</Link>. Ako ne odgovori ili želiš više ponuda, objavi ga svima.</>}
        </p>
        {open && <button type="button" className={declined ? primary : quiet} onClick={openToAll} disabled={busy}><Users size={16} /> Objavi svima</button>}
      </section>
    )
  }

  return (
    <section className={`tx-quote ${declined ? 'is-declined' : ''} ${phone ? 'is-phone' : 'job-card'}`}>
      <h2><Send size={17} /> {declined ? 'Odbio/la si ovaj zahtjev' : 'Klijent traži ponudu samo od tebe'}</h2>
      <p>
        {declined
          ? 'Klijent je obaviješten. Ako se predomisliš, još uvijek možeš poslati ponudu dok je posao otvoren.'
          : 'Posao ne vidi niko drugi. Doseg ponuda ne važi jer je klijent izabrao baš tebe.'}
      </p>
      {!declined && open && !myBid && <button type="button" className={quiet} onClick={decline} disabled={busy}>Ne mogu ovaj posao</button>}
    </section>
  )
}
