import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

/** UI gate. The matching RLS policy is what actually protects the data. */
export default function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { has } = useAuth()
  if (!has(perm)) {
    return <div className="card notice">אין לך הרשאה לצפות במודול זה.</div>
  }
  return <>{children}</>
}
