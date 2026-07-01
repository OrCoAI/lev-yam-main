import type {
  FinanceCategory,
  FinanceExpenseCategory,
  FinanceIncomeCategory,
  FinancePaymentMethod,
} from '../../types'

export const EXPENSE_CATEGORIES: FinanceExpenseCategory[] = [
  'rent',
  'utilities',
  'salaries',
  'supplies',
  'marketing',
  'maintenance',
  'insurance',
  'other',
]

export const INCOME_CATEGORIES: FinanceIncomeCategory[] = [
  'bookings',
  'events',
  'donations',
  'grants',
  'other',
]

export const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  rent: 'שכירות',
  utilities: 'חשמל / מים / ארנונה',
  salaries: 'משכורות',
  supplies: 'ציוד / מלאי',
  marketing: 'שיווק',
  maintenance: 'תחזוקה',
  insurance: 'ביטוח',
  bookings: 'הזמנות',
  events: 'אירועים',
  donations: 'תרומות',
  grants: 'מענקים',
  other: 'אחר',
}

export const PAYMENT_METHODS: FinancePaymentMethod[] = ['cash', 'private', 'grow', 'bank']

export const PAYMENT_LABELS: Record<FinancePaymentMethod | 'unknown', string> = {
  cash: 'מזומן',
  private: 'פרטי',
  grow: 'Grow',
  bank: 'העברה בנקאית',
  unknown: 'ללא',
}
