import { Download, Fingerprint, MapPin, RefreshCw, Share, ShieldCheck, Smartphone, SquarePlus } from 'lucide-react'
import InfoLayout from '../components/InfoLayout'
import { isNativeApp } from '../utils/native'

// the android-beta release always holds the newest build (.github/workflows/android.yml)
const APK_URL = 'https://github.com/bilalishakcanada-wq/websample/releases/download/android-beta/zadatak-beta.apk'

const ANDROID_STEPS = [
  { icon: Download, title: 'Preuzmi aplikaciju', text: 'Klikni dugme ispod. Telefon preuzme fajl zadatak-beta.apk (oko 9 MB).' },
  { icon: ShieldCheck, title: 'Dozvoli instalaciju', text: 'Otvori preuzeti fajl. Telefon prvi put pita da dozvoliš instalaciju iz preglednika ili aplikacije Fajlovi: izaberi „Dozvoli“. Ako Play Protect upozori da aplikacija nije s Google Playa, potvrdi instalaciju.' },
  { icon: Smartphone, title: 'Instaliraj i prijavi se', text: 'Klikni „Instaliraj“, otvori Zadatak i prijavi se istim nalogom kao na sajtu.' },
]

const IPHONE_STEPS = [
  { icon: Share, title: 'Otvori Zadatak u Safariju', text: 'Na iPhoneu otvori ovaj sajt u Safariju i klikni dugme Podijeli (kvadrat sa strelicom).' },
  { icon: SquarePlus, title: 'Dodaj na početni ekran', text: 'Izaberi „Dodaj na početni ekran“ pa „Dodaj“. Zadatak dobija svoju ikonu i otvara se preko cijelog ekrana, sa obavijestima.' },
]

const Steps = ({ steps }) => (
  <ol className="steps-timeline">
    {steps.map(({ icon: Icon, title, text }, index) => (
      <li key={title}><span className="step-index">{index + 1}</span><div><Icon size={20} /><strong>{title}</strong><p>{text}</p></div></li>
    ))}
  </ol>
)

function AppDownloadPage() {
  const isIphone = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  const android = (
    <section className="info-section reveal" key="android">
      <h2>Android</h2>
      <Steps steps={ANDROID_STEPS} />
      <a href={APK_URL} className="primary-button" download><Download size={16} /> Preuzmi za Android</a>
    </section>
  )

  const iphone = (
    <section className="info-section reveal" key="iphone">
      <h2>iPhone</h2>
      <p>Aplikacija za iPhone stiže u App Store. Do tada Zadatak na iPhoneu dodaješ na početni ekran u dva koraka:</p>
      <Steps steps={IPHONE_STEPS} />
    </section>
  )

  return (
    <InfoLayout
      eyebrow="Aplikacija"
      title="Zadatak na telefonu"
      lead="Isti nalog, isti poslovi i poruke kao na sajtu, uz obavijesti, kameru za dokaz rada i potvrdu isplate otiskom prsta."
    >
      {isNativeApp() && (
        <section className="info-section reveal">
          <p><strong>Već koristiš aplikaciju.</strong> Ona se ažurira sama: uvijek prikazuje najnoviju verziju Zadatka.</p>
        </section>
      )}

      {/* the phone in hand comes first */}
      {isIphone ? [iphone, android] : [android, iphone]}

      <section className="info-grid reveal-stagger reveal">
        <div className="info-card"><RefreshCw size={20} /><strong>Uvijek najnovija</strong><p>Aplikacija prikazuje živi sajt, pa nove mogućnosti stižu bez ponovnog preuzimanja.</p></div>
        <div className="info-card"><Fingerprint size={20} /><strong>Sigurna isplata</strong><p>Prije nego novac ode, telefon traži otisak prsta ili lice.</p></div>
        <div className="info-card"><MapPin size={20} /><strong>Izvođač na putu</strong><p>Kad izvođač krene, klijent ga vidi na mapi dok ne stigne. Lokacija se ne prati u pozadini.</p></div>
      </section>
    </InfoLayout>
  )
}

export default AppDownloadPage
