import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authService } from '../services/authService'

const GoogleIcon = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>
)

const FacebookIcon = () => (
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#1877F2" d="M18 9a9 9 0 1 0-10.41 8.89v-6.29H5.31V9h2.28V7.02c0-2.25 1.34-3.5 3.4-3.5.98 0 2.01.18 2.01.18v2.21h-1.13c-1.12 0-1.47.69-1.47 1.4V9h2.5l-.4 2.6h-2.1v6.29A9 9 0 0 0 18 9Z" />
  </svg>
)

const PROVIDERS = [
  { id: 'google', name: 'Google', Icon: GoogleIcon },
  { id: 'facebook', name: 'Facebook', Icon: FacebookIcon },
]

function OAuthButtons({ verb = 'Nastavi', onError }) {
  const { loginWithProvider } = useAuth()
  const [enabled, setEnabled] = useState([])
  const [pending, setPending] = useState('')

  useEffect(() => {
    let active = true
    Promise.all(PROVIDERS.map((provider) => authService.isProviderEnabled(provider.id)))
      .then((results) => {
        if (!active) return
        setEnabled(PROVIDERS.filter((_, index) => results[index]).map((provider) => provider.id))
      })
    return () => { active = false }
  }, [])

  if (enabled.length === 0) return null

  const handleClick = async (providerId) => {
    setPending(providerId)
    try {
      await loginWithProvider(providerId)
    } catch (error) {
      onError?.(error.message)
      setPending('')
    }
  }

  return (
    <>
      <div className="auth-divider"><span>ili</span></div>
      <div className="oauth-buttons">
        {PROVIDERS.filter((provider) => enabled.includes(provider.id)).map(({ id, name, Icon }) => (
          <button
            key={id}
            type="button"
            className="oauth-button"
            onClick={() => handleClick(id)}
            disabled={Boolean(pending)}
          >
            <Icon />
            {pending === id ? `Otvaram ${name}...` : `${verb} sa ${name} računom`}
          </button>
        ))}
      </div>
    </>
  )
}

export default OAuthButtons
