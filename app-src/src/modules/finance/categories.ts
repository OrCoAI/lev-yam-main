import type {
  FinanceCategory,
  FinanceExpenseCategory,
  FinanceIncomeCategory,
  FinancePaymentMethod,
} from '../../types'

// Derived-only categories have exactly one writer — a module posting function,
// never a human (docs/plans/cross-module-foundation.md §3b): 'events' posts from
// quotes, 'pos'/'pos_food'/'pos_labor' from pos.close_day(). Mirrors the DB rule.
const DERIVED_ONLY: ReadonlySet<FinanceCategory> = new Set<FinanceCategory>([
  'events',
  'pos',
  'pos_food',
  'pos_labor',
])

const ALL_EXPENSE_CATEGORIES: FinanceExpenseCategory[] = [
  'equipment',
  'inventory',
  'maintenance',
  'marketing',
  'salaries',
  'or_prati',
  'nimer',
  'suppliers',
  'pos_food',
  'pos_labor',
]

const ALL_INCOME_CATEGORIES: FinanceIncomeCategory[] = ['events', 'bookings', 'makrer', 'other', 'pos']

// Manual-entry lists — everything a human may type into the form.
export const EXPENSE_CATEGORIES = ALL_EXPENSE_CATEGORIES.filter((c) => !DERIVED_ONLY.has(c))
export const INCOME_CATEGORIES = ALL_INCOME_CATEGORIES.filter((c) => !DERIVED_ONLY.has(c))

export const PAYMENT_METHODS: FinancePaymentMethod[] = ['cash', 'private', 'grow', 'bank']

// Display labels (HE/AR) live in ./i18n.ts — categoryLabels / paymentLabels /
// statusLabels / sourceLabels / reasonLabels on the dictionary.
