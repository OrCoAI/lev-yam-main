#!/usr/bin/env node
/**
 * Native channel numbers for the marketing report (mandate item 2, ADR 0073).
 *
 *   node scripts/social-snapshot.mjs     writes .reports/social.json (SOCIAL_OUT overrides)
 *
 * Reads Instagram + Facebook insights (Meta Graph API) and Google Business Profile performance
 * with the credentials below and writes ONE JSON file of totals the report agent only Reads. Like
 * analytics-snapshot.mjs: the workflow pulls, the agent reads (ADR 0047). These secrets are named in
 * agent-report.yml's `snapshot` job only, on a runner no agent uses. Zero dependencies, Node >= 18.
 *
 *   META_ACCESS_TOKEN                                    a Page access token (its /me is the Page)
 *   GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN  OAuth client + a Manager account's refresh token
 *
 * This code only reads: every request below is a GET, except Google's token exchange. Nothing here
 * publishes, and every channel stays in `draft` (ADR 0068 §2). The Google credential itself can write:
 * `business.manage` is the only scope, so it belongs to a Manager account, never the owner (ADR 0073).
 *
 * Never fails the job: a missing secret or a failed source becomes `<source>.error`, a failed
 * metric becomes `<source>.errors.<metric>`, and the exit code stays 0. The report prints `n/a`.
 *
 * Totals only (ADR 0069 §3, invariant 3): captions, comment and review text, handles and audience
 * lists are never requested. Search keywords are Google's aggregate, and go through clean().
 */

import { addDays, isDate } from './lib/content.mjs'
import { clean, hideKnown } from './lib/scrub.mjs'
import { dayFrom, settle, failed, errorsOf, fetchJson, exchangeToken, writeJson, statusLine } from './lib/snapshot.mjs'

const OUT = process.env.SOCIAL_OUT || '.reports/social.json'
const GRAPH = 'https://graph.facebook.com/v25.0'
const POST_DAYS = 14   // posts this recent are listed; their numbers still grow after the first week
const POST_LIMIT = 15
const KEYWORDS = 5
const META_LAG = 2     // Meta's insights settle after about two days
const GBP_LAG = 5      // Google Business numbers arrive several days late

const day = dayFrom(Date.now())
// Reach is unique people, so it can't be divided down like the site's numbers: two 7-day windows.
const windows = (lag) => ({
  current: { start: day(lag + 6), end: day(lag) },
  previous: { start: day(lag + 13), end: day(lag + 7) },
})
const unix = (date, endOfDay = false) => Math.floor(Date.parse(`${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`) / 1000)
const count = (value) => ((typeof value === 'number' || (typeof value === 'string' && value.trim())) && Number.isFinite(Number(value)) ? Number(value) : null)
const sum = (values) => {
  const known = values.map(count).filter((n) => n !== null)
  return known.length ? known.reduce((n, v) => n + v, 0) : null
}

// ── Meta ─────────────────────────────────────────────────────────────────────
const graph = (token, path, params) => fetchJson(`${GRAPH}/${path}?${new URLSearchParams(params)}`, token)

// All the metrics in one call; if Meta refuses that, one call each, so a retired metric or one a kind
// of post lacks costs a single `null` rather than the lot. A metric with no row is `null` and named
// too: nothing here is ever printed as a zero it didn't return.
const NO_ROW = 'no data returned'
const rowOf = (row) => { if (!row) throw new Error(NO_ROW); return row }
const firstValue = (row) => count(row?.values?.[0]?.value)
const named = (parts) => {
  const known = Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, p ?? { error: 'a row with no number' }]))
  const errors = errorsOf(known)
  return { values: Object.fromEntries(Object.entries(known).map(([n, p]) => [n, failed(p) ? null : p])), ...(Object.keys(errors).length && { errors }) }
}
const perMetric = async (names, ask, value) => {
  let rows
  try {
    rows = new Map(((await ask(names.join(','))).data ?? []).map((row) => [row.name, row]))
  } catch {
    return named(await settle(Object.fromEntries(names.map((n) => [n, ask(n).then((b) => value(rowOf(b.data?.[0])))]))))
  }
  return named(Object.fromEntries(names.map((n) => [n, rows.has(n) ? value(rows.get(n)) : { error: NO_ROW }])))
}
const inWindow = (w) => ({ period: 'day', since: unix(w.start), until: unix(w.end, true) })

const IG_ACCOUNT = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'saves', 'shares', 'profile_links_taps', 'follows_and_unfollows']
// Post links skip the text rules, so they are held by shape and must carry no piece of a credential.
const linkOf = (shape, url) => (shape.test(url) && hideKnown(url) === url ? url : null)
// A post's date, and whether it is recent: a value that isn't a date is never printed, and costs the list.
const dateOf = (stamp) => { const d = String(stamp).slice(0, 10); return isDate(d) ? d : null }
const recentPosts = (rows, field) => {
  if (!Array.isArray(rows)) throw new Error(NO_ROW)
  if (rows.some((r) => !dateOf(r[field]))) throw new Error('a post with no readable date') // not an empty fortnight
  return rows.filter((r) => dateOf(r[field]) >= day(POST_DAYS))
}
const igAccount = (token, id) => (w) => perMetric(IG_ACCOUNT,
  (metric) => graph(token, `${id}/insights`, { metric, metric_type: 'total_value', ...inWindow(w) }),
  (row) => count(row?.total_value?.value))

const IG_POST = ['reach', 'saved', 'shares', 'total_interactions', 'views']
const IG_PERMALINK = /^https:\/\/www\.instagram\.com\/(p|reel|tv)\/[\w-]+\/?$/
const igPost = async (token, media) => {
  const { values, errors } = await perMetric(IG_POST,
    (metric) => graph(token, `${media.id}/insights`, { metric }),
    firstValue)
  return {
    errors,
    post: {
      date: dateOf(media.timestamp),
      kind: /^[A-Z_]{1,24}$/.test(media.media_product_type || media.media_type) ? media.media_product_type || media.media_type : null,
      // a carousel reports as one post: Meta gives no numbers for the slides inside it
      link: linkOf(IG_PERMALINK, media.permalink),
      ...values,
      ...(errors && { unavailable: Object.keys(errors) }),
    },
  }
}
const igPosts = async (token, id) => {
  const recent = await graph(token, `${id}/media`, { fields: 'id,timestamp,media_type,media_product_type,permalink', limit: POST_LIMIT })
  return Promise.all(recentPosts(recent.data, 'timestamp').map((m) => igPost(token, m)))
}

// page_impressions_unique and post_impressions_unique are retired (Graph API v25.0 changelog)
const FB_PAGE = ['page_total_media_view_unique', 'page_post_engagements', 'page_views_total', 'page_media_view']
// Daily values added up: a daily unique count summed over a week is not unique people, and the report says so.
const fbPage = (token, id) => (w) => perMetric(FB_PAGE,
  (metric) => graph(token, `${id}/insights`, { metric, ...inWindow(w) }),
  (row) => sum((row?.values ?? []).map((v) => v.value)))

const FB_LINK = /^https:\/\/(www\.)?facebook\.com\/[\w./?=&%-]+$/
const fbPost = async (token, post) => {
  // each of these is its own call, not a field on the list: one Meta refuses costs a null, not the list.
  // `shares` stays on the list: a plain field, left out when a post has none
  const counted = (edge) => graph(token, post.id, { fields: `${edge}.summary(true).limit(0)` }) // limit(0): the count, no rows
    .then((b) => count(b[edge]?.summary?.total_count))
  const { values, errors } = named(await settle({
    reach: graph(token, `${post.id}/insights`, { metric: 'post_total_media_view_unique' })
      .then((b) => firstValue(rowOf(b.data?.find((r) => !r.period || r.period === 'lifetime')))), // never one day's
    reactions: counted('reactions'),
    comments: counted('comments'),
  }))
  return {
    errors,
    post: {
      date: dateOf(post.created_time),
      link: linkOf(FB_LINK, post.permalink_url),
      ...values,
      shares: count(post.shares?.count ?? 0),
      ...(errors && { unavailable: Object.keys(errors) }),
    },
  }
}
const fbPosts = async (token, id) => {
  // `posts` and `feed` need pages_read_user_content, which can read what visitors write: this token stays without it
  const recent = await graph(token, `${id}/published_posts`, { fields: 'id,created_time,permalink_url,shares', since: unix(day(POST_DAYS)), limit: POST_LIMIT })
  return Promise.all(recentPosts(recent.data, 'created_time').map((p) => fbPost(token, p)))
}

const channel = async (w, followers, account, posts) => {
  // settled alone: a refused post list costs the list, not the channel's other numbers
  const [current, previous, list] = await Promise.all([account(w.current), account(w.previous), settle({ posts })])
  const items = failed(list.posts) ? [] : list.posts
  // a post names what it lacks (`unavailable`); the commonest reason is said once for the channel, as `post_<name>`,
  // which says when there are others
  const reasons = {}
  for (const i of items) for (const [n, e] of Object.entries(i.errors ?? {})) (reasons[`post_${n}`] ??= []).push(e)
  const times = (list, e) => list.filter((x) => x === e).length
  const why = Object.fromEntries(Object.entries(reasons).map(([n, list]) =>
    [n, list.reduce((a, b) => (times(list, b) > times(list, a) ? b : a)) + (new Set(list).size > 1 ? ' (others differ)' : '')]))
  const errors = { ...why, ...previous.errors, ...current.errors, ...errorsOf(list) }
  return { followers: count(followers), current: current.values, previous: previous.values, posts: items.map((i) => i.post), ...(Object.keys(errors).length && { errors }) }
}

const meta = async () => {
  const w = windows(META_LAG), token = process.env.META_ACCESS_TOKEN?.trim()
  // a line break inside the secret would make Node quote it in its own error, in pieces no scrub can match
  const bad = !token ? 'META_ACCESS_TOKEN not set' : /\W/.test(token) ? 'META_ACCESS_TOKEN is malformed' : null
  if (bad) return { ig: { windows: w, error: bad }, fb: { windows: w, error: bad } }
  const page = graph(token, 'me', { fields: 'id,followers_count,instagram_business_account{id,followers_count}' })
  const { ig, fb } = await settle({
    ig: page.then(({ instagram_business_account: account }) => {
      if (!account) throw new Error('no Instagram professional account is linked to this Page')
      return channel(w, account.followers_count, igAccount(token, account.id), igPosts(token, account.id))
    }),
    fb: page.then(({ id, followers_count: followers }) => channel(w, followers, fbPage(token, id), fbPosts(token, id))),
  })
  return { ig: { windows: w, ...ig }, fb: { windows: w, ...fb } }
}

// ── Google Business Profile ──────────────────────────────────────────────────
const PERFORMANCE = 'https://businessprofileperformance.googleapis.com/v1'
const IMPRESSIONS = ['BUSINESS_IMPRESSIONS_MOBILE_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH']
const DAILY = ['CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'WEBSITE_CLICKS', 'BUSINESS_CONVERSATIONS', ...IMPRESSIONS]
const ymd = (prefix, date) => {
  const [year, month, dayOf] = date.split('-').map(Number)
  return [[`${prefix}.year`, year], [`${prefix}.month`, month], [`${prefix}.day`, dayOf]]
}
const daily = async (token, location, w) => {
  const params = new URLSearchParams([...DAILY.map((m) => ['dailyMetrics', m]), ...ymd('dailyRange.startDate', w.start), ...ymd('dailyRange.endDate', w.end)])
  const body = await fetchJson(`${PERFORMANCE}/${location}:fetchMultiDailyMetricsTimeSeries?${params}`, token)
  if (!body.multiDailyMetricTimeSeries) throw new Error('no time series in the response') // not a quiet week of zeros
  const series = body.multiDailyMetricTimeSeries.flatMap((m) => m.dailyMetricTimeSeries ?? [])
  // a day with no events comes back with no `value`: zero, not unknown
  const total = (name) => sum((series.find((s) => s.dailyMetric === name)?.timeSeries?.datedValues ?? []).map((v) => v.value ?? 0))
  return {
    calls: total('CALL_CLICKS'),
    direction_requests: total('BUSINESS_DIRECTION_REQUESTS'),
    website_clicks: total('WEBSITE_CLICKS'),
    conversations: total('BUSINESS_CONVERSATIONS'),
    impressions: sum(IMPRESSIONS.map(total)),
  }
}

// The newest whole month. Only rows with an exact value: a row with just a threshold is a low-volume
// search, and at this venue's size that can be a person's name, which a public issue must not carry.
const keywords = async (token, location) => {
  const month = addDays(`${day(0).slice(0, 7)}-01`, -1).slice(0, 7)
  const [year, monthOf] = month.split('-').map(Number)
  const range = ['startMonth', 'endMonth'].flatMap((edge) => [[`monthlyRange.${edge}.year`, year], [`monthlyRange.${edge}.month`, monthOf]])
  const body = await fetchJson(`${PERFORMANCE}/${location}/searchkeywords/impressions/monthly?${new URLSearchParams(range)}`, token)
  return {
    month,
    top: (body.searchKeywordsCounts ?? [])
      .map((k) => ({ keyword: clean(k.searchKeyword), impressions: count(k.insightsValue?.value) }))
      .filter((k) => k.impressions !== null)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, KEYWORDS),
  }
}

const googleBusiness = async () => {
  const w = windows(GBP_LAG)
  const env = (n) => process.env[n]?.trim()
  const missing = ['GBP_CLIENT_ID', 'GBP_CLIENT_SECRET', 'GBP_REFRESH_TOKEN'].filter((n) => !env(n))
  if (missing.length) return { windows: w, error: `${missing.join(', ')} not set` }
  const locate = async () => {
    const token = await exchangeToken('https://oauth2.googleapis.com/token', {
      grant_type: 'refresh_token',
      client_id: env('GBP_CLIENT_ID'),
      client_secret: env('GBP_CLIENT_SECRET'),
      refresh_token: env('GBP_REFRESH_TOKEN'),
    })
    const { accounts = [] } = await fetchJson('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token)
    // the location can sit in a group, past a personal first account
    for (const { name } of accounts) {
      const { locations } = await fetchJson(`https://mybusinessbusinessinformation.googleapis.com/v1/${name}/locations?readMask=name&pageSize=2`, token)
      if (locations?.[0]) return { token, location: locations[0].name }
    }
    throw new Error('no location on this login')
  }
  const { place } = await settle({ place: locate() })
  if (failed(place)) return { windows: w, error: place.error }
  const parts = await settle({
    current: daily(place.token, place.location, w.current),
    previous: daily(place.token, place.location, w.previous),
    keywords: keywords(place.token, place.location),
  })
  const { values, errors } = named(parts)
  return { windows: w, ...values, ...(errors && { errors }) }
}

// ── main ─────────────────────────────────────────────────────────────────────
const [channels, gbp] = await Promise.all([meta(), googleBusiness()])
const out = { generated_at: new Date().toISOString(), ...channels, gbp }
writeJson(OUT, out)
console.log(`social snapshot: ${statusLine(['ig', 'fb', 'gbp'], out)} → ${OUT}`)
