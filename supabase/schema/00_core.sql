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
-- delete/deactivate initiative) changed the return type, which
-- `create or replace` refuses; the blanket grant below re-covers it on re-run.
drop function if exists core.admin_list_users();
create function core.admin_list_users()
returns table (user_id uuid, email text, created_at timestamptz,
               last_sign_in_at timestamptz, banned_until timestamptz, roles text[])
language sql stable security definer
set search_path = core, public, auth
as $$
  select u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
         coalesce(array_agg(r.key order by r.sort) filter (where r.key is not null), '{}')
  from auth.users u
  left join core.user_roles ur on ur.user_id = u.id
  left join core.roles r       on r.id = ur.role_id
  where core.has_permission('users.manage') or core.has_permission('users.view')
  group by u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until
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
