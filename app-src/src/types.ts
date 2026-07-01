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
  label: string
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
  roles: string[]
}

// Mirrors of the `finance` schema (finance.entries, finance.report RPC).

export type FinanceKind = 'income' | 'expense'

export type FinanceExpenseCategory =
  | 'rent'
  | 'utilities'
  | 'salaries'
  | 'supplies'
  | 'marketing'
  | 'maintenance'
  | 'insurance'
  | 'other'

export type FinanceIncomeCategory = 'bookings' | 'events' | 'donations' | 'grants' | 'other'

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
  created_by: string
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
