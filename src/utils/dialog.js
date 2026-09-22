/**
 * App-styled confirm / prompt dialogs (a bottom sheet on phones, a centred card on desktop) in
 * place of the browser's native ones. Promise-based so call sites read like `if (await confirmDialog(…))`.
 * If no host is mounted (very early boot), the native dialogs are the fallback.
 */
let host = null

export function registerDialogHost(fn) {
  host = fn
  return () => { if (host === fn) host = null }
}

/** @returns {Promise<boolean>} */
export function confirmDialog({ title, text = '', confirmLabel = 'Potvrdi', cancelLabel = 'Odustani', danger = false } = {}) {
  if (!host) return Promise.resolve(window.confirm([title, text].filter(Boolean).join('\n\n')))
  return new Promise((resolve) => host({ kind: 'confirm', title, text, confirmLabel, cancelLabel, danger, resolve }))
}

/**
 * Free text, or a pick from `options` ([{ value, label, hint? }]).
 * @returns {Promise<string|null>} null when dismissed
 */
export function promptDialog({ title, text = '', placeholder = '', defaultValue = '', options = null, confirmLabel = 'Pošalji', cancelLabel = 'Odustani', required = true, multiline = true } = {}) {
  if (!host) {
    const answer = window.prompt([title, text].filter(Boolean).join('\n\n'), defaultValue)
    return Promise.resolve(answer)
  }
  return new Promise((resolve) => host({ kind: 'prompt', title, text, placeholder, defaultValue, options, confirmLabel, cancelLabel, required, multiline, resolve }))
}
