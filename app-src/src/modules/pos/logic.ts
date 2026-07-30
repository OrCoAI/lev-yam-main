// Pure table/menu logic. The menu is owner-editable DB data loaded into
// menuData.ts (open house was retired 2026-07-28 — every line is à-la-carte).
import { getMenuGroups } from './menuData'
import type { PosLine, PosTable, Payment } from './types'

export function buildItems(): PosLine[] {
  const out: PosLine[] = []
  getMenuGroups().forEach((g, gi) =>
    g.items.forEach((it, ii) => {
      if (it.isMeal) return // meals are built through the picker (meals section), not a qty stepper
      // Items that carry options still get a plain quick-add stepper here; the ✎
      // configure sheet adds a separate `variant` line when a waiter wants options/a note.
      out.push({ id: gi + '-' + ii, name: it.name, nameAr: it.nameAr, price: it.price, oh: false, cat: g.cat, catAr: g.catAr, qty: 0, sent: 0, done: 0, served: 0 })
    }),
  )
  return out
}

// Migrate the old firedAt/doneAt booleans to counts so existing tables don't break.
type LegacyLine = PosLine & { doneAt?: string }
function normalizeLine(it: LegacyLine): PosLine {
  if (typeof it.sent === 'number') return { ...it, done: it.done || 0, served: it.served || 0 }
  return { ...it, sent: it.firedAt ? it.qty || 0 : 0, done: it.doneAt ? it.qty || 0 : 0, served: 0 }
}

// Merge a saved cart with the current MENU: refresh menu items (category/price/name —
// so renames don't orphan them) while preserving quantities, custom items and combo lines.
export function reconcileItems(saved: unknown): PosLine[] {
  const arr = (Array.isArray(saved) ? (saved as LegacyLine[]) : []).map(normalizeLine)
  const byName: Record<string, PosLine> = {}
  // Only the plain quick-add lines merge by name; configured lines (combo) are
  // distinct instances kept verbatim as extras below.
  arr.forEach((it) => { if (!it.custom && !it.combo) byName[it.name] = it })
  const menuNames = new Set<string>()
  const merged = buildItems().map((f) => {
    menuNames.add(f.name)
    const o = byName[f.name]
    return o ? { ...f, qty: o.qty || 0, sent: o.sent || 0, done: o.done || 0, served: o.served || 0, firedAt: o.firedAt } : f
  })
  // Kept as-is: user-added items, configured lines (combo), and any saved line no longer
  // on the menu that has activity (menu not loaded yet, or an item edited/removed under an
  // open table) — so nothing on an open bill is silently dropped.
  const extras = arr.filter((it) => it.custom || it.combo
    || (!menuNames.has(it.name) && ((it.qty || 0) > 0 || (it.sent || 0) > 0)))
  return [...merged, ...extras]
}

// Overlay the chef-owned `done` count onto the table a waiter is editing (matched by id),
// so a dish turning ready shows live without yanking the waiter's qty / sent / served.
export function mergeKitchen(local: PosTable, server: PosTable): PosTable {
  const byId: Record<string, PosLine> = {}
  ;(server.items || []).forEach((it) => { byId[it.id] = it })
  return { ...local, items: (local.items || []).map((it) => {
    const s = byId[it.id]
    return s ? { ...it, done: s.done != null ? s.done : it.done, firedAt: it.firedAt || s.firedAt } : it
  }) }
}

// Per-unit price of a line: base plus the charges of its selected options.
export function lineUnitPrice(it: PosLine): number {
  return it.price + (it.options || []).reduce((s, o) => s + (o.price || 0), 0)
}

// À-la-carte only (open house retired): the bill is the sum of ordered lines.
export function tableTotals(t: PosTable) {
  const menuAll = t.items.reduce((s, it) => s + it.qty * lineUnitPrice(it), 0)
  const headcount = t.guests.a + t.guests.c
  const itemsCount = t.items.reduce((s, it) => s + it.qty, 0)
  return { menuAll, headcount, grand: menuAll, itemsCount }
}

// Per-line kitchen counts (qty → sent → done → served). `lineCooking` = units still
// in the kitchen; `lineOut` = units the kitchen marked done (the owner's "out"/green).
export const lineCooking = (it: PosLine) => Math.max(0, (it.sent || 0) - (it.done || 0))
export const lineOut = (it: PosLine) => it.done || 0

// Kitchen pipeline snapshot for a set of lines (qty → sent → done → served):
// cooking = in the kitchen now, ready = cooked but not yet carried out,
// served = delivered ("out"), unsent = ordered but not yet fired.
export function kitchenCounts(items: PosLine[]) {
  let cooking = 0, ready = 0, served = 0, unsent = 0
  for (const it of items) {
    cooking += lineCooking(it)
    ready += Math.max(0, (it.done || 0) - (it.served || 0))
    served += it.served || 0
    unsent += Math.max(0, (it.qty || 0) - (it.sent || 0))
  }
  return { cooking, ready, served, unsent }
}

export function nextTableNum(tables: PosTable[]): number {
  const used: Record<number, boolean> = {}
  tables.forEach((t) => { used[t.num] = true })
  let n = 1
  while (used[n]) n++
  return n
}

export function makeTable(tables: PosTable[]): PosTable {
  return {
    id: 't-' + Date.now(),
    num: nextTableNum(tables),
    name: '',
    items: buildItems(),
    guests: { a: 2, c: 0 },
    useOH: false, // new tables default to "לפי תפריט" (a-la-carte)
    openedAt: Date.now(),
  }
}

// Build the analytics-rich payload that pos_close_table(p_bill, p_items) expects.
export function buildBillPayload(t: PosTable, payment: Payment) {
  const tt = tableTotals(t)
  const ordered = t.items.filter((it) => it.qty > 0)
  return {
    bill: {
      id: t.id, table_num: t.num, name: t.name || null, status: 'paid',
      guests_adults: t.guests.a, guests_children: t.guests.c,
      pricing_mode: 'a_la_carte', // open house retired — new bills are always à-la-carte
      opened_at: new Date(t.openedAt).toISOString(),
      paid_at: new Date().toISOString(),
      items_count: tt.itemsCount,
      oh_charge: 0,
      extras_total: tt.menuAll, // whole bill is "extras" now (server validates this sum)
      menu_value: tt.menuAll,
      discount: payment.discount || 0, // taken off the gross bill
      discount_kind: payment.discountKind ?? null, // every discount is attributed
      discount_reason: payment.discountReason ?? null,
      tip: payment.tip || 0, // overpayment kept as tip
      grand_total: payment.total, // net charged (gross − discount)
      // cash_paid/card_paid are intentionally NOT sent — pos_close_table derives
      // them from the recorded payments; a client copy would only invite drift.
      items: ordered,
    },
    items: ordered.map((it) => ({
      item_name: it.name, category: it.cat || null,
      is_open_house: false, is_custom: !!it.custom,
      unit_price: lineUnitPrice(it), qty: it.qty,
      note: it.note || null, // kitchen note, kept in the bill's items jsonb for history
      // selected options travel with the line — the server re-derives their charge by id+qty
      options: (it.options || []).map((o) => ({ id: o.id, qty: o.qty ?? 1 })),
    })),
  }
}

// ── dates ──
export function jerusalemDate(d?: number | string | Date): string {
  const x = d ? new Date(d) : new Date()
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(x)
}

export function shiftDate(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}

// Start of the week containing `ymd` — Sunday, the Israeli week start.
export function startOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return shiftDate(ymd, -dow)
}

// Start of the calendar month containing `ymd` (the 1st).
export function startOfMonth(ymd: string): string {
  return ymd.slice(0, 8) + '01'
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  let c = from
  for (let i = 0; i < 92 && c <= to; i++) { out.push(c); c = shiftDate(c, 1) }
  return out
}

export const todayKey = () => new Date().toDateString()

// YYYY-MM-DD → DD.MM (compact day label for report rows)
export const dm = (ymd: string) => ymd.slice(8, 10) + '.' + ymd.slice(5, 7)

export function fmtTime(ts: number | string) {
  const d = new Date(ts)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

export function fmtDate(ts?: number | string) {
  const d = ts ? new Date(ts) : new Date()
  return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear()
}

// /pos?report=<YYYY-MM-DD> deep-link contract. POS owns it (PosModule parses
// the param); other modules (finance provenance links) build hrefs through
// posReportHref so producer and consumer can't drift apart.
export const REPORT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const posReportHref = (date: string) => `/pos?report=${date}`
