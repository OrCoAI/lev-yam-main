# 0013 — Platform telemetry: two Dynatrace environments stay separate; span attributes are an allow-list; telemetry is additive and never load-bearing

- **Date:** 2026-08-12
- **Status:** accepted
- **Decided by:** owner + Claude Code (kickoff / close-out of roadmap H8)
- **Source:** `docs/ARCHITECTURE.md` §6b "Observability"; `docs/plans/bluebox-observability.md` (PII rules, owner decisions 2026-08-12, close-out)

## Context

Roadmap H8 gave the platform its first telemetry of its own: OpenTelemetry traces from the three
Supabase Edge Functions (`admin-invite`, `admin-user-ops`, `passkey-verify`) into the owner's
Bluebox environment. Those functions handle the most sensitive data on the platform (invitee
emails, password-set operations, WebAuthn material), and the repo is public. The marketing site
already reported RUM and business events to the owner's separate Dynatrace environment.

## Decision

The three rules, quoted from `docs/ARCHITECTURE.md` §6b:

> **Two environments, deliberately separate, both the owner's.** Dynatrace RUM + business events
> cover the **public marketing site** (`index.html`, `js/wa-track.js`, `/stories/`). The **Bluebox**
> environment holds **platform edge-function traces**. They are not merged; the Meta/GA4/Dynatrace
> split described in `CLAUDE.md` is untouched by platform telemetry.

> **The rule telemetry lives under — invariant 3 applies to spans, not just the repo.** A span
> carries an **allow-list** of attributes, never a deny-list: action, step, permission key, outcome,
> error *class* and a charset-restricted error *code*, duration, HTTP method/status. Never an email,
> password, token, WebAuthn credential, or **any error message text** — an invite failure message
> embeds the invitee's address. This is enforced by the wrapper (`supabase/functions/_shared/otel.ts`),
> not by call-site discipline [...] Adding a field is a decision, not a convenience.

> **Telemetry is additive and never load-bearing.** With no `OTEL_*` secrets the SDK is never even
> imported and the functions behave exactly as before (invariant 7). A broken exporter degrades to
> "no telemetry", never to a failed request — but never *silently*: initialization and emit failures
> log once to Supabase's own function logs, because "no spans" and "no traffic" are otherwise
> indistinguishable.

Owner decisions at kickoff: traces + sanitized logs (error class/code only), metrics deferred;
staging-first verification; the ingest token set only via `supabase secrets set`, never in a file.

## Consequences

- `app-src/` is deliberately not instrumented (RUM covers it; an ingest token must never reach a
  `VITE_*` variable). Postgres is a managed service, not instrumented.
- `report()` accepts a fixed type and `sanitize()` gates every value including the span name;
  the close-out verified zero `@` characters in captured OTLP payloads after a real invite.
- Any new span attribute is a decision to record here, not a convenience.
- `levyam.action` records what was attempted before authentication; alerts must also filter
  `levyam.outcome`.
