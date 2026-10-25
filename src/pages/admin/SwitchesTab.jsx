import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { switchesQuery } from '../../hooks/useSwitches'
import { relativeTime } from './shared'

/**
 * Prekidači: turn one feature off for everyone without a new app version (and back on), and set the
 * lowest Android/iOS app version that may still be used. Rows come from feature_switches.
 */
function SwitchesTab() {
  const queryClient = useQueryClient()
  const query = useQuery(switchesQuery)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const rows = Object.values(query.data || {}).sort((a, b) => a.label.localeCompare(b.label, 'bs'))
  const versions = query.data?.min_app_version

  const save = async (key, patch) => {
    setBusy(key)
    setError('')
    const { error: requestError } = await supabase.from('feature_switches').update(patch).eq('key', key)
    if (requestError) setError(requestError.message)
    await queryClient.invalidateQueries({ queryKey: switchesQuery.queryKey })
    setBusy('')
  }

  const saveVersions = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save('min_app_version', { value: { ...versions.value, android: String(form.get('android')).trim() || '0.0.0', ios: String(form.get('ios')).trim() || '0.0.0' } })
  }

  if (query.isError) return <div className="dossier-card"><p className="form-error">Prekidači nisu podešeni u bazi (pokreni supabase/stability/01_feature_switches.sql).</p></div>

  return (
    <div className="switches">
      <div className="dossier-card">
        <h3>Prekidači</h3>
        <p className="muted-text">Kad nešto ne radi kako treba, isključi samo to. Ostatak aplikacije radi normalno, korisnici vide poruku ispod.</p>
        {error && <p className="form-error">{error}</p>}
        {rows.filter((row) => row.key !== 'min_app_version').map((row) => (
          <div key={row.key} className="switch-row">
            <div className="switch-row-main">
              <strong>{row.label}</strong>
              <span className={`switch-state ${row.enabled ? 'is-on' : 'is-off'}`}>{row.enabled ? 'Uključeno' : 'Isključeno'}</span>
              {row.message && <small className="muted-text">{row.message}</small>}
            </div>
            <button type="button" className={row.enabled ? 'ghost-button danger' : 'primary-button small-button'} disabled={busy === row.key}
              onClick={() => { if (!row.enabled || window.confirm(`Isključiti „${row.label}“ za sve korisnike?`)) save(row.key, { enabled: !row.enabled }) }}>
              {row.enabled ? 'Isključi' : 'Uključi'}
            </button>
          </div>
        ))}
      </div>
      {versions && (
        <form className="dossier-card" onSubmit={saveVersions}>
          <h3>Najmanja verzija aplikacije</h3>
          <p className="muted-text">Starija verzija aplikacije na telefonu pokaže „Ažuriraj aplikaciju“ i link na trgovinu. 0.0.0 znači da se ne traži ništa.</p>
          <div className="switch-versions">
            <label>Android <input name="android" defaultValue={versions.value?.android || '0.0.0'} inputMode="decimal" /></label>
            <label>iOS <input name="ios" defaultValue={versions.value?.ios || '0.0.0'} inputMode="decimal" /></label>
            <button type="submit" className="primary-button small-button" disabled={busy === 'min_app_version'}>Sačuvaj</button>
          </div>
          {versions.updated_at && <small className="muted-text">Promijenjeno {relativeTime(versions.updated_at)}</small>}
        </form>
      )}
    </div>
  )
}

export default SwitchesTab
