import { CreditCard, Landmark } from 'lucide-react'
import CountUp from '../../components/CountUp'

const money = (value) => `${Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KM`
const bigAmount = (value) => {
  const [whole, cents] = Number(value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',')
  return <>{whole}<span className="bh-cents">,{cents}</span></>
}

function Actions({ panel, payout, openPanel }) {
  return (
    <div className="bh-actions">
      <button type="button" className={`bh-btn is-main${panel === 'topup' ? ' is-open' : ''}`} onClick={() => openPanel('topup')} aria-expanded={panel === 'topup'}><CreditCard size={17} /> Uplati karticom</button>
      <button type="button" className={`bh-btn${panel === 'payout' ? ' is-open' : ''}`} onClick={() => openPanel('payout')} disabled={Boolean(payout?.open)} aria-expanded={panel === 'payout'}><Landmark size={17} /> {payout?.open ? 'Isplata je u toku' : 'Isplati na račun'}</button>
    </div>
  )
}

/** The top of Plaćanje → Balans: what is available, one bar for where all the money is, and the two money actions. */
function BalanceHero({ wallet, totals, payout, panel, openPanel }) {
  const balance = Number(wallet.balance || 0)
  const total = balance + totals.reserved + totals.incoming
  const part = (value) => (total > 0 ? `${(value / total) * 100}%` : '0%')
  return (
    <section className="bh" aria-label="Stanje računa">
      <div className="bh-head">
        <div>
          <small>Dostupno</small>
          <strong className="bh-amount"><CountUp value={balance} format={bigAmount} duration={900} /><span className="bh-cur">KM</span></strong>
        </div>
        <div className="bh-total"><small>Ukupno na Zadatku</small><b>{money(total)}</b></div>
      </div>
      <div className="bh-bar" aria-hidden="true">
        {total > 0
          ? <><span className="is-free" style={{ width: part(balance) }} /><span className="is-held" style={{ width: part(totals.reserved) }} /><span className="is-coming" style={{ width: part(totals.incoming) }} /></>
          : <span className="is-empty" />}
      </div>
      <ul className="bh-legend">
        <li><i className="is-free" /> Dostupno</li>
        <li><i className="is-held" /> Rezervisano</li>
        <li><i className="is-coming" /> Stiže</li>
      </ul>
      <Actions panel={panel} payout={payout} openPanel={openPanel} />
    </section>
  )
}

export default BalanceHero
