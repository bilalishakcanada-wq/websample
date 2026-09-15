import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, Bell, ChevronDown, MessageCircle, ShieldCheck, Sparkles, Star, TrendingUp, Wallet } from 'lucide-react'
import BackHome from '../components/BackHome'
import MobileNav from '../components/MobileNav'
import { useRevealOnScroll } from '../hooks/useRevealOnScroll'

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

  useRevealOnScroll()

  return (
    <div className="app-shell page-with-mobile-nav">
      <section className="hero-band earn-hero">
        <div className="hero-section earn-hero-section">
          <div className="hero-copy">
            <BackHome label="Nazad" />
            <div className="eyebrow">
              <Sparkles size={14} />
              Postani izvođač
            </div>
            <h1 className="hero-headline">
              Budi svoj<br />
              <span className="hero-headline-accent">šef.</span>
            </h1>
            <p>
              Pronađi poslove koji odgovaraju tvojim vještinama i rasporedu. Besplatna registracija,
              bez pretplate za osnovno korištenje — samo ti i klijenti koji te trebaju.
            </p>
            <div className="earn-hero-actions">
              <button type="button" className="primary-button large-button" onClick={() => navigate('/register')}>
                Pridruži se besplatno
              </button>
              <button type="button" className="ghost-button large-button" onClick={() => navigate('/search')}>
                Pregledaj poslove
              </button>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-image-wrap earn-hero-image">
              <img src="/images/categories/home.jpg" alt="Izvođač na poslu" loading="eager" />
            </div>
            <div className="float-card float-card-payment">
              <Wallet size={16} />
              <div>
                <strong>Isplata primljena!</strong>
                <span>Krečenje stana · 220 KM</span>
              </div>
            </div>
            <div className="float-card float-card-earnings">
              <div className="float-card-earnings-top">
                <span>Ukupna zarada</span>
                <span className="float-card-trend"><TrendingUp size={12} /> 20%</span>
              </div>
              <strong>3.140 KM</strong>
              <svg viewBox="0 0 100 28" className="float-card-sparkline" preserveAspectRatio="none">
                <polyline points="0,22 15,18 30,20 45,10 60,14 75,4 90,8 100,2" />
              </svg>
            </div>
            <div className="float-pill float-pill-alert">
              <Bell size={13} /> Novi posao!
            </div>
          </div>
        </div>
      </section>

      <main className="content-container">
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

        <section className="earn-trust reveal">
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
      <MobileNav />
    </div>
  )
}

export default EarnMoneyPage
