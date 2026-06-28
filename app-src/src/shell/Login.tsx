import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

interface FromState {
  from?: { pathname?: string }
}

export default function Login() {
  const { session, loading, configured, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as FromState | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) setError(error)
    else navigate(from, { replace: true })
  }

  return (
    <div className="screen-center">
      <form className="card login" onSubmit={onSubmit}>
        <h1 className="login-title">לב ים · מערכת</h1>
        <p className="muted">כניסת צוות</p>

        {!configured && (
          <p className="notice">
            החיבור ל-Supabase לא הוגדר. צרו <code>app-src/.env.local</code> מתוך{' '}
            <code>.env.example</code>.
          </p>
        )}

        <label>
          אימייל
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          סיסמה
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy || !configured}>
          {busy ? 'מתחבר…' : 'כניסה'}
        </button>

        {/* Face ID / passkey sign-in is added in Phase 1b (WebAuthn + Edge Function). */}
        <button type="button" className="btn-ghost" disabled title="בקרוב">
          כניסה עם Face ID
        </button>
      </form>
    </div>
  )
}
