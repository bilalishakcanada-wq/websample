import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'
import { apiRequest } from './api'
import { appConfig } from '../config/appConfig'
import { listingInputSchema, parseInput } from '../utils/inputSchemas'
import { coordsForLocation } from '../data/cityCoordinates'

export const listingService = {
  /** Owner marks a job done or cancelled. `reason` (provider|client|other) only matters for cancellations. */
  async setOutcome(id, status, reason = null) {
    const payload = status === 'cancelled' ? { status, cancel_reason: reason || 'other' } : { status }
    const { data, error } = await supabase.from('listings').update(payload).eq('id', id).select('id, status, completed_at, cancelled_at, cancel_reason').single()
    if (error) {
      console.error('Supabase listing outcome update failed', { message: error.message, code: error.code })
      throw publicError()
    }
    return data
  },

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

  async listAll({
    search = '', status = 'published', sort = 'newest', page = 1, pageSize = 10,
    ownerId = '', city = '', category = '', minPrice = '', maxPrice = '',
    remoteOnly = false, hasBudget = false,
  } = {}) {
    if (appConfig.apiBaseUrl && !ownerId) return apiRequest(`/api/listings?page=${page}&pageSize=${pageSize}`)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const ORDER = {
      newest: ['created_at', false],
      oldest: ['created_at', true],
      price_asc: ['price', true],
      price_desc: ['price', false],
    }
    const [orderColumn, ascending] = ORDER[sort] || ORDER.newest

    let query = supabase
      .from('listings')
      .select('*, listing_tags(tag_id, tags(name)), bids(count)', { count: 'exact' })
      .eq('status', status)
      .range(from, to)
      .order(orderColumn, { ascending, nullsFirst: false })

    const safeSearch = sanitizeText(search).slice(0, 80).replace(/[%_(),]/g, '')
    if (safeSearch) {
      query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%`)
    }
    if (ownerId) query = query.eq('user_id', ownerId)
    if (city) query = query.ilike('location', `%${sanitizeText(city).slice(0, 60)}%`)
    if (category) query = query.eq('category', category)
    if (minPrice !== '' && minPrice != null) query = query.gte('price', Number(minPrice))
    if (maxPrice !== '' && maxPrice != null) query = query.lte('price', Number(maxPrice))
    if (remoteOnly) query = query.ilike('location', '%online%')
    if (hasBudget) query = query.not('price', 'is', null)

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
        ...(coordsForLocation(cleanPayload.location) || { lat: null, lng: null }),
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
      ...(coordsForLocation(input.location) || { lat: null, lng: null }),
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
