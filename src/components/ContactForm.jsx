import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { contactService } from '../services/contactService'

const CONTACT_TOPICS = [
  { value: 'account', label: 'Nalog i prijava' },
  { value: 'listing', label: 'Oglas ili ponuda' },
  { value: 'payment', label: 'Plaćanje i pretplata' },
  { value: 'report', label: 'Prijava zloupotrebe' },
  { value: 'business', label: 'Saradnja / firme' },
  { value: 'other', label: 'Nešto drugo' },
]

function ContactForm({ initialTopic = 'other' }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    topic: CONTACT_TOPICS.some((topic) => topic.value === initialTopic) ? initialTopic : 'other',
    message: '',
  })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      await contactService.send({ userId: user?.id || null, ...form })
      setSent(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return <div className="form-success">Hvala! Poruka je primljena — javljamo se na {form.email} u roku 24 sata.</div>
  }

  return (
    <form onSubmit={submit} className="auth-form contact-form">
      <div className="field-row">
        <div className="field"><input id="c-name" placeholder=" " value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><label htmlFor="c-name">Ime</label></div>
        <div className="field"><input id="c-email" type="email" placeholder=" " value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /><label htmlFor="c-email">Email</label></div>
      </div>
      <label className="verify-trade-select">
        Tema
        <select value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })}>
          {CONTACT_TOPICS.map((topic) => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
        </select>
      </label>
      <div className="field field-textarea">
        <textarea id="c-msg" placeholder=" " rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} required />
        <label htmlFor="c-msg">Poruka</label>
      </div>
      {error && <div className="form-error">{error}</div>}
      <button type="submit" className="primary-button" disabled={sending}>{sending ? 'Šaljem...' : 'Pošalji poruku'}</button>
    </form>
  )
}

export default ContactForm
