/**
 * The content records' shared grammar — one definition for the check (scripts/check-content.mjs),
 * the freshness numbers (scripts/content-freshness.mjs), the per-post results
 * (scripts/post-results.mjs) and the analytics snapshot's allow-list (scripts/analytics-snapshot.mjs).
 * The model is content/README.md; nothing live reads any of it (ADR 0069 §5).
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './chrome.mjs'

export { ROOT }

export const ID = {
  media: /^\d{4}-\d{2}-[a-z][a-z0-9-]*-\d{2}$/,
  post: /^\d{4}-\d{2}-\d{2}-([a-z]+)-[a-z0-9-]+$/,   // the middle part is a channel id from channels.json
  brand: /^brand-[a-z]+-[a-z0-9-]+$/,
  card: /^card-[a-z0-9-]+$/,
}

export const THEMES = ['companies', 'private', 'renters', 'weekend']   // ADR 0070

export const DATE = /^\d{4}-\d{2}-\d{2}$/

// ── dates: `YYYY-MM-DD` strings, UTC midnight ────────────────────────────────
const DAY_MS = 86_400_000
const ms = (date) => Date.parse(`${date}T00:00:00Z`)
export const addDays = (date, n) => new Date(ms(date) + n * DAY_MS).toISOString().slice(0, 10)
export const daysBetween = (from, to) => Math.round((ms(to) - ms(from)) / DAY_MS)
/** A real calendar date — `2026-13-01` and `2026-02-30` are not (DATE alone lets them through). */
export const isDate = (d) => typeof d === 'string' && DATE.test(d) && !Number.isNaN(ms(d)) && addDays(d, 0) === d

// ── results: a post's first RESULT_DAYS days from `posted`, totals only ──────
export const RESULT_DAYS = 7
export const RESULTS = /^sessions (\d+) · whatsapp_click (\d+) · (\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/
export const resultsEnd = (posted) => addDays(posted, RESULT_DAYS - 1)
export const resultsLine = (sessions, clicks, posted) => `sessions ${sessions} · whatsapp_click ${clicks} · ${posted}..${resultsEnd(posted)}`

// ── front matter: a small YAML subset — `key: value`, a trailing # comment, quotes stripped,
// false / no / null = empty ───────────────────────────────────────────────────
const FRONT = /^(---\r?\n)([\s\S]*?)(\r?\n---)/
export const unquote = (v) => v.replace(/^(["'])(.*)\1$/, '$2')
export const front = (text) => Object.fromEntries((text.match(FRONT)?.[2] ?? '').split(/\r?\n/)
  .map((l) => l.replace(/\s+#.*$/, '').match(/^([a-z_]+):\s*(.*)$/)).filter(Boolean)
  .map((m) => [m[1], /^(false|no|null|~)$/i.test(m[2].trim()) ? '' : unquote(m[2].trim())]))
/** `text` with front-matter `key:` set to `value`, or null when the front matter has no such line. */
export const setFront = (text, key, value) => {
  if (!/^[a-z_]+$/.test(key) || /[\r\n]/.test(value)) throw new Error(`setFront: refused key "${key}" or a multi-line value`)
  const m = text.match(FRONT)
  if (!m) return null
  const line = new RegExp(`^${key}:[^\\r\\n]*$`, 'm')
  if (!line.test(m[2])) return null
  return m[1] + m[2].replace(line, () => `${key}: ${value}`) + m[3] + text.slice(m[0].length)
}

// ── post records ─────────────────────────────────────────────────────────────
/** The post IDs in content/posts/ — names only, nothing read. */
export const postIds = (root = ROOT) =>
  readdirSync(join(root, 'content/posts')).filter((f) => f.endsWith('.md') && ID.post.test(f.slice(0, -3))).map((f) => f.slice(0, -3)).sort()
/** Every post record: { id, date (from the ID), file, text, fm }. */
export const readPosts = (root = ROOT) => postIds(root).map((id) => {
  const file = join(root, 'content/posts', `${id}.md`), text = readFileSync(file, 'utf8')
  return { id, date: id.slice(0, 10), file, text, fm: front(text) }
})
