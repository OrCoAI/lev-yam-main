# Users module — delete & deactivate users

**Status:** in progress (kickoff 2026-07-16)
**Branch:** `feat/users-delete-deactivate`
**Owner alignment:** agreed 2026-07-16 — "delete + deactivate" semantics, owner-only
via a new permission (AskUserQuestion round in-session).

## Scope

Give `users.delete` holders (seeded: owner only) two lifecycle actions on the users list:

- **Delete** — hard-delete the auth account. Works only for users with no work
  history: `finance`/`quotes`/`events` rows reference `auth.users` with **no
  cascade**, so the DB itself blocks deleting anyone with records (protects the
  audit/finance trail). Primary use: cleaning up bad or stale invites.
- **Deactivate / Reactivate** — ban/unban sign-in (GoTrue `ban_duration`) for
  off-boarding staff who have history. All their records stay attributed.

Out of scope (deliberately): detaching/anonymizing a user's history to force a
hard delete; bulk actions; deactivation of *roles* (exists already); audit-log UI.

## Schema / RLS / permission changes (`supabase/schema/00_core.sql`)

1. **New permission** `users.delete` ('users', 'delete'), seeded to **owner only**.
2. **Cascade-hole fix for the last-admin guard:** deleting an `auth.users` row
   cascades into `core.user_roles`, and Postgres does not fire *statement-level*
   triggers for FK-cascaded child deletes — so a hard delete of the last admin
   would bypass `trg_user_roles_guard_manage`. Add a **row-level** AFTER DELETE
   trigger on `core.user_roles` running the same guard function (AFTER ROW
   triggers are queued to statement end, so it sees the net state; delete-only,
   so no mid-statement false positives; `apply_role_permissions` statement
   semantics untouched — it writes `role_permissions`, not `user_roles`).
3. **`core.users_manage_survives_without(p_user)`** — security-definer helper:
   "does anyone else, not currently banned, still hold `users.manage`?" Used by
   the Edge Function as the *only* enforcement for deactivate (a ban touches no
   core table, so no trigger can guard it) and as a friendly pre-check for
   delete (the row-level trigger stays the real guard). service_role-only
   (revoked from `authenticated` — it answers about arbitrary users).
4. **`core.admin_audit_user_event(p_actor, p_action, p_data)`** — writes an
   `core.audit_log` row for delete/deactivate/reactivate. Needed because the
   GoTrue admin API acts on its own connection: the `levyam.audit_actor`
   setting can't reach the cascade-fired audit rows, and ban changes touch no
   audited table at all. service_role-only, same pattern as `admin_assign_role`.
5. **`core.admin_list_users()`** gains `banned_until` (drop-first recreate —
   established pattern) so the UI can show deactivated status.

## Server surface (`supabase/functions/admin-user-ops/`)

New Edge Function (same scaffolding as `admin-invite`, deployed `--no-verify-jwt`):
`POST { action: 'delete' | 'deactivate' | 'reactivate', user_id }`.

- Caller re-checked server-side for `users.delete` via `has_permission_for`.
- **No self-service:** acting on your own account is refused (`self_forbidden`) —
  prevents an owner deleting/banning themselves mid-session.
- delete → survives-check (`last_admin`), then `auth.admin.deleteUser`; an FK
  restraint failure maps to `has_records` (UI suggests deactivate instead).
- deactivate → survives-check, then `ban_duration: '876000h'` (~100y).
- reactivate → `ban_duration: 'none'`.
- Every success writes an audit row with the real actor.

## UI surface (`app-src/src/modules/users/`)

On each user card, for `users.delete` holders only: deactivate/reactivate and
delete actions (native `confirm()` — existing RolesManager pattern), hidden on
your own card; a "deactivated" badge when `banned_until` is in the future.
Bilingual HE/AR strings for all of it; errors mapped per code. `PERM.usersDelete`
added to the permission mirror; `AdminUser` type gains `banned_until`.

## Tests

`supabase/tests/rls_matrix.sql` extended: `users.delete` seeded owner-only; the
new row-level guard trigger present; both new functions revoked from
`authenticated`/granted to service_role; survives-check behavior.

## Alignment

- **Roadmap:** added under Phase 1.5 as a users-module follow-up (natural
  successor to H5's invite flow — invite lifecycle now has both ends).
- **Architecture:** permissions DB-first (new key + RLS-side guard trigger are
  the enforcement; UI `useCan` is mirror only); schema change in
  `supabase/schema/` as source of truth; bilingual HE/AR; mobile-first (card
  action buttons, ≥44px targets); no module-local silo (audit rows land in the
  existing `core.audit_log`).
- **Vision:** supports "staff run the business from their phones" — the owner
  can correct invite mistakes and off-board without touching the Supabase
  dashboard. It also *closes* a hole the suite left: the last-admin guard was
  bypassable via auth-cascade deletes.

## Open questions

- (none — semantics and permission model settled with the owner 2026-07-16)

## Close-out (2026-07-16, pre-merge)

**Shipped:**
- Schema (`00_core.sql`, applied to prod via management API): `users.delete`
  permission seeded owner-only; row-level last-admin guard twin on
  `core.user_roles` (closes the FK-cascade hole); `users_manage_survives_without`
  + `admin_audit_user_event` (service-role-only); `admin_list_users` now returns
  `banned_until`.
- Edge Function `admin-user-ops` (deployed `--no-verify-jwt`): delete /
  deactivate / reactivate, server-side `users.delete` re-check, self-action
  refused, last-admin + has-records error mapping, audit write.
- UI: per-card deactivate/reactivate + delete for `users.delete` holders (hidden
  on own card), "deactivated" badge, bilingual HE/AR, code→message error mapping;
  `invokeFunction` now surfaces the function's own error code. Dev mock + fixtures
  mirror the function so `?preview` demos it.
- Tests: `rls_matrix.sql` extended (owner-only grant, service-side-only helpers,
  survives-check semantics, cascade guard, record-less delete success).

**Security finding (unplanned, fixed):** while writing the RLS test for the new
service-role-only functions, discovered every `revoke execute … from
authenticated` in `00_core.sql` was a **no-op** — Postgres' default PUBLIC
execute grant meant `authenticated` kept execute. `core.admin_assign_role`
(trusts `p_actor`, no internal check) was therefore callable by any signed-in
user → **confirmed self-grant-owner privilege escalation in prod**. Fixed by
revoking from `public, authenticated` on all four service-role-only definer
functions; verified `authenticated` lost execute while `service_role` + the
internal `has_permission` path still work; regression assertions added to the
matrix. See `docs/modules/users.md` Done.

**Alignment verdict:** matches VISION (owner runs the business from a phone,
off-boards staff without the Supabase dashboard) and ARCHITECTURE (permissions
DB-first with RLS/trigger enforcement, UI mirror only; schema as source of
truth; bilingual; mobile-first; audit in the shared `core.audit_log`). No drift.
The security fix additionally *hardens* an existing architecture invariant that
was silently violated.
