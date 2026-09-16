import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, LifeBuoy, Mail, MessageCircle, Search } from 'lucide-react'
import BackHome from '../components/BackHome'
import { useAuth } from '../context/AuthContext'
import { contactService } from '../services/contactService'

const FAQ = [
  { group: 'Za klijente', items: [
    { q: 'Koliko košta objava posla?', a: 'Ništa. Objava posla i primanje ponuda su potpuno besplatni. Plan pretplate je opcionalan i služi za dodatnu vidljivost.' },
    { q: 'Kako biram izvođača?', a: 'Svaka ponuda nosi cijenu i obrazloženje, a klikom na ime vidiš profil: nivo povjerenja, ocjene, značke, struke i portfolio. Prihvati onu koja ti odgovara.' },
    { q: 'Kad dobijam kontakt izvođača?', a: 'Tek nakon što prihvatiš ponudu. Do tada su brojevi i emailovi zaštićeni u obje smjera, pa nema neželjenih poziva.' },
    { q: 'Mogu li otkazati ili promijeniti oglas?', a: 'Da — na nadzornoj ploči možeš urediti, pauzirati ili obrisati svoj oglas u bilo kom trenutku.' },
  ] },
  { group: 'Za izvođače', items: [
    { q: 'Kako postajem verifikovan majstor?', a: 'U profilu, pod "Verifikacija", izaberi struku i pošalji diplomu, uvjerenje ili licencu. Nakon pregleda na profilu dobijaš oznaku "Verifikovan majstor — [struka]".' },
    { q: 'Šta znače nivoi povjerenja?', a: 'Novi korisnik → Nije verifikovan → Verifikovan majstor → Pouzdan majstor (3+ ocjene ≥ 4.5) → Top majstor (10+ ocjena ≥ 4.8). Dobre ocjene same ne dižu nivo iznad "Nije verifikovan" — verifikacija je uslov.' },
    { q: 'Kako se dodjeljuju značke?', a: 'Automatski, čim ispuniš uslov: "Talenat u usponu" (novi sa dobrim ocjenama), "Pouzdan" (80%+ prihvaćenih ponuda), "Brz odgovor" (odgovaraš u roku sat vremena), "Top ocjene" (4.8+ iz 10+ recenzija).' },
    { q: 'Zašto ne vidim neki posao u preporukama?', a: 'Preporuke uzimaju u obzir tvoj grad, kategorije u kojima si već slao ponude i koliko je oglas svjež. Podesi grad u profilu i preporuke postaju tačnije.' },
  ] },
  { group: 'Nalog i sigurnost', items: [
    { q: 'Mogu li se prijaviti preko Googlea?', a: 'Da. Nakon prve prijave zamolit ćemo te da dopuniš grad, telefon i, ako pružaš usluge, struke.' },
    { q: 'Kako prijavim sumnjiv oglas ili korisnika?', a: 'Na svakom oglasu postoji ikona zastavice. Prijava ide direktno našem timu, a oglasi se i automatski provjeravaju.' },
    { q: 'Kako brišem nalog?', a: 'Profil → Račun → "Obriši nalog". Brisanje je trajno i uklanja oglase, ponude i poruke.' },
  ] },
]

const TOPICS = [
  { value: 'account', label: 'Nalog i prijava' },
  { value: 'listing', label: 'Oglas ili ponuda' },
  { value: 'payment', label: 'Plaćanje i pretplata' },
  { value: 'report', label: 'Prijava zloupotrebe' },
  { value: 'business', label: 'Saradnja / firme' },
  { value: 'other', label: 'Nešto drugo' },
]

function HelpPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const initialTopic = TOPICS.some((topic) => topic.value === searchParams.get('tema')) ? searchParams.get('tema') : 'other'
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)
  const [form, setForm] = useState({ name: user?.user_metadata?.full_name || '', email: user?.email || '', topic: initialTopic, message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const needle = query.trim().toLowerCase()
  const groups = FAQ.map((group) => ({
    ...group,
    items: group.items.filter((item) => !needle || `${item.q} ${item.a}`.toLowerCase().includes(needle)),
  })).filter((group) => group.items.length > 0)

  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      await contactService.send({ userId: user?.id || null, ...form })
      setSent(true)
      setForm((current) => ({ ...current, message: '' }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="app-shell page-with-mobile-nav info-page">
      <header className="app-page-header"><div><BackHome /><span className="eyebrow small-eyebrow">Centar za pomoć</span><h1>Kako ti možemo pomoći?</h1></div></header>
      <main className="content-container">
        <label className="help-search">
          <Search size={18} />
          <input placeholder="Pretraži pitanja: verifikacija, kontakt, brisanje naloga..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>

        <div className="help-quick">
          <button type="button" className="help-quick-card" onClick={() => window.dispatchEvent(new CustomEvent('poso:open-support'))}>
            <MessageCircle size={22} /><strong>Live chat</strong><span>Odgovor odmah, radnim danima 9–17h</span>
          </button>
          <a className="help-quick-card" href="#kontakt"><Mail size={22} /><strong>Pošalji poruku</strong><span>Odgovaramo u roku 24h</span></a>
          <Link className="help-quick-card" to="/kako-radi"><LifeBuoy size={22} /><strong>Kako radi</strong><span>Vodič kroz cijeli proces</span></Link>
        </div>

        {groups.length === 0 && <p className="muted-text">Nema pitanja za "{query}". Piši nam ispod.</p>}
        {groups.map((group) => (
          <section className="faq-group" key={group.group}>
            <h2>{group.group}</h2>
            <div className="faq-list">
              {group.items.map((item) => {
                const key = `${group.group}:${item.q}`
                return (
                  <div key={key} className={`faq-item ${open === key ? 'open' : ''}`}>
                    <button type="button" className="faq-question" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
                      {item.q}<ChevronDown size={18} className="faq-chevron" />
                    </button>
                    {open === key && <p className="faq-answer">{item.a}</p>}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        <section className="contact-card" id="kontakt">
          <div>
            <h2>Piši nam</h2>
            <p className="muted-text">Nisi našao odgovor? Opiši problem i javit ćemo se na email.</p>
          </div>
          {sent ? (
            <div className="form-success">Hvala! Poruka je primljena — javljamo se u roku 24 sata.</div>
          ) : (
            <form onSubmit={submit} className="auth-form contact-form">
              <div className="field-row">
                <div className="field"><input id="c-name" placeholder=" " value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><label htmlFor="c-name">Ime</label></div>
                <div className="field"><input id="c-email" type="email" placeholder=" " value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /><label htmlFor="c-email">Email</label></div>
              </div>
              <label className="verify-trade-select">
                Tema
                <select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })}>
                  {TOPICS.map((topic) => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
                </select>
              </label>
              <div className="field field-textarea">
                <textarea id="c-msg" placeholder=" " rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required />
                <label htmlFor="c-msg">Poruka</label>
              </div>
              {error && <div className="form-error">{error}</div>}
              <button type="submit" className="primary-button" disabled={sending}>{sending ? 'Šaljem...' : 'Pošalji poruku'}</button>
            </form>
          )}
        </section>
      </main>
    </div>
  )
}

export default HelpPage
