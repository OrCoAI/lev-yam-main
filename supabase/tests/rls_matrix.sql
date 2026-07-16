-- =====================================================================
--  Lev Yam platform — H1: RLS regression suite (per-role can/can't matrix)
--
--  Paste-run the WHOLE file in the Supabase SQL editor (runs as postgres).
--  Everything happens inside one transaction that always ROLLS BACK —
--  test users, seed rows, and any writes vanish; prod data is untouched.
--
--  Fail-fast: the first failed assertion raises 'FAIL: <label>' and aborts
--  (the rollback still discards everything). Success ends with
--  'RLS MATRIX: ALL ASSERTIONS PASSED' in the messages panel.
--
--  If a run ends WITHOUT that message (partial paste, dropped session),
--  run `rollback;` manually. The test users are inert even if they were
--  ever to persist: random unknown password, unconfirmed email on an
--  unreceivable .test domain, banned forever.
--
--  Extend this file whenever a schema gains a table/policy — the audit's
--  rule (platform-hardening.md H1): nothing widens access silently.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
--  Helpers (pg_temp: session-local, gone after the rollback)
-- ---------------------------------------------------------------------
-- Impersonate a signed-in user: RLS sees role `authenticated` and
-- auth.uid() = the given id (read from request.jwt.claims).
create function pg_temp.become(uid uuid) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.become_anon() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

-- SELECT must return exactly `expected` rows.
create function pg_temp.assert_rows(label text, q text, expected bigint)
returns void language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') s' into n;
  if n is distinct from expected then
    raise exception 'FAIL: % — expected % row(s), got %', label, expected, n;
  end if;
  raise notice 'ok: %', label;
end $$;

-- Statement must be DENIED by the privilege/RLS layer (SQLSTATE 42501:
-- column/table grant missing, or an insert failing a with-check policy).
create function pg_temp.assert_denied(label text, stmt text)
returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute stmt;
  exception
    when insufficient_privilege then ok := true;
  end;
  if not ok then
    raise exception 'FAIL: % — expected 42501 privilege/RLS denial', label;
  end if;
  raise notice 'ok: %', label;
end $$;

-- Statement must raise the SPECIFIC guard error: SQLSTATE P0001 (every guard
-- in this repo is a plain `raise exception`) with `fragment` in the message.
-- Pinning both keeps the assertion from passing vacuously when the statement
-- fails for an unrelated reason (renamed column, dropped seed row, typo) —
-- any non-P0001 error propagates raw, which is the fail-loud we want.
create function pg_temp.assert_raises(label text, stmt text, fragment text)
returns void language plpgsql as $$
declare ok boolean := false; msg text;
begin
  begin
    execute stmt;
  exception
    when raise_exception then
      get stacked diagnostics msg = message_text;
      if position(fragment in msg) > 0 then
        ok := true;
      else
        raise exception 'FAIL: % — guard raised, but message lacks "%": %',
          label, fragment, msg;
      end if;
  end;
  if not ok then
    raise exception 'FAIL: % — expected the guard to raise', label;
  end if;
  raise notice 'ok: %', label;
end $$;

-- UPDATE/DELETE must silently affect ZERO rows (RLS hides the targets —
-- PostgREST reports 204 in this case, the classic silent-noop trap).
create function pg_temp.assert_noop(label text, stmt text)
returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: % — expected 0 affected rows, got %', label, n;
  end if;
  raise notice 'ok: %', label;
end $$;

-- Statement must simply succeed.
create function pg_temp.assert_ok(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'ok: %', label;
end $$;

-- The shared "locked-out" baseline — what an identity with ZERO module grants
-- must (not) see. Runs under whatever identity become()/become_anon() set last.
create function pg_temp.assert_locked_out(prefix text)
returns void language plpgsql as $fn$
begin
  perform pg_temp.assert_rows(prefix || ': my_permissions() is empty',
    $q$ select unnest(core.my_permissions()) $q$, 0);
  perform pg_temp.assert_rows(prefix || ': pos tables hidden',
    $q$ select 1 from pos.pos_tables where id like 'rls-test%' $q$, 0);
  perform pg_temp.assert_rows(prefix || ': finance.entries hidden',
    $q$ select 1 from finance.entries where note like 'rls-test%' $q$, 0);
  perform pg_temp.assert_rows(prefix || ': quotes hidden',
    $q$ select 1 from quotes.quotes where customer_name like 'rls-test%' $q$, 0);
  perform pg_temp.assert_rows(prefix || ': sees only the public event',
    $q$ select 1 from events.events where title like 'rls-test%' $q$, 1);
  perform pg_temp.assert_denied(prefix || ': cannot read v_sales_daily (grant revoked)',
    $q$ select 1 from pos.v_sales_daily limit 1 $q$);
end $fn$;

-- ---------------------------------------------------------------------
--  Test identities — one per role + one with no roles. Fixed UUIDs so
--  failures are easy to read; rolled back with everything else.
-- ---------------------------------------------------------------------
-- Password = random unknown hash, email unconfirmed, banned forever: even a
-- partial paste that never reaches the rollback leaves nothing sign-in-able.
insert into auth.users (instance_id, id, aud, role, email,
                        encrypted_password, email_confirmed_at, banned_until,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', uid::uuid, 'authenticated', 'authenticated',
       email, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
       null, 'infinity', now(), now()
from (values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-test-owner@levyam.test'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'rls-test-manager@levyam.test'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'rls-test-staff@levyam.test'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'rls-test-viewer@levyam.test'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rls-test-norole@levyam.test')
) v(uid, email);

insert into core.user_roles (user_id, role_id)
select v.uid::uuid, r.id
from (values ('aaaaaaaa-0000-0000-0000-000000000001', 'owner'),
             ('aaaaaaaa-0000-0000-0000-000000000002', 'manager'),
             ('aaaaaaaa-0000-0000-0000-000000000003', 'staff'),
             ('aaaaaaaa-0000-0000-0000-000000000004', 'viewer')) v(uid, rkey)
join core.roles r on r.key = v.rkey;

-- ---------------------------------------------------------------------
--  Seed rows (as postgres; RLS bypassed). Tagged so assertions count
--  only their own rows, never live data.
-- ---------------------------------------------------------------------
-- finance: one manual entry + one module-derived entry (guard-protected)
select set_config('levyam.finance_posting', 'on', true);
insert into finance.entries (id, kind, category, amount, entry_date, note, created_by,
                             source_module, source_ref)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'income', 'pos', 100, current_date,
        'rls-test derived', 'aaaaaaaa-0000-0000-0000-000000000001', 'pos', 'rls-test:pos');
select set_config('levyam.finance_posting', '', true);
insert into finance.entries (id, kind, category, amount, entry_date, note, created_by)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'income', 'other', 50, current_date,
        'rls-test manual', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into finance.expected (id, direction, category, amount, note)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'in', 'events', 500, 'rls-test expected');

-- quotes: one quote + its SIGNED (immutable) contract
insert into quotes.quotes (id, quote_number, customer_name, created_by)
values ('cccccccc-0000-0000-0000-000000000001', 'RLS-TEST-1', 'rls-test customer',
        'aaaaaaaa-0000-0000-0000-000000000001');
insert into quotes.contracts (id, quote_id, contract_number, status, signed_date, signed_name, signed_at)
values ('cccccccc-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001',
        'C-RLS-TEST-1', 'signed', current_date, 'rls-test signer', now());

-- events: one public + one internal
insert into events.events (id, title, event_date, status, visibility)
values ('dddddddd-0000-0000-0000-000000000001', 'rls-test public',   current_date, 'confirmed', 'public'),
       ('dddddddd-0000-0000-0000-000000000002', 'rls-test internal', current_date, 'confirmed', 'internal');

-- pos: a live table, a paid bill + line, and one expense of each kind
insert into pos.pos_tables (id, num, name) values ('rls-test-t1', 999, 'rls-test');
insert into pos.pos_bills (id, table_num, name) values ('rls-test-b1', 999, 'rls-test');
insert into pos.pos_bill_items (bill_id, item_name, unit_price, qty)
values ('rls-test-b1', 'rls-test item', 10, 1);
insert into pos.pos_expenses (business_date, kind, amount, note)
values (current_date, 'food', 10, 'rls-test'), (current_date, 'labor', 20, 'rls-test');

-- storage: one object in the private bucket, so the denial assertion below is
-- proven against an existing row (not vacuously true on an empty bucket)
insert into storage.buckets (id, name, public) values ('quotes-docs', 'quotes-docs', false)
on conflict (id) do nothing;
insert into storage.objects (bucket_id, name) values ('quotes-docs', 'rls-test/dummy.txt');

-- =====================================================================
--  ANON — the public surface is the events feed, nothing else
-- =====================================================================
select pg_temp.become_anon();
select pg_temp.assert_rows('anon sees ONLY the public event',
  $q$ select 1 from events.events where title like 'rls-test%' $q$, 1);
select pg_temp.assert_denied('anon cannot read events.notes (column grant)',
  $q$ select notes from events.events limit 1 $q$);
select pg_temp.assert_rows('anon reads the public feed view',
  $q$ select 1 from events.feed where title like 'rls-test%' $q$, 1);
select pg_temp.assert_denied('anon cannot read pos.pos_tables',
  $q$ select 1 from pos.pos_tables limit 1 $q$);
select pg_temp.assert_denied('anon cannot read pos.pos_bills',
  $q$ select 1 from pos.pos_bills limit 1 $q$);
select pg_temp.assert_denied('anon cannot read pos.v_sales_daily',
  $q$ select 1 from pos.v_sales_daily limit 1 $q$);
select pg_temp.assert_denied('anon cannot read finance.entries',
  $q$ select 1 from finance.entries limit 1 $q$);
select pg_temp.assert_denied('anon cannot read quotes.quotes',
  $q$ select 1 from quotes.quotes limit 1 $q$);

-- =====================================================================
--  NO-ROLE authenticated user — catalog is readable, module data is not
-- =====================================================================
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000005');
select pg_temp.assert_locked_out('no-role');
select pg_temp.assert_rows('no-role: my_modules() is empty',
  $q$ select 1 from core.my_modules() $q$, 0);
select pg_temp.assert_rows('no-role: admin_list_users() returns nothing',
  $q$ select 1 from core.admin_list_users() $q$, 0);

-- =====================================================================
--  VIEWER — empty placeholder role (owner decision 2026-07-15): zero
--  grants until explicitly given some. Locked-out baseline + write denials.
-- =====================================================================
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000004');
select pg_temp.assert_locked_out('viewer');
select pg_temp.assert_denied('viewer: cannot insert a pos table',
  $q$ insert into pos.pos_tables (id, num) values ('rls-test-nope', 998) $q$);
select pg_temp.assert_noop('viewer: pos table update is a silent noop',
  $q$ update pos.pos_tables set name = 'x' where id = 'rls-test-t1' $q$);
select pg_temp.assert_rows('viewer: raw pos_expenses hidden (needs pos.reports)',
  $q$ select 1 from pos.pos_expenses where note like 'rls-test%' $q$, 0);
select pg_temp.assert_rows('viewer: finance.expected hidden',
  $q$ select 1 from finance.expected where note like 'rls-test%' $q$, 0);

-- =====================================================================
--  STAFF — works the floor & kitchen, logs food costs; no money views
-- =====================================================================
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000003');
select pg_temp.assert_ok('staff: can edit a pos table (pos.order)',
  $q$ update pos.pos_tables set name = 'rls-test edited' where id = 'rls-test-t1' $q$);
select pg_temp.assert_rows('staff: raw pos_expenses hidden (needs pos.reports)',
  $q$ select 1 from pos.pos_expenses where note like 'rls-test%' $q$, 0);
select pg_temp.assert_ok('staff: can log a FOOD expense (pos.costs_food)',
  $q$ insert into pos.pos_expenses (business_date, kind, amount, note)
      values (current_date, 'food', 5, 'rls-test staff') $q$);
select pg_temp.assert_denied('staff: cannot log a LABOR expense (no pos.costs_labor)',
  $q$ insert into pos.pos_expenses (business_date, kind, amount, note)
      values (current_date, 'labor', 5, 'rls-test staff') $q$);
select pg_temp.assert_rows('staff: finance.entries hidden',
  $q$ select 1 from finance.entries where note like 'rls-test%' $q$, 0);
select pg_temp.assert_rows('staff: finance.expected hidden',
  $q$ select 1 from finance.expected where note like 'rls-test%' $q$, 0);
select pg_temp.assert_rows('staff: quotes hidden',
  $q$ select 1 from quotes.quotes where customer_name like 'rls-test%' $q$, 0);
select pg_temp.assert_rows('staff: owner_secrets returns zero rows',
  $q$ select 1 from quotes.owner_secrets $q$, 0);
select pg_temp.assert_rows('staff: sees both events (events.view)',
  $q$ select 1 from events.events where title like 'rls-test%' $q$, 2);
select pg_temp.assert_denied('staff: cannot read v_sales_daily (grant revoked)',
  $q$ select 1 from pos.v_sales_daily limit 1 $q$);
select pg_temp.assert_denied('staff: cannot write core catalog (roles)',
  $q$ insert into core.roles (key, label) values ('rls-test-role', 'nope') $q$);
select pg_temp.assert_raises('staff: cannot draw a quote number (quotes.manage check)',
  $q$ select quotes.next_quote_number() $q$, 'quotes.manage');
select pg_temp.assert_rows('staff: quotes-docs storage objects unreachable (zero policies)',
  $q$ select 1 from storage.objects where bucket_id = 'quotes-docs' $q$, 0);

-- =====================================================================
--  MANAGER — money yes, identity governance no
-- =====================================================================
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.assert_rows('manager: sees finance.entries',
  $q$ select 1 from finance.entries where note like 'rls-test%' $q$, 2);
select pg_temp.assert_ok('manager: can edit a MANUAL finance entry',
  $q$ update finance.entries set amount = 51
      where id = 'bbbbbbbb-0000-0000-0000-000000000002' $q$);
select pg_temp.assert_raises('manager: DERIVED finance entry rejects UPDATE (guard)',
  $q$ update finance.entries set amount = 999
      where id = 'bbbbbbbb-0000-0000-0000-000000000001' $q$, 'אינו ניתן לעריכה או מחיקה');
select pg_temp.assert_raises('manager: DERIVED finance entry rejects DELETE (guard)',
  $q$ delete from finance.entries
      where id = 'bbbbbbbb-0000-0000-0000-000000000001' $q$, 'אינו ניתן לעריכה או מחיקה');
select pg_temp.assert_rows('manager: sees raw pos_expenses (pos.reports)',
  $q$ select 1 from pos.pos_expenses where note = 'rls-test' $q$, 2);
select pg_temp.assert_raises('manager: SIGNED contract rejects UPDATE (immutable)',
  $q$ update quotes.contracts set signed_name = 'tampered'
      where id = 'cccccccc-0000-0000-0000-000000000002' $q$, 'כבר נחתם');
select pg_temp.assert_raises('manager: SIGNED contract rejects DELETE (immutable)',
  $q$ delete from quotes.contracts
      where id = 'cccccccc-0000-0000-0000-000000000002' $q$, 'לא ניתן למחוק');
select pg_temp.assert_denied('manager: cannot write core catalog (roles)',
  $q$ insert into core.roles (key, label) values ('rls-test-role', 'nope') $q$);
select pg_temp.assert_noop('manager: role_permissions delete is a silent noop',
  $q$ delete from core.role_permissions where true $q$);
select pg_temp.assert_rows('manager: admin_list_users() works via users.view',
  $q$ select 1 from core.admin_list_users()
      where email = 'rls-test-owner@levyam.test' $q$, 1);

-- =====================================================================
--  OWNER — full control, but the DB guards still hold the line
-- =====================================================================
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert_ok('owner: can create a custom role',
  $q$ insert into core.roles (key, label, sort)
      values ('rls-test-role', 'rls test', 900) $q$);
select pg_temp.assert_ok('owner: can grant a permission to it',
  $q$ insert into core.role_permissions (role_id, permission_id)
      select r.id, p.id from core.roles r, core.permissions p
      where r.key = 'rls-test-role' and p.key = 'pos.view' $q$);
select pg_temp.assert_rows('owner: audit_log recorded the role create (with actor)',
  $q$ select 1 from core.audit_log
      where table_name = 'roles' and action = 'insert'
        and actor = 'aaaaaaaa-0000-0000-0000-000000000001'
        and row_data->>'key' = 'rls-test-role' $q$, 1);
select pg_temp.assert_ok('owner: can delete the custom role (cascade)',
  $q$ delete from core.roles where key = 'rls-test-role' $q$);
select pg_temp.assert_raises('owner: LAST-ADMIN guard blocks deleting every users.manage grant',
  $q$ delete from core.role_permissions rp using core.permissions p
      where rp.permission_id = p.id and p.key = 'users.manage' $q$, 'users.manage');
select pg_temp.assert_rows('owner: sees both events',
  $q$ select 1 from events.events where title like 'rls-test%' $q$, 2);
select pg_temp.assert_rows('owner: sees the raw pos_expenses (pos.reports)',
  $q$ select 1 from pos.pos_expenses where note = 'rls-test' $q$, 2);

-- Done — discard everything (test users, seeds, edits).
reset role;
do $$ begin raise notice 'RLS MATRIX: ALL ASSERTIONS PASSED'; end $$;
rollback;
