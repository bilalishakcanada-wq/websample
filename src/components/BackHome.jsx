import { ArrowLeft } from 'lucide-react'
import { useGoBack } from '../hooks/useGoBack'
import { canGoBackInApp } from '../utils/backNav'

/** Back to the previous screen when there is one, otherwise up to the home page (never a new history entry). */
function BackHome({ label = 'Početna' }) {
  const goBack = useGoBack('/')
  return (
    <button type="button" className="back-home-link" onClick={goBack}>
      <ArrowLeft size={16} /> {canGoBackInApp() ? 'Nazad' : label}
    </button>
  )
}

export default BackHome
