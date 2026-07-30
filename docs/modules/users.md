# Users (admin) — module log

Live at `/app/users`. Schema/RBAC core: `supabase/schema/00_core.sql`. UI:
`app-src/src/modules/users/`. Roles: owner / manager / staff / viewer.

See [README.md](README.md) for how this file works — bugs/small features only; anything
touching schema, permissions, or the events/finance spine graduates to a `docs/plans/` plan.

## Open bugs

- (none logged)

## Done (cont.)

- **2026-07-30** — **Unconfirmed-email accounts couldn't log in, invisibly.** Reported
  live: an owner set a password for `wedad.jorban11@gmail.com` from the admin console and
  the user still couldn't sign in. Cause: she never opened her invite link, so
  `email_confirmed_at` was null, and with the project's `mailer_autoconfirm` **off** GoTrue
  rejects every password grant as `email_not_confirmed` — however correct the password is.
  The console reported success because `set_password` only wrote the password. Shipped:
  - `admin-user-ops` **`confirm_email`** action (gated on the existing owner-only
    `users.password` — an owner vouching for an address out-of-band is the same assurance
    the invite link would have been; owner decision 2026-07-30, no new permission).
  - `set_password` now also confirms the address **when it isn't already confirmed**.
    `email_confirm: true` is *not* idempotent — GoTrue re-stamps `email_confirmed_at` with
    `now()` every time — so sending it unconditionally would have let a routine password
    reset erase a long-standing account's real verification date. Guarded by
    `confirmIfNeeded()`.
  - `core.admin_list_users()` returns **`email_confirmed_at`** (drop-first; baseline
    regenerated), and the users list shows an **orange "האימייל לא אומת" marker** plus a
    **אימות אימייל** pill + explanatory hint, only for affected users. Hint wording states
    the fact without asserting the cause — the platform can't distinguish "invite never
    opened" from any other unconfirmed row.
  - Gate side-effects: the action dispatch was refactored from two category sets
    (`LIFECYCLE`/`PASSWORD_OPS` + one `isPassword` boolean that drove *both* the permission
    key and the self-targeting rule) into a per-action **`POLICY`** table
    (`perm`/`allowSelf`/`needsEmail`), so a new action can't inherit a policy nobody chose;
    `PasswordForm` now re-reads the list on success (otherwise the row kept showing "cannot
    sign in" right after the fix); dev-preview fixtures typed as `AdminUser[]` so the next
    field addition fails the build instead of silently lying.
  - `rls_matrix` extended (one fixture seeded confirmed, the rest null — the first version
    of the assertion joined `auth.users`, which `authenticated` can't read, and would have
    aborted the whole suite). Green.
  - *Prod note:* Wedad's account was unblocked by hand via the Auth Admin API before the
    code fix. **Prod signup is currently open** (`disable_signup: false`) though the
    platform has no signup UI — worth turning off; logged as a feature idea below.

- **2026-07-20** — UX iteration + role-delete guard (same PR #25, second commit;
  gate re-run in full on the combined diff):
  - **Refined "calm" redesign** of the whole module — one shared container width
    so every edge aligns (tabs, invite, rows, accordions, save bar); avatar
    initials + quiet status line on user rows; divided detail sections with an
    orange accent tick; colour-coded action pills (password = orange, delete =
    red, pushed to the row end); brand **orange for create actions** (invite in
    the tab bar, "+ add role" dashed). Invite button moved up into the tab bar.
  - Permissions matrix **folds per-module at all widths** (desktop grid dropped);
    accordions **closed by default**.
  - Users-tab detail now shows a **concise module-access summary** (tags with
    per-module counts) instead of the full permission list.
  - New **By-role tab**: pick a role → editable per-module permission accordions
    (granted/total counts) **plus a searchable "users with this role"
    accordion**. Shares the matrix's atomic edit/Save engine.
  - **Role-delete integrity guard** (`core.guard_role_not_in_use`, BEFORE DELETE
    on `core.roles`): a role still assigned to any user can't be deleted
    (`role_in_use`) — closes the "delete role → users left with no
    role/permissions" hole. Applied to prod; `rls_matrix` extended + green.
    *Prod note:* the `staff` role had been deleted during live testing (removing
    it from 2 real users); recovered via the management API (defaults re-seeded,
    both users re-assigned).

## Open feature ideas

- **Close open self-signup on prod** (surfaced by the 2026-07-30 security review):
  `disable_signup` is `false`, so anyone with the public anon key can create an
  unconfirmed account, even though the platform is invite-only and ships no signup UI.
  Harmless alone (no roles ⇒ empty launcher, RLS denies everything), but it's the one
  scenario where `confirm_email` unlocks a password the platform never verified anyone
  controls. One dashboard toggle.
- **Confirm the address at invite time** (`admin-invite`), so no account is ever created
  in the sign-in-blocked state — the invite itself is the owner's vouch, and "invited but
  never accepted" is a normal steady state (links expire, land in spam). Raised by the
  2026-07-30 altitude review; deliberately deferred out of that diff because it changes
  invite semantics and needs the `type=invite` acceptance flow re-tested. Would make the
  `set_password` rider belt-and-braces rather than load-bearing.
- Bilingual HE/AR templates for the *other* auth emails (password recovery,
  magic link, email change) — still stock English; now editable since custom
  SMTP is configured (2026-07-16). Same pattern as the invite template.
- Unify catalog-label i18n: `core.roles` now carries bilingual `label_he`/`label_ar`
  (2026-07-20), but `core.modules.label` is single-language (shown via a
  compile-time client dict) and `core.permissions.label` is raw English. Give
  modules (and maybe permissions) the same `label_he`/`label_ar` DB shape so all
  three sibling catalog tables share one mechanism. (Surfaced by the
  users-ux-admin-caps `/simplify` altitude pass.)

## Done

- **2026-07-20** — UX pass + admin capabilities (full kickoff — plan + close-out:
  [plans/users-ux-admin-caps.md](../plans/users-ux-admin-caps.md)): users list →
  per-user **accordion** (all per-user data + actions in one place; by-user
  effective lens moved out of the matrix tab, which is now purely the
  role×permission grid); compact action buttons; **owner-only password
  set/override** (`users.password` perm + `admin-user-ops` `set_password` /
  `send_reset`); **bilingual role rename** (added `core.roles.label_he/label_ar`,
  **dropped the legacy `label` column**, `useRoleName` reads DB labels). Gate run
  in full; schema + permission applied to prod, `admin-user-ops` redeployed,
  `rls_matrix` green. Follow-up logged below. Per-user permission overrides
  considered and dropped (stays role-based).

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
