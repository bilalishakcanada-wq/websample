import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'
import { apiRequest } from './api'
import { appConfig } from '../config/appConfig'
import { listingInputSchema, parseInput } from '../utils/inputSchemas'
import { prepoznajGresku } from '../utils/validation'
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
      .select('*, listing_tags(tag_id, tags(name)), listing_images(id, url, position)')
      .eq('id', id)
      .in('status', ['published', 'assigned', 'completed', 'cancelled'])
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
      .select('id, user_id, title, description, category, location, price, currency, status, created_at, bids(count), listing_images(url, position)')
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
      .select('id, title, category, location, price, currency, created_at, listing_images(url, position)')
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
      .select('*, listing_tags(tag_id, tags(name)), bids(count), listing_images(url, position)', { count: 'exact' })
      .range(from, to)
    // an owner's dashboard shows every live job (open, assigned, done); everyone else only open ones
    query = ownerId && status === 'published' ? query.in('status', ['published', 'assigned', 'completed', 'cancelled']) : query.eq('status', status)
    query = query
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

  /**
   * Ranked search, computed in Postgres (search_listings): text relevance with typo tolerance,
   * distance from the searcher, freshness, competition, completeness, the poster's track record
   * and — when signed in — the searcher's trades. One round trip, paged, ~tens of ms.
   */
  async search({
    query = '', category = '', lat = null, lng = null, radiusKm = 0, includeRemote = true,
    minPrice = '', maxPrice = '', hasBudget = false, noOffers = false, sort = 'recommended', limit = 50, offset = 0,
  } = {}) {
    const { data, error } = await supabase.rpc('search_listings', {
      p_query: sanitizeText(query).slice(0, 80),
      p_category: category || '',
      p_lat: lat, p_lng: lng,
      p_radius_km: radiusKm || 0,
      p_include_remote: Boolean(includeRemote),
      p_min_price: minPrice === '' || minPrice == null ? null : Number(minPrice),
      p_max_price: maxPrice === '' || maxPrice == null ? null : Number(maxPrice),
      p_has_budget: Boolean(hasBudget),
      p_no_offers: Boolean(noOffers),
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    })
    if (error) {
      console.error('Supabase search failed', { message: error.message, code: error.code })
      throw publicError()
    }
    const rows = data || []
    return { data: rows, count: rows[0]?.total_count ?? 0 }
  },

  /** First photo of a listing row (from the embedded listing_images), or null. */
  coverImage(listing) {
    const images = [...(listing?.listing_images || [])].sort((a, b) => a.position - b.position)
    return images[0]?.url || null
  },

  /** Upload job photos to storage and attach them to the listing (max 8, JPG/PNG/WEBP ≤ 5 MB). */
  async uploadImages(userId, listingId, files, startPosition = 0) {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
    const rows = []
    const { resizeImage } = await import('../utils/imageResize')
    for (const [index, original] of Array.from(files).slice(0, 8).entries()) {
      // phone photos are 3–8 MB; everyone who opens the job would download that. 1600 px webp is ~200–400 KB.
      const file = allowed.has(original.type) ? await resizeImage(original) : original
      if (!allowed.has(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Slika mora biti JPG, PNG ili WEBP i manja od 5 MB.')
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${userId}/listings/${listingId}/${crypto.randomUUID()}.${ext}`
      // every upload gets a fresh random name, so browsers may keep it for a year
      const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '31536000', contentType: file.type })
      if (uploadError) {
        console.error('Listing image upload failed', { message: uploadError.message })
        throw new Error('Slika nije mogla biti učitana. Pokušaj ponovo.')
      }
      const { data } = supabase.storage.from('media').getPublicUrl(path)
      rows.push({ listing_id: listingId, user_id: userId, url: data.publicUrl, path, position: startPosition + index })
    }
    if (rows.length === 0) return []
    const { data, error } = await supabase.from('listing_images').insert(rows).select('id, url, position')
    if (error) {
      console.error('Listing image insert failed', { message: error.message, code: error.code })
      throw new Error(error.message?.includes('policy') ? 'Dozvoljeno je najviše 8 slika po oglasu.' : 'Slike nisu sačuvane. Pokušaj ponovo.')
    }
    return data || []
  },

  async deleteImage(image) {
    const { error } = await supabase.from('listing_images').delete().eq('id', image.id)
    if (error) throw publicError()
    if (image.path) await supabase.storage.from('media').remove([image.path]).catch(() => {})
  },

  async listImages(listingId) {
    const { data } = await supabase.from('listing_images').select('id, url, path, position').eq('listing_id', listingId).order('position')
    return data || []
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
      const poznata = prepoznajGresku(error)
      if (poznata) throw poznata
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
    if (error) {
      if (String(error.message || '').includes('PAYMENT_IN_PROGRESS')) throw new Error('Ovaj posao ima osiguranu uplatu — prvo je oslobodi ili otkaži na stranici posla, pa ga onda obriši.')
      throw publicError()
    }
  },
}
