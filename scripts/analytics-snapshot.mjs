#!/usr/bin/env node
/**
 * Analytics snapshot for the report workflows (Q4 mandate item 1, ADR 0047).
 *
 *   node scripts/analytics-snapshot.mjs                                              # CI: key in $GOOGLE_SA_KEY (the JSON text)
 *   GOOGLE_SA_KEY_FILE=.secrets/google-sa.json node scripts/analytics-snapshot.mjs   # local; ANALYTICS_OUT overrides the output path
 *
 * Pulls the last 7 full days and the 28 days before them from the GA4 Data API and the
 * Search Console API with a read-only service account and writes ONE JSON file the report
 * agent only Reads. Zero dependencies on purpose — the repo root has no package.json, and a
 * signed JWT + fetch is all the two APIs need (Node >= 18).
 *
 * Never fails the job: every error becomes `ga4.error` / `gsc.error` (or a per-part error
 * inside them) and the exit code stays 0 — the weekly review prints `n/a — <reason>` from it.
 *
 * Two things leave this file for a PUBLIC GitHub issue, so both are scrubbed here rather
 * than trusted downstream:
 *   - Free text from Google. `page_slug` and `source` come from GA4 collection, which is
 *     unauthenticated — anyone who knows the measurement ID (it is in the page source) can
 *     POST an event with an arbitrary parameter — and `query` is whatever people typed into
 *     Google. `clean()` strips what could act as markdown or as an instruction.
 *   - Error text from Google, which names the GCP project and its console URL. `reason()`
 *     keeps the status and a clamped message.
 * The key itself is never logged: a malformed key is reported as a fixed string, because
 * JSON.parse puts the first characters of its input into the message.
 */

import { createSign } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const PROPERTY = '549432476' // GA4 property "Lev Yam" (an id, not a credential)
const SITE = 'sc-domain:levyam.com'
const OUT = process.env.ANALYTICS_OUT || '.reports/analytics.json'
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly'
const TOP = 10
const RANGES = ['current', 'trailing']
const TIMEOUT_MS = 20_000

// ── windows ──────────────────────────────────────────────────────────────────
// GA4 is complete after ~1 day, Search Console after ~3. Both windows are "7 full days"
// and "the 28 days before them"; the end date differs per source and the JSON says so.
// One `now` for the whole run: four `new Date()` calls could straddle UTC midnight and
// silently produce an 8-day "week".
const NOW = Date.now()
const day = (offset) => new Date(NOW - offset * 86_400_000).toISOString().slice(0, 10)
const windows = (lag) => ({
  current: { start: day(lag + 6), end: day(lag) },
  trailing: { start: day(lag + 7 + 27), end: day(lag + 7) },
})

// ── scrubbing ────────────────────────────────────────────────────────────────
// Control and bidi-override characters, then the punctuation that turns a value into
// markdown (a backtick closes the code span the report renders it in; brackets and
// parentheses make links; `!` makes an image, which GitHub fetches through camo).
const clean = (value) => String(value ?? '')
  .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
  .replace(/[`$<>|\\[\]()!]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80) || '(empty)'

// Errors get their own clamp: Google's actionable half ("Enable it at …") sits past
// clean()'s 80-character value limit, and a truncated reason wastes the report's one line.
// But the reason reaches a public step summary and a public issue, and Google's
// SERVICE_DISABLED text carries the GCP project number and its console URL — so URLs and
// long digit runs go, and the sentence that tells the owner what to do stays.
const reason = (e) => String(e?.message ?? e ?? 'unknown error')
  .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
  .replace(/[`<>|\[\]()!]/g, ' ')                                  // strip first, so the markers below survive
  .replace(/https?:\/\/\S+/g, 'URL')                              // console links name the GCP project
  .replace(/[\w.+-]+@[\w.-]*\.iam\.gserviceaccount\.com/g, 'SERVICE-ACCOUNT') // IAM denials name the principal
  .replace(/\/\S*\//g, 'PATH')                                     // a local key path is nobody's business
  .replace(/\d{6,}/g, 'ID')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200) || 'unknown error'

// ── auth: service-account JWT → access token ─────────────────────────────────
const loadKey = () => {
  const raw = process.env.GOOGLE_SA_KEY_FILE
    ? readFileSync(process.env.GOOGLE_SA_KEY_FILE, 'utf8')
    : process.env.GOOGLE_SA_KEY
  if (!raw) throw new Error('GOOGLE_SA_KEY not set')
  let key
  try {
    key = JSON.parse(raw)
  } catch {
    // Never echo the parse error: it quotes the start of the secret.
    throw new Error('GOOGLE_SA_KEY is not valid JSON')
  }
  if (!key.client_email || !key.private_key || !key.token_uri) throw new Error('GOOGLE_SA_KEY is not a service-account key')
  return key
}

const b64url = (input) => Buffer.from(input).toString('base64url')

const accessToken = async (key) => {
  const now = Math.floor(NOW / 1000)
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPES, aud: key.token_uri, iat: now, exp: now + 600 }),
  )}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url')
  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) throw new Error(`token exchange failed: ${res.status} ${body.error || 'no token'}`)
  return body.access_token
}

// ── one POST helper; Google error bodies are summarised, never dumped ────────
const post = async (token, url, payload) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${res.status} ${body.error?.status || ''}: ${body.error?.message || 'request failed'}`.trim())
  return body
}

// Every part of a source is fetched independently: one failing part must not cost the
// others. The expected case is `customEvent:page_slug` 400-ing until the owner registers
// the custom dimension — the sessions half of the headline still has to arrive.
const settle = async (parts) => {
  const settled = await Promise.allSettled(Object.values(parts))
  return Object.fromEntries(Object.keys(parts).map((name, i) =>
    [name, settled[i].status === 'fulfilled' ? settled[i].value : { error: reason(settled[i].reason) }]))
}
const failed = (part) => (part && part.error ? part.error : null)

// ── GA4 Data API ─────────────────────────────────────────────────────────────
// One request carries both date ranges; rows come back with a trailing `dateRange`
// dimension value ("current" / "trailing") that we use to split them.
const ga4Report = async (token, w, { dimension, metrics, filter }) => {
  const body = await post(token, `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`, {
    dateRanges: RANGES.map((name) => ({ name, startDate: w[name].start, endDate: w[name].end })),
    dimensions: dimension ? [{ name: dimension }] : [],
    metrics: metrics.map((name) => ({ name })),
    ...(dimension && { orderBys: [{ metric: { metricName: metrics[0] }, desc: true }] }),
    ...(filter && { dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: filter } } } }),
    limit: 100,
  })
  // With more than one dateRange the API appends a `dateRange` dimension valued to the
  // range's name. Find it by name rather than assuming it is last: were it ever to move,
  // every row would land nowhere and the part would report empty lists instead of failing.
  const headers = (body.dimensionHeaders || []).map((h) => h.name)
  const rangeAt = headers.indexOf('dateRange')
  const valueAt = headers.findIndex((h) => h === dimension)
  if (body.rows?.length && rangeAt === -1) throw new Error('GA4 response carries no dateRange column')
  const split = { current: [], trailing: [], thresholded: Boolean(body.metadata?.subjectToThresholding) }
  for (const row of body.rows || []) {
    const values = (row.dimensionValues || []).map((v) => v.value)
    // GA4 answers with a literal "(not set)" row for events recorded before a custom
    // dimension existed — a row, not an absence, so it has to be marked or it gets
    // published as though it were a real page.
    const raw = values[valueAt]
    const rec = dimension ? { key: clean(raw), unset: raw === '(not set)' } : {}
    metrics.forEach((m, i) => { rec[m] = Number(row.metricValues?.[i]?.value) })
    split[values[rangeAt]]?.push(rec)
  }
  return split
}

const named = (part, range) => (failed(part) ? [] : part[range].filter((r) => !r.unset))
const rank = (part, range, label) => named(part, range).slice(0, 3).map((r) => ({ [label]: r.key, clicks: r.eventCount }))

// `page_slug` is a custom event parameter: grouping by it needs the event-scoped custom
// dimension registered in the GA4 UI (plan scope (a)). There is deliberately no fallback to
// the page path — a story's HE and AR twins share one slug, so the path would quietly
// measure something else and make a broken metric look like a working one.
const ga4 = async (token) => {
  const w = GA4_WINDOWS
  const wa = { metrics: ['eventCount'], filter: 'whatsapp_click' }
  // `totals` is un-dimensioned on purpose: `totalUsers` is de-duplicated per row, so
  // summing it across channel groups counts anyone who arrived two ways twice.
  const parts = await settle({
    totals: ga4Report(token, w, { metrics: ['sessions', 'totalUsers'] }),
    // The headline number is un-dimensioned on purpose: derived from `byPage` it would
    // vanish along with the custom dimension — i.e. exactly during the first month, when
    // the outcome check (ADR 0047) is read.
    clicks: ga4Report(token, w, { ...wa }),
    channels: ga4Report(token, w, { dimension: 'sessionDefaultChannelGroup', metrics: ['sessions'] }),
    byPage: ga4Report(token, w, { dimension: 'customEvent:page_slug', ...wa }),
    bySource: ga4Report(token, w, { dimension: 'sessionSourceMedium', ...wa }),
  })
  const out = { windows: w, errors: Object.fromEntries(Object.entries(parts).filter(([, p]) => failed(p)).map(([n, p]) => [n, p.error])) }
  if (Object.keys(out.errors).length === 0) delete out.errors
  if (Object.values(parts).some((p) => p.thresholded)) {
    out.thresholded = 'GA4 withheld low-volume rows (data thresholding) — these numbers are a floor, not a count'
  }
  // Custom dimensions are not retroactive. The signature is a trailing window that HAD
  // clicks but no breakdown for them; an empty breakdown next to zero clicks is just a
  // quiet month, and saying otherwise would suppress a real 0 → N delta.
  if (!failed(parts.byPage) && !failed(parts.clicks)
      && !named(parts.byPage, 'trailing').length && parts.clicks.trailing[0]?.eventCount > 0) {
    out.no_baseline = 'the trailing window has clicks but no named page for any of them — page_slug was registered inside it and GA4 does not backfill, so there is no comparable baseline for the per-page list yet'
  }
  // Same signal for the current window: clicks recorded before registration stay
  // unattributed for good, so "0 pages, N clicks" is history, not a tracking fault.
  if (!failed(parts.byPage) && !failed(parts.clicks)
      && !named(parts.byPage, 'current').length && parts.clicks.current[0]?.eventCount > 0) {
    out.unattributed = 'every click this window predates the page_slug dimension — the per-page list fills from the next clicks onward'
  }
  for (const range of RANGES) {
    out[range] = {
      sessions: failed(parts.totals) ? null : (parts.totals[range][0]?.sessions ?? 0),
      users: failed(parts.totals) ? null : (parts.totals[range][0]?.totalUsers ?? 0),
      sessions_by_channel: named(parts.channels, range).slice(0, 3).map((r) => ({ channel: r.key, sessions: r.sessions })),
      whatsapp_click: failed(parts.clicks) ? null : (parts.clicks[range][0]?.eventCount ?? 0),
      whatsapp_click_by_page: rank(parts.byPage, range, 'page'),
      whatsapp_click_by_source: rank(parts.bySource, range, 'source'),
    }
  }
  return out
}

// ── Search Console API ───────────────────────────────────────────────────────
const gscQuery = async (token, range, dimension) => {
  const body = await post(token, `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    startDate: range.start,
    endDate: range.end,
    dimensions: dimension ? [dimension] : [],
    rowLimit: dimension ? TOP : 1,
  })
  return (body.rows || []).map((r) => ({
    ...(dimension && { [dimension]: clean(r.keys[0]) }),
    clicks: r.clicks,
    impressions: r.impressions,
    ctr_pct: Number((r.ctr * 100).toFixed(1)), // GSC returns a 0–1 fraction; this is 0–100
    position: Number(r.position.toFixed(1)),
  }))
}

const gsc = async (token) => {
  const w = GSC_WINDOWS
  const parts = await settle(Object.fromEntries(RANGES.flatMap((range) => [
    [`${range}_totals`, gscQuery(token, w[range])],
    [`${range}_queries`, gscQuery(token, w[range], 'query')],
    [`${range}_pages`, gscQuery(token, w[range], 'page')],
  ])))
  const out = { windows: w }
  const errors = Object.entries(parts).filter(([, p]) => failed(p)).map(([n, p]) => [n, p.error])
  if (errors.length) out.errors = Object.fromEntries(errors)
  for (const range of RANGES) {
    const totals = parts[`${range}_totals`]
    out[range] = {
      ...(failed(totals) ? { clicks: null, impressions: null, ctr_pct: null, position: null } : (totals[0] || { clicks: 0, impressions: 0, ctr_pct: 0, position: 0 })),
      top_queries: failed(parts[`${range}_queries`]) ? [] : parts[`${range}_queries`].slice(0, 3),
      top_pages: failed(parts[`${range}_pages`]) ? [] : parts[`${range}_pages`].slice(0, 3),
    }
  }
  return out
}

// ── main ─────────────────────────────────────────────────────────────────────
const GA4_WINDOWS = windows(1)
const GSC_WINDOWS = windows(3)
const snapshot = { generated_at: new Date(NOW).toISOString(), property: PROPERTY, site: SITE }
const sources = { ga4, gsc }
try {
  const token = await accessToken(loadKey())
  Object.assign(snapshot, await settle(Object.fromEntries(Object.entries(sources).map(([n, fn]) => [n, fn(token)]))))
} catch (e) {
  // Keep the windows even when auth failed: the report still names the range it has no
  // numbers for, instead of dropping (or inventing) the dates.
  snapshot.ga4 = { windows: GA4_WINDOWS, error: reason(e) }
  snapshot.gsc = { windows: GSC_WINDOWS, error: reason(e) }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
const status = Object.keys(sources)
  .map((n) => (failed(snapshot[n]) ? `${n} n/a — ${snapshot[n].error}` : `${n} ok${snapshot[n].errors ? ` (partial: ${Object.keys(snapshot[n].errors).join(', ')})` : ''}`))
  .join(' · ')
console.log(`analytics snapshot: ${status} → ${OUT}`)
