import { Suspense, lazy, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import './App.css'
import './app/app.css'
import './styles/mobile.css'
import './styles/finish.css'
import './styles/redesign.css'
import './styles/flow.css'
import './styles/craft.css'
// Every other page loads on demand — the phone downloads only what it opens.
const DashboardPage = lazy(lazyImport(() => import('./pages/DashboardPage')))
// sign-in screens pull the illustrations (Mascots) with them; signed-in people never need them in the entry
const LoginPage = lazy(lazyImport(() => import('./pages/LoginPage')))
const RegisterPage = lazy(lazyImport(() => import('./pages/RegisterPage')))
const AdminPage = lazy(lazyImport(() => import('./pages/AdminPage')))
const ForgotPasswordPage = lazy(lazyImport(() => import('./pages/ForgotPasswordPage')))
const ResetPasswordPage = lazy(lazyImport(() => import('./pages/ResetPasswordPage')))
const SearchPage = lazy(lazyImport(() => import('./pages/SearchPage')))
const ListingDetailPage = lazy(lazyImport(() => import('./pages/ListingDetailPage')))
const MessagesPage = lazy(lazyImport(() => import('./pages/MessagesPage')))
const RulesPage = lazy(lazyImport(() => import('./pages/RulesPage')))
const PublicProfilePage = lazy(lazyImport(() => import('./pages/PublicProfilePage')))
const AboutPage = lazy(lazyImport(() => import('./pages/AboutPage')))
const PrivacyPage = lazy(lazyImport(() => import('./pages/PrivacyPage')))
const CookiePolicyPage = lazy(lazyImport(() => import('./pages/CookiePolicyPage')))
const PostTaskPage = lazy(lazyImport(() => import('./pages/PostTaskPage')))
const EarnMoneyPage = lazy(lazyImport(() => import('./pages/EarnMoneyPage')))
const HowItWorksPage = lazy(lazyImport(() => import('./pages/HowItWorksPage')))
const HelpPage = lazy(lazyImport(() => import('./pages/HelpPage')))
const GuidesPage = lazy(lazyImport(() => import('./pages/GuidesPage')))
const BusinessPage = lazy(lazyImport(() => import('./pages/BusinessPage')))
const ContactPage = lazy(lazyImport(() => import('./pages/ContactPage')))
const AppDownloadPage = lazy(lazyImport(() => import('./pages/AppDownloadPage')))
const PricingPage = lazy(lazyImport(() => import('./pages/PricingPage')))
const CommunityGuidelinesPage = lazy(lazyImport(() => import('./pages/CommunityGuidelinesPage')))
const ProviderPrinciplesPage = lazy(lazyImport(() => import('./pages/ProviderPrinciplesPage')))
const TiersInfoPage = lazy(lazyImport(() => import('./pages/TiersInfoPage')))
const AccountLayout = lazy(lazyImport(() => import('./pages/account/AccountLayout')))
const ProfileSettingsPage = lazy(lazyImport(() => import('./pages/account/ProfileSettingsPage')))
const SkillsPage = lazy(lazyImport(() => import('./pages/account/SkillsPage')))
const BadgesPage = lazy(lazyImport(() => import('./pages/account/BadgesPage')))
const PortfolioPage = lazy(lazyImport(() => import('./pages/account/PortfolioPage')))
const TierDashboardPage = lazy(lazyImport(() => import('./pages/account/TierDashboardPage')))
const TaskAlertsPage = lazy(lazyImport(() => import('./pages/account/TaskAlertsPage')))
const PaymentHistoryPage = lazy(lazyImport(() => import('./pages/account/PaymentHistoryPage')))
const PaymentMethodsPage = lazy(lazyImport(() => import('./pages/account/PaymentMethodsPage')))
const WalletPage = lazy(lazyImport(() => import('./pages/account/WalletPage')))
const NotificationsPage = lazy(lazyImport(() => import('./pages/account/NotificationsPage')))
const VerificationPage = lazy(lazyImport(() => import('./pages/account/VerificationPage')))
const SettingsPage = lazy(lazyImport(() => import('./pages/account/SettingsPage')))
const SimpleModePage = lazy(lazyImport(() => import('./pages/account/SimpleModePage')))
const NotificationPrefsPage = lazy(lazyImport(() => import('./pages/account/NotificationPrefsPage')))

import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import ForbiddenPage from './pages/ForbiddenPage'

/** A redirect that keeps the page's space while the next page loads, so the footer doesn't flash up and jump down. */
function Redirect({ to }) {
  return <><RouteFallback /><Navigate to={to} replace /></>
}

// Old links keep working: /profile?tab=... -> the matching account section.
function LegacyProfileRedirect() {
  const [params] = useSearchParams()
  const tab = params.get('tab')
  const target = { usluge: '/account/vjestine', iskustvo: '/account/vjestine', portfolio: '/account/portfolio', verifikacija: '/account/znacke', racun: '/account/postavke' }[tab] || '/account/profil'
  return <Redirect to={params.get('setup') === '1' ? `${target}?setup=1` : target} />
}
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import CookieConsent from './components/CookieConsent'
import InstallPrompt from './components/InstallPrompt'
import ScrollToTop from './components/ScrollToTop'
import SmoothScroll from './components/SmoothScroll'
import NavigationBar from './components/NavigationBar'
import Toaster from './components/Toaster'
import { lazyImport } from './utils/appUpdates'
import SwBridge from './components/SwBridge'
import LiveReachSync from './components/LiveReachSync'
import AuthReturn from './components/AuthReturn'
import { RouteFallback, RouteGuard } from './components/RouteBoundary'
import { useMediaQuery } from './hooks/useMediaQuery'
import DialogHost from './components/DialogHost'
import ViewTransitions from './components/ViewTransitions'
import NativeBack from './components/NativeBack'
import { RealtimeSync } from './hooks/useRealtimeSync'
import { useSwitch } from './hooks/useSwitches'
import UpdateGate from './components/UpdateGate'

// the support chat lives only on the help pages, so its code (and the help articles) load only there
const SupportChat = lazy(lazyImport(() => import('./components/SupportChat')))
function SupportChatSlot() {
  const { pathname } = useLocation()
  const onHelpPage = pathname.startsWith('/pomoc')
  // a tap on "open chat" that lands before the chat's code has arrived still opens it
  const [asked, setAsked] = useState(false)
  useEffect(() => {
    const ask = () => setAsked(true)
    window.addEventListener('zadatak:open-support', ask)
    return () => window.removeEventListener('zadatak:open-support', ask)
  }, [])
  const [wasOnHelpPage, setWasOnHelpPage] = useState(onHelpPage)
  if (wasOnHelpPage !== onHelpPage) { setWasOnHelpPage(onHelpPage); setAsked(false) }
  return onHelpPage ? <Suspense fallback={null}><SupportChat openRequested={asked} /></Suspense> : null
}

// phone app screens (welcome, goal, intro, post flow, my tasks); desktop keeps its pages
const StartGoal = lazy(lazyImport(() => import('./app/StartGoal')))
const Intro = lazy(lazyImport(() => import('./app/Intro')))
const PostFlow = lazy(lazyImport(() => import('./app/PostFlow')))
const MyTasks = lazy(lazyImport(() => import('./app/MyTasks')))
// dev-only gallery of every illustration (never bundled in production)
const MascotGallery = import.meta.env.DEV ? lazy(() => import('./app/MascotGallery')) : null

/** Phones get the one-question-per-screen flow; wider screens keep the wizard. */
function PostRoute() {
  const isPhone = useMediaQuery('(max-width: 768px)')
  const [params] = useSearchParams()
  // anyone can write a new job and sign up at the end; changing or copying an existing one needs the account
  const needsAccount = params.has('edit') || params.has('copy')
  const postSwitch = useSwitch('post_job')
  // an admin paused new jobs (Prekidači): editing an existing one still works
  if (!postSwitch.on && !params.has('edit')) return <main className="page-state"><h1>Objava je pauzirana</h1><p>{postSwitch.message || 'Objava poslova je privremeno pauzirana. Pokušaj za nekoliko minuta.'}</p></main>
  return isPhone ? <PostFlow /> : needsAccount ? <ProtectedRoute><PostTaskPage /></ProtectedRoute> : <PostTaskPage />
}

const ConfirmEmailPage = lazy(lazyImport(() => import('./pages/ConfirmEmailPage')))
const ConfirmEmailScreen = lazy(() => import('./pages/ConfirmEmailPage').then((module) => ({ default: module.ConfirmEmailScreen })))
// pages a Google sign-up can still open before clicking the confirmation link
const OPEN_WHILE_UNCONFIRMED = ['/potvrdi-email', '/pravila', '/privatnost', '/kontakt', '/pomoc']

/** A new Google account sees "confirm your email" everywhere until it clicks our link. */
function EmailConfirmGate({ children }) {
  const { user, emailCheck } = useAuth()
  const { pathname } = useLocation()
  if (!user || !emailCheck.pending || OPEN_WHILE_UNCONFIRMED.some((path) => pathname.startsWith(path))) return children
  return <Suspense fallback={<RouteFallback />}><ConfirmEmailScreen /></Suspense>
}

const SuspendedScreen = lazy(lazyImport(() => import('./components/SuspendedScreen')))

/** A suspended account sees only the countdown: no header, pages, tabs or live updates until the ban ends. */
function SuspensionGate({ children }) {
  const { suspension } = useAuth()
  if (!suspension) return children
  return <Suspense fallback={<RouteFallback />}><SuspendedScreen /></Suspense>
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <UpdateGate>
      <SuspensionGate>
      <ScrollToTop />
      <SmoothScroll />
      <ViewTransitions />
      <NativeBack />
      <SwBridge />
      <LiveReachSync />
      <AuthReturn />
      <RealtimeSync />
      <SiteHeader />
      <SupportChatSlot />
      <InstallPrompt />
      <RouteGuard>
      <EmailConfirmGate>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/korisnik/:userId" element={<PublicProfilePage />} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/potvrdi-email" element={<ConfirmEmailPage />} />
        <Route path="/objavi" element={<PostRoute />} />
        <Route path="/start" element={<StartGoal />} />
        <Route path="/intro" element={<Intro />} />
        <Route path="/moji-poslovi" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
        {MascotGallery && <Route path="/dev/ilustracije" element={<MascotGallery />} />}
        <Route path="/dashboard" element={<Redirect to="/account" />} />
        <Route path="/profile" element={<LegacyProfileRedirect />} />
        <Route path="/nivoi" element={<TiersInfoPage />} />
        <Route path="/account" element={<ProtectedRoute><AccountLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="ploca" element={<TierDashboardPage />} />
          <Route path="placanja" element={<PaymentHistoryPage />} />
          <Route path="nacini-placanja" element={<PaymentMethodsPage />} />
          <Route path="novcanik" element={<WalletPage />} />
          <Route path="obavijesti" element={<NotificationsPage />} />
          <Route path="profil" element={<ProfileSettingsPage />} />
          <Route path="vjestine" element={<SkillsPage />} />
          <Route path="znacke" element={<BadgesPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="verifikacija" element={<VerificationPage />} />
          <Route path="postavke" element={<SettingsPage />} />
          <Route path="jednostavan-nacin" element={<SimpleModePage />} />
          <Route path="alarmi" element={<TaskAlertsPage />} />
          <Route path="informacije" element={<Navigate to="/account/postavke" replace />} />
          <Route path="placanje" element={<Navigate to="/account/novcanik" replace />} />
          <Route path="postavke-obavijesti" element={<NotificationPrefsPage />} />
        </Route>
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminPage mode="admin" /></ProtectedRoute>} />
        <Route path="/mod" element={<ProtectedRoute allowedRoles={['ADMIN', 'MODERATOR']}><AdminPage mode="moderator" /></ProtectedRoute>} />
        <Route path="/pravila" element={<RulesPage />} />
        <Route path="/o-nama" element={<AboutPage />} />
        <Route path="/zaradi" element={<EarnMoneyPage />} />
        <Route path="/kako-radi" element={<HowItWorksPage />} />
        <Route path="/pomoc" element={<HelpPage />} />
        <Route path="/vodici" element={<GuidesPage />} />
        <Route path="/za-biznis" element={<BusinessPage />} />
        <Route path="/kontakt" element={<ContactPage />} />
        <Route path="/cijene" element={<PricingPage />} />
        <Route path="/pravila-zajednice" element={<CommunityGuidelinesPage />} />
        <Route path="/principi-izvodjaca" element={<ProviderPrinciplesPage />} />
        <Route path="/privatnost" element={<PrivacyPage />} />
        <Route path="/kolacici" element={<CookiePolicyPage />} />
        <Route path="/aplikacija" element={<AppDownloadPage />} />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Redirect to="/404" />} />
      </Routes>
      </Suspense>
      </EmailConfirmGate>
      </RouteGuard>
      <SiteFooter />
      <NavigationBar />
      <Toaster />
      <CookieConsent />
      <DialogHost />
      </SuspensionGate>
      </UpdateGate>
    </BrowserRouter>
  )
}

export default App
