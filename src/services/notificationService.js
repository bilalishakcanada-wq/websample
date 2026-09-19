import { supabase } from '../lib/supabase'

export const notificationService = {
  async listMine(limit = 20) {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.error('Supabase notifications fetch failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },

  async markRead(ids) {
    if (!ids.length) return
    const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
    if (error) console.error('Supabase notifications mark-read failed', { message: error.message, code: error.code })
  },

  /** Realtime: new notifications for this user. Returns an unsubscribe function. */
  subscribe(userId, onInsert) {
    const channel = supabase
      .channel(`notifications-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => onInsert(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },
}

/** Browser-level alert (permission is asked once, from a user gesture on the admin panel). */
export const desktopNotify = (title, body) => {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const note = new Notification(title, { body, icon: '/favicon.svg' })
    note.onclick = () => { window.focus(); note.close() }
  } catch { /* not supported */ }
}

/** Short ping so the admin hears new support messages even with the tab in the background. */
export const playPing = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch { /* autoplay blocked */ }
}
