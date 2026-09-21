# 0038 — A new dedicated Dynatrace environment becomes the observability home; the sprint environment is gone

- **Date:** 2026-09-14
- **Status:** accepted — supersedes ADR 0029 (observability home stays `pzh8968h.sprint`); amends ADRs 0030 and 0031 (their targets move with the home). **Standing the environment up is deferred — first quarterly review** ([ADR 0041](0041-observability-home-deferred-to-first-quarterly-review.md))
- **Decided by:** owner (closed questions at the M0.2 capability check, 2026-09-09; recorded 2026-09-14)
- **Source:** master execution plan M0.2 run; `docs/plans/observability-best-practices-adoption.md` M0 record

## Context

M0.2 could only run once the owner's interactive logins landed (2026-09-09). Its first read
against the working environment returned `404 EnvironmentDisabled` on every endpoint — the
sprint tenant `pzh8968h.sprint.apps.dynatracelabs.com` that H9 Phase 0 had verified on
2026-08-12 (124 `faq_open`, 59 `whatsapp_cta` … in a 7-day window; ~8 CTAs and ~27 sessions
a day) has been deactivated since. Consequences already live on production:

- The marketing RUM tag in `index.html` and `stories/_template.html`
  (`js-cdn.dynatracelabs.com/jstag/14868fa4215/bf37083dis/…_complete.js`) returns **404** on
  every page view. Dynatrace RUM and every `levyam.*` business event for the marketing funnel
  stopped at an unknown date after 2026-08-12. The site is unaffected (invariant 7 — telemetry
  is additive); the WhatsApp CTA still reaches Meta and GA4 through `js/wa-track.js`.
- The H9 Phase 0 baselines are history, not a tuning input, until a new environment has
  collected its own.

The second finding closed H9's open question 4 the wrong way: in Bluebox's environment
(`tgo73062`) the owner's dtctl token reaches nothing — SLOs (`missingScopes:
["slo:slos:read"]`), dashboards, workflows, buckets and Grail queries all return 403. There is no
write path and no read path; only `bluebox ask` (Bluebox's own service identity) works, and it
reported no spans for the three edge functions in the last 3 days, no SLOs, no deploy events —
low admin traffic may explain the zero, to be confirmed with a test invite on staging.

The owner was offered: reactivate the sprint tenant; consolidate into `tgo73062`; a new
dedicated environment; or pause the observability track.

## Decision

1. **A new dedicated Dynatrace environment is the observability home** for the marketing site
   (RUM + business events) and for the platform-side objects H9/H9.5 define (synthetic monitors,
   Davis detectors, SLOs, SRG, dashboards). The owner provisions it and hands over the
   environment URL; Claude Code creates the dtctl contexts (`levyam` readonly default,
   `levyam-write`) and the owner completes the interactive login, as in M0.1.
2. **Bluebox's environment stays what it is** — the edge-function trace sink, read through
   `bluebox ask` — until the owner obtains real permissions there. Anything H9 Phase 1 wanted to
   author *in* `tgo73062` (count/freshness SLOs, alert rules) is authored in the new home
   instead if the spans can be routed there, or deferred with a trigger ("Bluebox grants
   SLO/settings scopes") if not. ARCHITECTURE §6b's two-environment rule is unchanged in
   shape: two environments, both the owner's, still separate.
3. **The dead RUM tag stays in place until the new home exists** (owner decision): it is
   harmless to visitors and the replacement is a single Tier-A edit of the same two lines.
4. Step 4 (H9 Phase 1 + H9.5-B) and every later observability step **start from the new
   environment's own Phase 0**: re-verify capabilities (M0.2 verdict table), re-collect
   baselines for at least a week before tuning any detector threshold.

## Consequences

- ADR 0029's premise ("full access, unconstrained budget, the working environment stays") no
  longer holds; ADRs 0030 (Bluebox-env write access) and 0031 (capability confirmation) apply to
  the new home. The master plan's decision 15 is superseded, decision 16 is blocked on Bluebox
  permissions, decision 17 re-runs against the new tenant.
- Until the tag is replaced, the weekly report's analytics line for the marketing funnel comes
  from GA4 only; the ROADMAP marketing track notes the gap.
- Follow-up logged: confirm whether the edge functions still export spans (test invite on
  staging → `bluebox ask`); if not, the `OTEL_*` secrets on the Supabase projects need a look.
