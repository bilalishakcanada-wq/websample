import { useRef, useState } from 'react'
import { Images, Play, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { portfolioService } from '../../services/portfolioService'
import { profileService } from '../../services/profileService'

const MAX_ITEMS = 30

function PortfolioPage() {
  const { user } = useAuth()
  const { bundle, reload } = useAccount()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const inputRef = useRef(null)
  const items = bundle?.portfolio || []

  const onFiles = async (event) => {
    const files = [...(event.target.files || [])].slice(0, MAX_ITEMS - items.length)
    if (files.length === 0) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      for (const file of files) await portfolioService.upload(user.id, file)
      const outcome = await profileService.checkMyMedia()
      const flagged = (outcome.results || []).filter((item) => item.kind === 'portfolio' && item.status === 'flagged').length
      await reload()
      setMessage(flagged ? `Dodano. ${flagged} ${flagged === 1 ? 'rad je uklonjen' : 'rada su uklonjena'} jer slika sadrži kontakt podatke (Pravilo #1).` : `Dodano ${files.length} ${files.length === 1 ? 'rad' : 'rada'}.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (id) => {
    try { await portfolioService.remove(id); await reload() } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Portfolio</h1></div>
      <h3 className="account-sub">Dodaj radove u portfolio</h3>
      <p>Pokaži šta znaš — slike i video prethodnih radova vidljivi su na tvom javnom profilu. Posebno vrijedi za fotografe, dizajnere i majstore koji žele galeriju završenih poslova.</p>
      <p className="muted-text">Možeš dodati najviše {MAX_ITEMS} radova. Formati: JPG, PNG, WEBP, MP4, WEBM, do 5 MB po slici. Zbog tvoje sigurnosti nemoj dodavati slike sa ličnim podacima, brojem telefona ili vizitkama — takve se automatski uklanjaju.</p>
      <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" hidden onChange={onFiles} />
      <button type="button" className="ghost-button badge-add" onClick={() => inputRef.current?.click()} disabled={uploading || items.length >= MAX_ITEMS}>
        {uploading ? 'Učitavam…' : 'Odaberi datoteke'}
      </button>
      <span className="muted-text account-inline-count">{items.length}/{MAX_ITEMS}</span>
      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      {items.length === 0 ? (
        <div className="portfolio-empty-note"><Images size={26} /><span>Još nema radova. Prvi rad je najjači dokaz klijentima.</span></div>
      ) : (
        <div className="portfolio-grid">
          {items.map((item) => (
            <div className="portfolio-item" key={item.id}>
              {item.media_type === 'video' ? <div className="portfolio-video-thumb"><Play size={22} /></div> : <img src={item.media_url} alt={item.caption || ''} loading="lazy" />}
              <button type="button" className="portfolio-remove" onClick={() => remove(item.id)} aria-label="Ukloni"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PortfolioPage
