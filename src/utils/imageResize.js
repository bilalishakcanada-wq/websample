/** Shrinks a photo in the browser before upload (max edge px, webp). Falls back to the original file. */
export async function resizeImage(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  if (!file || !file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 900 * 1024) { bitmap.close?.(); return file }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, quality))
    // older iOS Safari cannot encode webp and silently hands back a PNG: use JPEG there
    let blob = await encode('image/webp')
    if (blob && blob.type !== 'image/webp') blob = await encode('image/jpeg')
    if (!blob || (scale === 1 && blob.size >= file.size)) return file
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type })
  } catch {
    return file
  }
}
