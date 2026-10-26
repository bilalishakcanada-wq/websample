import { PrivateImage } from '../components/PrivateFile'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import PushPrompt from '../components/PushPrompt'
import { MailMascot } from '../app/Mascots'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { keys, useInbox, useThread } from '../hooks/queries'
import {
  Archive, ArchiveRestore, ArrowLeft, Ban, BriefcaseBusiness, Check, CheckCheck, ChevronDown, ChevronRight, Flag, Heart, ImagePlus, Lock, MessagesSquare, Search, Send, ShieldCheck, Unlock, UserRound, X,
} from 'lucide-react'
import ChatStateNotice from '../components/ChatStateNotice'
import { jobStatus } from '../utils/jobStatus'
import { useAuth } from '../context/AuthContext'
import { messageService } from '../services/messageService'
import { reportService } from '../services/reportService'
import { contactInfoMessage, scanChatMessage } from '../utils/moderation'
import { formatBosnianDate } from '../utils/dateFormat'
import { useMediaQuery } from '../hooks/useMediaQuery'
import Chat from '../app/Chat'
import { SkeletonRows } from '../components/Skeleton'
import { promptDialog } from '../utils/dialog'
import { useBlocks } from '../hooks/useBlocks'
import { canGoBackInApp } from '../utils/backNav'
import LoadFailed from '../components/LoadFailed'
import { useSwitch } from '../hooks/useSwitches'

const FILTERS = [
  ['inbox', 'Inbox'],
  ['unread', 'Nepročitane'],
  ['saved', 'Spašene'],
  ['archived', 'Arhiva'],
]

const SAFETY_TIPS = [
  'Komunikaciju sa drugim korisnicima vršite isključivo kroz Zadatak poruke — tako je sve zabilježeno ako nešto krene po zlu.',
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
    ? <img loading="lazy" decoding="async" src={src} alt="" className="chat-avatar" style={{ width: size, height: size }} />
    : <div className="chat-avatar chat-avatar-fallback" style={{ width: size, height: size }}>{(name || '?').charAt(0).toUpperCase()}</div>
}

const EMPTY = []

// one unsent draft per conversation, kept on this device across restarts (like WhatsApp)
const draftsKey = (userId) => `zadatak-chat-drafts-${userId}`
const readDrafts = (userId) => { try { return JSON.parse(localStorage.getItem(draftsKey(userId)) || '{}') || {} } catch { return {} } }
const writeDrafts = (userId, drafts) => { try { localStorage.setItem(draftsKey(userId), JSON.stringify(drafts)) } catch { /* storage blocked */ } }
const growsByItself = typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content')

function MessagesPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  // inbox and the open thread live in the query cache: switching threads (or coming back to the
  // page) paints instantly; Realtime rows are appended straight into the cache
  const queryClient = useQueryClient()
  const inboxQuery = useInbox(user.id)
  const inbox = inboxQuery.data || EMPTY
  const setInbox = (next) => queryClient.setQueryData(keys.inbox(user.id), (current) => (typeof next === 'function' ? next(current || []) : next))
  const [activeId, setActiveId] = useState(searchParams.get('c') || '')
  const [filter, setFilter] = useState('inbox')
  const [query, setQuery] = useState('')
  const threadQuery = useThread(activeId)
  const thread = threadQuery.data || EMPTY
  const setThread = (next) => queryClient.setQueryData(keys.thread(activeId), (current) => (typeof next === 'function' ? next(current || []) : next))
  const draftsRef = useRef(null)
  if (draftsRef.current === null) draftsRef.current = readDrafts(user.id)
  const [draft, setDraft] = useState(() => draftsRef.current[activeId] || '')
  // switching conversations brings back what was typed for that person, never the other one's text
  const [draftFor, setDraftFor] = useState(activeId)
  if (draftFor !== activeId) { setDraftFor(activeId); setDraft(draftsRef.current[activeId] || '') }
  const loading = inboxQuery.isPending
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tipsOpen, setTipsOpen] = useState(() => { try { return localStorage.getItem('zadatak-chat-tips') !== 'hidden' } catch { return true } })
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const imageRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const isPhone = useMediaQuery('(max-width: 768px)')
  const touchKeyboard = useMediaQuery('(pointer: coarse)')

  const loadInbox = () => inboxQuery.refetch().then((result) => { if (result.error) setError(result.error.message); else setError('') })
  useEffect(() => { if (inboxQuery.error) setError(inboxQuery.error.message) }, [inboxQuery.error])

  // any message to me refreshes the inbox (unread counts, ordering): useUnreadMessages in the always-mounted
  // MobileNav already listens for that and invalidates keys.inbox, so no second channel here
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const markingRef = useRef(false)
  const [markTick, setMarkTick] = useState(0)

  const active = inbox.find((item) => item.id === activeId)
  const { isBlocked, toggle: toggleBlockUser } = useBlocks()
  const otherBlocked = Boolean(active && isBlocked(active.other_id))
  const chatState = otherBlocked ? 'blocked' : (active?.chat_state || 'open')
  const status = jobStatus(chatState, active?.contacts_allowed)

  // the thread arrives from the cache/query; unread rows addressed to me are marked read. One call at a time,
  // and the rows are patched locally: markRead's 'zadatak:messages-read' event already refreshes inbox + badge
  useEffect(() => {
    if (!activeId || !threadQuery.data || markingRef.current) return
    const ids = threadQuery.data.filter((row) => row.receiver_id === user.id && !row.read_at).map((row) => row.id)
    if (!ids.length) return
    markingRef.current = true
    const conversationId = activeId
    messageService.markRead(conversationId).then(() => {
      const now = new Date().toISOString()
      const marked = new Set(ids)
      queryClient.setQueryData(keys.thread(conversationId), (rows) => rows?.map((row) => (marked.has(row.id) && !row.read_at ? { ...row, read_at: now } : row)))
    }).finally(() => { markingRef.current = false; setMarkTick((n) => n + 1) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, threadQuery.data, user.id, markTick])
  useEffect(() => { if (threadQuery.error) setError(threadQuery.error.message) }, [threadQuery.error])
  useEffect(() => {
    if (!activeId) return undefined
    const unsubscribe = messageService.subscribeToConversation(activeId, (row) => {
      // appending changes the thread data, and the effect above marks it read
      queryClient.setQueryData(keys.thread(activeId), (current) => ((current || []).some((item) => item.id === row.id) ? current : [...(current || []), row]))
    })
    return () => { unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user.id])

  // "kuca…" while the other person types: their pings keep it on, it goes away 4 s after the last
  // one, when they send, or when their message lands
  const [otherTyping, setOtherTyping] = useState(false)
  const typingRef = useRef(null)
  useEffect(() => {
    setOtherTyping(false)
    if (!activeId) return undefined
    let timer
    const typing = messageService.typingChannel(activeId, user.id, (on) => {
      clearTimeout(timer)
      setOtherTyping(on)
      if (on) timer = setTimeout(() => setOtherTyping(false), 4000)
    })
    typingRef.current = typing
    return () => { clearTimeout(timer); typing.close(); typingRef.current = null }
  }, [activeId, user.id])
  const lastFromOther = thread.length > 0 && thread[thread.length - 1].sender_id !== user.id ? thread[thread.length - 1].id : ''
  useEffect(() => { if (lastFromOther) setOtherTyping(false) }, [lastFromOther])
  useEffect(() => { if (draft.trim()) typingRef.current?.ping() }, [draft])
  useEffect(() => {
    if (!activeId) return
    const drafts = draftsRef.current
    if ((drafts[activeId] || '') === draft) return
    if (draft) drafts[activeId] = draft
    else delete drafts[activeId]
    writeDrafts(user.id, drafts)
  }, [draft, activeId, user.id])
  // the box grows with the text up to its max height (iOS has no field-sizing yet)
  useLayoutEffect(() => {
    const el = inputRef.current
    if (growsByItself || !el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + 2, 120)}px`
  }, [draft, activeId])

  // Scrolling like WhatsApp: a conversation opens at its newest message; a new message scrolls into view
  // only when the person is already at the bottom (or sent it), otherwise a "Nove poruke" button appears,
  // so reading older messages is never interrupted
  const nearBottomRef = useRef(true)
  const scrolledForRef = useRef('')
  const [unseen, setUnseen] = useState(0)
  const lastId = thread.length ? thread[thread.length - 1].id : ''
  const onThreadScroll = () => {
    const el = listRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottomRef.current) setUnseen(0)
  }
  const jumpToEnd = () => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    nearBottomRef.current = true
    setUnseen(0)
  }
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el || !activeId) return
    if (scrolledForRef.current !== activeId) {
      if (!lastId) return
      scrolledForRef.current = activeId
      el.scrollTop = el.scrollHeight
      nearBottomRef.current = true
      setUnseen(0)
      return
    }
    const last = thread[thread.length - 1]
    if (!last) return
    if (nearBottomRef.current || last.sender_id === user.id) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    else setUnseen((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, activeId])
  useEffect(() => {
    if (otherTyping && nearBottomRef.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [otherTyping])
  // a photo that finishes loading makes its bubble taller: stay at the bottom if that is where the person was
  useEffect(() => {
    const el = listRef.current
    if (!el) return undefined
    const onLoad = (event) => { if (event.target.tagName === 'IMG' && nearBottomRef.current) el.scrollTop = el.scrollHeight }
    el.addEventListener('load', onLoad, true)
    return () => el.removeEventListener('load', onLoad, true)
  }, [activeId, isPhone])

  const openConversation = (id) => {
    const fromInbox = Boolean(location.state?.fromInbox)
    setError('')
    setNotice('')
    // closing a thread is a plain step back to whatever was open before it (the inbox, or the job
    // or profile it was opened from); only a thread opened straight from outside falls back to the inbox
    if (!id && (fromInbox || canGoBackInApp())) { navigate(-1); return }
    setActiveId(id)
    // opening a thread from the inbox is one new history entry (back returns to the inbox);
    // switching to another thread, or closing one that came from a link, replaces it
    if (id) setSearchParams({ c: id }, activeId ? { replace: true, state: { fromInbox } } : { state: { fromInbox: true } })
    else setSearchParams({}, { replace: true })
  }

  // "Otvori poruke" on a job: ?listing=… opens that job's thread as soon as the inbox is in
  const listingParam = searchParams.get('listing') || ''
  useEffect(() => {
    if (!listingParam || loading) return
    const row = inbox.find((item) => item.listing_id === listingParam)
    if (row) setSearchParams({ c: row.id }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingParam, loading, inbox])

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
    const flip = (value) => setInbox((current) => current.map((row) => (row.id === item.id ? { ...row, [key]: value } : row)))
    flip(!item[key])
    try {
      await messageService.setPref(user.id, item.id, { [key]: !item[key] })
    } catch (requestError) {
      flip(item[key])
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
        ? 'Ova poruka nije poslana: sadrži zabranjen sadržaj (oružje, droga, falsifikati i slično). Takve stvari se ne rade na Zadatku.'
        : `${contactInfoMessage(scan, 'poruka')} Kontakt možete razmijeniti čim ponuda bude prihvaćena.`)
      return
    }
    // a second tap or Enter while the first send is in flight would send the same message again
    if (sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    // optimistic: the bubble shows at once (marked pending); the stored row replaces it, or on failure
    // it is removed and the text goes back into the composer so nothing typed is lost
    const tempId = `pending-${Date.now()}`
    setThread((current) => [...current, { id: tempId, sender_id: user.id, receiver_id: active.other_id, content: text, created_at: new Date().toISOString(), pending: true }])
    setDraft('')
    typingRef.current?.stop()
    inputRef.current?.focus()
    try {
      const created = await messageService.send({ conversationId: active.id, senderId: user.id, receiverId: active.other_id, content: text })
      setThread((current) => {
        const rest = current.filter((item) => item.id !== tempId)
        return rest.some((item) => item.id === created.id) ? rest : [...rest, created]
      })
      if (created.content !== text) setNotice('Dio poruke je automatski uklonjen (Pravilo #1).')
      loadInbox()
    } catch (requestError) {
      setThread((current) => current.filter((item) => item.id !== tempId))
      setDraft((current) => current || text)
      setError(requestError.message)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const imagesSwitch = useSwitch('chat_images')
  const sendImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !active) return
    if (!imagesSwitch.on) { setError(imagesSwitch.message || 'Slanje slika je privremeno isključeno.'); return }
    setError('')
    setUploading(true)
    try {
      const created = await messageService.sendImage({ conversationId: active.id, senderId: user.id, receiverId: active.other_id, file })
      setThread((current) => (current.some((item) => item.id === created.id) ? current : [...current, created]))
      loadInbox()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploading(false)
    }
  }

  const onKeyDown = (event) => {
    // a held Enter repeats keydown: only the first press sends; Enter that confirms an IME composition doesn't send
    // on a phone Enter makes a new line and the send button sends, like WhatsApp
    if (touchKeyboard) return
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!event.repeat) sendMessage() }
  }

  const reportConversation = async () => {
    if (!active) return
    const reason = await promptDialog({ title: 'Prijavi razgovor', text: 'Šta nije u redu? (npr. prevara, uznemiravanje, zabranjen sadržaj)', placeholder: 'Opiši ukratko…', confirmLabel: 'Prijavi' })
    if (!reason) return
    try {
      await reportService.createReport({ reporterId: user.id, targetType: 'conversation', targetId: active.id, reason })
      setNotice('Hvala — prijava je poslana našem timu.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const toggleBlock = async () => {
    if (!active) return
    setError(''); setNotice('')
    try {
      const wasBlocked = otherBlocked
      if (await toggleBlockUser(active.other_id, active.other_name)) setNotice(wasBlocked ? 'Korisnik je odblokiran.' : 'Korisnik je blokiran. Više vam ne može pisati.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const hideTips = () => { setTipsOpen(false); try { localStorage.setItem('zadatak-chat-tips', 'hidden') } catch { /* ignore */ } }

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

  if (isPhone) {
    return (
      <Chat
        user={user} inbox={inbox} visible={visible} active={active} loading={loading} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter}
        unreadTotal={unreadTotal} openConversation={openConversation} grouped={grouped} thread={thread} lastOwnRead={lastOwnRead}
        listRef={listRef} inputRef={inputRef} imageRef={imageRef} draft={draft} setDraft={setDraft} onKeyDown={onKeyDown} sendMessage={sendMessage} sendImage={sendImage} sending={sending}
        uploading={uploading} error={error} notice={notice} togglePref={togglePref} reportConversation={reportConversation} toggleBlock={toggleBlock} otherBlocked={otherBlocked} timeOf={timeOf} shortDate={shortDate}
        retry={() => loadInbox()} chatState={chatState} otherTyping={otherTyping} onThreadScroll={onThreadScroll} unseen={unseen} jumpToEnd={jumpToEnd}
      />
    )
  }

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
              {loading && <SkeletonRows n={4} />}
              {!loading && inboxQuery.isError && inbox.length === 0 && <LoadFailed title="Poruke se nisu učitale" onRetry={loadInbox} />}
              {!loading && !(inboxQuery.isError && inbox.length === 0) && visible.length === 0 && (
                <div className="chat-list-empty">
                  <MailMascot className="chat-list-mascot" />
                  <p>{inbox.length === 0 ? 'Još nema poruka. Razgovor se otvara čim neka ponuda bude prihvaćena.' : 'Nema poruka za ovaj filter.'}</p>
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
                <div className="chat-welcome-empty">
                  <div className="chat-welcome-art"><MessagesSquare size={30} /></div>
                  <strong>Odaberite razgovor</strong>
                  <span>Ovdje se otvara prepiska sa klijentom ili izvođačem, zajedno sa poslom o kojem pričate.</span>
                </div>
                {tipsOpen && (
                  <div className="chat-safety-card">
                    <h3><ShieldCheck size={18} /> Savjeti za sigurnu saradnju</h3>
                    <button type="button" className="chat-safety-close" onClick={hideTips} aria-label="Zatvori"><X size={16} /></button>
                    <ul>{SAFETY_TIPS.map((tip) => <li key={tip}><Check size={14} />{tip}</li>)}</ul>
                    <Link to="/pravila-zajednice#pravilo-1">Više o sigurnosti</Link>
                  </div>
                )}
              </div>
            ) : (
              <>
                <header className="chat-head">
                  <button type="button" className="chat-back" onClick={() => openConversation('')} aria-label="Nazad na listu"><ArrowLeft size={18} /></button>
                  <Link to={`/korisnik/${active.other_id}`} className="chat-head-person" title="Pogledaj javni profil">
                    <Avatar src={active.other_avatar} name={active.other_name} size={40} />
                    <span>
                      <strong>{active.other_name}</strong>
                      {otherTyping ? <small className="chat-head-typing">kuca…</small> : <small>{active.other_type === 'client' ? 'Klijent' : 'Izvođač'}</small>}
                    </span>
                  </Link>
                  <span className={`chat-contact-state ${active.contacts_allowed ? 'open' : ''}`} title={active.contacts_allowed ? 'Ponuda je prihvaćena' : 'Kontakt se otključava kad klijent prihvati ponudu'}>
                    {active.contacts_allowed ? <><Unlock size={13} /> Kontakt otključan</> : <><Lock size={13} /> Kontakt zaštićen</>}
                  </span>
                  <div className="chat-head-actions">
                    <button type="button" className={active.saved ? 'on' : ''} onClick={() => togglePref(active, 'saved')} title={active.saved ? 'Ukloni iz spašenih' : 'Spasi'}><Heart size={16} fill={active.saved ? 'currentColor' : 'none'} /></button>
                    <button type="button" onClick={() => togglePref(active, 'archived')} title={active.archived ? 'Vrati iz arhive' : 'Arhiviraj'}>{active.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}</button>
                    <button type="button" onClick={reportConversation} title="Prijavi razgovor" aria-label="Prijavi razgovor"><Flag size={16} /></button>
                    <button type="button" className={otherBlocked ? 'on' : ''} onClick={toggleBlock} title={otherBlocked ? 'Odblokiraj korisnika' : 'Blokiraj korisnika'} aria-label={otherBlocked ? 'Odblokiraj korisnika' : 'Blokiraj korisnika'}><Ban size={16} /></button>
                  </div>
                </header>

                {active.listing_id && (
                  <Link to={`/listings/${active.listing_id}`} className="chat-job-link">
                    <span className="chat-job-icon"><BriefcaseBusiness size={18} /></span>
                    <span className="chat-job-text">
                      <small>Posao</small>
                      <strong>{active.listing_title}</strong>
                    </span>
                    <span className={`chat-job-status ${status.tone}`}>{status.label}</span>
                    <em>Otvori <ChevronRight size={15} /></em>
                  </Link>
                )}

                <div className="chat-thread" ref={listRef} onScroll={onThreadScroll}>
                  {thread.length === 0 && (
                    <div className="chat-thread-intro">
                      <UserRound size={22} />
                      <p>Ovo je početak vašeg razgovora sa <strong>{active.other_name}</strong>. Budite konkretni: šta, kada i gdje.</p>
                    </div>
                  )}
                  {grouped.map((group) => (
                    <div key={group.key} className="chat-day">
                      <span className="chat-day-label">{group.label}</span>
                      {group.items.map((item, index) => {
                        const mine = item.sender_id === user.id
                        const follows = index > 0 && group.items[index - 1].sender_id === item.sender_id
                        return (
                          <div key={item.id} className={`chat-bubble ${mine ? 'mine' : 'theirs'} ${follows ? 'follows' : ''} ${item.attachment_type === 'image' ? 'has-image' : ''} ${item.pending ? 'is-pending' : ''}`} data-testid="chat-message">
                            {item.attachment_type === 'image' && item.attachment_url
                              ? <PrivateImage fileRef={item.attachment_url} alt="Slika" className="chat-image" />
                              : <p>{item.content}</p>}
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
                  {otherTyping && <div className="chat-typing" aria-label={`${active.other_name} kuca`}><i /><i /><i /></div>}
                  {unseen > 0 && <button type="button" className="chat-jump" onClick={jumpToEnd}><ChevronDown size={16} /> Nove poruke ({unseen})</button>}
                </div>

                {error && <div className="form-error chat-alert">{error}</div>}
                {notice && <div className="form-success chat-alert">{notice}</div>}

                {chatState === 'open' ? (
                  <>
                  <form className="chat-composer" onSubmit={sendMessage}>
                    <input ref={imageRef} type="file" accept="image/*" hidden onChange={sendImage} />
                    <button type="button" className="chat-attach" onClick={() => imageRef.current?.click()} aria-label="Pošalji sliku" disabled={uploading}><ImagePlus size={20} /></button>
                    <textarea data-testid="chat-input"
                      ref={inputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="Napiši poruku…"
                      aria-label="Poruka"
                      rows={1}
                      maxLength={2000}
                    />
                    <button data-testid="chat-send" type="submit" className="chat-send" aria-label="Pošalji" disabled={sending || !draft.trim()} onPointerDown={(event) => event.preventDefault()}><Send size={18} /></button>
                  </form>
                  <p className="chat-composer-hint"><ShieldCheck size={12} /> {touchKeyboard ? '' : 'Enter šalje, Shift+Enter novi red. '}Poruke se automatski provjeravaju (Pravilo #1 i zabranjen sadržaj).</p>
                  </>
                ) : (
                  <ChatStateNotice state={chatState} listingId={active.listing_id} onUnblock={toggleBlock} />
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default MessagesPage
