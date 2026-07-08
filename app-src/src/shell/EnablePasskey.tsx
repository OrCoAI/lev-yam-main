import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { platformAuthenticatorAvailable, registerPasskey } from '../lib/passkeys'

type Status = 'idle' | 'busy' | 'done' | 'error'

/** Topbar action: register a Face ID / Touch ID passkey on the current device. */
export default function EnablePasskey() {
  const { t } = useI18n()
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
      await registerPasskey(navigator.platform || t('passkey.thisDevice'))
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setMsg((e as Error).message)
    }
  }

  const label =
    status === 'done'
      ? t('passkey.enabled')
      : status === 'busy'
        ? t('passkey.enabling')
        : status === 'error'
          ? t('passkey.retry')
          : t('passkey.enable')

  return (
    <button
      className="btn-ghost btn-icon-label"
      onClick={enable}
      disabled={status === 'busy' || status === 'done'}
      title={status === 'error' ? msg : t('passkey.hint')}
      aria-label={label}
    >
      <span aria-hidden="true">🔐</span>
      <span className="btn-label">{label}</span>
    </button>
  )
}
