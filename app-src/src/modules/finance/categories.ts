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

export const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  equipment: 'ציוד',
  inventory: 'מלאי',
  maintenance: 'תחזוקה',
  marketing: 'שיווק',
  salaries: 'משכורות',
  or_prati: 'אור פרטי',
  nimer: 'נימר',
  suppliers: 'ספקים',
  pos_food: 'POS — מזון',
  pos_labor: 'POS — שכר יומי',
  events: 'אירועים',
  bookings: 'הזמנות',
  makrer: 'מקרר',
  other: 'אחר',
  pos: 'POS — יום מכירות',
}

export const PAYMENT_METHODS: FinancePaymentMethod[] = ['cash', 'private', 'grow', 'bank']

export const PAYMENT_LABELS: Record<FinancePaymentMethod | 'unknown', string> = {
  cash: 'מזומן',
  private: 'פרטי',
  grow: 'Grow',
  bank: 'העברה בנקאית',
  unknown: 'ללא',
}

// Provenance badge labels (finance.entries.source_module / finance.expected.source_module)
const SOURCE_LABELS: Record<string, string> = {
  quotes: 'הצעות מחיר',
  pos: 'POS',
  finance: 'צפי',
}

export function sourceLabel(module: string): string {
  return SOURCE_LABELS[module] ?? module
}

const REASON_LABELS: Record<string, string> = {
  deposit: 'מקדמה',
  balance: 'יתרה',
  supplier: 'ספק',
}

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason
}
