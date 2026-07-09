import { useAuth } from './auth'

// Permission keys, kept in one place so modules reference constants, not strings.
// These mirror the seed rows in supabase/schema/00_core.sql (format: '<module>.<action>').
export const PERM = {
  usersView: 'users.view',
  usersManage: 'users.manage',
  posView: 'pos.view',
  posOrder: 'pos.order',          // add/edit items, take payment, close — waiter, chef, manager
  posKitchen: 'pos.kitchen',      // kitchen queue, mark dishes done — chef, manager
  posAnalytics: 'pos.analytics',  // operational day report (no money) — chef, manager
  posCostsFood: 'pos.costs_food', // log food costs / receipts — chef, manager
  posCostsLabor: 'pos.costs_labor', // log employee/labor costs — manager
  posCreateBill: 'pos.create_bill',
  posRefund: 'pos.refund',
  posReports: 'pos.reports',      // full financial report (revenue/net) — manager
  posManage: 'pos.manage',        // end-day, refunds/voids, settings — manager
  financeView: 'finance.view',
  financeManage: 'finance.manage',
  eventsView: 'events.view',       // shared calendar spine (40_events.sql) — owner/manager/staff
  eventsManage: 'events.manage',   // create/edit events directly — owner/manager
  eventsTasks: 'events.tasks',     // mark/manage prep tasks — owner/manager/staff
  quotesView: 'quotes.view',         // dashboard, quotes, calendar — owner/manager
  quotesManage: 'quotes.manage',     // create/edit quotes, statuses, notes, checklists
  quotesContracts: 'quotes.contracts', // generate contracts, mark sent/signed
  quotesSettings: 'quotes.settings', // owner signature, defaults, clause templates
} as const

export type PermissionKey = (typeof PERM)[keyof typeof PERM]

/** Hook form of the RLS-mirroring check, for gating UI (`const canManage = useCan(PERM.usersManage)`). */
export function useCan(perm: string): boolean {
  return useAuth().has(perm)
}
