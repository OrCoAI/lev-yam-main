# 0045 — The observability home is re-deferred to the 2027-01-01 quarterly review; the dated re-check list for that review

- **Date:** 2026-09-22
- **Status:** deferred — 2027-01-01 quarterly review — re-defers the open half of [0038](0038-new-dedicated-dynatrace-environment.md), carried in by [0041](0041-observability-home-deferred-to-first-quarterly-review.md)
- **Decided by:** owner (first quarterly review, agenda item 3, [issue #62](https://github.com/OrCoAI/lev-yam-main/issues/62))
- **Source:** issue #62 §8; owner's verdicts in session

## Context

ADR 0041 put the observability-home decision on this review's agenda and set the convention that a
deferral carries to the next review only with an explicit, dated re-deferral and a reason — "silently
carrying one to the next quarter is how a deferral becomes an evasion."

The evidence available: no working Dynatrace environment (sprint tenant deactivated; the Bluebox env
grants no scopes); the marketing RUM tag on levyam.com has returned 404 since ~2026-08-12; GA4 and
Meta still carry the WhatsApp CTA, so the conversion funnel is measured; edge-function spans reach
Bluebox (unconfirmed at low traffic). H9 Phases 1–5 and H9.5 A–F are parked on this decision.

## Decision

**Re-deferred, dated: the 2027-01-01 quarterly review.** The owner's reason, verbatim:

> Marketing is the quarter; observability competes for the same hours.

and, on the quarter bets: *"Let's skip everything related to observability to later on, it is not a
blocker for now."*

What this means concretely for the quarter:

- Steps 4, 7, 8, 10 (except its docs carve-out) and the parked parts of 9 and 11 **stay parked**.
  No Dynatrace environment is stood up; no licence decision is taken.
- **The dead RUM tag stays dead**, knowingly, for one more quarter. The marketing quarter's
  measurement is GA4 + Meta + Search Console + Ahrefs/Semrush ([ADR 0046](0046-q4-2026-mandate-marketing-quarter.md),
  initiative #1), not RUM.
- Bluebox tracing on the edge functions (H8, live) is untouched.
- Step 9's unblocked half (`deno check`, the `login/options` rate limit) needs no Dynatrace and is
  ordinary roadmap work.

## The 2027-01-01 re-check list

The next review's evidence pack must carry these, and the agenda decides each:

1. **The observability home** — build a dedicated Dynatrace environment, retire H9 and re-scope
   around GA4/GSC/Bluebox, or defer again *with a reason the marketing quarter produced* (e.g. GA4
   proved insufficient for a named question).
2. **`@simplewebauthn/server`** — pinned `^10.0.0` in `supabase/functions/passkey-verify`; npm latest
   14.0.2 on 2026-09-22. Deno-imported, so dependabot never sees it. Decide: bump (Tier A, passkey
   register + login re-test on staging) or defer again. *Owner: "Defer with a date."*
3. **`CLAUDE_CODE_OAUTH_TOKEN`** regeneration ([ADR 0042](0042-agent-workflows-run-on-the-subscription-token.md)).
4. **Break-glass account** — email confirmation verified, or still unknown (roadmap item).

## Consequences

- ADR 0038 stays accepted-but-unbuilt; its Status line now points here.
- `quarterly-prep.yml`'s "deferred decisions due" section will find this ADR by its Status line.
- If, during the quarter, a marketing outcome cannot be measured with GA4/GSC/Ahrefs — that is the
  queue-jumper for this decision, raised the day it is found, not held for January.
