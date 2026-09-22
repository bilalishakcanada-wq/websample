import { Suspense, lazy } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import Welcome from '../app/Welcome'
import AppHome from '../app/AppHome'

// the marketing page is only needed on tablets/desktops, so phones never download it
const DesktopHome = lazy(() => import('./home/DesktopHome'))

function HomePage() {
  const isPhone = useMediaQuery('(max-width: 768px)')
  const { user, loading } = useAuth()
  // placeholders hold the page height while code/session load, so the footer never jumps into view
  if (isPhone) {
    if (loading) return <><div className="route-loading"><span /></div><div className="route-placeholder" /></>
    return user ? <AppHome /> : <Welcome />
  }
  return (
    <Suspense fallback={<><div className="route-loading"><span /></div><div className="route-placeholder" /></>}>
      <DesktopHome />
    </Suspense>
  )
}

export default HomePage
