#!/usr/bin/env node
/**
 * "What's happening" — the generated landing pages, the filled hubs, their
 * sitemap entries and the tier's feed config (docs/plans/events-whats-happening.md
 * "PR 2 — the landing pages", ADR 0056).
 *
 *   node scripts/gen-happening.mjs --stamp              stamp the chrome into the checkout's
 *                                                       happening/ templates + hub shells
 *   node scripts/gen-happening.mjs --check              fail if those stamped files are stale (ci.yml)
 *   node scripts/gen-happening.mjs --out _site          stamp, then render every live and recently
 *                                                       passed item (HE + AR) from the platform feed,
 *                                                       fill both hubs, add the items to the sitemap
 *                                                       and write the feed config — all into <out>/.
 *                                                       Reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
 *   node scripts/gen-happening.mjs --fixture --out DIR  the same from happening/_fixture.json —
 *                                                       no network (ci.yml, local screenshots)
 *
 * Two targets, on purpose:
 *   1. The CHECKOUT gets only chrome stamping (the header + footer of the two
 *      landing templates and the two hub shells) — the same rewrite
 *      scripts/gen-stories-index.mjs does for story pages (ADR 0049), so a nav
 *      or footer edit is one template edit per language and CI's --check
 *      catches drift.
 *   2. _site/ (the deploy output) gets the item pages and the filled hubs.
 *      They are never committed: the items live in the platform DB and are not
 *      known at commit time. scripts/assemble-site.sh runs this after the
 *      static copy; a feed fetch failure FAILS THE BUILD — a site whose shared
 *      links 404 is worse than a delayed deploy, and a re-run fixes it.
 *
 * The feed is read as anon with the publishable key — the same column grants
 * the browser has, so this can never render what the public may not see.
 * A rebuild is triggered by the `rebuild-site` Edge Function when an item is
 * published, and nightly on prod (deploy.yml `schedule`), so a passed item
 * leaves the sitemap and flips to its passed page without anyone publishing.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'
import { ROOT, chromeVars, stampChrome } from './lib/chrome.mjs'

const ORIGIN = 'https://levyam.com'
const HAPPENING_DIR = join(ROOT, 'happening')

// The browser's renderer, loaded under Node: one implementation of every card,
// date line and CTA text (js/happening-render.js is UMD for exactly this).
const require = createRequire(import.meta.url)
const R = require(join(ROOT, 'js', 'happening-render.js'))

/** One row per language; the URL scheme and every label come from the renderer. */
const LANGS = [
  { code: 'he', template: 'happening/_item.html', hub: 'happening/index.html' },
  { code: 'ar', template: 'happening/_item.ar.html', hub: 'happening/ar/index.html' },
].map((l) => ({ ...l, urlBase: R.labels(l.code).base }))
const HUB_ALTERNATES = Object.fromEntries(LANGS.map((l) => [l.code, l.urlBase]))
/** An item's page in each language, by code — the twins a page's hreflang pairs. */
const itemUrls = (slug) => Object.fromEntries(LANGS.map((l) => [l.code, `${l.urlBase}${slug}/`]))

/** Slugs come from the DB (events_slug_format), but this script writes
 *  directories from them — checked again here, never trusted. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  if (i === -1) return null
  const v = args[i + 1]
  if (v == null || v.startsWith('--')) throw new Error(`${name} needs a value`)
  return v
}
const CHECK = args.includes('--check')
const FIXTURE = args.includes('--fixture')
const OUT = flag('--out')
if (!CHECK && !OUT && !args.includes('--stamp')) {
  console.error('usage: node scripts/gen-happening.mjs --stamp | --check | [--fixture] --out <dir>')
  process.exit(2)
}

/* ── 1. chrome stamping into the checkout ────────────────────────────────── */

const stamped = []
for (const lang of LANGS) {
  // the landing template's header is the story chrome too; its language toggle
  // points at the item's twin, so the two URL placeholders stay for fill() below
  stamped.push({
    path: lang.template,
    content: stampChrome(readFileSync(join(ROOT, lang.template), 'utf8'), lang.code, chromeVars('{{HE_URL}}', '{{AR_URL}}'), lang.template),
  })
  stamped.push({
    path: lang.hub,
    content: stampChrome(
      readFileSync(join(ROOT, lang.hub), 'utf8'), lang.code,
      chromeVars(HUB_ALTERNATES.he, HUB_ALTERNATES.ar, { HAPPENING_CURRENT: ' aria-current="page"' }), lang.hub
    ),
  })
}
const stampedByPath = Object.fromEntries(stamped.map((s) => [s.path, s.content]))
const stale = stamped.filter((s) => readFileSync(join(ROOT, s.path), 'utf8') !== s.content).map((s) => s.path)
if (CHECK) {
  if (stale.length) {
    console.error(`gen-happening: ${stale.join(', ')} out of date.\nRun \`node scripts/gen-happening.mjs --stamp\` and commit the result.`)
    process.exit(1)
  }
  console.log('gen-happening: chrome up to date')
  process.exit(0)
}
for (const s of stamped) if (stale.includes(s.path)) writeFileSync(join(ROOT, s.path), s.content)
console.log(`gen-happening: chrome ${stale.length ? `stamped ${stale.join(', ')}` : 'up to date'}`)
if (!OUT) process.exit(0)

/* ── 2. the feed ─────────────────────────────────────────────────────────── */

const escapeHtml = R.escapeHtml

async function fetchView(cfg, view, query) {
  const { url, headers } = R.viewRequest(cfg, view, query)
  // fail fast on a hung connection instead of holding the deploy job to its 6 h timeout
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`events.${view} answered ${res.status} — the build stops here (a re-run fixes a transient failure).`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error(`events.${view} did not answer with an array.`)
  return checkItems(rows, view)
}

/** A photo is `<the row's id>/<name>.<ext>` in the public bucket (events_image_paths_valid);
 *  the fixture's are site paths under /img/. Checked here too, so a public page never
 *  depends on a CHECK it cannot see. */
const imagePathRe = (id) => (FIXTURE ? /^\/img\/[a-z0-9._/-]+$/ : new RegExp(`^${id}/[a-z0-9-]+\\.(jpg|jpeg|png|webp)$`))
function checkItems(rows, view) {
  for (const it of rows) {
    if (typeof it.slug !== 'string' || !SLUG_RE.test(it.slug)) throw new Error(`events.${view}: item ${it.id} has a slug this script will not write a directory for: ${JSON.stringify(it.slug)}`)
    if (!Array.isArray(it.image_paths)) throw new Error(`events.${view}: item ${it.slug} has no image_paths array.`)
    const re = imagePathRe(it.id)
    for (const p of it.image_paths) {
      if (typeof p !== 'string' || !re.test(p)) throw new Error(`events.${view}: item ${it.slug} has a photo path this script will not publish: ${JSON.stringify(p)}`)
    }
  }
  return rows
}

let cfg, feed, passed
if (FIXTURE) {
  const fx = JSON.parse(readFileSync(join(HAPPENING_DIR, '_fixture.json'), 'utf8'))
  // the fixture's images are absolute paths, so the feed origin is never used for them
  cfg = { url: 'http://127.0.0.1:54321', key: 'fixture' }
  feed = checkItems(fx.feed, 'feed')
  passed = checkItems(fx.passed, 'passed')
} else {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set (the tier\'s platform project; the anon/publishable key).')
  cfg = { url, key }
  ;[feed, passed] = await Promise.all([
    fetchView(cfg, 'feed', R.FEED_QUERY),
    fetchView(cfg, 'passed', 'select=*&order=last_date.desc'),
  ])
}
// one slug, one page: a passed row can never shadow a live one (the views are exclusive, but say so)
const liveSlugs = new Set(feed.map((it) => it.slug))
passed = passed.filter((it) => !liveSlugs.has(it.slug))

/* ── 3. rendering ────────────────────────────────────────────────────────── */

// `qrcode` is an app-src devDependency (no root package.json); both deploy
// workflows and ci.yml run `npm ci` there before a render. Loaded here, not at
// the top: `--check` runs in ci.yml BEFORE `npm ci` and must not need it.
const QRCode = createRequire(join(ROOT, 'app-src', 'package.json'))('qrcode')

/** `<!--#IF:NAME-->…<!--#ENDIF:NAME-->` blocks kept when flags[NAME], else dropped. */
function sections(html, flags) {
  return html.replace(/<!--#IF:([A-Z_]+)-->([\s\S]*?)<!--#ENDIF:\1-->/g, (_, name, body) => (flags[name] ? body : ''))
}

/**
 * `{{{RAW}}}` inserted as-is (markup this script built), `{{VAR}}` HTML-escaped.
 * ONE pass over the TEMPLATE: a value is never re-read as a placeholder, and the
 * stray-placeholder check runs on the template before any item text enters it —
 * so an item whose title says "{{x}}" renders those braces literally instead of
 * failing every deploy (gate finding, 2026-09-29). An unknown key or a malformed
 * placeholder is a template error and still fails the build.
 */
function fill(html, vars, where) {
  const stray = html.replace(/{{{?[A-Z_]+}?}}/g, '').match(/{{[^}]*}}/)
  if (stray) throw new Error(`${where}: the template carries the malformed placeholder ${stray[0]}.`)
  return html.replace(/{{({?)([A-Z_]+)}?}}/g, (_, raw, k) => {
    if (!(k in vars)) throw new Error(`${where}: no value for {{${raw}${k}${raw && '}'}}}.`)
    return raw ? vars[k] : escapeHtml(vars[k])
  })
}

/** JSON for a <script type="application/ld+json"> body: `<` is escaped so no
 *  value can carry `</script`, `<!--` or `<script` into the HTML tokenizer, and
 *  the two line separators JSON allows but old JS parsers did not. Valid JSON. */
const safeJson = (obj) =>
  JSON.stringify(obj, null, 2).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

/** schema.org BreadcrumbList — built here, not in the template, because a title
 *  needs JSON escaping in this context, not HTML escaping. */
function breadcrumbLd(item, lang, url) {
  const l = R.labels(lang)
  return safeJson({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: l.brand, item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: l.hubName, item: `${ORIGIN}${l.base}` },
      { '@type': 'ListItem', position: 3, name: R.text(item, 'title', lang), item: url },
    ],
  })
}

/** Asia/Jerusalem's UTC offset on a date (IST/IDT), for JSON-LD date-times. */
function jerusalemOffset(iso) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${iso}T12:00:00Z`)).find((p) => p.type === 'timeZoneName')
  return (part?.value || 'GMT+02:00').replace('GMT', '')
}
const DAY_URL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => `https://schema.org/${d}`)

/** schema.org Event — never `offers` (no prices, FACTS.md). */
function jsonLd(item, lang, url) {
  const title = R.text(item, 'title', lang)
  const date = R.keyDate(item)
  const at = (t) => (t ? `${date}T${String(t).slice(0, 8)}${jerusalemOffset(date)}` : date)
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: title,
    description: R.text(item, 'summary', lang),
    url,
    inLanguage: lang,
    image: [absolute(R.cover(cfg, item))],
    startDate: at(item.starts_at),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: R.labels(lang).brand,
      address: { '@type': 'PostalAddress', addressLocality: lang === 'ar' ? 'جسر الزرقاء' : "ג'סר א-זרקא", addressCountry: 'IL' },
      geo: { '@type': 'GeoCoordinates', latitude: 32.536803, longitude: 34.902106 },
    },
    organizer: { '@type': 'Organization', name: R.labels(lang).brand, url: `${ORIGIN}/` },
  }
  if (item.ends_at) ld.endDate = at(item.ends_at)
  if (R.isRecurring(item)) {
    ld.eventSchedule = {
      '@type': 'Schedule',
      byDay: item.recur_weekdays.slice().sort().map((d) => DAY_URL[d]),
      repeatFrequency: 'P1W',
      startDate: item.event_date,
      scheduleTimezone: 'Asia/Jerusalem',
      ...(item.starts_at ? { startTime: String(item.starts_at).slice(0, 5) } : {}),
      ...(item.ends_at ? { endTime: String(item.ends_at).slice(0, 5) } : {}),
      ...(item.recur_until ? { endDate: item.recur_until } : {}),
    }
  }
  return safeJson(ld)
}

const absolute = (path) => (/^https?:\/\//.test(path) ? path : `${ORIGIN}${path}`)
const hiddenAttr = (shown) => (shown ? '' : ' hidden')
/** A source file's leading banner (it documents the placeholder syntax literally) swapped for a GENERATED note. */
const generatedFrom = (html, source, note) =>
  html.replace(/<!--[\s\S]*?-->/, () => `<!--\n  GENERATED by scripts/gen-happening.mjs from ${source} — ${note}.\n-->`)

async function renderItem(lang, item, state, others) {
  const code = lang.code // the renderer takes the language code, never the row
  const urls = itemUrls(item.slug)
  const where = urls[code]
  const url = `${ORIGIN}${where}`
  const cover = R.cover(cfg, item)
  const audience = R.text(item, 'audience', code)
  const bring = R.text(item, 'bring', code)
  const cost = R.text(item, 'cost', code)
  const whenLines = R.whenLines(item, code)
  const wide = R.wideFact(item, code) // the tile that spans both columns, if any
  const wideClass = (name) => (wide === name ? ' hp-fact-wide' : '')
  const vars = {
    SLUG: item.slug,
    TITLE: R.text(item, 'title', code),
    SUMMARY: R.text(item, 'summary', code),
    WHEN: R.whenText(item, code),
    WHEN_FIRST: whenLines[0],
    WHEN_REST: whenLines[1],
    WHEN_REST_HIDDEN: hiddenAttr(whenLines[1]),
    DATE_ISO: R.keyDate(item),
    COVER: cover,
    OG_IMAGE: absolute(cover),
    HE_URL: urls.he,
    AR_URL: urls.ar,
    STATE: state,
    PASSED_HIDDEN: hiddenAttr(state === 'passed'),
    AUDIENCE: audience,
    BRING: bring,
    AUDIENCE_HIDDEN: hiddenAttr(audience),
    BRING_HIDDEN: hiddenAttr(bring),
    COST: cost,
    COST_WIDE: wideClass('cost'),
    AUDIENCE_WIDE: wideClass('audience'),
    BRING_WIDE: wideClass('bring'),
    COST_LINE_HIDDEN: hiddenAttr(cost),
    COST_HIDDEN: hiddenAttr(R.hasCost(item, code)),
    BOOKING: R.bookingText(item, code),
    CTA_HREF: R.ctaHref(item, code),
    SHARE_WA_HREF: R.shareWaHref(item, code, url),
    GALLERY_HIDDEN: hiddenAttr(item.image_paths.length),
    BODY_HTML: R.paragraphsHtml(R.text(item, 'body', code)),
    GALLERY_HTML: R.galleryHtml(cfg, item, code),
    PATHS_JSON: JSON.stringify(item.image_paths), // js/happening.js rebuilds the photos only when this changes
    NEXT_HTML: R.listHtml(cfg, others, code, { heading: 'h3', more: true }),
    QR_SVG: await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    BREADCRUMB_JSONLD: breadcrumbLd(item, code, url),
    JSONLD: state === 'live' ? jsonLd(item, code, url) : '',
  }
  const flags = {
    PASSED: state === 'passed',
    JSONLD: state === 'live',
  }
  const src = generatedFrom(stampedByPath[lang.template], lang.template, 'the item lives in /app/events')
  const html = fill(sections(src, flags), vars, where)
  return { path: join(where.slice(1), 'index.html'), html }
}

const outputs = []
for (const lang of LANGS) {
  for (const item of feed) {
    const others = feed.filter((o) => o.slug !== item.slug).slice(0, 3)
    outputs.push(await renderItem(lang, item, 'live', others))
  }
  for (const item of passed) outputs.push(await renderItem(lang, item, 'passed', feed.slice(0, 3)))

  // the hub: the checkout shell, its marker replaced by the cards
  const shell = stampedByPath[lang.hub]
  const marker = '<!--ITEM_LIST-->'
  if (!shell.includes(marker)) throw new Error(`${lang.hub} is missing the ${marker} marker.`)
  outputs.push({
    path: lang.hub,
    html: generatedFrom(shell, lang.hub, 'edit the shell, not this file')
      .replace(marker, () => R.listHtml(cfg, feed, lang.code, { heading: 'h2', eager: true })),
  })
}

/* ── 4. sitemap: the hubs and every LIVE item (passed pages are noindex) ──── */

function alternates(urls) {
  return Object.entries(urls).map(([code, href]) => `\n    <xhtml:link rel="alternate" hreflang="${code}" href="${ORIGIN}${escapeHtml(href)}"/>`).join('') +
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${escapeHtml(urls.he)}"/>`
}
const entries = [
  ...LANGS.map((l) => ({ loc: l.urlBase, alt: HUB_ALTERNATES })),
  ...LANGS.flatMap((l) => feed.map((it) => {
    const alt = itemUrls(it.slug)
    return { loc: alt[l.code], alt }
  })),
]
const sitemapSrc = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8')
if (!sitemapSrc.includes('</urlset>')) throw new Error('sitemap.xml has no </urlset> — run scripts/gen-stories-index.mjs first.')
const sitemap = sitemapSrc.replace('</urlset>', () =>
  `  <!-- /happening/ — GENERATED by scripts/gen-happening.mjs at deploy; no lastmod: the items change daily. -->\n` +
  entries.map((e) => `  <url>\n    <loc>${ORIGIN}${escapeHtml(e.loc)}</loc>${alternates(e.alt)}\n  </url>`).join('\n') +
  '\n</urlset>')
outputs.push({ path: 'sitemap.xml', html: sitemap })

/* ── 5. the tier's feed config for the browser ───────────────────────────── */

if (!FIXTURE) {
  outputs.push({
    path: 'js/happening-config.js',
    html: `/* GENERATED by scripts/gen-happening.mjs at deploy — the tier's platform project (the anon/publishable key; RLS is the guard). */\nwindow.LEVYAM_FEED = ${JSON.stringify({ url: cfg.url, key: cfg.key })};\n`,
  })
}

/* ── write ───────────────────────────────────────────────────────────────── */

for (const o of outputs) {
  const abs = join(OUT, o.path)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, o.html)
}
console.log(`gen-happening: ${feed.length} live + ${passed.length} passed item(s) × ${LANGS.length} languages → ${relative(process.cwd(), OUT) || '.'}/happening/ (${outputs.length} files${FIXTURE ? ', fixture' : ''})`)
