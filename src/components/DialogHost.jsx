import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { registerDialogHost } from '../utils/dialog'
import { useBackToClose } from '../hooks/useBackToClose'

/**
 * Renders the dialogs requested through utils/dialog.js: one at a time, as a bottom sheet on
 * phones (slides up, drag-handle, big touch targets) and a centred card on wider screens.
 * Escape / backdrop / the phone back button dismiss (= cancel).
 */
function DialogHost() {
  const [dialog, setDialog] = useState(null)
  const [value, setValue] = useState('')
  const [closing, setClosing] = useState(false)
  const inputRef = useRef(null)
  const closeTimer = useRef(0)

  useEffect(() => registerDialogHost((request) => {
    window.clearTimeout(closeTimer.current)
    setClosing(false)
    setValue(request.defaultValue || '')
    setDialog(request)
  }), [])
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])
  useBackToClose(Boolean(dialog) && !closing, () => dismiss())

  useEffect(() => {
    if (!dialog || closing) return undefined
    const onKey = (event) => { if (event.key === 'Escape') dismiss() }
    document.addEventListener('keydown', onKey)
    const timer = window.setTimeout(() => (inputRef.current || document.querySelector('.dlg-confirm'))?.focus?.(), 60)
    return () => { document.removeEventListener('keydown', onKey); window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, closing])

  // resolve right away, then let the sheet/card play its way out before unmounting
  const close = (result) => {
    if (!dialog || closing) return
    dialog.resolve(result)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setClosing(true)
    closeTimer.current = window.setTimeout(() => { setDialog(null); setClosing(false) }, reduce ? 0 : 200)
  }
  const dismiss = () => close(dialog?.kind === 'confirm' ? false : null)

  if (!dialog) return null
  const isPrompt = dialog.kind === 'prompt'
  const canSubmit = !isPrompt || dialog.options || !dialog.required || value.trim().length > 0

  return (
    <div className={`dlg-backdrop ${closing ? 'is-closing' : ''}`} inert={closing || undefined} onClick={dismiss} role="presentation">
      <div className={`dlg ${dialog.danger ? 'is-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dlg-title" onClick={(event) => event.stopPropagation()}>
        <span className="dlg-handle" aria-hidden="true" />
        {dialog.danger && <span className="dlg-icon"><AlertTriangle size={22} /></span>}
        <h2 id="dlg-title">{dialog.title}</h2>
        {dialog.text && <p>{dialog.text}</p>}

        {isPrompt && dialog.options && (
          <div className="dlg-options" role="listbox">
            {dialog.options.map((option) => (
              <button key={option.value} type="button" role="option" aria-selected={false} className="dlg-option" onClick={() => close(option.value)}>
                <span><strong>{option.label}</strong>{option.hint && <small>{option.hint}</small>}</span>
                <Check size={18} />
              </button>
            ))}
          </div>
        )}
        {isPrompt && !dialog.options && (
          dialog.multiline
            ? <textarea ref={inputRef} className="dlg-input" rows={3} value={value} onChange={(event) => setValue(event.target.value)} placeholder={dialog.placeholder} maxLength={1000} />
            : <input ref={inputRef} className="dlg-input" value={value} onChange={(event) => setValue(event.target.value)} placeholder={dialog.placeholder} maxLength={200} onKeyDown={(event) => { if (event.key === 'Enter' && canSubmit) close(value.trim()) }} />
        )}

        <div className="dlg-actions">
          {!(isPrompt && dialog.options) && (
            <button type="button" className={`dlg-confirm ${dialog.danger ? 'is-danger' : ''}`} disabled={!canSubmit} onClick={() => close(isPrompt ? value.trim() : true)}>{dialog.confirmLabel}</button>
          )}
          <button type="button" className="dlg-cancel" onClick={dismiss}>{dialog.cancelLabel}</button>
        </div>
      </div>
    </div>
  )
}

export default DialogHost
