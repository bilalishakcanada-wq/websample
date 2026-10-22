import { withBase } from '../utils/paths'
export const mockServiceCategories = [
  { id: 'handyman', name: 'Majstor za sve', icon: 'home', count: 1280, image: withBase('/images/categories/home.webp'), description: 'Sitne popravke i održavanje doma' },
  { id: 'cleaning', name: 'Čišćenje', icon: 'sparkles', count: 690, image: withBase('/images/categories/cleaning.webp'), description: 'Stan, kuća i poslovni prostor' },
  { id: 'it-support', name: 'IT podrška', icon: 'laptop', count: 960, image: withBase('/images/categories/it.webp'), description: 'Računari, mreže i tehnička pomoć' },
  { id: 'design', name: 'Dizajn i kreativne usluge', icon: 'palette', count: 730, image: withBase('/images/categories/design.webp'), description: 'Logo, grafika i web dizajn' },
  { id: 'renovation', name: 'Renoviranje i građevinski radovi', icon: 'hammer', count: 840, image: withBase('/images/categories/construction.webp'), description: 'Adaptacije, zidanje i završni radovi' },
  { id: 'electrician', name: 'Električar', icon: 'zap', count: 510, image: withBase('/images/categories/electrician.webp'), description: 'Instalacije, rasvjeta i popravke' },
  { id: 'moving-transport', name: 'Selidbe i transport', icon: 'truck', count: 380, image: withBase('/images/categories/moving.webp'), description: 'Pakovanje, prevoz i selidbe' },
  { id: 'gardening', name: 'Baštovanstvo', icon: 'leaf', count: 320, image: withBase('/images/categories/gardening.webp'), description: 'Uređenje dvorišta i zelenila' },
  { id: 'marketing', name: 'Marketing i digitalne usluge', icon: 'monitor', count: 560, image: withBase('/images/categories/marketing.webp'), description: 'Društvene mreže, oglasi i sadržaj' },
]

export const mockPlans = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    suffix: '',
    description: '3 sačuvana posla',
    perks: ['Do 3 sačuvana oglasa', 'Osnovni profil', 'Standardna podrška'],
    featured: false,
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '2.99',
    suffix: '/mjesečno',
    description: 'Do 5 sačuvanih poslova',
    perks: ['Do 5 sačuvanih oglasa', 'Prioritetna aktivnost', 'Napredna statistika'],
    featured: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '4.99',
    suffix: '/mjesečno',
    description: 'Neograničeno sačuvano',
    perks: ['Neograničeno sačuvane poslove', 'Najveća vidljivost', 'Ekskluzivni trendovi'],
    featured: false,
  },
]

export const mockCredits = [
  { id: '25', label: '25 kredita', price: '25 KM', popular: false },
  { id: '50', label: '50 kredita', price: '45 KM', popular: true },
  { id: '100', label: '100 kredita', price: '80 KM', popular: false },
]

export const mockUser = {
  id: 'user-1',
  fullName: 'Adnan Husić',
  email: 'adnan@example.com',
  city: 'Sarajevo',
  phone: '+387 61 123 456',
  bio: 'Tražim pouzdane profesionalce za kućne i digitalne usluge.',
  password: 'Demo123!',
  plan: 'plus',
}
