import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, Camera, ChevronRight, Delete, Laptop, LocateFixed, Plus, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { serviceCategories } from '../data/categories'
import { cityCoordinates } from '../data/cityCoordinates'
import { POPULAR_CITIES } from '../data/siteMap'
import { publishListing } from '../services/publishListing'
import { formScheduleFromListing, formScheduleLabel, shortDate, todayBa } from '../utils/schedule'
import { ReachHint, RequirementsEditor, TimeOfDayPicker, TravelPicker } from '../components/TaskExtras'
import { listingService } from '../services/listingService'
import { guessCategory } from '../utils/categoryGuess'
import { useCategoryPrice } from '../hooks/useCategoryPrice'
import { useKeyboardAvoid } from '../hooks/useKeyboardAvoid'
import { haptic } from '../utils/native'
import { toast } from '../components/Toaster'
import { useBackSteps, useBackToClose } from '../hooks/useBackToClose'
import { useGoBack } from '../hooks/useGoBack'
import { usePresence } from '../hooks/usePresence'
import { useStepDirection } from '../hooks/useStepDirection'
import { useFullscreen } from './useFullscreen'
import './app.css'
import { scrollToTop } from '../utils/scroll'
import { recordInterest } from '../utils/interests'

const DRAFT_KEY = 'poso-post-draft'
const STEPS = ['title', 'time', 'where', 'describe', 'photos', 'budget', 'review']
const ALL_CITIES = Object.keys(cityCoordinates)
const fold = (value) => String(value || '').toLowerCase().replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z').replace(/đ/g, 'dj')

const emptyForm = { title: '', timing: '', date: '', timeOfDay: [], mode: '', location: '', description: '', requirements: [], category: '', price: '', travel: '' }

const loadDraft = () => {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
const saveDraft = (form, step) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step })) } catch { /* ignore */ } }
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } }

// the browser's Bosnian locale data is often incomplete ("M09 29, Tue"), so format by hand
const formatDate = shortDate

/**
 * Phone "Objavi posao" — one question per screen, like the app people already know:
 * title → time → where → description → photos → budget → review. Guests can go all the
 * way to the review and are asked to sign in only when they tap "Objavi".
 */
function PostFlow() {
  useFullscreen()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  // "Objavi sličan posao": start from an earlier job (text, place, budget), pick a new date
  const copyId = editId ? null : searchParams.get('copy')
  const draft = useMemo(() => (editId || copyId ? null : loadDraft()), [editId, copyId])
  const [step, setStep] = useState(() => (draft?.step ?? 0))
  const stepDir = useStepDirection(step)
  const [form, setForm] = useState(() => ({ ...emptyForm, ...(draft?.form || {}) }))
  const [files, setFiles] = useState([])
  // one preview URL per picked photo, made once and released when the photo goes (not on every keystroke)
  const [previews, setPreviews] = useState([])
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])
  const [existingImages, setExistingImages] = useState([])
  const [removed, setRemoved] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cityOpen, setCityOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const fileRef = useRef(null)
  const priceStats = useCategoryPrice(form.category)
  const footRef = useKeyboardAvoid()

  const goBackOut = useGoBack('/')
  // the phone's back button walks the steps like the arrow does, then leaves the flow
  const leaveFlow = useBackSteps(step, 0, () => setStep((s) => Math.max(0, s - 1)))
  useBackToClose(cityOpen, () => setCityOpen(false))
  useBackToClose(catOpen, () => setCatOpen(false))
  const catSheet = usePresence(catOpen, 220)

  // editing an existing job (or copying one): load it into the flow
  useEffect(() => {
    const sourceId = editId || copyId
    if (!sourceId) return
    listingService.getById(sourceId).then((listing) => {
      if (!listing) return
      const remote = listing.location === 'Online / na daljinu'
      const schedule = formScheduleFromListing(listing)
      // a date that has already passed (reposting an expired job, or a copy) has to be picked again
      const stale = copyId || (schedule.date && schedule.date < todayBa())
      setForm({
        title: listing.title || '',
        ...(stale ? { timing: '', date: '', timeOfDay: schedule.timeOfDay } : schedule),
        mode: remote ? 'remote' : 'in-person',
        location: remote ? '' : (listing.location || ''),
        description: (listing.description || '').split('\n\nKada:')[0],
        requirements: listing.requirements || [],
        category: listing.category || '',
        price: listing.price ?? '',
        travel: listing.travel_allowance ? String(Math.round(listing.travel_allowance)) : '',
      })
      if (editId) setExistingImages([...(listing.listing_images || [])].sort((a, b) => a.position - b.position))
      // land on the field the user tapped ("Uredi" next to the date / budget), otherwise on the review
      const wanted = STEPS.indexOf(searchParams.get('step'))
      setStep(stale ? STEPS.indexOf('time') : wanted >= 0 ? wanted : STEPS.length - 1)
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, copyId])

  // keep the draft on the device so a sign-in detour never loses the job
  useEffect(() => { if (!editId) saveDraft(form, step) }, [form, step, editId])

  const update = (changes) => setForm((current) => ({ ...current, ...changes }))
  const key = STEPS[step]

  const valid = {
    title: form.title.trim().length >= 3,
    time: form.timing === 'flexible' || ((form.timing === 'date' || form.timing === 'before') && Boolean(form.date) && form.date >= todayBa()),
    where: form.mode === 'remote' || (form.mode === 'in-person' && Boolean(form.location)),
    describe: form.description.trim().length >= 10,
    photos: true,
    budget: true,
    review: Boolean(form.category),
  }[key]

  const goNext = () => {
    haptic('light')
    if (key === 'describe' && !form.category) {
      const guess = guessCategory(form.title, form.description)
      if (guess) update({ category: guess })
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
    scrollToTop()
  }
  const goBack = () => {
    if (step === 0) { goBackOut(); return }
    setStep((s) => s - 1)
  }

  const pickFiles = (event) => {
    const picked = Array.from(event.target.files || []).filter((file) => /^image\//.test(file.type)).slice(0, 10 - files.length)
    setFiles((current) => [...current, ...picked].slice(0, 10))
    event.target.value = ''
  }

  const submit = async () => {
    if (!user) {
      saveDraft(form, step)
      navigate(`/register?next=${encodeURIComponent('/objavi')}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const { listing, flaggedPhotos } = await publishListing({ user, form, photos: { files, removed }, existingImages, editId })
      if (flaggedPhotos > 0) toast(`Pravilo #1: ${flaggedPhotos} ${flaggedPhotos === 1 ? 'slika je uklonjena' : 'slike su uklonjene'} jer sadrži kontakt podatke.`, { kind: 'error', duration: 6000 })
      clearDraft()
      if (!editId) recordInterest('post', { category: listing.category ?? form.category })
      haptic('medium')
      if (editId) toast('Izmjene su sačuvane.', { kind: 'success' })
      navigate(`/listings/${listing.id}${editId ? '' : '?published=1'}`, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
      setSaving(false)
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="ap ap-screen ap-post" data-dir={stepDir}>
      <header className="ap-top">
        <button type="button" className="ap-back" onClick={goBack} aria-label="Nazad"><ArrowLeft size={22} /></button>
        <div className="ap-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <button type="button" className="ap-cancel" onClick={() => leaveFlow(() => { clearDraft(); goBackOut() })}>Odustani</button>
      </header>

      {/* ---------- 1. title ---------- */}
      {key === 'title' && (
        <section className="ap-body" key="title">
          <h1 className="ap-title">Počni s naslovom</h1>
          <p className="ap-sub">U par riječi, šta ti treba?</p>
          <input className="ap-input" autoFocus value={form.title} maxLength={70} placeholder="npr. Selidba kauča" onChange={(event) => update({ title: event.target.value })} enterKeyHint="next" onKeyDown={(event) => { if (event.key === 'Enter' && valid) goNext() }} />
          <span className="ap-hint">Najviše 70 znakova</span>
        </section>
      )}

      {/* ---------- 2. time ---------- */}
      {key === 'time' && (
        <section className="ap-body" key="time">
          <h1 className="ap-title">Odaberi vrijeme</h1>
          <p className="ap-sub">Kad ti treba da bude urađeno?</p>
          <div className="ap-options">
            {[['date', 'Na određeni datum'], ['before', 'Prije datuma'], ['flexible', 'Fleksibilan sam']].map(([id, label]) => (
              <button key={id} type="button" className={`ap-option ${form.timing === id ? 'active' : ''}`} onClick={() => { update({ timing: id, ...(id === 'flexible' ? { date: '' } : {}) }); haptic('light') }}>{label}</button>
            ))}
          </div>
          {(form.timing === 'date' || form.timing === 'before') && (
            <label className="ap-date">
              <span>{form.timing === 'date' ? 'Datum' : 'Najkasnije do'}</span>
              <input type="date" value={form.date} min={todayBa()} onChange={(event) => update({ date: event.target.value })} />
              {form.date && <em>{formatDate(form.date)}</em>}
            </label>
          )}
          {form.timing && (
            <>
              <span className="ap-label">U koje doba dana? (opciono)</span>
              <TimeOfDayPicker value={form.timeOfDay || []} onChange={(timeOfDay) => { update({ timeOfDay }); haptic('light') }} />
            </>
          )}
        </section>
      )}

      {/* ---------- 3. where ---------- */}
      {key === 'where' && (
        <section className="ap-body" key="where">
          <h1 className="ap-title">Gdje?</h1>
          <p className="ap-sub">Gdje treba uraditi posao?</p>
          <div className="ap-cards">
            <button type="button" className={`ap-card ${form.mode === 'in-person' ? 'active' : ''}`} onClick={() => { update({ mode: 'in-person' }); haptic('light') }}>
              <Building2 size={22} /><strong>Uživo</strong><span>Izvođač dolazi na lokaciju</span>
            </button>
            <button type="button" className={`ap-card ${form.mode === 'remote' ? 'active' : ''}`} onClick={() => { update({ mode: 'remote', location: '' }); haptic('light') }}>
              <Laptop size={22} /><strong>Online</strong><span>Može se uraditi od kuće</span>
            </button>
          </div>
          {form.mode === 'in-person' && (
            <>
              <span className="ap-label">Grad</span>
              <button type="button" className="ap-input ap-input-btn" onClick={() => setCityOpen(true)}>
                <LocateFixed size={18} /> {form.location || 'Unesi grad'}
              </button>
            </>
          )}
        </section>
      )}

      {/* ---------- 4. describe ---------- */}
      {key === 'describe' && (
        <section className="ap-body" key="describe">
          <h1 className="ap-title">Opiši posao</h1>
          <p className="ap-sub">Sažmi ključne detalje</p>
          <textarea className="ap-input ap-textarea" autoFocus value={form.description} maxLength={2000} rows={5} placeholder="Napiši šta tačno treba uraditi, koliko je posao velik, treba li alat…" onChange={(event) => update({ description: event.target.value })} />
          <span className="ap-hint">Najviše 2000 znakova · bez brojeva telefona i emaila (Pravilo #1)</span>
          <span className="ap-label">Obavezni uslovi</span>
          <RequirementsEditor value={form.requirements || []} onChange={(requirements) => update({ requirements })} />
        </section>
      )}

      {/* ---------- 5. photos ---------- */}
      {key === 'photos' && (
        <section className="ap-body" key="photos">
          <h1 className="ap-title">Dodaj sliku</h1>
          <p className="ap-sub">Pomozi izvođačima da razumiju šta treba. Do 10 slika.</p>
          <div className="ap-photos">
            <button type="button" className="ap-photo-add" onClick={() => fileRef.current?.click()} aria-label="Dodaj sliku"><Plus size={26} /></button>
            {existingImages.filter((image) => !removed.includes(image.id)).map((image) => (
              <div key={image.id} className="ap-photo"><img src={image.url} alt="" /><button type="button" onClick={() => setRemoved((r) => [...r, image.id])} aria-label="Ukloni"><X size={14} /></button></div>
            ))}
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="ap-photo">{previews[index] && <img src={previews[index]} alt="" decoding="async" />}<button type="button" onClick={() => setFiles((f) => f.filter((_, i) => i !== index))} aria-label="Ukloni"><X size={14} /></button></div>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
          <button type="button" className="ap-photo-camera" onClick={() => fileRef.current?.click()}><Camera size={16} /> Slikaj ili odaberi iz galerije</button>
        </section>
      )}

      {/* ---------- 6. budget ---------- */}
      {key === 'budget' && (
        <section className="ap-body ap-body-budget" key="budget">
          <h1 className="ap-title">Unesi budžet</h1>
          <p className="ap-sub">Ne brini — konačnu cijenu uvijek možeš dogovoriti kasnije.</p>
          <div className="ap-amount"><span>{form.price ? Number(form.price).toLocaleString('bs-BA') : '0'}</span> KM</div>
          {priceStats
            ? <p className="ap-price-hint">Slični poslovi: obično <strong>{priceStats.median.toLocaleString('bs-BA')} KM</strong> ({priceStats.min}–{priceStats.max} KM)</p>
            : <p className="ap-price-hint">Bez iznosa objavljuješ „Po dogovoru“ — izvođači predlažu cijenu.</p>}
          {form.mode !== 'remote' && (
            <>
              <ReachHint price={form.price} travel={form.travel} />
              <TravelPicker value={form.travel} onChange={(travel) => { update({ travel }); haptic('light') }} />
            </>
          )}
          <div className="ap-keypad" role="group" aria-label="Iznos">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => (
              k === '' ? <span key={`sp-${i}`} />
                : k === 'del'
                  ? <button key="del" type="button" aria-label="Obriši" onClick={() => { setForm((c) => ({ ...c, price: String(c.price).slice(0, -1) })); haptic('light') }}><Delete size={22} /></button>
                  : <button key={k} type="button" onClick={() => { setForm((c) => { const next = `${c.price}${k}`.replace(/^0+/, ''); return next.length <= 6 ? { ...c, price: next } : c }); haptic('light') }}>{k}</button>
            ))}
          </div>
        </section>
      )}

      {/* ---------- 7. review ---------- */}
      {key === 'review' && (
        <section className="ap-body" key="review">
          <h1 className="ap-title">Spreman/na za ponude?</h1>
          <p className="ap-sub">Provjeri i objavi kad si spreman/na.</p>
          <div className="ap-review">
            <button type="button" onClick={() => setStep(0)}><span>Naslov</span><strong>{form.title}</strong><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setStep(1)}><span>Kada</span><strong>{formScheduleLabel(form)}</strong><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setStep(2)}><span>Gdje</span><strong>{form.mode === 'remote' ? 'Online' : form.location}</strong><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setCatOpen(true)} className={form.category ? '' : 'is-missing'}><span>Kategorija</span><strong>{form.category || 'Odaberi'}</strong><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setStep(3)}><span>Opis</span><strong className="ap-clamp">{form.description}</strong><ChevronRight size={18} /></button>
            {form.requirements?.length > 0 && <button type="button" onClick={() => setStep(3)}><span>Uslovi</span><strong className="ap-clamp">{form.requirements.join(' · ')}</strong><ChevronRight size={18} /></button>}
            <button type="button" onClick={() => setStep(4)}><span>Slike</span><strong>{files.length + existingImages.length - removed.length || 'Bez slika'}</strong><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setStep(5)}><span>Budžet</span><strong>{form.price ? `${Number(form.price).toLocaleString('bs-BA')} KM` : 'Po dogovoru'}</strong><ChevronRight size={18} /></button>
            {form.mode !== 'remote' && <button type="button" onClick={() => setStep(5)}><span>Put</span><strong>{Number(form.travel) > 0 ? `Plaćam do ${form.travel} KM` : 'Ne plaćam put'}</strong><ChevronRight size={18} /></button>}
          </div>
          {error && <div className="form-error">{error}</div>}
        </section>
      )}

      <div className="ap-foot" ref={footRef}>
        {key === 'photos' && files.length === 0 && existingImages.length === 0 ? (
          <button type="button" className="ap-btn ap-btn-light" onClick={goNext}>Preskoči za sad</button>
        ) : key === 'review' ? (
          <button type="button" className="ap-btn ap-btn-primary" disabled={!valid || saving} onClick={submit}>{saving ? 'Objavljujem…' : user ? (editId ? 'Sačuvaj izmjene' : 'Objavi posao') : 'Prijavi se i objavi'}</button>
        ) : (
          <button type="button" className="ap-btn ap-btn-primary" disabled={!valid} onClick={goNext}>Nastavi</button>
        )}
      </div>

      {cityOpen && <CitySheet value={form.location} onPick={(city) => { update({ location: city }); setCityOpen(false) }} onClose={() => setCityOpen(false)} />}
      {catSheet.mounted && (
        <div className={`ap-sheet-backdrop ${catSheet.closing ? 'is-closing' : ''}`} inert={catSheet.closing || undefined} onClick={() => setCatOpen(false)}>
          <div className="ap-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="ap-sheet-handle" />
            <h2>Kategorija</h2>
            <div className="ap-sheet-list">
              {serviceCategories.map(({ id, name, icon: Icon }) => (
                <button key={id} type="button" className={form.category === name ? 'active' : ''} onClick={() => { update({ category: name }); setCatOpen(false); haptic('light') }}><Icon size={18} /> {name}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Full-screen city search (like a postcode picker): type, or tap a popular city. */
function CitySheet({ value, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const needle = fold(query.trim())
    if (!needle) return POPULAR_CITIES
    return ALL_CITIES.filter((city) => fold(city).includes(needle)).slice(0, 30)
  }, [query])

  return (
    <div className="ap ap-screen ap-city">
      <header className="ap-city-top">
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Unesi grad" className="ap-input" enterKeyHint="search" />
        <button type="button" className="ap-cancel" onClick={onClose}>Odustani</button>
      </header>
      <div className="ap-city-list">
        {!query && <span className="ap-label">Popularni gradovi</span>}
        {matches.map((city) => (
          <button key={city} type="button" className={city === value ? 'active' : ''} onClick={() => onPick(city)}>{city}</button>
        ))}
        {query && matches.length === 0 && <button type="button" onClick={() => onPick(query.trim())}>Koristi „{query.trim()}“</button>}
      </div>
    </div>
  )
}

export default PostFlow
