import { Award, BadgeCheck, Bell, Bot, Briefcase, CalendarX, FileSignature, HelpCircle, Info, LifeBuoy, MessageCircle, Send, Shield, ShieldBan, Sparkles, Star, UserX, Wallet } from 'lucide-react'

// Every notification belongs to one of five groups. The database keeps its
// detailed `type` (offer, wallet, job, ...); the group is derived here, so the
// screen needs no schema change and old rows sort themselves too.
export const NOTIF_CATEGORIES = [
  { key: 'all', label: 'Sve' },
  { key: 'offer', label: 'Ponude' },
  { key: 'job', label: 'Poslovi' },
  { key: 'finance', label: 'Finansije' },
  { key: 'message', label: 'Poruke' },
  { key: 'system', label: 'Sistem' },
]

const BY_TYPE = {
  offer: 'offer', offer_updated: 'offer', offer_accepted: 'offer', offer_rejected: 'offer', quote_request: 'offer', quote_declined: 'offer',
  wallet: 'finance', payment: 'finance', payout: 'finance',
  message: 'message', support_reply: 'message', question: 'message',
  job: 'job', task_alert: 'job', task_live: 'job', task_expired: 'job', review: 'job',
  support: 'system', moderation: 'system', ai: 'system', badge: 'system', welcome: 'system', role: 'system', identity: 'system',
}

// 'job' rows also carry the money events of a booking (escrow held, released,
// refunded, disputes): those read as Finansije.
const MONEY_WORDS = /uplat|novac|isplat|balans|povrat|refund|cijen|spor|\bkm\b/i

export const notificationCategory = (item) => {
  const type = item?.type || ''
  const base = BY_TYPE[type] || 'system'
  if (base === 'job' && type === 'job' && MONEY_WORDS.test(`${item.title || ''} ${item.message || ''}`)) return 'finance'
  return base
}

const TYPE_ICONS = {
  offer: Briefcase, offer_updated: FileSignature, offer_accepted: BadgeCheck, offer_rejected: Briefcase, quote_request: Send, quote_declined: UserX,
  support: LifeBuoy, support_reply: MessageCircle, moderation: ShieldBan, ai: Bot, badge: Award, welcome: Sparkles, role: Shield,
  message: MessageCircle, question: HelpCircle,
  task_alert: Bell, task_live: Sparkles, task_expired: CalendarX, review: Star,
}
const CATEGORY_ICONS = { offer: Briefcase, job: Briefcase, finance: Wallet, message: MessageCircle, system: Info }

export const notificationIcon = (item) => {
  const category = notificationCategory(item)
  if (category === 'finance') return Wallet
  return TYPE_ICONS[item?.type] || CATEGORY_ICONS[category] || Bell
}

/** Quick action shown inside the card, so offers are one tap away. */
export const notificationAction = (item) => {
  if (!item?.link) return null
  if (['offer', 'offer_updated'].includes(item.type)) return 'Pogledaj ponudu'
  if (item.type === 'quote_request') return 'Pošalji ponudu'
  if (item.type === 'offer_accepted') return 'Otvori posao'
  if (item.type === 'offer_rejected' && item.link.startsWith('/listings/')) return 'Pošalji novu cijenu'
  return null
}

const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** Danas / Jučer / Ranije, in the order the rows came (newest first). */
export const groupByDay = (items, now = new Date()) => {
  const today = dayStart(now)
  const yesterday = today - 86400000
  const groups = [{ key: 'today', label: 'Danas', items: [] }, { key: 'yesterday', label: 'Jučer', items: [] }, { key: 'older', label: 'Ranije', items: [] }]
  for (const item of items) {
    const at = new Date(item.created_at)
    const day = Number.isNaN(at.getTime()) ? 0 : dayStart(at)
    groups[day >= today ? 0 : day >= yesterday ? 1 : 2].items.push(item)
  }
  return groups.filter((group) => group.items.length)
}
