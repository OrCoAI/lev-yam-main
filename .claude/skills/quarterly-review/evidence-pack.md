# Evidence pack — what the agent assembles

Window: the quarter (or since the last review). Every item names its source file/command.

1. **Delivery**: roadmap items ticked this quarter (git log on `docs/ROADMAP.md`); every
   `## Close-out` written this quarter with its alignment verdict; every `## Outcome check`
   verdict (validated / not / missing — missing ones are a finding).
2. **Weekly trends**: from the quarter's `Weekly review` issues — drift incidents per week,
   Tier-C volume, rework rate and time-to-merge by tier (Harness health), alerts unseen > 7d,
   Gate-2 queue depth over time.
3. **Monthly digests**: the quarter's `Monthly roadmap review` issues — ranked opportunities
   that recurred, bets validated/contradicted, parking-lot graduations.
4. **Analytics trajectory**: the weekly-review issues' Analytics headlines across the quarter
   (WhatsApp CTA by page, sessions, GSC clicks/impressions/queries) plus the current
   `.reports/analytics.json` (ADR 0047), `/stories/` performance, survey signal.
   **Dynatrace RUM and bizevents are unavailable** — the home is itself a deferred decision
   ([ADR 0045](../../../docs/decisions/0045-observability-home-re-deferred-to-2027-01-review.md));
   say so under "Missing evidence" rather than waiting for it.
5. **Observability generation**: the monthly `obs-best-practices` compliance tables —
   drifted/superseded items, traffic-threshold status, deprecations. Thin until the home
   exists; report the thinness, do not pad it.
6. **Ideas deferred upward**: `docs/ideas.md` lines the monthly reviews tagged "strategic".
7. **Open conflicts**: anything raised under the conflict rule and still unresolved.
8. **Deferred decisions due**: every ADR in `docs/decisions/` whose **Status** begins
   whose **Status** line contains `deferred — <this review>`
   (`grep -l '^- \*\*Status:\*\*.*deferred — ' docs/decisions/*.md` — the **Status** line only,
   so prose elsewhere in an ADR is not a false positive).
   For each: what was deferred, why, what has changed since, and what it is still blocking.
   These are agenda item 3 and each one must leave the session with a verdict.

Format: one markdown document, sections in this order, each ≤ one screen, links to sources.
The agenda checklist (vision audit → architecture audit → brainstorm → converge) follows it.
