import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { keys } from '../hooks/queryKeys'
import { isLiveReachOn, LIVE_REACH_EVENT, startLiveReach } from '../utils/liveReach'
import { locationPermission } from '../utils/permissions'

/**
 * "Lokacija uživo": while the switch is on and Zadatak is open, the position follows the person and
 * every new point refreshes doseg ponuda on screen (the reach radar, the offer button, search).
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
  useEffect(() => {
    if (!userId || !on || !visible) return undefined
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
  }, [userId, on, visible, queryClient])

  return null
}

export default LiveReachSync
