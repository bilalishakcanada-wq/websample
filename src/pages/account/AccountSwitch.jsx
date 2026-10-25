import { NavLink } from 'react-router-dom'
import { haptic } from '../../utils/native'

/** Profil | Postavke: one switch on both pages. Profil is what others see, Postavke is the account itself. */
function AccountSwitch() {
  const tab = ({ isActive }) => (isActive ? 'active' : '')
  return (
    <nav className="acc-switch" aria-label="Profil ili postavke">
      <NavLink to="/account/profil" replace className={tab} onClick={() => haptic('light')} data-testid="switch-profile">Profil</NavLink>
      <NavLink to="/account/postavke" replace className={tab} onClick={() => haptic('light')} data-testid="switch-settings">Postavke</NavLink>
    </nav>
  )
}

export default AccountSwitch
