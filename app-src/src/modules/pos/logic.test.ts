// Money math + kitchen pipeline math for the live POS (G6.2). These are the cheapest,
// highest-value tests in the repo: pos_close_table re-validates what buildBillPayload
// sends, so a client/server disagreement here is a rejected bill mid-service.
import { describe, expect, it } from 'vitest'
import type { MenuGroup } from './menu'
import type { PosLine, PosTable, Payment } from './types'
import {
  buildBillPayload, buildItems, dateRange, kitchenCounts, lineUnitPrice, makeTable, mergeKitchen,
  nextTableNum, reconcileItems, shiftDate, startOfMonth, startOfWeek, tableTotals,
} from './logic'

// A tiny fixture menu (the real one is owner-editable DB data behind menuData.ts).
const MENU: MenuGroup[] = [
  { cat: 'דגים', catAr: 'سمك', items: [
    { name: 'דג יום', nameAr: 'سمكة اليوم', price: 120 },
    { name: 'ארוחת דג', nameAr: 'وجبة سمك', price: 180, isMeal: true },
  ] },
  { cat: 'שתייה', catAr: 'مشروبات', items: [{ name: 'לימונדה', nameAr: 'ليموناضة', price: 14 }] },
]

const line = (over: Partial<PosLine> = {}): PosLine =>
  ({ id: 'x', name: 'דג יום', price: 120, oh: false, cat: 'דגים', qty: 0, sent: 0, done: 0, served: 0, ...over })
// Through the production constructor, so a new PosTable default is seen by these tests too.
const table = (items: PosLine[], over: Partial<PosTable> = {}): PosTable =>
  ({ ...makeTable([], MENU), id: 't-1', num: 3, items, guests: { a: 2, c: 1 }, openedAt: 1_700_000_000_000, ...over })
const payment = (over: Partial<Payment> = {}): Payment => ({ cash: 0, card: 0, discount: 0, tip: 0, total: 0, ...over })

describe('buildItems', () => {
  it('lists every à-la-carte item with zero counts and skips meals (built through the picker)', () => {
    const items = buildItems(MENU)
    expect(items.map((i) => i.name)).toEqual(['דג יום', 'לימונדה'])
    expect(items[0]).toMatchObject({ id: '0-0', cat: 'דגים', catAr: 'سمك', qty: 0, sent: 0, done: 0, served: 0, oh: false })
  })
})

describe('lineUnitPrice / tableTotals', () => {
  it('adds selected option charges to the base price', () => {
    expect(lineUnitPrice(line({ price: 120 }))).toBe(120)
    expect(lineUnitPrice(line({ price: 120, options: [{ id: 'o1', name: 'תוספת', price: 10 }, { id: 'o2', name: 'בחירה', price: 0 }] }))).toBe(130)
  })
  it('sums qty × unit price; grand equals menuAll (open house retired); counts heads and items', () => {
    const t = table([line({ qty: 2 }), line({ id: 'y', name: 'לימונדה', price: 14, qty: 3, options: [{ id: 'o', name: 'קרח', price: 1 }] })])
    expect(tableTotals(t)).toEqual({ menuAll: 285, headcount: 3, grand: 285, itemsCount: 5 })
  })
  it('an empty table totals zero', () => {
    expect(tableTotals(table([], { guests: { a: 0, c: 0 } }))).toEqual({ menuAll: 0, headcount: 0, grand: 0, itemsCount: 0 })
  })
})

describe('buildBillPayload', () => {
  const paid = payment({ total: 230, tip: 5, discount: 10, discountKind: 'staff', discountReason: 'חבר צוות' })
  const t = table([line({ qty: 2, note: 'בלי מלח', options: [{ id: 'o1', name: 'תוספת', price: 0, qty: 2 }] }), line({ id: 'z', name: 'לימונדה', price: 14, qty: 0 })])
  const p = buildBillPayload(t, paid)

  it('sends only ordered lines, with unit price and option ids the server re-derives', () => {
    expect(p.items).toHaveLength(1)
    expect(p.items[0]).toMatchObject({ item_name: 'דג יום', qty: 2, unit_price: 120, note: 'בלי מלח', is_custom: false, is_open_house: false, options: [{ id: 'o1', qty: 2 }] })
    expect(p.bill.items).toHaveLength(1)
  })
  it('gross totals come from the table, net/discount/tip from the payment, never cash/card', () => {
    expect(p.bill).toMatchObject({ table_num: 3, status: 'paid', pricing_mode: 'a_la_carte', guests_adults: 2, guests_children: 1,
      items_count: 2, oh_charge: 0, extras_total: 240, menu_value: 240, discount: 10, discount_kind: 'staff', discount_reason: 'חבר צוות', tip: 5, grand_total: 230 })
    expect(p.bill).not.toHaveProperty('cash_paid')
    expect(p.bill).not.toHaveProperty('card_paid')
    expect(p.bill.opened_at).toBe(new Date(1_700_000_000_000).toISOString())
  })
  it('defaults discount and tip to 0 and attribution to null', () => {
    const q = buildBillPayload(t, payment({ total: 240 }))
    expect(q.bill).toMatchObject({ discount: 0, tip: 0, discount_kind: null, discount_reason: null, name: null })
  })
})

describe('reconcileItems', () => {
  it('refreshes menu lines (price/category) while keeping quantities and pipeline counts', () => {
    const saved = [line({ price: 99, cat: 'ישן', qty: 2, sent: 2, done: 1, served: 0 })]
    const out = reconcileItems(saved, MENU)
    expect(out.find((i) => i.name === 'דג יום')).toMatchObject({ price: 120, cat: 'דגים', qty: 2, sent: 2, done: 1, served: 0 })
    expect(out.find((i) => i.name === 'לימונדה')).toMatchObject({ qty: 0 })
  })
  it('keeps custom and configured (combo) lines verbatim as extras', () => {
    const custom = line({ id: 'c', name: 'משהו אחר', price: 50, qty: 1, custom: true })
    const combo = line({ id: 'k', name: 'דג יום', price: 130, qty: 1, combo: true, note: 'חריף' })
    const out = reconcileItems([custom, combo], MENU)
    expect(out.filter((i) => i.custom || i.combo)).toEqual([custom, combo])
    expect(out.filter((i) => i.name === 'דג יום')).toHaveLength(2) // menu line + configured line
  })
  it('never drops an off-menu line with activity, but drops an idle one', () => {
    const removed = line({ id: 'r', name: 'מנה שנמחקה', qty: 1, sent: 1 })
    const idle = line({ id: 'i', name: 'מנה שנמחקה 2', qty: 0 })
    const names = reconcileItems([removed, idle], MENU).map((i) => i.name)
    expect(names).toContain('מנה שנמחקה')
    expect(names).not.toContain('מנה שנמחקה 2')
  })
  it('migrates legacy firedAt/doneAt booleans to counts and tolerates non-array input', () => {
    const legacy = { id: 'l', name: 'דג יום', price: 120, oh: false, cat: 'דגים', qty: 3, firedAt: '10:00', doneAt: '10:20' } as unknown as PosLine
    expect(reconcileItems([legacy], MENU).find((i) => i.name === 'דג יום')).toMatchObject({ qty: 3, sent: 3, done: 3, served: 0 })
    expect(reconcileItems(null, MENU).map((i) => i.name)).toEqual(['דג יום', 'לימונדה'])
  })
})

describe('kitchen pipeline', () => {
  it('kitchenCounts derives cooking/ready/served/unsent per line and never goes negative', () => {
    const items = [line({ qty: 4, sent: 3, done: 2, served: 1 }), line({ id: 'b', qty: 1, sent: 0 }), line({ id: 'c', qty: 1, sent: 1, done: 2, served: 3 })]
    expect(kitchenCounts(items)).toEqual({ cooking: 1, ready: 1, served: 4, unsent: 2 })
  })
  it('mergeKitchen overlays the chef-owned done count by id without touching qty/sent/served', () => {
    const local = table([line({ id: 'a', qty: 2, sent: 2, done: 0, served: 0 }), line({ id: 'b', qty: 1 })])
    const server = table([line({ id: 'a', qty: 9, sent: 9, done: 2, served: 9, firedAt: '12:00' })])
    const merged = mergeKitchen(local, server)
    expect(merged.items[0]).toMatchObject({ qty: 2, sent: 2, done: 2, served: 0, firedAt: '12:00' })
    expect(merged.items[1]).toEqual(local.items[1])
  })
  it('nextTableNum fills the lowest free number', () => {
    expect(nextTableNum([])).toBe(1)
    expect(nextTableNum([table([], { num: 1 })])).toBe(2)
    expect(nextTableNum([table([], { num: 1 }), table([], { num: 2 }), table([], { num: 4 })])).toBe(3)
    expect(makeTable([table([], { num: 1 })], MENU)).toMatchObject({ num: 2, name: '', useOH: false, guests: { a: 2, c: 0 } })
  })
})

describe('business-day date helpers (UTC arithmetic, Sunday week start)', () => {
  it('shiftDate crosses month and year boundaries', () => {
    expect(shiftDate('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01')
  })
  it('startOfWeek returns the Sunday, startOfMonth the 1st', () => {
    expect(startOfWeek('2026-09-09')).toBe('2026-09-06') // Wednesday → Sunday
    expect(startOfWeek('2026-09-06')).toBe('2026-09-06')
    expect(startOfMonth('2026-09-09')).toBe('2026-09-01')
  })
  it('dateRange is inclusive, ordered, and capped at 92 days', () => {
    expect(dateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
    expect(dateRange('2026-03-02', '2026-02-27')).toEqual([])
    expect(dateRange('2026-01-01', '2026-12-31')).toHaveLength(92)
  })
})
