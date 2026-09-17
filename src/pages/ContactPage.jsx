import { useNavigate, useSearchParams } from 'react-router-dom'
import { Clock, Mail, MessageCircle, ShieldAlert } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import ContactForm from '../components/ContactForm'

function ContactPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  return (
    <InfoLayout
      eyebrow="Kontakt"
      title="Tu smo kad zatreba"
      lead="Pitanje o nalogu, problem s oglasom, prijava zloupotrebe ili ideja za saradnju — piši nam i javljamo se u roku 24 sata."
      cta={{ eyebrow: 'Brži odgovor?', text: 'Većina pitanja je već odgovorena u centru za pomoć.', to: '/pomoc', label: 'Centar za pomoć' }}
    >
      <div className="contact-layout">
        <section className="contact-card">
          <div><h2>Pošalji poruku</h2><p className="muted-text">Odgovor stiže na email koji upišeš.</p></div>
          <ContactForm initialTopic={searchParams.get('tema') || 'other'} />
        </section>

        <aside className="contact-side">
          <div className="info-card">
            <Mail size={20} /><strong>Email</strong>
            <p><a href="mailto:podrska@poso.ba">podrska@poso.ba</a></p>
          </div>
          <button type="button" className="info-card info-card-button" onClick={() => navigate('/pomoc?chat=1')}>
            <MessageCircle size={20} /><strong>Live chat</strong>
            <p>Klikni i otvori razgovor s podrškom u dnu ekrana.</p>
          </button>
          <div className="info-card">
            <Clock size={20} /><strong>Radno vrijeme</strong>
            <p>Radnim danima 9–17h. Poruke van radnog vremena odgovaramo sljedeći radni dan.</p>
          </div>
          <div className="info-card">
            <ShieldAlert size={20} /><strong>Hitna prijava</strong>
            <p>Prevara, uznemiravanje ili opasan sadržaj — izaberi temu "Prijava zloupotrebe" i takve poruke gledamo prve.</p>
          </div>
        </aside>
      </div>
    </InfoLayout>
  )
}

export default ContactPage
