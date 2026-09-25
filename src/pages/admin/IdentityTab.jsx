import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BadgeCheck, Eye, Gauge, IdCard, ShieldCheck, X } from 'lucide-react'
import { identityService } from '../../services/identityService'
import { formatBosnianDate } from '../../utils/dateFormat'
import { promptDialog } from '../../utils/dialog'
import { toast } from '../../components/Toaster'
import { SkeletonList } from '../../components/Skeleton'

const SIGNALI = {
  ime_se_razlikuje_od_profila: 'Ime se razlikuje od onog na profilu',
  isti_broj_vec_pokusan_na_drugom_nalogu: 'Isti JMBG je već pokušan na drugom nalogu',
  neuobicajena_starost: 'Neuobičajena starost',
}

/** Slika dokumenta: potpisani link traje 60 s, pa se traži tek kad se otvori. */
function Dokument({ path, naslov }) {
  const [url, setUrl] = useState(null)
  const [greska, setGreska] = useState(false)
  useEffect(() => {
    let alive = true
    identityService.signedDoc(path).then((u) => alive && (u ? setUrl(u) : setGreska(true)))
    return () => { alive = false }
  }, [path])
  if (!path) return null
  if (greska) return <div className="idv-doc idv-doc-missing">{naslov}: slika nije dostupna</div>
  return (
    <a className="idv-doc" href={url || '#'} target="_blank" rel="noreferrer" onClick={(e) => !url && e.preventDefault()}>
      {url ? <img src={url} alt={naslov} /> : <span className="idv-doc-loading" />}
      <small>{naslov}</small>
    </a>
  )
}

/**
 * Red za provjeru identiteta. Broj i slike se ne prikazuju dok moderator
 * izričito ne klikne „Otvori podatke" — i svako otvaranje ostaje zapisano.
 */
function IdentityTab() {
  const [red, setRed] = useState(null)
  const [otvoren, setOtvoren] = useState(null)      // { case, podaci }
  const [busy, setBusy] = useState('')
  const [greska, setGreska] = useState('')

  const ucitaj = useCallback(() => {
    identityService.queue().then(setRed).catch((e) => setGreska(e.message))
  }, [])
  useEffect(() => { ucitaj() }, [ucitaj])

  const otkrij = async (predmet) => {
    setBusy('reveal'); setGreska('')
    try {
      const [podaci, rizik] = await Promise.all([
        identityService.reveal(predmet.id),
        identityService.risk(predmet.id).catch(() => null),
      ])
      setOtvoren({ predmet, podaci, rizik })
    } catch (e) { setGreska(e.message) } finally { setBusy('') }
  }

  const odluci = async (predmet, odobri) => {
    let razlog = null
    if (!odobri) {
      razlog = await promptDialog({
        title: 'Zašto odbijaš?',
        text: 'Korisnik dobija ovaj tekst, pa napiši šta konkretno da popravi.',
        placeholder: 'npr. Slika je mutna, broj se ne vidi jasno.', confirmLabel: 'Odbij',
      })
      if (!razlog) return
    }
    setBusy(odobri ? 'approve' : 'reject'); setGreska('')
    try {
      await identityService.decide(predmet.id, odobri, razlog)
      toast(odobri ? 'Identitet potvrđen.' : 'Verifikacija odbijena.', { kind: 'success' })
      setOtvoren(null)
      ucitaj()
    } catch (e) { setGreska(e.message); toast(e.message, { kind: 'error' }) } finally { setBusy('') }
  }

  if (greska) return <div className="form-error">{greska}</div>
  if (red === null) return <SkeletonList n={3} h={110} />

  return (
    <div className="idv-tab">
      <div className="idv-head">
        <h2><ShieldCheck size={18} /> Provjera identiteta</h2>
        <span className="muted-text">{red.length === 0 ? 'Nema predmeta na čekanju' : `${red.length} na čekanju`}</span>
      </div>

      {red.length === 0 && (
        <p className="muted-text">Red je prazan. Novi predmeti stižu čim neko pošalje podatke na provjeru.</p>
      )}

      {red.map((predmet) => {
        const jeOtvoren = otvoren?.predmet?.id === predmet.id
        return (
          <div key={predmet.id} className={`admin-row idv-row ${jeOtvoren ? 'otvoren' : ''}`}>
            <div className="idv-main">
              <span className="idv-ikona"><IdCard size={18} /></span>
              <div>
                <strong>{predmet.full_name}</strong>
                {typeof predmet.risk_score === 'number' && (
                  <span className={`idv-rizik ${predmet.risk_score >= 40 ? 'visok' : predmet.risk_score >= 15 ? 'srednji' : 'nizak'}`}>
                    <Gauge size={12} /> {predmet.risk_score >= 40 ? 'oprez' : predmet.risk_score >= 15 ? 'pregled' : 'brzo'} · {predmet.risk_score}
                  </span>
                )}
                <div className="idv-meta">
                  <span>{predmet.birth_date ? formatBosnianDate(predmet.birth_date) : '—'}</span>
                  <span>{predmet.gender === 'M' ? 'muško' : 'žensko'}</span>
                  <span>{{ licna_karta: 'Lična karta', pasos: 'Pasoš', vozacka: 'Vozačka' }[predmet.doc_type] || '—'}</span>
                  <span>poslano {formatBosnianDate(predmet.submitted_at)}</span>
                </div>
                {predmet.risk_flags?.length > 0 && (
                  <div className="idv-flags">
                    {predmet.risk_flags.map((f) => (
                      <span key={f} className="idv-flag"><AlertTriangle size={12} /> {SIGNALI[f] || f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {!jeOtvoren && (
              <button type="button" className="ghost-button" onClick={() => otkrij(predmet)} disabled={Boolean(busy)}>
                <Eye size={15} /> {busy === 'reveal' ? 'Otvaram…' : 'Otvori podatke'}
              </button>
            )}

            {jeOtvoren && (
              <div className="idv-detalji">
                <div className="idv-podaci">
                  <div><small>JMBG</small><strong className="idv-jmbg">{otvoren.podaci.jmbg}</strong></div>
                  <div><small>Ime u zahtjevu</small><strong>{otvoren.podaci.ime}</strong></div>
                  <div><small>Broj dokumenta</small><strong>{otvoren.podaci.broj_dokumenta || '—'}</strong></div>
                </div>
                <div className="idv-slike">
                  <Dokument path={otvoren.podaci.slike?.lice} naslov="Prednja strana" />
                  <Dokument path={otvoren.podaci.slike?.nalicje} naslov="Zadnja strana" />
                  <Dokument path={otvoren.podaci.slike?.selfi} naslov="Selfi" />
                </div>
                {otvoren.rizik?.razlozi?.length > 0 && (
                  <ul className="idv-razlozi">
                    {otvoren.rizik.razlozi.map((r) => <li key={r}><AlertTriangle size={13} /> {r}</li>)}
                  </ul>
                )}
                {otvoren.podaci.kvalitet && (
                  <p className="idv-kvalitet muted-text">
                    Oštrina {otvoren.podaci.kvalitet.ostrina} · svjetlo {otvoren.podaci.kvalitet.svjetlo} · {otvoren.podaci.kvalitet.sirina}×{otvoren.podaci.kvalitet.visina}
                  </p>
                )}
                <p className="idv-uputa muted-text">
                  Uporedi broj i ime sa slikom dokumenta. Odobri samo ako se poklapaju i slika je čitljiva.
                </p>
                <div className="idv-akcije">
                  <button type="button" className="primary-button" onClick={() => odluci(predmet, true)} disabled={Boolean(busy)}>
                    <BadgeCheck size={16} /> {busy === 'approve' ? 'Potvrđujem…' : 'Potvrdi identitet'}
                  </button>
                  <button type="button" className="ghost-button danger" onClick={() => odluci(predmet, false)} disabled={Boolean(busy)}>
                    <X size={15} /> Odbij
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setOtvoren(null)} disabled={Boolean(busy)}>
                    Zatvori
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default IdentityTab
