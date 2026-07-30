// Mirrors of the `core` schema rows used across the platform UI.

export interface ModuleRow {
  id: string
  key: string
  label: string
  icon: string | null
  enabled: boolean
  sort: number
}

export interface RoleRow {
  id: string
  key: string
  // bilingual display names — the single source of a role's label (HE default +
  // Levantine AR). Nullable only in the transitional window before the migration
  // backfill runs; useRoleName falls back to the key.
  label_he: string | null
  label_ar: string | null
  sort: number
}

export interface PermissionRow {
  id: string
  key: string
  module: string
  action: string
  label: string
}

export interface RolePermissionRow {
  role_id: string
  permission_id: string
}

export interface AdminUser {
  user_id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  banned_until: string | null
  /** null = invited but never accepted; such a user cannot sign in at all. */
  email_confirmed_at: string | null
  roles: string[]
}

// Mirrors of the `finance` schema (finance.entries, finance.report RPC).

export type FinanceKind = 'income' | 'expense'

export type FinanceExpenseCategory =
  | 'equipment'
  | 'inventory'
  | 'maintenance'
  | 'marketing'
  | 'salaries'
  | 'or_prati'
  | 'nimer'
  | 'suppliers'
  | 'pos_food' // derived-only: pos.close_day()
  | 'pos_labor' // derived-only: pos.close_day()

export type FinanceIncomeCategory =
  | 'events' // derived-only: quotes postings via finance.record_payment()
  | 'bookings'
  | 'makrer'
  | 'other'
  | 'pos' // derived-only: pos.close_day()

export type FinanceCategory = FinanceExpenseCategory | FinanceIncomeCategory

export type FinancePaymentMethod = 'cash' | 'private' | 'grow' | 'bank'

export interface FinanceEntry {
  id: string
  kind: FinanceKind
  category: FinanceCategory
  amount: number
  payment_method: FinancePaymentMethod | null
  entry_date: string // 'YYYY-MM-DD'
  note: string | null
  source_module: string | null // null = manual entry; set = posted by a module (immutable)
  source_ref: string | null
  event_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// finance.expected — money that should move (deposits, balances, supplier bills)
export type FinanceExpectedStatus = 'open' | 'fulfilled' | 'cancelled'

export interface FinanceExpected {
  id: string
  direction: 'in' | 'out'
  category: FinanceCategory
  amount: number
  due_date: string | null // 'YYYY-MM-DD'
  reason: string // 'deposit' | 'balance' | 'supplier' | free text
  event_id: string | null
  source_module: string | null
  source_ref: string | null
  status: FinanceExpectedStatus
  fulfilled_by: string | null
  note: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FinanceCategoryBreakdown {
  kind: FinanceKind
  category: FinanceCategory
  total: number
  entry_count: number
}

export interface FinancePaymentBreakdown {
  kind: FinanceKind
  payment_method: FinancePaymentMethod | 'unknown'
  total: number
  entry_count: number
}

export interface FinanceReport {
  from: string
  to: string
  income_total: number
  expense_total: number
  net: number
  by_category: FinanceCategoryBreakdown[]
  by_payment: FinancePaymentBreakdown[]
}
