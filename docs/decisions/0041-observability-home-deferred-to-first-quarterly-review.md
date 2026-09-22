# 0041 — The observability home is deferred to the first quarterly review, and the plan stops waiting on it

- **Date:** 2026-09-21
- **Status:** accepted — defers the open half of [0038](0038-new-dedicated-dynatrace-environment.md); **the review ran 2026-09-22 and re-deferred it, dated, in [ADR 0045](0045-observability-home-re-deferred-to-2027-01-review.md)**
- **Decided by:** owner (2026-09-21)
- **Source:** master plan blocker B1; ADR 0038's open action

## Context

ADR 0038 decided *what* the observability home should be — a new dedicated Dynatrace environment —
but standing it up was left as an owner action, and it became blocker **B1**: Steps 4, 7, 8, 10 and
parts of 9 and 11 were all parked behind it, which is half the remaining master plan.

It also created a circular dependency. B3 (the first quarterly review) was recorded as unable to
run before B1, because the evidence pack is meant to carry observability evidence. So the plan's
two largest blockers each waited on the other.

The owner's judgment is that standing up a new environment is not a mechanical setup task to be
squeezed in — it is a **cost and commitment decision** (which tenant, which licence, what it means
to run two Dynatrace environments plus Bluebox for a one-person company) and belongs on the
quarterly agenda with the other structural decisions, on evidence, rather than being done under
time pressure to unblock a checklist.

## Decision

**The observability-home decision moves to the first quarterly review as a named agenda item.**
The plan stops treating it as a blocker to clear and starts treating it as a decision to make.

Consequently the circle is cut in the other direction: **the first quarterly review runs without
observability evidence.** Its pack says so explicitly under "Missing evidence" rather than waiting
for evidence that, by this decision, cannot exist yet.

Convention introduced: an ADR whose **Status** line says `deferred — <which review>` is the queue of
standing decisions for that review. `quarterly-review`'s evidence pack collects them and the
agenda walks them. This one is the first entry; ADR 0038's open half is what it carries.

## Consequences

- Steps 4, 7, 8, 10 and the blocked parts of 9 and 11 are **parked until the quarterly review
  decides**, not merely waiting on a URL. The master plan's B1 row says so.
- **The dead RUM tag on levyam.com stays dead until then.** All Dynatrace RUM and bizevents have
  been gone since ~2026-08-12. GA4 and Meta still record the WhatsApp CTA, so the conversion
  funnel is not blind; what is lost is the homepage-only interaction signal (service interest,
  FAQ opens, language switch), which goes to Dynatrace alone
  ([ADR 0006](0006-ga4-carries-whatsapp-click-tier-separation-console-side.md)). Accepted
  knowingly; re-confirm at the review.
- **B2 gets more urgent, not less.** `quarterly-prep.yml` assembles the pack, and it cannot run
  without the `ANTHROPIC_API_KEY` secret. B2 now gates B3 alone.
- The quarterly review keeps its role as the gate into Phase 2 (ADR 0021). Phase 2 can open with
  the observability home decided but not yet built, provided the review says so explicitly.
- If the review decides against a new environment, ADR 0038 is superseded and H9's remaining
  phases are re-scoped or retired — which is a legitimate outcome, not a failure.
