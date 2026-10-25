import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Lock, MessageSquareText, Pencil, Phone, X } from 'lucide-react'
import { useBackToClose } from '../hooks/useBackToClose'
import { accountService } from '../services/accountService'
import { digitsOnly, formatBosnianPhone } from '../utils/phone'
import { haptic } from '../utils/native'
import './PhoneVerify.css'

const CODE_LENGTH = 6
const RESEND_SECONDS = 60

// "061 234 567" / "+387 61 234 567" / "38761234567" -> "61 234 567" (the part after +387)
const nationalPart = (value) => formatBosnianPhone(value).replace(/^(\+387 ?|0)/, '')
const isMobile = (value) => /^6\d{7,8}$/.test(digitsOnly(nationalPart(value)))
const toE164 = (value) => `+387${digitsOnly(nationalPart(value))}`
const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/**
 * Potvrda broja telefona kao na WhatsAppu: upiši broj, stiže SMS sa 6 cifara, upiši kod.
 * Centrirano na računaru, list odozdo na telefonu. Escape, dodir pored ili "nazad" zatvara.
 */
function PhoneVerify({ initialPhone = '', onClose, onVerified }) {
  const [step, setStep] = useState('number') // number | code | done
  const [number, setNumber] = useState(nationalPart(initialPhone))
  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(0)
  const boxes = useRef([])
  const checking = useRef(false)
  const numberRef = useRef(null)
  useBackToClose(true, onClose)

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (step === 'number') numberRef.current?.focus()
  }, [step])

  // na ekranu za kod, kad polja opet rade (novi kod ili pogrešan pokušaj), kursor je u prvom
  useEffect(() => {
    if (step === 'code' && !busy && digits.every((digit) => !digit)) boxes.current[0]?.focus()
  }, [step, busy, digits])

  useEffect(() => {
    if (wait <= 0) return undefined
    const timer = window.setTimeout(() => setWait((left) => left - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const send = async () => {
    setError('')
    if (!isMobile(number)) { setError('Upiši broj mobitela, npr. 61 234 567.'); return }
    setBusy(true)
    try {
      await accountService.sendPhoneCode(toE164(number))
      setDigits(Array(CODE_LENGTH).fill(''))
      setWait(RESEND_SECONDS)
      setStep('code')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const check = async (code) => {
    // kod se provjerava jednom: drugi poziv bi istrošeni kod prijavio kao pogrešan
    if (checking.current) return
    checking.current = true
    setError('')
    setBusy(true)
    try {
      await accountService.verifyPhoneCode(toE164(number), code)
      haptic('heavy')
      setStep('done')
      onVerified?.()
    } catch (requestError) {
      // dvostruki trzaj za pogrešan kod
      haptic('medium')
      window.setTimeout(() => haptic('medium'), 160)
      setError(requestError.message)
      setDigits(Array(CODE_LENGTH).fill(''))
    } finally {
      checking.current = false
      setBusy(false)
    }
  }

  // upiši cifre od polja `from` dalje (jedna cifra ili cijeli zalijepljen kod), pa idi na sljedeće prazno
  const fill = (from, text) => {
    const incoming = digitsOnly(text)
    if (!incoming) return
    const next = [...digits]
    // SMS autofill / lijepljenje daje cijeli kod: kreni od prvog polja
    const start = incoming.length >= CODE_LENGTH ? 0 : from
    incoming.slice(0, CODE_LENGTH - start).split('').forEach((digit, index) => { next[start + index] = digit })
    setDigits(next)
    setError('')
    const firstEmpty = next.findIndex((digit) => !digit)
    if (firstEmpty === -1) {
      boxes.current[CODE_LENGTH - 1]?.blur()
      check(next.join(''))
    } else {
      boxes.current[Math.max(firstEmpty, Math.min(start + incoming.length, CODE_LENGTH - 1))]?.focus()
    }
  }

  // Chrome na Androidu sam pročita kod iz SMS-a (zadnji red poruke: "@domena #123456") i upiše ga
  useEffect(() => {
    if (step !== 'code' || !('OTPCredential' in window)) return undefined
    const abort = new AbortController()
    navigator.credentials.get({ otp: { transport: ['sms'] }, signal: abort.signal })
      .then((otp) => { if (otp?.code) fill(0, otp.code) })
      .catch(() => { /* zatvoreno ili odbijeno: upisuje se rukom */ })
    return () => abort.abort()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = (index) => (event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      const next = [...digits]
      next[index - 1] = ''
      setDigits(next)
      boxes.current[index - 1]?.focus()
    } else if (event.key === 'ArrowLeft' && index > 0) boxes.current[index - 1]?.focus()
    else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus()
  }

  const onChange = (index) => (event) => {
    const value = event.target.value
    if (!value) {
      const next = [...digits]
      next[index] = ''
      setDigits(next)
      return
    }
    // polje već ima cifru: nova je zadnja upisana
    fill(index, digits[index] && value.length > 1 && value.length < CODE_LENGTH ? value.slice(-1) : value)
  }

  const changeNumber = () => { setStep('number'); setError(''); setDigits(Array(CODE_LENGTH).fill('')) }

  return createPortal(
    <div className="pv-backdrop" role="presentation" onClick={onClose}>
      <div className="pv-sheet" role="dialog" aria-modal="true" aria-labelledby="pv-title" onClick={(event) => event.stopPropagation()}>
        <span className="pv-handle" aria-hidden="true" />
        {step === 'code'
          ? <button type="button" className="pv-corner pv-back" onClick={changeNumber} aria-label="Nazad na broj"><ArrowLeft size={18} /></button>
          : null}
        <button type="button" className="pv-corner pv-close" onClick={onClose} aria-label="Zatvori"><X size={18} /></button>

        {step === 'number' && (
          <form className="pv-body" onSubmit={(event) => { event.preventDefault(); send() }}>
            <span className="pv-icon" aria-hidden="true"><MessageSquareText size={26} /></span>
            <h2 id="pv-title">Potvrdi broj telefona</h2>
            <p>Poslaćemo ti SMS sa kodom od 6 cifara.</p>
            <label className="pv-number">
              <span className="pv-prefix" aria-hidden="true"><span className="pv-flag">🇧🇦</span>+387</span>
              <input
                ref={numberRef}
                value={number}
                onChange={(event) => { setNumber(nationalPart(event.target.value)); setError('') }}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="61 234 567"
                aria-label="Broj mobitela"
                data-testid="phone-verify-number"
              />
            </label>
            {error && <div className="pv-error" role="alert">{error}</div>}
            <button type="submit" className="primary-button pv-main" disabled={busy || !digitsOnly(number)} data-testid="phone-verify-send"
              // tastatura ostaje otvorena, pa se na telefonu odmah pređe na polja za kod
              onMouseDown={(event) => event.preventDefault()}>
              {busy ? 'Šaljem…' : 'Pošalji kod'}
            </button>
            <span className="pv-private"><Lock size={13} /> Broj ostaje privatan. Ne prikazujemo ga drugima.</span>
          </form>
        )}

        {step === 'code' && (
          <div className="pv-body">
            <span className="pv-icon" aria-hidden="true"><MessageSquareText size={26} /></span>
            <h2 id="pv-title">Upiši kod iz SMS-a</h2>
            <p>Poslali smo kod od 6 cifara na</p>
            <button type="button" className="pv-number-chip" onClick={changeNumber} aria-label="Promijeni broj">
              +387 {number} <Pencil size={14} />
            </button>
            <div className={`pv-code${error ? ' is-wrong' : ''}${busy ? ' is-busy' : ''}`} role="group" aria-label="Kod iz SMS-a">
              {digits.map((digit, index) => (
                <input
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  ref={(element) => { boxes.current[index] = element }}
                  value={digit}
                  className={digit ? 'is-filled' : ''}
                  onChange={onChange(index)}
                  onKeyDown={onKeyDown(index)}
                  onPaste={(event) => { event.preventDefault(); fill(index, event.clipboardData.getData('text')) }}
                  onFocus={(event) => event.target.select()}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={index === 0 ? CODE_LENGTH : 2}
                  // readOnly, ne disabled: tastatura na telefonu se ne zatvara dok se kod provjerava
                  readOnly={busy}
                  aria-label={`Cifra ${index + 1} od ${CODE_LENGTH}`}
                  data-testid={`phone-verify-digit-${index}`}
                />
              ))}
            </div>
            {busy && <div className="pv-status">Provjeravam…</div>}
            {error && <div className="pv-error" role="alert">{error}</div>}
            {wait > 0
              ? <div className="pv-status">Novi kod možeš tražiti za {clock(wait)}</div>
              : <button type="button" className="pv-link pv-resend" onClick={send} disabled={busy}>Pošalji kod ponovo</button>}
          </div>
        )}

        {step === 'done' && (
          <div className="pv-body">
            <span className="pv-done-mark" aria-hidden="true">
              <span className="pv-done-ring" />
              <svg viewBox="0 0 52 52"><path d="M14 27 l8 8 l16 -18" /></svg>
            </span>
            <h2 id="pv-title">Broj je potvrđen</h2>
            <p><strong>+387 {number}</strong> je sada verifikovan.</p>
            <span className="pv-badge"><Phone size={15} strokeWidth={2.6} /> Telefon verifikovan</span>
            <button type="button" className="primary-button pv-main" onClick={onClose}>Gotovo</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default PhoneVerify
