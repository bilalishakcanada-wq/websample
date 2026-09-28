import { isPrivateRef, openPrivateFile, usePrivateFileUrl } from '../lib/privateFiles'

/** A photo from the private bucket (chat, proof of work), opened full size on tap. */
export function PrivateImage({ fileRef, alt, className }) {
  const url = usePrivateFileUrl(fileRef)
  if (!url) return <span className={`private-image-loading ${className || ''}`} aria-label={alt} />
  return <a href={url} target="_blank" rel="noreferrer" className={className}><img src={url} alt={alt} loading="lazy" /></a>
}

/** "Pogledaj dokument" link for verification documents. */
export function PrivateFileLink({ fileRef, children, className }) {
  if (!isPrivateRef(fileRef)) return <a href={fileRef} target="_blank" rel="noreferrer" className={className}>{children}</a>
  return <button type="button" className={`link-button ${className || ''}`} onClick={() => openPrivateFile(fileRef)}>{children}</button>
}
