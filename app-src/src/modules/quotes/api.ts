// Data access for the quotes module. Every call goes through PostgREST with the
// user's JWT — RLS + the triggers in 30_quotes.sql enforce all invariants
// (stamps, immutability, event confirmation); this file just moves data.
import { quotes } from '../../lib/supabase'
import type { ChecklistItem, ContractRow, ContractStatus, QuoteRow, QuoteSettings, QuoteStatus } from './types'

export interface AllData {
  quotes: QuoteRow[]
  contracts: ContractRow[]
}

export async function loadAll(): Promise<AllData> {
  // Lazy sweep first (parity with serve.py): sent → expired after 7 days.
  // Ignore failures — a load must not break if the sweep is unavailable.
  try {
    await quotes().rpc('auto_expire')
  } catch {
    /* ignore */
  }
  const [q, c] = await Promise.all([
    quotes()
      .from('quotes')
      .select('*')
      .order('issue_date', { ascending: false })
      .order('quote_number', { ascending: false }),
    quotes().from('contracts').select('*'),
  ])
  if (q.error) throw new Error(q.error.message)
  if (c.error) throw new Error(c.error.message)
  return { quotes: (q.data as QuoteRow[]) ?? [], contracts: (c.data as ContractRow[]) ?? [] }
}

export async function getQuote(id: string): Promise<QuoteRow> {
  const { data, error } = await quotes().from('quotes').select('*').eq('id', id).single()
  if (error) throw new Error(error.message)
  return data as QuoteRow
}

export async function createQuote(fields: {
  customer_name: string
  contact_person: string
  phone: string
  email: string
  event_type: string
  event_date: string // '' allowed
  guests: string
  hours: string
}): Promise<QuoteRow> {
  const { data, error } = await quotes()
    .from('quotes')
    .insert({ ...fields, event_date: fields.event_date || null })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as QuoteRow
}

export async function updateQuote(id: string, patch: Partial<QuoteRow>): Promise<void> {
  const { error } = await quotes().from('quotes').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export const setQuoteStatus = (id: string, status: QuoteStatus) => updateQuote(id, { status })
export const setQuoteNotes = (id: string, notes: string) => updateQuote(id, { notes })
export const setQuoteArchived = (id: string, archived: boolean) => updateQuote(id, { archived })
export const setChecklist = (id: string, prep_checklist: ChecklistItem[]) =>
  updateQuote(id, { prep_checklist })

export async function deleteQuote(id: string): Promise<void> {
  // A signed contract blocks this at the DB level (legal record) — the trigger's
  // Hebrew message surfaces to the caller.
  const { error } = await quotes().from('quotes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function generateContract(quoteId: string): Promise<ContractRow> {
  // Snapshot the template + quote data into contracts.content NOW — later edits
  // to the master defaults must never change an existing contract.
  const { DEFAULT_CLAUSES, DEFAULT_DETAILS_FIELDS, DEFAULT_CONTRACT_DATA } = await import('./contract-defaults')
  const quote = await getQuote(quoteId)
  let ownerSignature = ''
  try {
    ownerSignature = await getOwnerSignature() // needs quotes.settings; blank is fine
  } catch {
    /* signature stays blank — a line is printed instead */
  }
  const today = new Date()
  const price =
    quote.final_price != null
      ? `${Math.round(quote.final_price).toLocaleString('en-US')} ₪ (כולל מע״מ)`
      : quote.subtotal != null
        ? `${Math.round(quote.subtotal).toLocaleString('en-US')} ₪`
        : ''
  const content = {
    data: {
      ...DEFAULT_CONTRACT_DATA,
      signDate: `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`,
      customerName: quote.customer_name,
      phone: quote.phone,
      email: quote.email,
      eventDate: quote.event_date ?? '',
      hours: quote.hours,
      eventType: quote.event_type,
      guests: quote.guests,
      price,
    },
    clauses: DEFAULT_CLAUSES,
    fields: DEFAULT_DETAILS_FIELDS,
    ownerSignature,
  }
  const { data, error } = await quotes()
    .from('contracts')
    .insert({ quote_id: quoteId, content })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ContractRow
}

export async function getContractByQuote(quoteId: string): Promise<ContractRow | null> {
  const { data, error } = await quotes().from('contracts').select('*').eq('quote_id', quoteId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as ContractRow | null
}

export async function updateContract(id: string, patch: Partial<ContractRow>): Promise<void> {
  const { error } = await quotes().from('contracts').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setContractStatus(id: string, status: ContractStatus): Promise<void> {
  // status → 'signed' auto-confirms the event via the DB trigger.
  const { error } = await quotes().from('contracts').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getSettings(): Promise<QuoteSettings> {
  const { data, error } = await quotes().from('settings').select('*').single()
  if (error) throw new Error(error.message)
  return data as QuoteSettings
}

export async function saveDefaultChecklist(items: string[]): Promise<void> {
  const { error } = await quotes()
    .from('settings')
    .update({ default_prep_checklist: items })
    .eq('id', true)
  if (error) throw new Error(error.message)
}

export async function getOwnerSignature(): Promise<string> {
  // Gated by the 'quotes.settings' permission — RLS returns zero rows without it.
  const { data, error } = await quotes().from('owner_secrets').select('owner_signature').maybeSingle()
  if (error) throw new Error(error.message)
  return (data as { owner_signature: string } | null)?.owner_signature ?? ''
}

export async function saveOwnerSignature(dataUrl: string): Promise<void> {
  const { error } = await quotes()
    .from('owner_secrets')
    .update({ owner_signature: dataUrl })
    .eq('id', true)
  if (error) throw new Error(error.message)
}
