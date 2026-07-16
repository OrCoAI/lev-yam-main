# Users (admin) — module log

Live at `/app/users`. Schema/RBAC core: `supabase/schema/00_core.sql`. UI:
`app-src/src/modules/users/`. Roles: owner / manager / staff / viewer.

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## Open feature ideas

- (none logged)

## Done

- **2026-07-16** — Users & permissions suite (full kickoff — plan + close-out:
  [plans/users-permissions-suite.md](../plans/users-permissions-suite.md); PRs
  #11/#12/#13): shell role badge; last sign-in in the users list;
  permission-matrix explicit Save (atomic `core.apply_role_permissions` RPC,
  dirty-cell highlighting, sticky save bar); per-module accordion at phone
  width; by-user read-only effective-permissions lens; custom role
  create/delete (cascade-aware last-admin guard on `core.roles` added — real
  lockout hole found by the gate); view-as **permission preview** with
  intersection semantics, banner + one-tap exit. *Note: the original idea line
  said view-as "needs audit logging" — deliberately dropped (owner decision
  2026-07-15): preview is a client-side permission-mirror swap, no server-side
  privileged action occurs, so there is nothing to audit.* Also bundled the
  Phase 1.5 H1/H4/H7-remainder hardening (RLS regression suite + drift check,
  initplan sweep, hygiene batch).
- **2026-07-15** — Users & Permissions hardening initiative (full kickoff, not this
  lighter log — see [plans/users-hardening.md](../plans/users-hardening.md)): invite-user
  flow (`admin-invite` Edge Function + UI action, no more Supabase-dashboard user
  creation); self-service "forgot password?" + `/app/reset-password`; last-admin
  lockout guard + `core.audit_log` on role/permission changes; `users.view` now a real
  read-only permission; full HE/AR retrofit of the module chrome; permission-mirror
  refresh on window focus.
