import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'
import { apiRequest } from './api'
import { appConfig } from '../config/appConfig'
import { parseInput, profileInputSchema } from '../utils/inputSchemas'

export const profileService = {
  async getPublicProfile(userId) {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('user_id, full_name, city, bio, avatar_url, created_at, display_uid')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Supabase public profile fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  async uploadAvatar(userId, file) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
    if (!file || !allowed.has(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error('Slika mora biti JPG, PNG ili WEBP i manja od 5 MB.')
    }
    const ext = file.type.split('/')[1]
    const path = `${userId}/avatar-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (uploadError) {
      console.error('Supabase avatar upload failed', { message: uploadError.message })
      throw publicError()
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    return data.publicUrl
  },

  async getProfile(userId) {
    if (appConfig.apiBaseUrl) return apiRequest('/api/profile')

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase profile fetch failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }

    return data
  },

  async upsertProfile(profile) {
    const input = parseInput(profileInputSchema, {
      fullName: profile.full_name || profile.fullName || '',
      city: profile.city || '',
      phone: profile.phone || '',
      bio: profile.bio || '',
    })
    const payload = {
      user_id: profile.user_id,
      full_name: input.fullName,
      email: sanitizeText((profile.email || '').toLowerCase()),
      phone: input.phone,
      city: input.city,
      bio: input.bio,
      avatar_url: sanitizeText(profile.avatar_url || profile.avatarUrl),
    }

    if (appConfig.apiBaseUrl) return apiRequest('/api/profile', { method: 'PATCH', body: payload })

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Supabase profile upsert failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }
    return data
  },
}
