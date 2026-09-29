/**
 * Chrome stamping — the ONE implementation both site generators share.
 *
 * The header and footer of every /stories/ page, both story hubs, both
 * /happening/ hubs and the landing-page templates sit between
 * <!-- chrome:header --> … <!-- /chrome:header --> (same for footer) and are
 * REWRITTEN from the per-language story page template
 * (stories/_template.html / _template.ar.html) on every generator run
 * (ADR 0049). Inside a region only CHROME_VARS may appear:
 *   {{HE_URL}} / {{AR_URL}}      the language toggle — the twin URL on a page,
 *                                the hub URL on a hub
 *   {{STORIES_CURRENT}}          the nav's aria-current, set on the stories hub
 *   {{HAPPENING_CURRENT}}        the same, set on the happening hub
 * A document missing a required region, or a template region carrying any
 * other placeholder, fails the build — that is the drift this exists to remove.
 *
 * Used by scripts/gen-stories-index.mjs (pages + story hubs, both regions) and
 * scripts/gen-happening.mjs (hubs and landing templates, both regions; a
 * landing template keeps {{HE_URL}} / {{AR_URL}} as literal placeholders,
 * filled per item when the page is rendered).
 */

import { readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The page template each language's chrome is read from. */
const CHROME_TEMPLATES = {
  he: join(ROOT, 'stories', '_template.html'),
  ar: join(ROOT, 'stories', '_template.ar.html'),
}

const CHROME_VARS = ['HE_URL', 'AR_URL', 'STORIES_CURRENT', 'HAPPENING_CURRENT']
const REGIONS = ['header', 'footer']

const REGION_RE = new Map(
  REGIONS.map((name) => [
    name,
    new RegExp(`<!-- chrome:${name} -->[\\s\\S]*?<!-- /chrome:${name} -->`, 'g'),
  ])
)

/** The two chrome regions of one document, by name; exactly one of each or it throws. */
function extractRegions(html, where) {
  const regions = {}
  for (const name of REGIONS) {
    const found = html.match(REGION_RE.get(name))
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

/** The page template's chrome for a language, validated once: only CHROME_VARS may appear inside a region. */
function templateChrome(code) {
  if (chromeCache.has(code)) return chromeCache.get(code)
  const path = CHROME_TEMPLATES[code]
  if (!path) throw new Error(`chrome: no page template for language "${code}".`)
  const name = relative(ROOT, path)
  const regions = extractRegions(readFileSync(path, 'utf8'), name)
  for (const [region, html] of Object.entries(regions)) {
    const leftover = CHROME_VARS.reduce((r, v) => r.replaceAll(`{{${v}}}`, ''), html).match(/{{[^}]*}}/)
    if (leftover) {
      throw new Error(
        `${name} chrome:${region} carries ${leftover[0]} — only ${CHROME_VARS.map((v) => `{{${v}}}`).join(', ')} may appear inside a stamped region.`
      )
    }
  }
  chromeCache.set(code, regions)
  return regions
}

/**
 * The document with both chrome regions replaced by the template's,
 * CHROME_VARS substituted. Every CHROME_VAR must be given (an omitted one
 * would ship as a literal placeholder). Validated first, so the diagnostic
 * names the document, not the template.
 */
export function stampChrome(html, code, vars, where) {
  for (const v of CHROME_VARS) {
    if (typeof vars[v] !== 'string') throw new Error(`stampChrome(${where}): missing chrome var ${v}.`)
  }
  const chrome = templateChrome(code)
  extractRegions(html, where)
  let out = html
  for (const name of REGIONS) {
    // Function replacers throughout, so `$` in chrome or in a value is never interpreted.
    const stamped = CHROME_VARS.reduce((r, v) => r.replaceAll(`{{${v}}}`, () => vars[v]), chrome[name])
    out = out.replace(REGION_RE.get(name), () => stamped)
  }
  return out
}

/** The per-document vars: nothing current unless said so. */
export const chromeVars = (heUrl, arUrl, extra = {}) => ({
  HE_URL: heUrl,
  AR_URL: arUrl,
  STORIES_CURRENT: '',
  HAPPENING_CURRENT: '',
  ...extra,
})
