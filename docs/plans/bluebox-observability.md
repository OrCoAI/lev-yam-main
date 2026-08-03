# Bluebox observability — edge-function tracing

**Status:** kickoff (2026-08-03) — aligned with owner, no instrumentation code yet
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

## Open questions / blockers

1. **Ingest token — BLOCKING.** Only available in the owner's Bluebox workspace UI. Nothing can
   be wired or verified without it. It must be set as a Supabase secret, not committed.
2. **Deno OTel mechanism — needs verification before code.** Supabase Edge Runtime is Deno-based;
   recent versions ship built-in OTel support, which would be far cleaner than bundling
   `@opentelemetry/*` via npm specifiers into every function. **To be confirmed against the
   deployed runtime version before choosing an approach** — not assumed.
3. **Staging cannot verify this yet.** Per the staging close-out, deploying edge functions to
   `lev-yam-staging` is an **explicitly deferred follow-up** — staging has no edge functions at
   all. So the normal "staging first, then prod" path is unavailable for exactly this surface.
   Either that deferred task gets done first (preferred), or verification happens against the
   local Supabase stack and then straight to prod (weaker). **Owner decision required.**
   Note: `supabase functions deploy` fails with an opaque `Effect.tryPromise` error on this
   machine — use `--use-api`.
4. **Skills are invisible to the repo.** The four Bluebox skills installed by
   `bluebox setup local-repos` live in `.claude/`, which is git-ignored (`.gitignore:10`). They
   exist on one machine and vanish on `git clone`. If Bluebox is to be a project pillar rather
   than one person's local tool, this needs a decision: commit the skills, document an install
   step, or accept it as local-only. **Owner decision required.**

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
- Deploying edge functions to staging (inherited from the staging close-out) is now a
  **dependency** of safe verification here, not just a nice-to-have.
