import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { messageService } from '../services/messageService'

/** Number of unread messages for the signed-in user — live (new message in, or a thread marked read). */
export function useUnreadMessages(userId) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId) { setCount(0); return undefined }
    let alive = true
    const load = async () => {
      const { count: n, error } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).is('read_at', null)
      if (alive && !error) setCount(n || 0)
    }
    load()
    const stop = messageService.subscribeToMine(userId, () => load())
    const onRead = () => load()
    window.addEventListener('poso:messages-read', onRead)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; stop(); window.removeEventListener('poso:messages-read', onRead); document.removeEventListener('visibilitychange', onVisible) }
  }, [userId])

  return count
}
