/**
 * A read that failed, said as such ("nije se učitalo") with a way to try again, instead of an empty
 * state that tells the person there is nothing there.
 */
function LoadFailed({ title = 'Nije se učitalo', text = 'Provjeri internet i pokušaj ponovo.', onRetry, className = 'ap-empty' }) {
  return (
    <div className={`${className} load-failed`} role="alert">
      <strong>{title}</strong>
      <span>{text}</span>
      {onRetry && <button type="button" className="ap-btn ap-btn-primary ap-btn-inline" onClick={onRetry}>Pokušaj ponovo</button>}
    </div>
  )
}

export default LoadFailed
