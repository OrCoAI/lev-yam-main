// All POS data access. The live pos_* tables sit in the DEFAULT (public)
// schema until cut-over, so reads/writes use the base client; the platform's
// own functions (close_day) live in the `pos` schema.
import { pos, supabase } from '../../lib/supabase'
import { jerusalemDate, reconcileItems, dateRange } from './logic'
import type { CloseDayResult, ClosedBill, DayReport, PosTable } from './types'

// ── row mappers (wire format frozen — shared with pos.html) ──
interface TableRow {
  id: string
  num: number
  name: string | null
  guests_adults: number
  guests_children: number
  pricing_mode: string
  opened_at: string | null
  items: unknown
  updated_at: string
}

export function tableToRow(t: PosTable): TableRow {
  return {
    id: t.id, num: t.num, name: t.name || null,
    guests_adults: t.guests.a, guests_children: t.guests.c,
    pricing_mode: t.useOH ? 'open_house' : 'a_la_carte',
    opened_at: new Date(t.openedAt).toISOString(),
    items: t.items,
    updated_at: new Date().toISOString(),
  }
}

export function rowToTable(r: TableRow): PosTable {
  return {
    id: r.id, num: r.num, name: r.name || '',
    items: reconcileItems(r.items),
    guests: { a: r.guests_adults || 0, c: r.guests_children || 0 },
    useOH: r.pricing_mode !== 'a_la_carte',
    openedAt: r.opened_at ? Date.parse(r.opened_at) : Date.now(),
  }
}

interface BillRow extends TableRow {
  table_num: number
  paid_at: string | null
  cash_paid: number | string
  card_paid: number | string
  discount: number | string
  tip: number | string
  grand_total: number | string
}

export function billToClosed(r: BillRow): ClosedBill {
  return {
    id: r.id, num: r.table_num, name: r.name || '',
    items: Array.isArray(r.items) ? r.items : [],
    guests: { a: r.guests_adults || 0, c: r.guests_children || 0 },
    useOH: r.pricing_mode !== 'a_la_carte',
    openedAt: r.opened_at ? Date.parse(r.opened_at) : Date.now(),
    paidAt: r.paid_at ? Date.parse(r.paid_at) : Date.now(),
    cash: Number(r.cash_paid) || 0,
    card: Number(r.card_paid) || 0,
    discount: Number(r.discount) || 0,
    tip: Number(r.tip) || 0,
    total: Number(r.grand_total) || 0,
  }
}

// ── live floor ──
export async function fetchAll(): Promise<{ tables: PosTable[]; closed: ClosedBill[] }> {
  const [tg, bg] = await Promise.all([
    supabase.from('pos_tables').select('*'),
    supabase.from('pos_bills').select('*').is('archived_at', null)
      .order('paid_at', { ascending: false }).limit(300),
  ])
  if (tg.error) throw tg.error
  if (bg.error) throw bg.error
  return {
    tables: ((tg.data as TableRow[] | null) || []).map(rowToTable),
    closed: ((bg.data as BillRow[] | null) || []).map(billToClosed),
  }
}

export function upsertTable(t: PosTable) {
  return supabase.from('pos_tables').upsert(tableToRow(t))
}

export function deleteTable(id: string) {
  return supabase.from('pos_tables').delete().eq('id', id)
}

export function closeTableRpc(bill: unknown, items: unknown) {
  return supabase.rpc('pos_close_table', { p_bill: bill, p_items: items })
}

export function reopenBillRpc(id: string, num: number) {
  return supabase.rpc('pos_reopen_bill', { p_id: id, p_num: num })
}

export function markItemRpc(tableId: string, itemId: string, ready: boolean) {
  return supabase.rpc('pos_mark_item', { p_id: tableId, p_item_id: itemId, p_ready: ready })
}

export function archiveBills(ids: string[]) {
  return supabase.from('pos_bills').update({ archived_at: new Date().toISOString() }).in('id', ids)
}

// ── day report + costs (date-scoped, read from the DB so past days work) ──
export async function fetchDayReport(date: string): Promise<DayReport> {
  const { data, error } = await supabase.rpc('pos_day_report', { p_date: date })
  if (error) throw error
  return data as DayReport
}

// Multi-day analysis: fetch each day's report (parallel) and merge into one shape.
export async function fetchRangeReport(from: string, to: string): Promise<DayReport> {
  const reps = await Promise.all(dateRange(from, to).map((d) => fetchDayReport(d)))
  const sum: Record<string, number> = { bills: 0, covers: 0, revenue: 0, cash: 0, card: 0, tips: 0, discounts: 0 }
  let food = 0
  let labor = 0
  const itemMap: Record<string, { name: string; category: string | null; units: number; value: number }> = {}
  reps.forEach((r) => {
    const s = (r.summary || {}) as unknown as Record<string, unknown>
    for (const k in sum) sum[k] += Number(s[k]) || 0
    food += Number(r.food) || 0
    labor += Number(r.labor) || 0
    ;(r.items || []).forEach((it) => {
      const m = itemMap[it.name] || (itemMap[it.name] = { name: it.name, category: it.category, units: 0, value: 0 })
      m.units += Number(it.units) || 0
      m.value += Number(it.value) || 0
    })
  })
  return {
    summary: sum as unknown as DayReport['summary'],
    food, labor,
    items: Object.values(itemMap).sort((a, b) => b.units - a.units),
    expenses: [],
  }
}

export function addExpense(date: string, kind: 'food' | 'labor', amount: number, note: string, by: string) {
  return supabase.from('pos_expenses').insert({
    business_date: date, kind, amount, note: note || null, created_by: by,
  })
}

export function deleteExpense(id: number) {
  return supabase.from('pos_expenses').delete().eq('id', id)
}

// ── the business day posts to finance (docs/plans/pos-module.md §3) ──
export async function closeDay(date?: string): Promise<CloseDayResult> {
  const { data, error } = await pos().rpc('close_day', { p_date: date ?? jerusalemDate() })
  if (error) throw error
  return data as CloseDayResult
}
