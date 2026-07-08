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
  // v1: creates the contract *record* (number derived by trigger). The rendered
  // document page arrives with plan step 3.
  const { data, error } = await quotes()
    .from('contracts')
    .insert({ quote_id: quoteId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as ContractRow
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
