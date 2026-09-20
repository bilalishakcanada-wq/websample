import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell, Check, CheckCheck, ChevronRight, Flag, Heart, Archive, ArchiveRestore, ImagePlus, Lock, MoreHorizontal, Search, Send, Unlock, UserRound, X } from 'lucide-react'
import { MailMascot } from './Mascots'
import { useFullscreen } from './useFullscreen'
import './app.css'

const Avatar = ({ src, name, size = 48 }) => (src
  ? <img src={src} alt="" className="jd-avatar" style={{ width: size, height: size }} />
  : <span className="jd-avatar jd-avatar-empty ch-avatar-letter" style={{ width: size, height: size }}>{(name || '?').charAt(0).toUpperCase() || <UserRound size={20} />}</span>)

/**
 * Phone messaging, laid out like the reference app:
 *  - list: title + bell, search, plain rows (avatar, name, job, preview, time, unread dot)
 *  - thread: back + person + job strip, bubbles by day, composer with photo + send
 */
function Chat(props) {
  const {
    user, inbox, visible, active, loading, query, setQuery, filter, setFilter, unreadTotal, openConversation,
    grouped, thread, lastOwnRead, listRef, inputRef, imageRef, draft, setDraft, onKeyDown, sendMessage, sendImage, uploading,
    error, notice, togglePref, reportConversation, timeOf, shortDate,
  } = props
  useFullscreen(Boolean(active))
  const [menu, setMenu] = useState(false)

  if (!active) {
    return (
      <div className="ap ap-page ch">
        <header className="ap-page-head"><h1>Poruke</h1><Link to="/account/obavijesti" className="ap-icon-btn" aria-label="Obavijesti"><Bell size={20} /></Link></header>
        <label className="ch-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pretraži" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Obriši"><X size={16} /></button>}
        </label>
        <div className="ch-filters">
          {[['inbox', 'Sve'], ['unread', `Nepročitane${unreadTotal ? ` · ${unreadTotal}` : ''}`], ['saved', 'Spašene'], ['archived', 'Arhiva']].map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>

        {loading && <div className="ap-skeleton" />}
        {!loading && visible.length === 0 && (
          <div className="ap-empty ap-empty-art">
            <MailMascot />
            <strong>{inbox.length === 0 ? 'Još nemaš poruka' : 'Nema razgovora u ovom filteru'}</strong>
            <span>{inbox.length === 0 ? 'Razgovor se otvara čim neka ponuda bude prihvaćena.' : 'Promijeni filter ili pretragu.'}</span>
            {inbox.length === 0 && <Link to="/search" className="ap-btn ap-btn-primary ap-btn-inline">Pregledaj poslove</Link>}
          </div>
        )}
        <div className="ch-list">
          {visible.map((item) => {
            const unread = Number(item.unread) > 0
            return (
              <button key={item.id} type="button" className={`ch-row ${unread ? 'is-unread' : ''}`} onClick={() => openConversation(item.id)}>
                <Avatar src={item.other_avatar} name={item.other_name} size={52} />
                <span className="ch-row-body">
                  <span className="ch-row-top"><strong>{item.other_name}</strong><small>{item.last_at ? shortDate(item.last_at) : ''}</small></span>
                  {item.listing_title && <span className="ch-row-job">{item.listing_title}</span>}
                  <span className="ch-row-preview">{item.last_sender === user.id ? 'Ti: ' : ''}{item.last_message || 'Razgovor je otvoren'}</span>
                </span>
                {unread ? <b className="ch-dot">{item.unread}</b> : <ChevronRight size={18} className="ch-chev" />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="ap ch ch-thread-page">
      <header className="ch-head">
        <button type="button" className="ap-back" onClick={() => openConversation('')} aria-label="Nazad"><ArrowLeft size={22} /></button>
        <Link to={`/korisnik/${active.other_id}`} className="ch-head-person">
          <Avatar src={active.other_avatar} name={active.other_name} size={40} />
          <span><strong>{active.other_name}</strong><small>{active.other_type === 'client' ? 'Klijent' : 'Izvođač'}{active.contacts_allowed ? '' : ' · kontakt zaštićen'}</small></span>
        </Link>
        <button type="button" className="ap-back" onClick={() => setMenu((value) => !value)} aria-label="Više"><MoreHorizontal size={22} /></button>
        {menu && (
          <div className="jd-menu" onClick={() => setMenu(false)}>
            <button type="button" onClick={() => togglePref(active, 'saved')}><Heart size={16} fill={active.saved ? 'currentColor' : 'none'} /> {active.saved ? 'Ukloni iz spašenih' : 'Spasi razgovor'}</button>
            <button type="button" onClick={() => togglePref(active, 'archived')}>{active.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />} {active.archived ? 'Vrati iz arhive' : 'Arhiviraj'}</button>
            <button type="button" onClick={reportConversation}><Flag size={16} /> Prijavi razgovor</button>
          </div>
        )}
      </header>

      {active.listing_id && (
        <Link to={`/listings/${active.listing_id}`} className="ch-job">
          <span><small>Posao</small><strong>{active.listing_title}</strong></span>
          <em>Otvori <ChevronRight size={16} /></em>
        </Link>
      )}

      <div className="ch-thread" ref={listRef}>
        <p className="ch-safety">{active.contacts_allowed ? <><Unlock size={13} /> Ponuda je prihvaćena — možete razmijeniti kontakt.</> : <><Lock size={13} /> Brojevi i kontakti se dijele tek kad ponuda bude prihvaćena.</>}</p>
        {thread.length === 0 && <p className="ch-intro">Ovo je početak razgovora sa <strong>{active.other_name}</strong>. Budi konkretan/na: šta, kada i gdje.</p>}
        {grouped.map((group) => (
          <div key={group.key} className="ch-day">
            <span className="ch-day-label">{group.label}</span>
            {group.items.map((item) => {
              const mine = item.sender_id === user.id
              const image = item.attachment_type === 'image' && item.attachment_url
              return (
                <div key={item.id} className={`ch-bubble ${mine ? 'mine' : 'theirs'} ${image ? 'has-image' : ''}`}>
                  {image ? <a href={item.attachment_url} target="_blank" rel="noreferrer"><img src={item.attachment_url} alt="Slika" loading="lazy" /></a> : <p>{item.content}</p>}
                  <span className="ch-meta">{timeOf(item.created_at)}{mine && (item.read_at ? <CheckCheck size={13} className="seen" /> : <Check size={13} />)}</span>
                </div>
              )
            })}
          </div>
        ))}
        {lastOwnRead && <div className="ch-seen">Pročitano {timeOf(lastOwnRead.read_at)}</div>}
      </div>

      {error && <div className="form-error ch-alert">{error}</div>}
      {notice && <div className="form-success ch-alert">{notice}</div>}

      <form className="ch-composer" onSubmit={sendMessage}>
        <input ref={imageRef} type="file" accept="image/*" hidden onChange={sendImage} />
        <button type="button" className="ch-attach" onClick={() => imageRef.current?.click()} aria-label="Pošalji sliku" disabled={uploading}><ImagePlus size={22} /></button>
        <textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="Napiši poruku…" rows={1} maxLength={2000} enterKeyHint="send" />
        <button type="submit" className="ch-send" aria-label="Pošalji" disabled={!draft.trim()}><Send size={18} /></button>
      </form>
    </div>
  )
}

export default Chat
