import { isPrivateRef, openPrivateFile, usePrivateFile } from '../lib/privateFiles'

/** A photo from the private bucket (chat, proof of work) or an old public link, opened full size on tap. */
export function PrivateImage({ fileRef, alt, className }) {
  const { url, failed } = usePrivateFile(fileRef)
  if (failed) return <span className={`private-image-missing ${className || ''}`}>Slika nije dostupna</span>
  if (!url) return <span className={`private-image-loading ${className || ''}`} role="img" aria-label={alt} />
  return <a href={url} target="_blank" rel="noreferrer" className={className}><img src={url} alt={alt} loading="lazy" /></a>
}

/** "Pogledaj dokument" link for verification documents. */
export function PrivateFileLink({ fileRef, children, className }) {
  if (!isPrivateRef(fileRef)) return <a href={fileRef} target="_blank" rel="noreferrer" className={className}>{children}</a>
  return <button type="button" className={`private-file-link ${className || ''}`} onClick={() => openPrivateFile(fileRef)}>{children}</button>
}
