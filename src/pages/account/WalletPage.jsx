import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Coins, CreditCard, Gift, Info, Landmark, Lock, Receipt, RefreshCcw, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import { accountService } from '../../services/accountService'
import { formatBosnianDate } from '../../utils/dateFormat'
import CountUp from '../../components/CountUp'

const KIND = {
  admin_credit: ['Uplata — Poso.ba tim', Gift],
  bonus: ['Bonus', Sparkles],
  promo: ['Promocija', Sparkles],
  refund: ['Povrat', RefreshCcw],
  admin_debit: ['Skidanje — Poso.ba tim', Receipt],
  fee: ['Naknada za posao', Receipt],
  purchase: ['Uplata', Receipt],
  payout: ['Isplata', ArrowUpRight],
  escrow_hold: ['Osigurana uplata za posao', Lock],
  escrow_refund: ['Povrat osigurane uplate', RefreshCcw],
  job_income: ['Zarada od posla', Coins],
  card_topup: ['Uplata karticom', CreditCard],
  payout_hold: ['Isplata na račun', Landmark],
  payout_return: ['Povrat isplate na balans', RefreshCcw],
}
const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

/** The user's money on the platform: balance, what came in and out, and every transaction. */
function WalletPage() {
  const [wallet, setWallet] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [params, setParams] = useSearchParams()
  const [panel, setPanel] = useState(null) // 'topup' | 'payout' | null
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [payout, setPayout] = useState(null)

  const load = () => Promise.all([
    accountService.myWallet().then(setWallet),
    accountService.payoutState().then(setPayout),
  ]).catch((requestError) => setError(requestError.message))
  useEffect(() => { load() }, [])

  // Povratak sa Monri stranice. Novac upisuje samo Monri callback, pa ovdje
  // samo čekamo da se status promijeni (obično par sekundi).
  useEffect(() => {
    const result = params.get('uplata')
    const order = params.get('narudzba')
    if (!result || !order) return
    setParams({}, { replace: true })
    if (result !== 'ok') { setNotice('Plaćanje je otkazano — ništa nije naplaćeno.'); return }
    setNotice('Provjeravamo uplatu…')
    let tries = 0
    const timer = setInterval(async () => {
      tries += 1
      const row = await accountService.cardPaymentStatus(order)
      if (row?.status === 'approved') { clearInterval(timer); setNotice(`Uplata od ${money(row.amount_km)} je stigla na balans.`); load() }
      else if (row?.status === 'declined') { clearInterval(timer); setNotice('Banka je odbila plaćanje — ništa nije naplaćeno.') }
      else if (tries >= 15) { clearInterval(timer); setNotice('Uplata se još obrađuje. Balans će se ažurirati čim banka potvrdi.') }
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const openPanel = (name) => { setPanel(panel === name ? null : name); setAmount(''); setActionError('') }
  // na telefonu panel zna pasti ispod trake s tabovima — pomjeri ga u vidno polje
  const panelRef = useCallback((node) => {
    if (node) window.requestAnimationFrame(() => node.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }, [])

  const topUp = async (event) => {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    try { await accountService.startCardTopup(amount) } catch (requestError) { setActionError(requestError.message); setBusy(false) }
  }

  const withdraw = async (event) => {
    event.preventDefault()
    setBusy(true)
    setActionError('')
    try {
      await accountService.requestPayout(amount)
      setPanel(null)
      setNotice('Zahtjev za isplatu je poslan. Tim šalje uplatu na tvoj račun, obično za 1–2 radna dana.')
      load()
    } catch (requestError) { setActionError(requestError.message) } finally { setBusy(false) }
  }

  const cancelOpenPayout = async () => {
    try { await accountService.cancelPayout(payout.open.id); setNotice('Zahtjev za isplatu je otkazan, iznos je vraćen na balans.'); load() } catch (requestError) { setActionError(requestError.message) }
  }

  if (error) return <div className="account-section"><div className="form-error">{error}</div></div>
  if (!wallet) return <div className="account-section"><div className="page-state">Učitavanje balansa…</div></div>

  const rows = (wallet.transactions || []).filter((row) => filter === 'all' || (filter === 'in' ? Number(row.amount) > 0 : Number(row.amount) < 0))

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Balans</h1></div>

      <div className="wallet-card">
        <div className="wallet-card-top">
          <span className="wallet-card-label"><Wallet size={15} /> Stanje računa</span>
          <span className="wallet-card-chip"><ShieldCheck size={13} /> Sigurno na platformi</span>
        </div>
        <strong className="wallet-card-balance"><CountUp value={wallet.balance} format={money} duration={900} /></strong>
        <span className="wallet-card-sub">trenutno stanje · {wallet.count} {Number(wallet.count) === 1 ? 'transakcija' : 'transakcija'}</span>
        <Coins className="wallet-card-art" size={120} aria-hidden="true" />
      </div>

      <div className="wallet-stats">
        <div><ArrowDownLeft size={16} /><span>Uplaćeno ukupno</span><strong><CountUp value={wallet.credited_total} format={money} /></strong></div>
        <div><ArrowUpRight size={16} /><span>Skinuto ukupno</span><strong><CountUp value={wallet.spent_total} format={money} /></strong></div>
        <div><ArrowDownLeft size={16} /><span>Uplaćeno · 30 dana</span><strong><CountUp value={wallet.credited_30d} format={money} /></strong></div>
        <div><ArrowUpRight size={16} /><span>Skinuto · 30 dana</span><strong><CountUp value={wallet.spent_30d} format={money} /></strong></div>
      </div>

      <div className="wallet-info">
        <Info size={16} />
        <span>Ovo je tvoj novac na Poso.ba. Kad prihvatiš ponudu, cijena se rezerviše odavde i čuva dok ne potvrdiš da je posao završen; kad ti klijent oslobodi uplatu, zarada (bez naknade) sjeda ovdje. Na račun se isplaćuje zarada od poslova. <Link to="/nivoi">Kako rade naknade →</Link></span>
      </div>

      {notice && <div className="form-success">{notice}</div>}

      <div className="wallet-cta">
        <button type="button" className="primary-button" onClick={() => openPanel('topup')}><CreditCard size={16} /> Uplati karticom</button>
        <button type="button" className="ghost-button" onClick={() => openPanel('payout')} disabled={Boolean(payout?.open)}><ArrowUpRight size={16} /> Isplati na račun</button>
      </div>

      {payout?.open && (
        <div className="wallet-info">
          <Landmark size={16} />
          <span>Isplata od <strong>{money(payout.open.amount_km)}</strong> na račun •••• {String(payout.open.iban || '').slice(-4)} čeka obradu (poslano {formatBosnianDate(payout.open.created_at)}). <button type="button" className="adm-userlink" onClick={cancelOpenPayout}>Otkaži</button></span>
        </div>
      )}

      {panel === 'topup' && (
        <form ref={panelRef} className="auth-form wallet-action" onSubmit={topUp}>
          <label>Iznos uplate (KM)<input type="number" inputMode="decimal" min="5" max="2000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="npr. 100" required /></label>
          <small className="muted-text">Karticu unosiš na sigurnoj stranici banke (Monri). Poso.ba ne vidi ni ne čuva podatke kartice.</small>
          {actionError && <div className="form-error">{actionError}</div>}
          <button type="submit" className="primary-button" disabled={busy}><Lock size={15} /> {busy ? 'Otvaram plaćanje…' : 'Nastavi na plaćanje'}</button>
        </form>
      )}

      {panel === 'payout' && payout && (
        <form ref={panelRef} className="auth-form wallet-action" onSubmit={withdraw}>
          {!payout.verified && (
            <>
              <p>Za isplatu prvo potvrdi identitet.</p>
              <Link to="/account/verifikacija" className="primary-button">Potvrdi identitet</Link>
            </>
          )}
          {payout.verified && !payout.has_account && (
            <>
              <p>Dodaj bankovni račun na koji šaljemo novac. Račun mora glasiti na tvoje ime.</p>
              <Link to="/account/nacini-placanja" className="primary-button"><Landmark size={15} /> Dodaj račun za isplatu</Link>
            </>
          )}
          {payout.verified && payout.has_account && (
            <>
              <p className="muted-text">Možeš isplatiti do <strong>{money(payout.withdrawable)}</strong> (zarada od poslova). Najmanje 20 KM.</p>
              <label>Iznos isplate (KM)<input type="number" inputMode="decimal" min="20" max={payout.withdrawable} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
              {actionError && <div className="form-error">{actionError}</div>}
              <button type="submit" className="primary-button" disabled={busy || Number(payout.withdrawable) < 20}><Landmark size={15} /> {busy ? 'Šaljem…' : 'Zatraži isplatu'}</button>
            </>
          )}
        </form>
      )}

      <div className="wallet-list-head">
        <h3 className="account-sub">Transakcije</h3>
        <div className="admin-subtabs">
          {[['all', 'Sve'], ['in', 'Uplate'], ['out', 'Skidanja']].map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="wallet-empty">
          <Coins size={28} />
          <strong>Još nema transakcija</strong>
          <span>Svaka uplata, naknada ili isplata pojaviće se ovdje.</span>
        </div>
      )}
      <div className="wallet-list">
        {rows.map((row) => {
          const [label, Icon] = KIND[row.kind] || ['Transakcija', Receipt]
          const positive = Number(row.amount) > 0
          return (
            <div key={row.id} className="wallet-row">
              <span className={`wallet-sign ${positive ? 'plus' : 'minus'}`}><Icon size={16} /></span>
              <div>
                <strong>{label}{row.note ? ` · ${row.note}` : ''}</strong>
                <small>{formatBosnianDate(row.created_at)} · stanje nakon: {money(row.balance_after)}</small>
              </div>
              <b className={positive ? 'plus' : 'minus'}>{positive ? '+' : '−'}{money(Math.abs(Number(row.amount)))}</b>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WalletPage
