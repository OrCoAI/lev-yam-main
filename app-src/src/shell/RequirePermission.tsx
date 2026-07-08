import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { useI18n } from '../lib/i18n'

/** UI gate. The matching RLS policy is what actually protects the data. */
export default function RequirePermission({ perm, children }: { perm: string; children: ReactNode }) {
  const { has } = useAuth()
  const { t } = useI18n()
  if (!has(perm)) {
    return <div className="card notice">{t('shell.noPermission')}</div>
  }
  return <>{children}</>
}
