import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

export const messageService = {
  async listConversations(userId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, listing_id, participant_one, participant_two, status, created_at, listings(title), messages(content, created_at, sender_id)')
      .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase conversations fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }

    return (data || []).map((conversation) => {
      const otherId = conversation.participant_one === userId ? conversation.participant_two : conversation.participant_one
      const sortedMessages = [...(conversation.messages || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return {
        id: conversation.id,
        listingTitle: conversation.listings?.title || 'Razgovor',
        otherUserId: otherId,
        lastMessage: sortedMessages[0]?.content || '',
        lastAt: sortedMessages[0]?.created_at || conversation.created_at,
      }
    }).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
  },

  /** Inbox for the signed-in user: conversations with the other person, unread count, saved/archived flags — one call. */
  async inbox() {
    const { data, error } = await supabase.rpc('my_inbox')
    if (error) {
      console.error('Supabase inbox fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async markRead(conversationId) {
    const { error } = await supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId })
    // the tab-bar badge listens for this
    try { window.dispatchEvent(new Event('poso:messages-read')) } catch { /* ignore */ }
    if (error) console.error('Supabase mark read failed', { message: error.message, code: error.code })
  },

  async setPref(userId, conversationId, changes) {
    const { error } = await supabase
      .from('conversation_prefs')
      .upsert({ user_id: userId, conversation_id: conversationId, ...changes, updated_at: new Date().toISOString() }, { onConflict: 'user_id,conversation_id' })
    if (error) {
      console.error('Supabase conversation pref failed', { message: error.message, code: error.code })
      throw publicError()
    }
  },

  /** Any message sent to me, in any conversation — used to keep the inbox live. */
  subscribeToMine(userId, onInsert) {
    const channel = supabase
      .channel(`inbox-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, (payload) => onInsert(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },

  async listMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, read_at, attachment_url, attachment_type')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Supabase messages fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data || []
  },

  async send({ conversationId, senderId, receiverId, content }) {
    const cleanContent = sanitizeText(content).slice(0, 2000)
    if (!cleanContent) throw new Error('Poruka ne može biti prazna.')

    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, receiver_id: receiverId, content: cleanContent })
      .select('id, sender_id, receiver_id, content, created_at, attachment_url, attachment_type')
      .single()

    if (error) {
      console.error('Supabase message insert failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  /** Photo message: the image is shrunk in the browser, stored under the sender's folder, then sent as a message. */
  async sendImage({ conversationId, senderId, receiverId, file }) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
    if (!file || !allowed.has(file.type) || file.size > 15 * 1024 * 1024) throw new Error('Slika mora biti JPG, PNG ili WEBP, manja od 15 MB.')
    const { resizeImage } = await import('../utils/imageResize')
    const shrunk = await resizeImage(file)
    const ext = shrunk.type === 'image/webp' ? 'webp' : shrunk.type === 'image/png' ? 'png' : 'jpg'
    const path = `${senderId}/chat/${conversationId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('media').upload(path, shrunk, { cacheControl: '31536000', contentType: shrunk.type })
    if (uploadError) { console.error('Chat image upload failed', { message: uploadError.message }); throw new Error('Slika nije poslana. Pokušaj ponovo.') }
    const { data: urlData } = supabase.storage.from('media').getPublicUrl(path)
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: senderId, receiver_id: receiverId, content: '📷 Slika', attachment_url: urlData.publicUrl, attachment_type: 'image' })
      .select('id, sender_id, receiver_id, content, created_at, attachment_url, attachment_type')
      .single()
    if (error) { console.error('Supabase image message insert failed', { message: error.message, code: error.code }); throw publicError() }
    return data
  },

  /** True once a bid is accepted in this conversation — contact details may then be shared. */
  async contactsAllowed(conversationId) {
    const { data, error } = await supabase.rpc('conversation_contacts_allowed', { p_conversation_id: conversationId })
    if (error) return false
    return Boolean(data)
  },

  subscribeToConversation(conversationId, onInsert) {
    const channel = supabase
      .channel(`conversation-${conversationId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => onInsert(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },
}
