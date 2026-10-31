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
import { readPosts, addDays, isDate } from './lib/content.mjs'

const PROPERTY = '549432476' // GA4 property "Lev Yam" (an id, not a credential)
const SITE = 'sc-domain:levyam.com'
const OUT = process.env.ANALYTICS_OUT || '.reports/analytics.json'
const POST_OUT = process.env.POST_DAYS_OUT || '.reports/post-days.json' // per post — never read by the report agents
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly'
const TOP = 10
const RANGES = ['current', 'trailing']
const UNSET = new Set(['(not set)', '(other)', '', '(not set) / (not set)'])
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
const GA4_WINDOWS = windows(1)
const GSC_WINDOWS = windows(3)
// the per-post allow-list: each post ID with the day it went out (`posted:`, else the ID's date)
const POSTS = (() => { try { return readPosts().map((p) => ({ id: p.id, day: isDate(p.fm.posted) ? p.fm.posted : p.date })) } catch { return [] } })()

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
const GA4_URL = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`
const eventFilter = (name) => ({ filter: { fieldName: 'eventName', stringFilter: { value: name } } })
const thresholdedIn = (body) => Boolean(body.metadata?.subjectToThresholding)
const ga4Report = async (token, w, { dimension, metrics, filter }) => {
  const body = await post(token, GA4_URL, {
    dateRanges: RANGES.map((name) => ({ name, startDate: w[name].start, endDate: w[name].end })),
    dimensions: dimension ? [{ name: dimension }] : [],
    metrics: metrics.map((name) => ({ name })),
    ...(dimension && { orderBys: [{ metric: { metricName: metrics[0] }, desc: true }] }),
    ...(filter && { dimensionFilter: eventFilter(filter) }),
    limit: 100,
  })
  // With more than one dateRange the API appends a `dateRange` dimension valued to the
  // range's name. Find it by name rather than assuming it is last: were it ever to move,
  // every row would land nowhere and the part would report empty lists instead of failing.
  const headers = (body.dimensionHeaders || []).map((h) => h.name)
  const rangeAt = headers.indexOf('dateRange')
  const valueAt = headers.findIndex((h) => h === dimension)
  if (body.rows?.length && rangeAt === -1) throw new Error('GA4 response carries no dateRange column')
  const split = { current: [], trailing: [], thresholded: thresholdedIn(body) }
  for (const row of body.rows || []) {
    const values = (row.dimensionValues || []).map((v) => v.value)
    // GA4 answers with a literal placeholder ROW, not an absence, when it has no value
    // for a dimension — mark it or it gets published as though it were a real page.
    // `(direct) / (none)` is deliberately NOT in that set: it is a real attribution.
    const raw = values[valueAt]
    const rec = dimension ? { key: clean(raw), unset: UNSET.has(raw) } : {}
    metrics.forEach((m, i) => { rec[m] = Number(row.metricValues?.[i]?.value) })
    split[values[rangeAt]]?.push(rec)
  }
  return split
}

// ── per post (content PR D) ──────────────────────────────────────────────────
// Daily sessions and whatsapp_click per utm_campaign → POST_OUT, the `post-days` artifact that
// scripts/post-results.mjs turns into each post record's `results:` line. Its own file and its own
// source: the report agents never read it, and its errors and thresholding stay apart from the
// headline's. utm_campaign is collected unauthenticated like page_slug, so the request asks only
// for campaigns that are post IDs in content/posts/ and the answer is filtered to them again — no
// other value reaches the file (ADR 0069 §3). The window is both GA4 ranges end to end (35 days),
// so a post's first 7 days are whole in at least one weekly snapshot.
const POST_LOOKBACK_DAYS = 14 // an unmarked post can go out a little after the date in its ID
const POST_WINDOW = { start: GA4_WINDOWS.trailing.start, end: GA4_WINDOWS.current.end }
const ga4Daily = async (token, campaigns, metric, event) => {
  const inList = { filter: { fieldName: 'sessionCampaignName', inListFilter: { values: campaigns } } }
  const body = await post(token, GA4_URL, {
    dateRanges: [{ startDate: POST_WINDOW.start, endDate: POST_WINDOW.end }],
    dimensions: [{ name: 'sessionCampaignName' }, { name: 'date' }],
    metrics: [{ name: metric }],
    dimensionFilter: event ? { andGroup: { expressions: [inList, eventFilter(event)] } } : inList,
    limit: 10000,
  })
  // columns by name, as ga4Report does
  const headers = (body.dimensionHeaders || []).map((h) => h.name)
  const [at, dayAt] = [headers.indexOf('sessionCampaignName'), headers.indexOf('date')]
  if (body.rows?.length && (at === -1 || dayAt === -1)) throw new Error('GA4 response lacks the campaign or date column')
  const wanted = new Set(campaigns)
  const rows = (body.rows || []).map((row) => ({
    campaign: row.dimensionValues?.[at]?.value,
    date: String(row.dimensionValues?.[dayAt]?.value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
    value: Number(row.metricValues?.[0]?.value),
  })).filter((r) => wanted.has(r.campaign) && isDate(r.date) && Number.isInteger(r.value) && r.value >= 0)
  return { rows, thresholded: thresholdedIn(body) }
}

const postDays = async (token) => {
  // `asked` lets post-results tell "asked, no visits" (0) from "not asked" (wait for a later snapshot)
  const from = addDays(POST_WINDOW.start, -POST_LOOKBACK_DAYS)
  const campaigns = POSTS.filter((p) => p.day >= from && p.day <= POST_WINDOW.end).map((p) => p.id)
  const out = { window: POST_WINDOW, asked: campaigns, posts: {} }
  if (!campaigns.length) return out
  const parts = await settle({
    sessions: ga4Daily(token, campaigns, 'sessions'),
    whatsapp_click: ga4Daily(token, campaigns, 'eventCount', 'whatsapp_click'),
  })
  for (const [metric, part] of Object.entries(parts)) {
    if (failed(part)) return { window: POST_WINDOW, error: part.error }
    if (part.thresholded) out.thresholded = true
    for (const r of part.rows) ((out.posts[r.campaign] ??= {})[r.date] ??= { sessions: 0, whatsapp_click: 0 })[metric] = r.value
  }
  return out
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
  // Clicks GA4 could not attribute to a page. Report the COUNT and both possible
  // causes rather than asserting one: the script cannot see when the custom dimension
  // was registered, and "the parameter stopped being sent" produces identical rows.
  // Asserting the harmless cause would print an all-clear over a real tracking fault.
  if (!failed(parts.byPage)) {
    const unattributed = Object.fromEntries(RANGES.map((r) =>
      [r, parts.byPage[r].filter((row) => row.unset).reduce((n, row) => n + row.eventCount, 0)]))
    if (unattributed.current || unattributed.trailing) {
      out.page_attribution = {
        ...unattributed,
        note: 'clicks carrying no page_slug, excluded from the per-page list (so it need not sum to the total). Either they predate the custom dimension — GA4 does not backfill — or the parameter is not being sent on those pages. Check which before reading the per-page list as complete.',
      }
    }
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
const snapshot = { generated_at: new Date(NOW).toISOString(), property: PROPERTY, site: SITE }
const sources = { ga4, gsc }
let perPost
try {
  const token = await accessToken(loadKey())
  const settled = await settle({ ...Object.fromEntries(Object.entries(sources).map(([n, fn]) => [n, fn(token)])), perPost: postDays(token) })
  ;({ perPost } = settled)
  delete settled.perPost
  Object.assign(snapshot, settled)
} catch (e) {
  // Keep the windows even when auth failed: the report still names the range it has no
  // numbers for, instead of dropping (or inventing) the dates.
  snapshot.ga4 = { windows: GA4_WINDOWS, error: reason(e) }
  snapshot.gsc = { windows: GSC_WINDOWS, error: reason(e) }
  perPost = { window: POST_WINDOW, error: reason(e) }
}

for (const [file, data] of [[OUT, snapshot], [POST_OUT, { generated_at: snapshot.generated_at, ...perPost }]]) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}
const status = Object.keys(sources)
  .map((n) => (failed(snapshot[n]) ? `${n} n/a — ${snapshot[n].error}` : `${n} ok${snapshot[n].errors ? ` (partial: ${Object.keys(snapshot[n].errors).join(', ')})` : ''}`))
  .join(' · ')
console.log(`analytics snapshot: ${status} → ${OUT}`)
