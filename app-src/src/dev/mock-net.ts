// Dev-only Supabase mock (`?preview`): seeds a fake session and intercepts
// fetch to the Supabase URL, answering from in-memory fixtures. Lets anyone
// run and *see* the authed UI (dashboard, documents) with realistic data and
// zero network. Loaded by main.tsx before any app module, never in prod.
import {
  contractsFixture,
  ownerSecretsFixture,
  permissionsFixture,
  quotesFixture,
  settingsFixture,
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
}
let seq = 100

const json = (body: unknown, status = 200) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const noContent = () => new Response(null, { status: 204 })

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const m = v.match(/^eq\.(.*)$/)
    if (m && String(row[k]) !== m[1]) return false
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
    return respond(out, req)
  }
  if (req.method === 'POST') {
    const body = (await req.json()) as Row
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const row: Row =
      table === 'quotes'
        ? {
            status: 'draft', archived: false, event_confirmed: false, notes: '',
            subtotal: null, discount_pct: null, final_price: null, vat_rate: 0.18,
            deposit_pct: 30, content: {}, prep_checklist: [], sent_date: null, paid_date: null,
            issue_date: today, quote_number: `LY-MOCK-${String(++seq)}`,
            id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
            ...body,
          }
        : {
            id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
            contract_number: 'C-' + String((db.quotes.find((q) => q.id === body.quote_id) ?? {}).quote_number ?? 'LY-MOCK'),
            status: 'draft', generated_date: today, sent_date: null, signed_date: null, signed_name: null,
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
    return json(null) // auto_expire and anything else: succeed quietly
  }
  const rest = path.match(/^\/rest\/v1\/([^/]+)$/)
  if (rest) return handleRest(rest[1], req, url.searchParams)
  return json([], 200)
}

console.info('[preview] Supabase mock active — in-memory fixtures, no network.')
