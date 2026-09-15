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

  async listMessages(conversationId) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
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
      .select('id, sender_id, receiver_id, content, created_at')
      .single()

    if (error) {
      if (error.message?.includes('CONTACT_INFO_BLOCKED')) {
        throw new Error('Kontakt podaci (broj telefona, email) mogu se dijeliti tek nakon prihvaćene ponude.')
      }
      console.error('Supabase message insert failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  subscribeToConversation(conversationId, onInsert) {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => onInsert(payload.new))
      .subscribe()
    return () => supabase.removeChannel(channel)
  },
}
