#!/usr/bin/env node
/**
 * The content check — docs/plans/content-media-foundation.md (v1 PR A, v2 PR B, v3 PR C).
 *
 *   node scripts/check-content.mjs           exit 1 and print file:line findings if any rule fails
 *   node scripts/check-content.mjs --write   first rewrite every record's used_in from the pages
 *
 * Born with the 2026-10-08 fix list (the plan's §Inventory) so those defects cannot come back.
 * Later PRs extend THIS script (v2 below: records, consent, IDs, Drive-ID strings, publish_adr — ADR 0068/0069);
 * nothing live reads it (ADR 0069 §5). No npm dependencies, sub-second, runs in ci.yml.
 *
 * Rules (v1):
 *   alt       every <img> on a served page has an alt attribute
 *   i18n      every homepage data-i18n / -html / -alt / -gallery element's static Hebrew equals its
 *             js/app.js dict.he entry (one source of truth, no build step), and every key and
 *             gallery entry exists in both dictionaries
 *   size      a local <img>'s width/height have the file's shape (±3%); every srcset entry exists
 *             and its `Nw` descriptor is the file's real width
 *   meta      no committed image or clip carries metadata (pixels only — ADR 0069 §6): JPEG EXIF / XMP /
 *             IPTC / comments, WebP EXIF / XMP, PNG eXIf / text chunks, an MP4's location, Apple camera keys,
 *             capture time or a data track (v3)
 *   facts     against FACTS.md: phone, email, venue coordinates, weekend hours (homepage text +
 *             JSON-LD), the village spelling; no long google.com/maps/place links (their viewport
 *             drifts — use the short place link)
 *   prices    no price pattern anywhere served (CLAUDE.md: no prices anywhere in the repo)
 *   weight    image and video budgets; a video that loads on its own (autoplay or preload) and is
 *             over budget must also offer a <source media> rendition within the phone budget
 *   share     the homepage share image is a 1200×630 file matching its og:image size tags
 *
 * Rules (v2 — the content records, PR B; content/README.md is the model):
 *   records   content/media.json + brand/assets.json: every rendition exists, every img/ file has exactly
 *             one owner (a media record, or a brand asset for logos and icons); a whatsapp: true record
 *             never sits in a whatsapp_ok: false preset
 *   ids       media / post / brand / card IDs match their grammar (ADR 0068 §5)
 *   used      a record's used_in equals the served pages, js/ and css/ that reference its renditions
 *   alt       a non-empty page alt equals the record's alt in that page's language (HE + AR)
 *   consent   recognisable people are used only within their consent scope (ADR 0069 §4)
 *   channels  modes and presets are valid; a live channel has content/channels/<id>.md; `publish` only
 *             with an ADR whose title says publish and names the channel id in backticks
 *   posts     front matter, the post id is the utm_campaign, built from media IDs only, three captions
 *             (HE / AR / Mixed), no posting without the Arabic sign-off (ADR 0069 §2, §7)
 *             · `results` only as scripts/post-results.mjs writes it, over the 7 days from `posted` (PR D)
 *   drive     no Drive / Docs link or Drive-ID-shaped string in any text file in the repo (ADR 0069 §1)
 *   pii       no email or phone number in the records but the venue's; the records are .md / .json only (invariant 3)
 *   tokens    css/styles.css --color/space/radius-* ⇄ brand/tokens.json both ways; theme.ts colours and theme-color too
 *   sizes     the presets are well formed (scripts/media.sh cuts from them); the /app/events upload, which
 *             makes its own, carries the events-photo sizes (v3)
 *   briefs    a reel brief names no raw file; the reels' asset map (video/assets.json) names media / brand IDs that exist (v3)
 */

import { readFileSync, readdirSync, statSync, openSync, readSync, closeSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { ROOT } from './lib/chrome.mjs'
import { ID, THEMES, isDate, RESULTS, RESULT_DAYS, resultsEnd, front, unquote } from './lib/content.mjs'

const KB = 1024, MB = 1024 * KB
const RULES = {
  share: [1200, 630],
  budget: { image: 700 * KB, video: 6 * MB, phoneVideo: 4 * MB },
}

const WRITE = process.argv.includes('--write')
const findings = []
const fail = (file, line, rule, msg) => findings.push(`${file}:${line}  [${rule}]  ${msg}`)
const cache = new Map()
const read = (rel) => cache.get(rel) ?? cache.set(rel, readFileSync(join(ROOT, rel), 'utf8')).get(rel)
const lineOf = (text, index) => text.slice(0, index).split('\n').length

/* ── what is served (mirrors scripts/assemble-site.sh's allowlist) ──── */

// Every file git would commit — tracked, or new and not ignored (so a stray .DS_Store or a raw .MOV the
// .gitignore expects is never a finding) — that is still on disk.
const GIT_FILES = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * MB })
  .split('\0').filter((f) => f && existsSync(join(ROOT, f)))
const IN_GIT = new Set(GIT_FILES)
const filesUnder = (dir, re) => GIT_FILES.filter((rel) => rel.startsWith(dir + '/') && re.test(rel))

// assemble-site.sh serves these root pages and the stories/ + happening/ trees, minus `_*` files,
// which are templates. Templates still carry the public chrome, so the facts rules read them too —
// a drifted footer is caught at its source, before the generators copy it into every page.
const ROOT_PAGES = ['index.html', '404.html', 'survey-june.html', 'pos.html']
const isTemplate = (rel) => /(^|\/)_[^/]*\.html$/.test(rel)
const TREE = [...filesUnder('stories', /\.html$/), ...filesUnder('happening', /\.html$/)]
const PAGES = [...ROOT_PAGES, ...TREE.filter((r) => !isTemplate(r))]
const TEMPLATES = TREE.filter(isTemplate)
const JS = filesUnder('js', /\.js$/)
const TEXT = [...PAGES, ...TEMPLATES, ...JS, 'llms.txt', 'FACTS.md']
// the records (content/ + brand/) and every text file in the repo — the no-leak rules read them (v2).
// Text = no NUL byte in the first 8 KB, whatever the extension; lockfiles hold only registry hashes.
const RECORDS = [...filesUnder('content', /./), ...filesUnder('brand', /./)]
const RECORDS_TEXT = RECORDS.filter((f) => /\.(md|json)$/.test(f))
const isText = (rel) => { const fd = openSync(join(ROOT, rel), 'r'), b = Buffer.alloc(8192); const n = readSync(fd, b, 0, b.length, 0); closeSync(fd); return !b.subarray(0, n).includes(0) }
const ALL_TEXT = GIT_FILES.filter((f) => !/(^|\/)package-lock\.json$/.test(f) && isText(f))
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

/* ── facts, prices and leaks over all text ──────────────────────────── */

// msg(m) returns the finding text, or null when this match is fine (e.g. the right phone number).
const scan = (file, re, rule, msg) => {
  const text = read(file)
  for (const m of text.matchAll(re)) { const s = msg(m); if (s) fail(file, lineOf(text, m.index), rule, s) }
}
// \b is ASCII-only in JS, so Hebrew words need Unicode-letter lookarounds; the optional prefix catches
// בשקלים / לשקל / ושקלים / השקלים without hitting משקל (weight) or שקלול (weighting).
const PRICE = /₪|ש["״]ח|\bNIS\b|\bILS\b|(?<![\p{L}\p{M}])(?:ו?(?:מ?ה|[בלכ])|ו)?שקל(?:ים)?(?![\p{L}\p{M}])|شيكل|شيقل/gu
const noPrice = (m) => `price pattern "${m[0]}" — no prices anywhere in the repo`

for (const file of TEXT) {
  if (file !== 'FACTS.md') {
    scan(file, /google\.com\/maps\/place\//g, 'facts', () => 'long Google Maps link — use the short place link (the long one carried a Tel Aviv viewport)')
    scan(file, /ג[׳']יסר/g, 'facts', (m) => `"${m[0]}" — FACTS.md spells the village ג'סר`)
    scan(file, /(?:wa\.me\/|tel:\+?)(\d{9,15})/g, 'facts', (m) => m[1] === FACTS.phone ? null : `phone ${m[1]} is not FACTS ${FACTS.phone}`)
    scan(file, /mailto:([^"?\s]+)/g, 'facts', (m) => m[1] === FACTS.email ? null : `email ${m[1]} is not FACTS ${FACTS.email}`)
  }
  scan(file, PRICE, 'prices', noPrice)
}
// The records are .md / .json only (brand/assets/ holds the vector masters) — a .csv or a spreadsheet
// export is how an ID → Drive map would slip in.
for (const f of RECORDS) if (!/\.(md|json)$/.test(f) && !f.endsWith('/.gitkeep') && !/^brand\/assets\/[^/]+\.(svg|pdf|eps|ai)$/.test(f)) fail(f, 1, 'records', 'only .md / .json records (and vector masters in brand/assets/) live in content/ and brand/ — the rest stays in the Drive fence')
// The records: no price, no person (invariant 3). Captions, quick replies and GBP services are the likeliest leak paths.
for (const file of RECORDS_TEXT) {
  scan(file, PRICE, 'prices', noPrice)
  scan(file, /[\w.+-]+@(?!\d+x\.(?:png|jpe?g|webp|avif|gif|svg)\b)[\w-]+(?:\.[\w-]+)+/g, 'pii', (m) => m[0] === FACTS.email ? null : `email address "${m[0]}" — no personal data in the records`)
  // Israeli mobiles and landlines, with spaces, dots or hyphens between the groups
  scan(file, /(?<![\d+])(?:\+?972[\s.-]?|0)(?:5\d|[2-489]|7\d)[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g, 'pii', (m) => m[0].replace(/\D/g, '').endsWith(FACTS.phone?.slice(3) ?? '#') ? null : `phone number "${m[0]}" — only the venue's WhatsApp`)
}
// Nowhere in the repo: a Drive link or a Drive file ID resolves to an unstripped original the day a
// folder is shared by link, and git keeps it forever (ADR 0069 §1). A file ID is mixed-case base64url:
// `1` + 32 or 43 chars today, `0B` + 26 (legacy files), `0A` + 17 (shared drives).
for (const file of ALL_TEXT) {
  scan(file, /(?:drive|docs|drive\.usercontent)\.google\.com\/\S*?[A-Za-z0-9_-]{19,}|googleusercontent\.com\/d\//g, 'drive', () => 'a Google Drive / Docs link — the ID → Drive map lives in the fence, never in the repo')
  // An ID sits in prose, a path or a query (`folders/<id>`, `id=<id>`); a base64 blob (an inlined image, a
  // data: URI) is one long run, nearly always with a `+` — judge the whole run, not the boundary characters.
  scan(file, /(?<![\w+-])(?:1[A-Za-z0-9_-]{32}|1[A-Za-z0-9_-]{43}|0B[A-Za-z0-9_-]{26}|0A[A-Za-z0-9_-]{17})(?![\w+=-])/g, 'drive', (m) => {
    let a = m.index, b = a + m[0].length
    while (a > 0 && /[\w+/=-]/.test(m.input[a - 1])) a--
    while (b < m.input.length && /[\w+/=-]/.test(m.input[b])) b++
    if (b - a >= 120 || m.input.slice(a, b).includes('+')) return null
    return /[A-Z]/.test(m[0].slice(2)) && /[a-z]/.test(m[0]) ? `"${m[0]}" is shaped like a Drive file ID` : null
  })
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
}

/** Chunk types of a WebP (RIFF: little-endian sizes, padded to even) or a PNG (big-endian sizes + CRC). */
function chunks(b, png) {
  const out = []
  for (let i = png ? 8 : 12; i + 8 <= b.length;) {
    const n = png ? b.readUInt32BE(i) : b.readUInt32LE(i + 4)
    out.push(b.toString('latin1', png ? i + 4 : i, png ? i + 8 : i + 4))
    i += png ? 12 + n : 8 + n + (n & 1)
  }
  return out
}
/** An MP4's top-level box types and its moov box — where its metadata lives; the media data is never read. */
function mp4Boxes(rel) {
  const fd = openSync(join(ROOT, rel), 'r'), h = Buffer.alloc(16), total = statSync(join(ROOT, rel)).size, top = []
  let moov = Buffer.alloc(0)
  try {
    for (let i = 0; i + 8 <= total;) {
      readSync(fd, h, 0, 16, i)
      let size = h.readUInt32BE(0)
      if (size === 1) size = Number(h.readBigUInt64BE(8)); else if (size === 0) size = total - i
      if (size < 8) { top.push('a broken box'); break }
      top.push(h.toString('latin1', 4, 8))
      if (top.at(-1) === 'moov') { moov = Buffer.alloc(size); readSync(fd, moov, 0, size, i) }
      else if (PADDING.has(top.at(-1))) {   // padding may hold nothing but zeros
        const pad = Buffer.alloc(Math.min(size - 8, MB)); readSync(fd, pad, 0, pad.length, i + 8)
        if (size - 8 > MB || pad.some((x) => x)) top[top.length - 1] = `${top.at(-1)} (with content)`
      }
      i += size
    }
  } finally { closeSync(fd) }
  return { top, moov }
}
const PADDING = new Set(['free', 'skip', 'wide'])
const MP4_TOP = new Set(['ftyp', 'mdat', 'moov', ...PADDING])
// the boxes ffmpeg writes under each container we walk; anything else is a place text could hide
const MP4_CHILDREN = {
  moov: ['mvhd', 'trak', 'udta', 'mvex', 'iods'], trak: ['tkhd', 'edts', 'mdia', 'udta', 'tref'], mdia: ['mdhd', 'hdlr', 'minf'],
  udta: ['meta'], meta: ['hdlr', 'ilst'], ilst: ['\u00a9too'],
}
/** What in an MP4 could say where, when, who or on what it was shot: anything beyond the boxes ffmpeg writes. */
function mp4Leaks({ top, moov: b }) {
  const leaks = new Set(top.filter((t) => !MP4_TOP.has(t)).map((t) => `a top-level ${t} box`))
  if (b.includes('com.apple.quicktime.')) leaks.add('Apple camera keys')
  const walk = (start, end, parent) => {
    for (let i = start; i + 8 <= end;) {
      let size = b.readUInt32BE(i), hdr = 8
      if (size === 1) { size = Number(b.readBigUInt64BE(i + 8)); hdr = 16 } else if (size === 0) size = end - i
      if (size < hdr || i + size > end) return
      const type = b.toString('latin1', i + 4, i + 8), body = i + hdr
      if (type === '\u00a9xyz' || type === 'loci') leaks.add('a location')
      else if (MP4_CHILDREN[parent] && !MP4_CHILDREN[parent].includes(type)) leaks.add(`a ${JSON.stringify(type)} box in ${parent}`)
      if (type === 'uuid' || type === 'XMP_') leaks.add('XMP')
      if (['mvhd', 'tkhd', 'mdhd'].includes(type) && (b[body] === 1 ? b.readBigUInt64BE(body + 4) : b.readUInt32BE(body + 4))) leaks.add('a capture time')
      if (type === 'hdlr' && parent === 'mdia' && !['vide', 'soun'].includes(b.toString('latin1', body + 8, body + 12))) leaks.add('a data track')
      if (['moov', 'trak', 'mdia', 'udta', 'ilst'].includes(type)) walk(body, i + size, type)
      if (type === 'meta') walk(body + (b.readUInt32BE(body) === 0 ? 4 : 0), i + size, type)   // ISO meta is a full box, QuickTime's is not
      i += size
    }
  }
  walk(0, b.length, '')
  return [...leaks]
}
// every committed rendition — img/ and the reels' own files — is pixels only
const RENDITION_FILES = [...SIZE.keys(), ...filesUnder('video/public/photos', /./), ...filesUnder('video/public/brand', /./)]
const JPEG_META = { 0xe1: 'EXIF/XMP', 0xed: 'IPTC', 0xfe: 'a comment' }
// JFIF, a colour profile, Adobe's colour flag and the image's own structure — any other segment can hold text
const JPEG_OK = new Set(['icc', 0xe0, 0xee, 0xdb, 0xc4, 0xdd, 0xda, 0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
const CHUNK_META = new Set(['EXIF', 'XMP ', 'eXIf', 'tEXt', 'zTXt', 'iTXt'])
/** Every marker of a JPEG through to its end, the scans' entropy-coded data skipped — a progressive JPEG
 *  can carry a segment between scans. end = the offset after EOI, or -1 if the structure breaks. */
function jpegMarkers(b) {
  const markers = []
  for (let i = 2; i + 1 < b.length;) {
    if (b[i] !== 0xff) return { markers, end: -1 }
    const m = b[i + 1]
    if (m === 0xd9) return { markers, end: i + 2 }
    if (m === 0xff) { i++; continue }                                   // fill byte
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue }    // restart markers carry no length
    if (i + 4 > b.length) break
    markers.push(m === 0xe2 && b.toString('latin1', i + 4, i + 16) === 'ICC_PROFILE\0' ? 'icc' : m)   // a colour profile is colour, not a person
    i += 2 + b.readUInt16BE(i + 2)
    if (m === 0xda) while (i + 1 < b.length && !(b[i] === 0xff && b[i + 1] !== 0 && !(b[i + 1] >= 0xd0 && b[i + 1] <= 0xd7))) i++
  }
  return { markers, end: -1 }
}
/** JPEG metadata segments anywhere, and anything after the image's end (a second, EXIF-carrying JPEG rides there). */
function jpegMeta(rel) {
  const b = readFileSync(join(ROOT, rel)), { markers, end } = jpegMarkers(b)
  const bad = markers.filter((m) => !JPEG_OK.has(m)).map((m) => JPEG_META[m] ?? `an 0x${m.toString(16)} segment`)
  if (end !== b.length) bad.push(end < 0 ? 'a broken structure' : 'data after the image')
  return bad
}
const metaOf = (rel) =>
  /\.jpe?g$/i.test(rel) ? jpegMeta(rel)
  : /\.(webp|png)$/i.test(rel) ? chunks(readFileSync(join(ROOT, rel)), rel.endsWith('.png')).filter((c) => CHUNK_META.has(c))
  : /\.mp4$/i.test(rel) ? mp4Leaks(mp4Boxes(rel))
  : ['an unchecked format (only jpg, png, webp and mp4 are committed)']
for (const rel of RENDITION_FILES) {
  const bad = [...new Set(metaOf(rel))]
  if (bad.length) fail(rel, 1, 'meta', `carries ${bad.join(', ')} — public files are written from pixels only (scripts/media.sh)`)
}

const og = home.match(/<meta property="og:image" content="https:\/\/levyam\.com\/([^"]+)">/)?.[1]
const ogSize = ['width', 'height'].map((k) => +home.match(new RegExp(`og:image:${k}" content="(\\d+)"`))?.[1])
if (!SIZE.has(og)) fail('index.html', 1, 'share', 'og:image is not a file in this repo')
else {
  const d = dims(og)
  if (d?.[0] !== RULES.share[0] || d?.[1] !== RULES.share[1]) fail(og, 1, 'share', `share image is ${d?.join('×')}, not ${RULES.share.join('×')}`)
  if (ogSize[0] !== d?.[0] || ogSize[1] !== d?.[1]) fail('index.html', 1, 'share', 'og:image:width/height do not match the file')
}

/* ── v2: the content records (PR B — ADR 0068 / 0069, content/README.md) ── */

const readJson = (rel) => { try { return JSON.parse(read(rel)) } catch (e) { fail(rel, 1, 'records', `not valid JSON — ${e.message}`); return null } }
const failIn = (file) => (rule, msg) => fail(file, 1, rule, msg)
const M = failIn('content/media.json'), C = failIn('content/channels.json'), B = failIn('brand/assets.json')
const SCOPES = ['none', 'site', 'social', 'ads']
const PEOPLE = ['none', 'not-recognisable', 'adults', 'children']
/** A record may be used at `scope` — recognisable people only within their consent (ADR 0069 §4). */
const covers = (r, scope) => !['adults', 'children'].includes(r.people) || SCOPES.indexOf(r.consent) >= SCOPES.indexOf(scope)

const channels = readJson('content/channels.json')
const mediaDoc = readJson('content/media.json')
const media = mediaDoc?.media ?? []
const brandAssets = readJson('brand/assets.json')?.assets ?? []

// `publish` only with an ADR whose title names the channel (ADR 0068 §2)
// — the title says "publish … `ig`" (the channel id in backticks, in the same clause) and negates nothing, so
// neither a title that merely mentions "site" nor "no publishing to `ig`" can authorise a channel.
const adrNames = (num, c) => {
  const file = /^\d{4}$/.test(num ?? '') && readdirSync(join(ROOT, 'docs/decisions')).find((f) => f.startsWith(num + '-'))
  const title = file ? read(`docs/decisions/${file}`).split('\n')[0] : ''
  return new RegExp(`\\bpublish(es|ed|ing)?\\b[^.;]*\`${c.id}\``, 'i').test(title) && !/\b(never|not|no|without|until|stays?)\b/i.test(title)
}
const CHANNEL = new Map((channels?.channels ?? []).map((c) => [c.id, c]))
// which stemmed preset a committed file was cut at — media.sh names it <stem>[-<width>].<format>
const STEMMED = Object.entries(channels?.presets ?? {}).filter(([, p]) => p.stem && p.sizes)
const presetName = (f) => STEMMED.find(([, p]) => p.sizes.some((s) => f.endsWith(`/${p.stem}${p.sizes.length > 1 ? `-${s[0]}` : ''}.${p.format}`)))?.[0]
for (const c of CHANNEL.values()) {
  if (!['read', 'draft', 'publish'].includes(c.mode)) C('channels', `${c.id}: mode "${c.mode}" is not read|draft|publish`)
  for (const p of c.presets ?? []) if (!channels.presets?.[p]) C('channels', `${c.id}: preset "${p}" is not defined`)
  if (c.status === 'live' && !existsSync(join(ROOT, `content/channels/${c.id}.md`))) C('channels', `${c.id} is live without its profile text in content/channels/${c.id}.md`)
  if (c.mode === 'publish' && !adrNames(c.publish_adr, c)) C('channels', `${c.id} is in publish mode without an ADR (publish_adr) whose title says publish and names \`${c.id}\``)
}
const pair = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n > 0)
for (const k of ['jpg', 'webp', 'mp4_crf']) if (!Number.isInteger(channels?.quality?.[k])) C('channels', `quality.${k} must be a whole number — scripts/media.sh's one quality table`)
for (const [name, p] of Object.entries(channels?.presets ?? {})) {
  if (!p.made_by && !(p.sizes?.length && p.sizes.every(pair)) && !(p.widths?.length && p.fallback_long_edge)) C('channels', `${name}: needs sizes [[w, h], …] or widths + fallback_long_edge, or made_by naming the tool that makes it`)
  if ('min_source' in p && !pair(p.min_source)) C('channels', `${name}: min_source must be [w, h]`)
  if ('stem' in p && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.stem)) C('channels', `${name}: stem "${p.stem}" is not a kebab-case file stem`)
  if ('whatsapp_ok' in p && typeof p.whatsapp_ok !== 'boolean') C('channels', `${name}: whatsapp_ok must be true or false`)
  if (p.whatsapp_ok === false && !(p.stem && p.sizes)) C('channels', `${name}: whatsapp_ok false needs a stem and sizes — the check finds the preset's files by their names`)
}

// every committed rendition has exactly one owner: a media record or a brand asset
const OWNER = new Map(), RECORD = new Map()
const own = (file, id, F) => {
  if (!IN_GIT.has(file)) F('records', `${id}: ${file} is not a file git would commit`)
  if (OWNER.has(file)) F('records', `${file} belongs to both ${OWNER.get(file)} and ${id}`)
  OWNER.set(file, id)
}
for (const r of media) {
  if (!ID.media.test(r.id ?? '')) M('ids', `media id "${r.id}" does not match ${ID.media}`)
  if (RECORD.has(r.id)) M('ids', `duplicate media id ${r.id}`)
  RECORD.set(r.id, r)
  if (!PEOPLE.includes(r.people)) M('records', `${r.id}: people "${r.people}" is not ${PEOPLE.join('|')}`)
  if (!SCOPES.includes(r.consent)) M('records', `${r.id}: consent "${r.consent}" is not ${SCOPES.join('|')}`)
  if (!/^\d{4}-\d{2}$/.test(r.published ?? '')) M('records', `${r.id}: published "${r.published}" is not YYYY-MM`)
  if (r.kind === 'image' && !(r.alt?.he && r.alt?.ar)) M('records', `${r.id}: an image record needs alt.he and alt.ar`)
  if ('whatsapp' in r && r.whatsapp !== true) M('records', `${r.id}: whatsapp must be true or absent`)
  for (const f of r.renditions ?? []) {
    own(f, r.id, M)
    // a WhatsApp copy is a last-choice source, refused by any preset with whatsapp_ok: false (ADR 0069 amended 2026-10-23)
    const preset = presetName(f)
    if (r.whatsapp && channels?.presets?.[preset]?.whatsapp_ok === false) M('records', `${r.id}: ${f} is cut at ${preset}, which refuses a WhatsApp copy — use the original`)
  }
}
for (const a of brandAssets) {
  if (!ID.brand.test(a.id ?? '')) B('ids', `brand id "${a.id}" does not match ${ID.brand}`)
  for (const f of [a.master, ...(a.served ?? [])].filter(Boolean)) own(f, a.id, B)
}
for (const f of RENDITION_FILES) if (!OWNER.has(f)) fail(f, 1, 'records', 'no record — add it to content/media.json (or brand/assets.json for a logo or icon)')

// where each record is used, recomputed over the served pages, js/ and css/; `--write` refreshes used_in
const USERS = [...PAGES, ...JS, ...filesUnder('css', /\.css$/)]
for (const r of media) {
  const used = USERS.filter((u) => (r.renditions ?? []).some((f) => read(u).includes(f))).sort()
  if (WRITE) r.used_in = used
  else if (used.join() !== [...(r.used_in ?? [])].sort().join()) M('used', `${r.id}: used_in says [${(r.used_in ?? []).join(', ')}], the pages say [${used.join(', ')}] — run with --write`)
  if (used.length && !covers(r, 'site')) M('consent', `${r.id}: recognisable ${r.people} on ${used[0]} without consent scope "site"`)
}
if (WRITE && mediaDoc) writeFileSync(join(ROOT, 'content/media.json'), JSON.stringify(mediaDoc, null, 2) + '\n')

// page alt == record alt, in the page's language; an empty alt is a deliberate decorative image
const altCheck = (page, line, src, lang, shown) => {
  const r = RECORD.get(OWNER.get(src))
  if (r?.alt && shown && decode(shown) !== r.alt[lang]) fail(page, line, 'alt', `${src}: ${lang} alt differs from ${r.id}'s record alt`)
}
for (const page of PAGES) {
  const html = read(page), lang = /(^|\/)ar\//.test(page) ? 'ar' : 'he'
  for (const m of html.matchAll(/<img\b[^>]*>/g)) altCheck(page, lineOf(html, m.index), local(attr(m[0], 'src')), lang, attr(m[0], 'alt'))
}
// the homepage's Arabic alts live in the dictionary
for (const m of home.matchAll(/<img\b[^>]*\sdata-i18n-alt="([^"]+)"[^>]*>/g)) altCheck('js/app.js', 1, local(attr(m[0], 'src')), 'ar', dict.ar?.[m[1]])
for (const g of gallery) altCheck('js/app.js', 1, local(attr(g[0].match(/<img\b[^>]*>/)[0], 'src')), 'ar', dict.ar?.gallery_descs?.[+g[1]])

// a path to an original or a rendition — pieces name IDs instead (ADR 0069 §2)
const RAW_FILE = /(^|[\s(`"'/.])(img|media|video\/public)\/\S+\.(jpe?g|png|webp|heic|mov|mp4)/i
// post records: a file in content/posts/ is a post (only .gitkeep is not), built from media IDs,
// consent covering the channel, never posted before the Arabic sign-off (ADR 0069 §2, §3, §7)
// front matter: scripts/lib/content.mjs (one parser for the check, the freshness numbers and the results)
for (const rel of filesUnder('content/posts', /./).filter((r) => !r.endsWith('/.gitkeep'))) {
  const P = failIn(rel), text = read(rel), fm = front(text), id = rel.replace(/^.*\//, '').replace(/\.md$/, '')
  const ch = id.match(ID.post)?.[1]
  if (!rel.endsWith('.md') || !CHANNEL.has(ch)) P('ids', `"${id}" is not a post id (${ID.post}, a channel from channels.json)`)
  if (fm.id !== id) P('posts', `front matter id "${fm.id}" is not the file name`)
  if (fm.channel !== ch) P('posts', `channel "${fm.channel}" is not the id's channel "${ch}"`)
  if (!THEMES.includes(fm.theme)) P('posts', `theme "${fm.theme}" is not one of ADR 0070's: ${THEMES.join(', ')}`)
  const utmSource = CHANNEL.get(ch)?.utm_source, q = URL.canParse(fm.utm ?? '') ? new URL(fm.utm).searchParams : null
  if (fm.utm && (q?.get('utm_campaign') !== id || (utmSource && q.get('utm_source') !== utmSource))) P('posts', `the UTM link needs utm_campaign=${id}${utmSource ? ` and utm_source=${utmSource}` : ''}`)
  if (fm.posted && !isDate(fm.posted)) P('posts', `posted "${fm.posted}" is not a YYYY-MM-DD date`)
  if (fm.posted && !isDate(fm.ar_signed)) P('posts', 'marked posted without the Arabic sign-off date (ADR 0069 §7)')
  // results are written by scripts/post-results.mjs: the post's first RESULT_DAYS days, totals only
  if (fm.results) {
    const r = fm.results.match(RESULTS)
    if (!r) P('posts', `results "${fm.results}" is not "sessions N · whatsapp_click N · YYYY-MM-DD..YYYY-MM-DD" (scripts/post-results.mjs writes it)`)
    else if (!fm.utm) P('posts', 'results on a post with no link — it carries no utm_campaign to measure')
    else if (!isDate(fm.posted) || r[3] !== fm.posted || r[4] !== resultsEnd(fm.posted)) P('posts', `results cover ${r[3]}..${r[4]}, not the ${RESULT_DAYS} days from posted ${fm.posted || '(empty)'}`)
  }
  for (const h of ['HE', 'AR', 'Mixed']) if (ch !== 'site' && !new RegExp(`^## ${h}\\s*$`, 'm').test(text.replace(/\r\n/g, '\n'))) P('posts', `no "## ${h}" caption — every piece is drafted in Hebrew, Arabic and mixed (VOICE.md)`)
  if (RAW_FILE.test(text)) P('posts', 'names a raw file — a piece is built from media IDs (ADR 0069 §2)')
  for (const mid of (fm.media ?? '').replace(/[[\]]/g, '').split(',').map((x) => unquote(x.trim())).filter(Boolean)) {
    const r = RECORD.get(mid), scope = ch === 'site' ? 'site' : 'social'
    if (!r) P('posts', `media id ${mid} has no record`)
    else if (!covers(r, scope)) P('consent', `${mid} shows recognisable ${r.people}; consent "${r.consent}" does not cover ${ch}`)
  }
}
// reel briefs and the reels' asset map are built from IDs too (ADR 0069 §2)
for (const rel of filesUnder('video/briefs', /\.md$/).filter((r) => !r.endsWith('/README.md'))) {
  const text = read(rel), m = text.match(RAW_FILE)
  if (m) fail(rel, lineOf(text, m.index), 'briefs', `names a raw file (${m[0].trim()}) — name the media or brand ID (ADR 0069 §2)`)
}
const assetMap = readJson('video/assets.json')?.site ?? {}
if (!Object.keys(assetMap).length) fail('video/assets.json', 1, 'briefs', 'no "site" map — the reels\' asset map names a media or brand ID per file')
// resolved as sync-assets.mjs does: the first rendition in the name's format that is not a sized cut
const extOf = (f) => f.slice(f.lastIndexOf('.'))
for (const [name, id] of Object.entries(assetMap)) {
  const files = RECORD.get(id)?.renditions ?? brandAssets.find((a) => a.id === id)?.served
  if (!files) fail('video/assets.json', 1, 'briefs', `${name}: "${id}" is not a media or brand ID`)
  else if (!files.some((f) => extOf(f) === extOf(name) && !/(\/card|-\d+)\.[a-z0-9]+$/.test(f))) fail('video/assets.json', 1, 'briefs', `${name}: ${id} has no web copy in ${extOf(name)} — sync-assets would stop`)
}
const backlog = read('content/backlog.md')
// every card heading in the Shaped / Archive lists is a card id
for (const m of backlog.matchAll(/^###\s+(.*)$/gm)) if (!ID.card.test(m[1].trim())) fail('content/backlog.md', lineOf(backlog, m.index), 'ids', `card heading "${m[1].trim()}" is not a card id (${ID.card})`)

// one home of sizes: scripts/media.sh reads the presets; the /app/events upload makes its own and must equal them
if (channels?.presets) {
  const api = read('app-src/src/modules/events/api.ts')
  const [big, small] = channels.presets['events-photo']?.long_edge ?? []
  if (!new RegExp(`\\bMAX_EDGE = ${big}\\b`).test(api) || !new RegExp(`\\bTHUMB_EDGE = ${small}\\b`).test(api)) fail('app-src/src/modules/events/api.ts', 1, 'sizes', `MAX_EDGE / THUMB_EDGE are not ${big} / ${small} (the events-photo preset)`)
}

// brand tokens are the source: the site's custom properties and the reels' colours agree with them
const TOKENS = readJson('brand/tokens.json')
if (TOKENS) {
  const css = read('css/styles.css')
  const groups = { color: { ...TOKENS.color.brand, ...TOKENS.color.derived }, space: TOKENS.space, radius: TOKENS.radius }
  for (const m of css.matchAll(/--(color|space|radius)-([a-z0-9-]+):\s*([^;]+);/g)) {
    const want = groups[m[1]]?.[m[2]]
    if (want?.toLowerCase() !== m[3].trim().toLowerCase()) fail('css/styles.css', lineOf(css, m.index), 'tokens', `--${m[1]}-${m[2]} ${m[3].trim()} is not brand/tokens.json's ${m[1]} "${m[2]}" (${want ?? 'missing'})`)
  }
  for (const [g, names] of Object.entries(groups)) for (const n of Object.keys(names ?? {})) {
    if (!(g === 'color' && n === 'track') && !css.includes(`--${g}-${n}:`)) fail('brand/tokens.json', 1, 'tokens', `${g} "${n}" has no --${g}-${n} in css/styles.css`)
  }
  const colours = new Set(Object.values(groups.color).map((v) => v.toLowerCase()))
  // #rgb / #rrggbb / #rrggbbaa are compared on their colour; rgba() overlays (scrims over photos) are not brand colours
  const hex6 = (h) => (h.length <= 5 ? '#' + [...h.slice(1, 4)].map((c) => c + c).join('') : h.slice(0, 7)).toLowerCase()
  for (const rel of filesUnder('video/src', /theme\.ts$/)) scan(rel, /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-fA-F])/g, 'tokens', (m) => colours.has(hex6(m[0])) ? null : `${m[0]} is not a brand/tokens.json colour`)
  const themeColor = home.match(/name="theme-color" content="([^"]+)"/)?.[1]
  if (themeColor && !colours.has(themeColor.toLowerCase())) fail('index.html', 1, 'tokens', `theme-color ${themeColor} is not a brand/tokens.json colour`)
}

if (findings.length) {
  console.error(`check-content: ${findings.length} finding(s)\n` + findings.map((f) => '  ' + f).join('\n'))
  process.exit(1)
}
console.log(`check-content: ok — ${PAGES.length} pages, ${TEMPLATES.length} templates, ${TEXT.length} text files, ${SIZE.size} media files, ${media.length} media records, ${CHANNEL.size} channels`)
