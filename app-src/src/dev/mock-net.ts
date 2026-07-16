// Dev-only Supabase mock (`?preview`): seeds a fake session and intercepts
// fetch to the Supabase URL, answering from in-memory fixtures. Lets anyone
// run and *see* the authed UI (dashboard, documents) with realistic data and
// zero network. Loaded by main.tsx before any app module, never in prod.
import {
  adminUsersFixture,
  contractsFixture,
  financeEntriesFixture,
  financeExpectedFixture,
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
}
let seq = 100

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
    if (rpc[1] === 'my_modules')
      return json([
        { key: 'users', label: 'Users & Permissions', icon: '🔐', sort: 10 },
        { key: 'pos', label: 'קופה', icon: '🧾', sort: 20 },
        { key: 'finance', label: 'כספים', icon: '💰', sort: 30 },
        { key: 'quotes', label: 'הצעות מחיר', icon: '📋', sort: 40 },
      ])
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
    if (rpc[1] === 'close_day') {
      // mirror pos.close_day: post day-summary legs into finance entries, idempotent
      const body = (await req.json()) as { p_date: string }
      const day = body.p_date
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
    const newUser = { user_id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, email: body.email, created_at: new Date().toISOString(), banned_until: null }
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
    if (!['delete', 'deactivate', 'reactivate'].includes(body.action) || !body.user_id)
      return json({ error: 'missing_fields' }, 400)
    if (body.user_id === user.id) return json({ error: 'self_forbidden' }, 400)
    if (!target) return json({ error: 'user_not_found' }, 404)
    if (body.action !== 'reactivate') {
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
