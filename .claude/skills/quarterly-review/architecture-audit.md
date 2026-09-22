# Architecture audit — checklist

Walk `docs/ARCHITECTURE.md` §7 invariants against everything shipped this quarter, then the
standing items below. Findings become ADRs, module-log items, or plan files — the audit
itself decides nothing.

## Invariants (1–8) — evidence per invariant
1. RLS on every table; UI never the only gate — new tables this quarter with policies?
   `rls_matrix.sql` extended for each? Grant audit (`audit-grants.mjs`) green on both tiers?
2. Anon keys only in browser/repo; service-role only in Edge Functions — any leak candidates?
3. No PII/secrets/signatures in the public repo — grep pass on the quarter's diffs; span
   allow-list (§6b) still enforced by `otel.ts`? OpenPipeline masking in place (H9.5-C)?
4. Business invariants in Postgres — any rule that lives only in the client?
5. HE + AR everywhere, RTL correct — strings added without the twin? story pages twins?
6. Visibility flag on public content tables — new content tables this quarter?
7. Live tools keep working until parity — anything retired early?
8. ROADMAP is the single tracker — items done but unticked, or tracked elsewhere?

## Standing items
- **Tech-debt inventory**: open follow-ups across `docs/plans/*` ("Follow-ups" sections) and
  `docs/modules/*` open bugs; which grew, which got paid.
- **Security checklist (quarterly, permanent)**: `@simplewebauthn/server` (Deno, not watched
  by dependabot) release check; `disable_signup` still true on prod + staging; break-glass
  account still works (email confirmed); prod grant audit 0 drift; secrets rotation needs?
- **Capacity**: what breaks at 5× usage — POS realtime, finance report queries, the free tier?
- **Ceremony audit**: gate + tiers proportionate? Harness-health trend (time-to-merge by tier,
  rework, queue depth) → propose tier promotions/demotions and whether the deferred AI
  pre-review (ADR 0034) is now warranted. Skill evals (`.claude/skills/*/EVALS.md`) run this
  quarter — any drift?
- **Observability generation**: summarize the monthly `obs-best-practices` audits; count
  switchover thresholds (count-based → rate-based SLOs); deprecations with dates.
- **Delivery rails** (§6c): branch protection still as documented; required checks `build`
  + `tier` still enforced; permissions file (`.claude/settings.json`) diff since last quarter
  reviewed by the owner.
