# Marketing — Analytics wiring (Q4 mandate item 1)

*Kickoff 2026-09-22 · branch `analytics-wiring` · roadmap block: Phase 2 — 2026-Q4 mandate, item 1 ·
tier: **A** (ADR 0015 — `.github/workflows/` and `.claude/skills/` are on the path; `scripts/*.mjs` alone would be B)*

## Why

The Q4 mandate ([ADR 0046](../decisions/0046-q4-2026-mandate-marketing-quarter.md)) is judged on
outcome checks, and every one of its twelve other items names a number that lives in GA4 or Search
Console. Today none of those numbers reaches the operating system: the weekly review's *Analytics
headline* prints `n/a` (the one live run so far, [issue #70](https://github.com/OrCoAI/lev-yam-main/issues/70), W39) and the monthly
triage ends with "no analytics credentials are configured". Without this item the mandate cannot be
validated — it can only be built.

The mandate row also named Ahrefs/Semrush as sources; probed at kickoff, neither MCP returns data
without a paid plan, so both are parked as a spend decision
([ADR 0047](../decisions/0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md)).

## Outcome metric

| | |
|---|---|
| Metric | Consecutive Sunday `Weekly review` issues whose **Analytics headline** carries real numbers — GA4 sessions and `whatsapp_click` **and** GSC clicks + impressions for the window — with no `n/a` on those lines. The per-page `page_slug` breakdown is a **secondary** signal: it is reported when present, and its absence in the first weeks is the custom dimension's registration date, not a failure of the wiring (ADR 0047 §4 is the governing wording) |
| Source | The `weekly-review` issues themselves (`gh issue list --label weekly-review`) |
| Baseline (today) | 0 — the only headline so far (#70, 2026-09-22) says `n/a` |
| Target | 3 of 3, without the owner exporting anything |
| Check date | **2026-10-19** — the Monday after the third scheduled run following ship (runs 10-04, 10-11, 10-18); `weekly-review` lists it when due |
| Verdict owner | owner |

The secondary signal, read at the same check: GA4 shows `whatsapp_click` as a key event with a
non-zero conversion count for the window (proves the console click, item (a) below).

## Scope

The thinnest slice that makes the headline real and keeps the agent away from the credential:

- **(a) Console, owner, one trip:** in the GA4 UI (1) mark `whatsapp_click` a key event
  (ADR 0006 already names it *the* key event) and (2) register `page_slug` as an
  **event-scoped custom dimension** — the Data API can only group by a registered parameter,
  and the script deliberately has no fallback to the page path (HE/AR twins share one slug; the
  path would measure something else). Custom dimensions collect from registration onward, so
  this click lands **before the first scheduled run (10-04)** or that headline is a legitimate
  `n/a`. Nothing in the repo changes.
- **(b) `scripts/analytics-snapshot.mjs`** — Node 22, **zero dependencies** (a service-account JWT
  signed with `node:crypto`, exchanged at `oauth2.googleapis.com/token`, then plain `fetch`):
  - GA4 Data API (`runReport`, property `549432476`): sessions and users by default channel group;
    `whatsapp_click` event count by `page_slug`; `whatsapp_click` by session source/medium.
  - GSC Search Analytics API (`sc-domain:levyam.com`): clicks, impressions, CTR, average position;
    top 10 queries and top 10 pages by clicks.
  - Two windows in one file: the **last 7 full days** and the **28 days before them**, so the
    headline can say up/down against the trailing four-week average.
  - Output: one JSON file (`.reports/analytics.json`, untracked) with the two windows per source
    and a `generated_at` stamp. Any error — auth or per source — becomes `{ "error": "<reason>" }`
    under `ga4` / `gsc` and the exit code stays 0: the report must never fail because Google did.
- **(c) `agent-report.yml`** gains one plain step *before* the agent, after the OAuth-token guard
  (no token → no report → no Google calls): runs (b) with secret `google_sa_key`, which the three
  callers pass through (`weekly-review.yml`, `monthly-triage.yml`, `quarterly-prep.yml` — scope
  (e)). Missing secret → the file says so and the step summary prints the status line. No artifact
  upload: nothing in the system can read a run artifact (the agent has no `gh run`), and the
  weekly issues *are* the time series.
- **(d) `weekly-review` skill:** step 7 and `queries.md` §7 read `.reports/analytics.json` and
  produce the headline: sessions (Δ vs trailing avg), `whatsapp_click` total and top 3 `page_slug`,
  GSC clicks/impressions (Δ), top 3 queries. `Read` is already in the allowlist; no new tools.
- **(e) Monthly + quarterly prompts:** point `feedback-triage` (its "last four weekly reports"
  input) and `quarterly-review` (its "analytics trajectory" input) at the same file; the
  monthly-triage prompt's "no analytics credentials" sentence is replaced.
- **Owner setup, once (~15 min):** GCP project → enable *Google Analytics Data API* and *Google
  Search Console API* → service account → JSON key → `gh secret set GOOGLE_SA_KEY < key.json`;
  add the SA e-mail as **Viewer** on the GA4 property and as a **Restricted user** (not Full —
  reading is all it does) on the Search Console property. The key is long-lived: **rotate at the 2027-01-01 review** (added to that list).
  Locally the same key lives at `.secrets/google-sa.json` (already git-ignored) for running the
  script by hand.

## Explicitly out of scope

- **Ahrefs / Semrush data** — paid (Ahrefs API plan; Semrush units). Parked for the monthly triage
  as a spend decision; items 4 (Brand Radar) and 9 (DR) name them and will re-raise it.
- **Meta Insights API** — the Pixel `Contact` fires today; social attribution arrives with item 6.
- **Dynatrace anything** — deferred to 2027-01-01 ([ADR 0045](../decisions/0045-observability-home-re-deferred-to-2027-01-review.md)).
- **Any new `gtag('event', …)`** — ADR 0006: one hand-written event; this item marks it, adds none.
- **Dashboards, charts, GA4 alerts, e-mailed reports** — the weekly issue is the reader.
- **Committing or archiving the snapshot** — the numbers appear in the public issue (decided,
  ADR 0047), which is the time series; the JSON is regenerated every run.
- **Workload Identity Federation** — keyless auth was offered and declined for setup cost;
  revisit if a second Google integration appears.

## Schema, RLS, permissions

**None.** No Supabase surface; nothing in `supabase/schema/`; `rls_matrix.sql` unchanged.

## UI surface

**None** — no page, no module, no strings. Output is a GitHub issue section. Step zero of the
gate (screenshots) does not apply; the acceptance test is the `workflow_dispatch` run.

## Security notes (Tier A, workflows)

- The agent step **never references `google_sa_key`**: GitHub exposes a secret only to steps that
  name it, so the credential is absent from the agent's process environment — the existing
  `Bash(env)` / `Read(/proc/**)` denies stay a second layer, not the only one.
- The snapshot step is plain `node`, run by the workflow, not by the agent (`Bash(node *)` stays
  denied for the agent). The script is read-only against Google (reports only).
- **The snapshot carries attacker-influenceable text.** GA4 collection is unauthenticated (the
  measurement ID is in the page source), so anyone can post a `whatsapp_click` with an arbitrary
  `page_slug`, or arrive with a crafted `utm_source`; search queries are whatever people type.
  The headline quotes three such fields (top pages, top source, top queries) into a **public
  issue**, so the script strips markdown punctuation and control/bidi characters and clamps each
  to 80 characters before writing them, and the two consuming prompts name the file in their HARD
  RULE. The same channel can inflate the outcome metric itself — a deliberate accepted limit at
  this traffic volume, re-read at the check date.
- Google's own error text is clamped too: `SERVICE_DISABLED` names the GCP project and its
  console URL, and both the step summary and the issue are public.
- The SA holds Viewer on one GA4 property and one GSC property, nothing else in Google.

## Rollback

Revert the PR. Deleting the secret alone already returns the reports to `n/a — GOOGLE_SA_KEY not
set` without a revert. No data is left anywhere but past issues and expired workflow
runs; the GA4 key-event mark and the custom dimension are console toggles the owner can undo.

## Checks

- **Roadmap:** Phase 2 — 2026-Q4 mandate, item 1, first kickoff as the mandate requires. Also
  ticks the organic-reach track's "mark `whatsapp_click` as a key event" line.
- **Architecture:** invariants 1–8 walked — 1, 2, 4, 6, 7 untouched (no DB, no browser key);
  **3 holds**: a service-account key is a secret and lives only in a repo secret / `.secrets/`
  (git-ignored); traffic counts and query strings in a public issue are not PII, prices or
  customer data; 5 n/a (no user-facing text); 8 — this plan is linked from the roadmap. §6c
  delivery rails: the new step runs inside the existing report worker, under its existing
  `contents: read` ceiling. **Verdict: aligned.**
- **Vision:** serves the **Join** circle — being found and contacted is what the quarter measures;
  P4 (public by default) is honoured in spirit by putting the numbers in the open issue. Breaks
  nothing; P1 is untouched. **Verdict: aligned.**

## Open questions

- **Blocking (owner):** the GCP setup and `GOOGLE_SA_KEY` — the workflow step can be built and
  tested locally against the same key, but the acceptance run needs the secret.
- **Owner, before 10-04 for a full first headline:** the `page_slug` custom dimension — scope (a).
  Until it exists the GA4 line still carries sessions and the `whatsapp_click` total (both
  un-dimensioned); only the per-page breakdown reads `n/a`, with the reason from Google.
- **Non-blocking:** GSC data lags ~2 days; the "last 7 full days" window ends at `today − 3` for
  GSC and `today − 1` for GA4. The headline states both ranges.

## Decisions made on the way

- 2026-09-22 · Sources are GA4 + Search Console only; Ahrefs/Semrush parked as a paid decision;
  traffic numbers may appear in the public weekly issue; SA key as a repo secret ·
  [ADR 0047](../decisions/0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md).
- 2026-09-22 · Gate step 1 (`/simplify`): no `pagePath` fallback for `page_slug` (it would fake
  a pass on the outcome metric — twins share a slug); no artifact upload and no `setup-node`
  (no consumer; Node ≥ 18 suffices); the step is gated on the OAuth-token guard rather than a
  caller flag. Implementation detail, no ADR.
- 2026-09-22 · Gate step 2 (code + security review): free-text fields are scrubbed in the script
  rather than trusted to the prompt; each GA4/GSC part is fetched independently so a missing
  `page_slug` dimension costs only its own line; `users` comes from an un-dimensioned query
  (summing `totalUsers` per channel double-counts); `jq`/`awk`/`find` were **removed from the
  report jobs' allowlists and denied** — each reads the process environment directly
  (`jq 'env.X'`) next to a public-issue write and the agent's inherited `GH_TOKEN`.
- 2026-09-22 · **Correction from the re-review: that deny does not close the class, and this
  plan will not claim it does.** The shell expands `$VAR` in any *allowed* command's arguments
  (`gh issue create --body "$CLAUDE_CODE_OAUTH_TOKEN"` uses no denied binary), `gh --jq` is gojq
  and implements `$ENV`, and `head`/`tail`/`cut`/`sort` read `/proc/self/environ`. The deny
  removes the obvious paths only. Pre-existing in all three report jobs; the workflow's threat-model
  comment now says so plainly instead of overstating it.
- **Raised, not fixed (owner's call):** (0) **the report agent can read its own environment**
  (above) — closing it means taking `gh issue create` off the agent and having a post-agent step
  publish what it wrote, across all three report jobs: a harness initiative, not part of this one,
  and the only reason it is not urgent is that the repo has one write account; (1) `actions/checkout@v7` and `claude-code-action@v1` are
  mutable tags that now run upstream of a Google private key — SHA-pinning them is a repo-wide
  convention change; (2) `workflow_dispatch` runs the *selected ref's* workflow with the secret,
  so branch protection does not cover this credential, and Workload Identity Federation (keyless)
  needs no new GitHub permission since `id-token: write` is already granted — worth re-deciding at
  the 2027-01-01 rotation rather than treating ADR 0047 §2 as settled.

## Close-out

*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check

*(appended on 2026-10-19: reports with real numbers vs target 3/3, verdict, what it changes)*
