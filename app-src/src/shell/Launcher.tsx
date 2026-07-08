import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { core } from '../lib/supabase'
import type { ModuleRow } from '../types'

// Where each module key routes to. Internal modules use a React route (`to`);
// not-yet-migrated tools (POS) link out to their live standalone page (`href`).
const DESTINATIONS: Record<string, { to?: string; href?: string }> = {
  users: { to: '/users' },
  pos: { href: '/pos.html' },
  finance: { to: '/finance' },
}

// On-brand tile marks (only the shared brand icons — no emoji, no icon fonts).
// A module without a mapping falls back to its core.modules emoji.
const BRAND_ICONS: Record<string, string> = {
  users: '/app/brand/heart.png',
  finance: '/app/brand/sun-orange.png',
  pos: '/app/brand/palm-orange.png',
}

export default function Launcher() {
  const { t } = useI18n()
  const [modules, setModules] = useState<ModuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    core()
      .rpc('my_modules')
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) setError(error.message)
        else setModules((data as ModuleRow[] | null) ?? [])
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <div className="muted">{t('launcher.loading')}</div>
  if (error) return <div className="error">{t('launcher.error')} {error}</div>
  if (modules.length === 0)
    return <div className="card notice">{t('launcher.empty')}</div>

  return (
    <section className="launcher">
      <header className="launcher-hero">
        <img className="launcher-logo" src="/app/brand/logo-full.png" alt="לב ים" />
        <h1 className="launcher-greeting">{t('launcher.greeting')}</h1>
        <p className="launcher-sub">{t('launcher.sub')}</p>
      </header>

      <div className="launcher-grid">
        {modules.map((m, i) => {
          const dest = DESTINATIONS[m.key]
          const accent = i % 2 === 0 ? 'tile--blue' : 'tile--orange'
          const brandIcon = BRAND_ICONS[m.key]
          const inner = (
            <>
              <span className="tile-medallion">
                {brandIcon ? (
                  <img className="tile-icon" src={brandIcon} alt="" aria-hidden="true" />
                ) : (
                  <span className="tile-emoji">{m.icon ?? '▫️'}</span>
                )}
              </span>
              <span className="tile-label">{m.label}</span>
              <span className="tile-go">{dest ? t('launcher.open') : t('launcher.soon')}</span>
            </>
          )
          if (dest?.to) {
            return (
              <Link key={m.key} to={dest.to} className={`tile ${accent}`}>
                {inner}
              </Link>
            )
          }
          if (dest?.href) {
            return (
              <a key={m.key} href={dest.href} className={`tile ${accent}`}>
                {inner}
              </a>
            )
          }
          return (
            <div key={m.key} className={`tile ${accent} tile-disabled`} title={t('launcher.soon')}>
              {inner}
            </div>
          )
        })}
      </div>

      <div className="launcher-waves" aria-hidden="true">
        <svg viewBox="0 0 360 18" preserveAspectRatio="none">
          <polyline
            points="0,14 36,4 72,14 108,4 144,14 180,4 216,14 252,4 288,14 324,4 360,14"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  )
}
