import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarDays, Check, Laptop, MapPin, Wallet } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { listingService } from '../services/listingService'
import { tagService } from '../services/tagService'
import { bosniaCities } from '../data/cities'
import { serviceCategories } from '../data/categories'
import { findProhibitedTerm } from '../utils/moderation'

const STEPS = [
  { id: 'basics', label: 'Naslov i rok' },
  { id: 'location', label: 'Lokacija' },
  { id: 'details', label: 'Detalji' },
  { id: 'budget', label: 'Budžet' },
]

const TIMING_OPTIONS = [
  { id: 'date', label: 'Na određeni datum' },
  { id: 'before', label: 'Prije datuma' },
  { id: 'flexible', label: 'Fleksibilan sam' },
]

function PostTaskPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [tagList, setTagList] = useState([])
  const [form, setForm] = useState({
    title: '',
    timing: 'flexible',
    date: '',
    mode: 'in-person',
    location: '',
    category: '',
    description: '',
    price: '',
  })

  useEffect(() => {
    if (!editId) return
    listingService.getById(editId)
      .then((listing) => {
        if (!listing) return
        const isRemote = listing.location === 'Online / na daljinu'
        setForm((current) => ({
          ...current,
          title: listing.title || '',
          category: listing.category || '',
          description: (listing.description || '').split('\n\nKada:')[0],
          location: isRemote ? '' : (listing.location || ''),
          mode: isRemote ? 'remote' : 'in-person',
          price: listing.price ?? '',
        }))
      })
      .catch(() => {})
  }, [editId])

  const update = (changes) => setForm((current) => ({ ...current, ...changes }))

  const canContinue = () => {
    if (step === 0) return form.title.trim().length >= 3 && (form.timing === 'flexible' || form.date)
    if (step === 1) return form.mode === 'remote' || Boolean(form.location)
    if (step === 2) return Boolean(form.category) && form.description.trim().length >= 10
    return true
  }

  const addTag = () => {
    const tag = tagDraft.trim().replace(/<[^>]*>/g, '').slice(0, 40)
    if (!tag || tagList.includes(tag) || tagList.length >= 10) return
    setTagList((current) => [...current, tag])
    setTagDraft('')
  }

  const timingLabel = () => {
    if (form.timing === 'flexible') return 'Fleksibilan termin'
    if (form.timing === 'before') return `Prije ${form.date}`
    return `Na dan ${form.date}`
  }

  const submit = async () => {
    setError('')
    const hit = findProhibitedTerm(form.title, form.description)
    if (hit) {
      setError('Oglas sadrži sadržaj koji krši Pravila korištenja (npr. oružje ili droga) i ne može biti objavljen.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        user_id: user.id,
        title: form.title.trim(),
        description: `${form.description.trim()}\n\nKada: ${timingLabel()}`,
        category: form.category,
        location: form.mode === 'remote' ? 'Online / na daljinu' : form.location,
        price: form.price ? Number(form.price) : null,
        status: 'published',
      }
      const listing = editId
        ? await listingService.updateListing(editId, payload)
        : await listingService.createListing(payload)
      if (tagList.length > 0) await tagService.createForListing(listing.id, tagList, user.id)
      navigate(`/listings/${listing.id}`)
    } catch (requestError) {
      setError(requestError.message)
      setSaving(false)
    }
  }

  return (
    <div className="wizard-shell">
      <header className="wizard-header">
        <button type="button" className="icon-button" onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))} aria-label="Nazad">
          <ArrowLeft size={20} />
        </button>
        <span className="wizard-title">Objavi posao</span>
        <button type="button" className="back-home-link" onClick={() => navigate('/')}>Odustani</button>
      </header>

      <div className="wizard-progress">
        {STEPS.map((item, index) => (
          <div key={item.id} className={`wizard-step ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}>
            <span className="wizard-step-dot">{index < step ? <Check size={13} /> : index + 1}</span>
            <span className="wizard-step-label">{item.label}</span>
          </div>
        ))}
      </div>

      <main className="wizard-body">
        {step === 0 && (
          <section className="wizard-panel">
            <h1>Počnimo od osnovnog</h1>
            <p className="muted-text">U par riječi — šta vam treba da se uradi?</p>
            <label className="wizard-field">
              <span>Naslov posla</span>
              <input
                value={form.title}
                onChange={(event) => update({ title: event.target.value })}
                placeholder="npr. Montaža kuhinjskih elemenata"
                maxLength={120}
                autoFocus
              />
            </label>

            <span className="wizard-label">Kada vam treba?</span>
            <div className="wizard-options">
              {TIMING_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`wizard-option ${form.timing === option.id ? 'selected' : ''}`}
                  onClick={() => update({ timing: option.id })}
                >
                  <CalendarDays size={18} />
                  {option.label}
                </button>
              ))}
            </div>
            {form.timing !== 'flexible' && (
              <label className="wizard-field">
                <span>Datum</span>
                <input type="date" value={form.date} onChange={(event) => update({ date: event.target.value })} />
              </label>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="wizard-panel">
            <h1>Gdje se posao obavlja?</h1>
            <p className="muted-text">Odaberite da li je potreban dolazak na lokaciju ili se radi online.</p>
            <div className="wizard-options">
              <button type="button" className={`wizard-option ${form.mode === 'in-person' ? 'selected' : ''}`} onClick={() => update({ mode: 'in-person' })}>
                <Building2 size={18} /> Na lokaciji
              </button>
              <button type="button" className={`wizard-option ${form.mode === 'remote' ? 'selected' : ''}`} onClick={() => update({ mode: 'remote' })}>
                <Laptop size={18} /> Online / na daljinu
              </button>
            </div>
            {form.mode === 'in-person' && (
              <label className="wizard-field">
                <span>Grad</span>
                <select value={form.location} onChange={(event) => update({ location: event.target.value })}>
                  <option value="">Odaberi grad</option>
                  {bosniaCities.map((cityName) => <option key={cityName}>{cityName}</option>)}
                </select>
              </label>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="wizard-panel">
            <h1>Recite nam detalje</h1>
            <p className="muted-text">Što jasnije opišete, to ćete dobiti bolje i preciznije ponude.</p>
            <label className="wizard-field">
              <span>Kategorija</span>
              <select value={form.category} onChange={(event) => update({ category: event.target.value })}>
                <option value="">Odaberi kategoriju</option>
                {serviceCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </label>
            <label className="wizard-field">
              <span>Opis posla</span>
              <textarea
                value={form.description}
                onChange={(event) => update({ description: event.target.value })}
                placeholder="Opišite šta tačno treba uraditi, koliko je veliki posao, da li je potreban alat..."
                rows={6}
                maxLength={5000}
              />
            </label>
            <label className="wizard-field">
              <span>Tagovi (opciono)</span>
              <div className="wizard-tag-row">
                <input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag() } }}
                  placeholder="npr. hitno"
                />
                <button type="button" className="ghost-button" onClick={addTag}>Dodaj</button>
              </div>
            </label>
            {tagList.length > 0 && (
              <div className="tag-list">
                {tagList.map((tag) => (
                  <button type="button" className="tag" key={tag} onClick={() => setTagList((current) => current.filter((item) => item !== tag))}>
                    {tag} ×
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="wizard-panel">
            <h1>Koliki je vaš budžet?</h1>
            <p className="muted-text">Ne brinite — iznos možete dogovoriti i naknadno sa izvođačem.</p>
            <label className="wizard-field wizard-budget">
              <span>Budžet u KM</span>
              <div className="wizard-budget-input">
                <Wallet size={20} />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.price}
                  onChange={(event) => update({ price: event.target.value })}
                  placeholder="Ostavite prazno za 'Po dogovoru'"
                />
              </div>
            </label>

            <div className="wizard-summary">
              <h3>Pregled oglasa</h3>
              <div className="wizard-summary-row"><span>Naslov</span><strong>{form.title || '—'}</strong></div>
              <div className="wizard-summary-row"><span>Kategorija</span><strong>{form.category || '—'}</strong></div>
              <div className="wizard-summary-row"><span>Lokacija</span><strong>{form.mode === 'remote' ? 'Online / na daljinu' : (form.location || '—')}</strong></div>
              <div className="wizard-summary-row"><span>Kada</span><strong>{timingLabel()}</strong></div>
              <div className="wizard-summary-row"><span>Budžet</span><strong>{form.price ? `${form.price} KM` : 'Po dogovoru'}</strong></div>
            </div>
          </section>
        )}

        {error && <div className="form-error">{error}</div>}
      </main>

      <footer className="wizard-footer">
        {step > 0 && <button type="button" className="ghost-button" onClick={() => setStep((s) => s - 1)}>Nazad</button>}
        {step < STEPS.length - 1 && (
          <button type="button" className="primary-button wizard-next" disabled={!canContinue()} onClick={() => setStep((s) => s + 1)}>
            Nastavi
          </button>
        )}
        {step === STEPS.length - 1 && (
          <button type="button" className="primary-button wizard-next" disabled={saving} onClick={submit}>
            {saving ? 'Objavljujem...' : 'Objavi posao'}
          </button>
        )}
      </footer>
    </div>
  )
}

export default PostTaskPage
