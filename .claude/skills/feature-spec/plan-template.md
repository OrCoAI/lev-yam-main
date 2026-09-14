# <Module> — <Initiative>

*Kickoff YYYY-MM-DD · branch `<name>` · roadmap block: <block> · tier: <A|B|C> (ADR 0015)*

## Why
Two or three sentences: the problem, who has it, what not solving it costs. Evidence
(a module log entry, a weekly-report line, feedback-triage finding, a number).

## Outcome metric
| | |
|---|---|
| Metric | e.g. "WhatsApp CTA clicks from /stories/ per week" / "bills closed via split payment" |
| Source | GA4 event · Dynatrace bizevent · SQL count · module report tab |
| Baseline (today) | number + date |
| Target | number |
| Check date | ship + 2–4 weeks (YYYY-MM-DD) — `weekly-review` lists it when due |
| Verdict owner | owner |

## Scope
The thinnest end-to-end slice. Bullet list of what ships.

## Explicitly out of scope
Bullets, each with a one-line why (not enough impact / separate initiative / later phase).

## Schema, RLS, permissions
New/changed tables in `supabase/schema/`; policies; `core.permissions` rows and which roles;
what `rls_matrix.sql` gains. "None" is a valid answer and is written down.

## UI surface
Modules / public pages touched; HE + AR strings; phone-first layout notes; screenshots plan
for step zero.

## Rollback
How it is undone (feature-flag row, revert PR, migration down) and what data it leaves.

## Checks
- **Roadmap:** …
- **Architecture:** invariants 1–8 walked; verdict.
- **Vision:** principle(s) served; verdict.

## Open questions
Blocking (must answer before code) vs non-blocking; who answers.

## Decisions made on the way
Date · decision · ADR number.

## Close-out
*(appended when done — CLAUDE.md "Roadmap item close-out")*

## Outcome check
*(appended on the check date: metric value vs target, verdict, what it changes)*
