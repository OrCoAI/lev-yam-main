// All POS data access — tables and RPCs both live in the `pos` schema
// (moved out of `public` at cut-over, docs/plans/pos-cutover-hardening.md).
import { pos } from '../../lib/supabase'
import { jerusalemDate, reconcileItems } from './logic'
import type { CloseDayResult, ClosedBill, DayReport, PosPayment, PosTable } from './types'

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
    pos().from('pos_tables').select('*'),
    pos().from('pos_bills').select('*').is('archived_at', null)
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
  return pos().from('pos_tables').upsert(tableToRow(t))
}

export function deleteTable(id: string) {
  return pos().from('pos_tables').delete().eq('id', id)
}

export function closeTableRpc(bill: unknown, items: unknown, payments: unknown[] = []) {
  return pos().rpc('pos_close_table', { p_bill: bill, p_items: items, p_payments: payments })
}

// ── split / partial payments (47_pos_payments) ──
// Payments for every currently-open table, keyed by bill id.
export async function fetchOpenPayments(): Promise<Record<string, PosPayment[]>> {
  const { data, error } = await pos().rpc('open_payments')
  if (error) throw error
  return (data as Record<string, PosPayment[]>) || {}
}

// Record a payment on an open bill — pos.order.
export function addPaymentRpc(billId: string, method: 'cash' | 'card', amount: number, note?: string) {
  return pos().rpc('add_payment', { p_bill_id: billId, p_method: method, p_amount: amount, p_note: note ?? null })
}

// Edit / void a recorded payment — pos.manage, and only while the bill is open.
export function editPaymentRpc(id: number, method: 'cash' | 'card', amount: number, note?: string) {
  return pos().rpc('edit_payment', { p_id: id, p_method: method, p_amount: amount, p_note: note ?? null })
}
export function voidPaymentRpc(id: number) {
  return pos().rpc('void_payment', { p_id: id })
}

// Record an item removed at checkout — pos.order when never fired, pos.manage once fired.
export function voidItemRpc(billId: string, name: string, qty: number, unitPrice: number, wasFired: boolean, reason?: string) {
  return pos().rpc('void_item', {
    p_bill_id: billId, p_name: name, p_qty: qty, p_unit_price: unitPrice,
    p_was_fired: wasFired, p_reason: reason ?? null,
  })
}

export function reopenBillRpc(id: string, num: number) {
  return pos().rpc('pos_reopen_bill', { p_id: id, p_num: num })
}

export function markItemRpc(tableId: string, itemId: string, ready: boolean) {
  return pos().rpc('pos_mark_item', { p_id: tableId, p_item_id: itemId, p_ready: ready })
}

export function archiveBills(ids: string[]) {
  return pos().from('pos_bills').update({ archived_at: new Date().toISOString() }).in('id', ids)
}

// ── menu-as-data (51_pos_menu) — owner-editable menu, source of truth ──
export interface MenuCategoryRow {
  id: string; name_he: string; name_ar: string; sort: number; pos_only: boolean; active: boolean
}
export interface MenuItemRow {
  id: string; category_id: string; name_he: string; name_ar: string; price: number | string
  sort: number; is_meal: boolean; composition: unknown; active: boolean
}
export interface MenuOptionGroupRow {
  id: string; item_id: string; name_he: string; name_ar: string
  kind: 'choice' | 'count' | 'add'; min_sel: number; max_sel: number; included: number; sort: number
}
export interface MenuOptionRow {
  id: string; group_id: string; name_he: string; name_ar: string; price_delta: number | string; sort: number
}

// Categories + items + option groups/options, sorted for display. `activeOnly` = the
// floor view (fetchMenu); the admin editor (fetchMenuAdmin) wants inactive rows too.
export interface MenuTables { categories: MenuCategoryRow[]; items: MenuItemRow[]; groups: MenuOptionGroupRow[]; options: MenuOptionRow[] }
async function fetchMenuTables(activeOnly: boolean): Promise<MenuTables> {
  const catQ = pos().from('menu_categories').select('*')
  const itemQ = pos().from('menu_items').select('*')
  const [c, i, g, o] = await Promise.all([
    (activeOnly ? catQ.eq('active', true) : catQ).order('sort'),
    (activeOnly ? itemQ.eq('active', true) : itemQ).order('sort'),
    pos().from('menu_option_groups').select('*').order('sort'),
    pos().from('menu_options').select('*').order('sort'),
  ])
  for (const r of [c, i, g, o]) if (r.error) throw r.error
  return {
    categories: (c.data as MenuCategoryRow[]) || [], items: (i.data as MenuItemRow[]) || [],
    groups: (g.data as MenuOptionGroupRow[]) || [], options: (o.data as MenuOptionRow[]) || [],
  }
}
// The active menu for the floor.
export const fetchMenu = () => fetchMenuTables(true)
// The full menu (incl. inactive) for the admin editor (pos.menu). Writes go through RLS.
export const fetchMenuAdmin = () => fetchMenuTables(false)

// updated_at/updated_by are stamped server-side (pos.touch_menu_actor trigger).
export type CategoryInput = { id: string; name_he: string; name_ar: string; sort: number; pos_only: boolean; active: boolean }
export type ItemInput = { id: string; category_id: string; name_he: string; name_ar: string; price: number; sort: number; is_meal: boolean; composition: unknown; active: boolean }
export type OptionGroupInput = { id: string; item_id: string; name_he: string; name_ar: string; kind: 'choice' | 'count' | 'add'; min_sel: number; max_sel: number; included: number; sort: number }
export type OptionInput = { id: string; group_id: string; name_he: string; name_ar: string; price_delta: number; sort: number }

export const upsertCategory = (row: CategoryInput) => pos().from('menu_categories').upsert(row)
export const deleteCategory = (id: string) => pos().from('menu_categories').delete().eq('id', id)
export const upsertItem = (row: ItemInput) => pos().from('menu_items').upsert(row)
export const deleteItem = (id: string) => pos().from('menu_items').delete().eq('id', id)
export const upsertOptionGroup = (row: OptionGroupInput) => pos().from('menu_option_groups').upsert(row)
export const deleteOptionGroup = (id: string) => pos().from('menu_option_groups').delete().eq('id', id)
export const upsertOption = (row: OptionInput) => pos().from('menu_options').upsert(row)
export const deleteOption = (id: string) => pos().from('menu_options').delete().eq('id', id)

// ── day report + costs (date-scoped, read from the DB so past days work) ──
export async function fetchDayReport(date: string): Promise<DayReport> {
  const { data, error } = await pos().rpc('pos_day_report', { p_date: date })
  if (error) throw error
  return data as DayReport
}

// Range analysis: one DB aggregate (pos.range_report) instead of a per-day fan-out.
export async function fetchRangeReport(from: string, to: string): Promise<DayReport> {
  const { data, error } = await pos().rpc('range_report', { p_from: from, p_to: to })
  if (error) throw error
  return data as DayReport
}

// created_by is server-authored (pos.set_actor_from_jwt trigger) — no client value to send
export function addExpense(date: string, kind: 'food' | 'labor', amount: number, note: string) {
  return pos().from('pos_expenses').insert({ business_date: date, kind, amount, note: note || null })
}

export function deleteExpense(id: number) {
  return pos().from('pos_expenses').delete().eq('id', id)
}

// Receipt flag — gated in the DB to the expense kind's cost permission (or manage).
export function setExpenseReceipt(id: number, hasReceipt: boolean) {
  return pos().rpc('set_expense_receipt', { p_id: id, p_has_receipt: hasReceipt })
}

// Mark paid — gated in the DB to pos.manage. paidOn = null clears it (back to unpaid).
export function setExpensePaid(id: number, paidOn: string | null) {
  return pos().rpc('set_expense_paid', { p_id: id, p_paid_on: paidOn })
}

// Edit an expense's name + amount — gated in the DB to pos.manage.
export function updateExpense(id: number, note: string, amount: number) {
  return pos().rpc('set_expense', { p_id: id, p_note: note, p_amount: amount })
}

// Whether a day has been written to the books, whether it has been
// auto-corrected since, and whether it is frozen (48_pos_day_lifecycle).
// Reports-permission only.
export interface DayStatus {
  posted: boolean
  corrected: boolean
  pinned: boolean
  pin_reason: string | null
}

export async function fetchDayStatus(date: string): Promise<DayStatus> {
  const { data, error } = await pos().rpc('day_status', { p_date: date })
  if (error) throw error
  return data as DayStatus
}

// Freeze / unfreeze a day: while pinned, POS stops writing it to the books
// entirely, so nothing entered afterwards lands. Gated in the DB to
// finance.override (owner) by the RLS policy on pos.day_pins.
export async function setDayPin(date: string, pinned: boolean, reason: string) {
  const { error } = pinned
    ? await pos().from('day_pins').insert({ business_date: date, reason })
    : await pos().from('day_pins').delete().eq('business_date', date)
  if (error) throw error
}

// ── the business day posts to finance (docs/plans/pos-module.md §3) ──
export async function closeDay(date?: string): Promise<CloseDayResult> {
  const { data, error } = await pos().rpc('close_day', { p_date: date ?? jerusalemDate() })
  if (error) throw error
  return data as CloseDayResult
}
