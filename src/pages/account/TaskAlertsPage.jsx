import { useEffect, useState } from 'react'
import { BellPlus, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { alertService } from '../../services/alertService'
import { serviceCategories } from '../../data/categories'
import { POPULAR_CITIES } from '../../data/siteMap'
import { toast } from '../../components/Toaster'
import { SkeletonList } from '../../components/Skeleton'

const RADIUS = [10, 25, 50, 100]
const EMPTY = { category: '', city: '', keyword: '', radiusKm: '25', mode: 'all' }
const MODE_LABEL = { in_person: 'samo na licu mjesta', remote: 'samo online' }

/** "Sarajevo, do 25 km" / "Cijela BiH · samo online" */
const alertPlace = (alert) => {
  const place = alert.mode === 'remote' ? 'Online' : alert.city ? `${alert.city}${alert.radius_km ? `, do ${alert.radius_km} km` : ''}` : 'Cijela BiH'
  return alert.mode && alert.mode !== 'all' && alert.mode !== 'remote' ? `${place} · ${MODE_LABEL[alert.mode]}` : place
}

/** "Alarmi za poslove": be the first to know when a matching job is posted (place + distance, like Airtasker). */
function TaskAlertsPage() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    alertService.listMine().then(setAlerts).catch((requestError) => { setError(requestError.message); setAlerts([]) })
  }, [])

  const add = async (event) => {
    event.preventDefault()
    if (!form.category && !form.city && !form.keyword.trim()) { setError('Odaberi bar kategoriju, grad ili ključnu riječ.'); return }
    setBusy(true); setError('')
    try {
      const created = await alertService.create({ userId: user.id, ...form })
      setAlerts((current) => [created, ...(current || [])])
      setForm(EMPTY)
      toast('Alarm je uključen — javit ćemo ti čim se pojavi takav posao.', { kind: 'success' })
    } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  const remove = async (id) => {
    try { await alertService.remove(id); setAlerts((current) => current.filter((item) => item.id !== id)) } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Alarmi za poslove</h1></div>
      <p className="muted-text">Budi prvi koji sazna: kad se objavi posao koji odgovara alarmu, stiže ti obavijest (i push, ako je uključen).</p>

      <form className="alert-form" onSubmit={add}>
        <label><span>Kategorija</span>
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            <option value="">Sve kategorije</option>
            {serviceCategories.map(({ id, name }) => <option key={id} value={name}>{name}</option>)}
          </select>
        </label>
        <label><span>Grad</span>
          <select value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })}>
            <option value="">Cijela BiH</option>
            {POPULAR_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </label>
        {form.city && (
          <label><span>Udaljenost</span>
            <select value={form.radiusKm} onChange={(event) => setForm({ ...form, radiusKm: event.target.value })}>
              <option value="">Samo {form.city}</option>
              {RADIUS.map((km) => <option key={km} value={String(km)}>Do {km} km od mjesta {form.city}</option>)}
            </select>
          </label>
        )}
        <label><span>Gdje se radi</span>
          <select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}>
            <option value="all">Na licu mjesta i online</option>
            <option value="in_person">Samo na licu mjesta</option>
            <option value="remote">Samo online</option>
          </select>
        </label>
        <label><span>Ključna riječ (opciono)</span>
          <input value={form.keyword} maxLength={60} placeholder="npr. klima, laminat, selidba" onChange={(event) => setForm({ ...form, keyword: event.target.value })} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="primary-button" disabled={busy}><BellPlus size={16} /> {busy ? 'Čuvam…' : 'Dodaj alarm'}</button>
      </form>

      <h3 className="account-sub">Tvoji alarmi</h3>
      {alerts === null && <SkeletonList n={2} h={64} />}
      {alerts && alerts.length === 0 && <p className="muted-text">Još nemaš alarma.</p>}
      <div className="alert-list">
        {(alerts || []).map((alert) => (
          <div key={alert.id} className="alert-row">
            <div>
              <strong>{alert.category || 'Sve kategorije'}</strong>
              <span>{alertPlace(alert)}{alert.keyword ? ` · „${alert.keyword}“` : ''}</span>
            </div>
            <button type="button" className="icon-button" onClick={() => remove(alert.id)} aria-label="Obriši alarm"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TaskAlertsPage
