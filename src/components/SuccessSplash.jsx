import { useEffect } from 'react'
import { Check, Share2 } from 'lucide-react'
import { haptic } from '../utils/native'

/** Full-screen "done!" moment (animated check) after a big action, e.g. a job is published. */
function SuccessSplash({ title, text, onClose, onShare }) {
  useEffect(() => {
    haptic('medium')
    const timer = window.setTimeout(onClose, 6000)
    return () => window.clearTimeout(timer)
  }, [onClose])

  return (
    <div className="success-splash" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="success-splash-card" onClick={(event) => event.stopPropagation()}>
        <span className="success-splash-check"><Check size={40} strokeWidth={3} /></span>
        <span className="success-splash-ring" aria-hidden="true" />
        <h2>{title}</h2>
        {text && <p>{text}</p>}
        <div className="success-splash-actions">
          {onShare && <button type="button" className="ghost-button" onClick={onShare}><Share2 size={16} /> Podijeli</button>}
          <button type="button" className="primary-button" onClick={onClose}>Super</button>
        </div>
      </div>
    </div>
  )
}

export default SuccessSplash
