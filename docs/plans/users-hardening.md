# Users & Management hardening — H3 + H5 + users-scoped H7

**Initiative plan.** Bundles three work packages from
[platform-hardening.md](platform-hardening.md) that all land on the **users module**
(`app-src/src/modules/users/`, `supabase/schema/00_core.sql`), per owner direction
2026-07-15: do the users-module hardening now as one initiative, features to follow.

**Scope — in:**
- **H3** — last-admin lockout guard (trigger on `core.user_roles` / `core.role_permissions`)
  + `core.audit_log` on role/permission changes.
- **H5** — `admin-invite` Edge Function + "invite user" UI action; "forgot password" on
  Login + a recovery route.
- **H7, users-scoped only:**
  - `users.view` becomes a real read-only permission (today `admin_list_users()` returns
    nothing without `users.manage`).
  - Users module HE/AR retrofit (the module predates the i18n layer; strings are
    hardcoded Hebrew today).
  - Permission-mirror refresh on window focus (currently only reloads on page refresh).

**Scope — out** (stays in platform-hardening.md, untouched here): H1 (RLS regression
suite), H2 (migration pipeline), H4 (initplan sweep), H6 (`finance.expected` guard — a
finance-module item), and H7's non-user items (storage policies, PITR, shell error
boundary, dependabot, `passkey-verify` error detail, `quotes.next_quote_number` grant).

## Ordering deviation (owner-acknowledged)

platform-hardening.md's Order & sizing table sequences H3/H5 *after* H1/H2/H4. None of
those are technically prerequisites for H3/H5 (H1 is a test suite over existing +
new behavior; H2 is a migration-pipeline choice; H4 is a perf sweep) — the owner chose to
proceed with this bundle out of that order. Flagged and accepted 2026-07-15; H1 should
still gain assertions for this initiative's new guard/audit surfaces when it lands later
(noted below).

## Open questions — resolved 2026-07-15

- **Trigger message language:** MODULE-TEMPLATE.md said Hebrew-only for trigger
  `raise exception` text; ARCHITECTURE.md invariant 5 says HE+AR for anything
  user-facing. **Resolved: HE+AR wins** — MODULE-TEMPLATE.md §1 amended to match; the H3
  guard message ships bilingual (`raise exception using message = ...` with both
  languages, `/` separated, same convention as other bilingual DB-surfaced strings).
- **`users.view`:** **Resolved: make it real.** `core.admin_list_users()`'s gate loosens
  from `users.manage` to `users.manage OR users.view`; view-only holders get the same
  read data, the existing `canManage` UI flag already disables every mutating control for
  them (invite, role toggles, matrix edits) — no new UI branch needed for the read/write
  split, only the RPC-level gate changes.
- **Email delivery:** **Not yet configured.** Supabase auth email sending (invite +
  recovery templates, SMTP or default provider) has no dashboard setup yet. This plan
  builds the code assuming default Supabase auth emails; a manual dashboard step remains
  before invite/reset actually deliver mail in production — called out again at close-out.

## Schema / RLS / permission changes — all in `supabase/schema/00_core.sql`

*(source-of-truth file; idempotent re-run in the Supabase SQL editor, no new `NN_*.sql`
— this is core-schema work, not a new module)*

1. **Last-admin guard** — `AFTER DELETE OR UPDATE` (statement-level) trigger on
   `core.user_roles`, `core.role_permissions` **and `core.permissions`**: refuse the
   statement if it would leave zero `(user, permission='users.manage')` holders.
   Bilingual `raise exception`. **As-executed (code-review, 2026-07-15):** the
   `core.permissions` trigger was added after review — deleting/cascading a role or
   permission was already covered (empirically verified: cascade deletes into
   `role_permissions`/`user_roles` fire the statement trigger even for zero-row
   cascades), but **renaming** the `users.manage` permission's `key` touches neither
   table and would have bypassed the guard entirely without a direct trigger on
   `core.permissions`. `role_permissions`' trigger also gained `UPDATE` (repointing a
   grant's `permission_id` in place, not just delete+insert).
2. **`core.audit_log`** — `(id uuid pk, at timestamptz default now(), actor uuid default
   auth.uid(), action text, table_name text, row_data jsonb)`. `AFTER INSERT/UPDATE/DELETE`
   triggers on `core.user_roles`, `core.role_permissions`, `core.roles`,
   `core.permissions`, `core.modules`. RLS: `select` for `users.manage` only; **no client
   write policy** — rows only ever arrive via the trigger functions. **As-executed:**
   `auth.uid()` is null for the service-role client, which would have logged every
   invite-created role grant with `actor = null` — the one flow this table exists to
   audit. Fixed with a `levyam.audit_actor` session GUC (set by `core.admin_assign_role`,
   read by `write_audit_log` as a `coalesce` fallback before `auth.uid()`).
3. **`core.admin_assign_role(p_user_id, p_role_id, p_actor)`** — new SECURITY DEFINER
   function; the only way the invite Edge Function assigns a role (not a raw
   `user_roles` insert), so the audit log gets the verified inviter as actor. Trusts
   `p_actor` completely (the Edge Function already checked `users.manage` before
   calling it) — **not** granted to `authenticated` (explicit `revoke`, since the
   blanket `grant execute on all functions … to authenticated` would otherwise let any
   signed-in user hand themselves the owner role); `service_role` only.
4. **`core.admin_list_users()`** — gate loosens to `users.manage OR users.view` (item
   above).
5. **`core.has_permission_for(target_user, perm_key)`** holds the real join;
   `core.has_permission(perm_key)` is now a one-line wrapper delegating to it (single
   source of truth, caught independently by three /simplify review agents).
6. `service_role`'s grants on `core` narrowed to exactly `roles` (select) +
   `has_permission_for`/`admin_assign_role` (execute) — no direct `user_roles`
   select/insert once the RPC replaced the raw insert. Documents the established
   "narrow, function-scoped service_role grant" exception to MODULE-TEMPLATE.md §1's
   "service_role gets nothing" line (same pattern `01_passkeys.sql` already uses for
   `passkey-verify` — the doc line predates that precedent and needs updating, tracked
   in this plan's write-backs).
7. No new permission keys needed for H5 — the invite action re-uses `users.manage`
   server-side inside the Edge Function (re-checked, not just UI-mirrored).

## Edge Function — `supabase/functions/admin-invite/`

Follows the `passkey-verify` pattern (the only existing Edge Function in the repo):
service-role client (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, auto-injected),
`requireUser()` via bearer token, then a server-side `core.has_permission('users.manage')`
check (RPC call, not trusting the client) before `admin.auth.admin.inviteUserByEmail(email,
{ redirectTo })` + an initial `core.user_roles` insert for the chosen role. Deployed with
`--no-verify-jwt` (does its own auth), same CORS allow-list shape as `passkey-verify`.
Manual deploy step (no CI hook exists for Edge Functions in this repo today) —
called out at close-out.

**As-executed (code-review, 2026-07-15):** shared `cors`/`json`/`requireUser`
extracted to `supabase/functions/_shared/http.ts` (`passkey-verify` keeps its own copy
— working, deployed, not touched). The shared `cors()` fixes a gap present in
`passkey-verify`'s original version: it now only echoes back an `Origin` that's in the
caller's allow-list (else `'null'`), so the allow-list is a real browser-enforced CORS
boundary, not just a distinction in the JSON body. Role assignment goes through
`core.admin_assign_role` (not a raw insert, for the audit-actor fix above); a failed
role assignment now deletes the just-invited auth user rather than leaving an
invited-but-roleless orphan. The authorization check (`has_permission_for`) is decided
before the role-validity check is revealed in the response, so an authenticated caller
without `users.manage` can't use the `unknown_role` vs. `forbidden` distinction to
enumerate valid role IDs.

## UI surface

- **`UsersAdmin.tsx` (Users tab):** an "invite user" action (email + role picker) next to
  the existing user list, calling the new Edge Function; success/error surfaced inline.
  Gated by `canManage` like every other mutation here.
- **`Login.tsx`:** "forgot password?" link → `supabase.auth.resetPasswordForEmail(email,
  { redirectTo })`.
- **New `ResetPassword.tsx` route** (public, alongside `/login`): handles the
  `type=recovery` session Supabase mints after the email link, form to set a new password
  via `supabase.auth.updateUser({ password })`, then redirect to the app.
- **`modules/users/i18n.ts`:** retrofit — every hardcoded Hebrew string in
  `UsersAdmin.tsx` (tab labels, empty states, errors, the new invite form, "invited"
  confirmation) moves into the `he`/`ar` dict pair via `makeDictHook`, following the
  `finance/i18n.ts` shape (the canonical retrofit reference per MODULE-TEMPLATE.md §3).
- **`lib/auth.tsx`:** `refreshPermissions()` also fires on `window.addEventListener
  ('focus', ...)` so a permission change (e.g. someone else editing your role) reflects
  without a manual reload — directly relevant here since H3's guard and the invite flow
  both change `user_roles`/`role_permissions` live.

## Architecture invariants check

- **Permissions DB-first:** the invite function re-checks `users.manage` server-side; the
  last-admin guard and audit log are pure triggers — no invariant lives only in the UI. ✅
- **Schema as source of truth:** all changes land in `00_core.sql`, re-run in place. ✅
- **Spine, no silos:** no money/events surface touched. ✅
- **Bilingual HE/AR + mobile-first:** invite form, reset flow, guard messages, and the
  full users-module retrofit all ship bilingual; new UI follows the `.rowline`/phone-first
  conventions already standard in the platform. ✅
- **No secrets in repo:** service-role key stays Edge-only, same as `passkey-verify`. ✅

## Vision check

Serves "one login, roles decide" (H3's guard + audit trail protect that model as more
people gain access) and directly serves "hundreds of people join" (H5 removes the
owner-as-helpdesk dashboard step). No new product surface — this is the platform earning
scale before Phase 3's member role. ✅

## Doc write-backs (close-out checklist)

- [x] `docs/MODULE-TEMPLATE.md` §1 — Hebrew-only → HE+AR for trigger messages, plus the
  narrow-service_role-grant exception (both done).
- [x] `docs/plans/platform-hardening.md` — H3/H5/users-scoped-H7 marked executed via
  this plan; ordering deviation noted; Q3 resolved (now); H1 note about future
  assertions added.
- [x] `docs/ROADMAP.md` — H3 and H5 ticked; H7 split into 3-done/6-remaining.
- [x] `docs/modules/users.md` — Done entry logged.
- [x] `docs/ARCHITECTURE.md` §3 — invite/reset written up as part of the login story.

## Discovered during verification (fixed, not a design change)

- Testing the last-admin guard against prod revealed that **no account currently held
  `users.manage`** — the only auth user (orcohenwork@gmail.com) was assigned `manager`,
  not `owner` (pre-existing gap, not introduced by this work; it explains why the old
  Users tab showed "no users" even to the real owner). The guard correctly rejected a
  test deletion given this state. Fixed 2026-07-15 by additively granting the `owner`
  role to that account (`manager` kept) — confirmed via `core.user_roles`. Flagged to
  and confirmed with the owner before applying.
- `/security-review` (2026-07-15) found `core.has_permission_for(target_user, perm_key)`
  — new in this diff, meant for the service-role Edge Function only — was reachable by
  any `authenticated` user via the blanket `grant execute on all functions in schema
  core to authenticated`, unlike its sibling `admin_assign_role` which had an explicit
  revoke. Confirmed exploitable (any signed-in staff account could query an arbitrary
  coworker's permission status, e.g. fingerprint who holds `users.manage`) and fixed:
  `revoke execute on function core.has_permission_for(uuid, text) from authenticated;`,
  verified on prod (grant gone for `authenticated`, intact for `service_role`, edge
  function still works).

## Close-out

**Shipped:** last-admin lockout guard (covering delete/update on `user_roles`,
`role_permissions`, and `permissions` — widened during review beyond the original
delete-only scope) + `core.audit_log` with a working actor even for service-role writes
(`core.admin_assign_role` + `levyam.audit_actor` GUC); `admin-invite` Edge Function +
invite-user UI; self-service password reset (Login "forgot password?" +
`/app/reset-password`, also serves invite-acceptance); `users.view` now a real read-only
permission; full HE/AR retrofit of the users module; permission-mirror refresh on
window focus. All applied to prod and verified live (guard fires and rolls back
correctly, audit log records the true actor, the pre-existing owner-role gap and the
`has_permission_for` over-grant were both found and fixed, not just theorized).

**Deliberately left out:** H1 (RLS regression suite), H2 (migration pipeline), H4
(initplan sweep), H6 (`finance.expected` guard), and H7's six non-user items — all
remain open in `platform-hardening.md`/`ROADMAP.md`, unbundled from this initiative per
the owner's "users module" scoping. Email delivery (SMTP/templates) and the auth
redirect-URL allow-list are dashboard configuration, not code — flagged as manual
follow-up above, not blocking this close-out.

**Alignment verdict:** Serves `VISION.md` principle 3 ("one login, roles decide") — the
guard and audit trail keep that model trustworthy as more people gain access — and
principle 5 (bilingual, mobile-first from day one — the full retrofit and new UI both
ship that way). Serves `ARCHITECTURE.md`'s "easy login & permissions" pillar directly
(§3 now documents the invite/reset flow as part of the login story) and its permissions
model (DB-first: every new check re-verifies server-side, RLS/triggers are the real
guard, UI stays a mirror). No drift found between the delivered result and either doc;
no conflict to raise. The one open loose end — H6's staleness of "H3 ships with H6" in
the original plan — is resolved by explicitly unbundling them here rather than leaving
a dangling cross-reference.

## Manual follow-up after merge (not blocked on, but must happen for H5 to work)

- ~~Deploy the Edge Function~~ — done during this initiative (`supabase functions deploy
  admin-invite --no-verify-jwt`, 2026-07-15).
- Configure Supabase Auth email sending (dashboard: invite + recovery templates, SMTP or
  default provider) — nothing sends mail until this is done.
- **Add redirect URLs to the allow-list** (Supabase dashboard → Authentication → URL
  Configuration → Redirect URLs): `https://levyam.com/app/reset-password` and, for local
  dev, `http://localhost:5173/app/reset-password`. Confirmed 2026-07-15 by driving the
  real `resetPasswordForEmail` call end-to-end: Supabase's `/auth/v1/recover` returns 200
  regardless of allow-list status (doesn't leak which redirects are valid), so an
  unlisted redirect silently falls back to the Site URL instead of erroring — this must
  be checked in the dashboard, not inferred from the API response.
