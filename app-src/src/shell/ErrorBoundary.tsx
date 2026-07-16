import { Component, type ReactNode } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'

/**
 * Route error boundary (H7, 2026-07-15): a render crash degrades to a bilingual
 * error card instead of a white screen (the boot fallback only covers failures
 * before React mounts). Mounted twice — same component both times: in boot.tsx
 * between BrowserRouter and AuthProvider (true catch-all, including a crash in
 * AuthProvider/Login/reset-password) and inside Layout around the module outlet
 * (so the shell header survives a module crash). Any navigation heals it —
 * location.key is minted fresh on every push AND same-path replace — via state
 * reset, so healthy children are never remounted the way a key= swap would.
 */

function ErrorCard({ error }: { error: unknown }) {
  const { t } = useI18n()
  return (
    <div className="card module-error" role="alert">
      <h2>{t('errorBoundary.title')}</h2>
      <p className="muted">{t('errorBoundary.body')}</p>
      {error instanceof Error && error.message && (
        <p className="muted module-error-detail">{error.message}</p>
      )}
      <div className="module-error-actions">
        <button className="btn-primary" onClick={() => window.location.reload()}>
          {t('errorBoundary.reload')}
        </button>
        <Link className="btn-ghost" to="/">
          {t('errorBoundary.home')}
        </Link>
      </div>
    </div>
  )
}

type BoundaryProps = { resetKey: string; children: ReactNode }
// `caught` wraps the thrown value so a thrown null/undefined still counts as caught.
type BoundaryState = { caught: { error: unknown } | null; lastResetKey: string | null }

class Boundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { caught: null, lastResetKey: null }

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { caught: { error } }
  }

  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    if (props.resetKey === state.lastResetKey) return null
    // navigation happened: record it, and clear any crash from the previous route
    return { lastResetKey: props.resetKey, caught: null }
  }

  componentDidCatch(error: unknown) {
    console.error('render crash:', error)
  }

  render() {
    return this.state.caught ? <ErrorCard error={this.state.caught.error} /> : this.props.children
  }
}

export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return <Boundary resetKey={location.key}>{children}</Boundary>
}
