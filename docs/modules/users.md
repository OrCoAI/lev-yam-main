# Users (admin) — module log

Live at `/app/users`. Schema/RBAC core: `supabase/schema/00_core.sql`. UI:
`app-src/src/modules/users/`. Roles: owner / manager / staff / viewer.

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## Open feature ideas

*All items below graduated 2026-07-15 into the **users & permissions suite** initiative —
scope, decisions, and PR split tracked in
[plans/users-permissions-suite.md](../plans/users-permissions-suite.md). They move to
Done here as the initiative's PRs land.*

- **Role badge in shell header** — show the signed-in user's role as a small chip next to
  their name in the platform header (every module, phone-friendly), so it's always clear
  e.g. "you are owner".
- **Owner visibility: login activity** — show each user's last login / sign-in history in
  the users list (read-only, for `users.view`/`users.manage` holders).
- **Owner visibility: view-as (impersonation)** — owner can open the platform as another
  user sees it (their launcher, modules, dashboards). Security-sensitive — needs audit
  logging and a clear "viewing as X" banner; *initiative-sized, graduate to a
  `docs/plans/` plan when picked up*.
- **Generic permission-matrix editing UI** — edit the full role → module → action grid
  from the UI (grant/revoke any permission on any role), instead of SQL-editor changes.
  Needs RLS write-policies on `core.role_permissions`; *initiative-sized — schema/RLS
  surface, graduate to a plan when picked up* (likely bundled with the two items below).
- **Explicit save for permission edits** — matrix changes accumulate locally and apply
  only on "Save" (batched), never live-on-click.
- **Permissions viewable by user or by role** — two views of the same matrix: per-role
  (editable) and per-user (read-only *effective* permissions derived from the user's
  roles — decided 2026-07-15: no direct per-user overrides, editing stays via roles only,
  keeping the role→module→action model intact).
- **Custom roles** — create a new role (custom user type) with a hand-picked permission
  set, alongside the built-in owner/manager/staff/viewer. `core.roles` is already a
  table so this fits the model; needs insert RLS + last-admin-guard interaction review;
  *part of the permission-matrix initiative above*.

## Done

- **2026-07-15** — Users & Permissions hardening initiative (full kickoff, not this
  lighter log — see [plans/users-hardening.md](../plans/users-hardening.md)): invite-user
  flow (`admin-invite` Edge Function + UI action, no more Supabase-dashboard user
  creation); self-service "forgot password?" + `/app/reset-password`; last-admin
  lockout guard + `core.audit_log` on role/permission changes; `users.view` now a real
  read-only permission; full HE/AR retrofit of the module chrome; permission-mirror
  refresh on window focus.
