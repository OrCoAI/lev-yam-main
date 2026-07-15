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

- **2026-07-15** — Users & Permissions hardening initiative (full kickoff, not this
  lighter log — see [plans/users-hardening.md](../plans/users-hardening.md)): invite-user
  flow (`admin-invite` Edge Function + UI action, no more Supabase-dashboard user
  creation); self-service "forgot password?" + `/app/reset-password`; last-admin
  lockout guard + `core.audit_log` on role/permission changes; `users.view` now a real
  read-only permission; full HE/AR retrofit of the module chrome; permission-mirror
  refresh on window focus.
