import {
  Award, BadgeCheck, Bike, Car, Coffee, CreditCard, Crown, Droplets, Flag, Flame, Gem, Gift, HardHat, Hammer, Handshake, Heart,
  IdCard, Leaf, Lock, MapPinned, Medal, Paintbrush, Phone, Rocket, Shield, ShieldCheck, Smile, Sparkles, Star, Sun, Target,
  Thermometer, ThumbsUp, TrendingUp, Trophy, Truck, Wrench, Zap,
} from 'lucide-react'

// Icon names live in the badges table (badges.icon) so a badge can be added
// from the admin panel without a code change — only names in this map render.
export const BADGE_ICONS = {
  award: Award,
  'badge-check': BadgeCheck,
  bike: Bike,
  car: Car,
  coffee: Coffee,
  'credit-card': CreditCard,
  crown: Crown,
  droplets: Droplets,
  flag: Flag,
  flame: Flame,
  gem: Gem,
  gift: Gift,
  'hard-hat': HardHat,
  hammer: Hammer,
  handshake: Handshake,
  heart: Heart,
  'id-card': IdCard,
  leaf: Leaf,
  lock: Lock,
  'map-pinned': MapPinned,
  medal: Medal,
  paintbrush: Paintbrush,
  phone: Phone,
  rocket: Rocket,
  shield: Shield,
  'shield-check': ShieldCheck,
  smile: Smile,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  target: Target,
  thermometer: Thermometer,
  'thumbs-up': ThumbsUp,
  'trending-up': TrendingUp,
  trophy: Trophy,
  truck: Truck,
  wrench: Wrench,
  zap: Zap,
}

export const badgeIcon = (name) => BADGE_ICONS[name] || Award

// Preset colours for custom badges (navy/gold brand first).
export const BADGE_COLORS = ['#0d2a52', '#f5b400', '#19b37b', '#7c3aed', '#e11d48', '#0ea5e9', '#f97316', '#475569']
