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

/**
 * A category slug. Deliberately `string`, not a union: since
 * `54_finance_categories.sql` the taxonomy is owner-editable DB rows
 * (`finance.categories`), so a compile-time union would go stale the moment the
 * owner adds a category. The DB enforces validity — a composite FK on
 * (kind, category) that also rejects a category belonging to the other kind.
 */
export type FinanceCategory = string

/** A row of finance.categories — the taxonomy itself. */
export interface FinanceCategoryRow {
  id: string
  kind: FinanceKind
  key: string
  label_he: string
  label_ar: string
  /** Non-null = derived-only: this module's posting function is the one writer. */
  owned_by_module: string | null
  /** Archived categories stay valid on history but are not offered on new entries. */
  active: boolean
  sort: number
  updated_at: string
  updated_by: string | null
}

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

// finance.transfers — money moving between our own pockets (cash → bank).
// Deliberately NOT a finance.entries row: it is neither income nor expense, and
// nothing that sums either reads this table (57_finance_transfers.sql).
export interface FinanceTransfer {
  id: string
  amount: number
  from_method: FinancePaymentMethod
  to_method: FinancePaymentMethod
  transfer_date: string // 'YYYY-MM-DD'
  note: string | null
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
