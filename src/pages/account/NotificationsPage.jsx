import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { keys, useNotifications } from '../../hooks/queries'
import { Link, useSearchParams } from 'react-router-dom'
import { MailMascot } from '../../app/Mascots'
import { notificationService } from '../../services/notificationService'
import { NOTIF_CATEGORIES, groupByDay, notificationCategory } from '../../utils/notificationCategory'
import NotificationCard from '../../components/NotificationCard'
import { SkeletonNotifRow } from '../../components/Skeleton'

function NotificationsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const query = useNotifications(user?.id, 50)
  const items = query.isPending ? null : (query.data || [])
  const [params, setParams] = useSearchParams()
  const filter = NOTIF_CATEGORIES.some((c) => c.key === params.get('vrsta')) ? params.get('vrsta') : 'all'
  // rows that were unread when they reached this screen keep their "new" look for this visit,
  // even though opening the page marks them read right away
  const [fresh, setFresh] = useState(() => new Set())

  useEffect(() => {
    const unread = (query.data || []).filter((row) => !row.read_at).map((row) => row.id)
    if (!unread.length) return
    notificationService.markRead(unread).then(() => {
      setFresh((current) => new Set([...current, ...unread]))
      queryClient.setQueryData([...keys.notifications(user?.id), 50], (rows) => (rows || []).map((row) => (unread.includes(row.id) ? { ...row, read_at: row.read_at || new Date().toISOString() } : row)))
      queryClient.invalidateQueries({ queryKey: keys.unreadNotifications(user?.id) })
    })
  }, [query.data, queryClient, user?.id])

  const isNew = (item) => !item.read_at || fresh.has(item.id)
  const counts = useMemo(() => {
    const result = {}
    for (const item of query.data || []) {
      if (item.read_at && !fresh.has(item.id)) continue
      const category = notificationCategory(item)
      result[category] = (result[category] || 0) + 1
      result.all = (result.all || 0) + 1
    }
    return result
  }, [query.data, fresh])
  const groups = useMemo(() => groupByDay((query.data || []).filter((item) => filter === 'all' || notificationCategory(item) === filter)), [query.data, filter])

  const pick = (key) => {
    const next = new URLSearchParams(params)
    if (key === 'all') next.delete('vrsta')
    else next.set('vrsta', key)
    setParams(next, { replace: true })
  }

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Obavijesti</h1></div>
      {items?.length !== 0 && (
        <div className="notif-filters" role="tablist" aria-label="Vrsta obavijesti">
          {NOTIF_CATEGORIES.map((category) => (
            <button key={category.key} type="button" role="tab" aria-selected={filter === category.key} className={`notif-pill${filter === category.key ? ' is-active' : ''}`} onClick={() => pick(category.key)}>
              {category.label}
              {counts[category.key] > 0 && <span className="notif-pill-count">{counts[category.key]}</span>}
            </button>
          ))}
        </div>
      )}
      {items === null && <ul className="notif-list">{[1, 2, 3, 4].map((i) => <SkeletonNotifRow key={i} />)}</ul>}
      {items?.length === 0 && (
        <div className="account-empty">
          <div className="account-empty-art notif-art"><MailMascot /></div>
          <p>Ovdje ćemo te obavještavati o poslovima, ponudama, porukama i značkama.<br />Hajde — objavi posao ili pošalji ponudu!</p>
          <div className="account-empty-actions">
            <Link to="/objavi" className="primary-button">Objavi posao</Link>
            <Link to="/search" className="ghost-button">Pregledaj poslove</Link>
          </div>
        </div>
      )}
      {items?.length > 0 && groups.length === 0 && (
        <p className="notif-filter-empty">Nema obavijesti u ovoj grupi. <button type="button" className="ghost-button" onClick={() => pick('all')}>Prikaži sve</button></p>
      )}
      {groups.map((group) => (
        <section key={group.key} className="notif-group" aria-label={group.label}>
          <h2 className="notif-group-head">{group.label}</h2>
          <ul className="notif-list">
            {group.items.map((item) => <NotificationCard key={item.id} item={item} unread={isNew(item)} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default NotificationsPage
