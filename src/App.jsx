import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage'
import ForbiddenPage from './pages/ForbiddenPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SearchPage from './pages/SearchPage'
import ListingDetailPage from './pages/ListingDetailPage'
import MessagesPage from './pages/MessagesPage'
import RulesPage from './pages/RulesPage'
import PublicProfilePage from './pages/PublicProfilePage'
import AboutPage from './pages/AboutPage'
import PrivacyPage from './pages/PrivacyPage'
import PostTaskPage from './pages/PostTaskPage'
import EarnMoneyPage from './pages/EarnMoneyPage'
import HowItWorksPage from './pages/HowItWorksPage'
import HelpPage from './pages/HelpPage'
import GuidesPage from './pages/GuidesPage'
import BusinessPage from './pages/BusinessPage'
import ContactPage from './pages/ContactPage'
import PricingPage from './pages/PricingPage'
import CommunityGuidelinesPage from './pages/CommunityGuidelinesPage'
import ProviderPrinciplesPage from './pages/ProviderPrinciplesPage'
import SiteFooter from './components/SiteFooter'
import MobileNav from './components/MobileNav'
import SupportChat from './components/SupportChat'

function App() {
  return (
    <BrowserRouter>
      <SupportChat />
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
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
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
      <SiteFooter />
      <MobileNav />
    </BrowserRouter>
  )
}

export default App
