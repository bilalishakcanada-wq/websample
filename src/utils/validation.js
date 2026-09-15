export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

export const isStrongPassword = (value) => {
  if (!value || value.length < 8) return false
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value)
}

export const sanitizeText = (value) => String(value ?? '').trim()

export const publicError = () => new Error('Zahtjev nije moguće obraditi. Pokušajte ponovo.')
