import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LangToggle, useI18n } from '../lib/i18n'
import EnablePasskey from './EnablePasskey'

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
      <header className="topbar">
        <Link to="/" className="brand">
          <img className="brand-logo" src="/app/brand/logo-mark.png" alt="לב ים" />
          <span className="brand-name">
            לב ים<span className="brand-sub">{t('layout.system')}</span>
          </span>
        </Link>
        <div className="topbar-right">
          {user?.email && <span className="muted user-email">{user.email}</span>}
          <LangToggle />
          <EnablePasskey />
          <button className="btn-ghost" onClick={handleSignOut}>
            {t('layout.signOut')}
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
