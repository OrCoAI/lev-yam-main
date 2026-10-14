#!/usr/bin/env node
/**
 * The content check — v1 of docs/plans/content-media-foundation.md (PR A).
 *
 *   node scripts/check-content.mjs     exit 1 and print file:line findings if any rule fails
 *
 * Born with the 2026-10-08 fix list (the plan's §Inventory) so those defects cannot come back.
 * Later PRs extend THIS script (records, consent, IDs, Drive-ID strings, publish_adr — ADR 0068/0069);
 * nothing live reads it (ADR 0069 §5). No npm dependencies, sub-second, runs in ci.yml.
 *
 * Rules (v1):
 *   alt       every <img> on a served page has an alt attribute
 *   i18n      every homepage data-i18n / -html / -alt / -gallery element's static Hebrew equals its
 *             js/app.js dict.he entry (one source of truth, no build step), and every key and
 *             gallery entry exists in both dictionaries
 *   size      a local <img>'s width/height have the file's shape (±3%); every srcset entry exists
 *             and its `Nw` descriptor is the file's real width
 *   meta      no served JPEG carries EXIF / XMP / IPTC (pixels only — ADR 0069 §6, media/README.md)
 *   facts     against FACTS.md: phone, email, venue coordinates, weekend hours (homepage text +
 *             JSON-LD), the village spelling; no long google.com/maps/place links (their viewport
 *             drifts — use the short place link)
 *   prices    no price pattern anywhere served (CLAUDE.md: no prices anywhere in the repo)
 *   weight    image and video budgets; a video that loads on its own (autoplay or preload) and is
 *             over budget must also offer a <source media> rendition within the phone budget
 *   share     the homepage share image is a 1200×630 file matching its og:image size tags
 */

import { readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { join, relative } from 'node:path'
import vm from 'node:vm'
import { ROOT } from './lib/chrome.mjs'

const KB = 1024, MB = 1024 * KB
const RULES = {
  share: [1200, 630],
  budget: { image: 700 * KB, video: 6 * MB, phoneVideo: 4 * MB },
}

const findings = []
const fail = (file, line, rule, msg) => findings.push(`${file}:${line}  [${rule}]  ${msg}`)
const cache = new Map()
const read = (rel) => cache.get(rel) ?? cache.set(rel, readFileSync(join(ROOT, rel), 'utf8')).get(rel)
const lineOf = (text, index) => text.slice(0, index).split('\n').length

/* ── what is served (mirrors scripts/assemble-site.sh's allowlist) ──── */

const filesUnder = (dir, re) => readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => relative(ROOT, join(d.parentPath ?? d.path, d.name)))
  .filter((rel) => re.test(rel))

// assemble-site.sh serves these root pages and the stories/ + happening/ trees, minus `_*` files,
// which are templates. Templates still carry the public chrome, so the facts rules read them too —
// a drifted footer is caught at its source, before the generators copy it into every page.
const ROOT_PAGES = ['index.html', '404.html', 'survey-june.html', 'pos.html']
const isTemplate = (rel) => /(^|\/)_[^/]*\.html$/.test(rel)
const TREE = [...filesUnder('stories', /\.html$/), ...filesUnder('happening', /\.html$/)]
const PAGES = [...ROOT_PAGES, ...TREE.filter((r) => !isTemplate(r))]
const TEMPLATES = TREE.filter(isTemplate)
const TEXT = [...PAGES, ...TEMPLATES, ...filesUnder('js', /\.js$/), 'llms.txt', 'FACTS.md']
const SIZE = new Map(filesUnder('img', /./).map((rel) => [rel, statSync(join(ROOT, rel)).size]))

/* ── image headers (no dependencies; the first 128 KB holds every header we read) ── */

const headCache = new Map()
function head(rel) {
  if (headCache.has(rel)) return headCache.get(rel)
  const fd = openSync(join(ROOT, rel), 'r'), buf = Buffer.alloc(128 * KB)
  const n = readSync(fd, buf, 0, buf.length, 0); closeSync(fd)
  return headCache.set(rel, buf.subarray(0, n)).get(rel)
}

/** JPEG segments before the scan: [[marker, offset]]. */
function jpegSegments(b) {
  const out = []
  for (let i = 2; i + 4 <= b.length && b[i] === 0xff && b[i + 1] !== 0xda; i += 2 + b.readUInt16BE(i + 2)) out.push([b[i + 1], i])
  return out
}

function dims(rel) {
  const b = head(rel)
  if (b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)]
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16)
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1] }
    if (kind === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1]
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    const sof = jpegSegments(b).find(([m]) => m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
    if (sof) return [b.readUInt16BE(sof[1] + 7), b.readUInt16BE(sof[1] + 5)]
  }
  return null
}

/* ── FACTS.md: the values the pages must agree with ─────────────────── */

const factsText = read('FACTS.md')
const FACTS = {
  phone: factsText.match(/וואטסאפ: `(\d+)`/)?.[1],
  email: factsText.match(/אימייל: `([^`]+)`/)?.[1],
  coords: factsText.match(/קואורדינטות: `([\d.]+), ([\d.]+)`/)?.slice(1),
  friday: factsText.match(/שישי \*\*(\d\d:\d\d)–(\d\d:\d\d)\*\*/)?.slice(1),
  saturdayLd: factsText.match(/שבת נרשמת\s+\*\*(\d\d:\d\d)–(\d\d:\d\d)\*\*/)?.slice(1),
}
for (const [key, value] of Object.entries(FACTS)) {
  if (!value) fail('FACTS.md', 1, 'facts', `cannot read "${key}" — the check parses that line's wording`)
}

/* ── the homepage dictionaries (pure data; evaluated in an empty context) ── */

const appJs = read('js/app.js')
const dictSrc = appJs.slice(appJs.indexOf('const translations = {') + 'const translations = '.length)
const dict = vm.runInNewContext('(' + dictSrc.slice(0, dictSrc.indexOf('\n  };\n') + 4) + ')', {})
const LANGS = Object.keys(dict)

/* ── rules over every served page ───────────────────────────────────── */

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]
const local = (url) => url?.replace(/^\//, '')

for (const page of PAGES) {
  const html = read(page)
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0], line = lineOf(html, m.index)
    if (tag.includes('facebook.com/tr?')) continue   // the Meta Pixel's no-JS beacon: analytics, not content
    if (attr(tag, 'alt') === undefined) fail(page, line, 'alt', 'img without an alt attribute')
    const src = local(attr(tag, 'src')), w = attr(tag, 'width'), h = attr(tag, 'height')
    if (SIZE.has(src) && w && h) {
      const d = dims(src)
      if (d && Math.abs((w / h) / (d[0] / d[1]) - 1) > 0.03) fail(page, line, 'size', `${src} is ${d[0]}×${d[1]} but declared ${w}×${h}`)
    }
  }
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const [url, desc] of m[1].split(',').map((s) => s.trim().split(/\s+/))) {
      const file = local(url)
      if (!file.startsWith('img/') || !desc?.endsWith('w')) continue
      if (!SIZE.has(file)) fail(page, lineOf(html, m.index), 'size', `srcset file ${file} does not exist`)
      else if (dims(file)?.[0] !== parseInt(desc)) fail(page, lineOf(html, m.index), 'size', `${file} is ${dims(file)?.[0]}px wide, srcset says ${desc}`)
    }
  }
  for (const v of html.matchAll(/<video\b[\s\S]*?<\/video>/g)) {
    // A click-to-play video (preload="none", no autoplay) costs nothing until the visitor asks for it.
    const opening = v[0].match(/<video\b[^>]*>/)[0]
    if (attr(opening, 'preload') === 'none' && !/\sautoplay\b/.test(opening)) continue
    const sources = [...v[0].matchAll(/<source\b[^>]*>/g)].map((s) => ({ src: local(attr(s[0], 'src')), media: attr(s[0], 'media') }))
      .filter((s) => SIZE.has(s.src))
    const phone = sources.some((s) => s.media)
    for (const s of sources) {
      const size = SIZE.get(s.src)
      if (s.media && size > RULES.budget.phoneVideo) fail(page, lineOf(html, v.index), 'weight', `${s.src} (${s.media}) is over the ${RULES.budget.phoneVideo / MB} MB phone budget`)
      if (!s.media && size > RULES.budget.video && !phone) fail(page, lineOf(html, v.index), 'weight', `${s.src} is over ${RULES.budget.video / MB} MB and the <video> offers no <source media> rendition for phones`)
    }
  }
}

/* ── the homepage: static Hebrew == dict.he, keys in every language ──── */

const home = read('index.html')
const norm = (s) => s.replace(/\s+/g, ' ').trim()
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const needKey = (key, line) => { for (const lang of LANGS) if (dict[lang][key] == null) fail('index.html', line, 'i18n', `key "${key}" missing from the ${lang} dictionary`) }

for (const m of home.matchAll(/<([a-z0-9]+)\b[^>]*?\sdata-i18n(-html)?="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)) {
  const [, , isHtml, key, inner] = m, line = lineOf(home, m.index)
  needKey(key, line)
  const shown = isHtml ? norm(inner) : norm(decode(inner.replace(/<[^>]+>/g, '')))
  if (dict.he[key] != null && shown !== norm(dict.he[key])) fail('index.html', line, 'i18n', `static Hebrew of "${key}" differs from dict.he`)
}
for (const m of home.matchAll(/<img\b[^>]*\sdata-i18n-alt="([^"]+)"[^>]*>/g)) {
  needKey(m[1], lineOf(home, m.index))
  if (dict.he[m[1]] != null && decode(attr(m[0], 'alt') ?? '') !== dict.he[m[1]]) fail('index.html', lineOf(home, m.index), 'i18n', `static alt of "${m[1]}" differs from dict.he`)
}
const gallery = [...home.matchAll(/<button\b[^>]*\sdata-i18n-gallery="(\d+)"[^>]*>[\s\S]*?<img\b[^>]*>/g)]
for (const lang of LANGS) {
  const n = (dict[lang].gallery_descs || []).length
  if (n !== gallery.length) fail('js/app.js', 1, 'i18n', `${lang} gallery_descs has ${n} entries for ${gallery.length} gallery photos`)
}
for (const g of gallery) {
  const i = +g[1], desc = dict.he.gallery_descs?.[i], line = lineOf(home, g.index)
  const label = `${dict.he.gallery_open_prefix} ${i + 1} — ${desc}`
  if (decode(attr(g[0].match(/<img\b[^>]*>/)[0], 'alt') ?? '') !== desc) fail('index.html', line, 'i18n', `gallery photo ${i + 1}: static alt differs from dict.he.gallery_descs[${i}]`)
  if (decode(attr(g[0], 'aria-label') ?? '') !== label) fail('index.html', line, 'i18n', `gallery photo ${i + 1}: static aria-label differs from the dict`)
}

/* ── facts and prices over all served text ──────────────────────────── */

for (const file of TEXT) {
  const text = read(file)
  // msg(m) returns the finding text, or null when this match is fine (e.g. the right phone number).
  const at = (re, rule, msg) => {
    for (const m of text.matchAll(re)) { const s = msg(m); if (s) fail(file, lineOf(text, m.index), rule, s) }
  }
  if (file !== 'FACTS.md') {
    at(/google\.com\/maps\/place\//g, 'facts', () => 'long Google Maps link — use the short place link (the long one carried a Tel Aviv viewport)')
    at(/ג[׳']יסר/g, 'facts', (m) => `"${m[0]}" — FACTS.md spells the village ג'סר`)
    at(/(?:wa\.me\/|tel:\+?)(\d{9,15})/g, 'facts', (m) => m[1] === FACTS.phone ? null : `phone ${m[1]} is not FACTS ${FACTS.phone}`)
    at(/mailto:([^"?\s]+)/g, 'facts', (m) => m[1] === FACTS.email ? null : `email ${m[1]} is not FACTS ${FACTS.email}`)
  }
  // \b is ASCII-only in JS, so Hebrew words need Unicode-letter lookarounds; the optional prefix catches
  // בשקלים / לשקל / ושקלים / השקלים without hitting משקל (weight) or שקלול (weighting).
  at(/₪|ש["״]ח|\bNIS\b|\bILS\b|(?<![\p{L}\p{M}])(?:ו?(?:מ?ה|[בלכ])|ו)?שקל(?:ים)?(?![\p{L}\p{M}])|شيكل|شيقل/gu, 'prices', (m) => `price pattern "${m[0]}" — no prices anywhere in the repo`)
}

/* ── homepage facts: every occurrence must equal the FACTS value ────── */

const spec = (day) => new RegExp(`"dayOfWeek": "${day}", "opens": "(\\d\\d:\\d\\d)", "closes": "(\\d\\d:\\d\\d)"`, 'g')
const PAIRS = [
  ['map pin', /data-lat="([\d.]+)"\s+data-lng="([\d.]+)"/g, FACTS.coords],
  ['JSON-LD geo', /"latitude": ([\d.]+), "longitude": ([\d.]+)/g, FACTS.coords],
  ['JSON-LD Friday hours', spec('Friday'), FACTS.friday],
  ['JSON-LD Saturday hours', spec('Saturday'), FACTS.saturdayLd],
]
for (const [what, re, want] of PAIRS) {
  if (!want) continue
  const hits = [...home.matchAll(re)]
  if (!hits.length) fail('index.html', 1, 'facts', `no ${what} — FACTS says ${want.join(' / ')}`)
  for (const m of hits) if (m[1] !== want[0] || m[2] !== want[1]) fail('index.html', lineOf(home, m.index), 'facts', `${what} ${m[1]} / ${m[2]} is not FACTS ${want.join(' / ')}`)
}
if (FACTS.friday) {
  const fri = FACTS.friday.join('–')
  for (const lang of LANGS) if (!(dict[lang].service_week_desc_html || '').includes(fri)) fail('js/app.js', 1, 'facts', `${lang} weekend card does not show the FACTS Friday hours ${fri}`)
}

/* ── files: metadata and weight ─────────────────────────────────────── */

for (const [rel, size] of SIZE) {
  if (/\.(jpe?g|png|webp)$/i.test(rel) && size > RULES.budget.image) fail(rel, 1, 'weight', `${Math.round(size / KB)} KB > ${RULES.budget.image / KB} KB image budget`)
  if (/\.jpe?g$/i.test(rel) && jpegSegments(head(rel)).some(([m]) => m === 0xe1 || m === 0xed)) {
    fail(rel, 1, 'meta', 'carries EXIF/XMP/IPTC — public files are written from pixels only (GPS, device, capture time)')
  }
}

const og = home.match(/<meta property="og:image" content="https:\/\/levyam\.com\/([^"]+)">/)?.[1]
const ogSize = ['width', 'height'].map((k) => +home.match(new RegExp(`og:image:${k}" content="(\\d+)"`))?.[1])
if (!SIZE.has(og)) fail('index.html', 1, 'share', 'og:image is not a file in this repo')
else {
  const d = dims(og)
  if (d?.[0] !== RULES.share[0] || d?.[1] !== RULES.share[1]) fail(og, 1, 'share', `share image is ${d?.join('×')}, not ${RULES.share.join('×')}`)
  if (ogSize[0] !== d?.[0] || ogSize[1] !== d?.[1]) fail('index.html', 1, 'share', 'og:image:width/height do not match the file')
}

if (findings.length) {
  console.error(`check-content: ${findings.length} finding(s)\n` + findings.map((f) => '  ' + f).join('\n'))
  process.exit(1)
}
console.log(`check-content: ok — ${PAGES.length} pages, ${TEMPLATES.length} templates, ${TEXT.length} text files, ${SIZE.size} media files`)
