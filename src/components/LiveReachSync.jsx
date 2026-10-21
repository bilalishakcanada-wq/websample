import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { keys } from '../hooks/queryKeys'
import { isLiveReachOn, LIVE_REACH_EVENT, startLiveReach } from '../utils/liveReach'
import { backgroundLocationSupported } from '../utils/location'
import { locationPermission } from '../utils/permissions'

/**
 * "Lokacija uživo": while the switch is on, the position follows the person and every new point refreshes
 * the distance to jobs on screen (job pages, search). In the app it keeps going with
 * Zadatak in the background; in a browser it pauses while the page is hidden.
 * Renders nothing. Never asks for permission itself: that happens on a tap (Postavke, RequiredPermissions).
 */
function LiveReachSync() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [on, setOn] = useState(isLiveReachOn)
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')

  useEffect(() => {
    const flip = () => setOn(isLiveReachOn())
    const seen = () => setVisible(document.visibilityState === 'visible')
    window.addEventListener(LIVE_REACH_EVENT, flip)
    document.addEventListener('visibilitychange', seen)
    return () => { window.removeEventListener(LIVE_REACH_EVENT, flip); document.removeEventListener('visibilitychange', seen) }
  }, [])

  const userId = user?.id
  // in the app the position keeps coming with Zadatak in the background; a browser only follows a visible page
  const running = visible || backgroundLocationSupported()
  useEffect(() => {
    if (!userId || !on || !running) return undefined
    let stop = () => {}
    let alive = true
    locationPermission().then((state) => {
      if (!alive || state !== 'granted') return
      stop = startLiveReach({
        onReport: () => {
          queryClient.invalidateQueries({ queryKey: keys.reachPoint(userId) })
          queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'me' && query.queryKey[1] === userId && query.queryKey[2] === 'offer-reach' })
        },
      })
    })
    return () => { alive = false; stop() }
  }, [userId, on, running, queryClient])

  return null
}

export default LiveReachSync
