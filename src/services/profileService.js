import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'
import { apiRequest } from './api'
import { appConfig } from '../config/appConfig'
import { parseInput, profileInputSchema } from '../utils/inputSchemas'
import { contactInfoMessage, scanContactInfo } from '../utils/moderation'

// First + last name, letters only — mirrors public.is_valid_full_name().
export const isValidFullName = (value) => /^\p{L}[\p{L}'’.-]*(\s+\p{L}[\p{L}'’.-]*)+$/u.test(String(value || '').trim()) && String(value || '').trim().length <= 120

export const profileService = {
  async getPublicProfile(userId) {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, city, bio, avatar_url, created_at, account_type, trades, verified_trade, last_seen_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Supabase public profile fetch failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  /** Everything the public profile page needs, in one round trip. Null when the profile is not public. */
  async getPublicBundle(userId) {
    const { data, error } = await supabase.rpc('public_profile_bundle', { p_user_id: userId })
    if (error) {
      console.error('Supabase public profile bundle failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  /** The signed-in user's own profile, portfolio, verification, badges, trust and Rule #1 strikes — one call. */
  async getMyBundle() {
    const { data, error } = await supabase.rpc('my_profile_bundle')
    if (error) {
      console.error('Supabase my profile bundle failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

  /**
   * Ask the AI moderator to look at the images this user just uploaded.
   * Resolves to { configured, results: [{ kind, status, reason }] }; never throws —
   * the scheduled sweep will pick the image up if this call fails.
   */
  async checkMyMedia() {
    try {
      const { data, error } = await supabase.functions.invoke('moderate-media', { body: { mode: 'user' } })
      if (error) throw error
      return data || { configured: false, results: [] }
    } catch (invokeError) {
      console.warn('Media moderation check unavailable', { message: invokeError.message })
      return { configured: false, results: [] }
    }
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
    if (!isValidFullName(input.fullName)) {
      throw new Error('Unesi pravo ime i prezime (npr. "Bilal Ishak") — samo slova, bez brojeva i nadimaka.')
    }
    const scan = scanContactInfo(input.fullName, input.bio)
    if (!scan.clean) throw new Error(contactInfoMessage(scan, 'profil'))
    const accountType = ['client', 'provider', 'both'].includes(profile.account_type) ? profile.account_type : 'client'
    const trades = Array.isArray(profile.trades)
      ? profile.trades.slice(0, 10).map((trade) => sanitizeText(trade)).filter(Boolean)
      : []
    const list = (value, max, maxLength = 120) => (Array.isArray(value) ? value : [])
      .map((item) => sanitizeText(item).slice(0, maxLength))
      .filter(Boolean)
      .slice(0, max)
    const sections = {
      education: list(profile.education, 10),
      work_experience: list(profile.work_experience, 10),
      specialties: list(profile.specialties, 15, 60),
      transportation: list(profile.transportation, 8, 30),
    }
    const sectionScan = scanContactInfo(...sections.education, ...sections.work_experience, ...sections.specialties)
    if (!sectionScan.clean) throw new Error(contactInfoMessage(sectionScan, 'profil'))
    const payload = {
      user_id: profile.user_id,
      full_name: input.fullName,
      email: sanitizeText((profile.email || '').toLowerCase()),
      phone: input.phone,
      city: input.city,
      bio: input.bio,
      avatar_url: sanitizeText(profile.avatar_url || profile.avatarUrl),
      account_type: accountType,
      trades: accountType === 'client' ? [] : trades,
      ...sections,
      onboarding_completed: true,
    }

    if (appConfig.apiBaseUrl) return apiRequest('/api/profile', { method: 'PATCH', body: payload })

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      if (error.message?.includes('FULL_NAME_INVALID')) {
        throw new Error('Unesi pravo ime i prezime (npr. "Bilal Ishak") — samo slova, bez brojeva i nadimaka.')
      }
      console.error('Supabase profile upsert failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }
    return data
  },
}
