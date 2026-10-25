import {
  Award, BadgeCheck, Bike, Car, Coffee, CreditCard, Crown, Droplets, Flag, Flame, Gem, Gift, HardHat, Hammer, Handshake, Heart,
  IdCard, Leaf, Lock, Mail, MapPinned, Medal, Paintbrush, Phone, Rocket, Shield, ShieldCheck, Smile, Sparkles, Star, Sun, Target,
  Thermometer, ThumbsUp, TrendingUp, Trophy, Truck, Wrench, Zap,
} from 'lucide-react'
import {
  BicycleIcon, CarIcon, CoffeeIcon, CreditCardIcon, CrownIcon, DiamondIcon, DropIcon, EnvelopeIcon, FlagIcon, FlameIcon, GiftIcon,
  HammerIcon, HandshakeIcon, HardHatIcon, HeartIcon, IdentificationCardIcon, LeafIcon, LightningIcon, LockIcon, MapPinAreaIcon,
  MedalIcon, PaintBrushIcon, PhoneIcon, RocketIcon, SealCheckIcon, ShieldCheckIcon, ShieldIcon, SmileyIcon, SparkleIcon, StarIcon,
  SunIcon, TargetIcon, ThermometerIcon, ThumbsUpIcon, TrendUpIcon, TrophyIcon, TruckIcon, WrenchIcon,
} from '@phosphor-icons/react'

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
  mail: Mail,
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

// The same names drawn for the medal itself: filled two-tone glyphs read better inside a coloured seal
// than thin outline icons. A name missing here falls back to the outline icon above.
const MEDAL_GLYPHS = {
  award: MedalIcon,
  'badge-check': SealCheckIcon,
  bike: BicycleIcon,
  car: CarIcon,
  coffee: CoffeeIcon,
  'credit-card': CreditCardIcon,
  crown: CrownIcon,
  droplets: DropIcon,
  flag: FlagIcon,
  flame: FlameIcon,
  gem: DiamondIcon,
  gift: GiftIcon,
  'hard-hat': HardHatIcon,
  hammer: HammerIcon,
  handshake: HandshakeIcon,
  heart: HeartIcon,
  'id-card': IdentificationCardIcon,
  leaf: LeafIcon,
  lock: LockIcon,
  mail: EnvelopeIcon,
  'map-pinned': MapPinAreaIcon,
  medal: MedalIcon,
  paintbrush: PaintBrushIcon,
  phone: PhoneIcon,
  rocket: RocketIcon,
  shield: ShieldIcon,
  'shield-check': ShieldCheckIcon,
  smile: SmileyIcon,
  sparkles: SparkleIcon,
  star: StarIcon,
  sun: SunIcon,
  target: TargetIcon,
  thermometer: ThermometerIcon,
  'thumbs-up': ThumbsUpIcon,
  'trending-up': TrendUpIcon,
  trophy: TrophyIcon,
  truck: TruckIcon,
  wrench: WrenchIcon,
  zap: LightningIcon,
}

/** Glyph for the medal: `{ Icon, phosphor }` so the caller knows which props it takes. */
export const medalGlyph = (name) => (MEDAL_GLYPHS[name] ? { Icon: MEDAL_GLYPHS[name], phosphor: true } : { Icon: badgeIcon(name), phosphor: false })

// Preset colours for custom badges (navy/gold brand first).
export const BADGE_COLORS = ['#0d2a52', '#0c4ee9', '#19b37b', '#7c3aed', '#e11d48', '#0ea5e9', '#f97316', '#475569']
