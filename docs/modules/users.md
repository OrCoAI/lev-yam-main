# Users (admin) — module log

Live at `/app/users`. Schema/RBAC core: `supabase/schema/00_core.sql`. UI:
`app-src/src/modules/users/`. Roles: owner / manager / staff / viewer.

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## Open feature ideas

- Bilingual HE/AR templates for the *other* auth emails (password recovery,
  magic link, email change) — still stock English; now editable since custom
  SMTP is configured (2026-07-16). Same pattern as the invite template.

## Done

- **2026-07-16** — Delete & deactivate/reactivate users, owner-only (full
  kickoff — plan + close-out:
  [plans/users-delete-deactivate.md](../plans/users-delete-deactivate.md); PR
  #24 merged + deployed, prod probe-verified): `users.delete` permission
  (owner-only), `admin-user-ops` Edge Function, row-level last-admin guard twin
  closing the FK-cascade hole, deactivated badge + bilingual HE/AR UI. **The
  gate also found + closed a live PUBLIC-execute privilege-escalation**: every
  `revoke execute … from authenticated` in `core` was a no-op (PUBLIC keeps the
  default grant), leaving `core.admin_assign_role` self-grant-owner callable by
  any signed-in user — fixed with a schema-wide `revoke … from public`.

- **2026-07-16** — Invite email link landed on `http://localhost:3000` with
  `otp_expired`: the Supabase project's Auth URL config was still at defaults
  (Site URL `localhost:3000`, empty redirect allow-list), so the
  `redirectTo` sent by `admin-invite` was rejected and the fallback consumed
  the one-time token. Fixed in prod config via the management API (Site URL →
  `https://levyam.com/app`, allow-list → `levyam.com/app/*`, `www` variant,
  `localhost:5173/app/*`); also silently affected the forgot-password flow.
  Setup step documented in `supabase/README.md`. No code change needed.
- **2026-07-16** — Custom invite email: Supabase Auth now sends via **Resend
  SMTP** (`smtp.resend.com`, sender `Lev Yam <info@levyam.com>`, levyam.com
  verified, API key in `.secrets/resend-api-key`), which also unlocked
  template editing (free tier blocks it on the default mailer). Invite
  subject + body replaced with bilingual HE/AR content, styled accept
  button. Applied to prod via the management API; no repo code change.

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
