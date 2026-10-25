import { useEffect, useState } from 'react'
import '../../art/workScene.css'

/** Top of the balance card: workers on the job and a client whose payment is on its way to one of them. */
function BalanceArt() {
  const [svg, setSvg] = useState(null)
  useEffect(() => {
    let live = true
    import('../../art/workScene').then(({ workScene }) => { if (live) setSvg(workScene()) })
    return () => { live = false }
  }, [])
  return <div className="bal-art" aria-hidden="true" dangerouslySetInnerHTML={svg ? { __html: svg } : undefined} />
}

export default BalanceArt
