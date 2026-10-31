#!/usr/bin/env node
/**
 * Content freshness — content PR D (docs/plans/content-media-foundation.md §Outcome metric; the
 * freshness numbers of open question 3, set per channel in content/channels.json `freshness`).
 *
 *   node scripts/content-freshness.mjs     writes .reports/freshness.json (FRESHNESS_OUT overrides)
 *
 * Numbers computed from the repo's records only — no credential, no network: the post records'
 * `posted:` dates, content/media.json, content/backlog.md and the story pairs' dates in
 * sitemap.xml (gen-stories-index writes them: `levyam:updated`, else `published`; noindex skipped).
 * The weekly review reads the file (queries §8); mandate item 2's marketing report will carry it.
 * Never fails the job: a record it cannot read is reported in `errors`, and the exit code stays 0.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ROOT, ID, readPosts, addDays, daysBetween, isDate } from './lib/content.mjs'

const OUT = process.env.FRESHNESS_OUT || join(ROOT, '.reports/freshness.json')
const TODAY = new Date().toISOString().slice(0, 10)
const WEEKS = 4          // the outcome metric reads "3 of the first 4 weeks"
const CARD_STALE_DAYS = 56 // a card older than 8 weeks is proposed for the archive (content-week §2)
const errors = {}
const attempt = (name, fn, fallback) => { try { return fn() } catch (e) { errors[name] = String(e.message).slice(0, 200); return fallback } }

const channels = attempt('channels', () => JSON.parse(readFileSync(join(ROOT, 'content/channels.json'), 'utf8')).channels, [])
const posts = attempt('posts', () => readPosts(), [])
const posted = posts.filter((p) => isDate(p.fm.posted) && p.fm.posted <= TODAY)
// the pack's channels: every live one with a pack cadence in channels.json (the site has none)
const packChannels = channels.filter((c) => c.status === 'live' && c.freshness?.pack_days != null)

// ISO weeks, Monday first; the last WEEKS whole weeks before the current one
const monday = (date) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7))
const isoWeek = (start) => {
  const thursday = new Date(`${addDays(start, 3)}T00:00:00Z`)
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return `${thursday.getUTCFullYear()}-W${String(Math.ceil(((thursday - jan1) / 86_400_000 + 1) / 7)).padStart(2, '0')}`
}
const weeks = Array.from({ length: WEEKS }, (_, i) => {
  const start = addDays(monday(TODAY), -7 * (WEEKS - i)), end = addDays(start, 6)
  const on = [...new Set(posted.filter((p) => p.fm.posted >= start && p.fm.posted <= end).map((p) => p.fm.channel))]
  const every = packChannels.length > 0 && packChannels.every((c) => on.includes(c.id))
  return { week: isoWeek(start), start, end, channels_posted: on.sort(), every_channel: every }
})

const perChannel = Object.fromEntries(packChannels.map((c) => {
  const mine = posted.filter((p) => p.fm.channel === c.id).map((p) => p.fm.posted).sort()
  const last = mine.at(-1) ?? null, days = last ? daysBetween(last, TODAY) : null
  const limit = c.freshness.pack_days
  return [c.id, {
    last_posted: last,
    days_since: days,
    pack_days: limit,
    overdue: days === null || days > limit,
    posted_last_28_days: mine.filter((d) => d > addDays(TODAY, -28)).length,
  }]
}))

// drafted, never marked posted — the "posted" step to chase. Named only inside the outcome window,
// counted before it, so the lists stay the size of a month however long the history grows.
const since = weeks[0].start
const unposted = posts.filter((p) => !p.fm.posted)
const recent = (list) => ({ count: list.length, recent: list.filter((p) => p.date >= since).map((p) => p.id) })
const unmarked = recent(unposted.filter((p) => p.date < addDays(TODAY, -7)))
const expiredUnposted = recent(unposted.filter((p) => isDate(p.fm.expires) && p.fm.expires < TODAY))

// media.json `published` is a month; photos per month is the finest the records hold
const media = attempt('media', () => JSON.parse(readFileSync(join(ROOT, 'content/media.json'), 'utf8')).media ?? [], [])
const thisMonth = TODAY.slice(0, 7), lastMonth = addDays(`${thisMonth}-01`, -1).slice(0, 7)
const published = (m) => media.filter((r) => r.published === m && r.kind === 'image').length

// live cards only: the "## Shaped" section, never "## Archive"
const backlog = attempt('backlog', () => readFileSync(join(ROOT, 'content/backlog.md'), 'utf8'), '')
  .split(/^## /m).find((s) => s.startsWith('Shaped')) ?? ''
const cards = [...backlog.matchAll(/^###\s+(\S+)\s*$([\s\S]*?)(?=^###\s|(?![\s\S]))/gm)]
  .filter((m) => ID.card.test(m[1]))
  .map((m) => ({ id: m[1], added: m[2].match(/^- added:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1] ?? null }))

// story facts are re-checked every N days; one date per pair, as the generator writes it into the
// sitemap (the twins share their facts) — hubs and the homepage are not story pages
const recheck = channels.find((c) => c.id === 'site')?.freshness?.story_facts_recheck_days ?? null
const sitemap = attempt('sitemap', () => readFileSync(join(ROOT, 'sitemap.xml'), 'utf8'), '')
const storyPages = [...sitemap.matchAll(/<loc>https:\/\/[^<]*?(\/stories\/(?!ar\/)[a-z0-9-]+\/)<\/loc>\s*<lastmod>(\d{4}-\d{2}-\d{2})<\/lastmod>/g)]
  .map((m) => ({ page: m[1], updated: m[2] }))

const out = {
  generated_at: new Date().toISOString(),
  today: TODAY,
  outcome: {
    channels: packChannels.map((c) => c.id),
    weeks,
    count: weeks.filter((w) => w.every_channel).length,
    of: WEEKS,
  },
  channels: perChannel,
  posts: { drafted: posts.length, posted: posted.length, unmarked_past_a_week: unmarked, expired_unposted: expiredUnposted },
  photos_published: { [thisMonth]: published(thisMonth), [lastMonth]: published(lastMonth) },
  backlog: {
    cards: cards.length,
    older_than_8_weeks: cards.filter((c) => c.added && daysBetween(c.added, TODAY) > CARD_STALE_DAYS).map((c) => c.id),
    undated: cards.filter((c) => !c.added).map((c) => c.id),
  },
  stories: {
    recheck_days: recheck,
    pairs: storyPages.length,
    overdue: recheck === null ? [] : storyPages.filter((p) => daysBetween(p.updated, TODAY) > recheck),
  },
  ...(Object.keys(errors).length && { errors }),
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
const overdue = Object.entries(perChannel).filter(([, c]) => c.overdue).map(([id]) => id)
console.log(`content freshness: outcome ${out.outcome.count} of ${WEEKS} weeks · overdue channels: ${overdue.join(', ') || 'none'} · stories to re-check: ${out.stories.overdue.length}${out.errors ? ` · errors: ${Object.keys(errors).join(', ')}` : ''} → ${OUT}`)
