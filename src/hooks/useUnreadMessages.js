import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { messageService } from '../services/messageService'
import { keys } from './queries'

const countUnread = async (userId) => {
  const { count, error } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', userId).is('read_at', null)
  if (error) throw error
  return count || 0
}

/** Number of unread messages for the signed-in user — cached, live (new message in, or a thread marked read). */
export function useUnreadMessages(userId) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: keys.unreadMessages(userId),
    queryFn: () => countUnread(userId),
    enabled: Boolean(userId),
    staleTime: 15 * 1000,
    meta: { persist: false },
  })
  useEffect(() => {
    if (!userId) return undefined
    const bump = () => {
      queryClient.invalidateQueries({ queryKey: keys.unreadMessages(userId) })
      queryClient.invalidateQueries({ queryKey: keys.inbox(userId) })
    }
    const stop = messageService.subscribeToMine(userId, bump)
    window.addEventListener('poso:messages-read', bump)
    return () => { stop(); window.removeEventListener('poso:messages-read', bump) }
  }, [userId, queryClient])
  return data || 0
}
