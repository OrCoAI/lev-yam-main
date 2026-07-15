import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import AuthHeader from './AuthHeader'

// Reached from a Supabase auth email link (password recovery *or* an accepted
// invite — both leave the browser with a fresh session from the URL, and both
// need the same "set a password" step). detectSessionInUrl (lib/supabase.ts)
// already parsed the link before this component mounts.
export default function ResetPassword() {
  const { t } = useI18n()
  const navigate = useNavigate()

  // null = still checking; true/false = whether the email link left a session
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)))
  }, [])

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => navigate('/', { replace: true }), 1500)
    return () => clearTimeout(timer)
  }, [done, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError(t('resetPassword.mismatch'))
      return
    }
    if (password.length < 6) {
      setError(t('resetPassword.tooShort'))
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  return (
    <div className="screen-center">
      <form className="card login" onSubmit={onSubmit}>
        <AuthHeader title={t('resetPassword.title')} />

        {hasSession === null ? null : !hasSession ? (
          <p className="error">{t('resetPassword.invalidLink')}</p>
        ) : done ? (
          <p className="notice">{t('resetPassword.success')}</p>
        ) : (
          <>
            <label>
              {t('resetPassword.newPassword')}
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <label>
              {t('resetPassword.confirmPassword')}
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </label>

            {error && <p className="error">{error}</p>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? t('resetPassword.saving') : t('resetPassword.submit')}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
