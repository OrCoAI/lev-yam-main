#!/usr/bin/env node
/**
 * Regenerates sitemap.xml and both /stories/ hubs from the story pages on disk.
 *
 *   node scripts/gen-stories-index.mjs           write the files
 *   node scripts/gen-stories-index.mjs --check   fail if the committed files are stale
 *
 * Why a build step and not a bot that commits: `main` deploys straight to
 * production and the pre-commit gate in CLAUDE.md applies to every commit, so an
 * auto-committing workflow would push un-gated changes to prod (and needs a
 * self-trigger guard). Instead scripts/assemble-site.sh runs this before
 * assembling the site — production is always correct even if the committed copy
 * is stale — and ci.yml runs --check so the drift gets noticed anyway.
 *
 * Inputs
 *   stories/<slug>/index.html        Hebrew page
 *   stories/ar/<slug>/index.html     Arabic page (same slug)
 *   stories/_hub.html, _hub.ar.html  hub templates; the <!--STORY_LIST--> marker
 *                                  is replaced with the rendered list
 *   index.html                     homepage <meta name="levyam:updated">
 *
 * A page is skipped everywhere (sitemap and hub) when it carries
 * <meta name="robots" content="noindex">. That is how stories/dugma/ — the
 * permanent template smoke-test — stays out of production listings. Skipped
 * slugs are logged, so a `noindex` left on by mistake is visible in the build.
 *
 * Underscore-prefixed entries (_template.html, _hub.html, …) are never scanned.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://levyam.com'
const STORIES_DIR = join(ROOT, 'stories')

/** Language dirs reserved in the URL scheme but not built yet (see the plan). */
const RESERVED_LANG_DIRS = ['en']

/** Add a language here and everything below follows — nothing else hardcodes a code. */
const LANGS = [
  {
    code: 'he',
    dir: STORIES_DIR,
    hubPath: 'stories/index.html',
    hubTemplate: '_hub.html',
    urlBase: '/stories/',
    empty: 'בקרוב.',
  },
  {
    code: 'ar',
    dir: join(STORIES_DIR, 'ar'),
    hubPath: 'stories/ar/index.html',
    hubTemplate: '_hub.ar.html',
    urlBase: '/stories/ar/',
    empty: 'قريبًا.',
  },
]

/** hreflang alternates for the hubs — derived, so adding a LANGS row is enough. */
const HUB_ALTERNATES = Object.fromEntries(LANGS.map((l) => [l.code, l.urlBase]))

/* Directories under stories/ that hold a language tree rather than a page —
   derived from LANGS (plus reserved codes) so a new LANGS row can never be
   scanned as a Hebrew slug directory by mistake. */
const LANG_DIRS = new Set([
  ...LANGS.filter((l) => l.dir !== STORIES_DIR).map((l) => basename(l.dir)),
  ...RESERVED_LANG_DIRS,
])

/* The Meta pixel ID's single source is js/vendor-tags.js. Every page also
   re-embeds it in the inline <noscript> fallback (which cannot be extracted),
   so the copies are verified against the source instead of trusted. The scrape
   is soft — a refactor of vendor-tags.js that moves the fbq('init') call must
   not brick the deploy build; only an actual ID MISMATCH is a hard error. */
const PIXEL_ID = (readFileSync(join(ROOT, 'js', 'vendor-tags.js'), 'utf8')
  .match(/fbq\('init',\s*'(\d+)'\)/) || [])[1]
if (!PIXEL_ID) {
  console.warn("gen-stories-index: warning — fbq('init', '<id>') not found in js/vendor-tags.js; skipping <noscript> pixel verification.")
}

const CHECK = process.argv.includes('--check')

/* ── tiny HTML readers ─────────────────────────────────────────────────── */

const stripTags = (s) => s.replace(/<[^>]*>/g, '')

/* Page text arrives HTML-escaped and renderHub escapes again, so this pair nets
   to identity on every current path. Kept deliberately: it normalises a bare `&`
   in a hand-written title into a correctly-escaped one rather than `&amp;amp;`. */
const decodeEntities = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'").replace(/&amp;/g, '&')

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const collapse = (s) => s.replace(/\s+/g, ' ').trim()

/* Attribute-order-tolerant: matches the tag whichever side of `content` the
   name/property lands on, with any other attributes in between — an editor or
   formatter that reorders attributes must not silently defeat extraction. */
function metaAttr(html, attr, key) {
  const re = new RegExp(
    `<meta\\b(?=[^>]*\\s${attr}="${key}")[^>]*\\scontent="([^"]*)"`, 'i'
  )
  const m = html.match(re)
  return m ? decodeEntities(m[1]) : ''
}
const metaContent = (html, name) => metaAttr(html, 'name', name)
/** OpenGraph tags use property=, not name=. */
const metaProperty = (html, prop) => metaAttr(html, 'property', prop)

function canonicalUrl(html) {
  const m = html.match(/<link\b(?=[^>]*\srel="canonical")[^>]*\shref="([^"]*)"/i)
  return m ? m[1] : ''
}

function h1Text(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  return m ? collapse(decodeEntities(stripTags(m[1]))) : ''
}

const isNoindex = (html) =>
  /<meta\b(?=[^>]*\sname="robots")[^>]*\scontent="[^"]*noindex/i.test(html)

/** ISO date → DD.MM.YYYY. Locale-independent, so CI and laptops agree. */
function displayDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

/* ── collect pages ─────────────────────────────────────────────────────── */

const skipped = []

function slugsIn(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !LANG_DIRS.has(e.name))
    .map((e) => e.name)
    .filter((slug) => existsSync(join(dir, slug, 'index.html')))
}

function readPages(lang) {
  const pages = []
  for (const slug of slugsIn(lang.dir)) {
    const html = readFileSync(join(lang.dir, slug, 'index.html'), 'utf8')

    // Checked before the noindex skip so even unlisted pages (dugma) can't
    // carry a drifted pixel ID.
    const noscriptPixel = html.match(/facebook\.com\/tr\?id=(\d+)/)
    if (PIXEL_ID && noscriptPixel && noscriptPixel[1] !== PIXEL_ID) {
      throw new Error(
        `${lang.urlBase}${slug}/ <noscript> pixel ID ${noscriptPixel[1]} != js/vendor-tags.js ${PIXEL_ID}.`
      )
    }

    if (isNoindex(html)) {
      skipped.push(`${lang.urlBase}${slug}/`)
      continue
    }

    const published = metaContent(html, 'levyam:published')
    const title = h1Text(html)
    const description = collapse(metaContent(html, 'description'))
    if (!published || !title || !description) {
      throw new Error(
        `${lang.urlBase}${slug}/ is missing ` +
        (!title ? '<h1>' : !published ? '<meta name="levyam:published">' : '<meta name="description">') +
        ' — all are required for the sitemap and the hub.'
      )
    }

    // The documented authoring flow is "copy dugma and replace every
    // placeholder" — a missed canonical is the one slip that silently
    // de-indexes the page, so it fails the build instead.
    const canonical = canonicalUrl(html)
    if (canonical !== `${ORIGIN}${lang.urlBase}${slug}/`) {
      throw new Error(
        `${lang.urlBase}${slug}/ canonical is ${canonical || 'missing'} — ` +
        `expected ${ORIGIN}${lang.urlBase}${slug}/ (stale copy from another page?).`
      )
    }

    // The hub card's photo IS the page's og:image — one source of truth. Every
    // indexed story must front a real photo (1200×630, /img/stories/<slug>/card.jpg
    // by convention; HE and AR twins share the files). A logo or off-site URL
    // fails the build rather than shipping a broken-looking hub.
    const ogImage = metaProperty(html, 'og:image')
    if (!ogImage.startsWith(`${ORIGIN}/img/`)) {
      throw new Error(
        `${lang.urlBase}${slug}/ og:image must be a photo under ${ORIGIN}/img/ — ` +
        `the hub card reads it (got: ${ogImage || 'none'}).`
      )
    }

    pages.push({
      slug,
      title,
      description,
      published,
      updated: metaContent(html, 'levyam:updated') || published,
      url: `${lang.urlBase}${slug}/`,
      image: ogImage.slice(ORIGIN.length),
    })
  }
  // Newest first; slug breaks ties so the output is stable.
  pages.sort((a, b) => b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug))
  return pages
}

/**
 * docs/ARCHITECTURE.md invariant 5: anything user-facing ships in both languages.
 * For /stories/ that means a page is a twin pair, and this is where the rule is
 * enforced rather than merely documented — a Hebrew page whose Arabic twin is
 * missing (or still `noindex`) fails the build instead of going live half-done.
 */
function assertTwins(byLang) {
  const urlsBySlug = new Map()
  for (const lang of LANGS) {
    for (const p of byLang[lang.code]) {
      if (!urlsBySlug.has(p.slug)) urlsBySlug.set(p.slug, {})
      urlsBySlug.get(p.slug)[lang.code] = p.url
    }
  }

  const broken = []
  for (const [slug, urls] of urlsBySlug) {
    const missing = LANGS.filter((l) => !urls[l.code]).map((l) => l.code)
    if (missing.length) broken.push(`  ${slug} — no ${missing.join(', ')} twin`)
  }
  if (broken.length) {
    throw new Error(
      'Story pages must exist in every language (docs/ARCHITECTURE.md invariant 5):\n' +
      broken.join('\n') +
      '\nAdd the missing twin, or mark the published one `noindex` until it is ready.'
    )
  }

  return urlsBySlug
}

/* ── render ────────────────────────────────────────────────────────────── */

function renderHub(lang, pages) {
  const template = readFileSync(join(STORIES_DIR, lang.hubTemplate), 'utf8')
  const marker = '<!--STORY_LIST-->'
  if (!template.includes(marker)) {
    throw new Error(`${lang.hubTemplate} is missing the ${marker} marker.`)
  }

  // Identical markup for every item — featured-vs-grid is pure CSS on
  // li:first-child; only the image loading strategy differs (the featured card
  // is above the fold, the rest lazy-load). alt="" is deliberate: the card's
  // accessible name is the visible <h2> title; a duplicate alt would be read
  // twice. Everything interpolated is escaped — repo-derived rather than user
  // input, but an unquoted `"` would silently break markup.
  const items = pages.map((p, i) => `        <li>
          <a class="story-card" href="${escapeHtml(p.url)}">
            <div class="story-card-media">
              <img src="${escapeHtml(p.image)}" alt="" width="1200" height="630"
                   decoding="async"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>
            </div>
            <div class="story-card-body">
              <h2 class="story-card-title">${escapeHtml(p.title)}</h2>
              <p class="story-card-desc">${escapeHtml(p.description)}</p>
              <time class="story-card-date" datetime="${escapeHtml(p.published)}">${escapeHtml(displayDate(p.published))}</time>
            </div>
          </a>
        </li>`)

  const body = items.length
    ? items.join('\n')
    : `        <li class="story-grid-empty"><p>${escapeHtml(lang.empty)}</p></li>`

  // The template opens with an "Edit THIS file, never the generated one"
  // banner — true of the template, misleading inside the generated copy. Swap
  // the first comment block for a generated-file banner.
  //
  // Both replacements pass a FUNCTION: with a string, JS interprets $-patterns
  // ($&, $', $`) in it — a story title containing `$&` would splice template
  // text into the hub instead of rendering literally.
  return template
    .replace(
      /<!--[\s\S]*?-->/,
      () => `<!--\n  GENERATED by scripts/gen-stories-index.mjs from stories/${lang.hubTemplate}.\n  Do not edit by hand — edit the template and re-run the generator.\n-->`
    )
    .replace(
      marker,
      () => `        <!-- GENERATED by scripts/gen-stories-index.mjs — edit ${lang.hubTemplate}, not this file. -->\n${body}`
    )
}

/** <xhtml:link> alternates for one URL cluster, plus x-default → Hebrew. */
function alternateLinks(urls) {
  const links = Object.entries(urls).map(
    ([code, href]) =>
      `\n    <xhtml:link rel="alternate" hreflang="${code}" href="${ORIGIN}${escapeHtml(href)}"/>`
  )
  links.push(
    `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${escapeHtml(urls.he)}"/>`
  )
  return links.join('')
}

function renderSitemap(byLang, urlsBySlug) {
  const homeUpdated =
    metaContent(readFileSync(join(ROOT, 'index.html'), 'utf8'), 'levyam:updated')
  if (!homeUpdated) {
    throw new Error('index.html is missing <meta name="levyam:updated"> — needed for the sitemap.')
  }

  // The homepage serves both languages from one URL, so it has no alternates.
  const entries = [{ loc: '/', lastmod: homeUpdated, alternates: null }]

  for (const lang of LANGS) {
    // A hub changes when one of its pages does, so its lastmod is the most
    // recent *revision* — not [0].updated, which is the newest *publication*
    // and would miss an older page edited yesterday. homeUpdated is only a
    // fallback for an empty hub; seeding the reduce with it would make it a
    // floor and mask every page date behind it.
    const pages = byLang[lang.code]
    const lastmod = pages.length
      ? pages.reduce((latest, p) => (p.updated > latest ? p.updated : latest), pages[0].updated)
      : homeUpdated
    entries.push({ loc: lang.urlBase, lastmod, alternates: HUB_ALTERNATES })
  }

  // Twins are guaranteed by assertTwins, so every page emits the full set.
  for (const lang of LANGS) {
    for (const p of byLang[lang.code]) {
      entries.push({ loc: p.url, lastmod: p.updated, alternates: urlsBySlug.get(p.slug) })
    }
  }

  const urls = entries.map((e) => `  <url>
    <loc>${ORIGIN}${escapeHtml(e.loc)}</loc>
    <lastmod>${escapeHtml(e.lastmod)}</lastmod>${e.alternates ? alternateLinks(e.alternates) : ''}
  </url>`)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by scripts/gen-stories-index.mjs — do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
}

/* ── run ───────────────────────────────────────────────────────────────── */

const byLang = Object.fromEntries(LANGS.map((lang) => [lang.code, readPages(lang)]))
const urlsBySlug = assertTwins(byLang)

const outputs = [
  ...LANGS.map((lang) => ({ path: lang.hubPath, content: renderHub(lang, byLang[lang.code]) })),
  { path: 'sitemap.xml', content: renderSitemap(byLang, urlsBySlug) },
]

const stale = []
for (const out of outputs) {
  const abs = join(ROOT, out.path)
  const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null
  if (current === out.content) continue
  if (CHECK) stale.push(out.path)
  else writeFileSync(abs, out.content)
}

if (CHECK && stale.length) {
  console.error(
    `gen-stories-index: ${stale.join(', ')} out of date.\n` +
    'Run `node scripts/gen-stories-index.mjs` and commit the result.'
  )
  process.exit(1)
}

const counts = LANGS.map((l) => `${byLang[l.code].length} ${l.code}`).join(', ')
console.log(`gen-stories-index: ${CHECK ? 'up to date' : 'wrote sitemap + hubs'} (${counts})`)
if (skipped.length) console.log(`gen-stories-index: skipped noindex — ${skipped.join(', ')}`)
