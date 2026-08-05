// Dev-only Supabase mock (`?preview`): seeds a fake session and intercepts
// fetch to the Supabase URL, answering from in-memory fixtures. Lets anyone
// run and *see* the authed UI (dashboard, documents) with realistic data and
// zero network. Loaded by main.tsx before any app module, never in prod.
import {
  adminUsersFixture,
  contractsFixture,
  financeCategoriesFixture,
  financeEntriesFixture,
  financeExpectedFixture,
  financeTransfersFixture,
  ownerSecretsFixture,
  permissionRowsFixture,
  permissionsFixture,
  posBillsFixture,
  posExpensesFixture,
  posTablesFixture,
  quotesFixture,
  rolePermissionsFixture,
  rolesFixture,
  settingsFixture,
  userRolesFixture,
} from './fixtures'

type Row = Record<string, unknown>

const SUPA_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
const ref = new URL(SUPA_URL).hostname.split('.')[0]

// ── fake session (storage read by supabase-js; no verification client-side) ──
const b64url = (o: object) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 12
const user = {
  id: '00000000-0000-4000-8000-00000000dead',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'preview@levyam.com',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
const session = {
  access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', exp })}.mock`,
  token_type: 'bearer',
  expires_in: 60 * 60 * 12,
  expires_at: exp,
  refresh_token: 'mock-refresh',
  user,
}
localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session))

// ── in-memory tables (module-level: survives SPA navigation, resets on reload) ──
const db: Record<string, Row[]> = {
  quotes: quotesFixture.map((r) => ({ ...r })),
  contracts: contractsFixture.map((r) => ({ ...r })),
  settings: [{ ...settingsFixture }],
  owner_secrets: [{ ...ownerSecretsFixture }],
  categories: financeCategoriesFixture.map((r) => ({ ...r })),
  entries: financeEntriesFixture.map((r) => ({ ...r })),
  expected: financeExpectedFixture.map((r) => ({ ...r })),
  roles: rolesFixture.map((r) => ({ ...r })),
  permissions: permissionRowsFixture.map((r) => ({ ...r })),
  role_permissions: rolePermissionsFixture.map((r) => ({ ...r })),
  user_roles: userRolesFixture.map((r) => ({ ...r })),
  admin_users: adminUsersFixture.map((r) => ({ ...r })),
  pos_tables: posTablesFixture.map((r) => ({ ...r })),
  pos_bills: posBillsFixture.map((r) => ({ ...r })),
  pos_expenses: posExpensesFixture.map((r) => ({ ...r })),
  // starts empty: a pin is something the owner does, not a seeded state
  day_pins: [],
  transfers: financeTransfersFixture.map((r) => ({ ...r })),
}
let seq = 100

// stands in for core.modules — ONE list, read both by my_modules and by the
// reconciliation mock's ownership check (55 guards source_module against this
// table, so the mock must too or preview badges a tile the DB would not)
const MODULES = [
  { key: 'users', label: 'Users & Permissions', icon: '🔐', sort: 10 },
  { key: 'pos', label: 'קופה', icon: '🧾', sort: 20 },
  { key: 'finance', label: 'כספים', icon: '💰', sort: 30 },
  { key: 'quotes', label: 'הצעות מחיר', icon: '📋', sort: 40 },
]
const MODULE_KEYS: string[] = MODULES.map((m) => m.key)

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const noContent = () => new Response(null, { status: 204 })

// gte/lte operand comparison: numeric when both sides are numbers, else
// lexicographic (correct for ISO dates; '99' vs '100' would lie as strings)
function compare(value: unknown, operand: string): number {
  const a = Number(value)
  const b = Number(operand)
  if (Number.isFinite(a) && Number.isFinite(b) && String(value).trim() !== '' && operand.trim() !== '')
    return a - b
  const s = String(value)
  return s < operand ? -1 : s > operand ? 1 : 0
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const m = v.match(/^(eq|gte|lte)\.(.*)$/)
    if (!m) continue
    if (m[1] === 'eq' && String(row[k]) !== m[2]) return false
    if (m[1] === 'gte' && compare(row[k], m[2]) < 0) return false
    if (m[1] === 'lte' && compare(row[k], m[2]) > 0) return false
  }
  return true
}

// .select() after update/delete asks PostgREST to return the affected rows —
// the app asserts on that count, so the mock must honor it like the real thing
const wantsRows = (req: Request) => (req.headers.get('Prefer') ?? '').includes('return=representation')

function respond(rows: Row[], req: Request, created = false): Response {
  const single = (req.headers.get('Accept') ?? '').includes('vnd.pgrst.object+json')
  if (!single) return json(rows, created ? 201 : 200)
  if (rows.length === 1) return json(rows[0], created ? 201 : 200)
  return json(
    { code: 'PGRST116', message: `JSON object requested, ${rows.length} rows returned`, details: null, hint: null },
    406,
  )
}

async function handleRest(table: string, req: Request, params: URLSearchParams): Promise<Response> {
  const rows = db[table] ?? []
  if (req.method === 'GET') {
    let out = rows.filter((r) => matches(r, params))
    if (table === 'quotes')
      out = [...out].sort(
        (a, b) =>
          String(b.issue_date).localeCompare(String(a.issue_date)) ||
          String(b.quote_number).localeCompare(String(a.quote_number)),
      )
    if (table === 'entries')
      out = [...out].sort(
        (a, b) =>
          String(b.entry_date).localeCompare(String(a.entry_date)) ||
          String(b.created_at).localeCompare(String(a.created_at)),
      )
    if (table === 'expected')
      out = [...out].sort(
        (a, b) => String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999')),
      )
    // the UI relies on server ordering here (role columns by sort; the matrix
    // emits a group header on every module change) — don't trust fixture order
    if (table === 'roles') out = [...out].sort((a, b) => Number(a.sort) - Number(b.sort))
    // auth's `select('roles!inner(...)')` embed on user_roles: attach the role row
    if (table === 'user_roles' && (params.get('select') ?? '').includes('roles'))
      out = out.map((ur) => ({ ...ur, roles: db.roles.find((r) => r.id === ur.role_id) ?? null }))
    if (table === 'permissions')
      out = [...out].sort(
        (a, b) =>
          String(a.module).localeCompare(String(b.module)) ||
          String(a.action).localeCompare(String(b.action)),
      )
    return respond(out, req)
  }
  if (req.method === 'POST') {
    const body = (await req.json()) as Row
    // upsert (Prefer: resolution=merge-duplicates / on_conflict): merge into the existing row
    const existing = body.id != null ? rows.find((r) => r.id === body.id) : undefined
    if (existing) {
      Object.assign(existing, body)
      return respond([existing], req)
    }
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const defaults: Record<string, Row> = {
      quotes: {
        status: 'draft', archived: false, event_confirmed: false, notes: '',
        subtotal: null, discount_pct: null, final_price: null, vat_rate: 0.18,
        deposit_pct: 30, content: {}, prep_checklist: [], sent_date: null, paid_date: null,
        issue_date: today, quote_number: `LY-MOCK-${String(++seq)}`,
      },
      contracts: {
        contract_number: 'C-' + String((db.quotes.find((q) => q.id === body.quote_id) ?? {}).quote_number ?? 'LY-MOCK'),
        status: 'draft', generated_date: today, sent_date: null, signed_date: null, signed_name: null,
      },
      entries: {
        source_module: null, source_ref: null, event_id: null, note: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      },
      pos_expenses: { note: null, created_by: null, created_at: new Date().toISOString() },
      day_pins: { reason: '', pinned_by: null, pinned_at: new Date().toISOString() },
      transfers: { note: null, created_by: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    }
    const row: Row = {
      id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
      ...(defaults[table] ?? {}),
      ...body,
    }
    rows.push(row)
    return respond([row], req, true)
  }
  if (req.method === 'PATCH') {
    const patch = (await req.json()) as Row
    const hit = rows.filter((r) => matches(r, params))
    hit.forEach((r) => Object.assign(r, patch))
    // mirror the DB triggers the UI relies on
    if (table === 'contracts' && patch.status === 'signed')
      hit.forEach((r) => {
        r.signed_date ??= new Date().toISOString().slice(0, 10)
        const quote = db.quotes.find((q) => q.id === r.quote_id)
        if (quote) quote.event_confirmed = true
      })
    return wantsRows(req) ? respond(hit, req) : noContent()
  }
  if (req.method === 'DELETE') {
    const hit = rows.filter((r) => matches(r, params))
    db[table] = rows.filter((r) => !matches(r, params))
    if (table === 'quotes') db.contracts = db.contracts.filter((c) => db.quotes.some((q) => q.id === c.quote_id))
    return wantsRows(req) ? respond(hit, req) : noContent()
  }
  return json({ message: 'unsupported' }, 405)
}

const realFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const req = new Request(input, init)
  if (!req.url.startsWith(SUPA_URL)) return realFetch(input, init)
  const url = new URL(req.url)
  const path = url.pathname

  if (path.startsWith('/auth/v1/token')) return json(session)
  if (path === '/auth/v1/user') return json(user)
  if (path === '/auth/v1/logout') return noContent()
  if (path.startsWith('/auth/v1/')) return json({}, 200)

  const rpc = path.match(/^\/rest\/v1\/rpc\/(.+)$/)
  if (rpc) {
    if (rpc[1] === 'my_permissions') return json(permissionsFixture)
    if (rpc[1] === 'apply_role_permissions') {
      const body = (await req.json()) as {
        p_adds?: { role_id: string; permission_id: string }[]
        p_removes?: { role_id: string; permission_id: string }[]
      }
      for (const a of body.p_adds ?? []) {
        if (
          !db.role_permissions.some(
            (rp) => rp.role_id === a.role_id && rp.permission_id === a.permission_id,
          )
        )
          db.role_permissions.push({ ...a })
      }
      db.role_permissions = db.role_permissions.filter(
        (rp) =>
          !(body.p_removes ?? []).some(
            (x) => x.role_id === rp.role_id && x.permission_id === rp.permission_id,
          ),
      )
      return json(null)
    }
    if (rpc[1] === 'admin_list_users')
      return json(
        db.admin_users.map((u) => ({
          ...u,
          roles: db.user_roles
            .filter((ur) => ur.user_id === u.user_id)
            .map((ur) => db.roles.find((r) => r.id === ur.role_id)?.key)
            .filter(Boolean),
        })),
      )
    if (rpc[1] === 'report') {
      const body = (await req.json()) as { p_from: string; p_to: string }
      const inRange = db.entries.filter(
        (e) => String(e.entry_date) >= body.p_from && String(e.entry_date) <= body.p_to,
      )
      const total = (kind: string) =>
        inRange.filter((e) => e.kind === kind).reduce((s, e) => s + Number(e.amount), 0)
      const income = total('income')
      const expense = total('expense')
      const groupBy = (field: string) => {
        const acc = new Map<string, { kind: unknown; k: unknown; total: number; n: number }>()
        for (const e of inRange) {
          const key = `${e.kind}:${e[field] ?? 'unknown'}`
          const g = acc.get(key) ?? { kind: e.kind, k: e[field] ?? 'unknown', total: 0, n: 0 }
          g.total += Number(e.amount)
          g.n += 1
          acc.set(key, g)
        }
        return [...acc.values()]
      }
      return json({
        from: body.p_from,
        to: body.p_to,
        income_total: income,
        expense_total: expense,
        net: income - expense,
        by_category: groupBy('category').map((g) => ({
          kind: g.kind, category: g.k, total: g.total, entry_count: g.n,
        })),
        by_payment: groupBy('payment_method').map((g) => ({
          kind: g.kind, payment_method: g.k, total: g.total, entry_count: g.n,
        })),
      })
    }
    if (rpc[1] === 'my_modules') return json(MODULES)
    if (rpc[1] === 'record_payment') {
      // mirror finance.record_payment: post the entry + fulfill the expectation
      const body = (await req.json()) as Row
      const exp = db.expected.find((r) => r.id === body.p_expected)
      if (!exp) return json({ message: 'expected payment not found' }, 400)
      if (exp.status !== 'open') return json({ message: `הצפי כבר במצב ${exp.status}` }, 400)
      const entry: Row = {
        id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
        kind: exp.direction === 'in' ? 'income' : 'expense',
        category: exp.category,
        amount: body.p_amount ?? exp.amount,
        payment_method: body.p_method ?? null,
        entry_date: body.p_date ?? new Date().toISOString().slice(0, 10),
        note: body.p_note ?? exp.reason,
        source_module: exp.source_module ?? 'finance',
        source_ref: `expected:${exp.id}`,
        event_id: exp.event_id,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      db.entries.unshift(entry)
      exp.status = 'fulfilled'
      exp.fulfilled_by = entry.id
      return json(entry.id)
    }
    // ── POS RPCs — mirror the server behavior the module relies on ──
    if (rpc[1] === 'pos_day_report') {
      const body = (await req.json()) as { p_date: string }
      const day = body.p_date
      const bills = db.pos_bills.filter((b) => b.status === 'paid' && String(b.paid_at).slice(0, 10) === day)
      const exps = db.pos_expenses.filter((e) => e.business_date === day)
      const num = (v: unknown) => Number(v) || 0
      const sum = (k: string) => bills.reduce((s, b) => s + num(b[k]), 0)
      return json({
        date: day,
        summary: {
          bills: bills.length,
          covers: bills.reduce((s, b) => s + num(b.guests_adults) + num(b.guests_children), 0),
          revenue: sum('grand_total'), cash: sum('cash_paid'), card: sum('card_paid'),
          tips: sum('tip'), discounts: sum('discount'),
          avg_bill: bills.length ? Math.round(sum('grand_total') / bills.length) : 0,
          avg_minutes: 45,
        },
        food: exps.filter((e) => e.kind === 'food').reduce((s, e) => s + num(e.amount), 0),
        labor: exps.filter((e) => e.kind === 'labor').reduce((s, e) => s + num(e.amount), 0),
        items: [
          { name: 'לבנה', category: 'פתיחים וסלטים', units: 3, value: 60 },
          { name: 'מנת דג', category: 'תוספות', units: 2, value: 160 },
        ],
        expenses: exps.map((e) => ({ id: e.id, kind: e.kind, amount: e.amount, note: e.note, by: e.created_by, at: e.created_at })),
      })
    }
    if (rpc[1] === 'range_report') {
      const body = (await req.json()) as { p_from: string; p_to: string }
      const { p_from, p_to } = body
      const inRange = (d: string) => d >= p_from && d <= p_to
      const bills = db.pos_bills.filter((b) => b.status === 'paid' && inRange(String(b.paid_at).slice(0, 10)))
      const exps = db.pos_expenses.filter((e) => inRange(String(e.business_date)))
      const num = (v: unknown) => Number(v) || 0
      const sum = (k: string) => bills.reduce((s, b) => s + num(b[k]), 0)
      return json({
        date: p_from === p_to ? p_from : null,
        from: p_from, to: p_to,
        summary: {
          bills: bills.length,
          covers: bills.reduce((s, b) => s + num(b.guests_adults) + num(b.guests_children), 0),
          revenue: sum('grand_total'), cash: sum('cash_paid'), card: sum('card_paid'),
          tips: sum('tip'), discounts: sum('discount'),
          avg_bill: bills.length ? Math.round(sum('grand_total') / bills.length) : 0,
          avg_minutes: 45,
        },
        food: exps.filter((e) => e.kind === 'food').reduce((s, e) => s + num(e.amount), 0),
        labor: exps.filter((e) => e.kind === 'labor').reduce((s, e) => s + num(e.amount), 0),
        items: [
          { name: 'לבנה', category: 'פתיחים וסלטים', units: 3, value: 60 },
          { name: 'מנת דג', category: 'תוספות', units: 2, value: 160 },
        ],
        expenses: p_from === p_to
          ? exps.map((e) => ({ id: e.id, kind: e.kind, amount: e.amount, note: e.note, by: e.created_by, at: e.created_at }))
          : [],
      })
    }
    if (rpc[1] === 'pos_close_table') {
      const body = (await req.json()) as { p_bill: Row; p_items: Row[] }
      const bill: Row = { ...body.p_bill, archived_at: null }
      const i = db.pos_bills.findIndex((b) => b.id === bill.id)
      if (i >= 0) db.pos_bills[i] = { ...db.pos_bills[i], ...bill }
      else db.pos_bills.unshift(bill)
      db.pos_tables = db.pos_tables.filter((t) => t.id !== bill.id)
      return json(null)
    }
    if (rpc[1] === 'pos_reopen_bill') {
      const body = (await req.json()) as { p_id: string; p_num: number }
      const b = db.pos_bills.find((x) => x.id === body.p_id)
      if (b) {
        db.pos_tables.push({
          id: b.id, num: body.p_num, name: b.name, guests_adults: b.guests_adults,
          guests_children: b.guests_children, pricing_mode: b.pricing_mode,
          opened_at: b.opened_at, items: b.items, updated_at: new Date().toISOString(),
        })
        db.pos_bills = db.pos_bills.filter((x) => x.id !== body.p_id)
      }
      return json(null)
    }
    if (rpc[1] === 'pos_mark_item') {
      const body = (await req.json()) as { p_id: string; p_item_id: string; p_ready: boolean }
      const t = db.pos_tables.find((x) => x.id === body.p_id)
      if (t && Array.isArray(t.items)) {
        t.items = (t.items as Row[]).map((e) => (e.id === body.p_item_id
          ? { ...e, done: body.p_ready ? Number(e.sent) || 0 : Number(e.served) || 0 }
          : e))
      }
      return json(null)
    }
    // finance.reconciliation / reconciliation_counts — the preview harness
    // computes the same FOUR checks over its fixtures, so the badges, banner and
    // reconcile tab are all exercisable in ?preview without a database. Every
    // rule below must mirror 55_finance_reconciliation.sql; a mock that is more
    // permissive than the DB makes a ?preview pass meaningless.
    if (rpc[1] === 'reconciliation' || rpc[1] === 'reconciliation_counts') {
      const num = (v: unknown) => Number(v) || 0
      // magnitude, mirroring 55's day_drift.total — a signed sum would add
      // revenue legs to cost legs and cancel a real +100/−100 drift to "0"
      const driftTotal = (legs: { delta: number }[]) =>
        legs.reduce((s, x) => s + Math.abs(x.delta), 0)
      // mirrors 55's `case when source_module is not null and <> 'finance' and
      // exists (select 1 from core.modules ...)`
      const ownerModules = (m: unknown): string[] =>
        typeof m === 'string' && m !== 'finance' && MODULE_KEYS.includes(m) ? [m] : []
      const today = new Date().toISOString().slice(0, 10)
      const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10)
      const legsFor = (day: string) => {
        const bills = db.pos_bills.filter(
          (b) => b.status === 'paid' && String(b.paid_at).slice(0, 10) === day)
        const card = bills.reduce((s, b) => s + Math.min(num(b.card_paid), num(b.grand_total)), 0)
        const cash = bills.reduce(
          (s, b) => s + num(b.grand_total) - Math.min(num(b.card_paid), num(b.grand_total)), 0)
        const exps = db.pos_expenses.filter((e) => e.business_date === day)
        return {
          cash, card,
          food: exps.filter((e) => e.kind === 'food').reduce((s, e) => s + num(e.amount), 0),
          labor: exps.filter((e) => e.kind === 'labor').reduce((s, e) => s + num(e.amount), 0),
        }
      }
      const isPosted = (day: string) =>
        db.entries.some((e) => e.source_module === 'pos' && String(e.source_ref).startsWith(`pos:${day}:`))
      const days = [...new Set(db.pos_bills
        .filter((b) => b.status === 'paid' && String(b.paid_at).slice(0, 10) >= since)
        .map((b) => String(b.paid_at).slice(0, 10)))]

      const items: Record<string, unknown>[] = []
      for (const d of days.sort().reverse()) {
        const l = legsFor(d)
        const total = l.cash + l.card + l.food + l.labor
        if (!isPosted(d) && total !== 0)
          items.push({ type: 'unposted_day', severity: 'high', business_date: d, ...l,
            revenue: l.cash + l.card, fix: 'post_day', modules: ['pos'] })
      }
      for (const r of db.expected) {
        if (r.status !== 'open' || !r.due_date || String(r.due_date) >= today) continue
        const daysOverdue = Math.round(
          (Date.parse(today) - Date.parse(String(r.due_date))) / 864e5)
        items.push({ type: 'overdue_expected', severity: daysOverdue > 30 ? 'high' : 'medium',
          expected_id: r.id, direction: r.direction, category: r.category, amount: num(r.amount),
          due_date: r.due_date, reason: r.reason, days_overdue: daysOverdue, fix: 'record_payment',
          source_module: r.source_module ?? null, source_ref: r.source_ref ?? null,
          // the module that created the expectation owns chasing it — checked
          // against core.modules exactly as the SQL does, so a retired or
          // misspelled provenance cannot badge a tile that does not exist
          modules: ownerModules(r.source_module) })
      }
      // 2) recompute_drift — compare a booked day's legs against the books
      for (const d of days.sort().reverse()) {
        if (!isPosted(d)) continue
        const l = legsFor(d)
        const bookedFor = (leg: string) =>
          db.entries
            .filter((e) => e.source_module === 'pos' &&
              String(e.source_ref).split(':')[2] === leg &&
              String(e.entry_date) === d)
            .reduce((sum, e) => sum + num(e.amount), 0)
        const legs = (['cash', 'card', 'food', 'labor'] as const)
          .map((leg) => ({ leg, delta: (l[leg] as number) - bookedFor(leg) }))
          .filter((x) => x.delta !== 0)
        const pinned = db.day_pins.some((p) => p.business_date === d)
        if (legs.length && !pinned)
          items.push({ type: 'recompute_drift', severity: 'high', business_date: d,
            legs, total_delta: driftTotal(legs), fix: 'post_day',
            modules: ['pos'] })
      }
      // 4) pinned days — always listed, severity rises only once money has
      //    started piling up behind the freeze (mirrors 55's check 4)
      for (const p of db.day_pins) {
        const d = String(p.business_date)
        const l = legsFor(d)
        const bookedFor = (leg: string) =>
          db.entries
            .filter((e) => e.source_module === 'pos' &&
              String(e.source_ref).split(':')[2] === leg &&
              String(e.entry_date) === d)
            .reduce((sum, e) => sum + num(e.amount), 0)
        const legs = (['cash', 'card', 'food', 'labor'] as const)
          .map((leg) => ({ leg, delta: (l[leg] as number) - bookedFor(leg) }))
          .filter((x) => x.delta !== 0)
        items.push({ type: 'pinned', severity: legs.length ? 'medium' : 'low',
          business_date: d, reason: p.reason, pinned_at: p.pinned_at,
          legs: legs.length ? legs : null,
          total_delta: driftTotal(legs), fix: 'unpin', modules: ['pos'] })
      }
      // the badge counts what needs action — 'low' is listed, never counted
      const live = items.filter((i) => i.severity !== 'low')
      if (rpc[1] === 'reconciliation_counts') {
        // module key -> count, plus finance = the full actionable total
        const counts: Record<string, number> = { finance: live.length }
        for (const i of live)
          for (const m of (i.modules as string[] | undefined) ?? [])
            counts[m] = (counts[m] ?? 0) + 1
        return json(counts)
      }
      return json({ since, generated_at: new Date().toISOString(), count: live.length, items })
    }
    // pos.day_status — posted / auto-corrected / frozen, for the day report
    if (rpc[1] === 'day_status') {
      const { p_date } = (await req.json()) as { p_date: string }
      const refs = db.entries.filter(
        (e) => e.source_module === 'pos' && String(e.source_ref).startsWith(`pos:${p_date}:`))
      const pin = db.day_pins.find((p) => p.business_date === p_date)
      return json({
        posted: refs.length > 0,
        corrected: refs.some((e) => /:r\d+$/.test(String(e.source_ref))),
        pinned: !!pin,
        pin_reason: pin ? pin.reason : null,
      })
    }
    // finance.correction_preview / post_correction — the owner override.
    // Mirrors 56: the target of a POS leg is the WHOLE leg (original + every
    // re-post correction + every override already applied), not the one row.
    if (rpc[1] === 'correction_preview' || rpc[1] === 'post_correction') {
      const body = (await req.json()) as { p_entry: string; p_amount?: number; p_reason?: string }
      const e = db.entries.find((r) => r.id === body.p_entry)
      if (!e) return json({ message: 'לא נמצאה תנועה לתיקון' }, 400)
      const ref = String(e.source_ref)
      const target =
        e.source_module === 'override' ? ref.replace(/^override:/, '').replace(/:c\d+$/, '')
        : e.source_module === 'pos' && ref.startsWith('pos:') ? ref.split(':').slice(0, 3).join(':')
        : `entry:${e.id}`
      const anchor = target.startsWith('entry:')
        ? db.entries.find((r) => r.id === target.slice(6))
        : db.entries.find((r) => r.source_module === 'pos' && r.source_ref === target)
      if (!anchor) return json({ message: 'לא נמצאה התנועה המקורית לתיקון' }, 400)
      const inTarget = (r: Row) =>
        (target.startsWith('entry:')
          ? r.id === anchor.id
          : r.source_module === 'pos' &&
            (r.source_ref === target || String(r.source_ref).startsWith(`${target}:r`))) ||
        (r.source_module === 'override' && String(r.source_ref).startsWith(`override:${target}:c`))
      const current = db.entries.filter(inTarget).reduce((s, r) => s + (Number(r.amount) || 0), 0)
      const posDate = target.startsWith('pos:') ? target.split(':')[1] : null

      if (rpc[1] === 'correction_preview')
        return json({
          target, kind: anchor.kind, category: anchor.category, entry_date: anchor.entry_date,
          current_total: current, pos_date: posDate,
        })

      const amount = Number(body.p_amount)
      const reason = String(body.p_reason ?? '').trim()
      if (!reason) return json({ message: 'תיקון חייב לכלול סיבה' }, 400)
      if (!Number.isFinite(amount) || amount < 0)
        return json({ message: 'סכום התיקון חייב להיות אפס או יותר' }, 400)
      const delta = amount - current
      if (delta === 0) return json({ message: `הסכום כבר ${current}, אין מה לתקן` }, 400)
      const n = db.entries.filter(
        (r) => r.source_module === 'override' &&
          String(r.source_ref).startsWith(`override:${target}:c`)).length
      db.entries.push({
        id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
        kind: anchor.kind, category: anchor.category, amount: delta, payment_method: null,
        entry_date: anchor.entry_date, note: `תיקון בעלים: ${reason}`,
        source_module: 'override', source_ref: `override:${target}:c${n + 1}`,
        event_id: anchor.event_id ?? null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
      // deliberately NO auto-pin — see 56_finance_override.sql §4
      return json({ entry_id: null, target, previous_total: current, new_total: amount, delta,
        pos_date: posDate })
    }
    if (rpc[1] === 'close_day') {
      // mirror pos.close_day: post day-summary legs into finance entries, idempotent
      const body = (await req.json()) as { p_date: string }
      const day = body.p_date
      // a frozen day is refused by pos.post_day() in the real DB — mirror it, or
      // the pinned-day refusal "passes" in ?preview and only fails on Postgres
      if (db.day_pins.some((p) => p.business_date === day))
        return json({ message: `היום ${day} נעול לאחר תיקון של הבעלים — יש לבטל את הנעילה לפני רישום מחדש` }, 400)
      const bills = db.pos_bills.filter((b) => b.status === 'paid' && String(b.paid_at).slice(0, 10) === day)
      const num = (v: unknown) => Number(v) || 0
      const card = bills.reduce((s, b) => s + Math.min(num(b.card_paid), num(b.grand_total)), 0)
      const cash = bills.reduce((s, b) => s + num(b.grand_total) - Math.min(num(b.card_paid), num(b.grand_total)), 0)
      const exps = db.pos_expenses.filter((e) => e.business_date === day)
      const food = exps.filter((e) => e.kind === 'food').reduce((s, e) => s + num(e.amount), 0)
      const labor = exps.filter((e) => e.kind === 'labor').reduce((s, e) => s + num(e.amount), 0)
      const legs: [string, string, string, number, string | null][] = [
        ['cash', 'income', 'pos', cash, 'cash'],
        ['card', 'income', 'pos', card, 'grow'],
        ['food', 'expense', 'pos_food', food, null],
        ['labor', 'expense', 'pos_labor', labor, null],
      ]
      // plausible preview only — the real delta/correction machinery is the DB's
      // job (pos.close_day); here a leg posts once and re-runs report "no change"
      const posted: Row[] = []
      for (const [leg, kind, category, amount, method] of legs) {
        const ref = `pos:${day}:${leg}`
        if (amount === 0 || db.entries.some((e) => e.source_ref === ref)) continue
        const entry: Row = {
          id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
          kind, category, amount, payment_method: method,
          entry_date: day, note: 'סגירת יום',
          source_module: 'pos', source_ref: ref,
          event_id: null, created_by: user.id,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }
        db.entries.unshift(entry)
        posted.push({ leg, amount, entry_id: entry.id, correction: false })
      }
      return json({ date: day, cash, card, food, labor, posted })
    }
    return json(null) // auto_expire and anything else: succeed quietly
  }
  if (path === '/functions/v1/admin-invite') {
    // mirrors supabase/functions/admin-invite: create the user, assign the role
    const body = (await req.json()) as { email: string; role_id: string }
    if (!body.email || !body.role_id) return json({ error: 'missing_fields' }, 400)
    if (!db.roles.some((r) => r.id === body.role_id)) return json({ error: 'unknown_role' }, 400)
    // email_confirmed_at: null mirrors the real invite — the account stays
    // unconfirmed (and so unable to sign in) until the invitee opens the link or
    // an owner confirms it, which is what the users module now surfaces
    const newUser = { user_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, email: body.email, created_at: new Date().toISOString(), banned_until: null, last_sign_in_at: null, email_confirmed_at: null }
    db.admin_users.push(newUser)
    db.user_roles.push({ user_id: newUser.user_id, role_id: body.role_id })
    return json({ invited: true, user_id: newUser.user_id })
  }
  if (path === '/functions/v1/admin-user-ops') {
    // mirrors supabase/functions/admin-user-ops incl. its guard order, so the
    // preview demos the error states too (has_records can't be simulated —
    // the mock has no FK graph)
    const body = (await req.json()) as { action: string; user_id: string }
    const target = db.admin_users.find((u) => u.user_id === body.user_id)
    // set_password/send_reset are deliberately absent: preview has no
    // users.password grant, so the UI never offers them here.
    if (!['delete', 'deactivate', 'reactivate', 'confirm_email'].includes(body.action) || !body.user_id)
      return json({ error: 'missing_fields' }, 400)
    if (body.user_id === user.id) return json({ error: 'self_forbidden' }, 400)
    if (!target) return json({ error: 'user_not_found' }, 404)
    if (!target.email && body.action === 'confirm_email') return json({ error: 'no_email' }, 400)
    // only the two actions that can strip the last active admin (POLICY's
    // NEEDS_SURVIVES) — reactivate and confirm_email can't
    if (body.action === 'delete' || body.action === 'deactivate') {
      const manageRoleIds = db.role_permissions
        .filter((rp) => db.permissions.find((p) => p.id === rp.permission_id)?.key === 'users.manage')
        .map((rp) => rp.role_id)
      const survives = db.user_roles.some(
        (ur) =>
          ur.user_id !== body.user_id &&
          manageRoleIds.includes(ur.role_id) &&
          !(db.admin_users.find((u) => u.user_id === ur.user_id)?.banned_until),
      )
      if (!survives) return json({ error: 'last_admin' }, 400)
    }
    if (body.action === 'delete') {
      db.admin_users = db.admin_users.filter((u) => u.user_id !== body.user_id)
      db.user_roles = db.user_roles.filter((ur) => ur.user_id !== body.user_id)
    } else if (body.action === 'confirm_email') {
      // only when unconfirmed, like confirmIfNeeded() server-side
      target.email_confirmed_at ??= new Date().toISOString()
    } else {
      target.banned_until = body.action === 'deactivate' ? '2126-01-01T00:00:00Z' : null
    }
    return json({ done: true, action: body.action, user_id: body.user_id })
  }

  const rest = path.match(/^\/rest\/v1\/([^/]+)$/)
  if (rest) return handleRest(rest[1], req, url.searchParams)
  return json([], 200)
}

console.info('[preview] Supabase mock active — in-memory fixtures, no network.')
