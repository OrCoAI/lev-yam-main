import { useAuth } from './auth'

// Permission keys, kept in one place so modules reference constants, not strings.
// These mirror the seed rows in supabase/schema/00_core.sql (format: '<module>.<action>').
export const PERM = {
  usersView: 'users.view',
  usersManage: 'users.manage',
  posView: 'pos.view',
  posOrder: 'pos.order',          // add/edit items, take payment, close — waiter, chef, manager
  posKitchen: 'pos.kitchen',      // kitchen queue, mark dishes done — chef, manager
  posCreateBill: 'pos.create_bill',
  posRefund: 'pos.refund',
  posReports: 'pos.reports',      // day summary / sales — manager
  posManage: 'pos.manage',        // end-day, refunds/voids, settings — manager
} as const

export type PermissionKey = (typeof PERM)[keyof typeof PERM]

/** Hook form of the RLS-mirroring check, for gating UI (`const canManage = useCan(PERM.usersManage)`). */
export function useCan(perm: string): boolean {
  return useAuth().has(perm)
}
