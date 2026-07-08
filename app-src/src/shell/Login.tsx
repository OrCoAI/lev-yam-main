import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LangToggle, useI18n } from '../lib/i18n'
import { loginWithPasskey, platformAuthenticatorAvailable } from '../lib/passkeys'

interface FromState {
  from?: { pathname?: string }
}

export default function Login() {
  const { session, loading, configured, signIn } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as FromState | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pkAvailable, setPkAvailable] = useState(false)
  const [pkBusy, setPkBusy] = useState(false)

  useEffect(() => {
    platformAuthenticatorAvailable().then(setPkAvailable)
  }, [])

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

  async function onPasskey() {
    setPkBusy(true)
    setError(null)
    try {
      await loginWithPasskey()
      navigate(from, { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPkBusy(false)
    }
  }

  return (
    <div className="screen-center">
      <form className="card login" onSubmit={onSubmit}>
        <LangToggle className="login-lang" />
        <img className="login-logo" src="/app/brand/logo-full.png" alt="לב ים" />
        <h1 className="login-title">{t('login.title')}</h1>
        <p className="login-sub muted">{t('login.sub')}</p>

        {!configured && (
          <p className="notice">
            {t('login.envNotice1')} <code>app-src/.env.local</code> {t('login.envNotice2')}{' '}
            <code>.env.example</code>.
          </p>
        )}

        <label>
          {t('login.email')}
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          {t('login.password')}
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
          {busy ? t('login.signingIn') : t('login.signIn')}
        </button>

        {pkAvailable && (
          <button
            type="button"
            className="btn-ghost"
            onClick={onPasskey}
            disabled={pkBusy || !configured}
            title={t('login.passkeyHint')}
          >
            {pkBusy ? t('login.verifying') : t('login.passkey')}
          </button>
        )}
      </form>
    </div>
  )
}
