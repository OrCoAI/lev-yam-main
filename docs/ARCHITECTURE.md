# Lev Yam Platform — Architecture Overview

How the app is built and why, through five lenses: **security**, **mobile-first**,
**easy login & permissions**, **scalability**, and **flexibility**. Companion to
[VISION.md](VISION.md) (why we build) and [ROADMAP.md](ROADMAP.md) (what's next).

## 1. The system at a glance

```
                        levyam.com  (GitHub Pages, static hosting, no server of ours)
        ┌───────────────────────────────┬──────────────────────────────────┐
        │  PUBLIC (no build, no login)  │  PLATFORM  /app  (login)         │
        │  index.html  marketing HE/AR  │  Vite + React 18 + TS SPA        │
        │  survey-june.html             │  shell: login/passkeys/launcher  │
        │  pos.html (until migrated)    │  modules: users, finance,        │
        │  + "What's happening" (Ph.2)  │    quotes → pos → bookings → …   │
        └───────────────┬───────────────┴───────────────┬──────────────────┘
                        │ anon key (public by design)    │ anon key + user JWT
                        ▼                                ▼
        ┌─────────────────────────────────────────────────────────────────┐
        │  SUPABASE (one project: lev-yam)                                │
        │  Auth (email+password, WebAuthn passkeys)                       │
        │  Postgres — one schema per module:                              │
        │    core (identity, RBAC) │ pos │ finance │ quotes │ bookings…   │
        │    RLS on every table — THE security boundary                   │
        │  Edge Functions (service-role lives ONLY here: passkey-verify…) │
        │  Storage (private buckets: signed contracts, signature)         │
        └─────────────────────────────────────────────────────────────────┘

        Deploy: push to main → GitHub Action builds app-src → bundles with
        static site → Pages. No staging; verify locally first.
```

Two frontend surfaces, one backend, zero servers of our own. The public site stays
no-build HTML/CSS/JS forever (fast, unbreakable, editable in place); everything
interactive lives in the platform SPA. Supabase is the single backend: database, auth,
file storage, and the only place privileged code runs.

## 2. Security

**The trust model in one sentence: the browser is untrusted, Postgres RLS is the law.**

- **The anon key is public by design.** It's shipped in every page. It grants nothing by
  itself — every table has Row Level Security, and every policy checks
  `core.has_permission('<module>.<action>')` (or ownership) against the *authenticated
  user's* JWT. UI checks (`RequirePermission`, `useCan`) are convenience mirrors only;
  removing them would change nothing about what a user can actually read or write.
- **The repo and the deployed site are public.** Therefore: no PII, no secrets, no
  customer data, no signatures in git — ever. That's why the quotes app must never be
  copied in (its data goes to Postgres/RLS + private Storage during migration, and its
  file backup lives in the separate **private** repo `OrCoAI/lev-yam-quotes`).
- **Privilege separation.** The service-role key exists only inside Supabase Edge
  Functions (e.g. `passkey-verify`) — never in the repo, never in the browser, never in
  `.env` files. CI has exactly two secrets (Supabase URL + anon key), both safe to leak.
- **Sensitive artifacts get the strictest storage.** Signed contracts (legal documents)
  and the owner's signature go to private Storage buckets / permission-gated settings
  rows readable only via `quotes.settings`-class permissions. Money visibility follows
  the same rule: finance data is owner+manager only, and initiative budgets (Phase 3)
  get **per-initiative row-level grants** — finer than role→module→action, designed in
  RLS before any UI exists. One known escape by design: generated contracts snapshot
  the owner's signature into `contracts.content`, readable at `quotes.view` — keep that
  permission owner+manager-scoped (or split the snapshot) before ever widening it.
- **Invariants live in the database, not in app code.** One contract per quote = UNIQUE
  FK. Signed = immutable = trigger. One-way date stamps = trigger. A buggy or malicious
  client cannot violate them.
- **Auditability.** Signing captures who/when/IP/user-agent; tables carry timestamps;
  auth events live in Supabase Auth logs.
- **What robots.txt is not.** `/app` and `pos.html` are excluded from crawlers, but
  that's etiquette, not security — the login + RLS are the actual gate.
- **Backups.** Code: git/GitHub. Data: Supabase automated backups (verify PITR tier as
  data grows). Legacy quotes app: the private backup repo.

## 3. Easy login & permissions

**Login philosophy: one tap for the people who use it daily.**

- **Passkeys first** (Face ID / Touch ID via WebAuthn, discoverable credentials — no
  email typing on login). Implemented with `@simplewebauthn`; the `passkey-verify` Edge
  Function verifies assertions and mints a session. Passkeys are per-origin (enrolled
  for levyam.com) and phishing-resistant — stronger *and* easier than passwords.
- **Email + password fallback** for first login, new devices, and recovery.
- **Sessions persist** (Supabase refresh tokens) — staff aren't re-authenticating every
  shift; opening `/app` on your phone just works.
- **Planned:** per-user quick-PIN for the shared POS tablet (fast user switching mid-
  service), and team-invitation onboarding for community members (Phase 3 — invite-only
  at first, request→approve later, per the vision).

**Permissions: role → module → action, one system for everything.**

- `core.roles` (owner / manager / staff / viewer — **member** joins in Phase 3) ×
  `core.permissions` (`'<module>.<action>'`) via `core.role_permissions`; users map in
  `core.user_roles`. The DB enforces via `core.has_permission()` inside RLS policies.
- The UI mirrors it: `core.my_permissions()` loads once into the auth context;
  `useCan(PERM.x)` / `RequirePermission` gate rendering; permission keys are constants
  in `lib/permissions.ts`, mirroring the SQL seeds.
- **The launcher is permission-driven data, not code:** `core.my_modules()` returns only
  the modules the signed-in user may see — a waiter, a manager, and (later) a community
  member open the same app and see different worlds.
- **Two extension points already designed for:** new roles are rows (adding `member`
  touches no auth code), and per-record access (initiative teams, initiative budgets)
  layers membership tables + RLS on top of the same model.

## 4. Mobile-first

The platform's real users hold phones (staff mid-service, members in the village), with
one tablet at the POS. Therefore:

- **Design for the phone screen first**; desktop is the enlargement, not the target.
  Big touch targets, one primary action per screen, thumb-reachable controls.
- **RTL is the default reality** — Hebrew and Arabic both. Layouts are RTL-native, and
  the i18n layer (Phase 1, first task) makes language a runtime switch, not a rebuild.
  Lesson already learned in production: native date inputs + RTL need explicit handling
  (see the POS mobile fixes in git history).
- **Fast on village networks:** static public site, self-hosted font subsets (no CDN
  calls), optimized images. The SPA code-splits per module (`React.lazy` per route) as
  modules accumulate, so the POS tablet doesn't download the finance module.
- **Verify on a phone before shipping** — localhost testing includes a mobile viewport
  pass (and real devices for anything touch-heavy like the POS).
- **Future options when needed, not before:** PWA installability (home-screen icon,
  offline shell) and an offline-tolerant POS queue are roadmap candidates once the POS
  module is inside the platform.

## 5. Scalability

Scale here means two different things, and the architecture answers both:

- **Load scale (easy):** a village venue produces hundreds of quotes and thousands of
  POS bills a year — trivial for Postgres. The static site is CDN-served by GitHub
  Pages. Supabase grows vertically (plan upgrade) long before any redesign is needed.
  Hot paths use RPCs (one round-trip) instead of chatty queries; indexes ride on the
  natural keys (quote_number, event dates, bill timestamps).
- **Surface-area scale (the real one):** the dream adds *modules*, not traffic. That's
  what the architecture optimizes for:
  - one Postgres schema per module → blast radius of a change is one schema;
  - one folder per module + one route + a `core.modules` row → the app shell never
    changes when a module lands;
  - permission seeds per module → RBAC grows by INSERT, not refactor;
  - the module template (Phase 1 deliverable) → "new module in ~1 hour" stays true.
- **Cost floor:** GitHub Pages is free, Supabase free tier carries the current load —
  the platform scales *down* gracefully too, which matters for a social business.
- **Known consolidation debt** (tracked, not urgent): the survey lives in a second
  Supabase project to be merged eventually (POS tables moved from `public` into their own
  `pos` schema at cut-over, 2026-07-14). End state: one project, schema-per-module
  throughout.

## 6. Flexibility — the architecture of the dream

The vision's hardest requirement — *"the community creates their own work, it must be
flexible"* — maps to specific structural choices:

- **Everything is a module** (code-level flexibility): capabilities plug into the shell
  via data (`core.modules`) + a folder + a route. Nothing about the shell assumes which
  modules exist.
- **Initiatives are data, not code** (community-level flexibility): a member's new dream
  becomes *rows* — an initiative record, its team, its events, its budget line — never a
  developer task. The initiative workspace is one generic UI serving infinitely many
  ideas; categories are illustrations, not enum values.
- **Document-shaped data is jsonb** (quote line items, agendas, prep checklists,
  contract clause snapshots): structure can evolve per-record without migrations, while
  lifecycle fields stay relational and constrained.
- **Owner-editable settings live in the DB** (default checklists, contract clauses,
  quote defaults): the team tunes the system from the app, without deployments.
- **Shared spines, not silos:** one events/calendar backbone that quotes, initiatives,
  and public pages all feed; one finance journal with provenance that every module posts
  into; one preparation model attached to events; one identity + permission system for
  staff, members, and guests; one visibility convention (public by default, `internal`
  opt-out) on every content table from its first migration. The full spine design —
  event projection, posting rules, expected money, business-day settlement, and the
  "database is the bus" integration rules — is
  [plans/cross-module-foundation.md](plans/cross-module-foundation.md).
- **Evolution, not revolution:** every migration runs the old tool and the new module
  side by side until parity is proven (quotes → then POS), so flexibility never costs
  operational continuity.

## 7. Invariants — the rules that must never break

1. RLS on every table; UI gating is never the only gate.
2. Anon/publishable keys only in the browser and repo; service-role only in Edge Functions.
3. No PII, secrets, or signatures in this (public) repo — including generated documents.
4. Business invariants (uniqueness, immutability, one-way stamps) enforced in Postgres.
5. Both languages (HE + AR) for anything user-facing; RTL correct in both.
6. Public content tables carry a visibility flag; public means *chosen*, internal means *marked*.
7. Live tools (`pos.html`, the local quotes app) keep working until their module replacement
   proves parity in real use.
8. `docs/ROADMAP.md` is the single task tracker; update it every session.
