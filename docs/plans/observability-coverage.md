# Observability coverage — everything watched, not just collected

*Kickoff 2026-08-12 · branch `observability-coverage` · was roadmap item **H9** (Phase 1.5)*

> **REMOVED from the roadmap — owner decision 2026-08-26.** This file is kept as reference
> only; no roadmap item tracks this work. If observability coverage is ever revived, start
> from here (Phase 0 was 2/3 done) but re-verify everything against the then-current stack.

## Why

H8 gave the platform its first telemetry, and the marketing site has carried RUM + bizevents
since launch — but **nothing watches any of it**. Bluebox confirmed (probe 2026-08-12): no
SLOs, no alerting rules, no deployment events in its environment; detection today is "someone
tells the owner." The deploy smoke-check runs once per deploy and never again. The platform
UI (`/app`) and `pos.html` emit nothing at all — a staff phone white-screening mid-service
produces zero signal ([`ErrorBoundary.tsx`](../../app-src/src/shell/ErrorBoundary.tsx) is
`console.error` only). And the layer where both real prod incidents lived — the money spine
and the grant surface (`post_day` revenue wipe; the 2026-08-05 owner-self-assignment drift) —
has no recurring check.

For a venue whose bookings arrive through ~12 WhatsApp CTAs, a dead CTA or a down site is
direct lost revenue with no detection path. That is the gap this initiative closes.

## Probe findings (2026-08-12, ground truth this plan builds on)

- **Bluebox (`tgo73062`):** three services reporting (`levyam-edge-admin-invite`,
  `-admin-user-ops`, `-passkey-verify`), 21 spans / 3 days, one error log (the H8 gate's own
  test invite). No SLOs, no alerts, no deploy events. Dashboard listing returns **403** —
  permissions gap in that env.
- **dtctl:** context `my-env` → `pzh8968h.sprint.apps.dynatracelabs.com`, safety
  `readwrite-all`, but **auth expired** (refresh session dead → `dtctl auth login` needed).
  Unconfirmed whether `my-env` is the environment receiving the marketing RUM
  (`bf37083…` in the `index.html` jstag URL) — mapping is Phase 0.
- **ARCHITECTURE.md §6b drift:** the doc says `app-src/` needs no instrumentation because
  "RUM already covers it" — false; no telemetry tag reaches the platform build
  (`assemble-site.sh` copies `app-src/dist/*` verbatim). Phase 2 makes the claim true
  instead of restating it.

## Tool best practices (probed 2026-08-12 — these shape every phase)

Asked of the tools themselves, not assumed. Bluebox answers in conversation
`conv_147q475WfNp30yZ5PYmMh6`; Dynatrace capabilities read from the env's settings schemas.

**Bluebox — what it is and isn't:**

1. **Bluebox does not author SLOs or alert rules** — it is read-only against its connected
   observability platform. SLO/alert objects are defined in its Dynatrace env (`tgo73062`);
   Bluebox contributes **Routines** (scheduled prompts, e.g. a weekly SLO-compliance check)
   and on-demand investigation.
2. **Rate-based SLOs are wrong at this volume** (single-digit requests/day): one failed
   invite among six requests reads as a 17% error rate. Best practice for low-traffic
   admin/auth functions: **count-based objectives** ("≤1 failed request per rolling 7d")
   **plus a freshness objective** ("≥1 successful request per 7d") so a silent service is
   never mistaken for a healthy one.
3. **Alert shape: outcome-count, not percentage** — "failed count > 0 in 24h" per service,
   plus a **zero-traffic-for-48h** rule; at this baseline, silent failure is the bigger risk.
4. **No deployment-marker API exists** (confirmed gap, not an assumption). Deploy
   verification = **timestamp-anchored before/after comparison**: a post-deploy
   `bluebox ask` anchored on the deploy time, or a post-release Routine.
5. **Telemetry gaps it named:** (a) no metrics signal at all — no RED trend/percentile
   analysis is possible; (b) **failure logs carry no structured fields** — the one H8-era
   failure record is a bare message, though H8 was designed to attach sanitized
   class/code attributes. That discrepancy must be verified and fixed (Phase 3).

**Dynatrace — native mechanisms this env supports (settings schemas confirmed):**

1. **Synthetic HTTP monitors with outage handling** (`builtin:synthetic.http.outage-handling`)
   — first-class uptime checks with built-in alerting. Use these for uptime, not hand-rolled
   workflow HTTP loops. (Not a dtctl resource; configured via UI/API and documented in the
   plan's runbook section.)
2. **Davis anomaly detectors** (`builtin:davis.anomaly-detectors`) — DQL-based alerting,
   manageable as **settings objects via `dtctl apply`** → the alert definitions live as
   reviewable YAML in this repo. Use these for CTA-dead / zero-traffic rules, not scheduled
   workflows.
3. **RUM is fully configurable here**: manual tag insertion, input masking / capture
   properties, XHR exclusion, and **frontend-backend linking**
   (`builtin:rum.web.frontend-backend-linking`) — the native path for Phase 3's
   `traceparent` correlation.
4. **Span-derived series replace SDK metrics**: DQL `makeTimeseries` over spans feeds both
   dashboards and Davis anomaly detectors — RED-style trends without reversing H8's
   "no per-invocation metric flush" decision.

## Locked scope (owner-aligned 2026-08-12, closed questions)

| Decision | Owner's call |
|---|---|
| Internal RUM | **`/app` only.** `pos.html` stays dark until its platform migration — coverage arrives with the migration, not before. |
| Alert delivery | **Alerts live inside Dynatrace and Bluebox** — fired as Dynatrace problems / Bluebox alerts, read in the platforms themselves. No external channel (email / push / WhatsApp) wired in this initiative. |
| Money-spine monitoring | **Reconciliation-as-monitor**: a scheduled edge function runs the finance reconciliation checks + a grant-drift probe and reports through the existing `_shared/otel.ts` → Bluebox. No new vendor. |
| Rollout | **One plan, phased PRs** — each phase its own PR through the full gate (+ staging where the diff qualifies). Phase 1 ships first. |
| Dev-loop practices *(owner-added 2026-08-12)* | **Production in the IDE + telemetry by default**: MCP/debug tooling wired into the development workflow so production is visible *while coding*, and AI-assisted development instruments new code as a default, never as an afterthought → Phase 5. |

**Explicitly out of scope:**

- `pos.html` RUM (owner decision above).
- External alert channels. *Accepted consequence: a problem nobody opens is still silent —
  the platforms are the pane of glass. Adding e-mail later is a small settings change,
  logged as a follow-up, not scope.*
- Supabase log drain (paid; noisier; would need its own PII scrubbing to satisfy invariant 3).
- Browser OTel → Bluebox — unchanged H8 owner decision. The browser story is Dynatrace RUM;
  **no browser telemetry reaches Bluebox.**
- Metrics export from the edge functions — still deferred from H8 (fragile flush, low value
  at this volume); dashboards read spans via DQL instead.
- Any change to GA4 / Meta Pixel — marketing analytics is not this initiative.

## Target coverage matrix

| Surface | Today | After H9 |
|---|---|---|
| Marketing + `/stories/` | RUM + bizevents collected, unwatched | + continuous uptime, CTA-dead alert, funnel dashboard |
| Platform `/app` | nothing | RUM + JS error reporting, correlated to edge traces |
| `pos.html` | nothing | *(unchanged — dark until migration, deliberate)* |
| Edge functions | traces + sanitized logs, unwatched | + count-based SLOs, outcome-count + zero-traffic alerts, deploy verification |
| Postgres / money spine | `core.audit_log` (identity tables only, forensic) | reconciliation-as-monitor cron + grant-drift probe |
| CI/CD | one-shot smoke check at deploy | deploy events → Bluebox baseline comparison |
| Dev loop (IDE) | CLIs + skills exist, used ad hoc | Dynatrace MCP wired, production-context step mandatory, instrumentation-by-default in the module template |

## Design constraints

1. **Invariant 3 extends to every new signal, not just Bluebox spans.** RUM configuration
   masks input capture; no user-entered text in custom action names. The reconciliation
   monitor reports **check name + pass/fail + counts only** — never row data, amounts tied
   to identifiable rows, or free text; its new `Facts` fields are deliberate allow-list
   additions in `_shared/otel.ts`, gated by `sanitize()` like everything else.
2. **Trust-domain honesty:** platform RUM error reports (class + message + component stack)
   go to the **owner's own Dynatrace environment** — same trust domain as `core.audit_log`,
   staff-only app. The Bluebox allow-list rule is untouched: no browser telemetry reaches
   Bluebox, and no error *message text* ever will (H8 rule, unchanged).
3. **No secrets in the browser** (invariant 2): the RUM tag is a public tag, like the anon
   key. Ingest tokens remain Supabase secrets only.
4. **Additive and never load-bearing** (invariant 7): every new sender no-ops when its
   vendor is absent; the reconciliation function is inert without `OTEL_*` secrets; a broken
   exporter degrades to "no telemetry", never a failed request or a failed check run.
5. **Tier separation is console-side, not code-side** — same rule CLAUDE.md sets for GA:
   staging is excluded via Dynatrace-side filtering (hostname/internal-traffic rules), never
   a hostname guard in the snippet. A domain change must not silently kill prod collection.

## Phases

### Phase 0 — unblock the tooling *(owner + agent, ~10 min, no PR)*

- [x] `dtctl auth login` (owner, interactive — agent cannot do this). *(done 2026-08-12,
      logged in as Or Cohen)*
- [x] Map environments: **`my-env` (`pzh8968h.sprint`) IS the marketing RUM environment** —
      confirmed 2026-08-12 by querying it directly: all `levyam.*` bizevents present
      (7-day window: 124 `faq_open`, 59 `whatsapp_cta`, 33 `service_interest`, 11
      `contact_intent`, 8 `language_switch`) plus 186 RUM sessions. No second Dynatrace
      context needed. Bluebox (`tgo73062`) stays separate per ARCHITECTURE.md §6b.
      **Also inventoried to avoid collisions: zero SLOs, zero Lev Yam workflows or
      dashboards in the env** (existing content is stock/demo) — Phase 1 starts clean.
      **Baseline for alert tuning: ~8 CTA clicks and ~27 sessions per day.**
- [ ] Fix the Bluebox dashboard-listing 403 (permissions in that env) — blocks Phase 4
      only; not a Phase 1–3 dependency.

### Phase 1 — watch the existing telemetry *(PR 1 — highest value, nothing new collected)*

- [ ] **Continuous uptime on prod — native Synthetic HTTP monitors** on the deploy
      smoke-check route list (`/`, `/app/`, `/stories/`, `/stories/ar/`, `/sitemap.xml`,
      `/facts.txt`, …), with outage handling on (built-in problem on failure). Configured
      via UI/API (not a dtctl resource); the exact monitor config is documented in this
      plan as the runbook so it stays reproducible.
- [ ] **CTA-dead + zero-traffic alerts — Davis anomaly detectors as YAML in this repo**,
      applied with `dtctl apply` (settings objects):
      * *CTA-dead:* RUM sessions ≥ N **and** zero `levyam.whatsapp_cta` over 24h →
        problem. Baseline for N: ~27 sessions/day, ~8 CTAs/day (Phase 0). Threshold tuned
        in the PR.
      * *Site-quiet:* zero RUM sessions over 24h — catches collection breakage (a dead
        RUM tag looks identical to a dead site from inside the env; the synthetic monitor
        disambiguates which it is).
- [ ] **Edge-function SLOs + alerts — defined in Bluebox's Dynatrace env (`tgo73062`),
      per Bluebox's own prescription** (it cannot author them itself):
      * *Count-based objective per service:* ≤1 failed request per rolling 7d — never a
        percentage at this volume.
      * *Freshness objective per service:* ≥1 successful request per rolling 7d — a silent
        service is not a healthy one.
      * *Alert rules:* failed count > 0 in 24h, plus zero-traffic-for-48h. Any rule
        touching `levyam.action` **must filter `levyam.outcome`** — the attribute records
        *attempted* actions pre-auth (H8 close-out), or rejected probes read as real
        privileged traffic.
- [ ] **Bluebox Routine — weekly health check**: scheduled prompt over the three services
      ("any failed requests in the last 7 days? any service with zero traffic?") — the
      Bluebox-side complement to the platform-side rules above.

### Phase 2 — platform UI coverage *(PR 2 — closes the biggest blind spot)*

- [ ] Dynatrace RUM tag in `app-src/index.html` (synchronous `<head>` placement, same
      rationale as the marketing tag) — **as its own RUM application**, separate from the
      marketing one, so staff traffic never pollutes the marketing funnel numbers and each
      app gets its own tuning. Staging exclusion console-side per constraint 5.
- [ ] Wire `ErrorBoundary.componentDidCatch` + `window.onerror` / `unhandledrejection` →
      `dtrum.reportError`, no-op guarded when RUM is absent (same pattern as the
      `wa-track.js` senders).
- [ ] RUM privacy config: input masking on, no user text in action names (constraint 1);
      XHR exclusion reviewed for the Supabase auth endpoints so tokens/credential flows
      never appear in action/resource capture.
- [ ] **Rewrite ARCHITECTURE.md §6b** so it is true: `/app` genuinely covered by RUM;
      `pos.html` exclusion stated honestly as "dark until migration, owner decision".

### Phase 3 — server-side depth *(PR 3)*

- [ ] **Reconciliation-as-monitor**: new scheduled edge function running (a) the finance
      module's reconciliation checks and (b) a grant/permission-drift probe — the
      2026-08-05 audit as a recurring check, not a one-off. Reports through
      `_shared/otel.ts` (new allow-listed `Facts` fields: check name, status, count);
      Bluebox alert on failure. Scheduling mechanism (Supabase cron vs. external trigger)
      decided in the PR. This is how Postgres gets watched without an agent — managed
      Supabase can't take one, and this is exactly the failure class that bit twice.
- [ ] **Verify + fix H8's log export**: Bluebox reports the one real failure log arrived
      as a **bare message with no structured fields** — but H8 shipped "sanitized log
      records" carrying error class/code. Reproduce, find where the attributes drop
      (log-record attribute wiring in `_shared/otel.ts` vs. export), fix, and confirm via
      `bluebox ask` that failure logs now carry class / code / trace correlation. The
      allow-list rule is unchanged — structured *fields*, never message text.
- [ ] **Trace correlation**: propagate `traceparent` from `/app` fetches into the edge
      functions so a RUM session joins its edge spans — request IDs are not PII; a
      deliberate allow-list addition, which is how `otel.ts` is designed to grow. Use
      Dynatrace's native **frontend-backend linking**
      (`builtin:rum.web.frontend-backend-linking`) on the RUM side.
- [ ] **H8 follow-up — `deno check` in `ci.yml`**: the hand-written structural types in
      `_shared/otel.ts` currently have no automated guard. May surface pre-existing type
      errors in other functions — budgeted here, in scope now (it was scope creep in H8).
- [ ] **H8 follow-up — rate limit `login/options`**: the remaining pre-auth amplification
      vector (Origin is forgeable outside a browser; each traced request costs an OTLP
      round trip).

### Phase 4 — deploy verification + dashboards-as-code *(PR 4)*

- [ ] **Deploy verification — timestamp-anchored, per Bluebox's confirmed mechanism** (no
      deployment-marker API exists): a post-deploy step in `deploy.yml` runs `bluebox ask`
      anchored on the deploy timestamp + commit SHA ("compare error rate and request
      volume for the three levyam-edge services in the 24h after `<deploy-time>` against
      the 24h before"), surfacing the verdict in the workflow log. Optionally a
      post-release **Routine** for the slower 24h-later check. Spans already carry
      `vcs.ref.head.revision`, so the SHA joins the comparison to the exact commit.
- [ ] Dashboards via `dtctl apply` (YAML in-repo, so they're reviewable and reproducible):
      marketing funnel (RUM + bizevents per `page_slug`), platform health (span-derived
      RED series — DQL `makeTimeseries` over spans, no SDK metrics), uptime board.
      Bluebox-side dashboards after the Phase 0 403 fix.

### Phase 5 — dev-loop integration: production in the IDE, telemetry by default *(PR 5, owner-added scope 2026-08-12)*

*Two practices the owner set: production insight while developing, not after deployment;
and instrumentation as a default of development, never an afterthought.*

- [ ] **Dynatrace MCP server in the repo's `.mcp.json`** so every Claude Code session in
      this repo can query the env (DQL, problems, RUM) directly while coding, alongside
      the already-present `dtctl` and `bluebox` CLIs. **Env-var placeholders only** — the
      repo is public; no token or env URL is ever committed (constraint: same
      secret-hygiene class as invariant 2). Verify the official server package + auth
      model in the PR.
- [ ] **Production-context step made mandatory in CLAUDE.md**: before designing any change
      to a live surface (edge functions, RUM-covered pages, the money spine), pull
      production context — the `production-query` skill (`bluebox ask`) and/or
      `dtctl query`. The skills already exist and auto-trigger; this makes them process
      instead of chance.
- [ ] **Instrumentation-by-default in MODULE-TEMPLATE.md** — new "Observability" checklist
      section: every new edge function ships wrapped in `traced()` with its `Facts` fields
      reviewed against the allow-list; every new module UI wires its error reporting;
      every new public page carries the vendor bootstrap per convention; every new schema
      considers a reconciliation/drift check. Telemetry lands **in the same PR as the
      feature, through the same gate** — never a follow-up.
- [ ] **CLAUDE.md standing rule** capturing the same one line: telemetry is part of
      "done" for any new surface.

## Architecture invariants check

- **Inv 1 (permissions DB-first):** N/A for signal wiring; the reconciliation function
  reads with the service-role key inside an edge function — the sanctioned location.
- **Inv 2 (secret hygiene):** holds — RUM tag is public-class; ingest tokens and
  service-role stay in Supabase secrets; nothing new reaches `VITE_*` or the repo.
- **Inv 3 (span allow-list):** holds and **extends** — see design constraints 1–2. New
  `Facts` fields are individually reviewed additions gated by `sanitize()`.
- **Inv 5 (bilingual twins) / mobile-first:** N/A — no user-facing surface changes.
- **Inv 7 (additive-only):** holds — every phase degrades to "no telemetry", never to a
  failed request; all senders no-op without their vendor.
- **§6b:** Phase 2 corrects the doc's false "RUM already covers it" claim; the
  two-environment separation (Dynatrace ↔ Bluebox) is preserved untouched.

## Vision check

Same honest framing as H8: **infrastructure ahead of Phase 2, not progress toward the dream
itself** — nothing here is seen by a staff member, member, or guest. Its justification is
Principle 7 (evolution, not revolution) plus one direct business line: the WhatsApp funnel
is how bookings arrive today, and Phase 1 is the first thing that would *tell* the owner
it broke. No conflict with VISION.md.

## Blockers & open questions

1. ~~dtctl auth expired + environment mapping unknown~~ — resolved 2026-08-12 (Phase 0):
   `my-env` is the marketing RUM env; no second context needed for it.
2. Bluebox dashboard 403 (Phase 0) — blocks Phase 4's Bluebox dashboards only.
3. ~~Synthetic monitor vs. scheduled workflow for uptime~~ — resolved by the best-practice
   probe: native Synthetic HTTP monitors for uptime; Davis anomaly detectors (settings
   YAML via dtctl) for signal-shaped rules. No hand-rolled workflow loops.
4. **Write access to `tgo73062` (Bluebox's Dynatrace env) for SLO/alert objects** — Bluebox
   is read-only there; Phase 1 needs the owner (or a dtctl context on that env) to create
   the count-based SLOs and outcome-count alert rules. Confirm access path before PR 1.
5. CTA-dead threshold/window tuning against real (low) traffic — in PR 1
   (baseline captured in Phase 0: ~8 CTAs, ~27 sessions/day).
6. Scheduling mechanism for the reconciliation monitor — in PR 3.
7. Where H8's log-record attributes drop (bare-message finding) — diagnosed in PR 3.

## Follow-ups (logged, not scope)

- External alert channel (e-mail/push) if platform-internal alerts prove too quiet in
  practice — small settings change once alert rules exist.
- `pos.html` observability arrives with its platform migration, not before.
- Metrics export from edge functions — revisit only if a hot path appears (Phase 2+ public
  ordering); the H8 note stands: the fix is a queue/collector, not per-invocation flush.
