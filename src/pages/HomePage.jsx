import { Suspense, lazy } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MobileHome from './home/MobileHome'

// the marketing page is only needed on tablets/desktops, so phones never download it
const DesktopHome = lazy(() => import('./home/DesktopHome'))

function HomePage() {
  const isPhone = useMediaQuery('(max-width: 768px)')
  if (isPhone) return <MobileHome />
  return (
    <Suspense fallback={<div className="route-loading"><span /></div>}>
      <DesktopHome />
    </Suspense>
  )
}

export default HomePage
