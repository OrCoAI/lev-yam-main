# Platform hardening — the 2026-07-10 audit follow-ups

**Initiative plan.** Source: a full-project best-practices audit (2026-07-10) of the
schemas, RLS, spines, auth, shell, and CI/CD, measured against the owner's stated goals:
*hundreds of people join; permissions stay easy to manage; everyone sees exactly what
they should, with guards; modules talk through real sources of truth; security first.*

**Audit verdict:** the architecture is aligned with those goals — DB-first permissions,
complete RLS coverage on platform schemas, disciplined cross-module spines. The gaps are
**operational maturity** (testing, migrations, auditability, onboarding at scale), not
design flaws. This plan turns those gaps into work packages.

**Deliberately NOT here:** the audit's #1 security item — dropping the anon `pos_*`
policies — is the existing **POS cut-over** roadmap item ([pos-module.md](pos-module.md)
§7 + §8a). It stays there; this plan must not fork it.

---

## Work packages

### H1. RLS regression suite + permission-mirror drift check ⭐ highest leverage

**Why:** RLS is the entire security boundary and it grows every phase, but its
correctness is currently verified by hand (the spine's 13/13 assertions were a one-time
manual run). Nothing today would catch a schema re-run or new policy silently widening
access.

**What:**
- `supabase/tests/rls_matrix.sql` — for each role (owner / manager / staff / viewer /
  anon), impersonate (`set local role …; set local request.jwt.claims …`) and assert the
  full can/can't matrix in `do $$ … raise … $$` blocks. Assertions to seed from the audit:
  - staff/viewer cannot read `finance.entries` / `finance.expected`;
  - viewer cannot write `pos_tables`; staff cannot read raw `pos_expenses` (needs
    `pos.reports`); authenticated without grants cannot select `v_sales_*`;
  - anon sees only `visibility='public'` events and only the granted columns;
  - non-`quotes.settings` holders get zero rows from `quotes.owner_secrets`;
  - derived `finance.entries` rows reject client UPDATE/DELETE (guard trigger);
  - signed contracts reject UPDATE/DELETE; one-way stamps hold.
- **Drift check:** assert `PERM` keys in `app-src/src/lib/permissions.ts` ==
  `core.permissions` seed keys — the mirror currently drifts silently. This is
  file-vs-file (no DB needed), so it runs as a **`ci.yml` step** on every PR/branch
  push — automatic and unforgettable.
- Wire the matrix into the workflow: run after every schema apply and as part of the
  pre-commit gate for schema-touching diffs (write-back: amend CLAUDE.md's gate and
  MODULE-TEMPLATE.md §1's apply step so the rule outlives this plan).

**Acceptance:** suite runs green against prod; deliberately flipping one policy makes it
fail; a PERM/seed mismatch fails it.

### H2. Schema migration pipeline

**Why:** "re-run the idempotent file in the SQL editor" is well-executed but
unverifiable — nothing proves prod matches the repo, apply order (00→21→40) is manual,
and there is no record of what was applied when. Holds for one careful operator; breaks
with a second contributor or a rushed fix.

**What (recommended shape — see open question Q2):** adopt the Supabase CLI flow the
project is already linked to: baseline the current prod schema, then each change =
a versioned migration generated with `supabase db diff`; `supabase/schema/*.sql` stays
the readable per-module source of truth, and a drift check (empty `db diff` after apply)
runs in the gate.

**Acceptance:** a schema change lands via a versioned migration; drift check is part of
the gate; `supabase/README.md` documents the flow.

### H3. Permission governance: last-admin lockout guard + audit log

**Why:** an owner can currently remove their own `users.manage` (or the owner role's
grant of it) in two clicks — recovery only via the SQL editor. And with hundreds of
users, "who granted X access to finance, and when?" must be answerable.

**What (in `00_core.sql`):**
- Guard trigger on `core.user_roles` (delete/update) and `core.role_permissions`
  (delete): refuse the statement that would leave **zero** users holding
  `users.manage`. Hebrew+Arabic-ready exception message (surfaces in the UI).
- `core.audit_log (id, at, actor uuid default auth.uid(), action, table_name,
  row_data jsonb)` + AFTER triggers on `core.user_roles`, `core.role_permissions`,
  `core.roles`, `core.permissions`, `core.modules`. RLS: select for `users.manage`
  only; **no client write policy** (trigger-written only). Optional later: a read-only
  "history" tab in the users module.

**Acceptance:** deleting the last admin grant raises; every role/permission change
appears in `core.audit_log` with the acting user.

### H4. RLS initplan performance sweep

**Why:** every policy calls `core.has_permission('x')` bare, which Postgres may evaluate
**per row** (a 3-table join each time). Invisible today; the classic Supabase foot-gun at
hundreds of users × thousands of rows — and Phase 3's per-initiative row grants will
amplify it.

**What:** one pass over all `supabase/schema/*.sql`: wrap policy calls as
`using ((select core.has_permission('x')))` (and `user_id = (select auth.uid())` where
applicable) so the planner runs them once per statement as an InitPlan. Verify with
`explain` on a representative query per table. Add the pattern to
[MODULE-TEMPLATE.md](../MODULE-TEMPLATE.md) §1 so every future module is born optimized.

**Acceptance:** all policies use the wrapped form; `explain` shows InitPlan (not a
per-row filter re-eval); template updated; H1 suite still green (behavior unchanged).

### H5. Membership operations: invite flow + password reset (pull-forward from Phase 3)

**Why:** onboarding today = the owner creates users in the Supabase dashboard, and there
is no password reset in the login screen. Fine for 5 staff; an owner-becomes-helpdesk
problem for a growing community. Phase 3's member role should not launch without this.

**What:**
- **Invite:** `admin-invite` Edge Function (service role) gated by
  `core.has_permission('users.manage')` → `auth.admin.inviteUserByEmail` + initial role
  assignment; an "invite user" action in the users module (email + role picker).
- **Reset:** "forgot password" on [Login](../../app-src/src/shell/Login.tsx) via
  `resetPasswordForEmail`, plus a recovery route that handles the `type=recovery`
  session and sets a new password. Both bilingual HE/AR, phone-first.

**Acceptance:** a new user goes email → invite → first login → role visible in launcher,
without anyone opening the Supabase dashboard; a forgotten password recovers
self-service end to end.

### H6. `finance.expected` module-row guard

**Why:** `finance.entries` got the "module rows are module-owned" guard, but any
`finance.manage` holder can still edit the amount of — or delete — a *quotes-created*
expectation, silently breaking the pairing with the signed quote.

**What:** extend the guard-trigger pattern to `finance.expected`: rows with
`source_module` set accept only status transitions (`open → fulfilled/cancelled`) from
clients; amount/direction/category/due-date edits and deletes are module-only (GUC
path). Manual expectations (`source_module is null`) stay fully editable. Note in
[cross-module-foundation.md](cross-module-foundation.md) §3c.

**Acceptance:** client UPDATE of a quotes-created expectation's amount raises; cancel/
fulfill still works; H1 suite gains these assertions.

### H7. Hygiene batch (small, independent items)

- [ ] **Storage policies into the repo** — the `quotes-docs` bucket's policies are
  dashboard-only today; they are plain SQL on `storage.objects` and belong in a
  `supabase/schema/NN_storage.sql`. Also: record the **Exposed schemas** list in
  [supabase/README.md](../../supabase/README.md) by extending the existing First-time
  setup step 2 (not a new section).
- [ ] **Backups/PITR** — signed legal contracts + the business ledger now live in this
  DB; upgrade to a plan with PITR/daily backups and update the "verify PITR as data
  grows" line in [ARCHITECTURE.md](../ARCHITECTURE.md) §2 to the decided posture.
  **Owner decision (2026-07-10): deferred — revisit when `quotes.contracts` reaches
  20 signed rows** (check: `select count(*) from quotes.contracts where
  status = 'signed'`; raise it with the owner again at that point).
- [ ] **Users module HE/AR retrofit** — hardcoded Hebrew, same debt class as the finance
  chrome (which is already tracked); route strings through the shell i18n layer.
- [ ] **`users.view` is a dead permission** — `admin_list_users` returns empty without
  `users.manage`; either honor `users.view` for read-only listing or drop the key.
- [ ] **React error boundary** in the shell `Layout` — a module crash should degrade to
  a bilingual error card, not a white screen (boot fallback already exists).
- [ ] **Dependabot** (`.github/dependabot.yml`) for `app-src` npm — `@simplewebauthn`
  and `supabase-js` sit in the auth path.
- [ ] **Edge function error detail** — `passkey-verify` returns `String(e)` to clients
  on 500; log it server-side, return a generic code.
- [ ] **`quotes.next_quote_number()` grant** — callable by any authenticated user
  (burns sequence numbers → numbering gaps). Restrict to insert-path use or accept and
  document.
- [ ] **Permission refresh on focus** — UI mirror updates only on reload after a grant
  change (DB enforces instantly); call `refreshPermissions()` on window focus.

**Awareness note (no action):** `generateContract` snapshots the owner's signature into
`contracts.content`, readable at `quotes.view`. Inherent to contracts displaying the
signature — recorded as a standing constraint in [ARCHITECTURE.md](../ARCHITECTURE.md)
§2 (drafted with this plan).

---

## Order & sizing

| Order | Package | Size | Notes |
|---|---|---|---|
| 1 | H2 migrations | ~1 day | needs Q2 answered at kickoff — lands the pipeline every schema package below rides |
| 2 | H1 suite | ~1 day | DB-read-only (no drift risk); runs first instead if Q2 stalls |
| 3 | H3 + H6 guards | ~1 day | **one branch/PR** — same guard-trigger pattern, gate paid once |
| 4 | H4 initplan sweep | ~½ day | after H1 (the suite proves behavior unchanged) |
| 5 | H5 invite + reset | ~1–2 days | timing = Q3 |
| 6 | H7 batch | ~1 day total | PITR item parked (20-signed-contracts rule above) |

Each package = its own branch + PR through the pre-commit gate (H3+H6 ship together).
H3/H4/H6 are schema-touching: land them as H2 migrations, then run the H1 suite.

## Roadmap alignment

Tracked as **Phase 1.5 — Platform hardening** in [ROADMAP.md](../ROADMAP.md): after the
POS parity/cut-over items (Phase 1's tail), before the Phase 2 bookings UI. H4 and H5
are explicit prerequisites for Phase 2's public feed and Phase 3's member role
respectively.

## Architecture invariants check

- **Permissions DB-first:** H1 tests the DB gate; H3 guards live in triggers; H5's
  invite function re-checks `users.manage` server-side. UI stays the mirror. ✅
- **Schema as source of truth:** H2 strengthens exactly this; H7 pulls storage policies
  into it. ✅
- **Spine, no silos:** H6 closes a spine-integrity gap in the money plan. ✅
- **Bilingual HE/AR + mobile-first:** H5 flows and the H7 users retrofit ship bilingual,
  phone-first; guard exceptions surface user-facing messages. ✅
- **No secrets in repo:** unchanged; service-role stays Edge-only (H5 uses it there). ✅

## Vision check

Serves "one login, roles decide" (H3, H5), "community as creators" at real scale (H5 is
the door hundreds walk through), and "real numbers, tightly guarded" (H1, H6). No new
product surface; this is the platform earning the community phases. ✅

## Doc write-backs on completion

The close-out checklist — standing docs each package must amend so its rule outlives
this plan (inline mentions above are the context; this list is what gets ticked):

- [ ] CLAUDE.md pre-commit gate: RLS suite required for schema-touching diffs (H1).
- [ ] [MODULE-TEMPLATE.md](../MODULE-TEMPLATE.md): initplan policy pattern (H4); §1
  apply step gains "run the RLS suite after applying" + new-module assertions (H1);
  migration flow replaces "re-run in the SQL editor" (H2). Also resolve with the owner:
  §1 prescribes *Hebrew* user-facing trigger messages while ARCHITECTURE invariant 5
  says HE+AR for anything user-facing — amend the template line (and the H3 guard
  follows it) once decided.
- [ ] [ARCHITECTURE.md](../ARCHITECTURE.md) §2: backups line → decided posture (H7);
  §3: invite/reset as the login story (H5).
- [ ] [supabase/README.md](../../supabase/README.md): migration + exposed-schemas +
  storage checklist (H2, H7).
- [ ] [cross-module-foundation.md](cross-module-foundation.md) §3c: the expected-row
  guard rule (H6).

## Open questions (owner decisions — blocking only their own items)

- **Q1 (H7-PITR):** *decided 2026-07-10 — deferred until 20 signed contracts; the
  check + reminder rule lives in the H7 bullet above.*
- **Q2 (H2):** full Supabase CLI migration flow (versioned `migrations/`, drift check in
  the gate — recommended), or keep SQL-editor applies with only a drift check?
- **Q3 (H5):** land invite+reset now (Phase 1.5) or defer to the Phase 3 kickoff?
  **Recommended: now** — it also removes the owner's dashboard chore for staff accounts.
