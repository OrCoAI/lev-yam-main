import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function RequireAuth() {
  const { loading, session } = useAuth()
  const location = useLocation()

  if (loading) return <div className="screen-center muted">טוען…</div>
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}
