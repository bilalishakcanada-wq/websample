import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Clock, Handshake, ImagePlus, RotateCcw, Send, TrendingUp, X,
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

const km = (value) => `${Number(value || 0).toLocaleString('bs-BA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} KM`

/** Naknada za otkazivanje (ista formula kao cancellation_fee_for u bazi). */
function naknadaZaOtkaz(payment) {
  const funded = payment.funded_at ? new Date(payment.funded_at).getTime() : 0
  if (funded && Date.now() < funded + 3_600_000) return 0
  return Math.min(50, Math.round(Number(payment.amount || 0) * 10) / 100)
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
  const [refreshKey, setRefreshKey] = useState(0)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)        // null | 'submit' | 'dispute' | 'cancel' | 'increase'
  const [report, setReport] = useState('')
  const [claim, setClaim] = useState('')
  const [reasonCode, setReasonCode] = useState('quality')
  const [files, setFiles] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [cancelReq, setCancelReq] = useState(null)
  const [cancelDetail, setCancelDetail] = useState('')
  const [responsible, setResponsible] = useState('me')
  const [increase, setIncrease] = useState({ available: false, request: null })
  const [incAmount, setIncAmount] = useState('')
  const [incReason, setIncReason] = useState('')
  const fileRef = useRef(null)

  const state = payment.work_state || 'in_progress'
  const isClient = role === 'client'

  useEffect(() => {
    let alive = true
    paymentService.workSubmissions(payment.id).then((rows) => alive && setSubmissions(rows))
    paymentService.pendingCancellation(payment.id).then((row) => alive && setCancelReq(row))
    paymentService.pendingPriceIncrease(payment.id).then((row) => alive && setIncrease(row))
    return () => { alive = false }
  }, [payment.id, payment.work_state, payment.revision_count, payment.amount, refreshKey])

  const latest = submissions[0]
  const mojZahtjevZaPrekid = cancelReq?.requested_by === user?.id
  const preostaloIspravki = Math.max(0, 3 - (payment.revision_count || 0))

  const run = async (key, fn, poruka) => {
    setBusy(key); setError('')
    try {
      await fn()
      haptic('medium')
      if (poruka) toast(poruka, { kind: 'success' })
      setRefreshKey((key) => key + 1)
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

  const traziPrekid = () => run('cancelreq', async () => {
    await paymentService.requestCancellation(payment.listing_id, 'other', cancelDetail.trim() || null, responsible)
    setForm(null); setCancelDetail(''); setResponsible('me')
  }, 'Zahtjev je poslan drugoj strani.')

  const traziPovecanje = () => run('increase', async () => {
    await paymentService.requestPriceIncrease(payment.listing_id, Number(String(incAmount).replace(',', '.')), incReason.trim())
    setForm(null); setIncAmount(''); setIncReason('')
  }, 'Zahtjev je poslan klijentu. Ništa se ne naplaćuje dok ne odobri.')

  const odobriPovecanje = async () => {
    const ok = await confirmDialog({
      title: `Odobravaš +${km(increase.request.amount_km)}?`,
      text: `Iznos se odmah skida s tvog balansa i čuva na Poso.ba zajedno s ostatkom. Nova cijena posla je ${km(Number(payment.amount) + Number(increase.request.amount_km))}.`,
      confirmLabel: 'Odobri i plati',
    })
    if (!ok) return
    run('incresp', () => paymentService.respondPriceIncrease(increase.request.id, true), 'Povećanje je odobreno i plaćeno.')
  }

  const naknada = naknadaZaOtkaz(payment)
  const odgovornaStrana = cancelReq?.responsible
  const jaOdgovoran = odgovornaStrana && odgovornaStrana === (isClient ? 'client' : 'provider')

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
          {odgovornaStrana && (
            <span className="wf-note-line">
              {jaOdgovoran ? 'Kao odgovorna strana navodiš se ti' : 'Odgovorna strana: druga strana'}
              {Number(cancelReq.fee_km) > 0
                ? `. Naknada za otkazivanje od ${km(cancelReq.fee_km)} ide na teret odgovorne strane${odgovornaStrana === 'provider' ? ' i posao joj se računa kao neuspješan' : ''}.`
                : '. Prekid je zatražen u prvom satu, pa nema naknade.'}
              {!mojZahtjevZaPrekid && jaOdgovoran && ' Ako se ne slažeš, odbij ili otvori spor.'}
            </span>
          )}
        </p>
      )}

      {increase.request && (
        <div className="wf-note wf-increase">
          <strong><TrendingUp size={15} /> Traži se povećanje cijene: +{km(increase.request.amount_km)}</strong>
          <p>„{increase.request.reason}"</p>
          <p className="muted-text">
            {isClient
              ? `Ako odobriš, nova cijena je ${km(Number(payment.amount) + Number(increase.request.amount_km))}. Dodatni iznos se čuva na Poso.ba kao i ostatak.`
              : 'Čeka se odgovor klijenta. Ništa se ne naplaćuje dok ne odobri.'}
          </p>
          <div className="wf-actions">
            {isClient ? (
              <>
                <button type="button" className="primary-button" onClick={odobriPovecanje} disabled={Boolean(busy)}>
                  <CheckCircle2 size={15} /> {busy === 'incresp' ? 'Plaćam…' : `Odobri i plati ${km(increase.request.amount_km)}`}
                </button>
                <button type="button" className="ghost-button" disabled={Boolean(busy)}
                  onClick={() => run('incresp', () => paymentService.respondPriceIncrease(increase.request.id, false), 'Povećanje je odbijeno.')}>
                  <X size={15} /> Odbij
                </button>
              </>
            ) : (
              <button type="button" className="ghost-button" disabled={Boolean(busy)}
                onClick={() => run('incresp', () => paymentService.cancelPriceIncrease(increase.request.id), 'Zahtjev je povučen.')}>
                Povuci zahtjev
              </button>
            )}
          </div>
        </div>
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

      {/* --- forma: sporazumni prekid ---------------------------------------- */}
      {form === 'cancel' && (
        <div className="wf-form">
          <p className="muted-text wf-hint">Druga strana mora pristati. Dok ne odgovori, novac ostaje osiguran na Poso.ba.</p>
          {increase.available && (
            <fieldset className="wf-choice">
              <legend>Ko je odgovoran za prekid?</legend>
              <label><input type="radio" name="wf-resp" checked={responsible === 'me'} onChange={() => setResponsible('me')} /> Ja prekidam</label>
              <label><input type="radio" name="wf-resp" checked={responsible === 'other'} onChange={() => setResponsible('other')} />
                {isClient ? ' Izvođač nije ispoštovao dogovor' : ' Klijent nije ispoštovao dogovor'}</label>
            </fieldset>
          )}
          <label htmlFor="wf-cancel">Zašto prekidaš?</label>
          <textarea id="wf-cancel" value={cancelDetail} onChange={(event) => setCancelDetail(event.target.value)} rows={2} maxLength={1000}
            placeholder={responsible === 'other' ? 'Npr. izvođač se nije pojavio dva puta.' : 'Npr. ne mogu uraditi posao u dogovorenom roku.'} />
          {increase.available && (
            <p className="muted-text wf-hint">
              {naknada > 0
                ? `Odgovorna strana plaća naknadu za otkazivanje od ${km(naknada)} (10 % cijene, najviše 50 KM)${responsible === 'me' && !isClient ? ', a posao ti se računa kao neuspješan' : ''}.`
                : 'U prvom satu nakon prihvatanja ponude prekid je bez naknade.'}
            </p>
          )}
          <div className="wf-actions">
            <button type="button" className="ghost-button" onClick={() => setForm(null)}>Odustani</button>
            <button type="button" className="primary-button" onClick={traziPrekid} disabled={busy === 'cancelreq'}>
              <Send size={15} /> {busy === 'cancelreq' ? 'Šaljem…' : 'Pošalji zahtjev'}
            </button>
          </div>
        </div>
      )}

      {/* --- forma: povećanje cijene ---------------------------------------- */}
      {form === 'increase' && (
        <div className="wf-form">
          <label htmlFor="wf-inc-amount">Koliko dodatno (KM)?</label>
          <input id="wf-inc-amount" type="number" inputMode="decimal" min="1" max="2000" step="1"
            value={incAmount} onChange={(event) => setIncAmount(event.target.value)} placeholder="Npr. 40" />
          <label htmlFor="wf-inc-reason">Zašto?</label>
          <textarea id="wf-inc-reason" value={incReason} onChange={(event) => setIncReason(event.target.value)} rows={2} maxLength={1000}
            placeholder="Npr. na licu mjesta se pokazalo da treba zamijeniti i ventil." />
          <p className="muted-text wf-hint">Klijent mora odobriti. Tek tada se iznos naplati i čuva na Poso.ba, a ti ga dobiješ uz ostatak po završetku.</p>
          <div className="wf-actions">
            <button type="button" className="ghost-button" onClick={() => setForm(null)}>Odustani</button>
            <button type="button" className="primary-button" onClick={traziPovecanje}
              disabled={busy === 'increase' || !(Number(String(incAmount).replace(',', '.')) >= 1) || incReason.trim().length < 10}>
              <Send size={15} /> {busy === 'increase' ? 'Šaljem…' : 'Pošalji klijentu'}
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
          {!isClient && increase.available && !increase.request && ['in_progress', 'revision'].includes(state) && (
            <button type="button" className="ghost-button" onClick={() => setForm('increase')} disabled={Boolean(busy)}>
              <TrendingUp size={15} /> Zatraži povećanje cijene
            </button>
          )}
          {['in_progress', 'submitted', 'revision'].includes(state) && (
            <button type="button" className="ghost-button" onClick={() => setForm('cancel')} disabled={Boolean(busy)}>
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
