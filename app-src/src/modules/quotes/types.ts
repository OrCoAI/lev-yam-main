// Row shapes as PostgREST returns them from the `quotes` schema (30_quotes.sql).
import { todayDbDate } from './format'

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

/** Snapshot stored in contracts.content at generation time. */
export interface ContractContent {
  data: Record<string, string>
  clauses: { title: string; text: string }[]
  fields: { key: string; label: string; notes: string; suffix?: string }[]
  ownerSignature: string
}

export interface ContractRow {
  id: string
  quote_id: string
  contract_number: string
  status: ContractStatus
  generated_date: string
  sent_date: string | null
  signed_date: string | null
  signed_name: string | null
  content: Record<string, unknown>
}

export interface QuoteSettings {
  default_prep_checklist: string[]
  quote_defaults: Record<string, unknown>
  contract_template: Record<string, unknown>
}

/** Confirmed event: approved/paid, explicitly confirmed on the quote, or its contract is
 *  signed. `event_confirmed` only gets set by the in-app contract-sign trigger — staff
 *  routinely approve quotes without ever generating/signing a contract in the app, so
 *  `status` is the real-world signal and must be checked directly (2026-07-13: verified
 *  0 of 2 production 'approved' quotes had event_confirmed set). Declined/expired always
 *  lose confirmed status even if a stale event_confirmed/signed-contract flag lingers
 *  from before the quote was declined. */
export function isConfirmed(quote: QuoteRow, contract?: ContractRow): boolean {
  if (['declined', 'expired'].includes(quote.status)) return false
  return ['approved', 'paid'].includes(quote.status) || quote.event_confirmed || contract?.status === 'signed'
}

/** Confirmed event whose date has already passed but payment hasn't landed yet.
 *  Excludes dead-end statuses too — event_confirmed isn't cleared when a quote is
 *  later declined/expired, so a once-confirmed-then-declined quote must not still
 *  read as "waiting for payment". */
export function isWaitingPayment(quote: QuoteRow, contract?: ContractRow): boolean {
  if (['paid', 'declined', 'expired'].includes(quote.status)) return false
  if (!quote.event_date || !isConfirmed(quote, contract)) return false
  return quote.event_date < todayDbDate()
}
