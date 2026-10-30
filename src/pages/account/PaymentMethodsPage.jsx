import { useEffect, useState } from 'react'
import { Landmark, Lock, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAccount } from './AccountLayout'
import { accountService } from '../../services/accountService'
import { confirmDialog } from '../../utils/dialog'
import PaymentTabs from './PaymentTabs'

const maskIban = (iban) => (iban ? `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}` : '')

/** "Plaćanje → Račun za isplatu": the bank account that payouts from the balance go to. */
function PaymentMethodsPage() {
  const { user } = useAuth()
  const { profile, reload } = useAccount()
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
      setMessage('Podaci za isplatu su sačuvani, značka "Način plaćanja verifikovan" je dodana.')
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
      <PaymentTabs />
      <p className="pay-intro">Na ovaj račun šaljemo novac kad zatražiš isplatu sa balansa. Treba ti samo ako primaš novac za poslove. Račun mora glasiti na tvoje ime.</p>

      {account && !editing ? (
        <div className="payout-card">
          <Landmark size={20} />
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
          <label className="account-field"><span>Ime vlasnika računa</span><input value={form.holder_name} onChange={set('holder_name')} autoComplete="name" required /></label>
          <label className="account-field"><span>Banka</span><input value={form.bank_name} onChange={set('bank_name')} placeholder="npr. UniCredit, Raiffeisen, Sparkasse" /></label>
          <label className="account-field account-field-wide"><span>IBAN ili broj računa</span><input value={form.iban} onChange={set('iban')} placeholder="BA39 1290 0794 0102 8494" autoComplete="off" required /><small>IBAN počinje sa BA i ima 20 znakova, ili 16-cifreni broj transakcijskog računa.</small></label>
          <label className="account-field"><span>Adresa vlasnika (ulica i broj)</span><input value={form.billing_address} onChange={set('billing_address')} placeholder="npr. Zmaja od Bosne 12" autoComplete="street-address" /></label>
          <label className="account-field"><span>Grad</span><input value={form.billing_city} onChange={set('billing_city')} autoComplete="address-level2" /></label>
          {error && <div className="form-error account-field-wide">{error}</div>}
          <div className="account-field-wide">
            <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Čuvam…' : account ? 'Sačuvaj promjene' : 'Dodaj bankovni račun'}</button>
            {account && <button type="button" className="ghost-button" onClick={() => setEditing(false)}>Odustani</button>}
          </div>
        </form>
      )}

      <div className="privacy-note"><Lock size={16} /><div><strong>Samo za isplate</strong><span>Broj računa i adresa se nikad ne prikazuju javno. Nikad ne skidamo novac sa tvog računa.</span></div></div>
      {message && <div className="form-success">{message}</div>}
      {error && account && !editing && <div className="form-error">{error}</div>}
    </div>
  )
}

export default PaymentMethodsPage
