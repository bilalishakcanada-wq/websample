import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, LifeBuoy, Mail, MessageCircle, Search } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import ContactForm from '../components/ContactForm'

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

function HelpPage() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)

  const needle = query.trim().toLowerCase()
  const groups = FAQ.map((group) => ({
    ...group,
    items: group.items.filter((item) => !needle || `${item.q} ${item.a}`.toLowerCase().includes(needle)),
  })).filter((group) => group.items.length > 0)

  return (
    <InfoLayout
      eyebrow="Centar za pomoć"
      title="Kako ti možemo pomoći?"
      lead="Pretraži odgovore, otvori live chat ili nam pošalji poruku — birat ćeš ono što ti je najbrže."
    >
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
          <ContactForm initialTopic={searchParams.get('tema') || 'other'} />
        </section>
    </InfoLayout>
  )
}

export default HelpPage
