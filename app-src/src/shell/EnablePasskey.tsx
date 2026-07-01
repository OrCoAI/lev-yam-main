import { useEffect, useState } from 'react'
import { platformAuthenticatorAvailable, registerPasskey } from '../lib/passkeys'

type Status = 'idle' | 'busy' | 'done' | 'error'

/** Topbar action: register a Face ID / Touch ID passkey on the current device. */
export default function EnablePasskey() {
  const [available, setAvailable] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    platformAuthenticatorAvailable().then(setAvailable)
  }, [])

  if (!available) return null

  async function enable() {
    setStatus('busy')
    setMsg('')
    try {
      await registerPasskey(navigator.platform || 'מכשיר זה')
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setMsg((e as Error).message)
    }
  }

  const label =
    status === 'done'
      ? '✓ Face ID מופעל'
      : status === 'busy'
        ? 'מפעיל…'
        : status === 'error'
          ? 'נסה שוב — Face ID'
          : 'הפעלת Face ID'

  return (
    <button
      className="btn-ghost btn-icon-label"
      onClick={enable}
      disabled={status === 'busy' || status === 'done'}
      title={status === 'error' ? msg : 'הוספת כניסה מהירה עם Face ID במכשיר זה'}
      aria-label={label}
    >
      <span aria-hidden="true">🔐</span>
      <span className="btn-label">{label}</span>
    </button>
  )
}
