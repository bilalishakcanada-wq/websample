import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'

const MAX_SIZE = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Drag & drop / tap-to-add photo picker with previews.
 * `existing` are already-uploaded images ({ id, url }); `files` are new File objects.
 * Calls onChange({ files, removedExisting }) whenever the selection changes.
 */
function ImagePicker({ existing = [], files = [], removed = [], onChange, max = 8 }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [previews, setPreviews] = useState([])

  // object URLs for the new files, released when they change
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [files])

  const keptExisting = existing.filter((image) => !removed.includes(image.id))
  const total = keptExisting.length + files.length

  const addFiles = (list) => {
    setError('')
    const incoming = Array.from(list || [])
    const good = []
    for (const file of incoming) {
      if (!ACCEPT.includes(file.type)) { setError('Dozvoljene su samo JPG, PNG i WEBP slike.'); continue }
      if (file.size > MAX_SIZE) { setError('Svaka slika mora biti manja od 5 MB.'); continue }
      good.push(file)
    }
    const room = Math.max(0, max - total)
    if (good.length > room) setError(`Najviše ${max} slika po oglasu.`)
    if (good.length === 0) return
    onChange({ files: [...files, ...good.slice(0, room)], removed })
  }

  const removeNew = (index) => onChange({ files: files.filter((_, i) => i !== index), removed })
  const removeExisting = (id) => onChange({ files, removed: [...removed, id] })

  return (
    <div className="img-picker">
      <div
        className={`img-drop ${dragging ? 'is-dragging' : ''} ${total >= max ? 'is-full' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}
        onClick={() => total < max && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inputRef.current?.click() } }}
      >
        <span className="img-drop-icon"><Camera size={26} /></span>
        <strong>{total >= max ? `Dodano ${max}/${max}` : 'Dodaj slike problema'}</strong>
        <span>Prevuci ovdje ili klikni · JPG, PNG, WEBP do 5 MB · najviše {max}</span>
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
      </div>
      {error && <div className="form-error">{error}</div>}
      {total > 0 && (
        <div className="img-grid">
          {keptExisting.map((image) => (
            <div key={image.id} className="img-thumb">
              <img src={image.url} alt="" />
              <button type="button" onClick={(event) => { event.stopPropagation(); removeExisting(image.id) }} aria-label="Ukloni sliku"><X size={14} /></button>
            </div>
          ))}
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="img-thumb is-new">
              {previews[index] && <img src={previews[index]} alt="" />}
              <button type="button" onClick={(event) => { event.stopPropagation(); removeNew(index) }} aria-label="Ukloni sliku"><X size={14} /></button>
            </div>
          ))}
          {total < max && (
            <button type="button" className="img-thumb img-thumb-add" onClick={() => inputRef.current?.click()} aria-label="Dodaj još slika"><ImagePlus size={20} /></button>
          )}
        </div>
      )}
    </div>
  )
}

export default ImagePicker
