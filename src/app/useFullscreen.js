import { useEffect } from 'react'

/** Screens that draw their own top bar (welcome, goal, intro, post flow) hide the site header and tab bar. */
export function useFullscreen(active = true) {
  useEffect(() => {
    if (!active) return undefined
    document.body.dataset.chrome = 'off'
    return () => { delete document.body.dataset.chrome }
  }, [active])
}
