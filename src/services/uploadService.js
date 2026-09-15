import { apiRequest } from './api'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxFileSize = 5 * 1024 * 1024

export const uploadImage = async (file) => {
  if (!file || !allowedTypes.has(file.type) || file.size > maxFileSize) {
    throw new Error('Slika mora biti JPG, PNG ili WEBP i manja od 5 MB.')
  }

  const body = new FormData()
  body.append('image', file)
  return apiRequest('/api/uploads/image', {
    method: 'POST',
    body,
    headers: {},
  })
}