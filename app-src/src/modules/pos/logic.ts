// Pure table/menu logic, ported verbatim from pos.html.
import { MENU, OH } from './menu'
import type { PosLine, PosTable, Payment } from './types'

export function buildItems(): PosLine[] {
  const out: PosLine[] = []
  MENU.forEach((g, gi) =>
    g.items.forEach((it, ii) => {
      if (it.combo) return // combos are configured via the picker, not a qty stepper
      out.push({ id: gi + '-' + ii, name: it.name, nameAr: it.nameAr, price: it.price, oh: g.oh, cat: g.cat, catAr: g.catAr, qty: 0, sent: 0, done: 0, served: 0 })
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
  arr.forEach((it) => { if (!it.custom && !it.combo) byName[it.name] = it })
  const merged = buildItems().map((f) => {
    const o = byName[f.name]
    return o ? { ...f, qty: o.qty || 0, sent: o.sent || 0, done: o.done || 0, served: o.served || 0, firedAt: o.firedAt } : f
  })
  const extras = arr.filter((it) => it.custom || it.combo) // user-added & configured combos kept as-is
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

export function tableTotals(t: PosTable) {
  const extras = t.items.filter((it) => !it.oh).reduce((s, it) => s + it.qty * it.price, 0)
  const menuAll = t.items.reduce((s, it) => s + it.qty * it.price, 0)
  const headcount = t.guests.a + t.guests.c
  const ohByAge = t.guests.a * OH.adult + t.guests.c * OH.child
  const ohCharge = headcount > 4 ? headcount * OH.family : ohByAge
  const grand = t.useOH ? ohCharge + extras : menuAll
  const itemsCount = t.items.reduce((s, it) => s + it.qty, 0)
  return { extras, menuAll, headcount, ohByAge, ohCharge, grand, itemsCount }
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
      pricing_mode: t.useOH ? 'open_house' : 'a_la_carte',
      opened_at: new Date(t.openedAt).toISOString(),
      paid_at: new Date().toISOString(),
      items_count: tt.itemsCount,
      oh_charge: t.useOH ? tt.ohCharge : 0,
      extras_total: t.useOH ? tt.extras : tt.menuAll,
      menu_value: tt.menuAll,
      discount: payment.discount || 0, // taken off the gross bill
      tip: payment.tip || 0, // overpayment kept as tip
      grand_total: payment.total, // net charged (gross − discount)
      cash_paid: payment.cash, card_paid: payment.card,
      items: ordered,
    },
    items: ordered.map((it) => ({
      item_name: it.name, category: it.cat || null,
      is_open_house: !!it.oh, is_custom: !!it.custom,
      unit_price: it.price, qty: it.qty,
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
