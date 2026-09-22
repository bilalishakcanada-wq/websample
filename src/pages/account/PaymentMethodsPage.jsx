import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Lock, PlusCircle, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { confirmDialog } from '../../utils/dialog'

const maskIban = (iban) => (iban ? `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}` : '')

function PaymentMethodsPage() {
  const { user } = useAuth()
  const { profile, reload } = useAccount()
  const [tab, setTab] = useState(profile.account_type === 'client' ? 'pay' : 'receive')
  const [account, setAccount] = useState(null)
  const [form, setForm] = useState({ holder_name: profile.full_name || '', bank_name: '', iban: '', billing_address: '', billing_city: profile.city || '' })
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    accountService.getPayoutAccount(user.id).then((row) => {
      setAccount(row)
      if (row) setForm({ holder_name: row.holder_name, bank_name: row.bank_name || '', iban: row.iban, billing_address: row.billing_address || '', billing_city: row.billing_city || '' })
    })
  }, [user.id])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await accountService.savePayoutAccount(user.id, form)
      const row = await accountService.getPayoutAccount(user.id)
      setAccount(row)
      setEditing(false)
      await reload()
      setMessage('Podaci za isplatu su sačuvani — značka "Način plaćanja verifikovan" je dodana.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!(await confirmDialog({ title: 'Ukloniti podatke za isplatu?', text: 'Značka „Podaci za isplatu“ će biti uklonjena.', confirmLabel: 'Ukloni', danger: true }))) return
    try { await accountService.deletePayoutAccount(user.id); setAccount(null); setEditing(false); await reload() } catch (requestError) { setError(requestError.message) }
  }

  return (
    <div className="account-section">
      <div className="account-section-head"><h1>Načini plaćanja</h1></div>
      <div className="account-tabs">
        <button type="button" className={tab === 'pay' ? 'active' : ''} onClick={() => setTab('pay')}>Plaćam</button>
        <button type="button" className={tab === 'receive' ? 'active' : ''} onClick={() => setTab('receive')}>Primam uplate</button>
      </div>

      {tab === 'pay' && (
        <>
          <p>Kad prihvatiš ponudu izvođača, posao ćeš plaćati kroz <strong>Poso.ba Pay</strong>. Novac se drži sigurno dok posao nije završen i dok ga ti ne oslobodiš izvođaču.</p>
          <h3 className="account-sub">Kartica</h3>
          <button type="button" className="account-link-button" onClick={() => setMessage('Poso.ba Pay i plaćanje karticom stižu uskoro — do tada se plaćanje dogovara direktno sa izvođačem.')}>
            <PlusCircle size={20} /> Dodaj kreditnu ili debitnu karticu
          </button>
          <h3 className="account-sub">Balans</h3>
          <span className="muted-text">Stanje:</span>
          <strong className="credits-balance">{Number(profile.balance || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} KM</strong>
          <p className="muted-text">Tvoj novac na Poso.ba — iz njega se naplaćuje naknada za završene poslove. <Link to="/account/novcanik">Otvori balans</Link></p>
        </>
      )}

      {tab === 'receive' && (
        <>
          <p>Kad je posao završen, moći ćeš zatražiti isplatu od klijenta, koji je onda oslobađa na tvoj račun.</p>

          <h3 className="account-sub">Adresa za fakturisanje</h3>
          <div className="privacy-note"><Lock size={16} /><div><strong>Tvoja privatnost nam je važna</strong><span>Adresa i broj računa se nikad ne prikazuju javno — koriste se samo za verifikaciju naloga i isplate.</span></div></div>

          <h3 className="account-sub">Podaci o bankovnom računu</h3>
          <p className="muted-text">Unesi podatke da bi mogao/la primiti uplate. Nikad ne skidamo novac sa tvog računa.</p>

          {account && !editing ? (
            <div className="payout-card">
              <CreditCard size={20} />
              <div>
                <strong>{account.holder_name}</strong>
                <span>{account.bank_name || 'Banka'} · {maskIban(account.iban)}</span>
                {account.billing_address && <small>{account.billing_address}, {account.billing_city}</small>}
              </div>
              <div className="payout-card-actions">
                <button type="button" className="ghost-button" onClick={() => setEditing(true)}>Uredi</button>
                <button type="button" className="ghost-button danger" onClick={remove}><Trash2 size={14} /> Ukloni</button>
              </div>
            </div>
          ) : (
            <form className="account-form" onSubmit={save}>
              <label className="account-field"><span>Ime vlasnika računa</span><input value={form.holder_name} onChange={set('holder_name')} required /></label>
              <label className="account-field"><span>Banka</span><input value={form.bank_name} onChange={set('bank_name')} placeholder="npr. UniCredit, Raiffeisen, Sparkasse" /></label>
              <label className="account-field account-field-wide"><span>IBAN / broj računa</span><input value={form.iban} onChange={set('iban')} placeholder="BA39 1290 0794 0102 8494" required /><small>IBAN počinje sa BA i ima 20 znakova, ili 16-cifreni broj transakcijskog računa.</small></label>
              <label className="account-field"><span>Adresa</span><input value={form.billing_address} onChange={set('billing_address')} placeholder="npr. Zmaja od Bosne 12" /></label>
              <label className="account-field"><span>Grad</span><input value={form.billing_city} onChange={set('billing_city')} /></label>
              {error && <div className="form-error account-field-wide">{error}</div>}
              <div className="account-field-wide">
                <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Čuvam…' : account ? 'Sačuvaj promjene' : 'Dodaj bankovni račun'}</button>
                {account && <button type="button" className="ghost-button" onClick={() => setEditing(false)}>Odustani</button>}
              </div>
            </form>
          )}
        </>
      )}
      {message && <div className="form-success">{message}</div>}
      {error && tab === 'pay' && <div className="form-error">{error}</div>}
    </div>
  )
}

export default PaymentMethodsPage
