import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, CreditCard, Info, Landmark, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { accountService, CARD_OFF } from '../../services/accountService'
import CountUp from '../../components/CountUp'
import { SkeletonRows } from '../../components/Skeleton'
import { confirmPaymentIdentity } from '../../utils/biometric'
import PaymentTabs from './PaymentTabs'
import MoneyOnTheWay, { pendingItems, pendingTotals } from './MoneyOnTheWay'
import LedgerRow from './LedgerRow'
import { useSwitch } from '../../hooks/useSwitches'

// the big balance: whole KM large, cents small, like a banking app
const bigAmount = (value) => {
  const [whole, cents] = Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',')
  return <>{whole}<span className="bal-cents">,{cents}</span></>
}
const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`

/** "Plaćanje → Balans": what is available, what is held or on the way, the latest transactions, and topping up or paying out. */
function WalletPage() {
  const [wallet, setWallet] = useState(null)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const [pending, setPending] = useState(null)
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
    accountService.moneyOnTheWay(user.id).then((result) => setPending({ ...result, now: Date.now() })),
  ]).catch((requestError) => setError(requestError.message))
  useEffect(() => { load() }, [])

  // Povratak sa Monri stranice. Novac upisuje samo Monri callback, pa ovdje
  // samo čekamo da se status promijeni (obično par sekundi).
  useEffect(() => {
    const result = params.get('uplata')
    const order = params.get('narudzba')
    if (!result || !order) return
    setParams({}, { replace: true })
    if (result !== 'ok') { setNotice('Plaćanje je otkazano, ništa nije naplaćeno.'); return }
    setNotice('Provjeravamo uplatu…')
    let tries = 0
    const timer = setInterval(async () => {
      tries += 1
      const row = await accountService.cardPaymentStatus(order)
      if (row?.status === 'approved') { clearInterval(timer); setNotice(`Uplata od ${money(row.amount_km)} je stigla na balans.`); load() }
      else if (row?.status === 'declined') { clearInterval(timer); setNotice('Banka je odbila plaćanje, ništa nije naplaćeno.') }
      else if (tries >= 15) { clearInterval(timer); setNotice('Uplata se još obrađuje. Balans će se ažurirati čim banka potvrdi.') }
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const openPanel = (name) => { setPanel(panel === name ? null : name); setAmount(''); setActionError('') }
  // na telefonu panel zna pasti ispod trake s tabovima, pomjeri ga u vidno polje
  const panelRef = useCallback((node) => {
    if (node) window.requestAnimationFrame(() => node.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }, [])

  const cardSwitch = useSwitch('card_topup')
  const topUp = async (event) => {
    event.preventDefault()
    if (!cardSwitch.on) { setActionError(cardSwitch.message || 'Uplata karticom je privremeno isključena.'); return }
    setBusy(true)
    setActionError('')
    try { await accountService.startCardTopup(amount) } catch (requestError) { setActionError(requestError.message); setBusy(false) }
  }

  const withdraw = async (event) => {
    event.preventDefault()
    if (!(await confirmPaymentIdentity(`Isplata ${amount} KM na tvoj račun`))) return
    setBusy(true)
    setActionError('')
    try {
      await accountService.requestPayout(amount)
      setPanel(null)
      setNotice('Zahtjev za isplatu je poslan. Tim šalje uplatu na tvoj račun, obično za 1–2 radna dana.')
      load()
    } catch (requestError) { setActionError(requestError.message) } finally { setBusy(false) }
  }

  if (error) return <div className="account-section"><div className="form-error">{error}</div></div>
  if (!wallet) return <div className="account-section"><SkeletonRows n={4} /></div>
  const totals = pendingTotals(pending, user.id)
  const recent = (wallet.transactions || []).slice(0, 5)

  return (
    <div className="account-section">
      <PaymentTabs />

      <section className="bal-card" aria-label="Stanje računa">
        <span className="bal-label">Dostupno</span>
        <strong className="bal-amount"><CountUp value={wallet.balance} format={bigAmount} duration={900} /><span className="bal-cur">KM</span></strong>
        <dl className="bal-split">
          <div><dt>Rezervisano za poslove</dt><dd>{money(totals.reserved)}</dd></div>
          <div><dt>Stiže na balans</dt><dd>{money(totals.incoming)}</dd></div>
          <div><dt>Može se isplatiti</dt><dd>{payout ? money(payout.withdrawable) : '-'}</dd></div>
        </dl>
        <div className="bal-actions">
          <button type="button" className={`bal-btn is-main${panel === 'topup' ? ' is-open' : ''}`} onClick={() => openPanel('topup')} aria-expanded={panel === 'topup'}><CreditCard size={17} /> Uplati karticom</button>
          <button type="button" className={`bal-btn${panel === 'payout' ? ' is-open' : ''}`} onClick={() => openPanel('payout')} disabled={Boolean(payout?.open)} aria-expanded={panel === 'payout'}><Landmark size={17} /> {payout?.open ? 'Isplata je u toku' : 'Isplati na račun'}</button>
        </div>
      </section>

      {notice && <div className="form-success">{notice}</div>}

      {panel === 'topup' && (
        <form ref={panelRef} className="auth-form wallet-action" onSubmit={topUp}>
          <label>Iznos uplate (KM)<input type="number" inputMode="decimal" min="5" max="2000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="npr. 100" required /></label>
          <small className="muted-text">Karticu unosiš na sigurnoj stranici banke (Monri). Zadatak ne vidi ni ne čuva podatke kartice.</small>
          {actionError && (
            <div className="form-error">
              {actionError}
              {actionError === CARD_OFF && <> <Link to={`/pomoc?chat=1&msg=${encodeURIComponent(`Želim uplatiti ${amount || '…'} KM na balans.`)}`}>Piši timu</Link></>}
            </div>
          )}
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

      <MoneyOnTheWay items={pendingItems(pending, user.id)} onCancelled={(text) => { setNotice(text); load() }} />

      <section className="bal-recent" aria-label="Posljednje transakcije">
        <div className="wallet-list-head">
          <h2 className="account-sub">Posljednje transakcije</h2>
          {recent.length > 0 && <Link to="/account/placanja" className="bal-all">Sve transakcije <ChevronRight size={16} /></Link>}
        </div>
        {recent.length === 0
          ? <p className="bal-none">Još nema transakcija. Svaka uplata, rezervacija, zarada ili isplata pojaviće se ovdje.</p>
          : <div className="wallet-list">{recent.map((row) => <LedgerRow key={row.id} row={row} />)}</div>}
      </section>

      <div className="wallet-info">
        <Info size={16} />
        <span>Kad prihvatiš ponudu, cijena se rezerviše sa balansa dok ne potvrdiš da je posao završen. Kad ti klijent potvrdi posao, zarada bez naknade stiže ovdje. Na račun možeš isplatiti samo zaradu od poslova. <Link to="/nivoi">Kako rade naknade</Link></span>
      </div>
    </div>
  )
}

export default WalletPage
