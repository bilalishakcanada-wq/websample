import { Link } from 'react-router-dom'
import { Clock, IdCard, X } from 'lucide-react'
import { postVerifyHref } from '../hooks/usePostGate'

const TEKST = {
  needed: {
    Icon: IdCard,
    naslov: 'Prije objave potvrdi identitet',
    opis: 'Poslove objavljuju samo ljudi čiji je identitet provjeren, da niko ne bi mogao prevariti izvođače. Traje par minuta: ime, JMBG i slika dokumenta.',
    akcija: 'Potvrdi identitet',
  },
  pending: {
    Icon: Clock,
    naslov: 'Identitet se provjerava',
    opis: 'Tim provjerava tvoje podatke, obično do 24 sata. Objavi posao čim stigne obavijest da je identitet potvrđen.',
  },
  rejected: {
    Icon: X,
    naslov: 'Verifikacija nije prošla',
    opis: 'Pošalji podatke ponovo, sa jasnijom slikom dokumenta, pa ćeš moći objaviti posao.',
    akcija: 'Ponovi verifikaciju',
  },
}

/**
 * Kaže korisniku zašto još ne može objaviti posao i kuda dalje. Sve što je upisao
 * ostaje sačuvano na uređaju, pa se poslije verifikacije nastavlja gdje je stao.
 */
function IdentityGateNotice({ gate, back = '/objavi', compact = false }) {
  const t = TEKST[gate]
  if (!t) return null
  const { Icon } = t
  return (
    <div className={`post-gate-notice ${gate} ${compact ? 'compact' : ''}`} role="status" data-testid="post-gate">
      <Icon size={compact ? 16 : 20} aria-hidden="true" />
      <div>
        <strong>{t.naslov}</strong>
        {!compact && <p>{t.opis}</p>}
        <p className="post-gate-keep">Ovaj posao ostaje sačuvan dok se ne vratiš.</p>
        {t.akcija && <Link to={postVerifyHref(back)} className="post-gate-link">{t.akcija} →</Link>}
      </div>
    </div>
  )
}

export default IdentityGateNotice
