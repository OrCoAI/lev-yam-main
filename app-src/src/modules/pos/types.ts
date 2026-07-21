// Shapes shared across the POS module. Line items and tables keep the exact
// field names pos.html writes — both UIs share the live pos_* tables until
// cut-over, so the wire format is frozen.

export interface ComboComponent {
  name: string
  nameAr?: string
  slot?: string
  slotAr?: string
  qty?: number
}

// One order line. Kitchen pipeline counts: qty (ordered) → sent → done → served.
export interface PosLine {
  id: string
  name: string
  nameAr?: string
  price: number
  oh: boolean
  cat: string
  catAr?: string
  qty: number
  sent?: number
  done?: number
  served?: number
  custom?: boolean
  combo?: boolean
  components?: ComboComponent[]
  firedAt?: string
}

export interface PosTable {
  id: string
  num: number
  name: string
  items: PosLine[]
  guests: { a: number; c: number }
  useOH: boolean
  openedAt: number
}

export interface ClosedBill {
  id: string
  num: number
  name: string
  items: PosLine[]
  guests: { a: number; c: number }
  useOH: boolean
  openedAt: number
  paidAt: number
  cash: number
  card: number
  discount: number
  tip: number
  total: number
}

export interface Payment {
  cash: number
  card: number
  discount: number
  tip: number
  total: number
}

// pos_day_report payload. Money fields are ABSENT for callers without
// pos.reports (stripped in the DB — 42_pos_platform.sql), hence optional.
export interface DayReportSummary {
  bills: number
  covers: number
  avg_minutes: number
  revenue?: number
  cash?: number
  card?: number
  tips?: number
  discounts?: number
  avg_bill?: number
}

export interface DayReportExpense {
  id: number
  kind: 'food' | 'labor'
  amount: number
  note: string | null
  by: string | null
  at: string
  business_date: string
  has_receipt: boolean
  paid_on: string | null // null = unpaid
}

export interface DayReport {
  date?: string
  summary: DayReportSummary
  food?: number
  labor?: number
  items: { name: string; category: string | null; units: number; value: number }[]
  expenses: DayReportExpense[]
}

// pos.close_day() result
export interface CloseDayResult {
  date: string
  cash: number
  card: number
  food: number
  labor: number
  posted: { leg: string; amount: number; entry_id: string; correction: boolean }[]
}
