import { supabase } from '../lib/supabase'
import { publicError, sanitizeText } from '../utils/validation'

export const reviewService = {
  async listForUser(userId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, listing_id, reviewer_id, reviewer:public_profiles!reviews_reviewer_id_fkey(display_name, avatar_url)')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false })

    if (!error) return data || []

    // Fallback if the FK-based embed isn't available (e.g. before a schema cache refresh):
    // fetch reviews and reviewer names separately instead of failing the whole page.
    const { data: reviews, error: plainError } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, listing_id, reviewer_id')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false })

    if (plainError) {
      console.error('Supabase reviews fetch failed', { message: plainError.message, code: plainError.code })
      throw publicError()
    }

    const reviewerIds = [...new Set((reviews || []).map((review) => review.reviewer_id))]
    if (reviewerIds.length === 0) return reviews || []

    const { data: reviewers } = await supabase
      .from('public_profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', reviewerIds)

    const byId = new Map((reviewers || []).map((reviewer) => [reviewer.user_id, reviewer]))
    return (reviews || []).map((review) => ({ ...review, reviewer: byId.get(review.reviewer_id) || null }))
  },

  async getSummary(userId) {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', userId)

    if (error) {
      console.error('Supabase review summary fetch failed', { message: error.message, code: error.code })
      return { average: null, count: 0 }
    }
    if (!data || data.length === 0) return { average: null, count: 0 }

    const average = data.reduce((sum, row) => sum + Number(row.rating), 0) / data.length
    return { average: Math.round(average * 10) / 10, count: data.length }
  },

  /** Has this person already reviewed this job? (one review per person per job) */
  async mineForListing(listingId, reviewerId) {
    if (!listingId || !reviewerId) return null
    const { data } = await supabase.from('reviews').select('id, rating, comment, created_at').eq('listing_id', listingId).eq('reviewer_id', reviewerId).maybeSingle()
    return data || null
  },

  async createReview({ reviewerId, revieweeId, listingId, rating, comment }) {
    if (reviewerId === revieweeId) throw new Error('Ne možete ostaviti recenziju samom sebi.')
    const cleanComment = sanitizeText(comment).slice(0, 1000)
    const cleanRating = Number(rating)
    if (!Number.isFinite(cleanRating) || cleanRating < 1 || cleanRating > 5) {
      throw new Error('Ocjena mora biti između 1 i 5.')
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({ reviewer_id: reviewerId, reviewee_id: revieweeId, listing_id: listingId || null, rating: cleanRating, comment: cleanComment })
      .select('id, rating, comment, created_at')
      .single()

    if (error) {
      console.error('Supabase review insert failed', { message: error.message, code: error.code })
      if (error.code === '23505') throw new Error('Već si ostavio/la recenziju za ovaj posao.')
      throw publicError()
    }
    return data
  },
}
