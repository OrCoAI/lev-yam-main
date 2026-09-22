#!/usr/bin/env node
/**
 * Regenerates sitemap.xml, both /stories/ hubs and the shared chrome of every story
 * page from the story pages on disk.
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
 *
 * Chrome stamping (docs/plans/stories-authoring-tool.md, ADR 0049): the header and
 * footer of every story page AND of both hub templates sit between
 * <!-- chrome:header --> … <!-- /chrome:header --> (same for footer) and are
 * REWRITTEN from the per-language page template on every run. Inside a region
 * only CHROME_VARS may appear: {{HE_URL}} / {{AR_URL}} (the language toggle —
 * the twin URL on a page, the hub URL on a hub) and {{STORIES_CURRENT}} (the
 * nav's aria-current, set on the hub only). Rewrite rather than verify-only so
 * a nav or footer change is one template edit per language; the CTA band and
 * WhatsApp float carry per-page text, so they are deliberately outside every
 * region. Applies to noindex pages too (dugma is the smoke test). A page
 * missing a region, or a template region carrying any other placeholder, fails
 * the build — that is the drift this exists to remove.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
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
    pageTemplate: '_template.html',
    urlBase: '/stories/',
    empty: 'בקרוב.',
  },
  {
    code: 'ar',
    dir: join(STORIES_DIR, 'ar'),
    hubPath: 'stories/ar/index.html',
    hubTemplate: '_hub.ar.html',
    pageTemplate: '_template.ar.html',
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
const pageOutputs = []

function slugsIn(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !LANG_DIRS.has(e.name))
    .map((e) => e.name)
    .filter((slug) => existsSync(join(dir, slug, 'index.html')))
    .map((slug) => {
      if (!SLUG_RE.test(slug)) throw new Error(`${relative(ROOT, dir)}/${slug}/ — slugs must be english kebab-case.`)
      return slug
    })
}

/* ── chrome stamping ───────────────────────────────────────────────────── */

const CHROME_VARS = ['HE_URL', 'AR_URL', 'STORIES_CURRENT']
const REGION_RE = new Map(
  ['header', 'footer'].map((name) => [
    name,
    new RegExp(`<!-- chrome:${name} -->[\\s\\S]*?<!-- /chrome:${name} -->`, 'g'),
  ])
)

/** Every chrome region of one document, by name; exactly one of each or it throws. */
function extractRegions(html, where) {
  const regions = {}
  for (const [name, re] of REGION_RE) {
    const found = html.match(re)
    if (!found || found.length !== 1) {
      throw new Error(
        `${where} must contain exactly one <!-- chrome:${name} --> … <!-- /chrome:${name} --> region (found ${found ? found.length : 0}).`
      )
    }
    regions[name] = found[0]
  }
  return regions
}

const chromeCache = new Map()

/** The page template's chrome, validated once per language: only CHROME_VARS may appear inside a region. */
function templateChrome(lang) {
  if (chromeCache.has(lang.code)) return chromeCache.get(lang.code)
  const regions = extractRegions(readFileSync(join(STORIES_DIR, lang.pageTemplate), 'utf8'), lang.pageTemplate)
  for (const [name, region] of Object.entries(regions)) {
    const leftover = CHROME_VARS.reduce((r, v) => r.replaceAll(`{{${v}}}`, ''), region).match(/{{[^}]*}}/)
    if (leftover) {
      throw new Error(
        `${lang.pageTemplate} chrome:${name} carries ${leftover[0]} — only ${CHROME_VARS.map((v) => `{{${v}}}`).join(', ')} may appear inside a stamped region.`
      )
    }
  }
  chromeCache.set(lang.code, regions)
  return regions
}

/** The document with every chrome region replaced by the template's, CHROME_VARS substituted (validated first, so the diagnostic names the document). */
function stampChrome(html, lang, vars, where) {
  const chrome = templateChrome(lang)
  extractRegions(html, where)
  let out = html
  for (const [name, re] of REGION_RE) {
    // Function replacers throughout, so `$` in chrome or in a value is never interpreted.
    const stamped = CHROME_VARS.reduce((r, v) => r.replaceAll(`{{${v}}}`, () => vars[v]), chrome[name])
    out = out.replace(re, () => stamped)
  }
  return out
}

const pageVars = (slug) => ({ HE_URL: `/stories/${slug}/`, AR_URL: `/stories/ar/${slug}/`, STORIES_CURRENT: '' })
const HUB_VARS = { HE_URL: '/stories/', AR_URL: '/stories/ar/', STORIES_CURRENT: ' aria-current="page"' }

/** Slugs are English kebab-case (shared by both twins, and substituted into URLs). scripts/story-images.sh enforces the same rule. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

function readPages(lang) {
  const pages = []
  for (const slug of slugsIn(lang.dir)) {
    const pagePath = join(lang.dir, slug, 'index.html')
    const where = `${lang.urlBase}${slug}/`
    const html = stampChrome(readFileSync(pagePath, 'utf8'), lang, pageVars(slug), where)
    // Every page is an output like the hubs: written when its chrome drifted, stale under --check.
    pageOutputs.push({ path: relative(ROOT, pagePath), content: html })

    // Both checks look at what renders: the template ships optional blocks
    // commented out (a video figure with its own placeholders and poster path).
    const rendered = html.replace(/<!--[\s\S]*?-->/g, '')

    // A template placeholder left anywhere in a page ships as literal text.
    const placeholder = rendered.match(/{{[^}]*}}/)
    if (placeholder) throw new Error(`${where} still carries the placeholder ${placeholder[0]}.`)

    // Every image the page references (og:image, hero src/srcset, the gallery
    // figure, video poster, the logo) must exist on disk — img/ is in the tree
    // when this runs. Case-sensitive: macOS hides a case typo, Pages does not.
    for (const ref of new Set(rendered.match(/\/img\/[A-Za-z0-9_/-]+\.[A-Za-z0-9]+/g) || [])) {
      if (!existsSync(join(ROOT, ref))) throw new Error(`${where} references ${ref}, which does not exist.`)
    }

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
    // indexed story fronts /img/stories/<slug>/card.jpg (1200×630, written by
    // scripts/story-images.sh; HE and AR twins share the files). A logo or any
    // other path fails the build rather than shipping a broken-looking hub.
    const ogImage = metaProperty(html, 'og:image')
    if (ogImage !== `${ORIGIN}/img/stories/${slug}/card.jpg`) {
      throw new Error(
        `${lang.urlBase}${slug}/ og:image must be ${ORIGIN}/img/stories/${slug}/card.jpg — ` +
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
  const template = stampChrome(
    readFileSync(join(STORIES_DIR, lang.hubTemplate), 'utf8'), lang, HUB_VARS, lang.hubTemplate
  )
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
  ...pageOutputs,
  ...LANGS.map((lang) => ({ path: lang.hubPath, content: renderHub(lang, byLang[lang.code]) })),
  { path: 'sitemap.xml', content: renderSitemap(byLang, urlsBySlug) },
]

const changed = []
for (const out of outputs) {
  const abs = join(ROOT, out.path)
  const current = existsSync(abs) ? readFileSync(abs, 'utf8') : null
  if (current === out.content) continue
  changed.push(out.path)
  if (!CHECK) writeFileSync(abs, out.content)
}

if (CHECK && changed.length) {
  console.error(
    `gen-stories-index: ${changed.join(', ')} out of date.\n` +
    'Run `node scripts/gen-stories-index.mjs` and commit the result.'
  )
  process.exit(1)
}

const counts = LANGS.map((l) => `${byLang[l.code].length} ${l.code}`).join(', ')
console.log(
  `gen-stories-index: ${changed.length ? `wrote ${changed.join(', ')}` : 'up to date'} (${counts})`
)
if (skipped.length) console.log(`gen-stories-index: skipped noindex — ${skipped.join(', ')}`)
