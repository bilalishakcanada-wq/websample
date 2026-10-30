import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { CONTACT_TOPICS } from '../../data/contactTopics'
import { contactService } from '../../services/contactService'
import { formatBosnianDate } from '../../utils/dateFormat'

const topicLabel = (value) => CONTACT_TOPICS.find((topic) => topic.value === value)?.label || value

/** Admin: what people wrote on the Kontakt page. Reply goes by email to the address they gave. */
function ContactInbox() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = () => contactService.listForAdmin().then(setRows).catch((requestError) => setError(requestError.message))
  useEffect(() => { load() }, [])

  const toggle = async (row) => {
    setError('')
    try {
      await contactService.setStatus(row.id, row.status === 'open' ? 'answered' : 'open')
      load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!rows && !error) return null
  const open = (rows || []).filter((row) => row.status === 'open').length

  return (
    <section className="dossier-card contact-inbox">
      <h3><Mail size={16} /> Kontakt stranica {open > 0 && <span className="tag">{open} novo</span>}</h3>
      <p className="muted-text">Poruke sa stranice Kontakt. Odgovori na email koji je osoba upisala, pa označi kao odgovoreno.</p>
      {error && <p className="form-error">{error}</p>}
      {rows?.length === 0 && <p className="muted-text">Još nema poruka sa Kontakt stranice.</p>}
      {rows?.map((row) => (
        <article key={row.id} className={`contact-inbox-item ${row.status === 'open' ? 'is-open' : ''}`}>
          <div className="contact-inbox-head">
            <strong>{row.name}</strong>
            <a href={`mailto:${row.email}?subject=${encodeURIComponent('Odgovor od Zadatka')}`}>{row.email}</a>
            <small className="muted-text">{topicLabel(row.topic)} · {formatBosnianDate(row.created_at)}</small>
          </div>
          <p>{row.message}</p>
          <button type="button" className="ghost-button small-button" onClick={() => toggle(row)}>
            {row.status === 'open' ? 'Označi kao odgovoreno' : 'Vrati u nove'}
          </button>
        </article>
      ))}
    </section>
  )
}

export default ContactInbox
