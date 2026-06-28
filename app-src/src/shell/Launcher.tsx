import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { core } from '../lib/supabase'
import type { ModuleRow } from '../types'

// Where each module key routes to. Internal modules use a React route (`to`);
// not-yet-migrated tools (POS) link out to their live standalone page (`href`).
const DESTINATIONS: Record<string, { to?: string; href?: string }> = {
  users: { to: '/users' },
  pos: { href: '/pos.html' },
}

export default function Launcher() {
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

  if (loading) return <div className="muted">טוען מודולים…</div>
  if (error) return <div className="error">שגיאה בטעינת המודולים: {error}</div>
  if (modules.length === 0)
    return <div className="card notice">אין מודולים זמינים להרשאות שלך עדיין.</div>

  return (
    <section className="launcher">
      <header className="launcher-hero">
        <img className="launcher-logo" src="/app/brand/logo-full.png" alt="לב ים" />
        <h1 className="launcher-greeting">מה נעשה היום?</h1>
        <p className="launcher-sub">בחרו מודול כדי להתחיל</p>
      </header>

      <div className="launcher-grid">
        {modules.map((m, i) => {
          const dest = DESTINATIONS[m.key]
          const accent = i % 2 === 0 ? 'tile--blue' : 'tile--orange'
          const inner = (
            <>
              <span className="tile-medallion">{m.icon ?? '▫️'}</span>
              <span className="tile-label">{m.label}</span>
              <span className="tile-go">{dest ? 'פתח ←' : 'בקרוב'}</span>
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
            <div key={m.key} className={`tile ${accent} tile-disabled`} title="בקרוב">
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
