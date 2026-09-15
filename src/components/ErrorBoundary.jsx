import { Component } from 'react'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page-state">
          <h1>Došlo je do greške</h1>
          <p>Osvježite stranicu i pokušajte ponovo.</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Osvježi stranicu
          </button>
        </main>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary