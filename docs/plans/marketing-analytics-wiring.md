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
| Metric | Consecutive Sunday `Weekly review` issues whose **Analytics headline** carries real numbers — GA4 `whatsapp_click` by `page_slug` **and** GSC clicks + impressions for the window — with no `n/a` on that line |
| Source | The `weekly-review` issues themselves (`gh issue list --label weekly-review`) |
| Baseline (today) | 0 — the only headline so far (#70, 2026-09-22) says `n/a` |
| Target | 3 of 3, without the owner exporting anything |
| Check date | **2026-10-19** — the Monday after the third scheduled run following ship (runs 10-04, 10-11, 10-18); `weekly-review` lists it when due |
| Verdict owner | owner |

The secondary signal, read at the same check: GA4 shows `whatsapp_click` as a key event with a
non-zero conversion count for the window (proves the console click, item (a) below).

## Scope

The thinnest slice that makes the headline real and keeps the agent away from the credential:

- **(a) Console, owner, 2 clicks:** mark `whatsapp_click` a key event in the GA4 UI
  (ADR 0006 already names it *the* key event; nothing in the repo changes).
- **(b) `scripts/analytics-snapshot.mjs`** — Node 22, **zero dependencies** (a service-account JWT
  signed with `node:crypto`, exchanged at `oauth2.googleapis.com/token`, then plain `fetch`):
  - GA4 Data API (`runReport`, property `549432476`): sessions and users by default channel group;
    `whatsapp_click` event count by `page_slug`; `whatsapp_click` by session source/medium.
  - GSC Search Analytics API (`sc-domain:levyam.com`): clicks, impressions, CTR, average position;
    top 10 queries and top 10 pages by clicks.
  - Two windows in one file: the **last 7 full days** and the **28 days before them**, so the
    headline can say up/down against the trailing four-week average.
  - Output: one JSON file (`.reports/analytics.json`, untracked) with the two windows, the query
    date range, and a `generated_at` stamp. On any error it writes `{ "error": "<reason>" }` and
    exits 0 — the report must never fail because Google did.
- **(c) `agent-report.yml`** gains one optional step *before* the agent, gated on a new boolean
  input `analytics_snapshot` and the presence of secret `google_sa_key`: runs (b), uploads the JSON
  as a workflow artifact (default 90-day retention). The three callers pass the input
  (`weekly-review.yml`, `monthly-triage.yml`, `quarterly-prep.yml` — scope (e)). Missing secret →
  a step-summary line and the file `{ "error": "GOOGLE_SA_KEY not set" }`, same pattern as the
  OAuth-token guard.
- **(d) `weekly-review` skill:** step 7 and `queries.md` §7 read `.reports/analytics.json` and
  produce the headline: sessions (Δ vs trailing avg), `whatsapp_click` total and top 3 `page_slug`,
  GSC clicks/impressions (Δ), top 3 queries. `Read` is already in the allowlist; no new tools.
- **(e) Monthly + quarterly prompts:** point `feedback-triage` (its "last four weekly reports"
  input) and `quarterly-review` (its "analytics trajectory" input) at the same file; the
  monthly-triage prompt's "no analytics credentials" sentence is replaced.
- **Owner setup, once (~15 min):** GCP project → enable *Google Analytics Data API* and *Google
  Search Console API* → service account → JSON key → `gh secret set GOOGLE_SA_KEY < key.json`;
  add the SA e-mail as **Viewer** on the GA4 property and as a **Full/Restricted user** on the GSC
  property. The key is long-lived: **rotate at the 2027-01-01 review** (added to that list).
  Locally the same key lives at `.secrets/google-sa.json` (already git-ignored) for running the
  script by hand.

## Explicitly out of scope

- **Ahrefs / Semrush data** — paid (Ahrefs API plan; Semrush units). Parked for the monthly triage
  as a spend decision; items 4 (Brand Radar) and 9 (DR) name them and will re-raise it.
- **Meta Insights API** — the Pixel `Contact` fires today; social attribution arrives with item 6.
- **Dynatrace anything** — deferred to 2027-01-01 ([ADR 0045](../decisions/0045-observability-home-re-deferred-to-2027-01-review.md)).
- **Any new `gtag('event', …)`** — ADR 0006: one hand-written event; this item marks it, adds none.
- **Dashboards, charts, GA4 alerts, e-mailed reports** — the weekly issue is the reader.
- **Committing the snapshot** — the numbers appear in the public issue (decided, ADR 0047); the
  JSON stays a workflow artifact so the repo carries no time series to maintain.
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
- The JSON the agent reads is data from Google, not from an issue — but the prompt's HARD RULE
  still applies to it; the skill quotes numbers, never text fields, into the headline (query
  strings are the one text field and are rendered inside a code span).
- The SA holds Viewer on one GA4 property and one GSC property, nothing else in Google.

## Rollback

Revert the PR. The workflow then falls back to the guard path (`n/a — GOOGLE_SA_KEY not set`)
even before the revert, if the secret is deleted. No data is left anywhere but expired workflow
artifacts; the GA4 key-event mark is a console toggle the owner can undo.

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
- **Non-blocking:** GA4 `page_slug` is a custom event parameter — if it was never registered as a
  custom dimension in the GA4 UI, `runReport` cannot group by it; the script then falls back to
  `pageLocation` and the plan notes the console step. Confirmed during local verification.
- **Non-blocking:** GSC data lags ~2 days; the "last 7 full days" window ends at `today − 3` for
  GSC and `today − 1` for GA4. The headline states both ranges.

## Decisions made on the way

- 2026-09-22 · Sources are GA4 + Search Console only; Ahrefs/Semrush parked as a paid decision;
  traffic numbers may appear in the public weekly issue; SA key as a repo secret ·
  [ADR 0047](../decisions/0047-analytics-wiring-ga4-and-gsc-only-public-numbers.md).

## Close-out

*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check

*(appended on 2026-10-19: reports with real numbers vs target 3/3, verdict, what it changes)*
