import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'
import { apiRequest } from './api'
import { appConfig } from '../config/appConfig'
import { listingInputSchema, parseInput } from '../utils/inputSchemas'

export const listingService = {
  async getById(id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null

    const { data, error } = await supabase
      .from('listings')
      .select('*, listing_tags(tag_id, tags(name))')
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle()

    if (error) {
      console.error('Supabase listing detail fetch failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }
    return data
  },

  async listLatestPublished(limit = 8) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, user_id, title, description, category, location, price, currency, status, created_at, bids(count)')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Supabase latest listings fetch failed', { message: error.message, code: error.code })
      return []
    }
    return data || []
  },

  async listRelated({ id, category, location }) {
    let query = supabase
      .from('listings')
      .select('id, title, category, location, price, currency, created_at')
      .eq('status', 'published')
      .neq('id', id)
      .limit(4)

    if (category) query = query.eq('category', category)
    if (location) query = query.eq('location', location)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) {
      console.error('Supabase related listings fetch failed', { message: error.message, code: error.code, details: error.details, hint: error.hint })
      throw publicError()
    }
    return data || []
  },

  async listAll({ search = '', status = 'published', sort = 'created_at', page = 1, pageSize = 10, ownerId = '', city = '', category = '', maxPrice = '' } = {}) {
    if (appConfig.apiBaseUrl && !ownerId) return apiRequest(`/api/listings?page=${page}&pageSize=${pageSize}`)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('listings')
      .select('*, listing_tags(tag_id, tags(name)), bids(count)', { count: 'exact' })
      .eq('status', status)
      .range(from, to)
      .order(sort, { ascending: false })

    const safeSearch = sanitizeText(search).slice(0, 80).replace(/[%_(),]/g, '')
    if (safeSearch) {
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`)
    }
    if (ownerId) query = query.eq('user_id', ownerId)
    if (city) query = query.ilike('location', `%${sanitizeText(city).slice(0, 60)}%`)
    if (category) query = query.eq('category', category)
    if (maxPrice) query = query.lte('price', Number(maxPrice))

    const { data, error, count } = await query

    if (error) {
      console.error('Supabase listing fetch failed', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw publicError()
    }
    return { data, count }
  },

  async createListing(payload) {
    const input = parseInput(listingInputSchema, {
      title: payload.title || '',
      description: payload.description || '',
      category: payload.category || '',
      location: payload.location || '',
      price: payload.price ?? '',
      tags: payload.tags || '',
    })
    const cleanPayload = { ...payload, ...input, price: input.price === '' ? null : input.price }
    if (appConfig.apiBaseUrl) return apiRequest('/api/listings', { method: 'POST', body: cleanPayload })

    const { data, error } = await supabase
      .from('listings')
      .insert({
        user_id: payload.user_id,
        title: cleanPayload.title,
        description: cleanPayload.description,
        category: cleanPayload.category,
        location: cleanPayload.location,
        price: cleanPayload.price,
        currency: payload.currency || 'BAM',
        status: payload.status || 'draft',
      })
      .select()
      .single()

    if (error) {
      console.error('CREATE LISTING ERROR:', error)
      console.error('Supabase listing insert failed', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        payload: cleanPayload,
      })
      throw publicError()
    }
    return data
  },

  async updateListing(id, payload) {
    const input = parseInput(listingInputSchema, {
      title: payload.title || '',
      description: payload.description || '',
      category: payload.category || '',
      location: payload.location || '',
      price: payload.price ?? '',
      tags: payload.tags || '',
    })
    const cleanPayload = {
      title: input.title,
      description: input.description,
      category: input.category,
      location: input.location,
      price: input.price === '' ? null : input.price,
      currency: 'BAM',
      status: payload.status || 'published',
    }
    if (appConfig.apiBaseUrl) return apiRequest(`/api/listings/${id}`, { method: 'PATCH', body: cleanPayload })

    const { data, error } = await supabase
      .from('listings')
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase listing update failed', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw publicError()
    }
    return data
  },

  async deleteListing(id) {
    if (appConfig.apiBaseUrl) return apiRequest(`/api/listings/${id}`, { method: 'DELETE' })

    const { error } = await supabase.from('listings').delete().eq('id', id)
    if (error) throw publicError()
  },
}
