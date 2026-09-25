import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock, Handshake, ImagePlus, RotateCcw, Send, X,
} from 'lucide-react'
import { paymentService } from '../services/paymentService'
import { formatBosnianDate } from '../utils/dateFormat'
import { haptic } from '../utils/native'
import { toast } from './Toaster'
import { confirmDialog, promptDialog } from '../utils/dialog'

/** Koliko je ostalo do automatskog odobrenja — klijent mora vidjeti da rok teče. */
function Countdown({ until }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const left = new Date(until).getTime() - now
  if (left <= 0) return <span className="wf-clock late"><Clock size={14} /> Rok je istekao — uplata se oslobađa automatski</span>
  const hours = Math.floor(left / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  return (
    <span className={`wf-clock ${hours < 6 ? 'soon' : ''}`}>
      <Clock size={14} /> Automatsko odobrenje za {hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`}
    </span>
  )
}

const RAZLOZI_SPORA = [
  ['not_delivered', 'Posao nije urađen'],
  ['quality', 'Urađeno, ali ne po dogovoru'],
  ['payment_refused', 'Klijent odbija osloboditi uplatu'],
  ['off_platform', 'Traži plaćanje mimo Poso.ba'],
  ['other', 'Drugi razlog'],
]

/**
 * Tok posla od osigurane uplate do isplate: predaja rada sa dokazom, 72-satni rok,
 * ispravke, sporazumni prekid i spor. Pravila su u bazi (supabase/booking) — ovdje
 * su samo dugmad koja odgovaraju trenutnom stanju i ulozi.
 */
function WorkFlow({ payment, role, user, onChanged }) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)        // null | 'submit' | 'dispute'
  const [report, setReport] = useState('')
  const [claim, setClaim] = useState('')
  const [reasonCode, setReasonCode] = useState('quality')
  const [files, setFiles] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [cancelReq, setCancelReq] = useState(null)
  const fileRef = useRef(null)

  const state = payment.work_state || 'in_progress'
  const isClient = role === 'client'

  useEffect(() => {
    let alive = true
    paymentService.workSubmissions(payment.id).then((rows) => alive && setSubmissions(rows))
    paymentService.pendingCancellation(payment.id).then((row) => alive && setCancelReq(row))
    return () => { alive = false }
  }, [payment.id, payment.work_state, payment.revision_count])

  const latest = submissions[0]
  const mojZahtjevZaPrekid = cancelReq?.requested_by === user?.id
  const preostaloIspravki = Math.max(0, 3 - (payment.revision_count || 0))

  const run = async (key, fn, poruka) => {
    setBusy(key); setError('')
    try {
      await fn()
      haptic('medium')
      if (poruka) toast(poruka, { kind: 'success' })
      onChanged?.()
    } catch (requestError) {
      setError(requestError.message)
      toast(requestError.message, { kind: 'error' })
    } finally { setBusy('') }
  }

  const predajRad = () => run('submit', async () => {
    const urls = files.length ? await paymentService.uploadEvidence(user.id, files) : []
    await paymentService.submitWork(payment.listing_id, report.trim(), urls)
    setForm(null); setReport(''); setFiles([])
  }, 'Rad je predat — klijent ima 72 sata da pregleda.')

  const odobri = async () => {
    const ok = await confirmDialog({
      title: 'Odobravaš rad?',
      text: 'Uplata odmah ide izvođaču. Ovo se ne može poništiti.',
      confirmLabel: 'Odobri i isplati',
    })
    if (!ok) return
    run('approve', () => paymentService.approveWork(payment.listing_id), 'Odobreno — izvođač je dobio uplatu.')
  }

  const traziIspravku = async () => {
    const razlog = await promptDialog({
      title: 'Šta treba ispraviti?',
      text: `Izvođač dobija tvoju poruku i predaje rad ponovo. Ostalo ti je ${preostaloIspravki} ${preostaloIspravki === 1 ? 'ispravka' : 'ispravke'}.`,
      placeholder: 'Npr. dvije police nisu poravnate…', confirmLabel: 'Pošalji',
    })
    if (!razlog) return
    run('revision', () => paymentService.requestRevision(payment.listing_id, razlog), 'Zahtjev za ispravku je poslan.')
  }

  const oslobodiOdmah = async () => {
    const ok = await confirmDialog({
      title: 'Oslobodiš uplatu prije predaje rada?',
      text: 'Izvođač odmah dobija novac, bez dokaza o obavljenom poslu. Ovo se ne može poništiti.',
      confirmLabel: 'Oslobodi uplatu', danger: true,
    })
    if (!ok) return
    run('release', () => paymentService.releasePayment(payment.listing_id), 'Uplata je oslobođena izvođaču.')
  }

  const traziPrekid = async () => {
    const detail = await promptDialog({
      title: 'Zahtjev za sporazumni prekid',
      text: 'Druga strana mora pristati. Dok ne odgovori, novac ostaje osiguran na Poso.ba.',
      placeholder: 'Zašto prekidaš?', confirmLabel: 'Pošalji zahtjev',
    })
    if (detail === null) return
    run('cancelreq', () => paymentService.requestCancellation(payment.listing_id, 'other', detail), 'Zahtjev je poslan drugoj strani.')
  }

  const odgovoriNaPrekid = (prihvati) => run('cancelresp',
    () => paymentService.respondCancellation(payment.listing_id, prihvati),
    prihvati ? 'Prekid je prihvaćen — novac je vraćen klijentu.' : 'Prekid nije prihvaćen; posao se nastavlja.')

  const posaljiSpor = () => run('dispute', async () => {
    const urls = files.length ? await paymentService.uploadEvidence(user.id, files) : []
    await paymentService.openWorkDispute(payment.listing_id, reasonCode, claim.trim(), urls)
    setForm(null); setClaim(''); setFiles([])
  }, 'Spor je otvoren — posao je zamrznut dok tim ne odluči.')

  const naslov = useMemo(() => ({
    in_progress: isClient ? 'Izvođač radi posao' : 'Posao je u toku',
    submitted: isClient ? 'Rad je predat — pregledaj ga' : 'Čeka se da klijent pregleda',
    revision: isClient ? 'Tražio/la si ispravku' : 'Klijent traži ispravku',
    cancel_requested: 'Zatražen je prekid posla',
    disputed: 'Spor — tim pregleda',
    completed: 'Posao je završen',
    cancelled: 'Posao je prekinut',
  }[state]), [state, isClient])

  return (
    <section className="job-card wf-card">
      <div className="wf-head">
        <h2><Handshake size={18} /> Tok posla</h2>
        <span className={`pill wf-${state}`}>{naslov}</span>
      </div>

      {state === 'submitted' && payment.review_deadline && <Countdown until={payment.review_deadline} />}

      {latest && (
        <div className="wf-submission">
          <strong>{latest.revision_no > 0 ? `Ispravka #${latest.revision_no}` : 'Predani rad'} · {formatBosnianDate(latest.submitted_at)}</strong>
          <p>{latest.report}</p>
          {latest.evidence_urls?.length > 0 && (
            <div className="wf-evidence">
              {latest.evidence_urls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Dokaz" loading="lazy" /></a>
              ))}
            </div>
          )}
        </div>
      )}

      {state === 'cancel_requested' && (
        <p className="wf-note">
          {mojZahtjevZaPrekid
            ? 'Poslao/la si zahtjev za prekid. Čeka se odgovor druge strane — novac je i dalje osiguran.'
            : 'Druga strana traži prekid posla. Ako prihvatiš, novac se vraća klijentu. Ako odbiješ, posao se nastavlja.'}
          {cancelReq?.detail && <em> „{cancelReq.detail}"</em>}
        </p>
      )}

      {error && <div className="form-error">{error}</div>}

      {/* --- forma: predaja rada ------------------------------------------- */}
      {form === 'submit' && (
        <div className="wf-form">
          <label htmlFor="wf-report">Šta si uradio/la?</label>
          <textarea id="wf-report" value={report} onChange={(event) => setReport(event.target.value)} rows={3} maxLength={2000}
            placeholder="Npr. Montirani svi kuhinjski elementi, police poravnate i provjerene." />
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(event) => setFiles([...event.target.files].slice(0, 5))} />
          <button type="button" className="ghost-button" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={15} /> {files.length ? `${files.length} ${files.length === 1 ? 'slika' : 'slike'}` : 'Dodaj slike (do 5)'}
          </button>
          <p className="muted-text wf-hint">Dokaz je obavezan: napiši izvještaj (bar 20 znakova) ili dodaj sliku.</p>
          <div className="wf-actions">
            <button type="button" className="ghost-button" onClick={() => setForm(null)}>Odustani</button>
            <button type="button" className="primary-button" onClick={predajRad}
              disabled={busy === 'submit' || (report.trim().length < 20 && files.length === 0)}>
              <Send size={15} /> {busy === 'submit' ? 'Šaljem…' : 'Predaj rad'}
            </button>
          </div>
        </div>
      )}

      {/* --- forma: spor ---------------------------------------------------- */}
      {form === 'dispute' && (
        <div className="wf-form">
          <label htmlFor="wf-reason">Razlog</label>
          <select id="wf-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
            {RAZLOZI_SPORA.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <label htmlFor="wf-claim">Šta se desilo?</label>
          <textarea id="wf-claim" value={claim} onChange={(event) => setClaim(event.target.value)} rows={3} maxLength={4000}
            placeholder="Budi konkretan — tim gleda i prepisku i priložene dokaze." />
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(event) => setFiles([...event.target.files].slice(0, 5))} />
          <button type="button" className="ghost-button" onClick={() => fileRef.current?.click()}>
            <ImagePlus size={15} /> {files.length ? `${files.length} priloga` : 'Dodaj dokaz'}
          </button>
          <div className="wf-actions">
            <button type="button" className="ghost-button" onClick={() => setForm(null)}>Odustani</button>
            <button type="button" className="danger-button" onClick={posaljiSpor}
              disabled={busy === 'dispute' || claim.trim().length < 20}>
              <AlertTriangle size={15} /> {busy === 'dispute' ? 'Šaljem…' : 'Otvori spor'}
            </button>
          </div>
        </div>
      )}

      {/* --- dugmad po stanju ---------------------------------------------- */}
      {form === null && (
        <div className="wf-actions wf-actions-main">
          {!isClient && ['in_progress', 'revision'].includes(state) && (
            <button type="button" className="primary-button" onClick={() => setForm('submit')} disabled={Boolean(busy)}>
              <BadgeCheck size={16} /> {state === 'revision' ? 'Predaj ispravljen rad' : 'Predaj rad'}
            </button>
          )}
          {isClient && state === 'submitted' && (
            <>
              <button type="button" className="primary-button" onClick={odobri} disabled={Boolean(busy)}>
                <CheckCircle2 size={16} /> {busy === 'approve' ? 'Odobravam…' : 'Odobri i isplati'}
              </button>
              {preostaloIspravki > 0 && (
                <button type="button" className="ghost-button" onClick={traziIspravku} disabled={Boolean(busy)}>
                  <RotateCcw size={15} /> Traži ispravku ({preostaloIspravki})
                </button>
              )}
            </>
          )}
          {isClient && state === 'in_progress' && (
            // klijent smije platiti i prije predaje rada — svoj novac, svoja odluka
            <button type="button" className="ghost-button" onClick={oslobodiOdmah} disabled={Boolean(busy)}>
              <CheckCircle2 size={15} /> Oslobodi uplatu odmah
            </button>
          )}
          {state === 'cancel_requested' && !mojZahtjevZaPrekid && (
            <>
              <button type="button" className="primary-button" onClick={() => odgovoriNaPrekid(true)} disabled={Boolean(busy)}>
                <CheckCircle2 size={16} /> Prihvati prekid
              </button>
              <button type="button" className="ghost-button" onClick={() => odgovoriNaPrekid(false)} disabled={Boolean(busy)}>
                <X size={15} /> Odbij
              </button>
            </>
          )}
          {['in_progress', 'submitted', 'revision'].includes(state) && (
            <button type="button" className="ghost-button" onClick={traziPrekid} disabled={Boolean(busy)}>
              Zatraži prekid
            </button>
          )}
          {['in_progress', 'submitted', 'revision', 'cancel_requested'].includes(state) && (
            <button type="button" className="ghost-button danger" onClick={() => setForm('dispute')} disabled={Boolean(busy)}>
              <AlertTriangle size={15} /> Otvori spor
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default WorkFlow
