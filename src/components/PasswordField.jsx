import { useState } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'

const RULES = [
  ['Najmanje 8 znakova', (value) => value.length >= 8],
  ['Veliko slovo', (value) => /[A-Z]/.test(value)],
  ['Malo slovo', (value) => /[a-z]/.test(value)],
  ['Broj', (value) => /\d/.test(value)],
]

/**
 * Password input with a show/hide eye (typos on a phone keyboard are the #1 failed login) and,
 * for new passwords, the rules ticking off live instead of a line of small print.
 */
function PasswordField({ id = 'password', name, label, value, onChange, isNew = false }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="field field-password">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        placeholder=" "
        value={value}
        onChange={onChange}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
      />
      <label htmlFor={id}>{label}</label>
      <button type="button" className="field-eye" onClick={() => setVisible((shown) => !shown)} aria-label={visible ? 'Sakrij lozinku' : 'Prikaži lozinku'} aria-pressed={visible}>
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      {isNew && (
        <ul className="pw-rules" aria-label="Uslovi za lozinku">
          {RULES.map(([text, test]) => {
            const ok = test(value || '')
            return <li key={text} className={ok ? 'ok' : ''}><Check size={13} aria-hidden="true" />{text}</li>
          })}
        </ul>
      )}
    </div>
  )
}

export default PasswordField
