import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, CheckCircle2, Hourglass, Lock, MapPin, MessageCircle, RotateCcw, Send, Wallet } from 'lucide-react'
import { keys, useMyBids } from '../hooks/queries'
import { groupProviderBoard, providerBoardService } from '../services/providerBoardService'
import { timeAgo } from '../utils/dateFormat'
import { SkeletonMtCard } from './Skeleton'
import './ProviderDashboard.css'

const money = (value) => (value == null ? 'Po dogovoru' : `${Number(value).toLocaleString('bs-BA', { maximumFractionDigits: 2 })} KM`)
const TABS = [
  ['active', 'Aktivne ponude', Hourglass],
  ['ongoing', 'U toku', Lock],
  ['done', 'Završeni poslovi', CheckCircle2],
]

function BoardCard({ row }) {
  const { bid, listing, payment, state, label } = row
  return (
    <article className={`pd-card s-${state}`} data-testid={`pd-card-${state}`}>
      <Link to={`/listings/${row.id}`} className="pd-card-link">
        <div className="pd-card-head">
          <strong>{listing.title || 'Posao'}</strong>
          <em>{money(payment ? payment.amount : bid.amount)}</em>
        </div>
        <span className="pd-card-meta"><MapPin size={13} /> {listing.location || 'Online'} · ponuda {timeAgo(bid.created_at)}</span>
        <span className={`pd-state s-${state}`}>{label}</span>
        {payment && payment.status !== 'released' && payment.status !== 'refunded' && (
          <span className="pd-card-money"><Lock size={13} /> {money(payment.amount)} osigurano na Zadatku · tebi {money(payment.net_amount)}</span>
        )}
        {state === 'paid' && <span className="pd-card-money is-paid"><Wallet size={13} /> Zarađeno {money(payment.net_amount)}</span>}
      </Link>
      {(state === 'rejected' || ((state === 'accepted' || payment) && state !== 'paid' && state !== 'refunded')) && (
        <div className="pd-card-actions">
          {state === 'rejected' && <Link to={`/listings/${row.id}`} className="pd-btn is-primary"><Send size={14} /> Pošalji novu cijenu</Link>}
          {state !== 'rejected' && <Link to={`/messages?listing=${row.id}`} className="pd-btn"><MessageCircle size={14} /> Poruke</Link>}
          {state !== 'rejected' && <Link to={`/listings/${row.id}`} className="pd-btn is-primary">Otvori posao</Link>}
        </div>
      )}
    </article>
  )
}

/**
 * „Ploča izvođača“: one place for every job a provider offered on, in three tabs —
 * offers waiting for the client, won jobs with money held in escrow, and finished work
 * with what was earned. Shared by the phone ("Moji poslovi") and the desktop account home;
 * useRealtimeSync keeps it current while it is open.
 */
function ProviderDashboard({ userId, initialTab = null }) {
  const bidsQuery = useMyBids(userId, 100)
  const paymentsQuery = useQuery({
    queryKey: keys.providerPayments(userId),
    queryFn: () => providerBoardService.myPayments(userId),
    enabled: Boolean(userId),
    meta: { persist: false },
  })
  const loading = bidsQuery.isPending || paymentsQuery.isPending
  const board = useMemo(() => groupProviderBoard(bidsQuery.data || [], paymentsQuery.data || []), [bidsQuery.data, paymentsQuery.data])
  const [picked, setPicked] = useState(initialTab)
  // open on the tab that needs attention: work in progress first, then waiting offers
  const tab = picked || (board.ongoing.length > 0 ? 'ongoing' : board.active.length > 0 ? 'active' : board.done.length > 0 ? 'done' : 'active')

  const escrow = board.ongoing.reduce((sum, row) => sum + Number(row.payment?.net_amount || 0), 0)
  const earned = board.done.reduce((sum, row) => sum + Number(row.earned || 0), 0)
  const rows = board[tab]

  if (bidsQuery.isError || paymentsQuery.isError) {
    return (
      <div className="ap-empty">
        <strong>Nije se učitalo</strong>
        <span>Provjeri internet i pokušaj ponovo.</span>
        <button type="button" className="ap-btn ap-btn-primary ap-btn-inline" onClick={() => { bidsQuery.refetch(); paymentsQuery.refetch() }}><RotateCcw size={15} /> Pokušaj ponovo</button>
      </div>
    )
  }

  return (
    <section className="pd" data-testid="provider-dashboard">
      <div className="pd-tabs" role="tablist" aria-label="Ploča izvođača">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setPicked(id)} data-testid={`pd-tab-${id}`}>
            <Icon size={15} /> <span>{label}</span> <b>{loading ? '·' : board[id].length}</b>
          </button>
        ))}
      </div>

      {tab === 'ongoing' && board.ongoing.length > 0 && <p className="pd-summary"><Lock size={14} /> Na Zadatku je osigurano <strong>{money(escrow)}</strong> za tebe. Isplaćuje se kad klijent potvrdi posao.</p>}
      {tab === 'done' && board.done.length > 0 && <p className="pd-summary is-earned"><Wallet size={14} /> Ukupno zarađeno preko Zadatka: <strong>{money(earned)}</strong> · <Link to="/account/novcanik">Novčanik</Link></p>}

      {loading && <div className="pd-list"><SkeletonMtCard /><SkeletonMtCard /></div>}
      {!loading && rows.length === 0 && (
        <div className="pd-empty">
          <Briefcase size={22} />
          {tab === 'active' && <><strong>Nemaš ponuda koje čekaju</strong><span>Pronađi posao i pošalji cijenu.</span><Link to="/search" className="pd-btn is-primary">Pregledaj poslove</Link></>}
          {tab === 'ongoing' && <><strong>Nema poslova u toku</strong><span>Kad klijent prihvati ponudu i osigura uplatu, posao je ovdje.</span></>}
          {tab === 'done' && <><strong>Još nema završenih poslova</strong><span>Ovdje ćeš vidjeti historiju i zaradu.</span></>}
        </div>
      )}
      {!loading && rows.length > 0 && <div className="pd-list">{rows.map((row) => <BoardCard key={row.id} row={row} />)}</div>}

      {!loading && tab === 'done' && board.lost.length > 0 && (
        <details className="pd-lost">
          <summary>Ponude koje nisu prošle ({board.lost.length})</summary>
          <div className="pd-list">{board.lost.map((row) => <BoardCard key={row.id} row={row} />)}</div>
        </details>
      )}
    </section>
  )
}

export default ProviderDashboard
