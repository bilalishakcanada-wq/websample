import { useEffect, useMemo, useRef, useState } from 'react'
import PushPrompt from '../components/PushPrompt'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Archive, ArchiveRestore, ArrowLeft, Check, CheckCheck, Flag, Heart, Lock, MessagesSquare, Search, Send, ShieldCheck, Unlock, UserRound, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { messageService } from '../services/messageService'
import { reportService } from '../services/reportService'
import { contactInfoMessage, scanChatMessage } from '../utils/moderation'
import { formatBosnianDate } from '../utils/dateFormat'

const FILTERS = [
  ['inbox', 'Inbox'],
  ['unread', 'Nepročitane'],
  ['saved', 'Spašene'],
  ['archived', 'Arhiva'],
]

const SAFETY_TIPS = [
  'Komunikaciju sa drugim korisnicima vršite isključivo kroz Poso.ba poruke — tako je sve zabilježeno ako nešto krene po zlu.',
  'Broj telefona i kontakt razmjenjujete tek kad je ponuda prihvaćena — do tada ih platforma automatski uklanja.',
  'Nikad ne plaćajte unaprijed van platforme i ne dijelite brojeve kartica ni lične dokumente.',
  'Oružje, droga, falsifikati i slično su zabranjeni — takve poruke se automatski uklanjaju, a nalog dobija opomenu.',
  'Sumnjivo ponašanje prijavite zastavicom u razgovoru — tim pregleda svaku prijavu.',
]

const timeOf = (value) => new Date(value).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })
const dayKey = (value) => new Date(value).toDateString()
const dayLabel = (value) => {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Danas'
  if (date.toDateString() === yesterday.toDateString()) return 'Jučer'
  return formatBosnianDate(value)
}
const shortDate = (value) => {
  const date = new Date(value)
  return date.toDateString() === new Date().toDateString() ? timeOf(value) : date.toLocaleDateString('bs-BA', { day: '2-digit', month: '2-digit' })
}

function Avatar({ src, name, size = 44 }) {
  return src
    ? <img src={src} alt="" className="chat-avatar" style={{ width: size, height: size }} />
    : <div className="chat-avatar chat-avatar-fallback" style={{ width: size, height: size }}>{(name || '?').charAt(0).toUpperCase()}</div>
}

function MessagesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [inbox, setInbox] = useState([])
  const [activeId, setActiveId] = useState(searchParams.get('c') || '')
  const [filter, setFilter] = useState('inbox')
  const [query, setQuery] = useState('')
  const [thread, setThread] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tipsOpen, setTipsOpen] = useState(() => { try { return localStorage.getItem('poso-chat-tips') !== 'hidden' } catch { return true } })
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const loadInbox = () => messageService.inbox().then(setInbox).catch((requestError) => setError(requestError.message))

  useEffect(() => {
    loadInbox().finally(() => setLoading(false))
  }, [])

  // any message to me refreshes the inbox (unread counts, ordering)
  useEffect(() => messageService.subscribeToMine(user.id, () => { loadInbox() }), [user.id])

  const active = inbox.find((item) => item.id === activeId)

  useEffect(() => {
    if (!activeId) return undefined
    let alive = true
    messageService.listMessages(activeId).then((rows) => {
      if (!alive) return
      setThread(rows)
      if (rows.some((row) => row.receiver_id === user.id && !row.read_at)) {
        messageService.markRead(activeId).then(loadInbox)
      }
    }).catch((requestError) => setError(requestError.message))
    const unsubscribe = messageService.subscribeToConversation(activeId, (row) => {
      setThread((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]))
      if (row.receiver_id === user.id) messageService.markRead(activeId).then(loadInbox)
    })
    return () => { alive = false; unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user.id])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread])

  const openConversation = (id) => {
    setActiveId(id)
    setError('')
    setNotice('')
    // opening a thread is a new history entry so the phone's back button returns to the inbox
    setSearchParams(id ? { c: id } : {}, { replace: !id })
  }

  // deep links (?c=…) from notifications while the page is already open, and the back button
  const paramId = searchParams.get('c') || ''
  useEffect(() => {
    if (paramId !== activeId) { setActiveId(paramId); setError(''); setNotice('') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return inbox.filter((item) => {
      if (filter === 'unread' && !(Number(item.unread) > 0)) return false
      if (filter === 'saved' && !item.saved) return false
      if (filter === 'archived') { if (!item.archived) return false } else if (item.archived) return false
      if (!needle) return true
      return `${item.other_name} ${item.listing_title || ''} ${item.last_message || ''}`.toLowerCase().includes(needle)
    })
  }, [inbox, filter, query])

  const unreadTotal = inbox.reduce((sum, item) => sum + Number(item.unread || 0), 0)

  const togglePref = async (item, key) => {
    try {
      await messageService.setPref(user.id, item.id, { [key]: !item[key] })
      setInbox((current) => current.map((row) => (row.id === item.id ? { ...row, [key]: !row[key] } : row)))
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const sendMessage = async (event) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || !active) return
    setError('')
    setNotice('')
    const scan = scanChatMessage(text, active.contacts_allowed)
    if (!scan.clean) {
      setError(scan.kinds.includes('prohibited')
        ? 'Ova poruka nije poslana: sadrži zabranjen sadržaj (oružje, droga, falsifikati i slično). Takve stvari se ne rade na Poso.ba.'
        : `${contactInfoMessage(scan, 'poruka')} Kontakt možete razmijeniti čim ponuda bude prihvaćena.`)
      return
    }
    try {
      const created = await messageService.send({ conversationId: active.id, senderId: user.id, receiverId: active.other_id, content: text })
      setThread((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]))
      if (created.content !== text) setNotice('Dio poruke je automatski uklonjen (Pravilo #1).')
      setDraft('')
      inputRef.current?.focus()
      loadInbox()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage() }
  }

  const reportConversation = async () => {
    if (!active) return
    const reason = window.prompt('Šta nije u redu u ovom razgovoru? (npr. prevara, uznemiravanje, zabranjen sadržaj)')
    if (!reason) return
    try {
      await reportService.createReport({ reporterId: user.id, targetType: 'conversation', targetId: active.id, reason })
      setNotice('Hvala — prijava je poslana našem timu.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const hideTips = () => { setTipsOpen(false); try { localStorage.setItem('poso-chat-tips', 'hidden') } catch { /* ignore */ } }

  // group the thread by day for separators
  const grouped = useMemo(() => {
    const groups = []
    for (const item of thread) {
      const key = dayKey(item.created_at)
      const last = groups[groups.length - 1]
      if (last && last.key === key) last.items.push(item)
      else groups.push({ key, label: dayLabel(item.created_at), items: [item] })
    }
    return groups
  }, [thread])
  const lastOwnRead = [...thread].reverse().find((item) => item.sender_id === user.id && item.read_at)

  return (
    <div className={`app-shell page-with-mobile-nav chat-page ${active ? 'has-active' : ''}`}>
      <main className="content-container">
        <div className="chat-topline">
          <h1>Poruke</h1>
          {unreadTotal > 0 && <span className="chat-unread-total">{unreadTotal} nepročitan{unreadTotal === 1 ? 'a' : 'ih'}</span>}
        </div>

        {!active && <PushPrompt compact reason="Javit ćemo ti kad stigne nova poruka." />}

        <div className={`chat-layout ${active ? 'has-active' : ''}`}>
          <aside className="chat-sidebar">
            <label className="chat-search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pretraži poruke" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Obriši"><X size={14} /></button>}
            </label>
            <div className="chat-filters">
              {FILTERS.map(([id, label]) => (
                <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
                  {label}{id === 'unread' && unreadTotal > 0 && <span className="chat-filter-count">{unreadTotal}</span>}
                </button>
              ))}
            </div>
            <div className="chat-list">
              {loading && <div className="page-state">Učitavanje...</div>}
              {!loading && visible.length === 0 && (
                <div className="chat-list-empty">
                  <MessagesSquare size={26} />
                  <p>{inbox.length === 0 ? 'Još nema razgovora. Otvore se čim neka ponuda bude prihvaćena.' : 'Nema poruka za ovaj filter.'}</p>
                </div>
              )}
              {visible.map((item) => (
                <div key={item.id} className={`chat-list-item ${activeId === item.id ? 'active' : ''} ${Number(item.unread) > 0 ? 'unread' : ''}`}>
                  <button type="button" className="chat-list-main" onClick={() => openConversation(item.id)}>
                    <Avatar src={item.other_avatar} name={item.other_name} />
                    <span className="chat-list-text">
                      <span className="chat-list-row"><strong>{item.other_name}</strong><time>{shortDate(item.last_at)}</time></span>
                      {item.listing_title && <span className="chat-list-listing">{item.listing_title}</span>}
                      <span className="chat-list-preview">{item.last_sender === user.id ? 'Vi: ' : ''}{item.last_message || 'Razgovor je otvoren'}</span>
                    </span>
                    {Number(item.unread) > 0 && <span className="chat-list-badge">{item.unread}</span>}
                  </button>
                  <button type="button" className={`chat-list-save ${item.saved ? 'on' : ''}`} onClick={() => togglePref(item, 'saved')} aria-label={item.saved ? 'Ukloni iz spašenih' : 'Spasi razgovor'} title={item.saved ? 'Ukloni iz spašenih' : 'Spasi razgovor'}>
                    <Heart size={16} fill={item.saved ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section className="chat-main">
            {!active ? (
              <div className="chat-welcome">
                {tipsOpen && (
                  <div className="chat-safety-banner">
                    <div>
                      <strong>Kako prepoznati prevaru i sigurno sarađivati?</strong>
                      <p>Ne dijelite lične podatke ni brojeve kartica, ne otvarajte sumnjive linkove, a sav dogovor vodite kroz Poso.ba poruke. <Link to="/pravila-zajednice#pravilo-1">Saznaj više</Link></p>
                    </div>
                    <button type="button" onClick={hideTips} aria-label="Zatvori"><X size={18} /></button>
                  </div>
                )}
                <div className="chat-safety-card">
                  <h3><ShieldCheck size={18} /> Savjeti za sigurnu saradnju</h3>
                  <ul>{SAFETY_TIPS.map((tip) => <li key={tip}>{tip}</li>)}</ul>
                  <Link to="/pravila-zajednice">Više o sigurnosti</Link>
                </div>
                <div className="chat-welcome-empty">
                  <div className="chat-welcome-art"><MessagesSquare size={40} /></div>
                  <strong>Odaberite razgovor za detaljni pregled</strong>
                </div>
              </div>
            ) : (
              <>
                <header className="chat-head">
                  <button type="button" className="chat-back" onClick={() => openConversation('')} aria-label="Nazad na listu"><ArrowLeft size={18} /></button>
                  <Link to={`/korisnik/${active.other_id}`} className="chat-head-person" title="Pogledaj javni profil">
                    <Avatar src={active.other_avatar} name={active.other_name} size={40} />
                    <span>
                      <strong>{active.other_name}</strong>
                      <small>{active.listing_title || 'Razgovor'} · {active.other_type === 'client' ? 'klijent' : 'izvođač'}</small>
                    </span>
                  </Link>
                  <span className={`chat-contact-state ${active.contacts_allowed ? 'open' : ''}`} title={active.contacts_allowed ? 'Ponuda je prihvaćena' : 'Kontakt se otključava kad klijent prihvati ponudu'}>
                    {active.contacts_allowed ? <><Unlock size={13} /> Kontakt otključan</> : <><Lock size={13} /> Kontakt zaštićen</>}
                  </span>
                  <div className="chat-head-actions">
                    <button type="button" className={active.saved ? 'on' : ''} onClick={() => togglePref(active, 'saved')} title={active.saved ? 'Ukloni iz spašenih' : 'Spasi'}><Heart size={16} fill={active.saved ? 'currentColor' : 'none'} /></button>
                    <button type="button" onClick={() => togglePref(active, 'archived')} title={active.archived ? 'Vrati iz arhive' : 'Arhiviraj'}>{active.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</button>
                    <button type="button" onClick={reportConversation} title="Prijavi razgovor"><Flag size={16} /></button>
                  </div>
                </header>

                <div className="chat-thread" ref={listRef}>
                  {thread.length === 0 && (
                    <div className="chat-thread-intro">
                      <UserRound size={22} />
                      <p>Ovo je početak vašeg razgovora sa <strong>{active.other_name}</strong>. Budite konkretni: šta, kada i gdje.</p>
                    </div>
                  )}
                  {grouped.map((group) => (
                    <div key={group.key} className="chat-day">
                      <span className="chat-day-label">{group.label}</span>
                      {group.items.map((item) => {
                        const mine = item.sender_id === user.id
                        return (
                          <div key={item.id} className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                            <p>{item.content}</p>
                            <span className="chat-bubble-meta">
                              {timeOf(item.created_at)}
                              {mine && (item.read_at ? <CheckCheck size={13} className="seen" /> : <Check size={13} />)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  {lastOwnRead && <div className="chat-seen-note">Pročitano {timeOf(lastOwnRead.read_at)}</div>}
                </div>

                {error && <div className="form-error chat-alert">{error}</div>}
                {notice && <div className="form-success chat-alert">{notice}</div>}

                <form className="chat-composer" onSubmit={sendMessage}>
                  <textarea
                    ref={inputRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={active.contacts_allowed ? 'Napišite poruku…' : 'Napišite poruku… (bez brojeva i kontakata do prihvaćene ponude)'}
                    rows={1}
                    maxLength={2000}
                  />
                  <button type="submit" className="chat-send" aria-label="Pošalji" disabled={!draft.trim()}><Send size={18} /></button>
                </form>
                <p className="chat-composer-hint"><ShieldCheck size={12} /> Enter šalje, Shift+Enter novi red. Poruke se automatski provjeravaju (Pravilo #1 i zabranjen sadržaj).</p>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default MessagesPage
