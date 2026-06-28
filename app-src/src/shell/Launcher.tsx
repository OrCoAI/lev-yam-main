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
    <section>
      <h1 className="page-title">מה נעשה היום?</h1>
      <div className="launcher-grid">
        {modules.map((m) => {
          const dest = DESTINATIONS[m.key]
          const inner = (
            <>
              <span className="tile-icon">{m.icon ?? '▫️'}</span>
              <span className="tile-label">{m.label}</span>
            </>
          )
          if (dest?.to) {
            return (
              <Link key={m.key} to={dest.to} className="tile">
                {inner}
              </Link>
            )
          }
          if (dest?.href) {
            return (
              <a key={m.key} href={dest.href} className="tile">
                {inner}
              </a>
            )
          }
          return (
            <div key={m.key} className="tile tile-disabled" title="בקרוב">
              {inner}
            </div>
          )
        })}
      </div>
    </section>
  )
}
