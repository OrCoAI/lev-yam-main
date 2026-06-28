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
  id    uuid primary key default gen_random_uuid(),
  key   text not null unique,          -- 'owner', 'manager', ...
  label text not null,
  sort  int  not null default 100
);

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
create or replace function core.has_permission(perm_key text)
returns boolean
language sql stable security definer
set search_path = core, public
as $$
  select exists (
    select 1
    from core.user_roles ur
    join core.role_permissions rp on rp.role_id = ur.role_id
    join core.permissions p       on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and p.key = perm_key
  );
$$;

-- All permission keys the current user holds (UI loads this once, then gates locally).
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

-- Admin: list all auth users with their assigned role keys.
-- auth.users is not client-queryable, so this SECURITY DEFINER fn exposes a safe slice,
-- gated by 'users.manage' (non-admins receive an empty set).
create or replace function core.admin_list_users()
returns table (user_id uuid, email text, created_at timestamptz, roles text[])
language sql stable security definer
set search_path = core, public, auth
as $$
  select u.id, u.email, u.created_at,
         coalesce(array_agg(r.key order by r.sort) filter (where r.key is not null), '{}')
  from auth.users u
  left join core.user_roles ur on ur.user_id = u.id
  left join core.roles r       on r.id = ur.role_id
  where core.has_permission('users.manage')
  group by u.id, u.email, u.created_at
  order by u.created_at;
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

-- catalog: read for all authenticated
create policy core_roles_read       on core.roles            for select to authenticated using (true);
create policy core_modules_read     on core.modules          for select to authenticated using (true);
create policy core_perms_read       on core.permissions      for select to authenticated using (true);
create policy core_role_perms_read  on core.role_permissions for select to authenticated using (true);

-- catalog: write only for users.manage
create policy core_roles_write      on core.roles            for all to authenticated
  using (core.has_permission('users.manage')) with check (core.has_permission('users.manage'));
create policy core_modules_write    on core.modules          for all to authenticated
  using (core.has_permission('users.manage')) with check (core.has_permission('users.manage'));
create policy core_perms_write      on core.permissions      for all to authenticated
  using (core.has_permission('users.manage')) with check (core.has_permission('users.manage'));
create policy core_role_perms_write on core.role_permissions for all to authenticated
  using (core.has_permission('users.manage')) with check (core.has_permission('users.manage'));

-- user_roles: read own OR if you manage users
create policy core_user_roles_read  on core.user_roles for select to authenticated
  using (user_id = auth.uid() or core.has_permission('users.manage'));
-- user_roles: only users.manage may assign/revoke
create policy core_user_roles_write on core.user_roles for all to authenticated
  using (core.has_permission('users.manage')) with check (core.has_permission('users.manage'));

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

-- =====================================================================
--  SEED DATA  (idempotent — safe to re-run)
-- =====================================================================
insert into core.roles (key, label, sort) values
  ('owner',   'Owner',   10),
  ('manager', 'Manager', 20),
  ('staff',   'Staff',   30),
  ('viewer',  'Viewer',  40)
on conflict (key) do nothing;

insert into core.modules (key, label, icon, sort) values
  ('users', 'Users & Permissions', '🔐', 10),
  ('pos',   'POS / Billing',        '🧾', 20)
on conflict (key) do nothing;

insert into core.permissions (key, module, action, label) values
  ('users.view',        'users', 'view',        'View users & roles'),
  ('users.manage',      'users', 'manage',      'Manage users, roles & permissions'),
  ('pos.view',          'pos',   'view',         'Open POS'),
  ('pos.create_bill',   'pos',   'create_bill',  'Create / edit bills'),
  ('pos.refund',        'pos',   'refund',       'Refund / reopen bills'),
  ('pos.reports',       'pos',   'reports',      'View POS reports')
on conflict (key) do nothing;

-- role -> permission grants
--   owner:   everything
--   manager: see users + full POS
--   staff:   open POS + create bills
--   viewer:  open POS + reports (read-only)
insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r, core.permissions p
where r.key = 'owner'
on conflict do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.key in
  ('users.view','pos.view','pos.create_bill','pos.refund','pos.reports')
where r.key = 'manager'
on conflict do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.key in
  ('pos.view','pos.create_bill')
where r.key = 'staff'
on conflict do nothing;

insert into core.role_permissions (role_id, permission_id)
select r.id, p.id from core.roles r join core.permissions p on p.key in
  ('pos.view','pos.reports')
where r.key = 'viewer'
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
