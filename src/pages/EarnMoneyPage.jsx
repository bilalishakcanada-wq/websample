import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Banknote, ChevronDown, MessageCircle, ShieldCheck, Star, Wallet } from 'lucide-react'
import { contactService } from '../services/contactService'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'
import EarnArt from '../components/EarnArt'

const formatKM = (value) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

const FAQS = [
  { q: 'Koje vrste poslova mogu raditi?', a: 'Sve — kućni poslovi, IT, dizajn, selidbe, čišćenje, časovi i još mnogo toga. Ako imaš vještinu, neko na Poso.ba je traži.' },
  { q: 'Kako se naplaćujem?', a: 'Dogovaraš cijenu direktno sa klijentom kroz ponudu (bid). Naplata unutar platforme dolazi uskoro — trenutno se plaćanje dogovara sa klijentom.' },
  { q: 'Da li moram platiti da se pridružim?', a: 'Ne. Registracija i pregledanje poslova su potpuno besplatni. Plan pretplate je opcionalan za dodatnu vidljivost.' },
  { q: 'Kako dobijam obavještenja o novim poslovima?', a: 'Aplikaciju možeš instalirati na telefon (Poso.ba radi kao PWA) i dobijati obavještenja čim se objavi posao u tvojoj kategoriji.' },
  { q: 'Kako izgraditi povjerenje kod klijenata?', a: 'Dodaj portfolio sa slikama prošlih radova, zatraži verifikaciju, i sakupljaj recenzije nakon svakog posla — sve se prikazuje na tvom javnom profilu.' },
]

function EarnMoneyPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)
  const [stats, setStats] = useState([])
  const [calcCategory, setCalcCategory] = useState('')
  const [jobsPerWeek, setJobsPerWeek] = useState(4)

  useEffect(() => {
    let active = true
    contactService.categoryPriceStats().then((rows) => {
      if (!active) return
      const priced = rows.filter((row) => Number(row.priced_count) > 0).sort((a, b) => Number(b.listing_count) - Number(a.listing_count))
      setStats(priced)
      setCalcCategory((current) => current || priced[0]?.category || '')
    })
    return () => { active = false }
  }, [])

  // platform-wide average job price, weighted by how many priced listings each category has
  const avgPrice = useMemo(() => {
    const totals = stats.reduce((acc, row) => ({ sum: acc.sum + Number(row.avg_price) * Number(row.priced_count), n: acc.n + Number(row.priced_count) }), { sum: 0, n: 0 })
    return totals.n ? Math.round(totals.sum / totals.n) : 0
  }, [stats])
  const monthlyPotential = avgPrice ? Math.round((avgPrice * 20) / 100) * 100 : 0
  const selectedAvg = Math.round(Number(stats.find((row) => row.category === calcCategory)?.avg_price || 0))

  useRevealOnScroll()

  return (
    <div className="app-shell page-with-mobile-nav">
      <section className="earn-stage">
        <div className="earn-stage-copy">
          <h1>Budi svoj šef</h1>
          <p className="earn-stage-sub">
            {monthlyPotential ? <>Zaradi do <strong>{formatKM(monthlyPotential)} KM</strong> mjesečno na Poso.ba*</> : <>Ti biraš poslove, termine i cijenu.</>}
          </p>
          <button type="button" className="earn-stage-cta" onClick={() => navigate('/register')}>
            Pridruži se Poso.ba <ArrowRight size={18} />
          </button>
          <small>
            {monthlyPotential
              ? `*Primjer: 20 poslova mjesečno po prosječnoj cijeni oglasa na platformi (${avgPrice} KM). Zarada zavisi od tebe.`
              : 'Besplatna registracija, bez provizije na dogovorenu cijenu.'}
          </small>
        </div>
        <div className="earn-stage-photo earn-stage-art">
          <EarnArt />
          <div className="earn-stage-pill"><Wallet size={15} /> Isplata primljena · Krečenje stana · 220 KM</div>
        </div>
      </section>

      <main className="content-container">
        <section className="earn-example reveal">
          <div className="earn-example-copy">
            <span className="eyebrow small-eyebrow">Primjer iz prakse</span>
            <h2>Koliko možeš zaraditi?</h2>
            <p className="muted-text">Izaberi struku i koliko poslova sedmično želiš. Cijene su prosjeci stvarnih oglasa na Poso.ba — ne izmišljene brojke.</p>
            <ul className="check-list">
              <li>Ti šalješ ponudu sa svojom cijenom — klijent bira.</li>
              <li>Nema provizije na dogovorenu cijenu.</li>
              <li>Kontakt i dogovor idu kroz poruke tek kad klijent prihvati ponudu.</li>
            </ul>
          </div>
          <div className="earn-calc">
            <label>
              Struka
              <select value={calcCategory} onChange={(event) => setCalcCategory(event.target.value)}>
                {stats.map((row) => <option key={row.category} value={row.category}>{row.category} — ~{Math.round(Number(row.avg_price))} KM po poslu</option>)}
              </select>
            </label>
            <label>
              Poslova sedmično: <strong>{jobsPerWeek}</strong>
              <input type="range" min="1" max="10" value={jobsPerWeek} onChange={(event) => setJobsPerWeek(Number(event.target.value))} />
            </label>
            <div className="earn-calc-result">
              <span>Procjena mjesečno</span>
              <strong>{selectedAvg ? formatKM(Math.round(selectedAvg * jobsPerWeek * 4.3 / 10) * 10) : '—'} KM</strong>
              <small>{selectedAvg ? `${jobsPerWeek} × ~${selectedAvg} KM × 4,3 sedmice` : 'Još nema oglasa u ovoj kategoriji'}</small>
            </div>
          </div>
        </section>

        <section className="earn-benefits reveal">
          <div className="earn-benefit-card">
            <Banknote size={22} />
            <h3>Besplatno počni</h3>
            <p>Pridruži se besplatno i odmah počni pregledavati poslove u svojoj kategoriji i gradu.</p>
          </div>
          <div className="earn-benefit-card">
            <ShieldCheck size={22} />
            <h3>Ti određuješ cijenu</h3>
            <p>Pošalji ponudu sa svojom cijenom i obrazloženjem. Klijent bira, ti pregovaraš koliko želiš.</p>
          </div>
          <div className="earn-benefit-card">
            <Star size={22} />
            <h3>Pokaži svoje umijeće</h3>
            <p>Dodaj portfolio, sakupljaj recenzije i osvoji značke koje te izdvajaju od konkurencije.</p>
          </div>
        </section>

        <section className="how-it-works reveal">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow small-eyebrow">Kako početi</span>
              <h2>Od registracije do prve zarade u 3 koraka</h2>
            </div>
          </div>
          <div className="steps-grid reveal-stagger reveal">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Napravi profil</h3>
              <p>Registracija traje manje od minute. Dodaj sliku, bio i portfolio da izgradiš povjerenje.</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Pošalji ponudu</h3>
              <p>Pronađi posao koji ti odgovara, postavi svoju cijenu i objasni zašto si pravi izbor.</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Završi i naplati</h3>
              <p>Kad klijent prihvati ponudu, dogovorite detalje kroz poruke i završite posao.</p>
            </div>
          </div>
        </section>

        <section className="earn-trust reveal" id="principi">
          <div className="section-heading centered">
            <div>
              <span className="eyebrow small-eyebrow">Sigurnost i podrška</span>
              <h2>Pokrivamo te sa obje strane</h2>
            </div>
          </div>
          <div className="earn-trust-grid">
            <div className="earn-trust-item">
              <ShieldCheck size={20} />
              <div>
                <strong>Moderacija sadržaja</strong>
                <p>Svaki oglas se automatski provjerava, a zajednica može prijaviti sumnjivo ponašanje.</p>
              </div>
            </div>
            <div className="earn-trust-item">
              <Star size={20} />
              <div>
                <strong>Ocjene i recenzije</strong>
                <p>Transparentan sistem ocjenjivanja pomaže klijentima da biraju provjerene izvođače.</p>
              </div>
            </div>
            <div className="earn-trust-item">
              <MessageCircle size={20} />
              <div>
                <strong>Zaštićena komunikacija</strong>
                <p>Kontakt podaci ostaju zaštićeni dok se ponuda zvanično ne prihvati.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="earn-faq reveal">
          <div className="section-heading">
            <div>
              <span className="eyebrow small-eyebrow">Pitanja</span>
              <h2>Često postavljena pitanja</h2>
            </div>
          </div>
          <div className="faq-list">
            {FAQS.map((item, index) => (
              <div key={item.q} className={`faq-item ${openFaq === index ? 'open' : ''}`}>
                <button type="button" className="faq-question" onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                  {item.q}
                  <ChevronDown size={18} className="faq-chevron" />
                </button>
                {openFaq === index && <p className="faq-answer">{item.a}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="cta-strip reveal">
          <div>
            <span className="eyebrow small-eyebrow">Počni odmah</span>
            <h2>Napravi profil i pošalji svoju prvu ponudu danas.</h2>
          </div>
          <button type="button" className="primary-button" onClick={() => navigate('/register')}>
            Pridruži se besplatno
          </button>
        </section>
      </main>
    </div>
  )
}

export default EarnMoneyPage
