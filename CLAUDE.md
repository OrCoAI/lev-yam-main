# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. Rules live here; the reasoning
behind every dated rule lives in [docs/decisions/](docs/decisions/) (ADRs) — link, don't repeat.

## What this is

**לב ים / Lev Yam** — a social-business venue in the Jisr az-Zarqa fishing village. Two things
deploy together to **levyam.com** via **GitHub Pages**:

1. A **static marketing site** + standalone tools (no build step, no npm) — the original site.
2. A **modular internal platform** under `/app` — Vite + React + TypeScript behind a login,
   with a role→module→action permission system. New internal modules go here.

| Surface | Path | Purpose | Build | Backend |
|---|---|---|---|---|
| Marketing | `index.html`, `stories/` | Public marketing, booking, content (HE/AR) | none | none |
| Survey | `survey-june.html` | Community survey | none | Supabase |
| POS | `pos.html` → `/app/pos` | Internal POS (cut over 2026-07-15; redirect only) | none | Supabase |
| **Platform** | `/app` → `app-src/` | Internal staff platform (login + modules) | Vite + React + TS | Supabase |

The quotes manager already migrated (`/app/quotes`); its old local app is archived read-only —
**never copy customer data or the owner's signature into this public repo.**

**Where this is going:** [docs/VISION.md](docs/VISION.md) (direction), [docs/ROADMAP.md](docs/ROADMAP.md)
(the single task tracker — read it at session start, update it at session end),
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (security model, RBAC, the invariants that never break),
[docs/decisions/](docs/decisions/) (why each rule exists). Current work: the **Operating system**
block of the roadmap, driven by [docs/plans/master-execution-plan.md](docs/plans/master-execution-plan.md).

## Conventions & gotchas

### Marketing site (`index.html`, `survey-june.html`)
- **No build tooling.** Edit HTML/CSS/JS directly; test with `python3 -m http.server 8080`.
- **Bilingual (HE default + Levantine Arabic, RTL).** Dictionary in `js/app.js`; every copy change
  updates **both** languages and the `data-i18n` keys. Fonts are self-hosted woff2 subsets in
  `fonts/` — no font CDN calls.
- **Analytics — three vendors, deliberately unequal scopes.** A WhatsApp CTA click fans out through
  `js/wa-track.js` (`LevYamTrack.whatsappClick`) to Dynatrace `levyam.whatsapp_cta`, Meta Pixel
  `Contact`, and GA4 `whatsapp_click` (with `page_slug` from `<body data-page-slug>`). Everything
  else (service interest, contact intent, FAQ opens, language switch) is homepage-only and goes to
  **Dynatrace alone**. GA4 is `G-VWL45MKK76`, Enhanced Measurement ON; `whatsapp_click` is the one
  hand-written GA4 event — adding another is a deliberate decision, not a default
  ([ADR 0006](docs/decisions/0006-ga4-carries-whatsapp-click-tier-separation-console-side.md)). **Staging is excluded from GA
  console-side** (hostname filter), never by a hostname guard in the snippet (same ADR).
- **Contact details** stay consistent everywhere: WhatsApp `972506669138`, email `info@levyam.com`.

### Stories section (`stories/`, served at `/stories/`)
Answer-first content pages, one per query cluster — plan: [docs/plans/content-engine-phase0.md](docs/plans/content-engine-phase0.md).
- **A page is a pair:** `stories/<slug>/index.html` (HE) **and** `stories/ar/<slug>/index.html` (AR),
  same slug, reciprocal `hreflang`; neither ships alone (invariant 5,
  [ADR 0007](docs/decisions/0007-story-page-ships-only-with-arabic-twin.md)). Copy `stories/_template.html` /
  `_template.ar.html`; underscore-prefixed files are never served.
- **`FACTS.md` (served as `/facts.txt`) is the only fact source.** Anything else → `[חסר: ...]` /
  `[مفقود: ...]`. **No prices anywhere in the repo** — inquiry by WhatsApp only.
- **Story pages load `js/stories.js`, never `js/app.js`** (one URL per language vs. client-side swap;
  `app.js` would overwrite their SEO metadata). Asset paths are root-absolute.
- **`sitemap.xml`, both hubs and every page's chrome are generated:** `node scripts/gen-stories-index.mjs`
  (edit `stories/_hub*.html`, never `stories/index.html`). It also **stamps** the
  `chrome:header` / `chrome:footer` regions of every story page and both hubs from
  `_template*.html` — a nav or footer change is one template edit per language
  ([ADR 0049](docs/decisions/0049-story-chrome-is-generated-and-a-pair-merges-complete.md)). CI runs
  `--check`; the generator enforces the twin rule, refuses leftover placeholders and missing
  story images, and skips `noindex` pages.
- **Writing a page = the `story-author` skill** (brief → HE + AR pair, gap list, images via
  `scripts/story-images.sh` from the gitignored `media/` intake). No page goes to PR with a
  `[חסר]` marker; the Arabic needs a native reader's sign-off before merge.

### Platform (`app-src/`, served at `/app`)
- **Stack:** Vite + React + TypeScript + react-router. Dev needs **Node 22** and the **local Supabase
  stack** (Colima): `supabase start && supabase db reset`, then `cd app-src && npm run dev`
  (`localhost:5173/app`; seed logins in `supabase/seed.sql`). Before pushing: `npm run lint` (oxlint, warning count
  ratcheted — ADR 0037), `npm test` (money-math unit tests), `npm run build` (typecheck + build).
  Local dev never touches prod ([ADR 0004](docs/decisions/0004-staging-is-a-permanent-second-supabase-project.md)).
- **Vite `base` is `/app/`** and the router `basename` is `/app` — keep them in sync.
- **Permissions are role → module → action, enforced in the DB** via RLS calling
  `core.has_permission('<module>.<action>')`; the UI mirror (`lib/permissions.ts`,
  `RequirePermission`, `useCan`) is convenience only. Never rely on UI gating alone.
- **One Supabase client** (`lib/supabase.ts`); `supabase.schema('<module>')` per module.
- **A new module** = schema + RLS in `supabase/schema/`, rows in `core.modules` / `core.permissions` /
  `core.role_permissions`, a folder in `src/modules/`, a route, a launcher tile — checklist and
  gotchas in [docs/MODULE-TEMPLATE.md](docs/MODULE-TEMPLATE.md); keep it updated.
- **Bilingual & mobile-first are requirements, not polish** ([ADR 0001](docs/decisions/0001-bilingual-and-mobile-first-platform-requirements.md)):
  HE + AR through the shell i18n layer, designed and tested phone-first.

### Both
- **`/app` is internal:** excluded in `robots.txt`, never linked from public pages except the footer
  "Staff login", never in `sitemap.xml`.
- **Browser-side Supabase keys are the anon/publishable keys** — safe to commit. RLS + Auth are the
  guard. **Never** commit a service-role/secret key anywhere; service-role lives only in Edge Functions.
- **Schemas:** `supabase/schema/*.sql` is the source of truth (`00_core.sql` identity & permissions).
  After a change: `node supabase/tests/build-baseline.mjs --write` (CI drift check), then
  `supabase db reset` (local) / `supabase db push` (staging). **Prod is not on the migration pipeline:**
  apply by hand and rely on the grant audit that runs every deploy — never assume committed schema =
  live state ([ADR 0005](docs/decisions/0005-prod-schema-verified-by-live-grant-audit.md)). Full workflow:
  [supabase/README.md](supabase/README.md).
- **Platform telemetry** (edge functions → Bluebox; marketing → Dynatrace): span attributes are an
  allow-list, never PII or error text; telemetry is additive, never load-bearing
  ([ADR 0013](docs/decisions/0013-platform-telemetry-separate-envs-allow-list-additive.md), ARCHITECTURE §6b).

## Decisions

`docs/decisions/` is the log. **Every "actually, let's do X instead" becomes an ADR the same day**
— kickoff records alignment answers that change a rule; close-out records what was decided on the
way. Format and index: [docs/decisions/README.md](docs/decisions/README.md).

## Risk tiers (every PR declares one)

Review depth follows risk, not habit ([ADR 0015](docs/decisions/0015-risk-tiers-abc.md)). **Every PR
description carries a line `**Tier:** A|B|C — one-line justification`**; `tier.yml` (pull requests
only) runs `scripts/check-tier.mjs`, **the rule set**: it derives the tier the changed paths require and
fails a declaration below it — declaring higher is always allowed (`--explain` previews the mapping).
Tiers decide **human checkpoints only**; gate effort follows the diff class (ADR 0003: docs-only runs
inline whatever its tier), and kickoff alignment follows initiative-vs-bugfix, not tier.

| Tier | What (the script is authoritative; this is the summary) | Human checkpoints |
|---|---|---|
| **A** | `supabase/`, `.github/workflows/`, `scripts/*.sh`, analytics/RUM wiring (`js/vendor-tags.js`, `js/wa-track.js`), the platform `lib/`+`shell/` and the finance/pos/quotes/users modules (named UI-only files excepted), and **the leash** — `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.gitignore`, the tier script and the verify harness ([ADR 0036](docs/decisions/0036-agent-instruction-files-are-the-leash.md)) | localhost UI confirmation + staging sign-off where the diff has a deployed surface; otherwise the owner reviews the PR before merge |
| **B** | Everything unlisted: module UI files named as exceptions, `index.html`/`js/`/`css/`, `FACTS.md`, `llms.txt`, build scripts, templates, human edits to `package.json` | full gate; Claude's screenshots stay step zero; the human look happens **once, on staging** |
| **C** | `docs/`, README, tests under `app-src/`, module i18n dictionaries, `img/`+`fonts/`, generated files, `/stories/` content pages (twin rule via the generator), dependabot npm bumps | none — full gate + CI + staging deploy still run; **merge on green**; the merge is reported in the weekly review |

Dependabot needs no declaration: `check-tier.mjs` resolves its PRs to C from the PR author.
`dependabot-auto-merge.yml` queues auto-merge for **npm minor/patch** only
([ADR 0039](docs/decisions/0039-dependabot-auto-merge-scope.md)); **npm majors** are merged by
the owner, and its **GitHub-Actions bumps touch workflows**, so the path floor is A and the owner
writes that line by hand (the `edited` event re-runs the check). Detector/dashboard YAML has no path rule yet — declare B when
adding, C when tuning (work order Part 4). **Calibration:** two weeks after tiers land, the owner
watches Tier-B PRs closely.

**Agent permissions** ([ADR 0022](docs/decisions/0022-agent-permissions-allowlist.md)): the committed
`.claude/settings.json` is the policy. Honest scope: `allow` removes prompts for routine local work;
`ask`/`deny` catch *direct* invocations (a push, `supabase db push`, `rm -rf`, reading `.env`) — an
allowed interpreter or `find -delete` can route around them, so they are guardrails against habit,
not a security boundary; the sandbox and the rails (branch protection, CI, staging) are. Per-machine
extras go in `settings.local.json`.

## Module work kickoff (MANDATORY for new initiatives)

Run the **`feature-spec` skill** (after `product-context`): it is this section made executable.
**Step zero — alignment questions,** question by question (scope, expected outcome and its metric,
explicit out-of-scope, how it serves VISION and fits ARCHITECTURE) until both sides are 100% aligned.
No artifacts, no code before that. Then, before any code, generate the full set in parallel:

1. **Plan file** `docs/plans/<module>-<initiative>.md`: scope, the **Outcome metric** table
   (ADR 0019), schema/RLS/permission changes, UI surface, open questions; link it from
   `docs/ROADMAP.md`.
2. **Roadmap alignment** — it belongs to the current phase, or is added/flagged.
3. **Architecture invariants check** — permissions DB-first, schema in `supabase/schema/`, money and
   lifecycle through the cross-module spines, bilingual via shell i18n, mobile-first.
4. **Vision check.**
5. **Branch + tier** — `main` deploys straight to production; merge via PR after the gate, with
   the tier declared in the PR description.

**Conflict rule:** anything that contradicts the vision, roadmap, architecture or an ADR — or those
documents contradicting each other — is **raised with the user explicitly**, never coded around.
The agreed resolution is written back into the relevant doc (and an ADR) so it can't resurface.

## Ongoing module work — bug fixes & small features

For a bug fix or small self-contained feature on a shipped module, skip the kickoff and use the
lighter log, automatically: (1) check `docs/modules/<module>.md` for open items and surface them;
(2) log the item there (Open bugs / Open feature ideas); (3) do the work, then move the entry to
**Done** with date and a one-line note; (4) before the gate, give the user the list of changes plus
the exact local command and what to click per item, and wait for confirmation per the tier table
(Tier A: localhost; B: staging; C: none); (5) the gate below
still applies in full. If the fix grows (new schema, permissions, the events/finance spine, a real
UI design decision) stop and run the kickoff — it became an initiative. Convention:
`docs/modules/README.md`.

## Pre-commit quality gate (MANDATORY)

**Step zero — UI confirmed on localhost before the gate starts** ([ADR 0008](docs/decisions/0008-ui-confirmed-on-localhost-before-gate.md)),
for any diff with user-visible UI: (1) Claude verifies with headless-Chrome screenshots at 360 / 390 /
1280px — a `!! HORIZONTAL OVERFLOW` line is a finding ([ADR 0009](docs/decisions/0009-360px-viewport-and-overflow-report.md));
(2) Claude gives the serve command and what to open/click; (3) the user confirms — per the tier table
(A: here; B: on staging; C: none). Diffs with no UI surface skip to the gate.

**No commit until all of these pass** on the pending diff, each review at **high effort** on the most
capable model; every finding fixed (or explicitly waived by the user) and the step re-run clean:

1. **`/simplify`** — runs first and alone; it edits the tree, so steps 2–3 review its output.
2. **`/code-review high` + `/security-review`** — **concurrently** ([ADR 0010](docs/decisions/0010-code-review-and-security-review-run-concurrently.md));
   collect both sets of findings before fixing; a fix touching cleared code re-runs that pass.
3. **`/verify`** — the affected flow end-to-end in the real app on localhost, via the `verify` skill and
   `scripts/verify/screenshot.mjs` ([ADR 0011](docs/decisions/0011-verify-skill-and-screenshot-harness-are-the-gate-tooling.md)).
   For any `supabase/` diff it includes `supabase/tests/rls_matrix.sql` to a green
   `RLS MATRIX: ALL ASSERTIONS PASSED`, extended first with assertions for what the diff changed.

**Diff-class scaling** ([ADR 0003](docs/decisions/0003-docs-only-diffs-run-gate-inline.md)): docs-only
diffs (no runtime or schema surface) run steps 1–2 inline and skip 3, whatever their tier. The full
multi-agent gate is mandatory for any diff with a runtime surface — `app-src/`, `supabase/`, `js/`,
the assemble allowlist, `.github/workflows/`, `scripts/`.
A commit with an unrun or failing gate step is a process violation.

## Staging verification (MANDATORY before merging to main)

[ADR 0012](docs/decisions/0012-staging-verification-mandatory-before-main.md). **Applies to** any diff with a
deployed surface (the assemble allowlist, `app-src/`, `supabase/`, `.github/workflows/`); **not** to
`docs/`, `CLAUDE.md`, `.claude/`, `tests/` — never deployed, so a Tier-A diff there gets the owner's PR
review instead. After the gate: (1) bring the branch up to date with `main`, push it onto
`staging` (merge/fast-forward, never force) — **pre-authorized**, no need to ask; sequence behind any
branch already mid-verification; (2) wait for `deploy-staging.yml`, smoke-check the routes; (3) give the
user the `staging.levyam.com` click-list per change; (4) sign-off **per the tier table**, then merge.

## Roadmap item close-out (MANDATORY)

An item is done only when: (1) a `## Close-out` section in its plan file says what shipped, what
schema/permission changes were applied, what was decided on the way (→ ADRs), what was left out;
(2) alignment against VISION and ARCHITECTURE is stated explicitly — drift is a conflict, raised and
resolved first; (3) `docs/ROADMAP.md` is ticked and discovered follow-ups added; (4) the user has seen
the summary and verdict.

**Outcome check** ([ADR 0019](docs/decisions/0019-outcome-metrics-validation-loop.md)): close-out
proves the thing was *built*, not that it *worked*. Every plan **from 2026-09-21 onward** names an
**Outcome metric** at kickoff (`feature-spec`, MODULE-TEMPLATE §0) with a check date of
ship + 2–4 weeks. On that date the metric's value goes under `## Outcome check` in the plan file
with a verdict — **worked / did not / cannot tell** — and what it changes. `weekly-review` lists
checks that have come due; the monthly triage carries the **shipped-but-unvalidated** list, which
per the operating system must never be deeper than one cycle. Both scope to plans that *have* an
Outcome metric table — plans closed out before 2026-09-21 predate the rule and are not retrofitted.
"Cannot tell" is a finding about the instrumentation, not a pass.

## Operating cadence

The rhythm that makes a company of one work at speed ([ADR 0021](docs/decisions/0021-operating-cadence-quarterly-gate.md)).
Three of the four are automated into a GitHub issue; the owner's time goes only where judgment is
needed. **The automation is built but not yet live** — it needs the `CLAUDE_CODE_OAUTH_TOKEN` secret
(master plan blocker B2); until then each job exits clean at its key guard and produces no issue.

| When | What | Who |
|---|---|---|
| **Weekly** (Sun) | `weekly-review` — shipped vs the roadmap block, Tier-C merges that auto-shipped, plans missing a close-out, outcome checks now due, drift check, analytics headline, Alerts & problems, Harness health | automated; owner reads |
| **Monthly** (1st) | `feedback-triage` digest + parking-lot batch + obs-best-practices audit + shipped-but-unvalidated | automated agenda; owner decides |
| **Quarterly** (1st of Jan/Apr/Jul/Oct) | vision audit, architecture audit, then the one sanctioned divergent brainstorm, then converge | **owner's judgment, never run unattended**; evidence pack assembled for them |
| **Per initiative** | kickoff alignment (Gate 1) → build → outcome check (Gate 2) | owner at the two gates only |

**The queue-jumper rule:** evidence that a current bet is *wrong* interrupts anything. Nothing else
does — not a new idea, not a competitor, not an interesting piece of tech. Ideas go to
`docs/ideas.md` via `idea-capture` and wait for the monthly batch. Interrupting for anything but
invalidation is how a one-person roadmap becomes a list of half-built things.

**The first quarterly review is the gate into Roadmap Phase 2** (ADR 0021) and doubles as the
shakedown cruise for this machinery — decision log, tiers, outcome metrics, cadence. Its output
is the mandate for Phase 2.

### Session hygiene (context-rot defence)

- **One approved spec per session.** Never two initiatives in one context — the second inherits
  the first's assumptions silently, which is how a bugfix acquires a schema change.
- **Review and test passes run as subagents** for any diff with a runtime surface, with their own
  clean context, not in the builder's. Docs-only diffs keep ADR 0003's inline path.
  A builder reviewing its own work in its own context re-reads its own intent, not the diff.
  The gate already runs the two reviews concurrently (ADR 0010, for wall-clock); running them as
  subagents is what gives each its own context.
- **Compact or restart at natural checkpoints** — after a merge, between gate steps — rather than
  pushing through to the end of a full window. A session that runs out of context mid-gate loses
  the findings it had not yet acted on.

## Deploying

Push to `main` → `.github/workflows/deploy.yml` builds `app-src` → `/app`, assembles the site from the
**explicit allowlist in `scripts/assemble-site.sh`** (shared with staging's `build-site.sh`; a new public
page or asset folder must be added there or it 404s in prod), runs the grant audit and smoke-checks
`/`, `/app/`, `/pos.html`, `/stories/`, `/stories/ar/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`,
`/facts.txt`. `main` is branch-protected: PR + green `ci.yml` required, no direct pushes, admins
included (ARCHITECTURE §6c). Pushing `staging` triggers `deploy-staging.yml` → `staging.levyam.com`
(Cloudflare Pages, noindex, `lev-yam-staging` Supabase); only `main` and `staging` are long-lived.
`docs/`, `tests/`, `supabase/` are never deployed. One-time setup: [supabase/README.md](supabase/README.md).

## Automations (the night shift)

Five triggers run without a human ([ADR 0039](docs/decisions/0039-dependabot-auto-merge-scope.md),
work order G4). All of them go through the same rails as a human PR — none is a shortcut past the gate.

| Workflow | Fires | Produces |
|---|---|---|
| `claude.yml` | `@claude` on an issue or PR | a branch + PR through the normal gate, tier declared |
| `weekly-review.yml` | Sun 17:00 UTC | `report.md` → issue `Weekly review YYYY-Www` — the solo product council, incl. **Alerts & problems** (the only weekly eyes Dynatrace/Bluebox get) and **Harness health** |
| `monthly-triage.yml` | 1st of the month | `report.md` → issue `Monthly roadmap review YYYY-MM` — feedback digest + parking-lot batch + obs-best-practices audit |
| `quarterly-prep.yml` | 1st of Jan/Apr/Jul/Oct | `report.md` → issue `Quarterly review YYYY-Qn` — evidence pack + agenda checklist. **The review session itself is never run unattended** |
| `dependabot-auto-merge.yml` | dependabot PRs | the Tier line, and auto-merge for npm minor/patch |

The three report jobs share one reusable worker, `agent-report.yml` (`workflow_call` only) —
schedule, prompt and tool scope are all that differ. Each caller has `workflow_dispatch`; that
manual run is the acceptance test. They authenticate with **the owner's Claude subscription token** (`claude setup-token` →
repo secret `CLAUDE_CODE_OAUTH_TOKEN`), not API credits ([ADR 0042](docs/decisions/0042-agent-workflows-run-on-the-subscription-token.md)); without it they
log the omission and exit clean rather than failing every night.

**`--allowedTools` is not a restriction** — it only skips the permission prompt, and it is
*unioned* with whatever the settings files allow. Two consequences the Step 6 security review
established, both load-bearing:

- **The report jobs must not load `.claude/settings.json`.** That file is written for local dev:
  `defaultMode: acceptEdits`, `Bash(node *)`, `Bash(python3 *)`. These jobs read public issue
  text, so inheriting it would hand an issue-reading agent arbitrary code execution next to
  `CLAUDE_CODE_OAUTH_TOKEN`. `agent-report.yml` **deletes the workspace copy** before the action runs
  and does not pass `settings:`. Its other layers are `--disallowedTools` (deny beats allow) and
  `contents: read` + an explicit `github_token`, which pin API calls to the job's own scoped token.
  **The CLI's `--restricted` / `--tools` / `--permission-prompts` are not usable here.** The action
  installs Claude Code but drives it *through* the agent SDK, translating `claude_args` into SDK
  options — so only the documented set survives the translation: `--mcp-config`, `--allowedTools`,
  `--disallowedTools`, `--max-turns`, `--model`, `--append-system-prompt`. Passing the others killed
  every run in ~120 ms with `is_error: true` and no error text. Don't reintroduce them.
- **The report agents hold no write to any public surface** ([ADR 0048](docs/decisions/0048-report-agents-hold-no-write-and-actions-are-sha-pinned.md)).
  They write `report.md`; a fixed step after them runs `scripts/report-guard.py`, then labels,
  de-duplicates (`jq --arg`, never a search string built from agent text) and publishes. Say
  plainly what the deny list does **not** do: `$VAR` expands in any *allowed* command's
  arguments, `gh --jq` is gojq with `$ENV`, and `head`/`tail`/`cut`/`sort` read
  `/proc/self/environ` — so a bash-capable agent reads its own environment whatever is denied.
  The design therefore assumes it may learn a secret and removes every way to send one: the `gh`
  write family denied, `Write` scoped to `report.md`, `.git/` denied (git runs `diff.external`
  through the shell on an allowed `git log -p`), and the runner's own file commands —
  `GITHUB_STEP_SUMMARY`, which renders publicly, plus `GITHUB_ENV`/`PATH`/`OUTPUT` — pointed at
  `/dev/null` for the agent step, since an allowed command with a redirect reaches them whatever
  `Write` is scoped to. The guard, which withholds the whole report if a secret's value appears in
  it, is a loud detector on top of that, not a boundary. **Every third-party action is
  SHA-pinned** with the version in a trailing comment (7 actions across the 7 workflow files that
  use one); dependabot keeps them current.
- **`claude.yml` denies `git push` outright.** It genuinely needs Edit/Write/build, and an agent
  that can write a file and run a build can run code — inherent, not pluggable. What it must
  never reach is a deploy: `deploy-staging.yml` fires on *any* push to `staging`, and
  `.claude/settings.json` allows `Bash(git push origin staging)` for local dev. `--disallowedTools`
  is what overrides that, since deny beats allow; the action pushes its own branch through the API,
  so denying the command costs nothing. `supabase`, `dtctl` and `gh api/secret/workflow` are denied
  for the same reason. It triggers for **write-access accounts only** (`allowed_non_write_users`
  and `allowed_bots` pinned to `""`).

- **Analytics reach the report jobs as a file, never as a credential:** a pre-agent step in
  `agent-report.yml` is the only one that names `GOOGLE_SA_KEY`; the agent only `Read`s
  `.reports/analytics.json` ([ADR 0047](docs/decisions/0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md)).

All five workflows need **`id-token: write`** — the action mints its token through GitHub's OIDC
endpoint and fails without it. It is not a repo-write grant.

**A skill's `queries.md` and its workflow's `allowed_tools` are one unit.** The weekly report failed
its first live run because the skill's shell pipelines (`date`, `grep`, `awk`) and its `dtctl` /
`bluebox` sections were not in the allowlist: each denial costs a turn, and the turn budget ran out
before the issue was written. Change one, check the other. `max_turns` is a **runaway guard, not a
budget** — the action fails a job that finishes successfully past the cap, so set it well above the
real count (observed: weekly 73, monthly 50, quarterly 34).

In `claude_args`, any value containing a space must stay quoted — the action shell-tokenizes each
line, so a bare `Bash(git log *)` splits into three tokens and the rule silently stops matching
([claude-code-action#844](https://github.com/anthropics/claude-code-action/issues/844)).

## Repo housekeeping

- Historical pre-launch records: `docs/archive/` (not a to-do list). Active plans: `docs/plans/`, one
  per initiative, linked from the roadmap. Decisions: `docs/decisions/`. Cross-cutting ideas:
  `docs/ideas.md` (one dated line each, via the `idea-capture` skill; module ideas stay in
  `docs/modules/`).
- **`.claude/skills/` and `.claude/settings.json` are versioned with the repo** (the gate depends on
  `verify`; the settings file is the committed permission policy). Skills: engineering — `verify`,
  `production-query`, `bluebox-*`; product — `product-context`, `feature-spec`, `idea-capture`,
  `weekly-review`, `feedback-triage`, `quarterly-review`; content — `story-author`; monthly
  `obs-best-practices`. Each ships a
  3-case `EVALS.md`, run at the quarterly ceremony audit. `.claude/settings.local.json` and other
  agent state stay untracked. Also ignored: `.DS_Store`, `node_modules/`, `app-src/dist/`, `.env*`, raw source media.
- `tests/` holds Dynatrace bizevent test harnesses (open in a browser), not a unit-test suite.
- `AGENTS.md` at the root is a pointer to this file for other harnesses — never duplicate content there.
