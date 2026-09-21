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
4. **Analytics trajectory**: WhatsApp CTA trend by page (GA4), `/stories/` performance,
   platform usage by module (Dynatrace RUM once the home exists — ADR 0038), survey signal.
5. **Observability generation**: the monthly `obs-best-practices` compliance tables —
   drifted/superseded items, traffic-threshold status, deprecations.
6. **Ideas deferred upward**: `docs/ideas.md` lines the monthly reviews tagged "strategic".
7. **Open conflicts**: anything raised under the conflict rule and still unresolved.

Format: one markdown document, sections in this order, each ≤ one screen, links to sources.
The agenda checklist (vision audit → architecture audit → brainstorm → converge) follows it.
