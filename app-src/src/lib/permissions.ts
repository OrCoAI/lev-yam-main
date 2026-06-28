import { useAuth } from './auth'

// Permission keys, kept in one place so modules reference constants, not strings.
// These mirror the seed rows in supabase/schema/00_core.sql (format: '<module>.<action>').
export const PERM = {
  usersView: 'users.view',
  usersManage: 'users.manage',
  posView: 'pos.view',
  posCreateBill: 'pos.create_bill',
  posRefund: 'pos.refund',
  posReports: 'pos.reports',
} as const

export type PermissionKey = (typeof PERM)[keyof typeof PERM]

/** Hook form of the RLS-mirroring check, for gating UI (`const canManage = useCan(PERM.usersManage)`). */
export function useCan(perm: string): boolean {
  return useAuth().has(perm)
}
