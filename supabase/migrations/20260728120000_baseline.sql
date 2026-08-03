-- GENERATED FILE — do not edit by hand.
-- Baseline migration: supabase/schema/*.sql concatenated in fresh-install
-- (filename-sort) order. Regenerate after any schema change:
--   node supabase/tests/build-baseline.mjs --write
-- Guarded in CI by `--check`. See build-baseline.mjs for why.

-- Bootstrap window (added by build-baseline.mjs — NOT from schema/*.sql):
set levyam.bootstrap = 'on';

-- =====================================================================
-- schema/00_core.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — CORE identity & permissions schema
--  Run ONCE in the Supabase SQL editor, BEFORE any module schema.
--
--  Model:  role -> module -> action  (RBAC)
--    core.roles            who someone is        (owner / manager / staff / viewer)
--    core.modules          launcher registry     (users / pos / ...)
--    core.permissions      a capability key      ('pos.refund', 'users.manage', ...)
--    core.role_permissions which roles get which permissions
--    core.user_roles       which auth.users have which roles
--
--  The DATABASE is the real guard: every module's RLS policies call
--  core.has_permission('<module>.<action>'). The UI only mirrors this.
--
--  After applying: add `core` to  Project Settings -> API -> Exposed schemas.
-- =====================================================================

create schema if not exists core;

-- ---------------------------------------------------------------------
--  Catalog tables
-- ---------------------------------------------------------------------
create table if not exists core.roles (
  id       uuid primary key default gen_random_uuid(),
  key      text not null unique,          -- 'owner', 'manager', ... (stable id, never renamed)
  label_he text,                          -- bilingual display labels (HE default + Levantine AR),
  label_ar text,                          --   the single source of a role's name (editable in the users module)
  sort     int  not null default 100
);
-- existing installs: create-if-not-exists is a no-op above, so add the bilingual
-- columns explicitly (idempotent). The legacy single-language `label` column is
-- migrated into these and dropped in the seed section below.
alter table core.roles add column if not exists label_he text;
alter table core.roles add column if not exists label_ar text;
-- ...and relax the legacy `label` NOT NULL first, so the label-less seed insert
-- below succeeds on a pre-bilingual DB (ON CONFLICT DO NOTHING does not suppress
-- a NOT NULL violation — it's checked before the conflict resolves). Guarded so
-- it's a no-op once `label` has been dropped / on fresh installs.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'core' and table_name = 'roles' and column_name = 'label') then
    alter table core.roles alter column label drop not null;
  end if;
end $$;

create table if not exists core.modules (
  id      uuid primary key default gen_random_uuid(),
  key     text not null unique,        -- 'users', 'pos', 'crm', ...
  label   text not null,
  icon    text,                        -- emoji or icon name for the launcher
  enabled boolean not null default true,
  sort    int  not null default 100
);

create table if not exists core.permissions (
  id     uuid primary key default gen_random_uuid(),
  key    text not null unique,         -- '<module>.<action>', e.g. 'pos.refund'
  module text not null references core.modules(key) on update cascade,
  action text not null,                -- 'view', 'create', 'refund', 'manage', ...
  label  text not null
);

create table if not exists core.role_permissions (
  role_id       uuid not null references core.roles(id)       on delete cascade,
  permission_id uuid not null references core.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists core.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references core.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- ---------------------------------------------------------------------
--  Permission helpers  (SECURITY DEFINER so they bypass RLS to read
--  the current user's roles; search_path locked for safety)
-- ---------------------------------------------------------------------
-- The permission check, parameterized by user_id — the single source of truth
-- for "does this user hold this permission." Server-side (service-role) callers
-- with no auth.uid() session (e.g. the admin-invite Edge Function checking the
-- *inviting* user) call this directly; has_permission() below is the auth.uid()
-- convenience wrapper every RLS policy uses.
create or replace function core.has_permission_for(target_user uuid, perm_key text)
returns boolean
language sql stable security definer
set search_path = core, public
as $$
  select exists (
    select 1
    from core.user_roles ur
    join core.role_permissions rp on rp.role_id = ur.role_id
    join core.permissions p       on p.id = rp.permission_id
    where ur.user_id = target_user
      and p.key = perm_key
  );
$$;

create or replace function core.has_permission(perm_key text)
returns boolean
language sql stable security definer
set search_path = core, public
as $$
  select core.has_permission_for(auth.uid(), perm_key);
$$;

-- Permission gate for SECURITY DEFINER functions — the ONE denial format
-- (added 2026-07-15; use this instead of minting per-module inline checks).
-- Client JWTs (anon / authenticated) are checked: anon's auth.uid() is null,
-- so has_permission() is false and it raises. Callers with no client JWT —
-- the SQL editor, management-API scripts, service_role (Edge Functions) —
-- pass: they already run with elevated trust, and permission-checking them
-- against core.user_roles is meaningless (no uid). Bilingual message per
-- ARCHITECTURE.md invariant 5 (these surface in the UI).
create or replace function core.require(perm_key text)
returns void
language plpgsql security definer
set search_path = core, public
as $$
declare
  jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if jwt_role not in ('anon', 'authenticated') then
    return;
  end if;
  if not core.has_permission(perm_key) then
    raise exception using message =
      'אין הרשאה (' || perm_key || ') / لا توجد صلاحية (' || perm_key || ')';
  end if;
end;
$$;

-- All permission keys the current user holds (UI loads this once, then gates locally).
-- COUPLING NOTE: the users module derives this same roles→grants union
-- client-side (by-user lens + view-as preview, modules/users/UsersAdmin.tsx).
-- If this function ever gains logic beyond the plain role join (per-user
-- overrides, deny rules), update those derivations too.
create or replace function core.my_permissions()
returns text[]
language sql stable security definer
set search_path = core, public
as $$
  select coalesce(array_agg(distinct p.key), '{}')
  from core.user_roles ur
  join core.role_permissions rp on rp.role_id = ur.role_id
  join core.permissions p       on p.id = rp.permission_id
  where ur.user_id = auth.uid();
$$;

-- Modules the current user may open (has '<module>.view') — drives the launcher.
-- COUPLING NOTE: the launcher's view-as preview narrows this function's result
-- with the same '<key>.view' rule client-side (shell/Launcher.tsx). If the
-- visibility rule here ever changes, update that filter too.
create or replace function core.my_modules()
returns setof core.modules
language sql stable security definer
set search_path = core, public
as $$
  select m.*
  from core.modules m
  where m.enabled
    and core.has_permission(m.key || '.view')
  order by m.sort, m.label;
$$;

-- Admin: list all auth users with their assigned role keys + last sign-in.
-- auth.users is not client-queryable, so this SECURITY DEFINER fn exposes a safe slice,
-- gated by 'users.manage' OR 'users.view' (view-only holders get the same read data;
-- the UI's canManage flag already disables every mutating control for them).
-- drop-first: adding last_sign_in_at (2026-07-16) then banned_until (2026-07-16,
-- delete/deactivate initiative) then email_confirmed_at (2026-07-30) changed the
-- return type, which `create or replace` refuses; the blanket grant below
-- re-covers it on re-run.
-- email_confirmed_at is exposed because an unconfirmed address can't sign in at
-- all while the project runs with mailer_autoconfirm off (GoTrue answers the
-- password grant with email_not_confirmed) — so "invited but never accepted" is
-- an admin-actionable account state, not a cosmetic detail. The users module
-- surfaces it on the row and offers confirm_email (admin-user-ops).
drop function if exists core.admin_list_users();
create function core.admin_list_users()
returns table (user_id uuid, email text, created_at timestamptz,
               last_sign_in_at timestamptz, banned_until timestamptz,
               email_confirmed_at timestamptz, roles text[])
language sql stable security definer
set search_path = core, public, auth
as $$
  select u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
         u.email_confirmed_at,
         coalesce(array_agg(r.key order by r.sort) filter (where r.key is not null), '{}')
  from auth.users u
  left join core.user_roles ur on ur.user_id = u.id
  left join core.roles r       on r.id = ur.role_id
  where core.has_permission('users.manage') or core.has_permission('users.view')
  group by u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
           u.email_confirmed_at
  order by u.created_at;
$$;

-- ---------------------------------------------------------------------
--  Last-admin lockout guard
--  Refuses any statement that would leave zero users holding 'users.manage' —
--  fires AFTER the statement (sees the resulting state) so a bulk delete/update
--  is checked once for its net effect; raising here rolls back the whole
--  statement. HE+AR message (ARCHITECTURE.md invariant 5: bilingual, anything
--  user-facing — this surfaces as a Postgres error in the UI).
-- ---------------------------------------------------------------------
create or replace function core.guard_users_manage_survives()
returns trigger
language plpgsql security definer
set search_path = core, public
as $$
begin
  -- Bootstrap bypass. A from-scratch install (local stack / new staging project)
  -- applies the whole schema in one migration BEFORE any admin user is seeded —
  -- the roles/permissions writes here would otherwise trip this guard with no
  -- admin yet to find (prod never hits this: it only ever re-runs these files
  -- with an owner already present). Allow ONLY when the bootstrap flag is set
  -- AND the session did NOT log in through the data API. session_user is the
  -- login role and is immune to this function's SECURITY DEFINER context (and
  -- to SET ROLE): migrations connect as `postgres`, while every runtime request
  -- comes through PostgREST as `authenticator` (then SET ROLE authenticated/
  -- anon/service_role). So a client can set the flag but never satisfy the
  -- session_user check — it can never bypass the guard.
  if current_setting('levyam.bootstrap', true) = 'on'
     and session_user not in ('authenticator', 'authenticated', 'anon') then
    return null;
  end if;
  if not exists (
    select 1
    from core.user_roles ur
    join core.role_permissions rp on rp.role_id = ur.role_id
    join core.permissions p       on p.id = rp.permission_id
    where p.key = 'users.manage'
  ) then
    raise exception using message =
      'לא ניתן לבצע פעולה זו — לפחות משתמש אחד חייב להחזיק בהרשאת ניהול משתמשים (users.manage)'
      || ' / لا يمكن تنفيذ هذا الإجراء — يجب أن يحتفظ مستخدم واحد على الأقل بصلاحية إدارة المستخدمين (users.manage)';
  end if;
  return null; -- AFTER trigger (statement- and row-level): return value is ignored
end;
$$;

drop trigger if exists trg_user_roles_guard_manage on core.user_roles;
create trigger trg_user_roles_guard_manage
  after delete or update on core.user_roles
  for each statement execute function core.guard_users_manage_survives();

-- Deleting an auth.users row cascades into user_roles, and (same Postgres rule
-- as the roles/permissions note below) FK-cascaded child deletes never fire the
-- child's STATEMENT-level trigger — so hard-deleting the last admin's account
-- (admin-user-ops Edge Function) would bypass the guard above. This ROW-level
-- twin closes that hole: AFTER ROW triggers are queued to the end of the
-- outer statement, so it checks the same net state. Delete-only on purpose —
-- a DELETE can only shrink the holder set, so per-row checks can't false-
-- positive, and apply_role_permissions' adds-before-removes statement
-- semantics (on role_permissions) are untouched.
drop trigger if exists trg_user_roles_guard_manage_row on core.user_roles;
create trigger trg_user_roles_guard_manage_row
  after delete on core.user_roles
  for each row execute function core.guard_users_manage_survives();

drop trigger if exists trg_role_permissions_guard_manage on core.role_permissions;
create trigger trg_role_permissions_guard_manage
  after delete or update on core.role_permissions
  for each statement execute function core.guard_users_manage_survives();

-- Deleting a role/permission row cascades into role_permissions/user_roles,
-- but Postgres does NOT fire statement-level triggers for FK-cascaded deletes
-- on the child tables — so the role_permissions guard above never sees a
-- cascade. These direct triggers on the parent tables close that hole: they
-- run AFTER the user's own statement, when the cascade has already landed,
-- so the guard checks the true net state. (For permissions, a key rename
-- also touches no other table — same trigger covers it.)
drop trigger if exists trg_permissions_guard_manage on core.permissions;
create trigger trg_permissions_guard_manage
  after update or delete on core.permissions
  for each statement execute function core.guard_users_manage_survives();

drop trigger if exists trg_roles_guard_manage on core.roles;
create trigger trg_roles_guard_manage
  after update or delete on core.roles
  for each statement execute function core.guard_users_manage_survives();

-- A role still assigned to any user must not be deleted out from under them:
-- the FK cascade would strip it from those users, leaving anyone whose only
-- role it was with zero roles and zero permissions. Block the delete (BEFORE,
-- so it fires ahead of the cascade) and make the owner un-assign it first.
-- NOTE: this BEFORE guard now *shadows* the trg_roles_guard_manage DELETE
-- branch above — any role whose deletion could strip the last users.manage
-- holder must be assigned to someone, so this raises 'role_in_use' first. The
-- last-admin trigger's role-DELETE path is therefore defense-in-depth only
-- (it still guards role UPDATEs and permission/role_permission changes); if
-- this in-use guard is ever relaxed, that path becomes load-bearing again.
create or replace function core.guard_role_not_in_use()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from core.user_roles where role_id = old.id) then
    raise exception 'role_in_use' using errcode = 'P0001';
  end if;
  return old;
end $$;

drop trigger if exists trg_roles_guard_in_use on core.roles;
create trigger trg_roles_guard_in_use
  before delete on core.roles
  for each row execute function core.guard_role_not_in_use();

-- ---------------------------------------------------------------------
--  Audit log — who changed which role/permission grant, and when.
--  Trigger-written only: 'authenticated' has no insert/update/delete grant on
--  this table (see grants below), so the security-definer trigger function
--  (running as the table owner) is the only writer. Read gated to users.manage —
--  scoped to the identity tables audited today; a future module attaching this
--  trigger to its own schema needs its own read policy (module-manage, not
--  users.manage), since this table has no per-row module scoping.
-- ---------------------------------------------------------------------
create table if not exists core.audit_log (
  id         uuid primary key default gen_random_uuid(),
  at         timestamptz not null default now(),
  actor      uuid default auth.uid(),
  action     text not null,   -- 'insert' | 'update' | 'delete'
  table_name text not null,
  row_data   jsonb not null
);

alter table core.audit_log enable row level security;

drop policy if exists core_audit_log_read on core.audit_log;
create policy core_audit_log_read on core.audit_log for select to authenticated
  using ((select core.has_permission('users.manage')));

create or replace function core.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = core, public
as $$
begin
  -- auth.uid() is null for service-role callers (Edge Functions) — they set
  -- levyam.audit_actor (see core.admin_assign_role) so the real actor still
  -- lands here instead of a blank actor on the one write path that most needs it.
  insert into core.audit_log (actor, action, table_name, row_data)
  values (
    coalesce(nullif(current_setting('levyam.audit_actor', true), '')::uuid, auth.uid()),
    lower(tg_op), tg_table_name,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_audit_user_roles on core.user_roles;
create trigger trg_audit_user_roles
  after insert or update or delete on core.user_roles
  for each row execute function core.write_audit_log();

drop trigger if exists trg_audit_role_permissions on core.role_permissions;
create trigger trg_audit_role_permissions
  after insert or update or delete on core.role_permissions
  for each row execute function core.write_audit_log();

drop trigger if exists trg_audit_roles on core.roles;
create trigger trg_audit_roles
  after insert or update or delete on core.roles
  for each row execute function core.write_audit_log();

drop trigger if exists trg_audit_permissions on core.permissions;
create trigger trg_audit_permissions
  after insert or update or delete on core.permissions
  for each row execute function core.write_audit_log();

drop trigger if exists trg_audit_modules on core.modules;
create trigger trg_audit_modules
  after insert or update or delete on core.modules
  for each row execute function core.write_audit_log();

-- Apply a batch of permission-matrix edits atomically — the users module's
-- explicit Save calls this once instead of sequencing REST writes, so a
-- half-applied matrix is impossible (any failure rolls the whole batch back).
-- SECURITY INVOKER on purpose: RLS still gates every row (users.manage), and
-- the last-admin guard fires per statement. Adds run before removes so moving
-- users.manage between roles never passes through a zero-holders state.
create or replace function core.apply_role_permissions(p_adds jsonb default '[]', p_removes jsonb default '[]')
returns void
language plpgsql
set search_path = core, public
as $$
begin
  -- loud up-front check: without it, a caller whose users.manage was revoked
  -- mid-session gets a silent success on a removes-only batch (RLS turns the
  -- deletes into 0-row noops while inserts would at least raise 42501)
  perform core.require('users.manage');
  insert into core.role_permissions (role_id, permission_id)
  select (e->>'role_id')::uuid, (e->>'permission_id')::uuid
  from jsonb_array_elements(p_adds) e
  on conflict do nothing;

  delete from core.role_permissions rp
  using jsonb_array_elements(p_removes) e
  where rp.role_id       = (e->>'role_id')::uuid
    and rp.permission_id = (e->>'permission_id')::uuid;
end;
$$;

-- Assign a role on behalf of a verified actor — for service-role callers
-- (the admin-invite Edge Function) that have no auth.uid() session of their
-- own. p_actor must already be verified by the caller (re-checking
-- users.manage here would be redundant with the Edge Function's own check,
-- which runs first); this function's only job is making sure that actor,
-- not a blank one, lands in the audit log for the insert it performs.
create or replace function core.admin_assign_role(p_user_id uuid, p_role_id uuid, p_actor uuid)
returns void
language plpgsql security definer
set search_path = core, public
as $$
begin
  perform set_config('levyam.audit_actor', p_actor::text, true);
  insert into core.user_roles (user_id, role_id) values (p_user_id, p_role_id)
  on conflict do nothing;
end;
$$;

-- "Would users.manage still have an active holder if p_user were gone?"
-- The admin-user-ops Edge Function's lockout check: the ONLY enforcement for
-- deactivate (a GoTrue ban touches no core table, so no trigger can see it —
-- banned holders are excluded here for the same reason), and a friendly
-- pre-check for delete (the row-level guard trigger above stays the real
-- guard there). service_role-only, like has_permission_for: it answers
-- questions about arbitrary users.
create or replace function core.users_manage_survives_without(p_user uuid)
returns boolean
language sql stable security definer
set search_path = core, public, auth
as $$
  select exists (
    select 1
    from core.user_roles ur
    join core.role_permissions rp on rp.role_id = ur.role_id
    join core.permissions p       on p.id = rp.permission_id
    join auth.users u             on u.id = ur.user_id
    where p.key = 'users.manage'
      and ur.user_id <> p_user
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

-- Audit writer for auth-level user lifecycle events (delete / deactivate /
-- reactivate). Needed because those act through the GoTrue admin API on its
-- own connection: `levyam.audit_actor` can't reach the cascade-fired audit
-- rows of a delete, and a ban touches no audited table at all. Same trust
-- model as admin_assign_role: p_actor is verified by the Edge Function first,
-- so this must never be callable by authenticated (revoked below).
create or replace function core.admin_audit_user_event(p_actor uuid, p_action text, p_data jsonb)
returns void
language sql security definer
set search_path = core, public
as $$
  insert into core.audit_log (actor, action, table_name, row_data)
  values (p_actor, p_action, 'auth.users', p_data);
$$;

-- ---------------------------------------------------------------------
--  Row-Level Security
--    Catalog (roles/modules/permissions/role_permissions): any signed-in
--    user may READ; only 'users.manage' may WRITE.
--    user_roles: a user reads their own; 'users.manage' reads/writes all.
-- ---------------------------------------------------------------------
alter table core.roles            enable row level security;
alter table core.modules          enable row level security;
alter table core.permissions      enable row level security;
alter table core.role_permissions enable row level security;
alter table core.user_roles       enable row level security;

-- (select ...) wrapper on has_permission()/auth.uid() = one InitPlan eval per
-- statement, not per row — see MODULE-TEMPLATE.md §1.
drop policy if exists core_roles_read       on core.roles;
drop policy if exists core_modules_read     on core.modules;
drop policy if exists core_perms_read       on core.permissions;
drop policy if exists core_role_perms_read  on core.role_permissions;
drop policy if exists core_roles_write      on core.roles;
drop policy if exists core_modules_write    on core.modules;
drop policy if exists core_perms_write      on core.permissions;
drop policy if exists core_role_perms_write on core.role_permissions;
drop policy if exists core_user_roles_read  on core.user_roles;
drop policy if exists core_user_roles_write on core.user_roles;

-- catalog: read for all authenticated
create policy core_roles_read       on core.roles            for select to authenticated using (true);
create policy core_modules_read     on core.modules          for select to authenticated using (true);
create policy core_perms_read       on core.permissions      for select to authenticated using (true);
create policy core_role_perms_read  on core.role_permissions for select to authenticated using (true);

-- catalog: write only for users.manage
create policy core_roles_write      on core.roles            for all to authenticated
  using ((select core.has_permission('users.manage'))) with check ((select core.has_permission('users.manage')));
create policy core_modules_write    on core.modules          for all to authenticated
  using ((select core.has_permission('users.manage'))) with check ((select core.has_permission('users.manage')));
create policy core_perms_write      on core.permissions      for all to authenticated
  using ((select core.has_permission('users.manage'))) with check ((select core.has_permission('users.manage')));
create policy core_role_perms_write on core.role_permissions for all to authenticated
  using ((select core.has_permission('users.manage'))) with check ((select core.has_permission('users.manage')));

-- user_roles: read own OR if you manage users
create policy core_user_roles_read  on core.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select core.has_permission('users.manage')));
-- user_roles: only users.manage may assign/revoke
create policy core_user_roles_write on core.user_roles for all to authenticated
  using ((select core.has_permission('users.manage'))) with check ((select core.has_permission('users.manage')));

-- ---------------------------------------------------------------------
--  Grants  (RLS still applies on top of these)
-- ---------------------------------------------------------------------
grant usage on schema core to authenticated;
grant select on all tables in schema core to authenticated;
-- DML on every table the *_write policies cover, so an admin (users.manage) can actually
-- write. RLS still gates each statement; the grant just unblocks the privilege layer.
grant insert, update, delete on
  core.roles, core.modules, core.permissions, core.role_permissions, core.user_roles
  to authenticated;
grant execute on all functions in schema core to authenticated;
-- Close the PUBLIC-execute bug CLASS, not just today's instances: Postgres
-- grants EXECUTE to PUBLIC by default on every function create, so a
-- per-function `revoke ... from authenticated` is a silent no-op while PUBLIC
-- stands — that is exactly how the admin_assign_role self-grant-owner hole
-- reached prod (found + closed 2026-07-16, delete/deactivate initiative).
-- Stripping PUBLIC once here means any future service-role-only definer
-- function is locked down by default; the explicit `to authenticated` grant
-- above is what keeps the legitimately-callable functions reachable, and no
-- core function is meant to be anon-callable (core is login-gated).
revoke execute on all functions in schema core from public;
-- admin_assign_role trusts its p_actor argument completely (no internal
-- permission check — see its comment) and is SECURITY DEFINER, so it must
-- NOT be callable by authenticated (the blanket grant above would otherwise
-- let anyone hand themselves the owner role); service_role only, and only
-- the already-permission-checked admin-invite function calls it. The explicit
-- per-function revokes below are defense-in-depth + documentation on top of
-- the blanket revoke — they also strip authenticated's explicit grant.
revoke execute on function core.admin_assign_role(uuid, uuid, uuid) from public, authenticated;
-- has_permission_for(target_user, ...) answers for ANY user, not just the
-- caller (unlike has_permission(), which is auth.uid()-bound) — without this
-- revoke, the blanket grant above would let any signed-in user probe a
-- coworker's permissions (e.g. fingerprint who holds users.manage) via RPC,
-- bypassing the RLS that otherwise restricts that to users.manage holders.
-- Server-side (service-role) callers only, per its own comment. (from public:
-- see the admin_assign_role revoke note — `from authenticated` alone is a no-op.)
revoke execute on function core.has_permission_for(uuid, text) from public, authenticated;
-- Same reasoning for the admin-user-ops helpers: one probes an arbitrary
-- user's permissions, the other writes audit rows with a caller-supplied actor.
revoke execute on function core.users_manage_survives_without(uuid) from public, authenticated;
revoke execute on function core.admin_audit_user_event(uuid, text, jsonb) from public, authenticated;

-- service_role has no default grants on core (see MODULE-TEMPLATE.md §1's
-- "admin/import work runs through the management API" default) — narrow,
-- explicit, function-scoped grants for what admin-invite genuinely needs are
-- the established exception (same pattern as 01_passkeys.sql's passkeys/
-- webauthn_challenges grants for passkey-verify).
grant usage on schema core to service_role;
grant select on core.roles to service_role;
grant execute on function core.has_permission_for(uuid, text) to service_role;
grant execute on function core.admin_assign_role(uuid, uuid, uuid) to service_role;
-- admin-user-ops (delete / deactivate / reactivate users)
grant execute on function core.users_manage_survives_without(uuid) to service_role;
grant execute on function core.admin_audit_user_event(uuid, text, jsonb) to service_role;

-- =====================================================================
--  SEED DATA  (idempotent — safe to re-run)
-- =====================================================================
insert into core.roles (key, label_he, label_ar, sort) values
  ('owner',   'בעלים', 'مالك',   10),
  ('manager', 'ניהול', 'إدارة',  20),
  ('staff',   'צוות',  'طاقم',   30),
  ('viewer',  'צפייה', 'مشاهدة', 40)
on conflict (key) do nothing;
-- Backfill bilingual labels for built-ins ONLY where not already set — a re-run
-- must never clobber an owner's rename (built-ins are renameable). New installs
-- already have them from the insert above; this fills pre-bilingual prod rows.
update core.roles r set label_he = d.he, label_ar = d.ar
from (values
  ('owner',   'בעלים', 'مالك'),
  ('manager', 'ניהול', 'إدارة'),
  ('staff',   'צוות',  'طاقم'),
  ('viewer',  'צפייה', 'مشاهدة')
) as d(key, he, ar)
where r.key = d.key and (r.label_he is null or r.label_ar is null);
-- Retire the legacy single-language `label` column: bilingual label_he/label_ar
-- are now the one source of a role's name. Guarded so it's a no-op on fresh
-- installs (no `label` column) and idempotent on re-run (already dropped).
-- Custom roles created before the bilingual columns land carry their old name
-- forward via coalesce. plpgsql defers planning the guarded statements, so the
-- reference to `label` never errors when the column is already gone.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'core' and table_name = 'roles' and column_name = 'label') then
    update core.roles set label_he = coalesce(label_he, label),
                          label_ar = coalesce(label_ar, label)
      where label_he is null or label_ar is null;
    alter table core.roles drop column label;
  end if;
end $$;

-- Each module seeds its own core.modules row, permission keys, and role grants
-- in its own schema file (20_finance / 30_quotes / 40_events / 42_pos_platform) —
-- this file seeds only what the core identity module itself owns. The Phase-0
-- placeholder pos.* seeds that used to live here were retired by
-- 42_pos_platform.sql (pos.create_bill / pos.refund deleted from prod); keeping
-- them out of this file keeps a re-run from resurrecting them.
insert into core.modules (key, label, icon, sort) values
  ('users', 'Users & Permissions', '🔐', 10)
on conflict (key) do nothing;

insert into core.permissions (key, module, action, label) values
  ('users.view',        'users', 'view',        'View users & roles'),
  ('users.manage',      'users', 'manage',      'Manage users, roles & permissions'),
  ('users.delete',      'users', 'delete',      'Delete or deactivate users'),
  ('users.password',    'users', 'password',    'Set or reset user passwords')
on conflict (key) do nothing;

-- role -> permission grants
--   owner:   everything seeded so far (module files re-grant for their own keys)
--   manager: see users (module files grant the rest)
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r, core.permissions p
where r.key = 'owner'
on conflict do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.key in
  ('users.view')
where r.key = 'manager'
on conflict do nothing;

-- ---------------------------------------------------------------------
--  BOOTSTRAP THE FIRST OWNER
--  After creating your first user in Auth, run (replace the email):
--
--    insert into core.user_roles (user_id, role_id)
--    select u.id, r.id
--    from auth.users u, core.roles r
--    where u.email = 'you@levyam.com' and r.key = 'owner'
--    on conflict do nothing;
-- ---------------------------------------------------------------------

-- =====================================================================
-- schema/01_passkeys.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — PASSKEYS (WebAuthn / Face ID) for core auth
--  Run AFTER 00_core.sql, in the Supabase SQL editor.
--
--  Two tables in `core`:
--    core.passkeys             stored WebAuthn credentials (public keys)
--    core.webauthn_challenges  short-lived register/login challenges
--
--  Writes happen ONLY from the `passkey-verify` Edge Function (service role,
--  bypasses RLS). Clients may read/delete their OWN passkeys; challenges are
--  never client-accessible.
-- =====================================================================

create table if not exists core.passkeys (
  id           text primary key,                       -- credential ID (base64url)
  user_id      uuid not null references auth.users(id) on delete cascade,
  public_key   text not null,                          -- COSE public key (base64url)
  counter      bigint not null default 0,
  transports   text[],
  label        text,                                   -- device label, e.g. 'MacBook'
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_id_idx on core.passkeys (user_id);

create table if not exists core.webauthn_challenges (
  id         uuid primary key default gen_random_uuid(),
  challenge  text not null,
  user_id    uuid references auth.users(id) on delete cascade,  -- set for 'register'
  kind       text not null check (kind in ('register', 'login')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

-- ---------------------------------------------------------------------
--  RLS
-- ---------------------------------------------------------------------
alter table core.passkeys            enable row level security;
alter table core.webauthn_challenges enable row level security;

-- passkeys: a user sees & removes only their own. Inserts/updates come from the
-- Edge Function (service role) — no write policy is granted to clients.
-- (select auth.uid()) rather than bare auth.uid(): the planner evaluates it once
-- per statement (InitPlan) instead of per row — see MODULE-TEMPLATE.md §1.
drop policy if exists passkeys_read_own   on core.passkeys;
drop policy if exists passkeys_delete_own on core.passkeys;
create policy passkeys_read_own   on core.passkeys for select to authenticated
  using (user_id = (select auth.uid()));
create policy passkeys_delete_own on core.passkeys for delete to authenticated
  using (user_id = (select auth.uid()));

-- challenges: RLS on, ZERO policies => no client (anon/authenticated) access at all.
-- Only the service role (Edge Function) touches this table.

-- Clients may read/delete their own passkeys; challenges get nothing.
grant select, delete on core.passkeys to authenticated;
-- (intentionally NO grant on core.webauthn_challenges for clients)

-- The passkey-verify Edge Function runs as service_role. BYPASSRLS skips policies
-- but NOT table grants, and a custom schema isn't auto-granted — so grant explicitly.
grant usage on schema core to service_role;
grant select, insert, update, delete on core.passkeys, core.webauthn_challenges to service_role;

-- ---------------------------------------------------------------------
--  Housekeeping: drop expired challenges. Call opportunistically from the
--  Edge Function, or schedule via pg_cron if available.
-- ---------------------------------------------------------------------
create or replace function core.purge_expired_challenges()
returns void
language sql security definer
set search_path = core, public
as $$
  delete from core.webauthn_challenges where expires_at < now();
$$;
grant execute on function core.purge_expired_challenges() to service_role;

-- =====================================================================
-- schema/10_pos.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam POS — analytics-ready schema (idempotent: safe to re-run in the SQL editor)
--  Tables:  pos_tables (live), pos_bills (paid), pos_bill_items (lines)
--  RPC:     pos_close_table, pos_reopen_bill
--  Views:   v_sales_daily, v_item_sales, v_category_sales, v_sales_hourly
-- =====================================================================

-- 1) LIVE OPEN TABLES — operational state, syncs across devices
create table if not exists public.pos_tables (
  id              text primary key,
  num             int,
  name            text,
  guests_adults   int  not null default 0,
  guests_children int  not null default 0,
  pricing_mode    text not null default 'open_house',   -- 'open_house' | 'a_la_carte'
  opened_at       timestamptz not null default now(),
  items           jsonb not null default '[]'::jsonb,    -- live cart (drives the UI)
  updated_at      timestamptz not null default now()
);

-- 2) BILLS — one row per paid bill (money + timing)
create table if not exists public.pos_bills (
  id               text primary key,
  table_num        int,
  name             text,
  status           text not null default 'paid',         -- 'paid' | 'voided'
  closed_by        text,                                  -- for future per-staff analytics
  guests_adults    int  not null default 0,
  guests_children  int  not null default 0,
  headcount        int  generated always as (guests_adults + guests_children) stored,
  pricing_mode     text not null default 'open_house',
  opened_at        timestamptz,
  paid_at          timestamptz not null default now(),
  duration_minutes int  generated always as
        ((greatest(0, extract(epoch from (paid_at - opened_at)) / 60))::int) stored,
  items_count      int     not null default 0,
  oh_charge        numeric not null default 0,            -- open-house cover portion
  extras_total     numeric not null default 0,            -- a la carte / extras portion
  menu_value       numeric not null default 0,            -- all items valued at menu price
  discount         numeric not null default 0,            -- taken off the gross bill
  grand_total      numeric not null default 0,            -- net amount charged (gross − discount)
  tip              numeric not null default 0,            -- overpayment kept as tip (on top of grand_total)
  cash_paid        numeric not null default 0,
  card_paid        numeric not null default 0,
  paid_total       numeric generated always as (cash_paid + card_paid) stored, -- = grand_total + tip
  items            jsonb   not null default '[]'::jsonb,  -- snapshot for re-open / receipt
  archived_at      timestamptz,                           -- hidden from day view, kept for analytics
  created_at       timestamptz not null default now()
);
create index if not exists pos_bills_paid_at_idx on public.pos_bills (paid_at);
create index if not exists pos_bills_status_idx  on public.pos_bills (status);

-- MIGRATION for an existing live DB (safe to re-run; no-op on a fresh setup):
alter table public.pos_bills add column if not exists discount numeric not null default 0;
alter table public.pos_bills add column if not exists tip      numeric not null default 0;

-- 3) BILL ITEMS — one row per item line (item-level analytics)
create table if not exists public.pos_bill_items (
  id             bigint generated always as identity primary key,
  bill_id        text not null references public.pos_bills(id) on delete cascade,
  table_num      int,
  paid_at        timestamptz not null default now(),
  item_name      text not null,
  category       text,
  is_open_house  boolean not null default false,
  is_custom      boolean not null default false,
  unit_price     numeric not null default 0,
  qty            int     not null default 0,
  line_total     numeric generated always as (unit_price * qty) stored
);
create index if not exists pos_bill_items_paid_at_idx   on public.pos_bill_items (paid_at);
create index if not exists pos_bill_items_item_name_idx on public.pos_bill_items (item_name);
create index if not exists pos_bill_items_bill_id_idx   on public.pos_bill_items (bill_id);

-- 3b) DAILY COSTS — chef logs food/receipts, manager logs labor; tagged to a business date
create table if not exists public.pos_expenses (
  id            bigint generated always as identity primary key,
  business_date date not null,
  kind          text not null,                 -- 'food' | 'labor'
  amount        numeric not null default 0,
  note          text,
  created_by    text,                           -- role/name that entered it
  created_at    timestamptz not null default now()
);
create index if not exists pos_expenses_date_idx on public.pos_expenses (business_date);

-- 4) Atomic close: bill + items written, open table removed — one transaction
create or replace function public.pos_close_table(p_bill jsonb, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id text := p_bill->>'id';
begin
  insert into public.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, discount, grand_total, tip, cash_paid, card_paid, items
  ) values (
    v_id,
    (p_bill->>'table_num')::int, p_bill->>'name',
    coalesce(p_bill->>'status','paid'), p_bill->>'closed_by',
    coalesce((p_bill->>'guests_adults')::int,0),
    coalesce((p_bill->>'guests_children')::int,0),
    coalesce(p_bill->>'pricing_mode','open_house'),
    (p_bill->>'opened_at')::timestamptz,
    coalesce((p_bill->>'paid_at')::timestamptz, now()),
    coalesce((p_bill->>'items_count')::int,0),
    coalesce((p_bill->>'oh_charge')::numeric,0),
    coalesce((p_bill->>'extras_total')::numeric,0),
    coalesce((p_bill->>'menu_value')::numeric,0),
    coalesce((p_bill->>'discount')::numeric,0),
    coalesce((p_bill->>'grand_total')::numeric,0),
    coalesce((p_bill->>'tip')::numeric,0),
    coalesce((p_bill->>'cash_paid')::numeric,0),
    coalesce((p_bill->>'card_paid')::numeric,0),
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
    discount=excluded.discount, tip=excluded.tip,
    grand_total=excluded.grand_total, items=excluded.items;

  delete from public.pos_bill_items where bill_id = v_id;
  insert into public.pos_bill_items
    (bill_id, table_num, paid_at, item_name, category, is_open_house, is_custom, unit_price, qty)
  select v_id, (p_bill->>'table_num')::int,
         coalesce((p_bill->>'paid_at')::timestamptz, now()),
         it->>'item_name', it->>'category',
         coalesce((it->>'is_open_house')::boolean,false),
         coalesce((it->>'is_custom')::boolean,false),
         coalesce((it->>'unit_price')::numeric,0),
         coalesce((it->>'qty')::int,0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as it;

  delete from public.pos_tables where id = v_id;
end; $$;

-- 5) Atomic re-open: bill back to an open table (removes the bill so no double-count)
create or replace function public.pos_reopen_bill(p_id text, p_num int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.pos_tables (id, num, name, guests_adults, guests_children, pricing_mode, opened_at, items)
  select b.id, p_num, b.name, b.guests_adults, b.guests_children, b.pricing_mode, b.opened_at, b.items
  from public.pos_bills b where b.id = p_id;
  delete from public.pos_bills where id = p_id;
end; $$;

-- 5b) Kitchen pipeline. Each line in pos_tables.items carries counts: qty (ordered) →
--     sent (fired to kitchen) → done (cooked) → served (delivered). Derived per line:
--       to-send = qty-sent · cooking = sent-done · ready = done-served.
--     The waiter owns qty/sent/served (normal table sync); the chef owns `done`, set via
--     this atomic per-item RPC so the chef's tap never clobbers a waiter editing the table.
--       p_ready = true  → done = sent    (mark the cooking batch ready)
--       p_ready = false → done = served  (undo back to cooking)
create or replace function public.pos_mark_item(p_id text, p_item_id text, p_ready boolean)
returns void language sql security definer set search_path = public as $$
  update public.pos_tables t
  set items = coalesce((
        select jsonb_agg(
          case when e->>'id' = p_item_id
               then e || jsonb_build_object('done',
                      case when p_ready then coalesce((e->>'sent')::int, 0)
                                        else coalesce((e->>'served')::int, 0) end)
               else e end)
        from jsonb_array_elements(t.items) e), '[]'::jsonb),
      updated_at = now()
  where t.id = p_id;
$$;

-- 5c) Day report for a given business date (Asia/Jerusalem): sales summary + items sold +
--     expenses, in one jsonb blob. The app role-filters what it shows (chef = ops + food only,
--     manager = everything incl. revenue/labor/net). net = revenue − food − labor (client-side).
create or replace function public.pos_day_report(p_date date)
returns jsonb language sql security definer set search_path = public as $$
  with b as (
    select * from public.pos_bills
    where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date = p_date
  ),
  itm as (
    select item_name, category, sum(qty) as units, sum(line_total) as menu_value
    from public.pos_bill_items
    where (paid_at at time zone 'Asia/Jerusalem')::date = p_date
    group by item_name, category order by sum(qty) desc
  ),
  ex as (
    select * from public.pos_expenses where business_date = p_date order by created_at
  )
  select jsonb_build_object(
    'date', p_date,
    'summary', (select jsonb_build_object(
        'bills',     count(*),
        'covers',    coalesce(sum(headcount), 0),
        'revenue',   coalesce(sum(grand_total), 0),
        'cash',      coalesce(sum(cash_paid), 0),
        'card',      coalesce(sum(card_paid), 0),
        'tips',      coalesce(sum(tip), 0),
        'discounts', coalesce(sum(discount), 0),
        'avg_bill',  coalesce(round(avg(grand_total), 0), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0)
      ) from b),
    'food',  (select coalesce(sum(amount), 0) from ex where kind = 'food'),
    'labor', (select coalesce(sum(amount), 0) from ex where kind = 'labor'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', item_name, 'category', category, 'units', units, 'value', menu_value)) from itm), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'amount', amount, 'note', note, 'by', created_by, 'at', created_at)) from ex), '[]'::jsonb)
  );
$$;

-- 6) Ready-made analytics reports (drop first so column changes don't trip "cannot
--    change name of view column" — create-or-replace can only append columns)
drop view if exists public.v_sales_daily;
create or replace view public.v_sales_daily as
select (paid_at at time zone 'Asia/Jerusalem')::date as day,
       count(*) as bills, sum(headcount) as covers,
       sum(grand_total) as revenue, sum(cash_paid) as cash, sum(card_paid) as card,
       sum(tip) as tips, sum(discount) as discounts,
       round(avg(grand_total),2) as avg_bill, round(avg(duration_minutes),1) as avg_table_minutes
from public.pos_bills where status='paid' group by 1 order by 1 desc;

drop view if exists public.v_item_sales;
create or replace view public.v_item_sales as
select item_name, category, sum(qty) as units_sold,
       count(distinct bill_id) as times_ordered, sum(line_total) as menu_value
from public.pos_bill_items group by 1,2 order by units_sold desc;

drop view if exists public.v_category_sales;
create or replace view public.v_category_sales as
select category, sum(qty) as units_sold, sum(line_total) as menu_value
from public.pos_bill_items group by 1 order by units_sold desc;

drop view if exists public.v_sales_hourly;
create or replace view public.v_sales_hourly as
select extract(hour from (paid_at at time zone 'Asia/Jerusalem'))::int as hour,
       count(*) as bills, sum(headcount) as covers, sum(grand_total) as revenue
from public.pos_bills where status='paid' group by 1 order by 1;

-- 7) Realtime sync
do $$ begin alter publication supabase_realtime add table public.pos_tables; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.pos_bills;  exception when duplicate_object then null; end $$;

-- 8) Access (anon key may read/write; staff PIN in the app is the guard)
alter table public.pos_tables     enable row level security;
alter table public.pos_bills      enable row level security;
alter table public.pos_bill_items enable row level security;
alter table public.pos_expenses   enable row level security;
drop policy if exists "pos_tables anon"     on public.pos_tables;
drop policy if exists "pos_bills anon"      on public.pos_bills;
drop policy if exists "pos_bill_items anon" on public.pos_bill_items;
drop policy if exists "pos_expenses anon"   on public.pos_expenses;
create policy "pos_tables anon"     on public.pos_tables     for all to anon using (true) with check (true);
create policy "pos_bills anon"      on public.pos_bills      for all to anon using (true) with check (true);
create policy "pos_bill_items anon" on public.pos_bill_items for all to anon using (true) with check (true);
create policy "pos_expenses anon"   on public.pos_expenses   for all to anon using (true) with check (true);
-- Table privileges the RLS policies sit on top of (not auto-granted on newer projects)
grant select, insert, update, delete on public.pos_tables     to anon;
grant select, insert, update, delete on public.pos_bills      to anon;
grant select, insert, update, delete on public.pos_bill_items to anon;
grant select, insert, update, delete on public.pos_expenses   to anon;
grant execute on function public.pos_close_table(jsonb, jsonb)          to anon;
grant execute on function public.pos_reopen_bill(text, int)            to anon;
grant execute on function public.pos_mark_item(text, text, bool)       to anon;
grant execute on function public.pos_day_report(date)                  to anon;
grant select on public.v_sales_daily, public.v_item_sales, public.v_category_sales, public.v_sales_hourly to anon;

-- ── Platform integration (roles → permissions) ───────────────────────────────
-- The POS app currently enforces roles per-device; when it moves behind the /app
-- platform login, seed these into core.permissions / core.role_permissions:
--   pos.view     — see tables & orders        → waiter, chef, manager
--   pos.order    — add/edit items, pay, close → waiter, chef, manager
--   pos.kitchen  — kitchen queue, mark done   → chef, manager
--   pos.reports  — day summary / sales        → manager
--   pos.manage   — end-day, refunds, settings → manager
-- The app's can('pos.<action>') calls then read core.has_permission() instead of the
-- local device role — no UI change required.

-- =====================================================================
-- schema/20_finance.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — FINANCE module (whole-business income & expense ledger)
--  Run in the Supabase SQL editor AFTER 00_core.sql.
--
--  Separate from public.pos_expenses / pos_day_report (kitchen day-ops food/labor
--  costs inside the standalone pos.html) — this is the manager's whole-business
--  ledger: rent, salaries, bookings, donations, etc. Not reconciled with POS in v1.
-- =====================================================================

create schema if not exists finance;

-- ---------------------------------------------------------------------
--  finance.entries — one row per income or expense line item
-- ---------------------------------------------------------------------
create table if not exists finance.entries (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null,                 -- 'income' | 'expense'
  category       text not null,                 -- fixed enum, kind-specific (checked below)
  amount         numeric(12,2) not null,        -- sign policy lives in 21_finance_spine.sql
                                                 -- (manual rows > 0; derived module rows may
                                                 -- be negative — a reversal). NO inline
                                                 -- `check (amount > 0)` here: it auto-names
                                                 -- `entries_amount_check` and would override
                                                 -- the spine's module-aware rule.
  payment_method text,                          -- 'cash' | 'private' | 'grow' | 'bank' (nullable)
  entry_date     date not null default current_date,
  note           text,
  created_by     uuid not null default auth.uid() references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint finance_entries_kind_check check (kind in ('income','expense'))
  -- NO category CHECK here. The taxonomy is DATA since 54_finance_categories.sql
  -- (finance.categories + a composite FK on (kind, category)). A CHECK re-declared
  -- here would be re-added by any re-run of this file and would then reject every
  -- category the owner has added since — and unlike `create or replace`, an added
  -- constraint is not something a later file can own the absence of.
);

-- Idempotent add for databases created before payment_method existed.
alter table finance.entries add column if not exists payment_method text;
do $$ begin
  alter table finance.entries add constraint finance_entries_payment_check
    check (payment_method is null or payment_method in ('cash','private','grow','bank'));
exception when duplicate_object then null; end $$;

-- The category taxonomy used to be re-declared here as a CHECK constraint. It is
-- now owner-editable data — see 54_finance_categories.sql, which owns the list,
-- the HE/AR labels, the one-writer (`owned_by_module`) rule, and the FK that
-- enforces all of it. Nothing about categories belongs in this file any more.

create index if not exists finance_entries_date_idx on finance.entries (entry_date desc);
create index if not exists finance_entries_kind_idx on finance.entries (kind);

-- keep updated_at current on edits
create or replace function finance.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists finance_entries_touch on finance.entries;
create trigger finance_entries_touch
  before update on finance.entries
  for each row execute function finance.set_updated_at();

-- ---------------------------------------------------------------------
--  Range report: totals + net + category breakdown, one round trip for the
--  report tab. NOT security definer — runs as invoker so it inherits the
--  finance_entries_select RLS policy below automatically (a caller without
--  'finance.view' sees zero rows, not everything).
-- ---------------------------------------------------------------------
create or replace function finance.report(p_from date, p_to date)
returns jsonb
language sql stable
set search_path = finance, public
as $$
  with e as (
    select * from finance.entries
    where entry_date >= p_from and entry_date <= p_to
  ),
  by_cat as (
    select kind, category, sum(amount) as total, count(*) as entry_count
    from e group by kind, category
  ),
  by_pay as (
    select kind, coalesce(payment_method, 'unknown') as payment_method,
           sum(amount) as total, count(*) as entry_count
    from e group by kind, coalesce(payment_method, 'unknown')
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'income_total',  coalesce((select sum(amount) from e where kind = 'income'), 0),
    'expense_total', coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'net',           coalesce((select sum(amount) from e where kind = 'income'), 0)
                     - coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', kind, 'category', category, 'total', total, 'entry_count', entry_count
      ) order by kind, total desc)
      from by_cat), '[]'::jsonb),
    'by_payment', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', kind, 'payment_method', payment_method, 'total', total, 'entry_count', entry_count
      ) order by kind, total desc)
      from by_pay), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
--  Row-Level Security — the database is the real guard, UI is convenience
-- ---------------------------------------------------------------------
alter table finance.entries enable row level security;

drop policy if exists "finance_entries_select" on finance.entries;
drop policy if exists "finance_entries_insert" on finance.entries;
drop policy if exists "finance_entries_update" on finance.entries;
drop policy if exists "finance_entries_delete" on finance.entries;

-- (select core.has_permission(...)) rather than a bare call: the planner evaluates
-- it once per statement (InitPlan) instead of per row — see MODULE-TEMPLATE.md §1.
create policy "finance_entries_select" on finance.entries for select to authenticated
  using ((select core.has_permission('finance.view')));

create policy "finance_entries_insert" on finance.entries for insert to authenticated
  with check ((select core.has_permission('finance.manage')));

create policy "finance_entries_update" on finance.entries for update to authenticated
  using ((select core.has_permission('finance.manage')))
  with check ((select core.has_permission('finance.manage')));

create policy "finance_entries_delete" on finance.entries for delete to authenticated
  using ((select core.has_permission('finance.manage')));

-- ---------------------------------------------------------------------
--  Grants (RLS still gates every statement)
-- ---------------------------------------------------------------------
grant usage on schema finance to authenticated;
grant select, insert, update, delete on finance.entries to authenticated;
grant execute on function finance.report(date, date) to authenticated;

-- =====================================================================
--  SEED DATA (idempotent — safe to re-run)
-- =====================================================================
insert into core.modules (key, label, icon, sort) values
  ('finance', 'כספים', '💰', 30)
on conflict (key) do nothing;

insert into core.permissions (key, module, action, label) values
  ('finance.view',   'finance', 'view',   'צפייה בכספים ובדוחות'),
  ('finance.manage', 'finance', 'manage', 'ניהול תנועות הכנסה/הוצאה')
on conflict (key) do nothing;

-- owner: everything (explicit here too, so this file is self-sufficient even if
-- run before 00_core.sql's "owner: everything" block is re-run)
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r, core.permissions p
where r.key = 'owner' and p.key in ('finance.view','finance.manage')
on conflict do nothing;

-- manager: full access; staff/viewer intentionally not granted finance.* in v1
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.key in
  ('finance.view','finance.manage')
where r.key = 'manager'
on conflict do nothing;

-- =====================================================================
-- schema/21_finance_spine.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — FINANCE SPINE (cross-module money foundation)
--  Run in the Supabase SQL editor AFTER 20_finance.sql, BEFORE 40_events.sql.
--  Design: docs/plans/cross-module-foundation.md §3 (decisions locked 2026-07-09:
--  amounts post GROSS; POS posts per-day summaries; deposits due signing + N days).
--
--  What this adds to the finance module:
--    * PROVENANCE on finance.entries — source_module/source_ref/event_id.
--      Manual rows (source_module IS NULL) keep working exactly as today.
--    * Derived rows are written ONLY by module posting functions (a GUC-guarded
--      trigger blocks direct client insert/update/delete) — corrections are
--      reversals posted by the source module, never edits.
--    * IDEMPOTENT postings — unique index on the provenance key.
--    * finance.expected — money that SHOULD move (deposits, balances, supplier
--      bills), linked to the actual entry that fulfilled it.
--    * finance.record_payment() — fulfill an expectation + post the entry in one
--      transaction.
--    * finance.event_pnl() — per-event P&L over the event_id attribution column
--      (FK to events.events is added by 40_events.sql, which creates that table).
--
--  Category ownership rule (docs §3b): every category has exactly ONE writer.
--    Derived-only categories added here: income 'pos'; expense 'pos_food',
--    'pos_labor' (written by pos.close_day() when the POS module lands).
--    Income 'events' becomes quotes-written; the finance UI stops offering it
--    for manual entry (UI pass, roadmap Phase 1).
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Provenance columns (idempotent adds; existing manual rows untouched)
-- ---------------------------------------------------------------------
alter table finance.entries add column if not exists source_module text;
alter table finance.entries add column if not exists source_ref    text;
alter table finance.entries add column if not exists event_id      uuid;  -- FK in 40_events.sql

do $$ begin
  alter table finance.entries add constraint finance_entries_source_pair_check
    check ((source_module is null) = (source_ref is null));
exception when duplicate_object then null; end $$;

-- Manual rows stay strictly positive; derived rows may be negative (a reversal
-- posted by the source module nets out in every sum the report already does).
-- NOTE: the column definition in 20_finance.sql carries an inline `check
-- (amount > 0)` that Postgres auto-named `entries_amount_check` — it must be
-- dropped here too, or it silently overrides the rule below and blocks every
-- negative reversal (it did: POS day-lifecycle auto re-post hit it on the first
-- reducing correction). Dropping it lets the module-aware check govern.
alter table finance.entries drop constraint if exists entries_amount_check;
alter table finance.entries drop constraint if exists finance_entries_amount_check;
alter table finance.entries add constraint finance_entries_amount_check
  check (amount <> 0 and (source_module is not null or amount > 0));

-- The category taxonomy (and the derived-only POS categories) used to be a CHECK
-- constraint re-declared here. Superseded by 54_finance_categories.sql: the list
-- is data, and `finance.categories.owned_by_module` — not a literal — is what
-- makes a category derived-only. Re-declaring it here would resurrect a stale
-- taxonomy on any re-run of this file.

-- One posting per source fact — modules can re-run their posting functions
-- forever without double-counting (same philosophy as every file in this folder).
create unique index if not exists finance_entries_posting_uniq
  on finance.entries (source_module, source_ref, kind, category)
  where source_module is not null;

create index if not exists finance_entries_event_idx  on finance.entries (event_id)
  where event_id is not null;

-- ---------------------------------------------------------------------
--  2) Derived rows are module-written only.
--     Posting functions set the transaction-local GUC 'levyam.finance_posting'
--     before writing; without it, any insert/update/delete touching a row with
--     provenance is rejected — a client cannot forge, edit, or erase a posted
--     fact (the same "the DB is the law" stance as signed contracts).
-- ---------------------------------------------------------------------
-- finance.entries_guard() and its trigger are authored in
-- 54_finance_categories.sql — ONE definition, because the one-writer rule it
-- enforces now reads finance.categories.owned_by_module instead of a literal
-- array. Keeping a copy here meant a re-run of this file silently restored the
-- old four-slug array: newly added module categories would stop being protected
-- while the old ones kept working, which looks like it works.

-- ---------------------------------------------------------------------
--  3) finance.expected — money that SHOULD move (docs §3c)
--     Created by module triggers (quote signed → deposit + balance) or by hand
--     (supplier bill). Fulfilled via finance.record_payment(), which links the
--     actual entry back here — plan and actual stay one navigable pair.
-- ---------------------------------------------------------------------
create table if not exists finance.expected (
  id             uuid primary key default gen_random_uuid(),
  direction      text not null check (direction in ('in','out')),
  category       text not null,                  -- the entries category the money will post under
  amount         numeric(12,2) not null check (amount > 0),
  due_date       date,
  reason         text not null default '',       -- 'deposit' | 'balance' | 'supplier' | free text
  event_id       uuid,                           -- FK in 40_events.sql
  source_module  text,
  source_ref     text,
  status         text not null default 'open' check (status in ('open','fulfilled','cancelled')),
  fulfilled_by   uuid references finance.entries(id),
  note           text not null default '',
  created_by     uuid default auth.uid() references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint finance_expected_source_pair_check
    check ((source_module is null) = (source_ref is null))
);

create unique index if not exists finance_expected_source_uniq
  on finance.expected (source_module, source_ref)
  where source_module is not null;
create index if not exists finance_expected_status_idx on finance.expected (status);
create index if not exists finance_expected_due_idx    on finance.expected (due_date)
  where status = 'open';
create index if not exists finance_expected_event_idx  on finance.expected (event_id)
  where event_id is not null;

drop trigger if exists finance_expected_touch on finance.expected;
create trigger finance_expected_touch
  before update on finance.expected
  for each row execute function finance.set_updated_at();

-- ---------------------------------------------------------------------
--  4) finance.record_payment — the one motion that turns plan into actual:
--     posts the entry (with the expectation's provenance + event attribution)
--     and marks the expectation fulfilled, atomically.
-- ---------------------------------------------------------------------
create or replace function finance.record_payment(
  p_expected uuid,
  p_amount   numeric default null,     -- null = the expected amount
  p_method   text    default null,     -- 'cash' | 'private' | 'grow' | 'bank'
  p_date     date    default current_date,
  p_note     text    default null
) returns uuid
language plpgsql security definer
set search_path = finance, core, public
as $$
declare
  exp     finance.expected%rowtype;
  v_entry uuid;
begin
  if not core.has_permission('finance.manage') then
    raise exception 'permission denied';
  end if;

  select * into exp from finance.expected where id = p_expected for update;
  if not found then
    raise exception 'expected payment not found';
  end if;
  if exp.status <> 'open' then
    raise exception 'הצפי כבר במצב % — רק צפי פתוח ניתן לרישום', exp.status;
  end if;

  perform set_config('levyam.finance_posting', 'on', true);
  insert into finance.entries
    (kind, category, amount, payment_method, entry_date, note, source_module, source_ref, event_id)
  values (
    case exp.direction when 'in' then 'income' else 'expense' end,
    exp.category,
    coalesce(p_amount, exp.amount),
    p_method,
    p_date,
    coalesce(p_note, nullif(exp.reason, '')),
    coalesce(exp.source_module, 'finance'),
    'expected:' || exp.id,
    exp.event_id
  )
  returning id into v_entry;
  perform set_config('levyam.finance_posting', '', true);

  update finance.expected
  set status = 'fulfilled', fulfilled_by = v_entry
  where id = exp.id;

  return v_entry;
end; $$;

-- ---------------------------------------------------------------------
--  5) finance.event_pnl — what did this event actually make?
--     Invoker rights like finance.report(): inherits the finance.view RLS
--     policies, so a caller without the permission sees zeros, not everything.
-- ---------------------------------------------------------------------
create or replace function finance.event_pnl(p_event uuid)
returns jsonb
language sql stable
set search_path = finance, public
as $$
  with e as (select * from finance.entries  where event_id = p_event),
       x as (select * from finance.expected where event_id = p_event)
  select jsonb_build_object(
    'event_id', p_event,
    'income',  coalesce((select sum(amount) from e where kind = 'income'), 0),
    'expense', coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'net',     coalesce((select sum(amount) from e where kind = 'income'), 0)
             - coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'expected_in_open',  coalesce((select sum(amount) from x where direction = 'in'  and status = 'open'), 0),
    'expected_out_open', coalesce((select sum(amount) from x where direction = 'out' and status = 'open'), 0),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'kind', kind, 'category', category, 'amount', amount,
        'entry_date', entry_date, 'source_module', source_module, 'note', note
      ) order by entry_date) from e), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'direction', direction, 'amount', amount, 'due_date', due_date,
        'reason', reason, 'status', status
      ) order by due_date nulls last) from x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
--  Row-Level Security — same gates as the rest of the module
-- ---------------------------------------------------------------------
alter table finance.expected enable row level security;

drop policy if exists "finance_expected_select" on finance.expected;
drop policy if exists "finance_expected_write"  on finance.expected;

-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "finance_expected_select" on finance.expected for select to authenticated
  using ((select core.has_permission('finance.view')));
create policy "finance_expected_write" on finance.expected for all to authenticated
  using ((select core.has_permission('finance.manage')))
  with check ((select core.has_permission('finance.manage')));

-- ---------------------------------------------------------------------
--  Grants (RLS still gates every statement)
-- ---------------------------------------------------------------------
grant select, insert, update, delete on finance.expected to authenticated;
grant execute on function finance.record_payment(uuid, numeric, text, date, text) to authenticated;
grant execute on function finance.event_pnl(uuid) to authenticated;

-- =====================================================================
-- schema/30_quotes.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — QUOTES module (price quotes → contracts → confirmed events)
--  Run in the Supabase SQL editor AFTER 00_core.sql, then add `quotes` under
--  Supabase → Settings → API → Exposed schemas.
--
--  Migration target of the local quotes app (~/lev-yam-quotes, serve.py) —
--  see docs/plans/quotes-module.md. The app's load-bearing invariants live
--  HERE, not in UI code:
--    * one contract per quote            → UNIQUE FK
--    * signed contract is immutable      → trigger blocks UPDATE/DELETE
--      (this also blocks deleting a quote whose contract is signed — the
--      cascade hits the trigger; a signed contract is a legal record)
--    * signing confirms the event        → trigger: quote → approved,
--      event_confirmed, prep checklist seeded from settings
--    * sent/paid dates stamp once        → trigger, never overwritten
--    * quote numbering LY-YYMMDD-NNN     → sequence-backed column default
--  Money/PII lives here under RLS — never in the (public) repo.
-- =====================================================================

create schema if not exists quotes;

-- Global sequence part of LY-YYMMDD-NNN. Seeded from the tracker at creation
-- time; the live value now advances in prod (data import completed 2026-07-09)
-- and `if not exists` keeps re-runs from ever resetting it.
create sequence if not exists quotes.quote_number_seq start with 17;

-- SECURITY DEFINER + core.require gate (H7 hardening, 2026-07-15): the
-- function stays executable by authenticated because it runs as the
-- quote_number column DEFAULT (defaults evaluate as the inserting user), but
-- a client JWT must hold quotes.manage to actually draw a number — an anon or
-- under-privileged RPC call raises instead of silently burning sequence
-- numbers. No-JWT callers (SQL editor, service_role) pass, so server-side
-- inserts relying on the DEFAULT keep working. Sequence access itself is
-- definer-side only (grant revoked below).
create or replace function quotes.next_quote_number()
returns text language plpgsql volatile security definer
set search_path = quotes, public
as $$
begin
  perform core.require('quotes.manage');
  return 'LY-' || to_char(current_date, 'YYMMDD') || '-'
       || lpad(nextval('quotes.quote_number_seq')::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------
--  quotes.quotes — one row per quote; `content` is the document body
--  (greeting, line items, included list, agenda, cancellation, terms)
-- ---------------------------------------------------------------------
create table if not exists quotes.quotes (
  id              uuid primary key default gen_random_uuid(),
  quote_number    text not null unique default quotes.next_quote_number(),
  customer_name   text not null,
  contact_person  text not null default '',
  phone           text not null default '',
  email           text not null default '',
  event_type      text not null default '',
  event_date      date,
  guests          text not null default '',      -- free text on purpose ('25', '20–30')
  hours           text not null default '',      -- '09:00–16:00'
  issue_date      date not null default current_date,
  status          text not null default 'draft'
                  check (status in ('draft','sent','approved','declined','expired','paid')),
  sent_date       date,                          -- stamped once on first move to 'sent'
  paid_date       date,                          -- stamped once on first move to 'paid'
  archived        boolean not null default false,
  event_confirmed boolean not null default false,
  notes           text not null default '',
  subtotal        numeric(12,2),
  discount_pct    numeric(5,2),
  final_price     numeric(12,2),
  vat_rate        numeric(4,3),
  deposit_pct     numeric(5,2),
  content         jsonb not null default '{}'::jsonb,
  prep_checklist  jsonb not null default '[]'::jsonb,  -- [{text, done}]
  created_by      uuid not null default auth.uid() references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quotes_quotes_event_date_idx on quotes.quotes (event_date);
create index if not exists quotes_quotes_status_idx     on quotes.quotes (status);
create index if not exists quotes_quotes_issue_date_idx on quotes.quotes (issue_date desc);

-- ---------------------------------------------------------------------
--  quotes.contracts — at most ONE per quote (UNIQUE FK); `content` is the
--  clauses + details snapshot taken at generation time (a contract must not
--  change retroactively when the master template is edited)
-- ---------------------------------------------------------------------
create table if not exists quotes.contracts (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid not null unique references quotes.quotes(id) on delete cascade,
  contract_number   text not null unique,        -- 'C-' + quote_number (derived by trigger)
  status            text not null default 'draft'
                    check (status in ('draft','sent','signed')),
  generated_date    date not null default current_date,
  sent_date         date,
  signed_date       date,
  signed_name       text,
  signed_at         timestamptz,
  signer_ip         text,
  signer_user_agent text,
  content           jsonb not null default '{}'::jsonb,
  document_path     text,                        -- immutable PDF/HTML snapshot in private Storage
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
--  quotes.settings — single row of owner-editable defaults (checklist
--  template, quote document defaults, contract clause/fields template).
--  The lessor signature is deliberately NOT here — see owner_secrets.
-- ---------------------------------------------------------------------
create table if not exists quotes.settings (
  id                      boolean primary key default true check (id),
  default_prep_checklist  jsonb not null default '[]'::jsonb,  -- [string, ...]
  quote_defaults          jsonb not null default '{}'::jsonb,
  contract_template       jsonb not null default '{}'::jsonb,
  updated_at              timestamptz not null default now()
);
insert into quotes.settings (id) values (true) on conflict do nothing;

-- quotes.owner_secrets — the lessor's signature (data URL), baked into
-- generated contracts. Separate table so RLS can gate it more strictly
-- than the rest of settings ('quotes.settings' permission only).
create table if not exists quotes.owner_secrets (
  id              boolean primary key default true check (id),
  owner_signature text not null default '',
  updated_at      timestamptz not null default now()
);
insert into quotes.owner_secrets (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------
--  Triggers — behavior parity with serve.py, enforced in the DB
-- ---------------------------------------------------------------------
create or replace function quotes.touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists quotes_quotes_touch on quotes.quotes;
create trigger quotes_quotes_touch
  before update on quotes.quotes
  for each row execute function quotes.touch();

drop trigger if exists quotes_contracts_touch on quotes.contracts;
create trigger quotes_contracts_touch
  before update on quotes.contracts
  for each row execute function quotes.touch();

drop trigger if exists quotes_settings_touch on quotes.settings;
create trigger quotes_settings_touch
  before update on quotes.settings
  for each row execute function quotes.touch();

drop trigger if exists quotes_owner_secrets_touch on quotes.owner_secrets;
create trigger quotes_owner_secrets_touch
  before update on quotes.owner_secrets
  for each row execute function quotes.touch();

-- One-way date stamps on quotes (mirror of serve.py's sentDate/paidDate).
create or replace function quotes.stamp_quote_dates()
returns trigger language plpgsql as $$
begin
  if new.status = 'sent' and old.status is distinct from 'sent' and new.sent_date is null then
    new.sent_date := current_date;
  end if;
  if new.status = 'paid' and old.status is distinct from 'paid' and new.paid_date is null then
    new.paid_date := current_date;
  end if;
  return new;
end; $$;

drop trigger if exists quotes_quotes_stamp on quotes.quotes;
create trigger quotes_quotes_stamp
  before update on quotes.quotes
  for each row execute function quotes.stamp_quote_dates();

-- Contract number derives from the quote; signed contracts are immutable.
create or replace function quotes.contract_before_write()
returns trigger language plpgsql
set search_path = quotes, public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' then
      raise exception 'הסכם חתום הוא מסמך משפטי — לא ניתן למחוק אותו.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' or new.quote_id is distinct from old.quote_id then
    select 'C-' || q.quote_number into new.contract_number
    from quotes.quotes q where q.id = new.quote_id;
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'signed' then
      raise exception 'הסכם זה כבר נחתם — לא ניתן לשנות אותו.';
    end if;
    if new.status = 'sent' and old.status is distinct from 'sent' and new.sent_date is null then
      new.sent_date := current_date;
    end if;
    if new.status = 'signed' and new.signed_date is null then
      new.signed_date := current_date;
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists quotes_contracts_guard on quotes.contracts;
create trigger quotes_contracts_guard
  before insert or update or delete on quotes.contracts
  for each row execute function quotes.contract_before_write();

-- Signing confirms the event (both flows: online sign or PDF round-trip
-- marked signed): quote → approved + event_confirmed, prep checklist seeded
-- from settings. SECURITY DEFINER: the signer holds 'quotes.contracts' but
-- not necessarily 'quotes.manage'; this controlled write is the one exception.
create or replace function quotes.confirm_event_on_sign()
returns trigger language plpgsql security definer
set search_path = quotes, public
as $$
declare
  default_checklist jsonb;
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    select coalesce(
      (select jsonb_agg(jsonb_build_object('text', item, 'done', false))
       from jsonb_array_elements_text(s.default_prep_checklist) as item),
      '[]'::jsonb)
    into default_checklist
    from quotes.settings s where s.id;

    update quotes.quotes q
    set status = 'approved',
        event_confirmed = true,
        prep_checklist = case
          when q.prep_checklist = '[]'::jsonb then coalesce(default_checklist, '[]'::jsonb)
          else q.prep_checklist
        end
    where q.id = new.quote_id;
  end if;
  return new;
end; $$;

drop trigger if exists quotes_contracts_confirm on quotes.contracts;
create trigger quotes_contracts_confirm
  after update on quotes.contracts
  for each row execute function quotes.confirm_event_on_sign();

-- ---------------------------------------------------------------------
--  quotes.auto_expire() — lazy sweep called on module load (parity with
--  serve.py): 'sent' quotes expire 7+ days after sent_date (legacy rows
--  without one fall back to issue_date). Drafts are never swept.
--  SECURITY DEFINER so a viewer's page load can run the sweep; the guard
--  inside requires quotes.view.
-- ---------------------------------------------------------------------
create or replace function quotes.auto_expire()
returns integer language plpgsql security definer
set search_path = quotes, core, public
as $$
declare
  expired_count integer;
begin
  if not core.has_permission('quotes.view') then
    raise exception 'permission denied';
  end if;
  update quotes.quotes
  set status = 'expired'
  where status = 'sent'
    and coalesce(sent_date, issue_date) <= current_date - 7;
  get diagnostics expired_count = row_count;
  return expired_count;
end; $$;

-- ---------------------------------------------------------------------
--  Row-Level Security — the database is the real guard, UI is convenience
-- ---------------------------------------------------------------------
alter table quotes.quotes        enable row level security;
alter table quotes.contracts     enable row level security;
alter table quotes.settings      enable row level security;
alter table quotes.owner_secrets enable row level security;

drop policy if exists "quotes_quotes_select" on quotes.quotes;
drop policy if exists "quotes_quotes_write"  on quotes.quotes;
-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "quotes_quotes_select" on quotes.quotes for select to authenticated
  using ((select core.has_permission('quotes.view')));
create policy "quotes_quotes_write" on quotes.quotes for all to authenticated
  using ((select core.has_permission('quotes.manage')))
  with check ((select core.has_permission('quotes.manage')));

drop policy if exists "quotes_contracts_select" on quotes.contracts;
drop policy if exists "quotes_contracts_write"  on quotes.contracts;
create policy "quotes_contracts_select" on quotes.contracts for select to authenticated
  using ((select core.has_permission('quotes.view')));
create policy "quotes_contracts_write" on quotes.contracts for all to authenticated
  using ((select core.has_permission('quotes.contracts')))
  with check ((select core.has_permission('quotes.contracts')));

drop policy if exists "quotes_settings_select" on quotes.settings;
drop policy if exists "quotes_settings_write"  on quotes.settings;
create policy "quotes_settings_select" on quotes.settings for select to authenticated
  using ((select core.has_permission('quotes.view')));
create policy "quotes_settings_write" on quotes.settings for update to authenticated
  using ((select core.has_permission('quotes.settings')))
  with check ((select core.has_permission('quotes.settings')));

-- signature: strictly 'quotes.settings' holders, read AND write
drop policy if exists "quotes_secrets_select" on quotes.owner_secrets;
drop policy if exists "quotes_secrets_write"  on quotes.owner_secrets;
create policy "quotes_secrets_select" on quotes.owner_secrets for select to authenticated
  using ((select core.has_permission('quotes.settings')));
create policy "quotes_secrets_write" on quotes.owner_secrets for update to authenticated
  using ((select core.has_permission('quotes.settings')))
  with check ((select core.has_permission('quotes.settings')));

-- ---------------------------------------------------------------------
--  Grants (RLS still gates every statement)
-- ---------------------------------------------------------------------
grant usage on schema quotes to authenticated;
grant select, insert, update, delete on quotes.quotes    to authenticated;
grant select, insert, update, delete on quotes.contracts to authenticated;
grant select, update on quotes.settings      to authenticated;
grant select, update on quotes.owner_secrets to authenticated;
-- The sequence is reachable only through next_quote_number()'s definer rights;
-- a direct client nextval() would burn numbers past the permission check.
revoke usage on sequence quotes.quote_number_seq from authenticated;
grant execute on function quotes.next_quote_number() to authenticated;
grant execute on function quotes.auto_expire() to authenticated;

-- =====================================================================
--  SEED DATA (idempotent — safe to re-run)
-- =====================================================================
insert into core.modules (key, label, icon, sort) values
  ('quotes', 'הצעות מחיר', '📋', 40)
on conflict (key) do nothing;

insert into core.permissions (key, module, action, label) values
  ('quotes.view',      'quotes', 'view',      'צפייה בהצעות מחיר, הסכמים ואירועים'),
  ('quotes.manage',    'quotes', 'manage',    'יצירה ועריכה של הצעות מחיר'),
  ('quotes.contracts', 'quotes', 'contracts', 'הפקה, שליחה וסימון חתימה של הסכמים'),
  ('quotes.settings',  'quotes', 'settings',  'הגדרות המודול: חתימה, תבניות, רשימת הכנות')
on conflict (key) do nothing;

-- owner + manager: everything; staff/viewer intentionally not granted quotes.* in v1
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p
  on p.key in ('quotes.view','quotes.manage','quotes.contracts','quotes.settings')
where r.key in ('owner','manager')
on conflict do nothing;

-- =====================================================================
-- schema/40_events.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — EVENTS SPINE (the shared calendar every module feeds)
--  Run in the Supabase SQL editor AFTER 21_finance_spine.sql.
--  Design: docs/plans/cross-module-foundation.md §2/§4 (decisions locked
--  2026-07-09: 'sent' quotes project as TENTATIVE + INTERNAL; deposits due
--  signing + N days, N owner-editable in quotes.settings.quote_defaults).
--
--  What this creates:
--    * events.events — ONE canonical calendar row per real-world event.
--      Modules PROJECT into it via DB triggers (never client code), keyed
--      UNIQUE (source_module, source_id) so projections are idempotent.
--    * events.tasks — preparation attached to the event, not to the module
--      that sold it (assignable, auditable, optionally priced via
--      finance.expected). Quotes' jsonb prep_checklist migrates here in
--      Phase 2; until then quotes keeps its own checklist.
--    * Views: events.calendar (internal, with readiness counts),
--      events.feed (public columns only — the Phase 2 "What's happening"
--      page reads this), events.conflicts (same-day confirmed overlaps).
--    * Quotes → events integration (the first projector):
--        - quote with event_date: sent → tentative/internal; confirmed →
--          confirmed/internal (titles carry customer names = PII, so
--          quote-sourced events are ALWAYS internal — never on the feed)
--        - contract signed → deposit + balance rows in finance.expected
--        - quote marked paid → open expectations fulfilled, income posted
--        - declined/expired/archived/deleted → projection cancelled/removed,
--          open expectations cancelled
--        - quotes.backfill_events() — idempotent projection of existing data
--          (expectations only for future unpaid events; history stays as the
--          manual finance entries the owner already typed — no double count).
--
--  The 'events' module row is seeded DISABLED: permission keys need it
--  (core.permissions.module FK), but there is no /app/events UI yet — Phase 2
--  flips enabled=true so the launcher tile appears. Expose the `events`
--  schema (Settings → API) only when that UI lands.
-- =====================================================================

create schema if not exists events;

-- ---------------------------------------------------------------------
--  1) events.events — the canonical event
-- ---------------------------------------------------------------------
create table if not exists events.events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  event_date    date not null,
  starts_at     time,
  ends_at       time,
  status        text not null default 'confirmed'
                check (status in ('tentative','confirmed','in_progress','done','settled','cancelled')),
  visibility    text not null default 'public'          -- vision: public by default
                check (visibility in ('public','internal')),
  event_type    text not null default '',               -- free taxonomy, never an enum
  capacity      int,
  source_module text,                                   -- null = created directly (bookings, Phase 2)
  source_id     uuid,
  owner_id      uuid references auth.users(id),
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint events_events_source_pair_check
    check ((source_module is null) = (source_id is null))
);

-- One projection per source fact — the idempotency spine (docs §2 rule 1).
create unique index if not exists events_events_source_uniq
  on events.events (source_module, source_id)
  where source_module is not null;
create index if not exists events_events_date_idx   on events.events (event_date);
create index if not exists events_events_status_idx on events.events (status);

-- ---------------------------------------------------------------------
--  2) events.tasks — preparation attached to the event
-- ---------------------------------------------------------------------
create table if not exists events.tasks (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events.events(id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  done_by     uuid references auth.users(id),
  done_at     timestamptz,
  assignee    uuid references auth.users(id),
  due_date    date,                                     -- null = by the event date
  expected_id uuid references finance.expected(id) on delete set null,  -- "buy fish" ⇒ its cost
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists events_tasks_event_idx on events.tasks (event_id);

-- ---------------------------------------------------------------------
--  3) Housekeeping triggers
-- ---------------------------------------------------------------------
create or replace function events.touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists events_events_touch on events.events;
create trigger events_events_touch
  before update on events.events
  for each row execute function events.touch();

drop trigger if exists events_tasks_touch on events.tasks;
create trigger events_tasks_touch
  before update on events.tasks
  for each row execute function events.touch();

-- Who prepared what: stamp done_by/done_at when a task flips done (audit,
-- same spirit as contract signing capture).
create or replace function events.task_done_stamp()
returns trigger language plpgsql as $$
begin
  if new.done and not old.done then
    new.done_by := coalesce(new.done_by, auth.uid());
    new.done_at := coalesce(new.done_at, now());
  elsif not new.done and old.done then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end; $$;

drop trigger if exists events_tasks_done_stamp on events.tasks;
create trigger events_tasks_done_stamp
  before update on events.tasks
  for each row execute function events.task_done_stamp();

-- ---------------------------------------------------------------------
--  4) Attribution FKs deferred from 21_finance_spine.sql (this table now exists)
-- ---------------------------------------------------------------------
do $$ begin
  alter table finance.entries add constraint finance_entries_event_fk
    foreign key (event_id) references events.events(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table finance.expected add constraint finance_expected_event_fk
    foreign key (event_id) references events.events(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
--  5) Contract views — cross-module reads go through these, not raw tables
--     (docs §6 rule 2). security_invoker: they inherit the caller's RLS.
-- ---------------------------------------------------------------------
create or replace view events.calendar with (security_invoker = true) as
  select e.id, e.title, e.event_date, e.starts_at, e.ends_at, e.status,
         e.visibility, e.event_type, e.capacity, e.source_module, e.source_id,
         e.owner_id, e.notes,
         coalesce(t.total, 0) as tasks_total,
         coalesce(t.done,  0) as tasks_done
  from events.events e
  left join (
    select event_id, count(*) as total, count(*) filter (where done) as done
    from events.tasks group by event_id
  ) t on t.event_id = e.id;

-- Public feed: published columns only (no notes/owner/source) — what the
-- Phase 2 "What's happening" page on levyam.com reads as anon.
create or replace view events.feed with (security_invoker = true) as
  select id, title, event_date, starts_at, ends_at, status, event_type, capacity
  from events.events
  where visibility = 'public' and status in ('confirmed','in_progress');

-- Same-day overlaps between confirmed events — flagged for humans, never
-- blocked by the DB (docs §2 rule 5). Null times = all-day = clashes with
-- anything that date.
create or replace view events.conflicts with (security_invoker = true) as
  select a.id as event_a, b.id as event_b, a.event_date
  from events.events a
  join events.events b on b.event_date = a.event_date and b.id > a.id
  where a.status in ('confirmed','in_progress')
    and b.status in ('confirmed','in_progress')
    and (a.starts_at is null or b.starts_at is null
         or (a.starts_at <= coalesce(b.ends_at, b.starts_at)
             and b.starts_at <= coalesce(a.ends_at, a.starts_at)));

-- ---------------------------------------------------------------------
--  6) Row-Level Security
--     Seeing an event ≠ seeing its money (docs §7): event rows carry no
--     amounts; finance stays behind finance.view.
-- ---------------------------------------------------------------------
alter table events.events enable row level security;
alter table events.tasks  enable row level security;

drop policy if exists "events_events_select" on events.events;
drop policy if exists "events_events_public" on events.events;
drop policy if exists "events_events_write"  on events.events;
drop policy if exists "events_tasks_select"  on events.tasks;
drop policy if exists "events_tasks_write"   on events.tasks;

-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
-- staff view everything
create policy "events_events_select" on events.events for select to authenticated
  using ((select core.has_permission('events.view')));
-- anyone (incl. anon) reads published rows — the feed is public by default
create policy "events_events_public" on events.events for select to anon, authenticated
  using (visibility = 'public' and status in ('confirmed','in_progress'));
-- direct create/edit (bookings UI, Phase 2); module projections are
-- SECURITY DEFINER triggers and bypass this
create policy "events_events_write" on events.events for all to authenticated
  using ((select core.has_permission('events.manage')))
  with check ((select core.has_permission('events.manage')));

create policy "events_tasks_select" on events.tasks for select to authenticated
  using ((select core.has_permission('events.view')));
create policy "events_tasks_write" on events.tasks for all to authenticated
  using ((select core.has_permission('events.tasks')))
  with check ((select core.has_permission('events.tasks')));

-- ---------------------------------------------------------------------
--  Grants (RLS still gates every statement). Anon gets COLUMN-level select
--  only on published fields — notes/owner/source are unreachable even if
--  the schema is exposed; tasks are granted (RLS yields zero rows) so the
--  calendar view's join doesn't error for public readers.
-- ---------------------------------------------------------------------
grant usage on schema events to authenticated, anon;
grant select, insert, update, delete on events.events, events.tasks to authenticated;
grant select (id, title, event_date, starts_at, ends_at, status, visibility, event_type, capacity)
  on events.events to anon;
grant select on events.tasks to anon;
grant select on events.calendar, events.conflicts to authenticated;
grant select on events.feed to authenticated, anon;

-- =====================================================================
--  QUOTES → SPINE INTEGRATION (the first projector; the pattern every
--  module copies — see docs §2 and MODULE-TEMPLATE.md)
-- =====================================================================

-- Parse a time out of the free-text hours field ('09:00–16:00'); never throws.
create or replace function quotes.try_time(t text)
returns time language plpgsql immutable as $$
begin
  return t::time;
exception when others then
  return null;
end; $$;

-- Project one quote into events.events. Idempotent upsert on the provenance
-- key. Quote-sourced events are ALWAYS internal (titles carry customer PII).
-- Guarded: triggers/backfill run it as the acting user or as postgres; a
-- direct caller needs quotes.view (and it is not granted to clients anyway).
create or replace function quotes.project_quote(q quotes.quotes)
returns void language plpgsql security definer
set search_path = quotes, events, finance, core, public
as $$
declare
  v_status text;
  v_starts time;
  v_ends   time;
begin
  if auth.uid() is not null and not core.has_permission('quotes.view') then
    raise exception 'permission denied';
  end if;

  if q.event_confirmed then
    v_status := 'confirmed';               -- archiving history never cancels a confirmed event
  elsif q.status = 'sent' and not q.archived then
    v_status := 'tentative';               -- decision 2026-07-09: pipeline visible, internal
  end if;

  -- No date, or nothing calendar-worthy (draft/declined/expired/archived):
  -- cancel an existing projection and its open money plan, then stop.
  if q.event_date is null or v_status is null then
    update events.events set status = 'cancelled'
    where source_module = 'quotes' and source_id = q.id and status <> 'cancelled';
    if v_status is null then
      update finance.expected set status = 'cancelled'
      where source_module = 'quotes'
        and source_ref in (q.id::text || ':deposit', q.id::text || ':balance')
        and status = 'open';
    end if;
    return;
  end if;

  v_starts := quotes.try_time(substring(q.hours from '^\s*(\d{1,2}[:.]\d{2})'));
  v_ends   := quotes.try_time(substring(q.hours from '(\d{1,2}[:.]\d{2})\s*$'));
  if v_ends is not distinct from v_starts then v_ends := null; end if;

  insert into events.events as ev
    (title, event_date, starts_at, ends_at, status, visibility, event_type,
     source_module, source_id, owner_id)
  values
    (trim(q.customer_name ||
       case when q.event_type <> '' then ' — ' || q.event_type else '' end),
     q.event_date, v_starts, v_ends, v_status, 'internal',
     coalesce(nullif(q.event_type, ''), 'אירוע'), 'quotes', q.id, q.created_by)
  on conflict (source_module, source_id) where source_module is not null
  do update set
    title      = excluded.title,
    event_date = excluded.event_date,
    starts_at  = excluded.starts_at,
    ends_at    = excluded.ends_at,
    event_type = excluded.event_type,
    -- never resurrect past manual lifecycle moves (done/settled), and never
    -- touch visibility/notes/owner — those belong to the calendar side
    status = case when ev.status in ('done','settled') then ev.status
                  else excluded.status end;
end; $$;

create or replace function quotes.project_event()
returns trigger language plpgsql security definer
set search_path = quotes, events, finance, public
as $$
begin
  if tg_op = 'DELETE' then
    -- an unsigned quote can be deleted; its projection goes with it entirely
    delete from events.events where source_module = 'quotes' and source_id = old.id;
    update finance.expected set status = 'cancelled'
    where source_module = 'quotes'
      and source_ref in (old.id::text || ':deposit', old.id::text || ':balance')
      and status = 'open';
    return old;
  end if;
  perform quotes.project_quote(new);
  return new;
end; $$;

drop trigger if exists quotes_quotes_project on quotes.quotes;
create trigger quotes_quotes_project
  after insert or update or delete on quotes.quotes
  for each row execute function quotes.project_event();

-- ---------------------------------------------------------------------
--  The money plan (docs §3c): deposit + balance expectations for a signed
--  quote. One shared body for the signing trigger AND the backfill.
--  Deposit due = signing + N days; N in quotes.settings.quote_defaults
--  ('deposit_due_days', default 7) — owner-editable, no deploy.
-- ---------------------------------------------------------------------
create or replace function quotes.plan_money_for_quote(p_quote uuid)
returns void language plpgsql security definer
set search_path = quotes, events, finance, core, public
as $$
declare
  q         quotes.quotes%rowtype;
  v_event   uuid;
  v_deposit numeric(12,2);
  v_days    int;
begin
  if auth.uid() is not null and not core.has_permission('quotes.contracts') then
    raise exception 'permission denied';
  end if;

  select * into q from quotes.quotes where id = p_quote;
  if not found or q.final_price is null or q.final_price <= 0 then
    return;                                          -- no price, no money plan
  end if;

  select id into v_event from events.events
  where source_module = 'quotes' and source_id = q.id;

  v_days    := coalesce((select (s.quote_defaults->>'deposit_due_days')::int
                         from quotes.settings s where s.id), 7);
  v_deposit := case when coalesce(q.deposit_pct, 0) > 0
                    then round(q.final_price * q.deposit_pct / 100, 2) else 0 end;

  if v_deposit > 0 then
    insert into finance.expected
      (direction, category, amount, due_date, reason, event_id, source_module, source_ref)
    values ('in', 'events', v_deposit, current_date + v_days, 'deposit',
            v_event, 'quotes', q.id::text || ':deposit')
    on conflict (source_module, source_ref) where source_module is not null do nothing;
  end if;

  if q.final_price - v_deposit > 0 then
    insert into finance.expected
      (direction, category, amount, due_date, reason, event_id, source_module, source_ref)
    values ('in', 'events', q.final_price - v_deposit, q.event_date, 'balance',
            v_event, 'quotes', q.id::text || ':balance')
    on conflict (source_module, source_ref) where source_module is not null do nothing;
  end if;
end; $$;

-- Runs AFTER the existing quotes_contracts_confirm trigger (alphabetical
-- firing order: confirm < plan_money), so the quote is already confirmed and
-- its event projected when the plan is written.
create or replace function quotes.plan_money_on_sign()
returns trigger language plpgsql security definer
set search_path = quotes, public
as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    perform quotes.plan_money_for_quote(new.quote_id);
  end if;
  return new;
end; $$;

drop trigger if exists quotes_contracts_plan_money on quotes.contracts;
create trigger quotes_contracts_plan_money
  after update on quotes.contracts
  for each row execute function quotes.plan_money_on_sign();

-- ---------------------------------------------------------------------
--  Marking a quote PAID settles its plan: every open expectation fulfills
--  and posts income with provenance — money moves into finance without a
--  human re-typing it. (The finance UI pass makes the manual 'events'
--  income category derived-only so it can't be typed twice — docs §3b.)
-- ---------------------------------------------------------------------
create or replace function quotes.settle_on_paid()
returns trigger language plpgsql security definer
set search_path = quotes, finance, public
as $$
declare
  exp     record;
  v_entry uuid;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform set_config('levyam.finance_posting', 'on', true);
    for exp in
      select * from finance.expected
      where source_module = 'quotes'
        and source_ref in (new.id::text || ':deposit', new.id::text || ':balance')
        and status = 'open'
      order by due_date nulls last
      for update
    loop
      v_entry := null;
      insert into finance.entries
        (kind, category, amount, entry_date, note, source_module, source_ref, event_id)
      values
        ('income', exp.category, exp.amount, coalesce(new.paid_date, current_date),
         exp.reason || ' — ' || new.customer_name || ' (' || new.quote_number || ')',
         'quotes', 'expected:' || exp.id, exp.event_id)
      on conflict (source_module, source_ref, kind, category) where source_module is not null
      do nothing
      returning id into v_entry;
      if v_entry is not null then
        update finance.expected
        set status = 'fulfilled', fulfilled_by = v_entry
        where id = exp.id;
      end if;
    end loop;
    perform set_config('levyam.finance_posting', '', true);
  end if;
  return new;
end; $$;

drop trigger if exists quotes_quotes_settle on quotes.quotes;
create trigger quotes_quotes_settle
  after update on quotes.quotes
  for each row execute function quotes.settle_on_paid();

-- ---------------------------------------------------------------------
--  Backfill — every projector ships one (docs §6 rule 3). Idempotent.
--  Projects ALL existing quotes; creates expectations only for signed,
--  unpaid, FUTURE events (auto-posting the past would double-count the
--  manual finance entries the owner already typed — history stays manual).
--  Callable by events.manage holders from the app, or as postgres from the
--  SQL editor / management API.
-- ---------------------------------------------------------------------
create or replace function quotes.backfill_events()
returns jsonb language plpgsql security definer
set search_path = quotes, events, finance, core, public
as $$
declare
  q           quotes.quotes%rowtype;
  v_projected int := 0;
  v_planned   int := 0;
begin
  if auth.uid() is not null and not core.has_permission('events.manage') then
    raise exception 'permission denied';
  end if;

  for q in select * from quotes.quotes loop
    perform quotes.project_quote(q);
    v_projected := v_projected + 1;

    if q.event_confirmed and q.status <> 'paid'
       and q.event_date is not null and q.event_date >= current_date
       and exists (select 1 from quotes.contracts c
                   where c.quote_id = q.id and c.status = 'signed') then
      perform quotes.plan_money_for_quote(q.id);
      v_planned := v_planned + 1;
    end if;
  end loop;

  return jsonb_build_object('projected', v_projected, 'money_planned', v_planned);
end; $$;

-- Internal helpers are not client-callable; the guarded backfill is.
revoke execute on function quotes.project_quote(quotes.quotes) from public, authenticated, anon;
revoke execute on function quotes.plan_money_for_quote(uuid)   from public, authenticated, anon;
grant  execute on function quotes.backfill_events() to authenticated;

-- =====================================================================
--  SEED DATA (idempotent — safe to re-run)
-- =====================================================================

-- Registered DISABLED: permissions need the module key (FK), but the launcher
-- must not show a tile until the Phase 2 calendar UI exists (my_modules()
-- filters on enabled).
insert into core.modules (key, label, icon, enabled, sort) values
  ('events', 'יומן ואירועים', '📅', false, 25)
on conflict (key) do nothing;

insert into core.permissions (key, module, action, label) values
  ('events.view',   'events', 'view',   'צפייה ביומן ובאירועים'),
  ('events.manage', 'events', 'manage', 'יצירה ועריכה של אירועים'),
  ('events.tasks',  'events', 'tasks',  'סימון וניהול משימות הכנה')
on conflict (key) do nothing;

-- owner + manager: everything; staff: see the calendar + work the prep tasks
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p
  on p.key in ('events.view','events.manage','events.tasks')
where r.key in ('owner','manager')
on conflict do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p
  on p.key in ('events.view','events.tasks')
where r.key = 'staff'
on conflict do nothing;

-- =====================================================================
-- schema/42_pos_platform.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — POS PLATFORM LAYER
--  Run in the Supabase SQL editor AFTER 40_events.sql (the event_id FK
--  below needs events.events). Then add `pos` under Settings → API →
--  Exposed schemas.
--
--  Design: docs/plans/pos-module.md. 10_pos.sql stays the LIVE tool's
--  schema — pos.html keeps working untouched through the parity trial.
--  This file is additive only:
--    * `pos` schema for platform-side functions (tables stay in `public`
--      until cut-over — the live tool writes them by name).
--    * pos_bills.event_id — attach a bill to a spine event (P&L).
--    * AUTHENTICATED RLS via core.has_permission() alongside the existing
--      anon policies (today's live posture; dropping anon = cut-over task).
--    * Permission checks inside the shared SECURITY DEFINER RPCs for
--      authenticated callers (anon = pos.html keeps today's behavior).
--    * pos.close_day(date) — the business-day posting rule: one finance
--      row per leg (cash/card income, food/labor expense), idempotent,
--      corrections posted as delta rows (never edits).
--    * Seeds: the 8 real pos.* permission keys (mirroring pos.html's
--      ROLE_PERMS) replacing the Phase-0 placeholders, granted per role.
-- =====================================================================

create schema if not exists pos;

-- ---------------------------------------------------------------------
--  1) Spine attachment: bills can belong to an event (optional)
-- ---------------------------------------------------------------------
alter table public.pos_bills add column if not exists event_id uuid references events.events(id);
create index if not exists pos_bills_event_idx on public.pos_bills (event_id)
  where event_id is not null;

-- ---------------------------------------------------------------------
--  2) RLS for platform users (anon policies from 10_pos.sql stay put)
--     view    → read the floor & bills
--     order   → work tables (open/edit/sync carts)
--     manage  → touch paid bills directly (archive, attach event)
--     costs_* → log expenses of that kind; manage may fix/delete
-- ---------------------------------------------------------------------
drop policy if exists "pos_tables_select_auth" on public.pos_tables;
drop policy if exists "pos_tables_write_auth"  on public.pos_tables;
-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "pos_tables_select_auth" on public.pos_tables for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy "pos_tables_write_auth" on public.pos_tables for all to authenticated
  using ((select core.has_permission('pos.order')))
  with check ((select core.has_permission('pos.order')));

drop policy if exists "pos_bills_select_auth" on public.pos_bills;
drop policy if exists "pos_bills_write_auth"  on public.pos_bills;
create policy "pos_bills_select_auth" on public.pos_bills for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy "pos_bills_write_auth" on public.pos_bills for update to authenticated
  using ((select core.has_permission('pos.manage')))
  with check ((select core.has_permission('pos.manage')));

drop policy if exists "pos_bill_items_select_auth" on public.pos_bill_items;
create policy "pos_bill_items_select_auth" on public.pos_bill_items for select to authenticated
  using ((select core.has_permission('pos.view')));

drop policy if exists "pos_expenses_select_auth" on public.pos_expenses;
drop policy if exists "pos_expenses_insert_auth" on public.pos_expenses;
drop policy if exists "pos_expenses_write_auth"  on public.pos_expenses;
-- raw expense rows carry labor (payroll) amounts — reports-level only; the
-- ops view reads expenses through pos_day_report, which strips labor/money
create policy "pos_expenses_select_auth" on public.pos_expenses for select to authenticated
  using ((select core.has_permission('pos.reports')));
-- kind is 'food' | 'labor' → permission key 'pos.costs_food' / 'pos.costs_labor'
-- (references the row's kind column, so it stays a per-row eval by design)
create policy "pos_expenses_insert_auth" on public.pos_expenses for insert to authenticated
  with check (core.has_permission('pos.costs_' || kind));
create policy "pos_expenses_write_auth" on public.pos_expenses for delete to authenticated
  using ((select core.has_permission('pos.manage')));

grant select, insert, update, delete on public.pos_tables   to authenticated;
grant select, update                 on public.pos_bills    to authenticated;
grant select                         on public.pos_bill_items to authenticated;
grant select, insert, delete         on public.pos_expenses to authenticated;
-- NOTE: the v_sales_* views are deliberately NOT granted to authenticated —
-- they are plain (owner-rights) views over pos_bills and would bypass the
-- pos.reports money gate; the permission-aware pos_day_report RPC is the API.

-- ---------------------------------------------------------------------
--  3) The shared RPCs learn platform permissions.
--     Redefined (same signatures 10_pos.sql declares) with a guard that
--     only binds AUTHENTICATED callers — anon (pos.html + its in-app PIN)
--     keeps today's behavior until cut-over.
-- ---------------------------------------------------------------------
create or replace function pos.require(p_perm text)
returns void language plpgsql
set search_path = core, public as $$
begin
  if auth.role() = 'authenticated' and not core.has_permission(p_perm) then
    raise exception 'אין הרשאה (%)', p_perm;
  end if;
end; $$;

create or replace function public.pos_close_table(p_bill jsonb, p_items jsonb)
returns void language plpgsql security definer set search_path = public, pos as $$
declare
  v_id       text    := p_bill->>'id';
  v_oh       numeric := coalesce((p_bill->>'oh_charge')::numeric, 0);
  v_extras   numeric := coalesce((p_bill->>'extras_total')::numeric, 0);
  v_discount numeric := coalesce((p_bill->>'discount')::numeric, 0);
  v_grand    numeric := coalesce((p_bill->>'grand_total')::numeric, 0);
  v_tip      numeric := coalesce((p_bill->>'tip')::numeric, 0);
  v_cash     numeric := coalesce((p_bill->>'cash_paid')::numeric, 0);
  v_card     numeric := coalesce((p_bill->>'card_paid')::numeric, 0);
begin
  perform pos.require('pos.order');
  -- plan invariant #1, enforced where the money lands: totals must be
  -- internally consistent (these bills feed pos.close_day → finance)
  if v_grand <> v_oh + v_extras - v_discount then
    raise exception 'חשבון לא עקבי: סה״כ (%) שונה מ-בית פתוח (%) + תוספות (%) − הנחה (%)', v_grand, v_oh, v_extras, v_discount;
  end if;
  if v_cash + v_card <> v_grand + v_tip then
    raise exception 'חשבון לא עקבי: מזומן + אשראי (%) שונה מסה״כ + טיפ (%)', v_cash + v_card, v_grand + v_tip;
  end if;
  insert into public.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, discount, grand_total, tip, cash_paid, card_paid, items
  ) values (
    v_id,
    (p_bill->>'table_num')::int, p_bill->>'name',
    coalesce(p_bill->>'status','paid'), p_bill->>'closed_by',
    coalesce((p_bill->>'guests_adults')::int,0),
    coalesce((p_bill->>'guests_children')::int,0),
    coalesce(p_bill->>'pricing_mode','open_house'),
    (p_bill->>'opened_at')::timestamptz,
    coalesce((p_bill->>'paid_at')::timestamptz, now()),
    coalesce((p_bill->>'items_count')::int,0),
    coalesce((p_bill->>'oh_charge')::numeric,0),
    coalesce((p_bill->>'extras_total')::numeric,0),
    coalesce((p_bill->>'menu_value')::numeric,0),
    coalesce((p_bill->>'discount')::numeric,0),
    coalesce((p_bill->>'grand_total')::numeric,0),
    coalesce((p_bill->>'tip')::numeric,0),
    coalesce((p_bill->>'cash_paid')::numeric,0),
    coalesce((p_bill->>'card_paid')::numeric,0),
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
    discount=excluded.discount, tip=excluded.tip,
    grand_total=excluded.grand_total, items=excluded.items;

  delete from public.pos_bill_items where bill_id = v_id;
  insert into public.pos_bill_items
    (bill_id, table_num, paid_at, item_name, category, is_open_house, is_custom, unit_price, qty)
  select v_id, (p_bill->>'table_num')::int,
         coalesce((p_bill->>'paid_at')::timestamptz, now()),
         it->>'item_name', it->>'category',
         coalesce((it->>'is_open_house')::boolean,false),
         coalesce((it->>'is_custom')::boolean,false),
         coalesce((it->>'unit_price')::numeric,0),
         coalesce((it->>'qty')::int,0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as it;

  delete from public.pos_tables where id = v_id;
end; $$;

create or replace function public.pos_reopen_bill(p_id text, p_num int)
returns void language plpgsql security definer set search_path = public, pos as $$
begin
  perform pos.require('pos.order');
  insert into public.pos_tables (id, num, name, guests_adults, guests_children, pricing_mode, opened_at, items)
  select b.id, p_num, b.name, b.guests_adults, b.guests_children, b.pricing_mode, b.opened_at, b.items
  from public.pos_bills b where b.id = p_id;
  delete from public.pos_bills where id = p_id;
end; $$;

create or replace function public.pos_mark_item(p_id text, p_item_id text, p_ready boolean)
returns void language plpgsql security definer set search_path = public, pos as $$
begin
  perform pos.require('pos.kitchen');
  update public.pos_tables t
  set items = coalesce((
        select jsonb_agg(
          case when e->>'id' = p_item_id
               then e || jsonb_build_object('done',
                      case when p_ready then coalesce((e->>'sent')::int, 0)
                                        else coalesce((e->>'served')::int, 0) end)
               else e end)
        from jsonb_array_elements(t.items) e), '[]'::jsonb),
      updated_at = now()
  where t.id = p_id;
end; $$;

-- Day report: authenticated callers without pos.reports get the OPS view —
-- money fields stripped IN THE DB (revenue/cash/card/tips/discounts/avg_bill
-- + labor). Anon (pos.html) keeps the full payload; its manager password
-- gates client-side, today's live behavior.
create or replace function public.pos_day_report(p_date date)
returns jsonb language plpgsql security definer set search_path = public, pos, core as $$
declare
  rep jsonb;
begin
  perform pos.require('pos.analytics');
  select jsonb_build_object(
    'date', p_date,
    'summary', (select jsonb_build_object(
        'bills',     count(*),
        'covers',    coalesce(sum(headcount), 0),
        'revenue',   coalesce(sum(grand_total), 0),
        'cash',      coalesce(sum(cash_paid), 0),
        'card',      coalesce(sum(card_paid), 0),
        'tips',      coalesce(sum(tip), 0),
        'discounts', coalesce(sum(discount), 0),
        'avg_bill',  coalesce(round(avg(grand_total), 0), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0)
      ) from public.pos_bills
      where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date = p_date),
    'food',  (select coalesce(sum(amount), 0) from public.pos_expenses where business_date = p_date and kind = 'food'),
    'labor', (select coalesce(sum(amount), 0) from public.pos_expenses where business_date = p_date and kind = 'labor'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', item_name, 'category', category, 'units', units, 'value', menu_value))
             from (select item_name, category, sum(qty) as units, sum(line_total) as menu_value
                   from public.pos_bill_items
                   where (paid_at at time zone 'Asia/Jerusalem')::date = p_date
                   group by item_name, category order by sum(qty) desc) itm), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'amount', amount, 'note', note, 'by', created_by, 'at', created_at)
               order by created_at)
             from public.pos_expenses where business_date = p_date), '[]'::jsonb)
  ) into rep;

  if auth.role() = 'authenticated' and not core.has_permission('pos.reports') then
    -- ops view is an ALLOWLIST: money fields never materialize for non-reports
    -- callers, so a summary field added later is private by default
    rep = jsonb_set(rep, '{summary}', jsonb_build_object(
      'bills',       rep #> '{summary,bills}',
      'covers',      rep #> '{summary,covers}',
      'avg_minutes', rep #> '{summary,avg_minutes}'));
    rep = rep - 'labor';
    rep = jsonb_set(rep, '{expenses}', coalesce(
      (select jsonb_agg(e) from jsonb_array_elements(rep->'expenses') e where e->>'kind' <> 'labor'),
      '[]'::jsonb));
    if not core.has_permission('pos.costs_food') then
      rep = rep - 'food';
      rep = jsonb_set(rep, '{expenses}', '[]'::jsonb);
    end if;
  end if;
  return rep;
end; $$;

-- ---------------------------------------------------------------------
--  4) pos.close_day — the business day posts to finance (docs §3b/§5).
--     One row per leg: income 'pos' cash / card (method inside source_ref
--     — the posting unique index has no payment_method), expenses
--     'pos_food' / 'pos_labor'. Idempotent: re-running an unchanged day
--     posts nothing. A changed day (late void, added expense) posts a
--     DELTA row 'pos:<date>:<leg>:rN' — derived rows are never edited.
--     Card income posts under payment_method 'grow' (the card terminal).
-- ---------------------------------------------------------------------
create or replace function pos.close_day(p_date date)
returns jsonb
language plpgsql security definer
set search_path = pos, public, finance, core as $$
declare
  v_cash  numeric; v_card numeric; v_food numeric; v_labor numeric;
  leg record;
  posted jsonb := '[]'::jsonb;
  v_current numeric; v_n int; v_delta numeric; v_ref text; v_entry uuid;
begin
  if not core.has_permission('pos.manage') then
    raise exception 'אין הרשאה (pos.manage)';
  end if;

  -- Income = grand_total per bill (net of discount, BEFORE tip — tips never
  -- post). Per-bill split: the card leg is capped at the bill's revenue
  -- (card overpayment = card tip), the cash leg is the remainder — so
  -- cash + card = revenue exactly, both legs non-negative.
  select coalesce(sum(least(card_paid, grand_total)), 0),
         coalesce(sum(grand_total - least(card_paid, grand_total)), 0)
    into v_card, v_cash
  from public.pos_bills
  where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date = p_date;

  select coalesce(sum(amount) filter (where kind = 'food'), 0),
         coalesce(sum(amount) filter (where kind = 'labor'), 0)
    into v_food, v_labor
  from public.pos_expenses where business_date = p_date;

  perform set_config('levyam.finance_posting', 'on', true);
  for leg in
    select * from (values
      ('cash',  'income',  'pos',       v_cash),
      ('card',  'income',  'pos',       v_card),
      ('food',  'expense', 'pos_food',  v_food),
      ('labor', 'expense', 'pos_labor', v_labor)
    ) as t(leg, kind, category, amount)
  loop
    v_ref := 'pos:' || p_date || ':' || leg.leg;
    select coalesce(sum(amount), 0), count(*) into v_current, v_n
    from finance.entries
    where source_module = 'pos'
      and (source_ref = v_ref or source_ref like v_ref || ':r%');

    v_delta := leg.amount - v_current;
    if v_delta = 0 then continue; end if;

    insert into finance.entries
      (kind, category, amount, payment_method, entry_date, note, source_module, source_ref)
    values (
      leg.kind, leg.category, v_delta,
      case leg.leg when 'cash' then 'cash' when 'card' then 'grow' else null end,
      p_date,
      case when v_n = 0 then 'סגירת יום ' || to_char(p_date, 'DD.MM')
           else 'תיקון סגירת יום ' || to_char(p_date, 'DD.MM') end,
      'pos',
      case when v_n = 0 then v_ref else v_ref || ':r' || (v_n + 1) end
    )
    returning id into v_entry;

    posted = posted || jsonb_build_object(
      'leg', leg.leg, 'amount', v_delta, 'entry_id', v_entry,
      'correction', v_n > 0);
  end loop;
  perform set_config('levyam.finance_posting', '', true);

  return jsonb_build_object(
    'date', p_date,
    'cash', v_cash, 'card', v_card, 'food', v_food, 'labor', v_labor,
    'posted', posted);
end; $$;

grant usage on schema pos to authenticated;
grant execute on function pos.close_day(date) to authenticated;
grant execute on function public.pos_close_table(jsonb, jsonb) to authenticated;
grant execute on function public.pos_reopen_bill(text, int)    to authenticated;
grant execute on function public.pos_mark_item(text, text, bool) to authenticated;
grant execute on function public.pos_day_report(date)          to authenticated;

-- ---------------------------------------------------------------------
--  SEED DATA — moved to 45_pos_seeds.sql (2026-07-15). This file targets
--  pre-cutover public.pos_* tables and cannot run on a post-43 database,
--  so the seeds (module row, permission keys, role grants) live in their
--  own always-runnable file. On a FRESH replay, run 45 after this file.
-- ---------------------------------------------------------------------

-- =====================================================================
-- schema/43_pos_cutover.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — POS CUT-OVER & HARDENING
--  Run in the Supabase SQL editor AFTER 42_pos_platform.sql, once pos.html
--  has been redirected to /app/pos (anon access is dropped here — pos.html
--  can no longer use it). Idempotent where Postgres allows (schema moves
--  are a no-op on re-run; DROP FUNCTION/POLICY use IF EXISTS).
--
--  Design: docs/plans/pos-cutover-hardening.md. This file:
--    1) Moves pos_tables/pos_bills/pos_bill_items/pos_expenses (+ the
--       v_sales_* views) from `public` into the `pos` schema — closes the
--       "known consolidation debt" (ARCHITECTURE.md §5).
--    2) Drops the anon RLS policies + grants from 10_pos.sql — the last
--       anon/no-JWT path into the platform is gone (ARCHITECTURE.md
--       invariant 1: RLS + authenticated JWT is the only gate).
--    3) Re-defines the shared RPCs in `pos` (schema-qualifying every
--       pos_* table reference — function bodies don't follow a table's
--       ALTER ... SET SCHEMA the way views/policies/grants do) and drops
--       their old `public.*` counterparts.
--    4) created_by/closed_by hardened via BEFORE INSERT triggers reading
--       auth.jwt() — the client-submitted value is now ignored, not just
--       defaulted.
--    5) pos_close_table recomputes item prices, the open-house charge, and
--       extras_total (sum of the now-validated lines) server-side against a
--       hardcoded mirror of menu.ts, rejecting a mismatch on any of the three
--       (validation only — menu.ts stays the source of truth; no menu-as-data
--       table/admin UI in this initiative; custom items keep their client-
--       declared price uncontested, the documented escape hatch).
--    6) pos.range_report(from, to) — one aggregate query replacing the
--       client's per-day RPC fan-out.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Schema move (guarded — ALTER ... SET SCHEMA errors, not no-ops,
--     if the relation is already there, unlike DROP/CREATE OR REPLACE)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'pos_tables') then
    alter table public.pos_tables set schema pos;
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'pos_bills') then
    alter table public.pos_bills set schema pos;
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'pos_bill_items') then
    alter table public.pos_bill_items set schema pos;
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'pos_expenses') then
    alter table public.pos_expenses set schema pos;
  end if;
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_sales_daily') then
    alter view public.v_sales_daily set schema pos;
  end if;
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_item_sales') then
    alter view public.v_item_sales set schema pos;
  end if;
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_category_sales') then
    alter view public.v_category_sales set schema pos;
  end if;
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'v_sales_hourly') then
    alter view public.v_sales_hourly set schema pos;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  2) Drop anon policies + grants (tables/views moved with their
--     policies and grants intact — this strips the anon ones only)
-- ---------------------------------------------------------------------
drop policy if exists "pos_tables anon"     on pos.pos_tables;
drop policy if exists "pos_bills anon"      on pos.pos_bills;
drop policy if exists "pos_bill_items anon" on pos.pos_bill_items;
drop policy if exists "pos_expenses anon"   on pos.pos_expenses;

revoke all on pos.pos_tables, pos.pos_bills, pos.pos_bill_items, pos.pos_expenses from anon;
revoke all on pos.v_sales_daily, pos.v_item_sales, pos.v_category_sales, pos.v_sales_hourly from anon;

-- ---------------------------------------------------------------------
--  3) Drop the old public-schema RPCs (bodies hardcode public.pos_* —
--     dead the moment the tables above move; replaced in `pos` below)
-- ---------------------------------------------------------------------
drop function if exists public.pos_close_table(jsonb, jsonb);
drop function if exists public.pos_reopen_bill(text, int);
drop function if exists public.pos_mark_item(text, text, bool);
drop function if exists public.pos_day_report(date);

-- ---------------------------------------------------------------------
--  4) Helpers
-- ---------------------------------------------------------------------
-- Permission guard. Anon is gone from pos.* entirely now, so this is a
-- plain check (no more "only enforce for authenticated" carve-out).
create or replace function pos.require(p_perm text)
returns void language plpgsql
set search_path = core, public as $$
begin
  if not core.has_permission(p_perm) then
    raise exception 'אין הרשאה (%)', p_perm;
  end if;
end; $$;

-- Open-house cover charge — mirrors menu.ts OH = { adult: 75, child: 60, family: 60 }
-- (family rate applies to everyone once headcount > 4).
create or replace function pos.oh_charge(p_adults int, p_children int)
returns numeric language sql immutable as $$
  select case when (coalesce(p_adults, 0) + coalesce(p_children, 0)) > 4
    then (coalesce(p_adults, 0) + coalesce(p_children, 0)) * 60
    else coalesce(p_adults, 0) * 75 + coalesce(p_children, 0) * 60
  end
$$;

-- Menu item price mirror (validation only — menu.ts is still the source
-- of truth; keep the two in sync by hand until menu-as-data lands).
-- Returns null for anything not on the menu (custom items are the
-- deliberate escape hatch and are not price-checked here).
create or replace function pos.menu_price(p_name text)
returns numeric language sql immutable as $$
  select case p_name
    when 'טחינה וחמוצים' then 15
    when 'לבנה'          then 20
    when 'סלט כרוב'      then 20
    when 'סלט טבולה'     then 20
    when 'עלי גפן'       then 25
    when 'כרוב ממולא'    then 25
    when 'צלחת ממולאים'  then 45
    when 'זעתר'          then 20
    when 'פיצה'          then 25
    when 'תרד'           then 30
    when 'אספרסו / שחור' then 5
    when 'קפה עם חלב'    then 8
    when 'תה בכוס'       then 8
    when 'קנקן תה'       then 15
    when 'אבטיח טרי'     then 25
    when 'מתוקים'        then 15
    when 'מנת דג'        then 80
    when 'צ''יפס'        then 30
    when 'ארוחת בוקר'    then 65
    when 'עסקית דג'      then 110
    else null
  end
$$;

-- ---------------------------------------------------------------------
--  5) RPCs, moved into `pos` and schema-qualified throughout
-- ---------------------------------------------------------------------
create or replace function pos.pos_close_table(p_bill jsonb, p_items jsonb)
returns void language plpgsql security definer set search_path = pos, public as $$
declare
  v_id       text    := p_bill->>'id';
  v_oh       numeric := coalesce((p_bill->>'oh_charge')::numeric, 0);
  v_extras   numeric := coalesce((p_bill->>'extras_total')::numeric, 0);
  v_discount numeric := coalesce((p_bill->>'discount')::numeric, 0);
  v_grand    numeric := coalesce((p_bill->>'grand_total')::numeric, 0);
  v_tip      numeric := coalesce((p_bill->>'tip')::numeric, 0);
  v_cash     numeric := coalesce((p_bill->>'cash_paid')::numeric, 0);
  v_card     numeric := coalesce((p_bill->>'card_paid')::numeric, 0);
  v_adults   int     := coalesce((p_bill->>'guests_adults')::int, 0);
  v_children int     := coalesce((p_bill->>'guests_children')::int, 0);
  v_computed_extras numeric;
begin
  perform pos.require('pos.order');

  -- server-side price validation: any non-custom line must match the menu
  -- price mirror; custom items are the deliberate no-price-check escape hatch
  -- (lateral join computes menu_price() once per row, not once per operand)
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
    cross join lateral (select pos.menu_price(it->>'item_name') as price) m
    where not coalesce((it->>'is_custom')::boolean, false)
      and m.price is not null
      and m.price <> coalesce((it->>'unit_price')::numeric, 0)
  ) then
    raise exception 'מחיר פריט אינו תואם לתפריט';
  end if;

  -- open-house cover charge must match the guest counts (only when billed as open-house)
  if coalesce(p_bill->>'pricing_mode', 'open_house') = 'open_house'
     and v_oh <> pos.oh_charge(v_adults, v_children) then
    raise exception 'סכום בית פתוח (%) אינו תואם למספר הסועדים', v_oh;
  end if;

  -- extras_total must actually be the sum of the (now price-validated) lines —
  -- without this, per-item price checks are cosmetic: a forger could still
  -- submit any extras_total/grand_total as long as it's internally consistent.
  -- Mirrors tableTotals() in logic.ts: open-house mode bills only the non-OH
  -- (is_open_house=false) lines as "extras"; a-la-carte mode bills everything.
  select coalesce(sum(coalesce((it->>'qty')::int, 0) * coalesce((it->>'unit_price')::numeric, 0)), 0)
    into v_computed_extras
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
  where coalesce(p_bill->>'pricing_mode', 'open_house') <> 'open_house'
     or not coalesce((it->>'is_open_house')::boolean, false);

  if v_extras <> v_computed_extras then
    raise exception 'סכום התוספות (%) אינו תואם לפריטים שהוזמנו (%)', v_extras, v_computed_extras;
  end if;

  -- plan invariant #1, enforced where the money lands: totals must be
  -- internally consistent (these bills feed pos.close_day → finance)
  if v_grand <> v_oh + v_extras - v_discount then
    raise exception 'חשבון לא עקבי: סה״כ (%) שונה מ-בית פתוח (%) + תוספות (%) − הנחה (%)', v_grand, v_oh, v_extras, v_discount;
  end if;
  if v_cash + v_card <> v_grand + v_tip then
    raise exception 'חשבון לא עקבי: מזומן + אשראי (%) שונה מסה״כ + טיפ (%)', v_cash + v_card, v_grand + v_tip;
  end if;

  insert into pos.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, discount, grand_total, tip, cash_paid, card_paid, items
  ) values (
    v_id,
    (p_bill->>'table_num')::int, p_bill->>'name',
    coalesce(p_bill->>'status','paid'), p_bill->>'closed_by',
    v_adults, v_children,
    coalesce(p_bill->>'pricing_mode','open_house'),
    (p_bill->>'opened_at')::timestamptz,
    coalesce((p_bill->>'paid_at')::timestamptz, now()),
    coalesce((p_bill->>'items_count')::int,0),
    v_oh, v_extras,
    coalesce((p_bill->>'menu_value')::numeric,0),
    v_discount, v_grand, v_tip, v_cash, v_card,
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
    discount=excluded.discount, tip=excluded.tip,
    grand_total=excluded.grand_total, items=excluded.items;

  delete from pos.pos_bill_items where bill_id = v_id;
  insert into pos.pos_bill_items
    (bill_id, table_num, paid_at, item_name, category, is_open_house, is_custom, unit_price, qty)
  select v_id, (p_bill->>'table_num')::int,
         coalesce((p_bill->>'paid_at')::timestamptz, now()),
         it->>'item_name', it->>'category',
         coalesce((it->>'is_open_house')::boolean,false),
         coalesce((it->>'is_custom')::boolean,false),
         coalesce((it->>'unit_price')::numeric,0),
         coalesce((it->>'qty')::int,0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as it;

  delete from pos.pos_tables where id = v_id;
end; $$;

create or replace function pos.pos_reopen_bill(p_id text, p_num int)
returns void language plpgsql security definer set search_path = pos, public as $$
begin
  perform pos.require('pos.order');
  insert into pos.pos_tables (id, num, name, guests_adults, guests_children, pricing_mode, opened_at, items)
  select b.id, p_num, b.name, b.guests_adults, b.guests_children, b.pricing_mode, b.opened_at, b.items
  from pos.pos_bills b where b.id = p_id;
  delete from pos.pos_bills where id = p_id;
end; $$;

create or replace function pos.pos_mark_item(p_id text, p_item_id text, p_ready boolean)
returns void language plpgsql security definer set search_path = pos, public as $$
begin
  perform pos.require('pos.kitchen');
  update pos.pos_tables t
  set items = coalesce((
        select jsonb_agg(
          case when e->>'id' = p_item_id
               then e || jsonb_build_object('done',
                      case when p_ready then coalesce((e->>'sent')::int, 0)
                                        else coalesce((e->>'served')::int, 0) end)
               else e end)
        from jsonb_array_elements(t.items) e), '[]'::jsonb),
      updated_at = now()
  where t.id = p_id;
end; $$;

-- ---------------------------------------------------------------------
--  6) Day / range report — shared core so the two entry points can't
--     drift (both apply the same pos.reports/pos.costs_food money-
--     stripping allowlist).
-- ---------------------------------------------------------------------
create or replace function pos.report_for_range(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = pos, core as $$
declare
  rep       jsonb;
  v_reports boolean;
  v_food    boolean;
begin
  perform pos.require('pos.analytics');
  -- checked once up front so every field below can skip its query outright
  -- when the caller isn't entitled to see it, rather than compute-then-redact
  v_reports := core.has_permission('pos.reports');
  v_food    := core.has_permission('pos.costs_food');

  select jsonb_build_object(
    'date', case when p_from = p_to then p_from else null end,
    'from', p_from, 'to', p_to,
    -- ops view is an ALLOWLIST: non-reports callers get exactly these 3
    -- fields computed, nothing money-shaped is ever in scope to leak later
    'summary', (select case when v_reports then jsonb_build_object(
        'bills',     count(*),
        'covers',    coalesce(sum(headcount), 0),
        'revenue',   coalesce(sum(grand_total), 0),
        'cash',      coalesce(sum(cash_paid), 0),
        'card',      coalesce(sum(card_paid), 0),
        'tips',      coalesce(sum(tip), 0),
        'discounts', coalesce(sum(discount), 0),
        'avg_bill',  coalesce(round(avg(grand_total), 0), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0))
      else jsonb_build_object(
        'bills', count(*), 'covers', coalesce(sum(headcount), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0)) end
      from pos.pos_bills
      where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to),
    'food',  case when v_food    then (select coalesce(sum(amount), 0) from pos.pos_expenses
                where business_date between p_from and p_to and kind = 'food') end,
    'labor', case when v_reports then (select coalesce(sum(amount), 0) from pos.pos_expenses
                where business_date between p_from and p_to and kind = 'labor') end,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', item_name, 'category', category, 'units', units, 'value', menu_value))
             from (select item_name, category, sum(qty) as units, sum(line_total) as menu_value
                   from pos.pos_bill_items
                   where (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to
                   group by item_name, category order by sum(qty) desc) itm), '[]'::jsonb),
    'expenses', case when p_from <> p_to or not (v_reports or v_food) then '[]'::jsonb
      else coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'amount', amount, 'note', note, 'by', created_by, 'at', created_at)
               order by created_at)
             from pos.pos_expenses
             where business_date = p_from and (v_reports or kind <> 'labor')), '[]'::jsonb) end
  ) into rep;

  -- absent, not null — a field the query never ran for can't leak later
  if not v_food    then rep = rep - 'food';  end if;
  if not v_reports then rep = rep - 'labor'; end if;
  return rep;
end; $$;

create or replace function pos.pos_day_report(p_date date)
returns jsonb language sql security definer set search_path = pos as $$
  select pos.report_for_range(p_date, p_date);
$$;

-- Replaces the client's per-day fan-out (app-src fetchRangeReport): one
-- aggregate query, no 92-day client cap, no all-or-nothing across N RPCs.
create or replace function pos.range_report(p_from date, p_to date)
returns jsonb language sql security definer set search_path = pos as $$
  select pos.report_for_range(p_from, p_to);
$$;

-- ---------------------------------------------------------------------
--  7) pos.close_day — same posting rule, schema-qualified references
--     updated for the table move (logic unchanged from 42_pos_platform.sql)
-- ---------------------------------------------------------------------
create or replace function pos.close_day(p_date date)
returns jsonb
language plpgsql security definer
set search_path = pos, finance, core as $$
declare
  v_cash  numeric; v_card numeric; v_food numeric; v_labor numeric;
  leg record;
  posted jsonb := '[]'::jsonb;
  v_current numeric; v_n int; v_delta numeric; v_ref text; v_entry uuid;
begin
  if not core.has_permission('pos.manage') then
    raise exception 'אין הרשאה (pos.manage)';
  end if;

  select coalesce(sum(least(card_paid, grand_total)), 0),
         coalesce(sum(grand_total - least(card_paid, grand_total)), 0)
    into v_card, v_cash
  from pos.pos_bills
  where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date = p_date;

  select coalesce(sum(amount) filter (where kind = 'food'), 0),
         coalesce(sum(amount) filter (where kind = 'labor'), 0)
    into v_food, v_labor
  from pos.pos_expenses where business_date = p_date;

  perform set_config('levyam.finance_posting', 'on', true);
  for leg in
    select * from (values
      ('cash',  'income',  'pos',       v_cash),
      ('card',  'income',  'pos',       v_card),
      ('food',  'expense', 'pos_food',  v_food),
      ('labor', 'expense', 'pos_labor', v_labor)
    ) as t(leg, kind, category, amount)
  loop
    v_ref := 'pos:' || p_date || ':' || leg.leg;
    select coalesce(sum(amount), 0), count(*) into v_current, v_n
    from finance.entries
    where source_module = 'pos'
      and (source_ref = v_ref or source_ref like v_ref || ':r%');

    v_delta := leg.amount - v_current;
    if v_delta = 0 then continue; end if;

    insert into finance.entries
      (kind, category, amount, payment_method, entry_date, note, source_module, source_ref)
    values (
      leg.kind, leg.category, v_delta,
      case leg.leg when 'cash' then 'cash' when 'card' then 'grow' else null end,
      p_date,
      case when v_n = 0 then 'סגירת יום ' || to_char(p_date, 'DD.MM')
           else 'תיקון סגירת יום ' || to_char(p_date, 'DD.MM') end,
      'pos',
      case when v_n = 0 then v_ref else v_ref || ':r' || (v_n + 1) end
    )
    returning id into v_entry;

    posted = posted || jsonb_build_object(
      'leg', leg.leg, 'amount', v_delta, 'entry_id', v_entry,
      'correction', v_n > 0);
  end loop;
  perform set_config('levyam.finance_posting', '', true);

  return jsonb_build_object(
    'date', p_date,
    'cash', v_cash, 'card', v_card, 'food', v_food, 'labor', v_labor,
    'posted', posted);
end; $$;

-- ---------------------------------------------------------------------
--  8) created_by / closed_by hardened from the JWT — the client-
--     submitted value is now always overridden, never trusted. Fixes
--     the anon-only gap noted in pos-module.md §8a; pos_bills.closed_by
--     was never actually populated by the platform port (buildBillPayload
--     doesn't send it) so this also starts giving it real values.
-- ---------------------------------------------------------------------
-- one trigger, dispatched by table — pos_expenses.created_by and
-- pos_bills.closed_by are the same "stamp the actor" idiom on two columns
create or replace function pos.set_actor_from_jwt()
returns trigger language plpgsql as $$
declare v_email text := coalesce(auth.jwt()->>'email', 'לא ידוע');
begin
  if TG_TABLE_NAME = 'pos_expenses' then
    new.created_by := v_email;
  else
    new.closed_by := v_email;
  end if;
  return new;
end; $$;

drop trigger if exists pos_expenses_created_by on pos.pos_expenses;
create trigger pos_expenses_created_by before insert on pos.pos_expenses
for each row execute function pos.set_actor_from_jwt();

drop trigger if exists pos_bills_closed_by on pos.pos_bills;
create trigger pos_bills_closed_by before insert on pos.pos_bills
for each row execute function pos.set_actor_from_jwt();

-- superseded by pos.set_actor_from_jwt() above (first cut of this migration
-- created one trigger function per column; consolidated on /simplify review)
drop function if exists pos.set_expense_created_by();
drop function if exists pos.set_bill_closed_by();

-- ---------------------------------------------------------------------
--  9) Grants — authenticated only; anon has no path left into pos.*
-- ---------------------------------------------------------------------
grant execute on function pos.pos_close_table(jsonb, jsonb)   to authenticated;
grant execute on function pos.pos_reopen_bill(text, int)      to authenticated;
grant execute on function pos.pos_mark_item(text, text, bool) to authenticated;
grant execute on function pos.pos_day_report(date)            to authenticated;
grant execute on function pos.range_report(date, date)        to authenticated;
grant execute on function pos.close_day(date)                 to authenticated;

-- =====================================================================
-- schema/44_initplan_sweep.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — H4: RLS initplan sweep, POS apply (one-shot)
--  Run ONCE in the Supabase SQL editor, AFTER 43_pos_cutover.sql.
--
--  The H4 sweep wraps every policy's permission calls as
--  (select core.has_permission(...)) / (select auth.uid()) so the planner
--  evaluates them once per statement (InitPlan) instead of once per row.
--  Behavior is unchanged; supabase/tests/rls_matrix.sql must pass
--  identically before and after.
--
--  Every schema file was updated with the wrapped form, and all of them are
--  drop-then-create re-runnable — so to apply the sweep to prod, RE-RUN THE
--  MODULE FILES THEMSELVES: 00_core.sql, 01_passkeys.sql, 20_finance.sql,
--  21_finance_spine.sql, 30_quotes.sql, 40_events.sql.
--
--  The ONE exception is POS: 42_pos_platform.sql predates the cut-over and
--  targets public.pos_* tables that no longer exist there (43 moved them,
--  policies included, into the `pos` schema), so a re-run can't reach them.
--  This file re-states ONLY the pos policies at their current home. New
--  modules must be born wrapped (MODULE-TEMPLATE.md §1) — do NOT extend
--  this file.
--
--  pos_expenses_insert_auth (per-row pos.costs_<kind> check by design) is
--  intentionally untouched.
-- =====================================================================

drop policy if exists "pos_tables_select_auth" on pos.pos_tables;
create policy "pos_tables_select_auth" on pos.pos_tables for select to authenticated
  using ((select core.has_permission('pos.view')));
drop policy if exists "pos_tables_write_auth" on pos.pos_tables;
create policy "pos_tables_write_auth" on pos.pos_tables for all to authenticated
  using ((select core.has_permission('pos.order')))
  with check ((select core.has_permission('pos.order')));

drop policy if exists "pos_bills_select_auth" on pos.pos_bills;
create policy "pos_bills_select_auth" on pos.pos_bills for select to authenticated
  using ((select core.has_permission('pos.view')));
drop policy if exists "pos_bills_write_auth" on pos.pos_bills;
create policy "pos_bills_write_auth" on pos.pos_bills for update to authenticated
  using ((select core.has_permission('pos.manage')))
  with check ((select core.has_permission('pos.manage')));

drop policy if exists "pos_bill_items_select_auth" on pos.pos_bill_items;
create policy "pos_bill_items_select_auth" on pos.pos_bill_items for select to authenticated
  using ((select core.has_permission('pos.view')));

drop policy if exists "pos_expenses_select_auth" on pos.pos_expenses;
create policy "pos_expenses_select_auth" on pos.pos_expenses for select to authenticated
  using ((select core.has_permission('pos.reports')));
drop policy if exists "pos_expenses_write_auth" on pos.pos_expenses;
create policy "pos_expenses_write_auth" on pos.pos_expenses for delete to authenticated
  using ((select core.has_permission('pos.manage')));

-- ---------------------------------------------------------------------
--  v_sales_* grant pin-down (checked while writing the H1 suite): verified
--  on prod 2026-07-15 that authenticated has NO select on these views —
--  only stray meaningless default-privilege leftovers (TRUNCATE/REFERENCES/
--  TRIGGER) from their public-schema birth. This revoke clears that noise
--  and pins the intended state: the views are not security_invoker, so any
--  future select grant would bypass the pos.reports RLS gate — the H1 suite
--  asserts the denial permanently. The platform reads reports via the
--  permission-checked pos.pos_day_report()/pos.range_report() RPCs only.
-- ---------------------------------------------------------------------
revoke all on pos.v_sales_daily, pos.v_item_sales, pos.v_category_sales, pos.v_sales_hourly
  from authenticated;

-- =====================================================================
-- schema/45_pos_seeds.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — POS seeds: module row, permission keys, role grants
--  Idempotent; safe to re-run in the Supabase SQL editor at any time.
--
--  Lives in its own file (2026-07-15, users-permissions-suite review find):
--  these seeds used to sit at the bottom of 42_pos_platform.sql, but that
--  file targets pre-cutover public.pos_* tables and ABORTS on any post-43
--  database long before reaching its seed section — leaving the pos seeds
--  with no runnable apply path. This file touches only core.* tables, so it
--  runs anywhere. It is the source of truth for the pos permission matrix
--  (docs/plans/pos-module.md §4, as amended by the viewer decision below):
--    owner+manager → all 8 · staff → chef-level · viewer → none
-- =====================================================================

-- insert-or-rename: 00_core.sql no longer seeds a placeholder pos module row
-- (2026-07-15 seed reconciliation), so this file owns the row on a fresh DB
-- (and the upsert renames the English-labelled placeholder on an old one)
insert into core.modules (key, label, icon, sort) values ('pos', 'קופה', '🧾', 20)
on conflict (key) do update set label = excluded.label;

-- all 8 keys seeded HERE (self-sufficient; 00_core.sql's Phase-0 placeholder
-- copies of view/reports had English labels — the updates rename them)
insert into core.permissions (key, module, action, label) values
  ('pos.view',        'pos', 'view',        'כניסה לקופה'),
  ('pos.order',       'pos', 'order',       'פתיחת שולחנות, הזמנות ותשלום'),
  ('pos.kitchen',     'pos', 'kitchen',     'מסך מטבח וסימון מנות מוכנות'),
  ('pos.analytics',   'pos', 'analytics',   'דוח יום תפעולי (ללא כספים)'),
  ('pos.costs_food',  'pos', 'costs_food',  'רישום הוצאות מזון וקבלות'),
  ('pos.costs_labor', 'pos', 'costs_labor', 'רישום הוצאות עבודה'),
  ('pos.reports',     'pos', 'reports',     'דוח יום מלא (כולל כספים)'),
  ('pos.manage',      'pos', 'manage',      'סגירת יום, ביטולים והגדרות')
on conflict (key) do nothing;
update core.permissions set label = 'כניסה לקופה'            where key = 'pos.view';
update core.permissions set label = 'דוח יום מלא (כולל כספים)' where key = 'pos.reports';

-- retire the Phase-0 placeholders (never used by any UI)
delete from core.role_permissions rp using core.permissions p
  where rp.permission_id = p.id and p.key in ('pos.create_bill','pos.refund');
delete from core.permissions where key in ('pos.create_bill','pos.refund');

-- re-grant pos.* from scratch (delete + insert keeps re-runs deterministic)
delete from core.role_permissions rp using core.permissions p
  where rp.permission_id = p.id and p.module = 'pos';

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.module = 'pos'
where r.key in ('owner','manager')
on conflict do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p
  on p.key in ('pos.view','pos.order','pos.kitchen','pos.analytics','pos.costs_food')
where r.key = 'staff'
on conflict do nothing;

-- viewer: NO grants — owner decision 2026-07-15 (users-permissions-suite kickoff):
-- viewer is an empty "no access until granted" placeholder, not read-only POS.
-- The original locked matrix gave it pos.view; prod had already dropped it and
-- the owner confirmed prod is the intended state. The delete-then-insert
-- reconcile above already leaves viewer with nothing; rls_matrix.sql asserts it.

-- =====================================================================
-- schema/46_pos_expenses_tracking.sql
-- =====================================================================
-- =====================================================================
-- 46_pos_expenses_tracking.sql — POS ops v2, PR B (#6 expenses upgrade)
--
-- Adds receipt + paid tracking to pos.pos_expenses and opens the itemized
-- expense list in the report to the full selected date range (#4/#6).
--
--   1) new columns: has_receipt (flag), paid_on (nullable date)
--   2) update path via SECURITY DEFINER RPCs (no blanket UPDATE policy):
--        set_expense_receipt — cost-permission for the expense's kind (or manage)
--        set_expense_paid    — pos.manage only
--   3) report_for_range() — expense objects gain has_receipt/paid_on and the
--      itemized list now spans the range (was single-day only)
--
-- Re-runnable; apply in the Supabase SQL editor after 43/45.
-- Paid-date is operational only — finance posting stays on business_date.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Columns
-- ---------------------------------------------------------------------
alter table pos.pos_expenses add column if not exists has_receipt boolean not null default false;
alter table pos.pos_expenses add column if not exists paid_on     date;  -- null = unpaid

-- ---------------------------------------------------------------------
--  2) Update RPCs — the only write path to these columns. SECURITY
--     DEFINER (runs as owner, bypasses RLS) but each self-checks the
--     caller's permission, same idiom as pos_close_table / close_day.
--     No UPDATE policy/grant exists on pos_expenses, so direct updates
--     stay blocked for every role.
-- ---------------------------------------------------------------------

-- Receipt flag: whoever may log that kind of cost may tick its receipt
-- (food → pos.costs_food, labor → pos.costs_labor); managers may tick either.
create or replace function pos.set_expense_receipt(p_id bigint, p_has_receipt boolean)
returns void language plpgsql security definer set search_path = pos, core as $$
declare v_kind text;
begin
  select kind into v_kind from pos.pos_expenses where id = p_id;
  if v_kind is null then raise exception 'הוצאה לא נמצאה'; end if;
  if not (core.has_permission('pos.costs_' || v_kind) or core.has_permission('pos.manage')) then
    raise exception 'אין הרשאה';
  end if;
  update pos.pos_expenses set has_receipt = p_has_receipt where id = p_id;
end; $$;

-- Mark paid: managers only. p_paid_on = null clears it (back to unpaid).
create or replace function pos.set_expense_paid(p_id bigint, p_paid_on date)
returns void language plpgsql security definer set search_path = pos, core as $$
begin
  perform pos.require('pos.manage');
  update pos.pos_expenses set paid_on = p_paid_on where id = p_id;
end; $$;

-- Edit an expense's name + amount. Amount is financially sensitive (feeds the
-- day's food/labor sum → finance), so this is managers only, like delete.
create or replace function pos.set_expense(p_id bigint, p_note text, p_amount numeric)
returns void language plpgsql security definer set search_path = pos, core as $$
begin
  perform pos.require('pos.manage');
  if p_amount is null or p_amount <= 0 then
    raise exception 'סכום לא תקין';
  end if;
  update pos.pos_expenses set note = nullif(btrim(p_note), ''), amount = p_amount where id = p_id;
end; $$;

-- Postgres grants EXECUTE to PUBLIC on new functions by default. anon has no
-- USAGE on `pos` today, so these aren't reachable — but Phase 4 (public QR menu
-- sourced from POS items) is a plausible reason to expose this schema later, and
-- these are writers. Revoke explicitly first, then grant only to authenticated
-- (same posture as 40_events.sql; a PUBLIC-execute hole was closed once already).
revoke all on function pos.set_expense_receipt(bigint, boolean) from public, anon;
revoke all on function pos.set_expense_paid(bigint, date)       from public, anon;
revoke all on function pos.set_expense(bigint, text, numeric)   from public, anon;

grant execute on function pos.set_expense_receipt(bigint, boolean) to authenticated;
grant execute on function pos.set_expense_paid(bigint, date)       to authenticated;
grant execute on function pos.set_expense(bigint, text, numeric)   to authenticated;

-- ---------------------------------------------------------------------
--  3) report_for_range() — supersedes the 43 version. Two changes:
--     * expense objects carry has_receipt + paid_on
--     * the itemized expense list spans the range (dropped the
--       single-day-only guard); permission gate unchanged.
--     pos_day_report()/range_report() delegate here, so both inherit it.
-- ---------------------------------------------------------------------
create or replace function pos.report_for_range(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = pos, core as $$
declare
  rep       jsonb;
  v_reports boolean;
  v_food    boolean;
begin
  perform pos.require('pos.analytics');
  v_reports := core.has_permission('pos.reports');
  v_food    := core.has_permission('pos.costs_food');

  select jsonb_build_object(
    'date', case when p_from = p_to then p_from else null end,
    'from', p_from, 'to', p_to,
    'summary', (select case when v_reports then jsonb_build_object(
        'bills',     count(*),
        'covers',    coalesce(sum(headcount), 0),
        'revenue',   coalesce(sum(grand_total), 0),
        'cash',      coalesce(sum(cash_paid), 0),
        'card',      coalesce(sum(card_paid), 0),
        'tips',      coalesce(sum(tip), 0),
        'discounts', coalesce(sum(discount), 0),
        'avg_bill',  coalesce(round(avg(grand_total), 0), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0))
      else jsonb_build_object(
        'bills', count(*), 'covers', coalesce(sum(headcount), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0)) end
      from pos.pos_bills
      where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to),
    'food',  case when v_food    then (select coalesce(sum(amount), 0) from pos.pos_expenses
                where business_date between p_from and p_to and kind = 'food') end,
    'labor', case when v_reports then (select coalesce(sum(amount), 0) from pos.pos_expenses
                where business_date between p_from and p_to and kind = 'labor') end,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', item_name, 'category', category, 'units', units, 'value', menu_value))
             from (select item_name, category, sum(qty) as units, sum(line_total) as menu_value
                   from pos.pos_bill_items
                   where (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to
                   group by item_name, category order by sum(qty) desc) itm), '[]'::jsonb),
    -- Itemized expenses across the whole range (was single-day only). Same
    -- permission gate: reports sees all, food-only sees non-labor.
    'expenses', case when not (v_reports or v_food) then '[]'::jsonb
      else coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'amount', amount, 'note', note,
               'by', created_by, 'at', created_at, 'business_date', business_date,
               'has_receipt', has_receipt, 'paid_on', paid_on)
               order by business_date, created_at)
             from pos.pos_expenses
             where business_date between p_from and p_to and (v_reports or kind <> 'labor')), '[]'::jsonb) end
  ) into rep;

  if not v_food    then rep = rep - 'food';  end if;
  if not v_reports then rep = rep - 'labor'; end if;
  return rep;
end; $$;

-- =====================================================================
-- schema/47_pos_payments.sql
-- =====================================================================
-- =====================================================================
--  47_pos_payments.sql — POS split / partial payments + attributed
--  discounts + checkout item voids.  (PR C of POS operations v2)
--
--    1) pos.pos_payments      — money taken against a bill, over time
--    2) pos.pos_item_voids    — audit trail for items removed at checkout
--    3) pos_bills.discount_kind / discount_reason — every discount is attributed
--    4) RPCs: add / edit / void a payment, void an item, read open payments
--    5) pos_close_table  — derives cash/card FROM payments (no longer trusts
--       the client), allocates the tip across payments, and refuses to close
--       a discounted bill that has no attribution
--    6) pos.close_day    — cash/card legs now come from payments taken THAT
--       DAY (so the drawer reconciles daily), net of the tip portion
--
--  Re-runnable; apply in the Supabase SQL editor after 43/45/46.
--  Plan: docs/plans/pos-split-payments.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Tables
-- ---------------------------------------------------------------------
-- bill_id is pos_tables.id while the bill is open and the same id on
-- pos_bills once closed, so payments survive the close and a re-open.
-- No FK: the bill row does not exist yet while the table is open.
create table if not exists pos.pos_payments (
  id       bigint generated always as identity primary key,
  bill_id  text    not null,
  method   text    not null check (method in ('cash', 'card')),
  amount   numeric not null check (amount > 0),
  tip_part numeric not null default 0 check (tip_part >= 0),  -- portion that is tip, not revenue
  note     text,
  taken_by text,                                              -- stamped from the JWT
  taken_at timestamptz not null default now(),
  constraint pos_payments_tip_le_amount check (tip_part <= amount)
);
create index if not exists pos_payments_bill_idx  on pos.pos_payments (bill_id);
create index if not exists pos_payments_taken_idx on pos.pos_payments (taken_at);

create table if not exists pos.pos_item_voids (
  id         bigint generated always as identity primary key,
  bill_id    text    not null,
  item_name  text    not null,
  qty        numeric not null,
  unit_price numeric not null default 0,
  was_fired  boolean not null default false,  -- kitchen had already been sent it
  reason     text,
  voided_by  text,
  voided_at  timestamptz not null default now()
);
create index if not exists pos_item_voids_bill_idx on pos.pos_item_voids (bill_id);

-- Locked down: RLS on, NO policies and NO grants. Every read and write goes
-- through the security-definer RPCs below, which check permissions themselves.
alter table pos.pos_payments   enable row level security;
alter table pos.pos_item_voids enable row level security;
revoke all on pos.pos_payments, pos.pos_item_voids from anon, authenticated;

-- ---------------------------------------------------------------------
--  2) Discount attribution on the bill
-- ---------------------------------------------------------------------
alter table pos.pos_bills add column if not exists discount_kind   text;
alter table pos.pos_bills add column if not exists discount_reason text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pos_bills_discount_kind_chk') then
    alter table pos.pos_bills add constraint pos_bills_discount_kind_chk
      check (discount_kind is null
             or discount_kind in ('family_friends', 'staff', 'service', 'other'));
  end if;
end $$;

-- ---------------------------------------------------------------------
--  3) Payment RPCs
-- ---------------------------------------------------------------------
-- A bill is "open" while its row still exists in pos_tables. Payments may only
-- be edited/voided while open — changing a closed bill's money requires an
-- explicit re-open, so booked money never changes silently.
create or replace function pos.bill_is_open(p_bill_id text)
returns boolean language sql stable set search_path = pos as $$
  select exists (select 1 from pos.pos_tables where id = p_bill_id);
$$;

-- Taking money is floor work: whoever may run a table may record a payment.
create or replace function pos.add_payment(p_bill_id text, p_method text, p_amount numeric, p_note text default null)
returns bigint language plpgsql security definer set search_path = pos, core, public as $$
declare v_id bigint;
begin
  perform pos.require('pos.order');
  -- payments may only be added to an OPEN table; a standalone add against a
  -- closed bill would still be counted by post_day (which sums by taken_at,
  -- not bill status) — an off-books drawer entry. Closing records its own
  -- payment inside pos_close_table while the table row still exists.
  if not pos.bill_is_open(p_bill_id) then
    raise exception 'החשבון סגור — לא ניתן להוסיף תשלום';
  end if;
  if p_amount is null or p_amount <= 0    then raise exception 'סכום לא תקין'; end if;
  if p_method not in ('cash', 'card')     then raise exception 'אמצעי תשלום לא תקין'; end if;
  insert into pos.pos_payments (bill_id, method, amount, note, taken_by)
  values (p_bill_id, p_method, p_amount, nullif(btrim(p_note), ''),
          coalesce(auth.jwt()->>'email', 'לא ידוע'))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function pos.edit_payment(p_id bigint, p_method text, p_amount numeric, p_note text default null)
returns void language plpgsql security definer set search_path = pos, core, public as $$
declare v_bill text;
begin
  perform pos.require('pos.manage');
  select bill_id into v_bill from pos.pos_payments where id = p_id;
  if v_bill is null then raise exception 'תשלום לא נמצא'; end if;
  if not pos.bill_is_open(v_bill) then
    raise exception 'החשבון סגור — יש לפתוח אותו מחדש כדי לשנות תשלומים';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'סכום לא תקין'; end if;
  if p_method not in ('cash', 'card')  then raise exception 'אמצעי תשלום לא תקין'; end if;
  update pos.pos_payments
     set method = p_method, amount = p_amount, note = nullif(btrim(p_note), '')
   where id = p_id;
end; $$;

create or replace function pos.void_payment(p_id bigint)
returns void language plpgsql security definer set search_path = pos, core, public as $$
declare v_bill text;
begin
  perform pos.require('pos.manage');
  select bill_id into v_bill from pos.pos_payments where id = p_id;
  if v_bill is null then raise exception 'תשלום לא נמצא'; end if;
  if not pos.bill_is_open(v_bill) then
    raise exception 'החשבון סגור — יש לפתוח אותו מחדש כדי לשנות תשלומים';
  end if;
  delete from pos.pos_payments where id = p_id;
end; $$;

-- Removing an item the kitchen already cooked destroys an incurred cost, so it
-- needs a manager; removing something never sent is ordinary floor correction.
create or replace function pos.void_item(
  p_bill_id text, p_name text, p_qty numeric,
  p_unit_price numeric, p_was_fired boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = pos, core, public as $$
begin
  if coalesce(p_was_fired, false) then
    perform pos.require('pos.manage');
  else
    perform pos.require('pos.order');
  end if;
  insert into pos.pos_item_voids (bill_id, item_name, qty, unit_price, was_fired, reason, voided_by)
  values (p_bill_id, p_name, coalesce(p_qty, 0), coalesce(p_unit_price, 0),
          coalesce(p_was_fired, false), nullif(btrim(p_reason), ''),
          coalesce(auth.jwt()->>'email', 'לא ידוע'));
end; $$;

-- Payments for every currently-open table, keyed by bill_id — one round trip
-- for the floor grid and the table view's balance-due.
create or replace function pos.open_payments()
returns jsonb language plpgsql security definer set search_path = pos, core as $$
begin
  perform pos.require('pos.order');
  return coalesce((
    select jsonb_object_agg(bill_id, arr) from (
      select p.bill_id, jsonb_agg(jsonb_build_object(
               'id', p.id, 'method', p.method, 'amount', p.amount,
               'note', p.note, 'by', p.taken_by, 'at', p.taken_at)
             order by p.taken_at, p.id) as arr
      from pos.pos_payments p
      join pos.pos_tables t on t.id = p.bill_id
      group by p.bill_id) x), '{}'::jsonb);
end; $$;

-- ---------------------------------------------------------------------
--  4) pos_close_table — supersedes the 43 version.
--     * p_payments records the closing payment(s) atomically — an array of
--       {method, amount, note}, so a split cash+card close is one tx with
--       any partial payments already taken while the table was open
--     * cash/card are DERIVED from pos_payments (client values ignored)
--     * the bill's tip is allocated across payments, newest first, so
--       close_day can post revenue net of tips
--     * a discount must carry an attribution
--     Everything else (price validation, OH charge, extras cross-check,
--     internal consistency) is unchanged from 43.
-- ---------------------------------------------------------------------
-- the 2-arg signature must go, or a 2-arg call becomes ambiguous against the
-- new 3-arg default-bearing one; drop the 3-arg too so re-running this file can
-- rename the third parameter (p_payment → p_payments) via create-or-replace
drop function if exists pos.pos_close_table(jsonb, jsonb);
drop function if exists pos.pos_close_table(jsonb, jsonb, jsonb);

create or replace function pos.pos_close_table(p_bill jsonb, p_items jsonb, p_payments jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = pos, public as $$
declare
  v_id       text    := p_bill->>'id';
  v_oh       numeric := coalesce((p_bill->>'oh_charge')::numeric, 0);
  v_extras   numeric := coalesce((p_bill->>'extras_total')::numeric, 0);
  v_discount numeric := coalesce((p_bill->>'discount')::numeric, 0);
  v_grand    numeric := coalesce((p_bill->>'grand_total')::numeric, 0);
  v_tip      numeric := coalesce((p_bill->>'tip')::numeric, 0);
  v_kind     text    := nullif(btrim(p_bill->>'discount_kind'), '');
  v_reason   text    := nullif(btrim(p_bill->>'discount_reason'), '');
  v_adults   int     := coalesce((p_bill->>'guests_adults')::int, 0);
  v_children int     := coalesce((p_bill->>'guests_children')::int, 0);
  v_cash     numeric;
  v_card     numeric;
  v_pcount   int;
  v_left     numeric;
  v_computed_extras numeric;
  r          record;
begin
  perform pos.require('pos.order');
  -- this close writes several payment rows + tip_part updates; suppress the
  -- per-row auto re-post (48) so they don't each fire — we re-post once at the
  -- end instead. No-op until 48 is applied.
  perform set_config('levyam.suppress_repost', 'on', true);

  -- every discount is attributed — enforced here, not just in the UI, because
  -- "nothing from the side" is only true if the database refuses the alternative
  if v_discount > 0 then
    if v_kind is null then
      raise exception 'יש לציין את סיבת ההנחה';
    end if;
    if v_kind = 'other' and v_reason is null then
      raise exception 'יש לפרט את סיבת ההנחה';
    end if;
  end if;

  -- server-side price validation: any non-custom line must match the menu
  -- price mirror; custom items are the deliberate no-price-check escape hatch
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
    cross join lateral (select pos.menu_price(it->>'item_name') as price) m
    where not coalesce((it->>'is_custom')::boolean, false)
      and m.price is not null
      and m.price <> coalesce((it->>'unit_price')::numeric, 0)
  ) then
    raise exception 'מחיר פריט אינו תואם לתפריט';
  end if;

  if coalesce(p_bill->>'pricing_mode', 'open_house') = 'open_house'
     and v_oh <> pos.oh_charge(v_adults, v_children) then
    raise exception 'סכום בית פתוח (%) אינו תואם למספר הסועדים', v_oh;
  end if;

  select coalesce(sum(coalesce((it->>'qty')::int, 0) * coalesce((it->>'unit_price')::numeric, 0)), 0)
    into v_computed_extras
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
  where coalesce(p_bill->>'pricing_mode', 'open_house') <> 'open_house'
     or not coalesce((it->>'is_open_house')::boolean, false);

  if v_extras <> v_computed_extras then
    raise exception 'סכום התוספות (%) אינו תואם לפריטים שהוזמנו (%)', v_extras, v_computed_extras;
  end if;

  if v_grand <> v_oh + v_extras - v_discount then
    raise exception 'חשבון לא עקבי: סה״כ (%) שונה מ-בית פתוח (%) + תוספות (%) − הנחה (%)', v_grand, v_oh, v_extras, v_discount;
  end if;

  -- record the closing payment(s) before deriving — one row per array entry
  insert into pos.pos_payments (bill_id, method, amount, note, taken_by)
  select v_id,
         coalesce(pmt->>'method', 'cash'),
         (pmt->>'amount')::numeric,
         nullif(btrim(pmt->>'note'), ''),
         coalesce(auth.jwt()->>'email', 'לא ידוע')
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) pmt
  where coalesce((pmt->>'amount')::numeric, 0) > 0
    and coalesce(pmt->>'method', 'cash') in ('cash', 'card');

  -- allocate the bill's tip across its payments, newest first, so that
  -- (amount - tip_part) is exactly the revenue collected by each payment
  update pos.pos_payments set tip_part = 0 where bill_id = v_id;
  v_left := v_tip;
  for r in select id, amount from pos.pos_payments
            where bill_id = v_id order by taken_at desc, id desc loop
    exit when v_left <= 0;
    update pos.pos_payments set tip_part = least(v_left, r.amount) where id = r.id;
    v_left := v_left - least(v_left, r.amount);
  end loop;

  -- cash/card come from the recorded payments — the client no longer gets to
  -- assert what was collected. BACKWARD COMPAT: a legacy client (pre-split-
  -- payments) records no payments and instead sends cash_paid/card_paid in the
  -- payload; when there are zero recorded payments, trust those so the deployed
  -- POS keeps closing tables until the new client ships.
  select coalesce(sum(amount) filter (where method = 'cash'), 0),
         coalesce(sum(amount) filter (where method = 'card'), 0),
         count(*)
    into v_cash, v_card, v_pcount
  from pos.pos_payments where bill_id = v_id;

  if v_pcount = 0 then
    v_cash := coalesce((p_bill->>'cash_paid')::numeric, 0);
    v_card := coalesce((p_bill->>'card_paid')::numeric, 0);
  end if;

  if v_cash + v_card <> v_grand + v_tip then
    raise exception 'חשבון לא עקבי: תשלומים שנרשמו (%) שונים מסה״כ + טיפ (%)', v_cash + v_card, v_grand + v_tip;
  end if;

  insert into pos.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, discount, discount_kind, discount_reason,
    grand_total, tip, cash_paid, card_paid, items
  ) values (
    v_id,
    (p_bill->>'table_num')::int, p_bill->>'name',
    coalesce(p_bill->>'status','paid'), p_bill->>'closed_by',
    v_adults, v_children,
    coalesce(p_bill->>'pricing_mode','open_house'),
    (p_bill->>'opened_at')::timestamptz,
    coalesce((p_bill->>'paid_at')::timestamptz, now()),
    coalesce((p_bill->>'items_count')::int,0),
    v_oh, v_extras,
    coalesce((p_bill->>'menu_value')::numeric,0),
    v_discount, v_kind, v_reason,
    v_grand, v_tip, v_cash, v_card,
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
    discount=excluded.discount, discount_kind=excluded.discount_kind,
    discount_reason=excluded.discount_reason, tip=excluded.tip,
    grand_total=excluded.grand_total, items=excluded.items;

  delete from pos.pos_bill_items where bill_id = v_id;
  insert into pos.pos_bill_items
    (bill_id, table_num, paid_at, item_name, category, is_open_house, is_custom, unit_price, qty)
  select v_id, (p_bill->>'table_num')::int,
         coalesce((p_bill->>'paid_at')::timestamptz, now()),
         it->>'item_name', it->>'category',
         coalesce((it->>'is_open_house')::boolean,false),
         coalesce((it->>'is_custom')::boolean,false),
         coalesce((it->>'unit_price')::numeric,0),
         coalesce((it->>'qty')::int,0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as it;

  delete from pos.pos_tables where id = v_id;

  -- Re-post every already-booked day this bill touches. Usually that's just
  -- today (a no-op — today isn't booked yet). But a reopened past bill can carry
  -- payments on a past, booked day, and the tip_part reallocation above
  -- (suppressed, so it didn't fire the row trigger) changed their revenue. The
  -- bill's own paid_at day is included too: a legacy/fallback close records NO
  -- payment rows (post_day reads its revenue straight off the bill, 47), and the
  -- pos_bills insert was suppressed with everything else — so without paid_at
  -- here a fallback close onto a booked day would never re-post. repost_if_posted
  -- is defined in 48; the reference resolves at call time. Then lift the suppress.
  for r in
    select distinct d from (
      select (taken_at at time zone 'Asia/Jerusalem')::date as d
      from pos.pos_payments where bill_id = v_id
      union
      select (coalesce((p_bill->>'paid_at')::timestamptz, now()) at time zone 'Asia/Jerusalem')::date
    ) days loop
    perform pos.repost_if_posted(r.d);
  end loop;
  perform set_config('levyam.suppress_repost', '', true);
end; $$;

-- ---------------------------------------------------------------------
--  5) close_day — cash/card now derived from payments taken THAT DAY
--     (net of the tip portion) instead of from bills closed that day, so
--     a deposit taken Monday counts on Monday and the drawer reconciles.
--     Split in two: pos.post_day() holds the posting logic with no
--     permission check (PR E's automatic re-post calls it), and
--     pos.close_day() is the thin permission-checked manual entry point.
-- ---------------------------------------------------------------------
-- pos.post_day() is authored in 55_finance_reconciliation.sql and ONLY there.
-- It used to live here, carrying its own copy of the four leg definitions and
-- the two-source legacy revenue read. 55 lifted that computation into
-- pos.day_expected_legs() so the source_ref grammar and the leg list have one
-- author, and PR C then added the pinned-day refusal to post_day itself. A copy
-- left here would be restored by any re-run of this file — and that copy would
-- happily overwrite an owner correction on a pinned day, which is exactly the
-- failure the pin exists to prevent.

create or replace function pos.close_day(p_date date)
returns jsonb language plpgsql security definer set search_path = pos, core as $$
begin
  perform pos.require('pos.manage');
  return pos.post_day(p_date);
end; $$;

-- ---------------------------------------------------------------------
--  5b) report_for_range — supersedes the 46 version, adding a discount
--      breakdown by attribution (family & friends visible as its own
--      number). Reports-permission only; stripped for ops callers. Kept
--      here (not 46) because it references discount_kind, added above.
-- ---------------------------------------------------------------------
create or replace function pos.report_for_range(p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = pos, core as $$
declare
  rep       jsonb;
  v_reports boolean;
  v_food    boolean;
begin
  perform pos.require('pos.analytics');
  v_reports := core.has_permission('pos.reports');
  v_food    := core.has_permission('pos.costs_food');

  select jsonb_build_object(
    'date', case when p_from = p_to then p_from else null end,
    'from', p_from, 'to', p_to,
    'summary', (select case when v_reports then jsonb_build_object(
        'bills',     count(*),
        'covers',    coalesce(sum(headcount), 0),
        'revenue',   coalesce(sum(grand_total), 0),
        'cash',      coalesce(sum(cash_paid), 0),
        'card',      coalesce(sum(card_paid), 0),
        'tips',      coalesce(sum(tip), 0),
        'discounts', coalesce(sum(discount), 0),
        'avg_bill',  coalesce(round(avg(grand_total), 0), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0))
      else jsonb_build_object(
        'bills', count(*), 'covers', coalesce(sum(headcount), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0)) end
      from pos.pos_bills
      where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to),
    'food',  case when v_food    then (select coalesce(sum(amount), 0) from pos.pos_expenses
                where business_date between p_from and p_to and kind = 'food') end,
    'labor', case when v_reports then (select coalesce(sum(amount), 0) from pos.pos_expenses
                where business_date between p_from and p_to and kind = 'labor') end,
    -- discounts broken out by attribution — governance visibility
    'discounts_by_kind', case when v_reports then (
        select coalesce(jsonb_object_agg(k, s), '{}'::jsonb) from (
          select coalesce(discount_kind, 'unattributed') as k, sum(discount) as s
          from pos.pos_bills
          where status = 'paid' and coalesce(discount, 0) > 0
            and (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to
          group by 1) d) end,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', item_name, 'category', category, 'units', units, 'value', menu_value))
             from (select item_name, category, sum(qty) as units, sum(line_total) as menu_value
                   from pos.pos_bill_items
                   where (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to
                   group by item_name, category order by sum(qty) desc) itm), '[]'::jsonb),
    'expenses', case when not (v_reports or v_food) then '[]'::jsonb
      else coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'amount', amount, 'note', note,
               'by', created_by, 'at', created_at, 'business_date', business_date,
               'has_receipt', has_receipt, 'paid_on', paid_on)
               order by business_date, created_at)
             from pos.pos_expenses
             where business_date between p_from and p_to and (v_reports or kind <> 'labor')), '[]'::jsonb) end
  ) into rep;

  if not v_food    then rep = rep - 'food';  end if;
  if not v_reports then rep = rep - 'labor' - 'discounts_by_kind'; end if;
  return rep;
end; $$;

-- ---------------------------------------------------------------------
--  6) Grants — functions are EXECUTE-to-PUBLIC by default; revoke first,
--     then grant only to authenticated (see PR B: this bit us once).
--     post_day's revoke moved to 55 alongside its definition — revoking a
--     function this file no longer creates would fail on a fresh install.
-- ---------------------------------------------------------------------
revoke all on function pos.bill_is_open(text)                                   from public, anon;
revoke all on function pos.add_payment(text, text, numeric, text)               from public, anon;
revoke all on function pos.edit_payment(bigint, text, numeric, text)            from public, anon;
revoke all on function pos.void_payment(bigint)                                 from public, anon;
revoke all on function pos.void_item(text, text, numeric, numeric, boolean, text) from public, anon;
revoke all on function pos.open_payments()                                      from public, anon;
revoke all on function pos.pos_close_table(jsonb, jsonb, jsonb)                 from public, anon;
revoke all on function pos.close_day(date)                                      from public, anon;

grant execute on function pos.add_payment(text, text, numeric, text)               to authenticated;
grant execute on function pos.edit_payment(bigint, text, numeric, text)            to authenticated;
grant execute on function pos.void_payment(bigint)                                 to authenticated;
grant execute on function pos.void_item(text, text, numeric, numeric, boolean, text) to authenticated;
grant execute on function pos.open_payments()                                      to authenticated;
grant execute on function pos.pos_close_table(jsonb, jsonb, jsonb)                 to authenticated;
grant execute on function pos.close_day(date)                                      to authenticated;

-- =====================================================================
-- schema/48_pos_day_lifecycle.sql
-- =====================================================================
-- =====================================================================
--  48_pos_day_lifecycle.sql — write-to-books + automatic re-post.
--  (PR E of POS operations v2)
--
--  The first write to the books stays manual (pos.close_day, a manager
--  action). After that, any change to a booked day's money re-runs the
--  posting automatically and writes the correcting delta, so the books
--  never drift. Builds on pos.post_day (PR C — the permission-free
--  posting core).
--
--  Re-runnable; apply in the Supabase SQL editor after 47.
--  Plan: docs/plans/pos-day-lifecycle.md
--
--  AMENDED by PR C of the finance books-integrity initiative
--  (docs/plans/finance-books-integrity.md): a day can now be PINNED, which
--  stops the automatic re-post from overwriting an owner correction. The pin
--  table lives here rather than in 56_finance_override.sql for two reasons —
--  it belongs next to the re-post logic that honours it, and 55's
--  reconciliation reads it, so a file numbered after 55 could not create it
--  without breaking a fresh install.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Has this day already been written to the books?
-- ---------------------------------------------------------------------
-- The one place that encodes the finance source_ref grammar authored by
-- pos.post_day (47): 'pos:<date>:<leg>[:r<n>]'. Both readers below LIKE against
-- this prefix, so the format lives in a single spot.
create or replace function pos.day_ref_prefix(p_date date)
returns text language sql immutable as $$ select 'pos:' || p_date || ':'; $$;

create or replace function pos.day_is_posted(p_date date)
returns boolean language sql stable security definer set search_path = pos, finance as $$
  select exists (
    select 1 from finance.entries
    where source_module = 'pos' and source_ref like pos.day_ref_prefix(p_date) || '%');
$$;

-- ---------------------------------------------------------------------
--  1b) PINS — "stop recomputing this day" (PR C of finance books-integrity).
--
--  An owner correction deliberately parts the books from what POS would
--  recompute. Without a pin, the next edit to any of the day's bills,
--  payments or expenses fires the trigger below and the correcting delta is
--  written straight back out — so "the owner can override anything" would be
--  a feature that quietly does not work. A pin freezes the day: the automatic
--  re-post skips it, and pos.post_day() refuses it outright.
--
--  A pin is deliberately VISIBLE, never silent: finance.reconciliation()
--  (55) lists every pinned day so one frozen months ago cannot decay into
--  invisible drift.
-- ---------------------------------------------------------------------
create table if not exists pos.day_pins (
  business_date date primary key,
  reason        text not null default '',
  pinned_by     uuid default auth.uid() references auth.users(id),
  pinned_at     timestamptz not null default now()
);

-- Internal, same posture as day_is_posted: called by the trigger path (running
-- as whichever staff member edited an expense, who holds no finance permission)
-- and by the definer-rights reconciliation report. Revoked from every client.
create or replace function pos.day_is_pinned(p_date date)
returns boolean language sql stable security definer set search_path = pos as $$
  select exists (select 1 from pos.day_pins where business_date = p_date);
$$;

-- Re-post a day, but only if it has already been booked (the first post is a
-- deliberate manual act). post_day writes only the delta, so this is a no-op
-- when nothing changed.
--
-- A pinned day is skipped SILENTLY — that is precisely what the pin asks for,
-- and this runs inside a trigger on someone else's expense edit: raising here
-- would abort an unrelated write by a staff member who cannot even see the
-- books. The loud refusal belongs on the manual path, and lives in
-- pos.post_day() (55) so every caller gets it by default.
create or replace function pos.repost_if_posted(p_date date)
returns void language plpgsql security definer set search_path = pos, finance, core as $$
begin
  if p_date is not null and pos.day_is_posted(p_date) and not pos.day_is_pinned(p_date) then
    perform pos.post_day(p_date);
  end if;
end; $$;

-- ---------------------------------------------------------------------
--  2) Auto re-post trigger — fires on every table post_day reads:
--     payments (revenue, new bills), expenses (food/labor), AND pos_bills
--     (revenue for LEGACY / fallback-close bills that have no payment rows —
--     see the two-source revenue read in pos.post_day, 47). Keyed by the
--     table's own date column (business_date / taken_at / paid_at).
--     Suppressed inside pos_close_table (which does its own single re-post
--     at the end, covering the bill's paid_at day too) so a multi-row close
--     doesn't fan out.
-- ---------------------------------------------------------------------
create or replace function pos.autorepost()
returns trigger language plpgsql security definer set search_path = pos, finance, core as $$
declare d_old date; d_new date;
begin
  if coalesce(current_setting('levyam.suppress_repost', true), '') = 'on' then
    return null;
  end if;

  if TG_TABLE_NAME = 'pos_expenses' then
    if TG_OP <> 'INSERT' then d_old := OLD.business_date; end if;
    if TG_OP <> 'DELETE' then d_new := NEW.business_date; end if;
  elsif TG_TABLE_NAME = 'pos_bills' then
    if TG_OP <> 'INSERT' then d_old := (OLD.paid_at at time zone 'Asia/Jerusalem')::date; end if;
    if TG_OP <> 'DELETE' then d_new := (NEW.paid_at at time zone 'Asia/Jerusalem')::date; end if;
  else -- pos_payments
    if TG_OP <> 'INSERT' then d_old := (OLD.taken_at at time zone 'Asia/Jerusalem')::date; end if;
    if TG_OP <> 'DELETE' then d_new := (NEW.taken_at at time zone 'Asia/Jerusalem')::date; end if;
  end if;

  perform pos.repost_if_posted(d_new);
  if d_old is distinct from d_new then perform pos.repost_if_posted(d_old); end if;
  return null;
end; $$;

drop trigger if exists pos_payments_autorepost on pos.pos_payments;
create trigger pos_payments_autorepost after insert or update or delete on pos.pos_payments
for each row execute function pos.autorepost();

drop trigger if exists pos_expenses_autorepost on pos.pos_expenses;
create trigger pos_expenses_autorepost after insert or update or delete on pos.pos_expenses
for each row execute function pos.autorepost();

-- pos_bills: a payment-less bill's money lives on the bill, so a close (insert),
-- reopen (delete), or money-changing edit must re-post its paid_at day. INSERT/
-- DELETE always fire; UPDATE fires only when a revenue-relevant column moves —
-- so the bulk archived_at "clear day" sweep (which post_day ignores) doesn't
-- trigger a storm of no-op re-posts.
drop trigger if exists pos_bills_autorepost_id on pos.pos_bills;
create trigger pos_bills_autorepost_id after insert or delete on pos.pos_bills
for each row execute function pos.autorepost();

drop trigger if exists pos_bills_autorepost_upd on pos.pos_bills;
create trigger pos_bills_autorepost_upd after update on pos.pos_bills
for each row when (
  old.status      is distinct from new.status      or
  old.grand_total is distinct from new.grand_total or
  old.cash_paid   is distinct from new.cash_paid    or
  old.card_paid   is distinct from new.card_paid    or
  old.paid_at     is distinct from new.paid_at
) execute function pos.autorepost();

-- ---------------------------------------------------------------------
--  3) Day posting status for the report badge.
-- ---------------------------------------------------------------------
create or replace function pos.day_status(p_date date)
returns jsonb language plpgsql security definer set search_path = pos, finance, core as $$
declare v_pin pos.day_pins%rowtype;
begin
  perform pos.require('pos.reports');
  select * into v_pin from pos.day_pins where business_date = p_date;
  return jsonb_build_object(
    'posted', pos.day_is_posted(p_date),
    -- corrections carry a ':r<n>' suffix on the source_ref (post_day)
    'corrected', exists (
      select 1 from finance.entries
      where source_module = 'pos' and source_ref like pos.day_ref_prefix(p_date) || '%:r%'),
    -- pinned: the books hold an owner correction and POS must stop recomputing
    'pinned', v_pin.business_date is not null,
    'pin_reason', v_pin.reason);
end; $$;

-- ---------------------------------------------------------------------
--  4) Grants — day_status is client-callable (reports holders); the rest
--     are internal (triggers run as the definer owner). Revoke the
--     PUBLIC-execute default first (see PR B).
-- ---------------------------------------------------------------------
revoke all on function pos.day_ref_prefix(date)    from public, anon, authenticated;
revoke all on function pos.day_is_posted(date)     from public, anon, authenticated;
revoke all on function pos.day_is_pinned(date)     from public, anon, authenticated;
revoke all on function pos.repost_if_posted(date)  from public, anon, authenticated;
revoke all on function pos.autorepost()            from public, anon, authenticated;
revoke all on function pos.day_status(date)        from public, anon;
grant  execute on function pos.day_status(date)    to authenticated;

-- ---------------------------------------------------------------------
--  5) Pins — RLS + grants.
--     Read: anyone who can already see the day's money, from either side
--     (a POS manager reading the day report, or a finance reader looking at
--     the reconciliation list) — a pin is never a secret.
--     Write: finance.override only (owner), seeded in 56_finance_override.sql.
--     The permission key is just a string here, so this file stays applicable
--     before 56 has run — the policy simply denies until the seed lands.
-- ---------------------------------------------------------------------
alter table pos.day_pins enable row level security;

drop policy if exists "pos_day_pins_read"  on pos.day_pins;
drop policy if exists "pos_day_pins_write" on pos.day_pins;

-- (select …) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "pos_day_pins_read" on pos.day_pins for select to authenticated
  using ((select core.has_permission('pos.reports') or core.has_permission('finance.view')));
create policy "pos_day_pins_write" on pos.day_pins for all to authenticated
  using ((select core.has_permission('finance.override')))
  with check ((select core.has_permission('finance.override')));

revoke all on pos.day_pins from anon, authenticated;
-- business_date/reason only: pinned_by and pinned_at are stamped by their
-- defaults, and a client that could write them could forge who froze a day.
grant select on pos.day_pins to authenticated;
grant insert (business_date, reason) on pos.day_pins to authenticated;
grant update (reason)                on pos.day_pins to authenticated;
grant delete on pos.day_pins to authenticated;

-- =====================================================================
-- schema/49_pos_kitchen.sql
-- =====================================================================
-- ---------------------------------------------------------------------
--  49_pos_kitchen.sql — kitchen "mark ready" becomes per-unit
--
--  Owner request (2026-07-28): when a line has several units in the kitchen,
--  each "מוכן ✓" tap should mark ONE unit ready, not clear the whole line.
--  So pos_mark_item moves `done` by a single unit instead of jumping it to
--  `sent` (ready) / `served` (undo). Signature is unchanged (text, text, bool)
--  — p_ready=true advances one unit, p_ready=false steps one back — so no
--  client arity change. Read-modify-write stays server-side and clamped
--  (served ≤ done ≤ sent) so it can't clobber a waiter editing the same table
--  or drift out of the qty→sent→done→served pipeline.
--
--  Plan: docs/plans/pos-menu-kitchen.md (PR 1). Supersedes the whole-line
--  version in 43_pos_cutover.sql.
-- ---------------------------------------------------------------------
create or replace function pos.pos_mark_item(p_id text, p_item_id text, p_ready boolean)
returns void language plpgsql security definer set search_path = pos, public as $$
begin
  perform pos.require('pos.kitchen');
  update pos.pos_tables t
  set items = coalesce((
        select jsonb_agg(
          case when e->>'id' = p_item_id
               then e || jsonb_build_object('done',
                      case
                        -- one more unit ready, never past what's been sent
                        when p_ready then least(coalesce((e->>'sent')::int, 0),
                                                coalesce((e->>'done')::int, 0) + 1)
                        -- one unit back, never below what's already been served (carried out)
                        else greatest(coalesce((e->>'served')::int, 0),
                                      coalesce((e->>'done')::int, 0) - 1)
                      end)
               else e end)
        from jsonb_array_elements(t.items) e), '[]'::jsonb),
      updated_at = now()
  where t.id = p_id;
end; $$;

-- =====================================================================
-- schema/50_storage.sql
-- =====================================================================
-- =====================================================================
--  Lev Yam platform — STORAGE posture (repo source of truth, H7 2026-07-15)
--  Idempotent; safe to re-run in the Supabase SQL editor.
--
--  One private bucket: quotes-docs — the immutable PDF/HTML snapshots of
--  signed contracts imported from the legacy quotes app (legal records).
--
--  Verified on prod 2026-07-15: storage.objects has RLS enabled and ZERO
--  policies — deliberately. No client (anon or authenticated, any role)
--  can list, read, or write objects; only service_role (dashboard, Edge
--  Functions) reaches them. That is the strictest possible posture for
--  legal documents (ARCHITECTURE.md §2 "sensitive artifacts get the
--  strictest storage") and it is the INTENDED state — this file exists so
--  the posture is versioned here instead of implied by dashboard state.
--
--  If the quotes module ever needs in-app access to these files, add a
--  narrow select policy gated by (select core.has_permission('quotes.contracts'))
--  HERE (and extend supabase/tests/rls_matrix.sql) — never via the dashboard.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('quotes-docs', 'quotes-docs', false)
on conflict (id) do update set public = false;

-- No storage.objects policies — intentionally none (see header).

-- =====================================================================
-- schema/51_pos_menu.sql
-- =====================================================================
-- =====================================================================
--  51_pos_menu.sql — POS menu-as-data (PR 2 of the pos-menu-kitchen initiative)
--
--  The menu stops being a code literal (app-src/src/modules/pos/menu.ts) and
--  becomes owner-editable DB rows. This is the single source of truth for
--  categories, items, prices (HE/AR), add-ons, and meals; it retires the
--  hand-kept pos.menu_price() literal mirror (its price validation now reads
--  these tables) and feeds Phase 4's QR menu later.
--
--  Open house is retired going forward (owner 2026-07-28): no menu row carries
--  an open-house flag, new bills are always à-la-carte. History is untouched —
--  pricing_mode/oh_charge/is_open_house columns and pos.oh_charge() stay so a
--  reopened legacy bill still settles; new bills simply never use them.
--
--  Plan: docs/plans/pos-menu-kitchen.md. Seed = the August 2026 printed menu
--  (owner-confirmed prices) + the four hot drinks carried POS-only.
-- =====================================================================

-- ── 1) Tables ────────────────────────────────────────────────────────
create table if not exists pos.menu_categories (
  id         text primary key,                        -- stable slug ('salads', 'meals'…)
  name_he    text not null,
  name_ar    text not null,
  sort       int  not null default 0,
  pos_only   boolean not null default false,          -- sold at the POS but off the printed menu (drinks)
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists pos.menu_items (
  id          text primary key,                       -- stable slug
  category_id text not null references pos.menu_categories(id),
  name_he     text not null,
  name_ar     text not null,
  price       numeric not null default 0 check (price >= 0),
  sort        int  not null default 0,
  is_meal     boolean not null default false,         -- a combo: composition drives the picker + kitchen
  composition jsonb,                                  -- meals only: { includes:[…], slots:[{…,options:[…]}] }
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  constraint menu_items_meal_has_composition check (not is_meal or composition is not null)
);
create index if not exists menu_items_category_idx on pos.menu_items (category_id);
-- price validation (pos.menu_price) looks an item up by name — keep active names unique
-- so the lookup is unambiguous, and a duplicate name fails closed at edit time.
create unique index if not exists menu_items_name_active_idx on pos.menu_items (name_he) where active;

-- ── 2) Audit: stamp updated_at / updated_by from the JWT on write ─────
create or replace function pos.touch_menu_actor()
returns trigger language plpgsql security definer set search_path = pos, public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt()->>'email', 'לא ידוע');
  return new;
end; $$;
drop trigger if exists menu_categories_touch on pos.menu_categories;
create trigger menu_categories_touch before insert or update on pos.menu_categories
for each row execute function pos.touch_menu_actor();
drop trigger if exists menu_items_touch on pos.menu_items;
create trigger menu_items_touch before insert or update on pos.menu_items
for each row execute function pos.touch_menu_actor();

-- ── 3) RLS: everyone who can see the POS reads the menu; only pos.menu writes ──
alter table pos.menu_categories enable row level security;
alter table pos.menu_items      enable row level security;
revoke all on pos.menu_categories, pos.menu_items from anon, authenticated;
grant select, insert, update, delete on pos.menu_categories, pos.menu_items to authenticated;

drop policy if exists menu_categories_read  on pos.menu_categories;
drop policy if exists menu_categories_write on pos.menu_categories;
drop policy if exists menu_items_read       on pos.menu_items;
drop policy if exists menu_items_write      on pos.menu_items;
-- (select …) wrapping keeps has_permission out of the per-row initplan (H4 sweep)
create policy menu_categories_read  on pos.menu_categories for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_categories_write on pos.menu_categories for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));
create policy menu_items_read  on pos.menu_items for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_items_write on pos.menu_items for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));

-- ── 4) Permission: pos.menu (owner + manager) ────────────────────────
insert into core.permissions (key, module, action, label) values
  ('pos.menu', 'pos', 'menu', 'עריכת תפריט — מנות, מחירים וקטגוריות')
on conflict (key) do nothing;
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.key = 'pos.menu'
where r.key in ('owner', 'manager')
on conflict do nothing;

-- ── 5) Retire the literal price mirror → read the menu table ─────────
-- Same contract as before: price for a known item by its Hebrew name, NULL for
-- anything not on the menu (custom lines stay the deliberate no-check escape
-- hatch). Meals validate on their own top-line price; their components are not
-- separate priced lines. `stable` (reads a table) instead of `immutable`.
create or replace function pos.menu_price(p_name text)
returns numeric language sql stable set search_path = pos as $$
  select price from pos.menu_items where name_he = p_name and active limit 1
$$;
revoke all on function pos.menu_price(text) from public, anon, authenticated;

-- ── 6) Seed: the August 2026 menu (owner-confirmed) ──────────────────
insert into pos.menu_categories (id, name_he, name_ar, sort, pos_only) values
  ('salads', 'פתיחים וסלטים',      'مقبلات وسلطات',   10, false),
  ('sea',    'מהים',               'من البحر',        20, false),
  ('mahashi','הממולאים של אסרא',    'محاشي إسراء',     30, false),
  ('taboon', 'מאפים מהטאבון',       'مخبوزات من الطابون', 40, false),
  ('sweets', 'מתוקים',             'حلويات',          50, false),
  ('meals',  'ארוחות',             'وجبات',           60, false),
  ('drinks', 'שתייה חמה',          'مشروبات ساخنة',   80, true)
on conflict (id) do update set
  name_he = excluded.name_he, name_ar = excluded.name_ar,
  sort = excluded.sort, pos_only = excluded.pos_only;

insert into pos.menu_items (id, category_id, name_he, name_ar, price, sort, is_meal, composition) values
  -- פתיחים וסלטים
  ('tahini',   'salads', 'טחינה וחמוצים', 'طحينة ومخللات', 15, 10, false, null),
  ('labneh',   'salads', 'לבנה',          'لبنة',          20, 20, false, null),
  ('cabbage',  'salads', 'סלט כרוב',      'سلطة ملفوف',    27, 30, false, null),
  ('tabbouleh','salads', 'סלט טבולה',     'تبولة',         27, 40, false, null),
  ('salad_veg','salads', 'סלט ירקות',     'سلطة خضار',     32, 50, false, null),
  ('jarjir',   'salads', 'סלט ג׳רג׳יר',   'سلطة جرجير',    32, 60, false, null),
  ('hummus',   'salads', 'החומוס של רמי', 'حمّص رامي',     33, 70, false, null),
  ('chips',    'salads', 'צ׳יפס',         'بطاطس مقلية',   30, 80, false, null),
  -- מהים
  ('fish',     'sea',    'מנת דג',        'وجبة سمك',      80, 10, false, null),
  ('shrimp',   'sea',    'שרימפס',        'جمبري',         65, 20, false, null),
  -- הממולאים של אסרא
  ('vine_leaves',   'mahashi', 'עלי גפן',       'ورق عنب',      30, 10, false, null),
  ('stuffed_cabbage','mahashi','מלפוף',         'ملفوف محشي',   30, 20, false, null),
  ('stuffed_plate', 'mahashi', 'צלחת ממולאים',  'صحن محاشي',    54, 30, false, null),
  -- מאפים מהטאבון
  ('pastry_zaatar',  'taboon', 'מאפה זעתר',        'معجنة زعتر',        20, 10, false, null),
  ('pastry_pizza',   'taboon', 'מאפה פיצה',        'معجنة بيتزا',       28, 20, false, null),
  ('pastry_spinach', 'taboon', 'מאפה תרד וגבינה',  'معجنة سبانخ وجبنة', 32, 30, false, null),
  ('pita',           'taboon', 'פיתה בעבודת יד',   'خبز بيتا يدوي',      8, 40, false, null),
  -- מתוקים
  ('watermelon', 'sweets', 'אבטיח טרי',        'بطيخ طازج', 25, 10, false, null),
  ('cookies',    'sweets', 'עוגיות בעבודת יד', 'كعك بيتي',  15, 20, false, null),
  -- ארוחות (meals) — composition.includes = the FIXED dishes (display / kitchen);
  -- all guest CHOICES live in pos.menu_option_groups (52_pos_menu_options.sql).
  ('meal_breakfast', 'meals', 'ארוחת בוקר של הדוקטור', 'فطور الدكتور', 65, 10, true,
    jsonb_build_object('includes', jsonb_build_array())),
  ('meal_hummus', 'meals', 'ארוחת חומוס', 'وجبة حمّص', 55, 20, true,
    jsonb_build_object('includes', jsonb_build_array(
      jsonb_build_object('name_he','מנת חומוס','name_ar','صحن حمّص'),
      jsonb_build_object('name_he','סלט ירקות','name_ar','سلطة خضار'),
      jsonb_build_object('name_he','טחינה וחמוצים','name_ar','طحينة ومخللات')))),
  ('meal_chef', 'meals', 'ארוחת השף', 'وجبة الشيف', 75, 30, true,
    jsonb_build_object('includes', jsonb_build_array(
      jsonb_build_object('name_he','מיקס ממולאים','name_ar','تشكيلة محاشي'),
      jsonb_build_object('name_he','טחינה וחמוצים','name_ar','طحينة ومخللات')))),
  ('meal_fisherman', 'meals', 'ארוחת הדייג', 'وجبة الصيّاد', 110, 40, true,
    jsonb_build_object('includes', jsonb_build_array(
      jsonb_build_object('name_he','מנת דג','name_ar','وجبة سمك'),
      jsonb_build_object('name_he','צ׳יפס','name_ar','بطاطس مقلية')))),
  -- שתייה חמה (POS-only, carried from the previous menu)
  ('drink_espresso',    'drinks', 'אספרסו / שחור', 'إسبريسو / قهوة سوداء', 5,  10, false, null),
  ('drink_coffee_milk', 'drinks', 'קפה עם חלב',    'قهوة بحليب',           8,  20, false, null),
  ('drink_tea_cup',     'drinks', 'תה בכוס',       'شاي بكوب',             8,  30, false, null),
  ('drink_tea_pot',     'drinks', 'קנקן תה',       'إبريق شاي',            15, 40, false, null)
on conflict (id) do update set
  category_id = excluded.category_id, name_he = excluded.name_he, name_ar = excluded.name_ar,
  price = excluded.price, sort = excluded.sort,
  is_meal = excluded.is_meal, composition = excluded.composition;

-- =====================================================================
-- schema/52_pos_menu_options.sql
-- =====================================================================
-- =====================================================================
--  52_pos_menu_options.sql — per-item option groups (PR 2b)
--
--  Owner feedback (2026-07-29): add-ons are not standalone items — they are
--  OPTIONS on an item, and meals use the same mechanism. An item (or meal)
--  carries option groups of three kinds:
--    choice — pick one (breakfast spread לבנה|טחינה, main שקשוקה|חביתה)
--    count  — a quantity min..max with `included` free units, each extra priced
--             (hummus pita: 1 free, extra +₪5; breakfast pita 0–1 free)
--    add    — optional add(s), each priced (egg +₪5, olives +₪5)
--
--  Meals keep their FIXED dishes in pos.menu_items.composition.includes (display /
--  kitchen), and move all guest CHOICES here. The standalone add-on items are gone
--  (removed from 51's seed). Line price = base + Σ selected option deltas; the
--  close-path validates that server-side (see the pos_close_table change below).
--
--  Plan: docs/plans/pos-menu-kitchen.md.
-- =====================================================================

-- ── 1) Tables ────────────────────────────────────────────────────────
create table if not exists pos.menu_option_groups (
  id         text primary key,
  item_id    text not null references pos.menu_items(id) on delete cascade,
  name_he    text not null,
  name_ar    text not null,
  kind       text not null check (kind in ('choice', 'count', 'add')),
  min_sel    int  not null default 0,     -- choice: 1 = required; add: 0; count: min qty
  max_sel    int  not null default 1,     -- choice: 1; add: N allowed; count: max qty
  included   int  not null default 0,     -- count only: free units before per-unit pricing
  sort       int  not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint menu_option_groups_sel_chk check (max_sel >= min_sel and included >= 0)
);
create index if not exists menu_option_groups_item_idx on pos.menu_option_groups (item_id);

create table if not exists pos.menu_options (
  id          text primary key,
  group_id    text not null references pos.menu_option_groups(id) on delete cascade,
  name_he     text not null,
  name_ar     text not null,
  price_delta numeric not null default 0 check (price_delta >= 0), -- per selection (count: per unit)
  sort        int  not null default 0
);
create index if not exists menu_options_group_idx on pos.menu_options (group_id);

-- ── 2) Audit trigger (reuse the menu actor stamp from 51) ────────────
drop trigger if exists menu_option_groups_touch on pos.menu_option_groups;
create trigger menu_option_groups_touch before insert or update on pos.menu_option_groups
for each row execute function pos.touch_menu_actor();

-- ── 3) RLS: read with pos.view, write with pos.menu (same as the menu) ──
alter table pos.menu_option_groups enable row level security;
alter table pos.menu_options       enable row level security;
revoke all on pos.menu_option_groups, pos.menu_options from anon, authenticated;
grant select, insert, update, delete on pos.menu_option_groups, pos.menu_options to authenticated;

drop policy if exists menu_option_groups_read  on pos.menu_option_groups;
drop policy if exists menu_option_groups_write on pos.menu_option_groups;
drop policy if exists menu_options_read        on pos.menu_options;
drop policy if exists menu_options_write       on pos.menu_options;
create policy menu_option_groups_read  on pos.menu_option_groups for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_option_groups_write on pos.menu_option_groups for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));
create policy menu_options_read  on pos.menu_options for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy menu_options_write on pos.menu_options for all to authenticated
  using ((select core.has_permission('pos.menu'))) with check ((select core.has_permission('pos.menu')));

-- (server-side price validation lives in 53_pos_close_options.sql: pos.option_charge
--  computes an option's effective charge, and the close path validates each line.)

-- ── 4) Seed: item options + meal option groups ───────────────────────
-- egg / olives as options on the items that offer them
insert into pos.menu_option_groups (id, item_id, name_he, name_ar, kind, min_sel, max_sel, included, sort) values
  ('g_hummus_add',  'hummus',         'תוספות', 'إضافات', 'add',   0, 1, 0, 10),
  ('g_hummus_pita', 'hummus',         'פיתה',   'خبز',    'count', 0, 4, 1, 20),  -- like the meal: 1 free, extras +₪5
  ('g_spinach_add', 'pastry_spinach', 'תוספות', 'إضافات', 'add',   0, 1, 0, 10),
  ('g_pizza_add',   'pastry_pizza',   'תוספות', 'إضافات', 'add',   0, 1, 0, 10)
on conflict (id) do update set item_id = excluded.item_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, kind = excluded.kind, min_sel = excluded.min_sel,
  max_sel = excluded.max_sel, included = excluded.included, sort = excluded.sort;
insert into pos.menu_options (id, group_id, name_he, name_ar, price_delta, sort) values
  ('o_hummus_egg',   'g_hummus_add',  'תוספת ביצה',  'إضافة بيضة',  5, 10),
  ('o_hummus_pita',  'g_hummus_pita', 'פיתה',        'خبز',         5, 20),
  ('o_spinach_egg',  'g_spinach_add', 'תוספת ביצה',  'إضافة بيضة',  5, 10),
  ('o_pizza_olives', 'g_pizza_add',   'תוספת זיתים', 'إضافة زيتون', 5, 10)
on conflict (id) do update set group_id = excluded.group_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, price_delta = excluded.price_delta, sort = excluded.sort;

-- meal choices (fixed meal dishes stay in menu_items.composition.includes)
insert into pos.menu_option_groups (id, item_id, name_he, name_ar, kind, min_sel, max_sel, included, sort) values
  -- ארוחת בוקר של הדוקטור
  ('g_bf_main',   'meal_breakfast', 'עיקרית', 'الطبق الرئيسي', 'choice', 1, 1, 0, 10),
  ('g_bf_salad',  'meal_breakfast', 'סלט',    'سلطة',          'choice', 1, 1, 0, 20),
  ('g_bf_spread', 'meal_breakfast', 'ממרח',   'إضافة',         'choice', 1, 1, 0, 30),
  ('g_bf_pita',   'meal_breakfast', 'פיתה',   'خبز',           'count',  0, 4, 1, 40),  -- 1 free, extras +₪5
  -- ארוחת חומוס
  ('g_hm_add',    'meal_hummus',    'תוספות', 'إضافات', 'add',   0, 1, 0, 10),
  ('g_hm_pita',   'meal_hummus',    'פיתה',   'خبز',    'count', 0, 4, 1, 20),
  -- ארוחת השף
  ('g_chef_salad',  'meal_chef', 'סלט',  'سلطة',  'choice', 1, 1, 0, 10),
  ('g_chef_pastry', 'meal_chef', 'מאפה', 'معجنة', 'choice', 1, 1, 0, 20),
  -- ארוחת הדייג
  ('g_fish_salad', 'meal_fisherman', 'סלט', 'سلطة', 'choice', 1, 1, 0, 10)
on conflict (id) do update set item_id = excluded.item_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, kind = excluded.kind, min_sel = excluded.min_sel,
  max_sel = excluded.max_sel, included = excluded.included, sort = excluded.sort;

insert into pos.menu_options (id, group_id, name_he, name_ar, price_delta, sort) values
  ('o_bf_shakshuka', 'g_bf_main',  'שקשוקה',    'شكشوكة',   0, 10),
  ('o_bf_omelet',    'g_bf_main',  'חביתה',     'عجة',      0, 20),
  ('o_bf_omelet_veg','g_bf_main',  'חביתת ירק', 'عجة خضار', 0, 30),
  ('o_bf_salad_cab', 'g_bf_salad', 'סלט כרוב',   'سلطة ملفوف', 0, 10),
  ('o_bf_salad_tab', 'g_bf_salad', 'סלט טבולה',  'تبولة',      0, 20),
  ('o_bf_salad_veg', 'g_bf_salad', 'סלט ירקות',  'سلطة خضار',  0, 30),
  ('o_bf_salad_jar', 'g_bf_salad', 'סלט ג׳רג׳יר','سلطة جرجير', 0, 40),
  ('o_bf_labneh',    'g_bf_spread','לבנה',   'لبنة',           0, 10),
  ('o_bf_tahini',    'g_bf_spread','טחינה',  'طحينة',          0, 20),
  ('o_bf_pita',      'g_bf_pita',  'פיתה',   'خبز',            5, 10),
  ('o_hm_egg',       'g_hm_add',   'תוספת ביצה', 'إضافة بيضة', 5, 10),
  ('o_hm_pita',      'g_hm_pita',  'פיתה',   'خبز',            5, 10),
  ('o_chef_salad_cab', 'g_chef_salad', 'סלט כרוב',   'سلطة ملفوف', 0, 10),
  ('o_chef_salad_tab', 'g_chef_salad', 'סלט טבולה',  'تبولة',      0, 20),
  ('o_chef_salad_veg', 'g_chef_salad', 'סלט ירקות',  'سلطة خضار',  0, 30),
  ('o_chef_salad_jar', 'g_chef_salad', 'סלט ג׳רג׳יר','سلطة جرجير', 0, 40),
  ('o_chef_zaatar',  'g_chef_pastry', 'מאפה זעתר',       'معجنة زعتر',        0, 10),
  ('o_chef_pizza',   'g_chef_pastry', 'מאפה פיצה',       'معجنة بيتزا',       0, 20),
  ('o_chef_spinach', 'g_chef_pastry', 'מאפה תרד וגבינה', 'معجنة سبانخ وجبنة', 0, 30),
  ('o_fish_salad_cab', 'g_fish_salad', 'סלט כרוב',   'سلطة ملفوف', 0, 10),
  ('o_fish_salad_tab', 'g_fish_salad', 'סלט טבולה',  'تبولة',      0, 20),
  ('o_fish_salad_veg', 'g_fish_salad', 'סלט ירקות',  'سلطة خضار',  0, 30),
  ('o_fish_salad_jar', 'g_fish_salad', 'סלט ג׳רג׳יר','سلطة جرجير', 0, 40)
on conflict (id) do update set group_id = excluded.group_id, name_he = excluded.name_he,
  name_ar = excluded.name_ar, price_delta = excluded.price_delta, sort = excluded.sort;

-- =====================================================================
-- schema/53_pos_close_options.sql
-- =====================================================================
-- =====================================================================
--  53_pos_close_options.sql — option-aware price validation on close (PR 2b)
--
--  With per-item options (52), a line's unit_price is base + Σ option deltas, so
--  the close path can no longer validate `unit_price == menu_price(name)`. This
--  file adds:
--    * pos.option_charge(option_id, qty) — the effective charge of one selected
--      option (count kind: only units beyond `included` are charged);
--    * pos.assert_line_prices(p_items) — validates every non-custom line's
--      unit_price against base + its options, rejecting unknown option ids
--      (tampering) and price mismatches;
--  and redefines pos.pos_close_table to call assert_line_prices in place of the
--  old inline base-only check. The rest of the function is byte-identical to
--  47_pos_payments.sql (money path unchanged).
--
--  Plan: docs/plans/pos-menu-kitchen.md.
-- =====================================================================

-- Effective charge of one selected option. NULL if the id is unknown — an
-- unknown option on a line is tampering, which assert_line_prices rejects.
create or replace function pos.option_charge(p_id text, p_qty int)
returns numeric language sql stable set search_path = pos as $$
  select case g.kind
    when 'count' then greatest(0, coalesce(p_qty, 0) - g.included) * o.price_delta
    else o.price_delta   -- choice / add: one delta per selection
  end
  from pos.menu_options o
  join pos.menu_option_groups g on g.id = o.group_id
  where o.id = p_id
$$;
revoke all on function pos.option_charge(text, int) from public, anon, authenticated;

-- Server-side price guard: each non-custom line's unit_price must equal its base
-- menu price plus the charges of its selected options. Custom items and items not
-- on the menu (menu_price NULL) stay the deliberate no-check escape hatch.
create or replace function pos.assert_line_prices(p_items jsonb)
returns void language plpgsql stable set search_path = pos as $$
declare
  it     jsonb;
  v_base numeric;
  v_opts numeric;
begin
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce((it->>'is_custom')::boolean, false) then continue; end if;
    v_base := pos.menu_price(it->>'item_name');
    if v_base is null then continue; end if;
    -- reject any selected option whose id isn't in the menu (tampered price)
    if exists (
      select 1 from jsonb_array_elements(coalesce(it->'options', '[]'::jsonb)) o
      where pos.option_charge(o->>'id', coalesce((o->>'qty')::int, 1)) is null
    ) then
      raise exception 'תוספת לא מוכרת בפריט %', it->>'item_name';
    end if;
    select coalesce(sum(pos.option_charge(o->>'id', coalesce((o->>'qty')::int, 1))), 0)
      into v_opts
    from jsonb_array_elements(coalesce(it->'options', '[]'::jsonb)) o;
    if v_base + v_opts <> coalesce((it->>'unit_price')::numeric, 0) then
      raise exception 'מחיר פריט אינו תואם לתפריט (%)', it->>'item_name';
    end if;
  end loop;
end; $$;
revoke all on function pos.assert_line_prices(jsonb) from public, anon, authenticated;

create or replace function pos.pos_close_table(p_bill jsonb, p_items jsonb, p_payments jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = pos, public as $$
declare
  v_id       text    := p_bill->>'id';
  v_oh       numeric := coalesce((p_bill->>'oh_charge')::numeric, 0);
  v_extras   numeric := coalesce((p_bill->>'extras_total')::numeric, 0);
  v_discount numeric := coalesce((p_bill->>'discount')::numeric, 0);
  v_grand    numeric := coalesce((p_bill->>'grand_total')::numeric, 0);
  v_tip      numeric := coalesce((p_bill->>'tip')::numeric, 0);
  v_kind     text    := nullif(btrim(p_bill->>'discount_kind'), '');
  v_reason   text    := nullif(btrim(p_bill->>'discount_reason'), '');
  v_adults   int     := coalesce((p_bill->>'guests_adults')::int, 0);
  v_children int     := coalesce((p_bill->>'guests_children')::int, 0);
  v_cash     numeric;
  v_card     numeric;
  v_pcount   int;
  v_left     numeric;
  v_computed_extras numeric;
  r          record;
begin
  perform pos.require('pos.order');
  -- this close writes several payment rows + tip_part updates; suppress the
  -- per-row auto re-post (48) so they don't each fire — we re-post once at the
  -- end instead. No-op until 48 is applied.
  perform set_config('levyam.suppress_repost', 'on', true);

  -- every discount is attributed — enforced here, not just in the UI, because
  -- "nothing from the side" is only true if the database refuses the alternative
  if v_discount > 0 then
    if v_kind is null then
      raise exception 'יש לציין את סיבת ההנחה';
    end if;
    if v_kind = 'other' and v_reason is null then
      raise exception 'יש לפרט את סיבת ההנחה';
    end if;
  end if;

  -- server-side price validation: each non-custom line's unit_price must equal
  -- its base menu price plus its selected options' charges (52/53). Custom items
  -- and off-menu items stay the deliberate no-price-check escape hatch.
  perform pos.assert_line_prices(p_items);

  if coalesce(p_bill->>'pricing_mode', 'open_house') = 'open_house'
     and v_oh <> pos.oh_charge(v_adults, v_children) then
    raise exception 'סכום בית פתוח (%) אינו תואם למספר הסועדים', v_oh;
  end if;

  select coalesce(sum(coalesce((it->>'qty')::int, 0) * coalesce((it->>'unit_price')::numeric, 0)), 0)
    into v_computed_extras
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
  where coalesce(p_bill->>'pricing_mode', 'open_house') <> 'open_house'
     or not coalesce((it->>'is_open_house')::boolean, false);

  if v_extras <> v_computed_extras then
    raise exception 'סכום התוספות (%) אינו תואם לפריטים שהוזמנו (%)', v_extras, v_computed_extras;
  end if;

  if v_grand <> v_oh + v_extras - v_discount then
    raise exception 'חשבון לא עקבי: סה״כ (%) שונה מ-בית פתוח (%) + תוספות (%) − הנחה (%)', v_grand, v_oh, v_extras, v_discount;
  end if;

  -- record the closing payment(s) before deriving — one row per array entry
  insert into pos.pos_payments (bill_id, method, amount, note, taken_by)
  select v_id,
         coalesce(pmt->>'method', 'cash'),
         (pmt->>'amount')::numeric,
         nullif(btrim(pmt->>'note'), ''),
         coalesce(auth.jwt()->>'email', 'לא ידוע')
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) pmt
  where coalesce((pmt->>'amount')::numeric, 0) > 0
    and coalesce(pmt->>'method', 'cash') in ('cash', 'card');

  -- allocate the bill's tip across its payments, newest first, so that
  -- (amount - tip_part) is exactly the revenue collected by each payment
  update pos.pos_payments set tip_part = 0 where bill_id = v_id;
  v_left := v_tip;
  for r in select id, amount from pos.pos_payments
            where bill_id = v_id order by taken_at desc, id desc loop
    exit when v_left <= 0;
    update pos.pos_payments set tip_part = least(v_left, r.amount) where id = r.id;
    v_left := v_left - least(v_left, r.amount);
  end loop;

  -- cash/card come from the recorded payments — the client no longer gets to
  -- assert what was collected. BACKWARD COMPAT: a legacy client (pre-split-
  -- payments) records no payments and instead sends cash_paid/card_paid in the
  -- payload; when there are zero recorded payments, trust those so the deployed
  -- POS keeps closing tables until the new client ships.
  select coalesce(sum(amount) filter (where method = 'cash'), 0),
         coalesce(sum(amount) filter (where method = 'card'), 0),
         count(*)
    into v_cash, v_card, v_pcount
  from pos.pos_payments where bill_id = v_id;

  if v_pcount = 0 then
    v_cash := coalesce((p_bill->>'cash_paid')::numeric, 0);
    v_card := coalesce((p_bill->>'card_paid')::numeric, 0);
  end if;

  if v_cash + v_card <> v_grand + v_tip then
    raise exception 'חשבון לא עקבי: תשלומים שנרשמו (%) שונים מסה״כ + טיפ (%)', v_cash + v_card, v_grand + v_tip;
  end if;

  insert into pos.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, discount, discount_kind, discount_reason,
    grand_total, tip, cash_paid, card_paid, items
  ) values (
    v_id,
    (p_bill->>'table_num')::int, p_bill->>'name',
    coalesce(p_bill->>'status','paid'), p_bill->>'closed_by',
    v_adults, v_children,
    coalesce(p_bill->>'pricing_mode','open_house'),
    (p_bill->>'opened_at')::timestamptz,
    coalesce((p_bill->>'paid_at')::timestamptz, now()),
    coalesce((p_bill->>'items_count')::int,0),
    v_oh, v_extras,
    coalesce((p_bill->>'menu_value')::numeric,0),
    v_discount, v_kind, v_reason,
    v_grand, v_tip, v_cash, v_card,
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
    discount=excluded.discount, discount_kind=excluded.discount_kind,
    discount_reason=excluded.discount_reason, tip=excluded.tip,
    grand_total=excluded.grand_total, items=excluded.items;

  delete from pos.pos_bill_items where bill_id = v_id;
  insert into pos.pos_bill_items
    (bill_id, table_num, paid_at, item_name, category, is_open_house, is_custom, unit_price, qty)
  select v_id, (p_bill->>'table_num')::int,
         coalesce((p_bill->>'paid_at')::timestamptz, now()),
         it->>'item_name', it->>'category',
         coalesce((it->>'is_open_house')::boolean,false),
         coalesce((it->>'is_custom')::boolean,false),
         coalesce((it->>'unit_price')::numeric,0),
         coalesce((it->>'qty')::int,0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as it;

  delete from pos.pos_tables where id = v_id;

  -- Re-post every already-booked day this bill touches. Usually that's just
  -- today (a no-op — today isn't booked yet). But a reopened past bill can carry
  -- payments on a past, booked day, and the tip_part reallocation above
  -- (suppressed, so it didn't fire the row trigger) changed their revenue. The
  -- bill's own paid_at day is included too: a legacy/fallback close records NO
  -- payment rows (post_day reads its revenue straight off the bill, 47), and the
  -- pos_bills insert was suppressed with everything else — so without paid_at
  -- here a fallback close onto a booked day would never re-post. repost_if_posted
  -- is defined in 48; the reference resolves at call time. Then lift the suppress.
  for r in
    select distinct d from (
      select (taken_at at time zone 'Asia/Jerusalem')::date as d
      from pos.pos_payments where bill_id = v_id
      union
      select (coalesce((p_bill->>'paid_at')::timestamptz, now()) at time zone 'Asia/Jerusalem')::date
    ) days loop
    perform pos.repost_if_posted(r.d);
  end loop;
  perform set_config('levyam.suppress_repost', '', true);
end; $$;

-- =====================================================================
-- schema/54_finance_categories.sql
-- =====================================================================
-- =====================================================================
--  54_finance_categories.sql — finance categories-as-data (PR A of the
--  finance books-integrity initiative).
--
--  The category taxonomy stops being a hardcoded CHECK constraint declared
--  three times across two files (20_finance.sql inline + re-declared, then
--  21_finance_spine.sql again for the POS categories) and mirrored a fourth
--  time client-side in app-src/src/modules/finance/categories.ts. It becomes
--  owner-editable rows, and this table is the single source of truth for:
--
--    * which categories exist, per kind, and their HE/AR labels;
--    * which of them are DERIVED-ONLY — `owned_by_module` non-null means a
--      module posting function is the one writer and humans are locked out.
--      finance.entries_guard() now reads that column instead of carrying its
--      own array literal.
--
--  It also closes a real hole: finance.expected.category was free text with
--  no constraint at all, so plan and actual could name different categories
--  for the same money. Both tables now carry a composite FK that enforces
--  the category exists AND matches the row's income/expense sense.
--
--  Re-runnable; apply after 53. Plan: docs/plans/finance-books-integrity.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) The table
--     (kind, key) is the natural key — a surrogate id keeps the FKs below
--     composite while still allowing the same slug under both kinds later
--     (an 'other' expense as well as an 'other' income).
-- ---------------------------------------------------------------------
create table if not exists finance.categories (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('income','expense')),
  key             text not null,                       -- stable slug; posting functions reference it
  label_he        text not null,
  label_ar        text not null,
  owned_by_module text references core.modules(key) on update cascade,
  active          boolean not null default true,       -- archived: hidden from pickers, history stays valid
  sort            int not null default 0,
  updated_at      timestamptz not null default now(),
  updated_by      text,
  unique (kind, key)
  -- The label and slug CHECKs are added AFTER the adopt step below, NOT VALID —
  -- see the comment there. Declaring them inline would let a single malformed
  -- legacy row abort the whole migration on a live ledger.
);

-- No extra index: unique (kind, key) already serves the FK checks and the guard
-- lookup, and the only app query is an unfiltered `order by kind, sort` over a
-- table that holds dozens of rows. A partial `where active` index could not
-- serve it anyway.

-- Audit stamp from the JWT, same pattern as pos.menu (51_pos_menu.sql).
create or replace function finance.touch_category_actor()
returns trigger language plpgsql security definer set search_path = finance, public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt()->>'email', 'לא ידוע');
  return new;
end; $$;
revoke all on function finance.touch_category_actor() from public;

drop trigger if exists finance_categories_touch on finance.categories;
create trigger finance_categories_touch before insert or update on finance.categories
for each row execute function finance.touch_category_actor();

-- ---------------------------------------------------------------------
--  2) Seed — every category valid today (so no historical row is orphaned
--     by the FKs below), plus the real-world gaps confirmed by the owner at
--     kickoff: rent, utilities, insurance, taxes, payment fees, event costs
--     and donations. Labels carry over verbatim from the module dictionary
--     (app-src/src/modules/finance/i18n.ts) so nothing renames itself.
--
--     'makrer' keeps its slug (history references it) but gets a clearer label:
--     it reads as מקרר / برّاد — the fridge — i.e. drinks income, which is still
--     live, so it seeds ACTIVE. The slug is deliberately NOT renamed; renaming a
--     key would silently re-file every historical row under it.
--
--     Note the seeds use ON CONFLICT DO NOTHING throughout: re-running this file
--     must never stomp a label the owner has since edited in the admin UI.
-- ---------------------------------------------------------------------
insert into finance.categories (kind, key, label_he, label_ar, owned_by_module, active, sort) values
  -- expenses — operations
  ('expense', 'equipment',     'ציוד',                 'معدات',                    null,     true,  10),
  ('expense', 'inventory',     'מלאי',                 'مخزون',                    null,     true,  20),
  ('expense', 'maintenance',   'תחזוקה',               'صيانة',                    null,     true,  30),
  ('expense', 'suppliers',     'ספקים',                'موردون',                   null,     true,  40),
  ('expense', 'marketing',     'שיווק',                'تسويق',                    null,     true,  50),
  -- expenses — overhead (new)
  ('expense', 'rent',          'שכירות',               'إيجار',                    null,     true,  60),
  ('expense', 'utilities',     'חשמל ומים',            'كهرباء ومياه',             null,     true,  70),
  ('expense', 'insurance',     'ביטוח',                'تأمين',                    null,     true,  80),
  ('expense', 'taxes',         'מסים ומע״מ',           'ضرائب وقيمة مضافة',        null,     true,  90),
  ('expense', 'payment_fees',  'עמלות סליקה ובנק',     'عمولات الدفع والبنك',      null,     true, 100),
  -- expenses — people
  ('expense', 'salaries',      'משכורות',              'رواتب',                    null,     true, 110),
  ('expense', 'or_prati',      'אור פרטי',             'أور خاص',                  null,     true, 120),
  ('expense', 'nimer',         'נימר',                 'نمر',                      null,     true, 130),
  -- expenses — events (new)
  ('expense', 'event_costs',   'עלויות אירועים',       'تكاليف المناسبات',         null,     true, 140),
  -- expenses — module-written
  ('expense', 'pos_food',      'POS — מזון',           'POS — طعام',               'pos',    true, 200),
  ('expense', 'pos_labor',     'POS — שכר יומי',       'POS — أجر يومي',           'pos',    true, 210),
  -- income
  ('income',  'bookings',      'הזמנות',               'حجوزات',                   null,     true,  10),
  ('income',  'donations',     'תרומות ומענקים',       'تبرعات ومنح',              null,     true,  20),
  ('income',  'other',         'אחר',                  'أخرى',                     null,     true,  30),
  ('income',  'makrer',        'מקרר ושתייה',          'برّاد ومشروبات',           null,     true,  40),
  -- income — module-written
  ('income',  'events',        'אירועים',              'مناسبات',                  'quotes', true, 200),
  ('income',  'pos',           'POS — יום מכירות',     'POS — يوم مبيعات',         'pos',    true, 210)
on conflict (kind, key) do nothing;

-- ---------------------------------------------------------------------
--  3) Adopt orphans BEFORE the FKs land.
--     20_finance.sql shipped a placeholder taxonomy first (rent/utilities/
--     insurance/…) and replaced it with a NOT VALID constraint precisely so
--     live rows under retired names would survive. Those rows are still out
--     there. Anything referenced by a real row and not named above is
--     adopted as an INACTIVE category, so the FK resolves and history is
--     preserved — but nobody can file new money under it.
--
--     Idempotent: a second run finds nothing left to adopt.
-- ---------------------------------------------------------------------
--     Labels fall back to a placeholder when the legacy slug is blank:
--     finance.expected.category was unconstrained free text (the very hole this
--     file closes), so '' is possible and must not abort the migration.
insert into finance.categories (kind, key, label_he, label_ar, active, sort)
select s.kind,
       s.category,
       coalesce(nullif(btrim(s.category), ''), '(קטגוריה ללא שם)'),
       coalesce(nullif(btrim(s.category), ''), '(فئة بلا اسم)'),
       false, 900
from (
  select kind, category from finance.entries
  union
  select case direction when 'in' then 'income' else 'expense' end, category
  from finance.expected
) s
where not exists (
  select 1 from finance.categories c where c.kind = s.kind and c.key = s.category);

-- Both invariants land AFTER the adopt step and NOT VALID on purpose: a retired
-- legacy slug in some old prod row must not be able to fail this whole file, but
-- everything created from here on is held to them.
--   * key    — permanent (column grants make it non-updatable) and referenced by
--              posting functions, so its shape is an invariant, not a form hint.
--   * labels — ARCHITECTURE §7.5: anything user-facing exists in BOTH languages.
--              The admin form checks this too; this is the guard that holds.
alter table finance.categories drop constraint if exists finance_categories_key_check;
alter table finance.categories add constraint finance_categories_key_check
  check (key ~ '^[a-z][a-z0-9_]*$') not valid;

alter table finance.categories drop constraint if exists finance_categories_labels_check;
alter table finance.categories add constraint finance_categories_labels_check
  check (btrim(label_he) <> '' and btrim(label_ar) <> '') not valid;

-- ---------------------------------------------------------------------
--  4) One-writer-per-category, read from the table instead of a literal.
--     SECURITY DEFINER so the guard resolves ownership regardless of the
--     writer's read permissions (a finance.manage holder who somehow lacks
--     finance.view must still be blocked from a derived category, not
--     silently waved through because the lookup returned no row).
-- ---------------------------------------------------------------------
-- Both rules a category can impose on a manual write live here, so the taxonomy
-- owns them rather than each writing table re-deriving one of them:
--   * owned_by_module  → a module posting function is the one writer
--   * active = false   → archived; readable history, but no NEW money filed here
-- Existence/kind-correctness is NOT this function's job — the composite FK
-- already rejects those, and duplicating it here would just fail differently.
create or replace function finance.assert_category_writable(p_kind text, p_key text)
returns void language plpgsql stable security definer set search_path = finance, public as $$
declare c record;
begin
  select owned_by_module, active into c
  from finance.categories where kind = p_kind and key = p_key;
  if not found then
    return;                       -- the FK will reject it a moment from now
  end if;
  if c.owned_by_module is not null then
    raise exception 'הקטגוריה "%" נרשמת אוטומטית על ידי מודול (%) — לא ניתן להזין אותה ידנית', p_key, c.owned_by_module;
  end if;
  if not c.active then
    raise exception 'הקטגוריה "%" בארכיון — לא ניתן לרשום אליה תנועות חדשות', p_key;
  end if;
end; $$;
-- revoking from `authenticated` alone leaves the implicit PUBLIC grant in
-- place — the escalation shape this repo has already been bitten by twice.
revoke all on function finance.assert_category_writable(text, text) from public;
grant execute on function finance.assert_category_writable(text, text) to authenticated;

-- Authored here and ONLY here (21_finance_spine.sql's copy was retired with the
-- literal it carried) — the one-writer rule is data now, so a stale second copy
-- would protect the old slugs and silently miss every category added since.
create or replace function finance.entries_guard()
returns trigger language plpgsql as $$
declare
  posting boolean := coalesce(current_setting('levyam.finance_posting', true), '') = 'on';
begin
  if posting then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if new.source_module is not null then
      raise exception 'רישום ממקור מודול (%.%) נכתב רק דרך פונקציית הרישום של אותו מודול', new.source_module, new.source_ref;
    end if;
    perform finance.assert_category_writable(new.kind, new.category);
    return new;
  end if;
  if old.source_module is not null then
    raise exception 'רישום שנוצר על ידי מודול (%) אינו ניתן לעריכה או מחיקה — תיקון נרשם כתנועת היפוך מאותו מודול', old.source_module;
  end if;
  if tg_op = 'UPDATE' and new.source_module is not null then
    raise exception 'לא ניתן להפוך רישום ידני לרישום ממקור מודול';
  end if;
  -- a legacy manual row whose category has since become module-owned or archived
  -- stays editable (fix its amount, its note); it just cannot MOVE into one
  if tg_op = 'UPDATE'
     and (new.category, new.kind) is distinct from (old.category, old.kind) then
    perform finance.assert_category_writable(new.kind, new.category);
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists finance_entries_guard on finance.entries;
create trigger finance_entries_guard
  before insert or update or delete on finance.entries
  for each row execute function finance.entries_guard();

-- ---------------------------------------------------------------------
--  5) Retire the CHECK constraints; the table is the taxonomy now.
--     FKs are composite so they enforce kind-correctness too: an 'income'
--     row cannot claim an expense category. Added NOT VALID — the adopt step
--     above covers everything real, but a NOT VALID add never takes the
--     full-table lock a validating add would on a live prod ledger.
-- ---------------------------------------------------------------------
--     No ON UPDATE CASCADE on either FK: `key` is not client-updatable (see the
--     column grants below), so a slug can only change by deliberate migration —
--     and there it should fail loudly rather than silently re-file history.
--     Postgres also rejects ON UPDATE CASCADE outright on an FK containing a
--     generated column, which finance.expected's does.
--     drop-then-add (not a duplicate_object DO block) so re-running this file
--     converges on the definition here instead of keeping an older one.
alter table finance.entries drop constraint if exists finance_entries_category_check;

alter table finance.entries drop constraint if exists finance_entries_category_fk;
alter table finance.entries add constraint finance_entries_category_fk
  foreign key (kind, category) references finance.categories (kind, key) not valid;

-- finance.expected keys money by direction ('in'/'out'), not kind. A stored
-- generated column maps it, so the same composite FK applies and the category
-- can no longer disagree with the direction. (Verified on PG locally: a
-- generated column is usable as an FK referencing column, and an 'in' row
-- pointing at an expense category is rejected.)
alter table finance.expected add column if not exists kind text
  generated always as (case direction when 'in' then 'income' else 'expense' end) stored;

alter table finance.expected drop constraint if exists finance_expected_category_fk;
alter table finance.expected add constraint finance_expected_category_fk
  foreign key (kind, category) references finance.categories (kind, key) not valid;

-- Deletion protection comes free with the FKs above (NO ACTION): a category
-- with any entry or expectation cannot be deleted — archive it instead.
--
-- Both FKs are checked from the REFERENCING side whenever a category row is
-- deleted, which scans finance.entries / finance.expected. entries had only a
-- 2-value (kind) index and expected's generated `kind` had none, so that check
-- would seq-scan a growing ledger. The entries index also serves finance.report's
-- per-category aggregation.
create index if not exists finance_entries_category_idx  on finance.entries  (kind, category);
create index if not exists finance_expected_category_idx on finance.expected (kind, category);

-- ---------------------------------------------------------------------
--  6) RLS + grants.
--     Anyone who can see finance reads the taxonomy (the entries form needs
--     it); only finance.categories writes. Column-level grants are the real
--     guard on owned_by_module: module ownership is declared by the module
--     in this file, never by the admin UI, and `kind`/`key` are immutable
--     after creation because renaming a slug would silently re-file history.
-- ---------------------------------------------------------------------
alter table finance.categories enable row level security;

revoke all on finance.categories from anon, authenticated;
grant select on finance.categories to authenticated;
grant insert (kind, key, label_he, label_ar, active, sort) on finance.categories to authenticated;
grant update (label_he, label_ar, active, sort)            on finance.categories to authenticated;
grant delete on finance.categories to authenticated;

drop policy if exists "finance_categories_read"  on finance.categories;
drop policy if exists "finance_categories_write" on finance.categories;

-- (select …) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "finance_categories_read" on finance.categories for select to authenticated
  using ((select core.has_permission('finance.view')));
create policy "finance_categories_write" on finance.categories for all to authenticated
  using ((select core.has_permission('finance.categories')))
  with check ((select core.has_permission('finance.categories')));

-- ---------------------------------------------------------------------
--  SEED DATA — permission (idempotent)
--  Owner-only, deliberately tighter than pos.menu (owner+manager): editing
--  the taxonomy reshapes every historical report, not just tomorrow's prices.
-- ---------------------------------------------------------------------
insert into core.permissions (key, module, action, label) values
  ('finance.categories', 'finance', 'categories', 'עריכת קטגוריות הכנסה והוצאה')
on conflict (key) do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r, core.permissions p
where r.key = 'owner' and p.key = 'finance.categories'
on conflict do nothing;

-- =====================================================================
-- schema/55_finance_reconciliation.sql
-- =====================================================================
-- =====================================================================
--  55_finance_reconciliation.sql — "are the books aligned?" (PR B of the
--  finance books-integrity initiative).
--
--  The first write of a POS day to the books is a deliberate manual act
--  (pos.close_day). If nobody presses it, the revenue simply is not in the
--  books and NOTHING says so. That already happened in production: the first
--  week of July 2026 was never posted and was found by hand during the POS
--  parity trial. This file makes that state visible instead of silent.
--
--  Four checks, all computed live (never a stored/dismissible flag — an
--  alert you can dismiss is an alert that lies):
--    1. unposted_day    — a day with real money that was never written
--    2. recompute_drift — a booked day whose recomputation differs from the
--                         books, i.e. the auto re-post (48) failed or was bypassed
--    3. overdue_expected— finance.expected still open past its due_date
--    4. pinned          — (PR C) a day the owner froze. Listed so the freeze
--                         stays visible; 'low' while it costs nothing,
--                         'medium' once money starts piling up outside it.
--
--  Each item carries the action that resolves it, so the UI never has to
--  encode "what do I do about this".
--
--  PERFORMANCE NOTE (measured, /simplify 2026-08-03): the first cut of this
--  file asked the question one day at a time — a per-day function call inside
--  a lateral, plus pos.day_is_posted() in a WHERE that the planner pushed down
--  into the union arms so it ran once per BILL rather than once per day. On 90
--  days of realistic volume that was 3,602 day_is_posted() calls and ~718ms per
--  request, on the hot path of a launcher badge. Everything below is therefore
--  SET-BASED: three grouped passes over the POS sources, one grouped pass over
--  the booked entries, joined. Same answers, ~45ms.
--
--  Re-runnable; apply after 54. Plan: docs/plans/finance-books-integrity.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) The four legs a day WOULD post, computed without writing anything.
--
--     Lifted out of pos.post_day (47) so the two can never disagree: post_day
--     now consumes this, which keeps the leg definitions and the two-source
--     legacy revenue read authored in one place.
--
--     INTERNAL: security definer with NO permission check, revoked from every
--     client role — exactly like pos.post_day itself. It must be callable both
--     by the auto re-post trigger (which runs as whichever staff member edited
--     an expense) and by the reconciliation report (which runs for a finance
--     reader who may hold no POS permissions at all), so gating it on either
--     module's permission would break one of the two callers. The gate lives on
--     the public entry points. Deviation from the plan's standing rule
--     ("invoker, or definer WITH a has_permission check") recorded there.
--
--     Single-day shape, for post_day. The reconciliation report deliberately
--     does NOT call this per day — see the performance note above.
-- ---------------------------------------------------------------------
create or replace function pos.day_expected_legs(p_date date)
returns table (leg text, kind text, category text, amount numeric)
language plpgsql stable security definer set search_path = pos, finance, core as $$
declare
  v_cash numeric; v_card numeric; v_food numeric; v_labor numeric;
begin
  -- Revenue for the day, net of tips, from BOTH payment sources:
  --   * new bills record pos_payments rows — sum (amount − tip_part) by method,
  --     attributed to the day the payment was TAKEN (a deposit counts when taken).
  --   * LEGACY bills (closed before split-payments shipped) have NO payment rows;
  --     their money lives only on the bill. Fall back to the pre-PR-C grammar:
  --     card = least(card_paid, grand_total), cash = the rest of grand_total —
  --     which nets tips out at the grand-total level and reproduces the numbers
  --     those days were originally posted with. Without this second source,
  --     re-posting any historical day recomputes its revenue as ~0 and the
  --     auto re-post (48) wipes it from the books on the next expense edit.
  select coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'cash'), 0),
         coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'card'), 0)
    into v_cash, v_card
  from pos.pos_payments p
  where (p.taken_at at time zone 'Asia/Jerusalem')::date = p_date;

  select v_cash + coalesce(sum(b.grand_total - least(b.card_paid, b.grand_total)), 0),
         v_card + coalesce(sum(least(b.card_paid, b.grand_total)), 0)
    into v_cash, v_card
  from pos.pos_bills b
  where b.status = 'paid'
    and (b.paid_at at time zone 'Asia/Jerusalem')::date = p_date
    and not exists (select 1 from pos.pos_payments p where p.bill_id = b.id);

  select coalesce(sum(e.amount) filter (where e.kind = 'food'), 0),
         coalesce(sum(e.amount) filter (where e.kind = 'labor'), 0)
    into v_food, v_labor
  from pos.pos_expenses e where e.business_date = p_date;

  return query select * from (values
    ('cash',  'income',  'pos',       v_cash),
    ('card',  'income',  'pos',       v_card),
    ('food',  'expense', 'pos_food',  v_food),
    ('labor', 'expense', 'pos_labor', v_labor)
  ) as t(leg, kind, category, amount);
end; $$;

revoke all on function pos.day_expected_legs(date) from public;

-- The READER half of the source_ref grammar whose writer half is
-- pos.day_ref_prefix() (48): 'pos:<date>:<leg>[:r<n>]' — segment 3 is the leg.
-- Declared next to its counterpart's contract so the format has exactly two
-- named sites instead of a literal re-spelled at every comparison.
create or replace function pos.day_ref_leg(p_ref text)
returns text language sql immutable as $$ select split_part(p_ref, ':', 3); $$;
-- Pure string function over the caller's own argument, so a PUBLIC grant leaks
-- nothing — revoked anyway to match its writer half (day_ref_prefix, 48) and the
-- standing rule for this initiative. Every exception to that rule is one more
-- judgement call at the next review; the repo has shipped this bug twice.
revoke all on function pos.day_ref_leg(text) from public;

-- ---------------------------------------------------------------------
--  2) post_day now consumes the extracted computation instead of carrying
--     its own copy. Behaviour is unchanged — same legs, same order, same
--     source_ref grammar — which matters because pos.day_is_posted() and the
--     auto re-post both match against that grammar and would stop matching
--     history if it drifted by a single character.
--
--     Authored HERE and only here: 47_pos_payments.sql used to carry a copy,
--     which a re-run of that file would restore — silently reinstating a
--     post_day with no pinned-day refusal.
-- ---------------------------------------------------------------------
create or replace function pos.post_day(p_date date)
returns jsonb language plpgsql security definer
set search_path = pos, finance, core as $$
declare
  leg record;
  posted jsonb := '[]'::jsonb;
  amounts jsonb := '{}'::jsonb;   -- the cash/card/food/labor summary the close-day screen reads
  v_current numeric; v_n int; v_delta numeric; v_ref text; v_entry uuid;
begin
  -- A pinned day holds an owner correction (PR C). Refusing here rather than in
  -- pos.close_day() means every caller — the manual close, the reconciliation
  -- tab's fix button, anything added later — inherits the protection by
  -- default. The trigger path never reaches this: pos.repost_if_posted() (48)
  -- checks the pin first and skips silently, because it runs inside someone
  -- else's expense edit and must not abort it.
  if pos.day_is_pinned(p_date) then
    raise exception 'היום % נעול לאחר תיקון של הבעלים — יש לבטל את הנעילה לפני רישום מחדש', to_char(p_date, 'DD.MM.YYYY');
  end if;

  perform set_config('levyam.finance_posting', 'on', true);
  for leg in select * from pos.day_expected_legs(p_date)
  loop
    -- built from the legs themselves, so a fifth leg would appear automatically
    amounts := amounts || jsonb_build_object(leg.leg, leg.amount);

    v_ref := pos.day_ref_prefix(p_date) || leg.leg;
    select coalesce(sum(amount), 0), count(*) into v_current, v_n
    from finance.entries
    where source_module = 'pos'
      and (source_ref = v_ref or source_ref like v_ref || ':r%');

    v_delta := leg.amount - v_current;
    if v_delta = 0 then continue; end if;

    insert into finance.entries
      (kind, category, amount, payment_method, entry_date, note, source_module, source_ref)
    values (
      leg.kind, leg.category, v_delta,
      case leg.leg when 'cash' then 'cash' when 'card' then 'grow' else null end,
      p_date,
      case when v_n = 0 then 'סגירת יום ' || to_char(p_date, 'DD.MM')
           else 'תיקון סגירת יום ' || to_char(p_date, 'DD.MM') end,
      'pos',
      case when v_n = 0 then v_ref else v_ref || ':r' || (v_n + 1) end
    )
    returning id into v_entry;

    posted = posted || jsonb_build_object(
      'leg', leg.leg, 'amount', v_delta, 'entry_id', v_entry,
      'correction', v_n > 0);
  end loop;
  perform set_config('levyam.finance_posting', '', true);

  return jsonb_build_object('date', p_date, 'posted', posted) || amounts;
end; $$;

-- post_day is internal: no role may call it directly. The revoke lives with the
-- definition, which is this file — 47's grants block notes why it moved.
revoke all on function pos.post_day(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  3) The drift items, as ROWS.
--
--     Internal (no permission check, revoked from clients) so the two public
--     entry points below can share it: reconciliation() aggregates it to
--     jsonb, reconciliation_count() counts it without ever building a payload.
--     That is what makes the badge query genuinely cheap rather than "the full
--     report with its result thrown away".
-- ---------------------------------------------------------------------
--     `severity` is a real output column, not something the count has to dig
--     back out of the jsonb: pinned days are listed but must NOT light the
--     badge (a pin is a deliberate state, not a problem, and a badge that
--     never clears is one nobody reads). reconciliation_count() filters on it.
-- ---------------------------------------------------------------------
create or replace function finance.reconciliation_items(p_since date)
returns table (sort_key text, severity text, item jsonb)
language sql stable security definer set search_path = finance, pos, core as $$
  with
  -- sargable bounds: compare the raw timestamp against Jerusalem midnight so
  -- the existing timestamptz indexes are usable (an `(x at time zone …)::date`
  -- predicate is an expression over the column and can never be)
  bounds as (select (p_since::timestamp at time zone 'Asia/Jerusalem') as from_ts),
  pay as (
    select (p.taken_at at time zone 'Asia/Jerusalem')::date as d,
           coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'cash'), 0) as cash,
           coalesce(sum(p.amount - p.tip_part) filter (where p.method = 'card'), 0) as card
    from pos.pos_payments p, bounds where p.taken_at >= bounds.from_ts group by 1
  ),
  legacy as (
    select (b.paid_at at time zone 'Asia/Jerusalem')::date as d,
           coalesce(sum(b.grand_total - least(b.card_paid, b.grand_total)), 0) as cash,
           coalesce(sum(least(b.card_paid, b.grand_total)), 0) as card
    from pos.pos_bills b, bounds
    where b.status = 'paid' and b.paid_at >= bounds.from_ts
      and not exists (select 1 from pos.pos_payments p where p.bill_id = b.id)
    group by 1
  ),
  spend as (
    select e.business_date as d,
           coalesce(sum(e.amount) filter (where e.kind = 'food'), 0) as food,
           coalesce(sum(e.amount) filter (where e.kind = 'labor'), 0) as labor
    from pos.pos_expenses e where e.business_date >= p_since group by 1
  ),
  -- what the books already hold per day and leg, in one pass (no per-day
  -- correlated subquery, no LIKE on source_ref — the day comes from entry_date)
  booked as (
    select entry_date as d, pos.day_ref_leg(source_ref) as leg, sum(amount) as amt
    from finance.entries
    where source_module = 'pos' and entry_date >= p_since
      -- ONLY day-close postings. source_module='pos' is not sufficient: a
      -- finance.expected row carrying source_module='pos' would be fulfilled by
      -- record_payment() as 'expected:<uuid>', which parses to an empty leg,
      -- adds its date to posted_days, and turns a genuinely unposted day into a
      -- bogus four-leg drift item. Unreachable today (only quotes writes
      -- expectations) — pinned here so it stays that way.
      and source_ref like pos.day_ref_prefix(entry_date) || '%'
    group by 1, 2
  ),
  all_days as (
    select d from pay union select d from legacy
    union select d from spend union select d from booked
  ),
  expected as (
    select a.d,
           coalesce(pay.cash, 0) + coalesce(legacy.cash, 0) as cash,
           coalesce(pay.card, 0) + coalesce(legacy.card, 0) as card,
           coalesce(spend.food, 0)  as food,
           coalesce(spend.labor, 0) as labor
    from all_days a
    left join pay    on pay.d = a.d
    left join legacy on legacy.d = a.d
    left join spend  on spend.d = a.d
  ),
  posted_days as (select distinct d from booked),
  -- Per-leg comparison for EVERY day in the window, booked or not. It is
  -- deliberately not restricted to booked days: check 4 needs the deltas of a
  -- day that is pinned but was never posted, where `booked` holds nothing and
  -- the delta is therefore the day's entire takings. Check 2 applies the
  -- "booked" restriction itself.
  leg_delta as (
    select e.d, l.leg,
           (case l.leg when 'cash' then e.cash when 'card' then e.card
                       when 'food' then e.food else e.labor end)
           - coalesce(b.amt, 0) as delta
    from expected e
    cross join (values ('cash'), ('card'), ('food'), ('labor')) as l(leg)
    left join booked b on b.d = e.d and b.leg = l.leg
  ),
  -- rolled up per day: read by check 2 (unpinned ⇒ drift) and by check 4
  -- (pinned ⇒ how far the owner's correction currently holds the day apart)
  day_drift as (
    select ld.d,
           jsonb_agg(jsonb_build_object('leg', ld.leg, 'delta', ld.delta))
             filter (where ld.delta <> 0) as legs,
           coalesce(sum(ld.delta), 0) as total
    from leg_delta ld group by ld.d
  )
  -- 1) days with real money that were never written to the books
  select 'a:' || e.d, 'high', jsonb_build_object(
           'type', 'unposted_day', 'severity', 'high', 'business_date', e.d,
           'cash', e.cash, 'card', e.card, 'food', e.food, 'labor', e.labor,
           'revenue', e.cash + e.card, 'fix', 'post_day')
  from expected e
  where not exists (select 1 from posted_days pd where pd.d = e.d)
    -- a day whose money all nets to zero is not "unposted", it is empty
    and (e.cash + e.card + e.food + e.labor) <> 0
    -- ...and a PINNED day is not "unposted" either, it is frozen. Reporting it
    -- here would offer a "post to books" button that pos.post_day() refuses by
    -- design: the fix could never succeed, the item could never clear, and both
    -- launcher badges would stay lit forever. Check 4 reports it instead.
    and not exists (select 1 from pos.day_pins p where p.business_date = e.d)

  union all
  -- 2) a BOOKED day that no longer matches its recomputation. Should always be
  --    empty: the auto re-post (48) writes the correcting delta on every change.
  --    A non-zero here means that trigger failed or was bypassed.
  --    PINNED days are excluded and reported by branch 4 instead: on a pinned
  --    day the books are SUPPOSED to differ from the recomputation — that is
  --    what the owner's correction did — so listing it here would offer a "post
  --    to books" button that un-does the very correction the pin protects.
  select 'b:' || d.d, 'high', jsonb_build_object(
           'type', 'recompute_drift', 'severity', 'high', 'business_date', d.d,
           'legs', d.legs, 'total_delta', d.total, 'fix', 'post_day')
  from day_drift d
  -- non-null iff at least one leg drifted; `total <> 0` would MISS a day whose
  -- legs cancel out (+100 cash / −100 card), which is exactly a real drift
  where d.legs is not null
    -- BOOKED days only — leg_delta now spans every day, so an unposted day would
    -- otherwise surface here as well as in check 1
    and exists (select 1 from posted_days pd where pd.d = d.d)
    and not exists (select 1 from pos.day_pins p where p.business_date = d.d)

  union all
  -- 3) money that should have moved and did not
  select 'c:' || to_char(x.due_date, 'YYYY-MM-DD') || ':' || x.id,
         case when x.due_date < current_date - 30 then 'high' else 'medium' end,
         jsonb_build_object(
           'type', 'overdue_expected',
           'severity', case when x.due_date < current_date - 30 then 'high' else 'medium' end,
           'expected_id', x.id, 'direction', x.direction, 'category', x.category,
           'amount', x.amount, 'due_date', x.due_date, 'reason', x.reason,
           'days_overdue', current_date - x.due_date, 'fix', 'record_payment')
  from finance.expected x
  where x.status = 'open' and x.due_date is not null and x.due_date < current_date

  union all
  -- 4) every pinned day, always (PR C). A pin freezes the WHOLE day: POS has
  --    stopped writing it to the books entirely, so anything entered on that
  --    day afterwards — a food cost, a late payment — never lands. Listed even
  --    when nothing has accumulated yet, because the freeze itself is the live
  --    invisible state and a day pinned months ago must not quietly become
  --    permanent.
  --
  --    Severity is therefore NOT constant. 'low' while the books still match
  --    the recomputation (the pin is costing nothing, so it must not light a
  --    badge that then never clears); 'medium' the moment real money starts
  --    piling up outside the books, which is a genuine problem again. A day
  --    pinned before it was ever posted lands here too, and its delta is the
  --    day's whole takings — hence leg_delta spanning unbooked days as well.
  --
  --    Deliberately NOT bounded by p_since — same reasoning as open
  --    expectations. There are a handful of pins ever, and one made last year
  --    is exactly the one worth remembering. `legs` is therefore best-effort:
  --    non-null only for pins inside the scanned window, null outside it.
  select 'd:' || p.business_date,
         case when d.legs is null then 'low' else 'medium' end,
         jsonb_build_object(
           'type', 'pinned',
           'severity', case when d.legs is null then 'low' else 'medium' end,
           'business_date', p.business_date,
           'reason', p.reason, 'pinned_at', p.pinned_at,
           'legs', d.legs, 'total_delta', coalesce(d.total, 0), 'fix', 'unpin')
  from pos.day_pins p
  left join day_drift d on d.d = p.business_date;
$$;

revoke all on function finance.reconciliation_items(date) from public;

-- ---------------------------------------------------------------------
--  4) The two public entry points.
--
--     SECURITY DEFINER with an explicit finance.view check — a deliberate
--     departure from finance.report()/event_pnl(), which are invoker-rights.
--     Those read only finance.entries, which every finance.view holder can
--     already see. These must read pos.pos_payments / pos_bills / pos_expenses
--     to know whether a day's money exists at all, and under invoker rights a
--     finance reader without POS permissions would see zero POS rows and be
--     told the books are perfectly aligned — the single worst answer this
--     function could give. So they read with definer rights and gate explicitly
--     on the permission that should govern them.
--
--     p_since bounds the POS scan (the ledger only grows); open expectations
--     are never bounded — an overdue deposit from last year is still overdue.
-- ---------------------------------------------------------------------
create or replace function finance.reconciliation(p_since date default null)
returns jsonb language plpgsql stable security definer
set search_path = finance, pos, core as $$
declare
  v_since date := coalesce(p_since, current_date - 90);
  v_items jsonb;
  v_count int;
begin
  if not core.has_permission('finance.view') then
    raise exception 'permission denied';
  end if;
  -- `count` is the ACTIONABLE count (what the badges show), not items length:
  -- pinned days are listed but are not a problem to be fixed. The UI decides
  -- "all clear" from items being empty, never from count.
  select coalesce(jsonb_agg(item order by sort_key), '[]'::jsonb),
         count(*) filter (where severity <> 'low')
    into v_items, v_count from finance.reconciliation_items(v_since);
  return jsonb_build_object(
    'since', v_since, 'generated_at', now(),
    'count', v_count, 'items', v_items);
end; $$;

-- Genuinely count-only: shares the item query but never builds the payload.
-- Counts what needs ACTION — pinned days (severity 'low') are excluded, or the
-- launcher badge would sit permanently lit on a state the owner chose.
create or replace function finance.reconciliation_count(p_since date default null)
returns int language plpgsql stable security definer
set search_path = finance, pos, core as $$
declare n int;
begin
  if not core.has_permission('finance.view') then
    raise exception 'permission denied';
  end if;
  select count(*) into n
  from finance.reconciliation_items(coalesce(p_since, current_date - 90))
  where severity <> 'low';
  return n;
end; $$;

-- revoking from `authenticated` alone leaves the implicit PUBLIC grant in place
revoke all on function finance.reconciliation(date) from public;
revoke all on function finance.reconciliation_count(date) from public;
grant execute on function finance.reconciliation(date) to authenticated;
grant execute on function finance.reconciliation_count(date) to authenticated;

-- =====================================================================
-- schema/56_finance_override.sql
-- =====================================================================
-- =====================================================================
--  56_finance_override.sql — the owner's last word (PR C of the finance
--  books-integrity initiative).
--
--  Or's brief: "ability to override everything by the owner". Today the
--  opposite is true — finance.entries_guard() blocks every client edit and
--  delete of a row carrying provenance, for everyone including the owner, and
--  that guard is a deliberate architecture invariant (ARCHITECTURE.md §7.4).
--  When reality and a module disagree (a cash count that will not match, a POS
--  day that cannot be recomputed correctly), there is currently no way out.
--
--  This file gives the owner the last word WITHOUT weakening the invariant:
--  the correction is ADDITIVE. The original posting is never touched, never
--  hidden, and stays exactly as the module wrote it; a second row carrying
--  source_module = 'override' moves the total to whatever the owner says. Both
--  rows are visible in the ledger, so the books explain themselves.
--
--  The delta is computed HERE, from what the books actually hold, never sent
--  by the client — same stance as pos.post_day(). The owner states the correct
--  TOTAL; the server works out what to add.
--
--  Pinning is SEPARATE and deliberate (pos.day_pins, 48). The plan expected a
--  correction to imply a pin; testing showed it must not — an additive
--  correction is already immune to the auto re-post, while a pin freezes the
--  whole day and would swallow every cost entered afterwards. See §4 below.
--
--  Re-runnable; apply after 55. Plan: docs/plans/finance-books-integrity.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) The override source_ref grammar: 'override:<target>:c<n>'
--
--     <target> is what is being corrected, and is itself one of:
--       'pos:<date>:<leg>'  — a POS day leg (the SAME string pos.post_day
--                             writes, so the two agree by construction)
--       'entry:<uuid>'      — any other single entry
--
--     <n> makes repeat corrections distinct, which the posting unique index
--     on (source_module, source_ref, kind, category) requires — the same
--     device post_day uses for its ':r<n>' corrections.
--
--     The reader below is the counterpart to that format, declared next to
--     it: correcting a correction must resolve back to the ORIGINAL target,
--     never nest. <target> contains colons of its own, so this strips the
--     wrapper rather than splitting on ':'.
-- ---------------------------------------------------------------------
create or replace function finance.override_ref_target(p_ref text)
returns text language sql immutable as $$
  select regexp_replace(regexp_replace(p_ref, '^override:', ''), ':c[0-9]+$', '');
$$;
-- Pure string function over the caller's own argument — revoked to match the
-- standing rule for this initiative rather than because it leaks anything.
revoke all on function finance.override_ref_target(text) from public;

-- ---------------------------------------------------------------------
--  2) What does correcting THIS entry actually mean?
--
--     Resolves the row the owner clicked to its correction target, and to the
--     total the books currently hold for that target — which is emphatically
--     not "the amount on that row":
--
--       * a POS leg is the sum of its original posting, every ':r<n>'
--         auto-correction the re-post has written since, and every override
--         already applied to it. Correcting only the one row the owner
--         happened to click would be undone by the next re-post.
--       * a correction row resolves to whatever IT corrects, so a second
--         override adjusts the same target instead of stacking a new one.
--
--     INTERNAL: security definer, no permission check, revoked from every
--     client — the two callers below gate themselves. It reads the whole
--     ledger to total a target, so it must never be client-callable.
-- ---------------------------------------------------------------------
create or replace function finance.correction_target(p_entry uuid)
returns table (target text, kind text, category text, entry_date date,
               event_id uuid, current_total numeric, pos_date date)
language plpgsql stable security definer set search_path = finance, pos, core as $$
declare
  e        finance.entries%rowtype;
  anchor   finance.entries%rowtype;
  v_target text;
  v_pos    date;
begin
  select * into e from finance.entries where id = p_entry;
  if not found then
    raise exception 'לא נמצאה תנועה לתיקון';
  end if;

  if e.source_module = 'override' then
    v_target := finance.override_ref_target(e.source_ref);
  elsif e.source_module = 'pos'
        and e.source_ref like pos.day_ref_prefix(e.entry_date) || '%' then
    v_target := pos.day_ref_prefix(e.entry_date) || pos.day_ref_leg(e.source_ref);
  else
    v_target := 'entry:' || e.id;
  end if;

  -- The anchor supplies kind/category/date/event: a correction must land in the
  -- same bucket and the same reporting period as the number it corrects, or the
  -- original month stays wrong and only the lifetime total comes out right.
  if v_target like 'entry:%' then
    select * into anchor from finance.entries
    where id = substring(v_target from 7)::uuid;
  else
    v_pos := split_part(v_target, ':', 2)::date;
    select * into anchor from finance.entries
    where source_module = 'pos' and source_ref = v_target;
  end if;
  if not found then
    raise exception 'לא נמצאה התנועה המקורית (%) לתיקון', v_target;
  end if;

  return query
  select v_target, anchor.kind, anchor.category, anchor.entry_date, anchor.event_id,
         coalesce((
           select sum(x.amount) from finance.entries x
           where -- the target's own postings: one row for an entry target, the
                 -- whole leg incl. ':r<n>' re-post corrections for a POS target
                 (v_target like 'entry:%' and x.id = anchor.id)
              or (v_target not like 'entry:%' and x.source_module = 'pos'
                  and (x.source_ref = v_target or x.source_ref like v_target || ':r%'))
              -- plus every override already applied to it
              or (x.source_module = 'override'
                  and x.source_ref like 'override:' || v_target || ':c%')
         ), 0),
         v_pos;
end; $$;

revoke all on function finance.correction_target(uuid) from public;

-- ---------------------------------------------------------------------
--  3) Preview — what the correction form needs before the owner types.
--     The client must not compute the current total itself: for a POS leg it
--     is spread over rows the ledger page has not necessarily loaded.
-- ---------------------------------------------------------------------
create or replace function finance.correction_preview(p_entry uuid)
returns jsonb language plpgsql stable security definer
set search_path = finance, pos, core as $$
declare t record;
begin
  if not core.has_permission('finance.override') then
    raise exception 'permission denied';
  end if;
  select * into t from finance.correction_target(p_entry);
  return jsonb_build_object(
    'target', t.target, 'kind', t.kind, 'category', t.category,
    'entry_date', t.entry_date, 'current_total', t.current_total,
    -- so the form can warn that saving will also freeze the day
    'pos_date', t.pos_date,
    'pos_pinned', t.pos_date is not null and pos.day_is_pinned(t.pos_date));
end; $$;

-- ---------------------------------------------------------------------
--  4) Post the correction.
--
--     SECURITY DEFINER by necessity: it writes a row carrying provenance, so
--     it must set the posting GUC that finance.entries_guard() checks. It
--     therefore gates on finance.override on entry, and the PUBLIC execute
--     grant is revoked explicitly below — revoking from `authenticated` alone
--     leaves PUBLIC in place, the escalation shape this repo has shipped twice.
-- ---------------------------------------------------------------------
create or replace function finance.post_correction(
  p_entry  uuid,
  p_amount numeric,        -- the CORRECT TOTAL for the target, not a delta
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = finance, pos, core as $$
declare
  t        record;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_delta  numeric;
  v_n      int;
  v_ref    text;
  v_entry  uuid;
begin
  if not core.has_permission('finance.override') then
    raise exception 'permission denied';
  end if;
  -- An override with no stated reason is an unauditable number. The whole
  -- justification for allowing it at all is that it stays explainable.
  if v_reason = '' then
    raise exception 'תיקון חייב לכלול סיבה';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'סכום התיקון חייב להיות אפס או יותר';
  end if;

  select * into t from finance.correction_target(p_entry);

  v_delta := p_amount - t.current_total;
  if v_delta = 0 then
    raise exception 'הסכום כבר %, אין מה לתקן', t.current_total;
  end if;

  select count(*) into v_n from finance.entries
  where source_module = 'override'
    and source_ref like 'override:' || t.target || ':c%';
  v_ref := 'override:' || t.target || ':c' || (v_n + 1);

  perform set_config('levyam.finance_posting', 'on', true);
  insert into finance.entries
    (kind, category, amount, payment_method, entry_date, note, source_module, source_ref, event_id)
  values (
    t.kind, t.category, v_delta,
    null,                 -- a correction moves the books, not a drawer
    t.entry_date,         -- same period as the number it corrects
    'תיקון בעלים: ' || v_reason,
    'override', v_ref, t.event_id
  )
  returning id into v_entry;
  perform set_config('levyam.finance_posting', '', true);

  -- NO automatic pin. The plan specified one here, on the premise that the
  -- auto re-post would otherwise overwrite the correction — that premise is
  -- false for an ADDITIVE correction, and the difference was measured, not
  -- assumed (see the deviation note in the plan's §3):
  --
  --   pos.post_day() computes a leg's current value from `source_module = 'pos'`
  --   rows only. An override row is invisible to it, so re-posting writes the
  --   pos-side delta and leaves the correction standing. A day corrected to 150,
  --   then given another ₪100 of takings, re-posts to 300 pos + (−50) = 250 —
  --   which is the right answer: the correction records a known discrepancy,
  --   not a permanent ceiling.
  --
  -- Auto-pinning would have been strictly harmful: a pin freezes the WHOLE day,
  -- so every food cost, labour cost and late payment entered afterwards would
  -- silently never reach the books. Pinning stays an explicit owner action for
  -- when freezing is the actual intent (a closed period, a disputed day).

  return jsonb_build_object(
    'entry_id', v_entry, 'target', t.target,
    'previous_total', t.current_total, 'new_total', p_amount, 'delta', v_delta,
    'pos_date', t.pos_date);
end; $$;

revoke all on function finance.correction_preview(uuid)            from public;
revoke all on function finance.post_correction(uuid, numeric, text) from public;
grant execute on function finance.correction_preview(uuid)            to authenticated;
grant execute on function finance.post_correction(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
--  SEED DATA — permission (idempotent)
--  Owner-only. This is the one key that can move a module-posted number, and
--  the pin it implies stops POS from ever recomputing that day again.
-- ---------------------------------------------------------------------
insert into core.permissions (key, module, action, label) values
  ('finance.override', 'finance', 'override', 'תיקון בעלים ונעילת ימים')
on conflict (key) do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r, core.permissions p
where r.key = 'owner' and p.key = 'finance.override'
on conflict do nothing;

-- End bootstrap window (added by build-baseline.mjs):
reset levyam.bootstrap;
