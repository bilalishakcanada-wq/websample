import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

export const portfolioService = {
  async listForUser(userId) {
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('id, media_url, media_type, caption, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase portfolio fetch failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },

  async upload(userId, original, caption = '') {
    const allowedImage = new Set(['image/jpeg', 'image/png', 'image/webp'])
    const allowedVideo = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
    // photos are shrunk to 1600 px webp before upload; videos go as they are
    const { resizeImage } = await import('../utils/imageResize')
    const file = original && allowedImage.has(original.type) ? await resizeImage(original) : original
    if (!file || file.size > 25 * 1024 * 1024 || !(allowedImage.has(file.type) || allowedVideo.has(file.type))) {
      throw new Error('Fajl mora biti JPG/PNG/WEBP slika ili MP4/WEBM video, manji od 25 MB.')
    }
    const mediaType = allowedVideo.has(file.type) ? 'video' : 'image'
    const ext = file.type.split('/')[1]
    const path = `${userId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '31536000', contentType: file.type })
    if (uploadError) {
      console.error('Supabase portfolio upload failed', { message: uploadError.message })
      throw publicError()
    }

    const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(path)

    const { data, error } = await supabase
      .from('portfolio_items')
      .insert({ user_id: userId, media_url: publicUrlData.publicUrl, media_type: mediaType, caption: sanitizeText(caption).slice(0, 200) })
      .select('id, media_url, media_type, caption, created_at')
      .single()

    if (error) {
      console.error('Supabase portfolio item insert failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  async remove(itemId) {
    const { error } = await supabase.from('portfolio_items').delete().eq('id', itemId)
    if (error) throw publicError()
  },
}
