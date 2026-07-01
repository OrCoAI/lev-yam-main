import type {
  FinanceCategory,
  FinanceExpenseCategory,
  FinanceIncomeCategory,
  FinancePaymentMethod,
} from '../../types'

export const EXPENSE_CATEGORIES: FinanceExpenseCategory[] = [
  'equipment',
  'inventory',
  'maintenance',
  'marketing',
  'salaries',
  'or_prati',
  'nimer',
  'suppliers',
]

export const INCOME_CATEGORIES: FinanceIncomeCategory[] = ['events', 'bookings', 'makrer', 'other']

export const CATEGORY_LABELS: Record<FinanceCategory, string> = {
  equipment: 'ציוד',
  inventory: 'מלאי',
  maintenance: 'תחזוקה',
  marketing: 'שיווק',
  salaries: 'משכורות',
  or_prati: 'אור פרטי',
  nimer: 'נימר',
  suppliers: 'ספקים',
  events: 'אירועים',
  bookings: 'הזמנות',
  makrer: 'מקרר',
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
