import { Suspense, lazy } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { lazyImport } from '../utils/appUpdates'

// each face of the home is its own chunk: a phone only downloads the one it shows
// (visitor welcome, signed-in home, or the desktop marketing page)
const Welcome = lazy(lazyImport(() => import('../app/Welcome')))
const AppHome = lazy(lazyImport(() => import('../app/AppHome')))
const DesktopHome = lazy(lazyImport(() => import('./home/DesktopHome')))

// placeholders hold the page height while code/session load, so the footer never jumps into view
const Holding = () => <><div className="route-loading"><span /></div><div className="route-placeholder" /></>

function HomePage() {
  const isPhone = useMediaQuery('(max-width: 768px)')
  const { user, loading } = useAuth()
  if (isPhone) {
    if (loading) return <Holding />
    return <Suspense fallback={<Holding />}>{user ? <AppHome /> : <Welcome />}</Suspense>
  }
  return (
    <Suspense fallback={<Holding />}>
      <DesktopHome />
    </Suspense>
  )
}

export default HomePage
