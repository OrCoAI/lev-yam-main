import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useI18n, type TKey } from '../lib/i18n'
import { core } from '../lib/supabase'
import type { ModuleRow } from '../types'

// One launcher registration per module: where it routes (`to`, or `href` for a
// not-yet-migrated external tool), its on-brand tile mark (shared brand art from
// /app/brand — no emoji/icon fonts; a module without one falls back to its
// core.modules emoji), and the bilingual one-line "what's inside" description
// (static — live counts belong to the Phase 2 happening feed). The tile itself
// appears via core.my_modules(); this record only decorates it.
interface ModuleMeta {
  to?: string
  href?: string
  icon?: string
  descKey?: TKey
}

const MODULE_META: Record<string, ModuleMeta> = {
  users: { to: '/users', icon: '/app/brand/heart.png', descKey: 'launcher.desc.users' },
  // POS is a platform module (parity trial); pos.html stays live at /pos.html until cut-over
  pos: { to: '/pos', icon: '/app/brand/palm-orange.png', descKey: 'launcher.desc.pos' },
  finance: { to: '/finance', icon: '/app/brand/sun-orange.png', descKey: 'launcher.desc.finance' },
  quotes: { to: '/quotes', icon: '/app/brand/house-blue.png', descKey: 'launcher.desc.quotes' },
}

export default function Launcher() {
  const { t } = useI18n()
  const { preview, has } = useAuth()
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

  // Preview semantics are the INTERSECTION of target ∩ real (see auth.has),
  // and my_modules() already returns the real session's set — so filtering it
  // by the preview-aware has() yields exactly the intersection, no catalog
  // fetch needed.
  const visible = preview ? modules.filter((m) => has(`${m.key}.view`)) : modules

  if (loading) return <div className="muted">{t('launcher.loading')}</div>
  if (error) return <div className="error">{t('launcher.error')} {error}</div>
  if (visible.length === 0)
    return <div className="card notice">{t('launcher.empty')}</div>

  return (
    <section className="launcher">
      <header className="launcher-hero">
        <img className="launcher-logo" src="/app/brand/logo-full.png" alt="לב ים" />
        <h1 className="launcher-greeting">{t('launcher.greeting')}</h1>
        <p className="launcher-sub">{t('launcher.sub')}</p>
      </header>

      <div className="launcher-grid">
        {visible.map((m, i) => {
          const meta = MODULE_META[m.key] ?? {}
          const hasDest = Boolean(meta.to || meta.href)
          const accent = i % 2 === 0 ? 'tile--blue' : 'tile--orange'
          const inner = (
            <>
              <span className="tile-medallion">
                {meta.icon ? (
                  <img className="tile-icon" src={meta.icon} alt="" aria-hidden="true" />
                ) : (
                  <span className="tile-emoji">{m.icon ?? '▫️'}</span>
                )}
              </span>
              <span className="tile-label">{m.label}</span>
              {meta.descKey && <span className="tile-desc">{t(meta.descKey)}</span>}
              <span className="tile-go">{hasDest ? t('launcher.open') : t('launcher.soon')}</span>
            </>
          )
          if (meta.to) {
            return (
              <Link key={m.key} to={meta.to} className={`tile ${accent}`}>
                {inner}
              </Link>
            )
          }
          if (meta.href) {
            return (
              <a key={m.key} href={meta.href} className={`tile ${accent}`}>
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
