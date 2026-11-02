#!/usr/bin/env node
/**
 * Per-post results — content PR D (docs/plans/content-media-foundation.md; content/README.md §A post record).
 *
 *   node scripts/post-results.mjs <post-days.json>           print what each posted record would get
 *   node scripts/post-results.mjs <post-days.json> --write   and write the `results:` lines
 *
 * <post-days.json> is the `post-days` artifact of the newest scheduled weekly-review run on main
 * (scripts/analytics-snapshot.mjs writes it). For every record with `posted:`, a link and an empty
 * `results:`, the totals over its first RESULT_DAYS days are written — only when the snapshot asked
 * GA4 about that post and covers all of its days with a day to spare (GA4's newest day can still be
 * filling in, and a `results:` line is written once). Otherwise the record waits; one older than the
 * window stays empty. Nothing is written when GA4 failed or thresholded. Never an estimate.
 *
 * The file is downloaded, so it is checked whole before anything is used, and nothing in it is
 * printed: its numbers become integers in a fixed line, and no path or key comes from it.
 */

import { readFileSync, writeFileSync, lstatSync } from 'node:fs'
import { readPosts, addDays, resultsEnd, resultsLine, setFront, isDate, ID } from './lib/content.mjs'

const [file, flag] = process.argv.slice(2)
if (!file || (flag && flag !== '--write')) {
  console.error('usage: node scripts/post-results.mjs <post-days.json> [--write]')
  process.exit(2)
}
const refuse = (why) => { console.error(`post-results: refused — ${why}; no record changed`); process.exit(1) }
const stop = (why) => { console.log(`post-results: n/a — ${why}; no record changed`); process.exit(0) }

let by
try { by = JSON.parse(readFileSync(file, 'utf8')) } catch { refuse(`${file} is not readable JSON`) }
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isCount = (v) => Number.isSafeInteger(v) && v >= 0
if (!isObj(by) || !isObj(by.window) || !isDate(by.window.start) || !isDate(by.window.end)) refuse('no valid window')
if (by.error !== undefined) stop('GA4 failed in that run (its log says why)')
if (by.thresholded) stop('GA4 thresholded the per-post numbers (they would be a floor)')
if (!Array.isArray(by.asked) || !by.asked.every((id) => typeof id === 'string' && ID.post.test(id))) refuse('no valid "asked" list')
if (!isObj(by.posts) || !Object.entries(by.posts).every(([id, days]) => ID.post.test(id) && isObj(days) &&
  Object.entries(days).every(([d, v]) => isDate(d) && isObj(v) && isCount(v.sessions) && isCount(v.whatsapp_click)))) refuse('malformed per-post rows')

const asked = new Set(by.asked)
let written = 0, tooOld = 0
for (const p of readPosts()) {
  const { posted, results, utm } = p.fm
  if (!posted || results) continue
  if (!isDate(posted)) { console.log(`${p.id}: posted "${posted}" is not a date — skipped`); continue }
  if (!utm) { console.log(`${p.id}: no link — nothing to measure, results stay empty`); continue }
  const last = resultsEnd(posted)
  if (posted < by.window.start) { tooOld++; continue }
  if (last >= by.window.end) { console.log(`${p.id}: waits — needs data through ${addDays(last, 1)}, the snapshot ends ${by.window.end}`); continue }
  if (!asked.has(p.id)) { console.log(`${p.id}: waits — not in this snapshot's request (recorded after it ran)`); continue }
  const days = by.posts[p.id] ?? {}
  let sessions = 0, clicks = 0
  for (let d = posted; d <= last; d = addDays(d, 1)) {
    sessions += days[d]?.sessions ?? 0
    clicks += days[d]?.whatsapp_click ?? 0
  }
  const line = resultsLine(sessions, clicks, posted)
  console.log(`${p.id}: ${line}`)
  if (flag === '--write') {
    const text = setFront(p.text, 'results', line)
    if (text === null) { console.log(`${p.id}: no "results:" line in the front matter — not written`); continue }
    if (!lstatSync(p.file).isFile()) { console.log(`${p.id}: not a regular file — not written`); continue }
    writeFileSync(p.file, text)
    written++
  }
}
if (tooOld) console.log(`post-results: ${tooOld} posted record(s) older than the snapshot (${by.window.start}) stay empty`)
console.log(`post-results: ${flag === '--write' ? `${written} written` : 'dry run'} (snapshot ${by.window.start}..${by.window.end})`)
