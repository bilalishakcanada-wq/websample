import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'
// Every other page loads on demand — the phone downloads only what it opens.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const ListingDetailPage = lazy(() => import('./pages/ListingDetailPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const RulesPage = lazy(() => import('./pages/RulesPage'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const PostTaskPage = lazy(() => import('./pages/PostTaskPage'))
const EarnMoneyPage = lazy(() => import('./pages/EarnMoneyPage'))
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'))
const HelpPage = lazy(() => import('./pages/HelpPage'))
const GuidesPage = lazy(() => import('./pages/GuidesPage'))
const BusinessPage = lazy(() => import('./pages/BusinessPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const CommunityGuidelinesPage = lazy(() => import('./pages/CommunityGuidelinesPage'))
const ProviderPrinciplesPage = lazy(() => import('./pages/ProviderPrinciplesPage'))
const TiersInfoPage = lazy(() => import('./pages/TiersInfoPage'))
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'))
const ProfileSettingsPage = lazy(() => import('./pages/account/ProfileSettingsPage'))
const SkillsPage = lazy(() => import('./pages/account/SkillsPage'))
const BadgesPage = lazy(() => import('./pages/account/BadgesPage'))
const PortfolioPage = lazy(() => import('./pages/account/PortfolioPage'))
const TierDashboardPage = lazy(() => import('./pages/account/TierDashboardPage'))
const PaymentHistoryPage = lazy(() => import('./pages/account/PaymentHistoryPage'))
const PaymentMethodsPage = lazy(() => import('./pages/account/PaymentMethodsPage'))
const WalletPage = lazy(() => import('./pages/account/WalletPage'))
const NotificationsPage = lazy(() => import('./pages/account/NotificationsPage'))
const SettingsPage = lazy(() => import('./pages/account/SettingsPage'))

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
import MobileNav from './components/MobileNav'
import SupportChat from './components/SupportChat'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
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
        <Route path="/objavi" element={<ProtectedRoute><PostTaskPage /></ProtectedRoute>} />
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
    </BrowserRouter>
  )
}

export default App
