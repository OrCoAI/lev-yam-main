# Users module — UX pass + admin capabilities

**Kickoff:** 2026-07-20 (owner-directed, question-by-question alignment done in-session).
**Branch:** `feat/users-ux-admin-caps`. **Module:** users (`/app/users`).
**Class:** full initiative — touches `app-src/`, `supabase/schema/00_core.sql`, and
`supabase/functions/` (new permission + privileged Edge Function action + schema change),
so the full multi-agent pre-commit gate + `rls_matrix.sql` extension apply.

A single cohesive initiative because all four items live in the same module files
(`UsersAdmin.tsx`, `users.css`, `i18n.ts`, `00_core.sql`) and interlock: the per-user
accordion (item 2) is where the password actions (item 3) and per-user permission lens
render, and the role rename (item 4) lands in the same roles manager the matrix tab already
hosts.

## Scope — four items

### 1. Users list UI — cleaner, denser, smaller buttons
Pure frontend. The current list is one big card per user (`.u-card`, 16px padding, full-size
`.btn-ghost` action buttons, 42–44px role chips). Goal: a tighter, calmer list that reads at
a glance and uses **small, clean** controls rather than full-width buttons.
- Denser card/row rhythm; smaller action controls (icon-or-compact buttons, not the current
  full-height `.btn-ghost` pair).
- Keep ≥44px **touch targets** on phone (mobile-first invariant) — "smaller" is about visual
  weight/desktop density, achieved with compact styling that still meets the touch minimum on
  the phone breakpoint. No control drops below the 44px rule at `PHONE_MQ`.
- Stays a module-local `.u-`-prefixed CSS change; reuses shell tokens (`--sea`, `--line`, …).

### 2. Per-user accordion — consolidate everything about a user
Clicking a user row expands an accordion (same `<details>`/summary pattern the matrix phone
view already uses) holding **all** per-user data + actions in one place.
- **Collapsed row:** email + status badge (deactivated) + current role chips at a glance
  *(owner decision 2026-07-20)*.
- **Expanded:** last sign-in; **editable role toggles** (the existing `toggleRole` chips);
  **effective permissions** (read-only, derived from roles — the lens moved out of the matrix
  tab); lifecycle actions (deactivate/reactivate, delete); **password actions** (item 3);
  **view-as** preview (moved here with the lens).
- **By-user lens leaves the matrix tab entirely** *(owner decision 2026-07-20)* → the matrix
  tab becomes purely the role×permission grid (`byRole`). Removes the `MatrixView`
  `byRole|byUser` switch, `ByUserView`, and its lazy user-load from `MatrixTab`; that logic
  (effective-permission derivation + `startPreview`/view-as) relocates into the accordion.
- Mobile-first: the accordion is the same interaction at every width (no separate desktop
  grid for the user list).

### 3. Admin set / override password — owner-only
*(security-sensitive; the reason this batch is an initiative.)*
- **New permission `users.password`** (module `users`, action `password`, label "Set user
  passwords"), seeded **owner-only** — same restriction class as `users.delete`. Added to
  `PERM` in `lib/permissions.ts` (the CI drift check enforces `PERM` ↔ `core.permissions`).
- **Two methods** *(owner decision 2026-07-20)*, both owner-only:
  - **Direct set:** owner types a new password; applied immediately via
    `admin.auth.admin.updateUserById(id, { password })`. **No force-change on next login**
    *(owner decision 2026-07-20)* — the password is usable as-is.
  - **Send reset link:** triggers the recovery email (reuses the existing
    `/app/reset-password` flow / `generateLink`-style path already proven by `admin-invite`
    + self-service reset). Owner never sees the password.
- **Delivery:** two new actions on the existing `admin-user-ops` Edge Function —
  `set_password` and `send_reset` — each gated server-side on `users.password` via
  `core.has_permission_for()` (NOT `users.delete`; distinct permission, distinct check).
  Reusing the function avoids a fourth deployed function and its own CORS/auth scaffold;
  the per-action permission split keeps password separate from lifecycle.
  - Self-target: **allowed** for these two (an owner resetting their own password is
    legitimate) — unlike delete/deactivate which refuse self. Confirm no last-admin concern
    (password change never removes an admin).
  - Basic password-strength floor on `set_password` (min length; reject trivially short) —
    server-side, language-agnostic error code mapped to bilingual UI text.
  - **Audit** both via `admin_audit_user_event` (`user.set_password`, `user.send_reset`) —
    record the actor + target, never the password value.
- UI lives in the accordion (item 2): an owner-only "Set password" control opening the two
  choices, bilingual HE/AR.

### 4. Rename roles — bilingual display labels
*(the "hidden catch" resolved with the owner 2026-07-20: built-in role names render from the
shell i18n dict, not the DB label, and the platform requires HE+AR — so a correct rename
needs bilingual DB labels, and this pays off the tracked "bilingual `core.roles` labels"
debt named in `useRoleName` and the roadmap.)*
- **Schema:** add `label_he` + `label_ar` to `core.roles` (keep `label` as a
  fallback/back-compat, or migrate it — decided in build). Seed built-ins
  (owner/manager/staff/viewer) with their HE/AR names (mirroring the current dict entries).
- **i18n rewire:** `useRoleName` reads DB `label_he`/`label_ar` for **all** roles (built-in
  and custom), falling back to the dict then `key`. Removes the "custom-only DB label" split.
- **UI:** rename control in `RolesManager` — edit both HE + AR labels for any role
  *(owner decision 2026-07-20: all roles, built-in included)*. **Key stays fixed**
  *(owner decision 2026-07-20)* — permissions/code keep working (the `key` is never edited).
- **RLS:** rename is an `UPDATE` on `core.roles`, already permitted by `core_roles_write`
  (`users.manage`) — **no new policy**. The `trg_roles_guard_manage` statement trigger fires
  on the UPDATE but only asserts a `users.manage` holder survives; a label-only change leaves
  grants intact, so it passes. **Prove it with a new `rls_matrix.sql` assertion.**

## Schema / RLS / permission changes (all in `supabase/schema/00_core.sql`)
1. `alter table core.roles add column label_he text, add column label_ar text;` + seed
   built-ins; source-of-truth re-run in the Supabase SQL editor.
2. New permission row `users.password` (owner-only grant).
3. No new RLS policies (role UPDATE and user_roles writes already covered; password path is
   Edge-Function/service-role, not a table policy).
4. `admin-user-ops`: add `set_password` / `send_reset` actions, each `users.password`-gated.

## UI surface
- `modules/users/UsersAdmin.tsx`: rework `UsersTab` card → accordion; relocate `ByUserView`
  logic into the accordion; strip the `byUser` view from `MatrixTab`; add password controls;
  add rename to `RolesManager`.
- `modules/users/users.css`: denser list, smaller buttons, accordion styles (reuse
  `.u-permacc`/`.chips` patterns), password form.
- `modules/users/i18n.ts` + shell dict: new bilingual strings (password actions, rename,
  accordion labels); `useRoleName` change in `lib/i18n.tsx`.
- `lib/permissions.ts`: add `usersPassword` to `PERM`.

## Architecture-invariants check (`docs/ARCHITECTURE.md`)
- **Permissions DB-first:** `users.password` enforced server-side in the Edge Function via
  `core.has_permission_for()`; UI `useCan(PERM.usersPassword)` is mirror only. Role rename
  authorized by the existing `core_roles_write` RLS. ✅
- **Schema = source of truth:** all schema/permission changes in `00_core.sql`, re-run in the
  SQL editor; no ad-hoc prod-only edits (except Auth *config*, which has no repo home). ✅
- **Cross-module spine:** nothing here touches money/events; no module-local silos. ✅
- **Bilingual HE/AR:** role labels become bilingual (removes an existing English-only debt);
  all new UI strings ship HE+AR. ✅ (net improvement to the invariant.)
- **Mobile-first:** accordion is one interaction at all widths; touch targets stay ≥44px on
  phone even as desktop density tightens. ✅
- **No service-role in the browser / committed files:** password set uses the service role
  only inside `admin-user-ops`. ✅

## Vision check (`docs/VISION.md`)
Owner-run venue platform where staff self-serve without touching the Supabase dashboard.
Admin password reset/override + role renaming remove two remaining dashboard-only chores and
make roles legible in the owner's own language — squarely on-vision (the same "onboard
without anyone opening the Supabase dashboard" thread as the H5 invite flow). No drift.

## Roadmap fit
Owner-directed users-module pass, same lane as the shipped "Users & permissions suite" and
"Mobile-UX foundation pass" (Phase 1.5 area). Added as a new entry there. Does not jump a
phase. Note: per-user permission overrides were **considered and dropped** this session
(stays role-based, consistent with the 2026-07-15 decision).

## Open questions / build-time decisions
- `label` column: migrate its data into `label_he` and drop, or keep as a third fallback?
  (Lean: backfill `label_he`/`label_ar` from dict, keep `label` non-null for back-compat.)
- Password-strength floor value (min length) — pick to match the Supabase Auth policy.
- `send_reset`: `admin.auth.admin.generateLink({type:'recovery'})` + our SMTP vs.
  `resetPasswordForEmail` — choose the one consistent with the invite/reset flow already live.

## Pre-commit gate (mandatory, high effort)
`/simplify` → `/code-review high` → `/security-review` → `/verify` (drive the flow in the
real app + run `rls_matrix.sql` green, extended with: `users.password` grant matrix, role
label UPDATE passes the guard, non-owner cannot set passwords). Then roadmap close-out.

## Close-out (2026-07-20)

**Shipped** (branch `feat/users-ux-admin-caps`, all four items):
1. **Cleaner users list** — the per-user card became a single-column accordion (`UserRow`);
   compact `.u-opbtn` action controls replaced the full-size ghost-button pair (≥44px on
   phone preserved).
2. **Per-user accordion** — collapsed row = email + status + role pills; expanded =
   last sign-in, editable role toggles, effective-permissions lens, lifecycle actions,
   password panel, view-as. The by-user lens was **removed from the matrix tab** (its
   `MatrixView`/`ByUserView`/lazy-load all deleted); the matrix tab is now purely the
   role×permission grid.
3. **Owner-only password set/override** — new `users.password` permission (owner-only
   seed); two new `admin-user-ops` actions `set_password` (direct, no force-change) and
   `send_reset` (recovery email via the anon `resetPasswordForEmail` path, target email
   resolved server-side). Each gated on `users.password` via `core.has_permission_for`;
   password value never logged/audited; min length 8 with a `typeof` guard.
4. **Bilingual role rename** — `core.roles` gained `label_he`/`label_ar`; the rename UI in
   `RolesManager` edits both languages (key immutable); `useRoleName` reads the DB labels.

**Schema/permission changes applied to prod** (management API, project
`teyxtdccsrkdpqnbfcga`, verified): `label_he`/`label_ar` added + built-ins seeded + custom
`test` role backfilled from its old label; **legacy `label` column dropped** (guarded,
prod-safe migration — no DB object depended on it); `users.password` permission seeded,
owner-only. `admin-user-ops` redeployed (`--no-verify-jwt`). `rls_matrix.sql` extended and
run green (owner-only `users.password`, rename passes the roles guard, manager rename is a
silent no-op).

**Decisions made along the way:**
- The `label` column question (in Open questions above) was resolved **the deep way** during
  the `/simplify` gate: dropped entirely rather than kept as a hand-synced fallback, and
  `useRoleName` collapsed to `label_he`/`label_ar` → key (the `role.*` shell-dict entries were
  removed). This paid off the long-tracked "bilingual role labels" debt named in the roadmap.
- `send_reset` uses `resetPasswordForEmail` (consistent with the live self-service reset), not
  `generateLink`.
- Per-user permission overrides: **considered and dropped** (stays role-based).

**Deliberately left out / tracked debt (found by the `/simplify` altitude pass):**
`core.modules.label` and `core.permissions.label` are still single-language (modules via a
compile-time client dict, permission labels raw English), so three sibling catalog tables now
use three different i18n mechanisms. Unifying them onto the same `label_he`/`label_ar` DB shape
is a **separate follow-up**, not folded into this initiative — logged so it doesn't resurface
silently.

**Alignment verdict:** consistent with `docs/VISION.md` (removes two dashboard-only chores;
roles legible in the owner's language) and `docs/ARCHITECTURE.md` (permissions DB-first and
server-enforced; schema is source of truth; bilingual coverage *improved*; mobile-first
accordion). No drift.

**Not done autonomously:** interactive browser click-through of the four flows — no browser
tool in the session + it needs a login. Backend verified end-to-end against prod; app boots
clean; UI confirmation is on merge.
