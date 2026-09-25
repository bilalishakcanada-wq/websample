import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Clock, IdCard, Info, ShieldCheck, Upload, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { identityService } from '../../services/identityService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { toast } from '../../components/Toaster'
import { SkeletonPage } from '../../components/Skeleton'

const DOKUMENTI = [
  ['licna_karta', 'Lična karta'],
  ['pasos', 'Pasoš'],
  ['vozacka', 'Vozačka dozvola'],
]

/** JMBG u čitljivom obliku dok se kuca: 0101990 17 0003 */
const formatJmbg = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 13)
  return [d.slice(0, 7), d.slice(7, 9), d.slice(9, 13)].filter(Boolean).join(' ')
}

function Stanje({ predmet }) {
  if (!predmet) return null
  if (predmet.state === 'approved') {
    return (
      <div className="verif-state ok" role="status">
        <BadgeCheck size={20} />
        <div>
          <strong>Identitet je potvrđen</strong>
          <p>Potvrđeno {formatBosnianDate(predmet.reviewed_at)}. Možeš objavljivati poslove i slati ponude.</p>
        </div>
      </div>
    )
  }
  if (['submitted', 'in_review'].includes(predmet.state)) {
    return (
      <div className="verif-state wait" role="status">
        <Clock size={20} />
        <div>
          <strong>Provjera je u toku</strong>
          <p>Poslano {formatBosnianDate(predmet.submitted_at)}. Naš tim provjerava podatke — obično u roku 24 sata. Javljamo ti obavijest čim završi.</p>
        </div>
      </div>
    )
  }
  if (predmet.state === 'rejected') {
    return (
      <div className="verif-state bad" role="status">
        <X size={20} />
        <div>
          <strong>Verifikacija nije prošla</strong>
          <p>{predmet.reject_reason || 'Podaci se nisu poklopili.'}</p>
          <p className="muted-text">Možeš poslati ponovo — najčešće pomaže jasnija slika dokumenta, bez odsjaja i sa vidljivim uglovima.</p>
        </div>
      </div>
    )
  }
  return null
}

function VerificationPage() {
  const { user } = useAuth()
  const [predmet, setPredmet] = useState(undefined)   // undefined = učitavanje
  const [ime, setIme] = useState('')
  const [jmbg, setJmbg] = useState('')
  const [tipDok, setTipDok] = useState('licna_karta')
  const [brojDok, setBrojDok] = useState('')
  const [lice, setLice] = useState(null)
  const [nalicje, setNalicje] = useState(null)
  const [busy, setBusy] = useState(false)
  const [greska, setGreska] = useState('')
  const liceRef = useRef(null)
  const nalicjeRef = useRef(null)

  useEffect(() => {
    identityService.mine().then((row) => {
      setPredmet(row)
      if (row && row.state === 'rejected') setIme(row.full_name || '')
    })
  }, [])

  if (predmet === undefined) return <SkeletonPage />

  const zakljucano = predmet && ['submitted', 'in_review', 'approved'].includes(predmet.state)
  const cifre = jmbg.replace(/\D/g, '')
  const spremno = ime.trim().split(/\s+/).length >= 2 && cifre.length === 13 && lice

  const posalji = async (event) => {
    event.preventDefault()
    setBusy(true); setGreska('')
    try {
      const front = await identityService.uploadDoc(user.id, lice, 'lice')
      const back = nalicje ? await identityService.uploadDoc(user.id, nalicje, 'nalicje') : null
      const row = await identityService.submit({
        fullName: ime.trim(), jmbg: cifre, docType: tipDok, docNumber: brojDok, front, back,
      })
      setPredmet(row)
      toast('Podaci su poslani na provjeru.', { kind: 'success' })
    } catch (error) {
      setGreska(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account-section verif-page">
      <div className="account-section-head">
        <h1>Potvrda identiteta</h1>
        <p className="muted-text">Poso.ba drži pravi novac. Zato prije objave posla ili slanja ponude provjeravamo ko je ko — to štiti i tebe i drugu stranu.</p>
      </div>

      <Stanje predmet={predmet} />

      {!zakljucano && (
        <form className="verif-form" onSubmit={posalji}>
          <div className="verif-field">
            <label htmlFor="v-ime">Ime i prezime <span className="req">*</span></label>
            <input id="v-ime" value={ime} onChange={(e) => setIme(e.target.value)} required
              autoComplete="name" placeholder="Kako piše u dokumentu" maxLength={80} />
            <small>Mora se poklapati sa dokumentom koji šalješ.</small>
          </div>

          <div className="verif-field">
            <label htmlFor="v-jmbg">JMBG <span className="req">*</span></label>
            <input id="v-jmbg" value={formatJmbg(jmbg)} onChange={(e) => setJmbg(e.target.value)}
              required inputMode="numeric" placeholder="13 cifara" maxLength={16} />
            <small>
              {cifre.length > 0 && cifre.length < 13
                ? `Uneseno ${cifre.length} od 13 cifara.`
                : 'Broj se čuva šifrovano. Vidi ga samo član tima koji provjerava tvoj dokument, i svako otvaranje ostaje zabilježeno.'}
            </small>
          </div>

          <div className="verif-field">
            <label htmlFor="v-tip">Dokument</label>
            <select id="v-tip" value={tipDok} onChange={(e) => setTipDok(e.target.value)}>
              {DOKUMENTI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div className="verif-field">
            <label htmlFor="v-broj">Broj dokumenta</label>
            <input id="v-broj" value={brojDok} onChange={(e) => setBrojDok(e.target.value)}
              placeholder="npr. A1B2C3D4" maxLength={30} />
          </div>

          <div className="verif-uploads">
            <input ref={liceRef} type="file" accept="image/*" hidden onChange={(e) => setLice(e.target.files[0] || null)} />
            <input ref={nalicjeRef} type="file" accept="image/*" hidden onChange={(e) => setNalicje(e.target.files[0] || null)} />
            <button type="button" className={`verif-upload ${lice ? 'ima' : ''}`} onClick={() => liceRef.current?.click()}>
              <IdCard size={22} />
              <span><strong>Prednja strana <em className="req">*</em></strong>{lice ? <small>{lice.name.slice(0, 28)}</small> : <small>Slikaj ili izaberi</small>}</span>
              <Upload size={16} />
            </button>
            <button type="button" className={`verif-upload ${nalicje ? 'ima' : ''}`} onClick={() => nalicjeRef.current?.click()}>
              <IdCard size={22} />
              <span><strong>Zadnja strana</strong>{nalicje ? <small>{nalicje.name.slice(0, 28)}</small> : <small>Ako je dokument dvostran</small>}</span>
              <Upload size={16} />
            </button>
          </div>

          <p className="verif-privacy">
            <ShieldCheck size={15} />
            Slike idu u zatvoreni prostor koji ni ti ne možeš pročitati nazad — vidi ih samo tim koji provjerava. Ne objavljuju se nigdje na profilu.
          </p>

          {greska && <div className="form-error">{greska}</div>}

          <button type="submit" className="primary-button verif-submit" disabled={!spremno || busy}>
            {busy ? 'Šaljem…' : 'Pošalji na provjeru'}
          </button>
          {!spremno && (
            <p className="muted-text verif-hint">
              <Info size={14} /> Treba: ime i prezime, 13 cifara JMBG-a i slika prednje strane dokumenta.
            </p>
          )}
        </form>
      )}
    </div>
  )
}

export default VerificationPage
