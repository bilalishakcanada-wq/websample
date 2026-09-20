import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'
// Every other page loads on demand — the phone downloads only what it opens.
const DashboardPage = lazy(lazyImport(() => import('./pages/DashboardPage')))
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
const PostTaskPage = lazy(lazyImport(() => import('./pages/PostTaskPage')))
const EarnMoneyPage = lazy(lazyImport(() => import('./pages/EarnMoneyPage')))
const HowItWorksPage = lazy(lazyImport(() => import('./pages/HowItWorksPage')))
const HelpPage = lazy(lazyImport(() => import('./pages/HelpPage')))
const GuidesPage = lazy(lazyImport(() => import('./pages/GuidesPage')))
const BusinessPage = lazy(lazyImport(() => import('./pages/BusinessPage')))
const ContactPage = lazy(lazyImport(() => import('./pages/ContactPage')))
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
const AccountInfoPage = lazy(lazyImport(() => import('./pages/account/AccountInfoPage')))
const PaymentHistoryPage = lazy(lazyImport(() => import('./pages/account/PaymentHistoryPage')))
const PaymentMethodsPage = lazy(lazyImport(() => import('./pages/account/PaymentMethodsPage')))
const WalletPage = lazy(lazyImport(() => import('./pages/account/WalletPage')))
const NotificationsPage = lazy(lazyImport(() => import('./pages/account/NotificationsPage')))
const SettingsPage = lazy(lazyImport(() => import('./pages/account/SettingsPage')))

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'
import ForbiddenPage from './pages/ForbiddenPage'

// Old links keep working: /profile?tab=... -> the matching account section.
function LegacyProfileRedirect() {
  const [params] = useSearchParams()
  const tab = params.get('tab')
  const target = { usluge: '/account/vjestine', iskustvo: '/account/vjestine', portfolio: '/account/portfolio', verifikacija: '/account/znacke', racun: '/account/postavke' }[tab] || '/account/profil'
  return <Navigate to={params.get('setup') === '1' ? `${target}?setup=1` : target} replace />
}
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import InstallPrompt from './components/InstallPrompt'
import ScrollToTop from './components/ScrollToTop'
import MobileNav from './components/MobileNav'
import Toaster from './components/Toaster'
import { lazyImport } from './utils/appUpdates'
import SwBridge from './components/SwBridge'
import SupportChat from './components/SupportChat'
import { useMediaQuery } from './hooks/useMediaQuery'

// phone app screens (welcome, goal, intro, post flow, my tasks); desktop keeps its pages
const StartGoal = lazy(lazyImport(() => import('./app/StartGoal')))
const Intro = lazy(lazyImport(() => import('./app/Intro')))
const PostFlow = lazy(lazyImport(() => import('./app/PostFlow')))
const MyTasks = lazy(lazyImport(() => import('./app/MyTasks')))

/** Phones get the one-question-per-screen flow; wider screens keep the wizard. */
function PostRoute() {
  const isPhone = useMediaQuery('(max-width: 768px)')
  return isPhone ? <PostFlow /> : <ProtectedRoute><PostTaskPage /></ProtectedRoute>
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ScrollToTop />
      <SwBridge />
      <SiteHeader />
      <SupportChat />
      <InstallPrompt />
      <Suspense fallback={<div className="route-loading" aria-busy="true"><span /></div>}>
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
        <Route path="/objavi" element={<PostRoute />} />
        <Route path="/start" element={<StartGoal />} />
        <Route path="/intro" element={<Intro />} />
        <Route path="/moji-poslovi" element={<ProtectedRoute><MyTasks /></ProtectedRoute>} />
        <Route path="/dashboard" element={<Navigate to="/account" replace />} />
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
          <Route path="postavke" element={<SettingsPage />} />
          <Route path="alarmi" element={<TaskAlertsPage />} />
          <Route path="informacije" element={<AccountInfoPage />} />
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
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </Suspense>
      <SiteFooter />
      <MobileNav />
      <Toaster />
    </BrowserRouter>
  )
}

export default App
