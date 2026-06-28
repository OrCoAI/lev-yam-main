import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          לב ים<span className="brand-sub">מערכת</span>
        </Link>
        <div className="topbar-right">
          {user?.email && <span className="muted user-email">{user.email}</span>}
          <button className="btn-ghost" onClick={handleSignOut}>
            יציאה
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
