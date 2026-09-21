import { Component, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { reportClientError } from '../utils/errorReporter'

/** Drops every runtime cache and reloads: the cure for a page whose code did not arrive (stale build, flaky network). */
export async function hardReload() {
  try {
    if ('caches' in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
  } catch { /* ignore */ }
  window.location.reload()
}

function RetryCard({ title, text }) {
  return (
    <div className="route-retry" role="alert">
      <strong>{title}</strong>
      <p>{text}</p>
      <button type="button" className="primary-button" onClick={hardReload}><RefreshCw size={16} /> Osvježi</button>
    </div>
  )
}

/** Suspense fallback: the thin progress bar, and after a while an honest "this is slow" card with a reload. */
export function RouteFallback() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <>
      <div className="route-loading" aria-busy="true"><span /></div>
      {slow && <RetryCard title="Učitavanje traje duže nego obično" text="Provjeri internet ili osvježi stranicu." />}
    </>
  )
}

class RouteErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error) { reportClientError(error, 'route') }

  render() {
    if (this.state.failed) return <RetryCard title="Ova stranica se nije mogla učitati" text="Najčešće je to stara verzija u pregledniku — osvježi i pokušaj ponovo." />
    return this.props.children
  }
}

/** Wraps the routed page: one error boundary per URL (a new page gets a clean slate). */
export function RouteGuard({ children }) {
  const { pathname } = useLocation()
  return <RouteErrorBoundary key={pathname}>{children}</RouteErrorBoundary>
}
