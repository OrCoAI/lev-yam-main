# Users & permissions suite — module features + remaining hardening

**Initiative plan** (kickoff 2026-07-15). Bundles the users-module feature ideas logged in
[modules/users.md](../modules/users.md) with the remaining Phase 1.5 hardening items that
protect the new surface: **H1** (RLS regression suite + drift check), **H4** (RLS initplan
sweep), and the **H7 remainder** (6 hygiene items) from
[platform-hardening.md](platform-hardening.md).

## Alignment decisions (owner Q&A, 2026-07-15)

- **Hardening scope:** H1 + H4 + H7-remainder in; **H2 stays deferred** (owner decision
  Q2, roadmap unchanged); **H6 stays out** (finance-scoped, separate).
- **View-as = permission preview, not impersonation.** The UI renders with the target
  user's permission set (launcher, nav, gated controls); all data reads stay under the
  owner's own session/RLS. No new auth surface.
- **Built-in roles fully editable** — "update everything in the UI." The existing
  last-admin guard + audit log are the safety net (they cover exactly these tables).
- **Per-user permissions stay derived via roles** — the by-user view is read-only
  effective permissions; no per-user override table.
- **Delivery: one plan, three PRs**, each through the full pre-commit gate:
  1. **PR 1 — hardening first:** H1 + H4 + H7 remainder (the test suite then protects
     the UI work).
  2. **PR 2 — users module features:** role badge, login activity, permission matrix
     (by-role editable / by-user read-only), explicit save, custom roles.
  3. **PR 3 — view-as permission preview.**

## Key discovery (shrinks the plan)

`00_core.sql` **already grants** `users.manage` holders full write on `core.roles`,
`core.permissions`, `core.role_permissions` (policies at 00_core.sql §RLS), already
guards the last-admin case on all those paths, and already audit-logs every change. So
PR 2/3 are **almost entirely frontend**; the only schema deltas are the two small
function changes below.

## Scope

### PR 1 — hardening (H1, H4, H7 remainder)

- **H1** `supabase/tests/rls_matrix.sql`: per-role (owner/manager/staff/viewer/anon)
  impersonated can/can't assertions per the audit list in
  [platform-hardening.md](platform-hardening.md) §H1, **plus new assertions for this
  suite's surface**: non-`users.manage` cannot write catalog tables; last-admin guard
  raises; audit rows appear. **Drift check** as a `ci.yml` step: `PERM` keys in
  `app-src/src/lib/permissions.ts` ⟷ `core.permissions` seed keys across
  `supabase/schema/*.sql` (note: `00_core.sql`'s stale POS seeds
  `pos.create_bill`/`pos.refund` vs the live `pos.*` set will surface here — reconcile
  the seeds as part of this).
- **H4** initplan sweep: wrap `core.has_permission('x')` → `(select …)` and
  `auth.uid()` → `(select auth.uid())` in every policy across `supabase/schema/*.sql`;
  verify with `explain`; add the pattern to [MODULE-TEMPLATE.md](../MODULE-TEMPLATE.md).
- **H7 remainder** (per [platform-hardening.md](platform-hardening.md) §H7): storage
  policies → `supabase/schema/NN_storage.sql` + Exposed-schemas note in
  `supabase/README.md`; shell error boundary (bilingual error card); Dependabot for
  `app-src`; `passkey-verify` generic client error (detail server-logged);
  `quotes.next_quote_number()` grant restriction. **PITR stays parked** by the decided
  rule (revisit at 20 signed contracts).

### PR 2 — users module features

- **Role badge** — the signed-in user's role chip in the shell header (AuthHeader),
  every module, phone-friendly. Client query: own `core.user_roles` rows join
  `core.roles` (readable under existing RLS).
- **Login activity** — extend `core.admin_list_users()` to also return
  `last_sign_in_at` (schema delta #1); show in the users list.
- **Permission matrix UI** — role → module → action grid, editable for `users.manage`:
  grant/revoke any permission on any role (built-ins included), **batched with an
  explicit Save** (no live-on-click writes); errors from the last-admin guard surface
  bilingually.
- **By-user / by-role views** — same matrix data, two lenses; per-user shows read-only
  effective permissions derived from role membership (client-side derivation — all
  inputs readable under existing RLS).
- **Custom roles** — create (and delete) roles with hand-picked grants; built-in rows
  get no special casing beyond the DB guards. Roles remain data (`core.roles`), per the
  architecture's "new roles are rows" extension point.
- All of it bilingual HE/AR via the module i18n, mobile-first (matrix must work at
  phone width — likely role-cards + per-module accordion rather than a wide grid).

### PR 3 — view-as (permission preview)

- Owner (`users.manage`) picks a user → the auth context swaps its **permission
  mirror** to the target's effective set (derived client-side, same inputs as the
  by-user view); launcher/nav/gates re-render as that user sees them; persistent
  "viewing as X" banner; one tap to exit. Data queries still run as the owner —
  RLS unchanged, nothing to audit server-side (no privileged action occurs).

### Out of scope

- H2 (migration pipeline) — deferred, owner decision Q2.
- H6 (`finance.expected` guard) — finance-scoped, stays its own item.
- True session impersonation; per-user permission overrides.
- PITR decision (parked by rule); full menu-as-data POS admin UI.

## Schema deltas (both in `00_core.sql`, re-run in SQL editor)

1. `core.admin_list_users()` adds `last_sign_in_at timestamptz` to its return table.
2. Seed reconciliation surfaced by the drift check (stale `pos.create_bill`/`pos.refund`
   seeds vs live keys) — align seeds with production reality.

## Architecture invariants check (ARCHITECTURE.md §7)

1. **RLS first, UI mirror second** — the matrix UI writes through existing RLS
   policies; the preview mode changes only the UI mirror, never the JWT/RLS. ✓
2. **Anon key only** — no new secrets; `passkey-verify` change reduces leakage. ✓
3. **No PII in repo** — login activity is rendered from the DB, nothing committed. ✓
4. **Invariants in Postgres** — last-admin guard + audit triggers already there; H1
   asserts them permanently. ✓
5. **Bilingual HE/AR, RTL** — all new UI through module/shell i18n. ✓
6. **Visibility flag** — n/a (no public content tables touched). ✓
7. **Live tools untouched** — no POS/marketing surface in scope. ✓
8. **Roadmap updated** — this plan is linked from Phase 1.5. ✓

## Vision check

Serves "one login, roles decide" directly: the owner manages the whole role→module→
action system from a phone without SQL, which is the operational prerequisite for
Phase 3's member role and "hundreds of people join; permissions stay easy to manage."
Custom roles are the vision's "new roles are rows" flexibility made usable. H1 locks
the security model the whole dream stands on. **Verdict: aligned; nothing here
contradicts VISION.md / ARCHITECTURE.md / the roadmap phase order.**

## Decisions made during execution

- **Viewer role is an empty placeholder** (owner, 2026-07-15): the H1 suite's first
  prod run caught drift — prod's `viewer` held zero permissions while the schema's
  locked matrix seeded `pos.view`. Owner confirmed prod is the intended state:
  viewer = "no access until granted." `42_pos_platform.sql` now deletes any pos
  grant from viewer; `rls_matrix.sql` asserts the role is empty.
- **`v_sales_*` non-hole**: the audit-flagged view-grant concern checked out benign
  on prod (no select grant for authenticated, only stray TRUNCATE/REFERENCES/TRIGGER
  default-privilege noise). `44_initplan_sweep.sql` revokes the noise and the suite
  pins the denial.

## Open questions

- (none blocking — alignment Q&A above resolved the contentious points)

## Order & sizing

| Order | Package | Size |
|---|---|---|
| 1 | PR 1 hardening (H1 + H4 + H7×5) | ~1.5 days |
| 2 | PR 2 module features | ~1.5 days |
| 3 | PR 3 view-as preview | ~0.5 day |
