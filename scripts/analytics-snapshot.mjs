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

const reason = (e) => clean(e.message).slice(0, 120)

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
  const split = { current: [], trailing: [], thresholded: Boolean(body.metadata?.subjectToThresholding) }
  for (const row of body.rows || []) {
    const values = row.dimensionValues.map((v) => v.value)
    const range = values.pop()
    const rec = dimension ? { key: clean(values[0]) } : {}
    metrics.forEach((m, i) => { rec[m] = Number(row.metricValues[i].value) })
    split[range]?.push(rec)
  }
  return split
}

const sumBy = (rows, metric) => rows.reduce((n, r) => n + (r[metric] || 0), 0)
const rank = (part, range, label) => (failed(part) ? [] : part[range].slice(0, 3).map((r) => ({ [label]: r.key, clicks: r.eventCount })))

// `page_slug` is a custom event parameter: grouping by it needs the event-scoped custom
// dimension registered in the GA4 UI (plan scope (a)). There is deliberately no fallback to
// the page path — a story's HE and AR twins share one slug, so the path would quietly
// measure something else and make a broken metric look like a working one.
const ga4 = async (token) => {
  const w = windows(1)
  const wa = { metrics: ['eventCount'], filter: 'whatsapp_click' }
  // `totals` is un-dimensioned on purpose: `totalUsers` is de-duplicated per row, so
  // summing it across channel groups counts anyone who arrived two ways twice.
  const parts = await settle({
    totals: ga4Report(token, w, { metrics: ['sessions', 'totalUsers'] }),
    channels: ga4Report(token, w, { dimension: 'sessionDefaultChannelGroup', metrics: ['sessions'] }),
    byPage: ga4Report(token, w, { dimension: 'customEvent:page_slug', ...wa }),
    bySource: ga4Report(token, w, { dimension: 'sessionSourceMedium', ...wa }),
  })
  const out = { windows: w, errors: Object.fromEntries(Object.entries(parts).filter(([, p]) => failed(p)).map(([n, p]) => [n, p.error])) }
  if (Object.keys(out.errors).length === 0) delete out.errors
  if (parts.totals.thresholded) out.thresholded = 'GA4 withheld low-volume rows (data thresholding) — totals are a floor'
  for (const range of RANGES) {
    out[range] = {
      sessions: failed(parts.totals) ? null : (parts.totals[range][0]?.sessions ?? 0),
      users: failed(parts.totals) ? null : (parts.totals[range][0]?.totalUsers ?? 0),
      sessions_by_channel: failed(parts.channels) ? [] : parts.channels[range].slice(0, 3).map((r) => ({ channel: r.key, sessions: r.sessions })),
      whatsapp_click: failed(parts.byPage) ? null : sumBy(parts.byPage[range], 'eventCount'),
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
  const w = windows(3)
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
      ...(failed(totals) ? { clicks: null, impressions: null } : (totals[0] || { clicks: 0, impressions: 0, ctr_pct: 0, position: 0 })),
      top_queries: failed(parts[`${range}_queries`]) ? [] : parts[`${range}_queries`].slice(0, 3),
      top_pages: failed(parts[`${range}_pages`]) ? [] : parts[`${range}_pages`].slice(0, 3),
    }
  }
  return out
}

// ── main ─────────────────────────────────────────────────────────────────────
const snapshot = { generated_at: new Date(NOW).toISOString(), property: PROPERTY, site: SITE }
const sources = { ga4, gsc }
try {
  const token = await accessToken(loadKey())
  Object.assign(snapshot, await settle(Object.fromEntries(Object.entries(sources).map(([n, fn]) => [n, fn(token)]))))
} catch (e) {
  for (const name of Object.keys(sources)) snapshot[name] = { error: reason(e) }
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
const status = Object.keys(sources)
  .map((n) => (failed(snapshot[n]) ? `${n} n/a — ${snapshot[n].error}` : `${n} ok${snapshot[n].errors ? ` (partial: ${Object.keys(snapshot[n].errors).join(', ')})` : ''}`))
  .join(' · ')
console.log(`analytics snapshot: ${status} → ${OUT}`)
