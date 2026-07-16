import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LangToggle, useI18n, useRoleName } from '../lib/i18n'
import EnablePasskey from './EnablePasskey'
import RouteErrorBoundary from './ErrorBoundary'
import PreviewBanner from './PreviewBanner'

/** The signed-in user's primary (lowest-sort) role, as a header chip — always
 *  visible so it's never ambiguous which hat you're wearing (e.g. owner).
 *  Reads the auth context's roles, so it updates with refreshPermissions()
 *  (e.g. right after the matrix Save changes your own grants). */
function RoleBadge() {
  const { roles, preview } = useAuth()
  const roleName = useRoleName()
  // during a view-as preview the banner names the previewed user — showing the
  // admin's own role next to it would contradict what the screen renders
  if (preview || roles.length === 0) return null
  return <span className="badge">{roleName(roles[0])}</span>
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <PreviewBanner />
      <header className="topbar">
        <Link to="/" className="brand">
          <img className="brand-logo" src="/app/brand/logo-mark.png" alt="לב ים" />
          <span className="brand-name">
            לב ים<span className="brand-sub">{t('layout.system')}</span>
          </span>
        </Link>
        <div className="topbar-right">
          {user?.email && <span className="muted user-email">{user.email}</span>}
          <RoleBadge />
          <LangToggle />
          <EnablePasskey />
          <button className="btn-ghost" onClick={handleSignOut}>
            {t('layout.signOut')}
          </button>
        </div>
      </header>

      <main className="content">
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  )
}
