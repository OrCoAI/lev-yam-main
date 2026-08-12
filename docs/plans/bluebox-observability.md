# Bluebox observability — edge-function tracing

**Status:** in implementation (2026-08-12) — all kickoff blockers resolved, scope locked
**Branch:** `bluebox-observability`
**Roadmap home:** Phase 1.5 — Platform hardening (new item **H8**; see [ROADMAP.md](../ROADMAP.md))

## Why

The platform has **no observability of its own**. `docs/ROADMAP.md` and `docs/ARCHITECTURE.md`
contain zero mentions of monitoring, telemetry, or logging — the Dynatrace RUM tag and business
events in `js/app.js` cover the **marketing site only**. Everything server-side the platform
owns — the Supabase edge functions that run invites, user administration, and passkey
verification — is observable only through Supabase's own function logs, which are ephemeral,
per-invocation, and not correlated across a request.

That gap has cost real money already. The `admin-user-ops` / `core` surface is where the
pre-commit gate has repeatedly found live security holes (a PUBLIC-execute self-grant-owner
escalation; a cascade-aware last-admin lockout). Those were caught by review, not by
production signal — because there is no production signal.

## What Bluebox is here

**Bluebox** is an "AI SRE" CLI installed on the owner's machine 2026-08-03 (`~/.bluebox/bin/bluebox`).
It ingests OpenTelemetry into a Dynatrace-backed environment and answers questions about live
service behaviour via `bluebox ask`. Setup is complete: GitHub linked (`OrCoAI`), agent skills
installed per-repo, scan root deliberately limited to this repo.

**Two separate environments, both the owner's, both staying:**

| Environment | Holds | Source |
|---|---|---|
| Or's own Dynatrace env | Marketing-site RUM + business events | `index.html` RUM tag, `js/app.js` |
| **The Bluebox env** | **Platform edge-function traces (this initiative)** | `supabase/functions/*` |

These are not merged and not intended to be. The Meta/Dynatrace bizevent split described in
`CLAUDE.md` is untouched by this work.

## Locked scope (owner-aligned 2026-08-03)

**In scope — instrument the four edge functions:**

| Function | What it does | Why trace it |
|---|---|---|
| `admin-invite` | Creates + emails user invitations | Silent invite failures are invisible today |
| `admin-user-ops` | Delete / deactivate / set-password / confirm-email | Highest-privilege surface in the platform |
| `passkey-verify` | WebAuthn assertion verification | Auth failures are currently undiagnosable |
| `_shared` | Common helpers | Shared span/context plumbing lives here |

**Explicitly out of scope:**
- **Browser/SPA OTel.** `app-src/` is a browser app; OTel there would duplicate the RUM data
  Or's own Dynatrace already collects. Not doing it.
- **Marketing site.** Untouched. The existing Dynatrace + Meta Pixel split stays exactly as is.
- **Supabase Postgres.** Managed service, not ours to instrument.
- **Any change to business logic.** This initiative adds telemetry and nothing else. If
  instrumenting reveals a bug, it gets its own item — it does not get fixed inside this diff.

## The central design constraint — PII

`docs/ARCHITECTURE.md` invariant 3: **"No PII, secrets, or signatures in this (public) repo."**
Invariant 2: **service-role only in Edge Functions, never in the repo.**

The three functions being traced handle the most sensitive data on the platform: invitee email
addresses, user identifiers, password-set operations, and WebAuthn credential material. Naive
auto-instrumentation captures request bodies, headers, and URLs — which would ship all of that
into telemetry.

**Rules for this initiative, non-negotiable:**

1. **Attribute allow-list, never a deny-list.** A span carries only attributes explicitly
   chosen here. Nothing is captured by default.
2. **Never as span attributes:** email addresses, display names, phone numbers, passwords or
   reset links, WebAuthn credential IDs / public keys / challenges, JWTs, the service-role key,
   any request or response body.
3. **Allowed:** action name (`delete_user`, `confirm_email`, …), outcome (`ok` / `denied` /
   `error`), error *class* (not message text, which can embed an email), duration, and the
   **caller's role** — not their identity.
4. **User references, if needed at all,** are the opaque `auth.uid()` UUID only — never an
   email — and only where it is genuinely required to correlate a failure.
5. **The ingest token is a secret.** It lives in Supabase function secrets
   (`supabase secrets set`), never in `.env.otel.bluebox-template`, never in the repo. The repo
   is public; `.env.otel.bluebox-template` is git-ignored as of this branch.

## Architecture invariants check

| # | Invariant | Verdict |
|---|---|---|
| 1 | RLS on every table; UI gating never the only gate | **N/A** — no schema, no tables, no policies in this initiative |
| 2 | Anon keys in browser/repo; service-role only in Edge Functions | **Holds** — ingest token treated as service-role class: Supabase secrets only |
| 3 | No PII/secrets in the public repo | **Governs the whole design** — see rules above; the primary risk of this work |
| 4 | Business invariants in Postgres | **N/A** — no business logic changes |
| 5 | HE + AR for anything user-facing | **N/A** — telemetry is operator-facing, not user-facing; no UI strings |
| 6 | Public content tables carry a visibility flag | **N/A** — no content tables |
| 7 | Live tools keep working until parity | **Holds** — additive only; functions must behave identically with telemetry disabled |
| 8 | ROADMAP.md is the single tracker | **Done** — added as H8 |

**No conflicts found.** This initiative adds a capability the architecture doc simply does not
address. Once it lands, `ARCHITECTURE.md` should gain an observability section so the platform's
telemetry posture is documented rather than tribal — tracked as a follow-up below.

## Vision check

`docs/VISION.md` is a product vision — three circles (Operate / Create / Join), community as
creators, one login, bilingual, public by default. Observability appears nowhere in it, and
**that is correct**: this is infrastructure, not product.

The honest verdict: **this serves the vision indirectly, not directly.** It builds nothing a
staff member, community member, or guest will ever see. Its justification is Principle 7
("Evolution, not revolution" — live operations keep working) and the platform's trajectory into
Phases 2–4, where bookings, event signup, and public ordering put **outside users** on
platform-owned server code for the first time. Flying blind is tolerable now; it will not be
then. Building the telemetry habit before public traffic arrives is cheaper than retrofitting it
during an incident.

**No conflict with the vision.** But it should be understood as paying down infrastructure debt
ahead of Phase 2 — not as progress toward the dream itself.

## Owner decisions — 2026-08-12

| Question | Decision |
|---|---|
| Telemetry level | **Traces + sanitized logs.** Log records *are* exported to Bluebox, but carry error **class/code only** — never message text. Metrics deferred (edge isolates make per-invocation metric flush the most fragile signal for the least value here). |
| Verification path | **Staging first.** The deferred "deploy edge functions to `lev-yam-staging`" task is pulled into this initiative as a hard dependency, per the mandatory staging-verification rule in `CLAUDE.md`. |
| Ingest token | Set by the owner via `supabase secrets set` on **both** the staging and prod projects. Never seen by the agent, never in a tracked file. |

## Blocker resolution

1. **Ingest token** — process settled (owner sets it directly on both projects; see above).
2. **Deno OTel mechanism — RESOLVED 2026-08-12 by probing a running local stack**, not by
   reading docs. Both prior assumptions turned out to be wrong, in opposite directions:
   - The runtime is `supabase-edge-runtime-1.74.1 (compatible with Deno v2.1.4)`. **`Deno.telemetry`
     is `undefined` and `OTEL_DENO` is unset** — Deno 2's built-in OTel is *not* exposed by the
     Supabase edge runtime. So the feared auto-instrumentation-captures-everything default is not
     a risk here; there is simply nothing to opt out of.
   - Contrary to published claims that the OTel npm packages "fail to initialize" under Supabase
     Edge, they **work** — via `npm:` specifiers at **exact version pins**. A span and a log record
     were built, encoded, and delivered to a local sink as `application/x-protobuf` end to end.
   - **Version pins are load-bearing.** Bare major constraints (`npm:@opentelemetry/api@1`) fail
     with `Could not find constraint … in the list of packages`, and
     `@opentelemetry/semantic-conventions` and `@opentelemetry/core` fail to resolve *even pinned*.
     Attribute keys are therefore written as string literals rather than imported semconv
     constants — which also satisfies the skill's minimize-dependencies rule.
   - **`forceFlush()` resolving does NOT prove delivery.** The OTLP exporter swallows transport
     failures; a flush against a dead port resolved cleanly while nothing arrived. Delivery must
     be confirmed at the receiving end, never from the sender's return value.
3. **Staging edge functions — NOT ACTUALLY A BLOCKER; the kickoff was wrong.** This plan claimed
   "staging has NO edge functions at all", citing the `DEFERRED` line in
   [platform-staging-environment.md](platform-staging-environment.md). That line was superseded
   the same day by that plan's own *"Completed after the first close-out pass (2026-07-28)"*
   section: all three functions were deployed with `--use-api` and have been **ACTIVE on
   `lev-yam-staging` since 2026-07-28**. Verified against the live project on 2026-08-12 via the
   management API, not by re-reading the doc. So staging-first verification has no prerequisite
   work — this is a redeploy, not a first deploy.

   **Lesson worth keeping:** a plan that quotes another plan's status inherits it at the moment of
   writing and never updates. Check the live system, not the sibling doc.

   **Config drift found while checking (fixed by this initiative's redeploy):** staging's
   `admin-invite` was running `verify_jwt=true` while prod runs `false` — so the Supabase gateway
   was rejecting unauthenticated calls before the function's own auth logic ran, and staging was
   *not* faithfully mirroring prod on exactly the path this diff instruments. Both other functions
   already matched. Redeploy all three with `--no-verify-jwt`.
4. **Skills in the repo — RESOLVED.** Committed on this branch (`b387ba4`). The `.gitignore` rule
   later widened to `!.claude/skills/**` when `main`'s verify-skill rule merged in, so a new skill
   is now tracked automatically instead of needing its own negation line.

## Rollout

1. Resolve blockers 1–3 above.
2. Wire `_shared` tracing helper + per-function spans, behind an env flag so telemetry can be
   switched off without a redeploy.
3. Full pre-commit gate (`/simplify`, `/code-review high`, `/security-review`, `/verify`) —
   the security review is the important one here: its job is to confirm no PII reaches a span.
4. Deploy to staging if blocker 3 is resolved that way; verify traces arrive in the Bluebox env.
5. Prod deploy + confirm `bluebox ask` returns real answers about the functions.
6. Close-out per `CLAUDE.md`, and add the observability section to `ARCHITECTURE.md`.

## Follow-ups discovered

- `ARCHITECTURE.md` has no observability/telemetry section — add one once this lands.
- **Nothing in CI type-checks `supabase/functions/`.** `ci.yml` covers `app-src` only, and
  `supabase functions deploy` transpiles without type checking — so the hand-written structural
  types in `_shared/otel.ts` (`Span`, `Providers`) have no automated guard. They were verified by
  hand against the real SDK during the gate, but a future edit is unprotected. Adding `deno check`
  to `ci.yml` was deliberately kept out of this diff: it may surface pre-existing type errors in
  the other functions, and turning CI red on an unrelated axis mid-initiative is scope creep.
- **Provider init is awaited before the handler runs** (`otel.ts`), so a cold isolate pays the
  module-load cost serially in front of the request instead of alongside it. Parallelising the
  imports captured most of the win; moving init fully off the critical path needs `startSpan`'s
  `startTime` plumbed through, and was judged too risky to add late in a file where three subtle
  lifecycle bugs had already been found.
- **`levyam.action` records an *attempted* action, before authentication.** Any alert built on it
  must also filter `levyam.outcome`, or rejected probes read as real privileged traffic. Documented
  in `supabase/README.md`; worth revisiting if it proves noisy in practice.
- **The origin gate is a CSRF boundary, not an auth one.** `Origin` is forgeable outside a browser,
  so a determined caller can still reach the traced path on the pre-auth `passkey-verify` actions
  and make us do an OTLP round trip. Real mitigation would be rate limiting on
  `login/options` — out of scope here, but it is the remaining amplification vector.
