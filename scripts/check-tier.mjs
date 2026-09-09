#!/usr/bin/env node
/**
 * Risk-tier declaration check (work order G1, ADR 0015).
 *
 *   node scripts/check-tier.mjs --base <ref>            # declaration from $PR_BODY (CI)
 *   node scripts/check-tier.mjs --base main --tier B    # local dry run with an explicit declaration
 *   node scripts/check-tier.mjs --base main --explain   # print the tier every changed path maps to (never fails on a missing declaration)
 *
 * Every PR declares "**Tier:** A|B|C — why" in its description (the PR template's first line).
 * This script derives the tier the *changed paths* require and fails when the declaration is
 * lower. Declaring higher is always fine — the check is a floor, not a classifier. The DB, RLS
 * and CI stay the real guards; this catches a Tier-C label on a schema diff.
 *
 * THIS FILE IS THE RULE SET. CLAUDE.md "Risk tiers" is the human summary and points here.
 *
 * Rule order matters — first match wins:
 *   1. the LEASH (ADR 0036): files that define what agents may do and how work is gated — always A,
 *      listed before every exception so no pattern can demote them;
 *   2. EXCEPTIONS: named, known-safe files inside otherwise-A directories;
 *   3. A at directory level (fail-closed: a new auth/money/deploy file is A until someone lists it);
 *   4. C: docs, assets, generated files, content pages, dependabot bumps.
 * Anything unmatched is B — a change to a live surface.
 */

import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RANK = { A: 3, B: 2, C: 1 }

const RULES = [
  // ── 1. the leash ─────────────────────────────────────────────────────────────
  ['A', /^(\.claude\/|\.mcp\.json$|\.gitignore$|AGENTS\.md$|(.*\/)?CLAUDE\.md$)/],   // instructions, permissions, publication allowlist
  ['A', /^(scripts\/check-tier\.mjs$|scripts\/verify\/|\.github\/pull_request_template\.md$)/], // the gate's own tooling
  // ── 2. exceptions inside A directories ─────────────────────────────────────
  ['C', /^app-src\/src\/.*\.test\.tsx?$/],                                        // vitest (Step 3)
  ['C', /^app-src\/src\/modules\/[a-z]+\/i18n\.ts$/],                              // module dictionaries (lib/i18n.tsx is the runtime → A)
  ['B', /^app-src\/src\/lib\/(useMediaQuery|useRowDisclosure)\.ts$/],
  ['B', /^app-src\/src\/shell\/(Launcher|Layout|ErrorBoundary|PreviewBanner)\.tsx$/],
  ['B', /^app-src\/src\/modules\/finance\/format\.ts$/],
  ['B', /^app-src\/src\/modules\/pos\/(ChefView\.tsx|ComboPicker\.tsx|widgets\.tsx|styles\.ts|menu\.ts|menuData\.ts|pay-qr\.jpg)$/],
  ['B', /^app-src\/src\/modules\/quotes\/(Calendar\.tsx|ChecklistModal\.tsx|NewQuoteModal\.tsx|format\.ts|defaults\.ts|.*\.css)$/],
  // ── 3. Tier A: schema/RLS/functions, auth + identity admin, money spine, delivery pipeline ──
  ['A', /^supabase\//],
  ['A', /^\.github\/workflows\//],
  ['A', /^scripts\/.*\.sh$/],                                                     // assemble/build/audit — the deploy path
  ['A', /^js\/(vendor-tags|wa-track)\.js$/],                                      // analytics / RUM wiring (three vendors)
  ['A', /^app-src\/src\/(lib|shell)\//],                                          // auth, passkeys, permissions, client, i18n runtime
  ['A', /^app-src\/src\/modules\/(finance|pos|quotes|users)\//],                  // money spine, payments, signing, identity admin
  // ── 4. Tier C ────────────────────────────────────────────────────────────────
  ['C', /^docs\//],
  ['C', /^README\.md$/],
  ['C', /^tests\//],
  ['C', /^(img|fonts)\//],
  ['C', /^stories\/(ar\/)?([a-z0-9-]+\/)?index\.html$/],                         // content pages + generated hubs (twin rule: generator)
  ['C', /^sitemap\.xml$/],
  ['C', /^\.github\/dependabot\.yml$/],
  // ── everything else (index.html, js/, css/, FACTS.md, llms.txt, robots.txt, templates, scripts/*.mjs) is B ──
]
/** Dependabot's npm bumps are C; a human editing package.json (build scripts, hooks, new deps) is B. */
const DEPENDABOT_PATHS = /^app-src\/package(-lock)?\.json$/

const tierFor = (path, dependabot) =>
  (dependabot && DEPENDABOT_PATHS.test(path)) ? 'C' : (RULES.find(([, re]) => re.test(path))?.[0] ?? 'B')

/** The PR template's tier line: "**Tier:** A — justification" (leading whitespace and "**Tier**:" tolerated).
 *  Line-anchored so prose mentioning "tier" elsewhere in the body can never be the declaration. */
const parseDeclaredTier = (body) => /^\s*\*\*Tier:?\*\*:?\s*([ABC])\b/im.exec(body)?.[1].toUpperCase() ?? null
const PLACEHOLDER = /^\s*\*\*Tier:?\*\*:?\s*<A\|B\|C>/im

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const fail = (msg) => { console.error(`check-tier: ${msg}`); process.exit(1) }
const flag = (name) => {
  const i = args.indexOf(name); if (i === -1) return null
  const v = args[i + 1]; if (v == null || v.startsWith('--')) fail(`${name} needs a value`)
  return v
}
const git = (...a) => {
  try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch (e) { fail(`git ${a[0]} failed: ${String(e.stderr ?? e.message).trim()}`) }
}

const explain = args.includes('--explain')
const base = flag('--base') ?? 'origin/main'
const tierFlag = flag('--tier')?.toUpperCase()
if (tierFlag && !RANK[tierFlag]) fail(`--tier must be A, B or C (got "${tierFlag}")`)
const body = process.env.PR_BODY ?? ''
const dependabot = process.env.PR_ACTOR === 'dependabot[bot]'
// Dependabot cannot fill the template; its bumps are Tier C by path, so C is its declaration.
const declared = tierFlag ?? parseDeclaredTier(body) ?? (dependabot ? 'C' : null)

try { execFileSync('git', ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], { cwd: ROOT, stdio: 'ignore' }) } catch { fail(`base ref "${base}" does not resolve to a commit (fetch it, or pass --base <ref>)`) }
// Shallow CI clone (fetch-depth 2, base = HEAD^1) has no merge base beyond the parent; two-dot is exact there.
let from = base
try { from = execFileSync('git', ['merge-base', base, 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { /* shallow */ }
const files = git('diff', '--name-only', from, 'HEAD').split('\n').filter(Boolean)
if (files.length === 0) { console.log('check-tier: no changed files against base — nothing to check'); process.exit(0) }

const mapped = files.map((f) => [f, tierFor(f, dependabot)])
const required = mapped.reduce((acc, [, t]) => (RANK[t] > RANK[acc] ? t : acc), 'C')
const under = declared != null && RANK[declared] < RANK[required]
if (explain || under || !declared) for (const [f, t] of mapped) console.log(`  ${t}  ${f}`)
console.log(`check-tier: required by paths: ${required}   declared: ${declared ?? '(none)'}`)

if (under) fail(`declared Tier ${declared} but the changed paths require Tier ${required}. Re-declare (higher is always allowed) — the tier drives which human checkpoints apply.`)
if (explain && !declared) process.exit(0)
if (PLACEHOLDER.test(body)) fail('the PR template placeholder "<A|B|C>" is still in the description — replace it with the tier and a one-line justification.')
if (!declared) fail('no tier declared. The PR description needs a line "**Tier:** A|B|C — justification" (see .github/pull_request_template.md).')
console.log(`check-tier: Tier ${declared} covers the changed paths`)
