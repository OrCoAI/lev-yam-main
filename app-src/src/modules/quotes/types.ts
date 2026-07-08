// Row shapes as PostgREST returns them from the `quotes` schema (30_quotes.sql).

export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'expired' | 'paid'
export type ContractStatus = 'draft' | 'sent' | 'signed'

export interface ChecklistItem {
  text: string
  done: boolean
}

export interface QuoteItem {
  id: string
  desc: string
  qty: string
  price: string
}

export interface AgendaItem {
  time: string
  activity: string
}

export interface QuoteTweaks {
  showVat: boolean
  showDiscount: boolean
  leftSection: 'off' | 'included' | 'agenda'
  showTerms: boolean
}

/** The document body stored in quotes.quotes.content (jsonb) — same shape as
 *  the master template's DEFAULT_DATA, minus the client fields (columns). */
export interface QuoteContent {
  greeting: string
  items: QuoteItem[]
  included: string[]
  agenda: AgendaItem[]
  vatRate: number
  discountPct: string
  depositPct: string
  cancellation: string
  terms: string
  tweaks: QuoteTweaks
}

export interface QuoteRow {
  id: string
  quote_number: string
  customer_name: string
  contact_person: string
  phone: string
  email: string
  event_type: string
  event_date: string | null // YYYY-MM-DD
  guests: string
  hours: string
  issue_date: string // YYYY-MM-DD
  status: QuoteStatus
  sent_date: string | null
  paid_date: string | null
  archived: boolean
  event_confirmed: boolean
  notes: string
  subtotal: number | null
  discount_pct: number | null
  final_price: number | null
  vat_rate: number | null
  deposit_pct: number | null
  content: Record<string, unknown>
  prep_checklist: ChecklistItem[]
}

export interface ContractRow {
  id: string
  quote_id: string
  contract_number: string
  status: ContractStatus
  generated_date: string
  sent_date: string | null
  signed_date: string | null
}

export interface QuoteSettings {
  default_prep_checklist: string[]
  quote_defaults: Record<string, unknown>
  contract_template: Record<string, unknown>
}

/** Confirmed event: explicitly confirmed on the quote, or its contract is signed. */
export function isConfirmed(quote: QuoteRow, contract?: ContractRow): boolean {
  return quote.event_confirmed || contract?.status === 'signed'
}
