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

-- Set a resolvable auth.uid() WITHOUT switching role — for the as-postgres phases
-- (seed + functional auto-repost) where a finance row's created_by defaults to
-- auth.uid() but we must stay postgres (bypass RLS / call internal post_day).
-- Unlike become(), this leaves `role` untouched. Uses the test owner.
create function pg_temp.seed_actor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
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

-- A numeric expression must equal `expected` (functional assertions).
create function pg_temp.assert_num(label text, got numeric, expected numeric)
returns void language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL: % — expected %, got %', label, expected, got;
  end if;
  raise notice 'ok: %', label;
end $$;

-- Statement must be rejected by a FOREIGN KEY (SQLSTATE 23503) — the taxonomy
-- FKs added in 54_finance_categories.sql, which enforce both "this category
-- exists" and "it belongs to this kind". Pinned to 23503 like assert_raises
-- pins P0001, so an unrelated failure can never pass the assertion.
create function pg_temp.assert_fk_denied(label text, stmt text)
returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute stmt;
  exception when foreign_key_violation then ok := true;
  end;
  if not ok then
    raise exception 'FAIL: % — expected a foreign-key violation', label;
  end if;
  raise notice 'ok: %', label;
end $$;

-- Statement must be rejected by a CHECK constraint (SQLSTATE 23514) — the
-- transfer invariants in 57_finance_transfers.sql. Pinned to 23514 for the same
-- reason assert_fk_denied pins 23503: an unrelated failure must never pass.
create function pg_temp.assert_check_denied(label text, stmt text)
returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute stmt;
  exception when check_violation then ok := true;
  end;
  if not ok then
    raise exception 'FAIL: % — expected a check-constraint violation', label;
  end if;
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
-- Password = random unknown hash, banned forever: even a partial paste that never
-- reaches the rollback leaves nothing sign-in-able. The ban and the unknown hash
-- are what make that true — so the manager fixture can carry a *confirmed* email
-- (a fixed literal the admin_list_users assertions below compare against) while
-- the rest stay unconfirmed, covering both states without weakening any of it.
insert into auth.users (instance_id, id, aud, role, email,
                        encrypted_password, email_confirmed_at, banned_until,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', uid::uuid, 'authenticated', 'authenticated',
       email, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
       confirmed, 'infinity', now(), now()
from (values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-test-owner@levyam.test',   null::timestamptz),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'rls-test-manager@levyam.test', '2020-01-02 03:04:05+00'::timestamptz),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'rls-test-staff@levyam.test',   null),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'rls-test-viewer@levyam.test',  null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rls-test-norole@levyam.test',  null)
) v(uid, email, confirmed);

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
-- Seeds run as postgres, but give them a resolvable auth.uid() (the test owner)
-- so any finance row whose created_by defaults to auth.uid() gets a valid actor —
-- exactly like a real authenticated request. Without this, seeding a pos_expense
-- on an already-booked day fires the auto re-post (48), whose correction entry
-- would take created_by = auth.uid() = NULL and violate NOT NULL. (become()/
-- become_anon() override this per role test; reset role leaves the claim intact.)
select pg_temp.seed_actor();

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
-- 'events' is a quotes-OWNED category, so this row is written the only way such
-- a row is legitimately written: behind the posting GUC, exactly as
-- quotes.plan_money_for_quote() does it. Provenance alone is not enough and must
-- not be — source_module is client-writable (see the forging assertion below).
select set_config('levyam.finance_posting', 'on', true);
insert into finance.expected (id, direction, category, amount, note, source_module, source_ref)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'in', 'events', 500, 'rls-test expected',
        'quotes', 'rls-test-quote:seed');
select set_config('levyam.finance_posting', '', true);
-- an archived category, to prove the guard blocks NEW money under it (54)
insert into finance.categories (kind, key, label_he, label_ar, active, sort)
values ('expense', 'rls_archived', 'בדיקה ארכיון', 'اختبار أرشيف', false, 995);

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
-- explicit ids (overriding the identity seq, harmless — the whole tx rolls back)
-- so the set_expense_* RPC assertions can reference a row a caller can't SELECT.
insert into pos.pos_expenses (id, business_date, kind, amount, note) overriding system value
values (900001, current_date, 'food', 10, 'rls-test'), (900002, current_date, 'labor', 20, 'rls-test');

-- 47_pos_payments: one OPEN table with a payment, plus a payment whose bill is
-- already closed — so the "reopen before editing money" rule can be asserted
-- from both sides.
insert into pos.pos_tables (id, num, name, guests_adults, guests_children, pricing_mode, items)
values ('rls-test-tbl', 991, 'rls-test', 2, 0, 'a_la_carte', '[]'::jsonb);
insert into pos.pos_payments (id, bill_id, method, amount, taken_by) overriding system value
values (990001, 'rls-test-tbl',   'cash', 50, 'rls@test'),   -- bill still open
       (990002, 'rls-test-b1',    'cash', 30, 'rls@test');   -- bill already closed
-- an open table for the legacy (pre-split-payments) 2-arg close-path assertion
insert into pos.pos_tables (id, num, name, pricing_mode, guests_adults, items)
values ('rls-legacy-tbl', 995, 'rls-legacy', 'a_la_carte', 1, '[]'::jsonb);
-- a kitchen line already fired (49_pos_kitchen): sent 2, none done/served — used to
-- assert pos_mark_item now advances `done` ONE unit per tap and clamps to [served, sent].
insert into pos.pos_tables (id, num, name, pricing_mode, guests_adults, items)
values ('rls-kite-tbl', 996, 'rls-kite', 'a_la_carte', 1,
        jsonb_build_array(jsonb_build_object('id','k1','name','rls-test dish',
          'price',10,'qty',2,'sent',2,'done',0,'served',0)));

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
select pg_temp.assert_raises('viewer: cannot mark a kitchen item (no pos.kitchen)',
  $q$ select pos.pos_mark_item('rls-kite-tbl', 'k1', true) $q$, 'pos.kitchen');
select pg_temp.assert_rows('viewer: menu hidden (no pos.view)',
  $q$ select 1 from pos.menu_items where id = 'hummus' $q$, 0);
select pg_temp.assert_rows('viewer: menu option groups hidden (no pos.view)',
  $q$ select 1 from pos.menu_option_groups where id = 'g_hummus_add' $q$, 0);
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
-- receipt/paid RPCs (46_pos_expenses_tracking): receipt gated to the kind's cost
-- perm, paid gated to pos.manage
select pg_temp.assert_ok('staff: can flag receipt on a FOOD expense (pos.costs_food)',
  $q$ select pos.set_expense_receipt(900001, true) $q$);
select pg_temp.assert_raises('staff: cannot flag receipt on a LABOR expense (no pos.costs_labor)',
  $q$ select pos.set_expense_receipt(900002, true) $q$, 'אין הרשאה');
select pg_temp.assert_raises('staff: cannot mark an expense paid (no pos.manage)',
  $q$ select pos.set_expense_paid(900001, current_date) $q$, 'pos.manage');
select pg_temp.assert_raises('staff: cannot edit an expense (no pos.manage)',
  $q$ select pos.set_expense(900001, 'x', 9) $q$, 'pos.manage');

-- payments + item voids (47_pos_payments): taking money is floor work,
-- correcting recorded money is not.
select pg_temp.assert_ok('staff: can record a payment on an OPEN bill (pos.order)',
  $q$ select pos.add_payment('rls-test-tbl', 'cash', 25, 'rls-test') $q$);
select pg_temp.assert_raises('staff: cannot add a payment to a CLOSED bill (off-books guard)',
  $q$ select pos.add_payment('rls-test-b1', 'cash', 25, null) $q$, 'החשבון סגור');
select pg_temp.assert_raises('staff: cannot edit a recorded payment (no pos.manage)',
  $q$ select pos.edit_payment(990001, 'cash', 60, null) $q$, 'pos.manage');
select pg_temp.assert_raises('staff: cannot void a recorded payment (no pos.manage)',
  $q$ select pos.void_payment(990001) $q$, 'pos.manage');
select pg_temp.assert_ok('staff: can void an item never sent to the kitchen (pos.order)',
  $q$ select pos.void_item('rls-test-tbl', 'rls-test item', 1, 10, false, 'mistake') $q$);
select pg_temp.assert_raises('staff: cannot void an item the kitchen already fired (needs pos.manage)',
  $q$ select pos.void_item('rls-test-tbl', 'rls-test item', 1, 10, true, 'burnt') $q$, 'pos.manage');
select pg_temp.assert_denied('staff: direct pos_payments SELECT denied (RPC-only path)',
  $q$ select 1 from pos.pos_payments where bill_id = 'rls-test-tbl' $q$);
-- 49_pos_kitchen: "mark ready" now moves ONE unit per tap and clamps to [served, sent]
select pg_temp.assert_ok('staff: can mark a kitchen item ready (pos.kitchen)',
  $q$ select pos.pos_mark_item('rls-kite-tbl', 'k1', true) $q$);
select pg_temp.assert_num('staff: one ready tap advances done by exactly one',
  (select (i->>'done')::int from pos.pos_tables t, jsonb_array_elements(t.items) i
   where t.id = 'rls-kite-tbl' and i->>'id' = 'k1'), 1);
select pg_temp.assert_ok('staff: second ready tap advances to sent',
  $q$ select pos.pos_mark_item('rls-kite-tbl', 'k1', true) $q$);
select pg_temp.assert_ok('staff: third ready tap is a clamped no-op',
  $q$ select pos.pos_mark_item('rls-kite-tbl', 'k1', true) $q$);
select pg_temp.assert_num('staff: done clamps at sent (2), never past it',
  (select (i->>'done')::int from pos.pos_tables t, jsonb_array_elements(t.items) i
   where t.id = 'rls-kite-tbl' and i->>'id' = 'k1'), 2);
select pg_temp.assert_ok('staff: undo steps one unit back',
  $q$ select pos.pos_mark_item('rls-kite-tbl', 'k1', false) $q$);
select pg_temp.assert_num('staff: one undo tap steps done back by exactly one',
  (select (i->>'done')::int from pos.pos_tables t, jsonb_array_elements(t.items) i
   where t.id = 'rls-kite-tbl' and i->>'id' = 'k1'), 1);
select pg_temp.assert_ok('staff: undo again toward served',
  $q$ select pos.pos_mark_item('rls-kite-tbl', 'k1', false) $q$);
select pg_temp.assert_ok('staff: undo below served is a clamped no-op',
  $q$ select pos.pos_mark_item('rls-kite-tbl', 'k1', false) $q$);
select pg_temp.assert_num('staff: done clamps at served (0), never negative',
  (select (i->>'done')::int from pos.pos_tables t, jsonb_array_elements(t.items) i
   where t.id = 'rls-kite-tbl' and i->>'id' = 'k1'), 0);
-- 51_pos_menu: the menu is readable by anyone who can see the POS (pos.view),
-- writable only with pos.menu (owner/manager)
select pg_temp.assert_rows('staff: can read the menu (pos.view)',
  $q$ select 1 from pos.menu_items where id = 'hummus' $q$, 1);
select pg_temp.assert_denied('staff: cannot add a menu category (no pos.menu)',
  $q$ insert into pos.menu_categories (id, name_he, name_ar) values ('rls-test-cat', 'x', 'x') $q$);
select pg_temp.assert_noop('staff: menu price edit is a silent noop (no pos.menu)',
  $q$ update pos.menu_items set price = 999 where id = 'hummus' $q$);
select pg_temp.assert_rows('staff: can read menu option groups (pos.view)',
  $q$ select 1 from pos.menu_option_groups where id = 'g_hummus_add' $q$, 1);
select pg_temp.assert_rows('staff: can read menu options (pos.view)',
  $q$ select 1 from pos.menu_options where id = 'o_hummus_egg' $q$, 1);
select pg_temp.assert_denied('staff: cannot add a menu option group (no pos.menu)',
  $q$ insert into pos.menu_option_groups (id, item_id, name_he, name_ar, kind) values ('rls-test-og','hummus','x','x','add') $q$);
select pg_temp.assert_noop('staff: menu option price edit is a silent noop (no pos.menu)',
  $q$ update pos.menu_options set price_delta = 999 where id = 'o_hummus_egg' $q$);
-- 51/53: the price-validation helpers are internal to pos_close_table (SECURITY DEFINER);
-- revoked from public so no role can call them directly (guards the money path).
select pg_temp.assert_denied('staff: pos.menu_price is internal — not directly callable',
  $q$ select pos.menu_price('החומוס של רמי') $q$);
select pg_temp.assert_denied('staff: pos.option_charge is internal — not directly callable',
  $q$ select pos.option_charge('o_hummus_egg', 1) $q$);
select pg_temp.assert_denied('staff: pos.assert_line_prices is internal — not directly callable',
  $q$ select pos.assert_line_prices('[]'::jsonb) $q$);
select pg_temp.assert_raises('staff: cannot post the day to finance (no pos.manage)',
  $q$ select pos.close_day(current_date) $q$, 'pos.manage');
select pg_temp.assert_denied('staff: pos.post_day is internal — not callable by any role',
  $q$ select pos.post_day(current_date) $q$);
select pg_temp.assert_raises('staff: cannot read day posting status (needs pos.reports)',
  $q$ select pos.day_status(current_date) $q$, 'pos.reports');
select pg_temp.assert_denied('staff: pos.day_is_posted is internal — not callable',
  $q$ select pos.day_is_posted(current_date) $q$);
-- 55_finance_reconciliation: the drift report is definer-rights (it must read POS
-- tables a finance reader may not see), so its ONLY gate is the explicit
-- permission check inside it — assert it actually fires.
select pg_temp.assert_raises('staff: finance.reconciliation denied (no finance.view)',
  $q$ select finance.reconciliation() $q$, 'permission denied');
select pg_temp.assert_raises('staff: finance.reconciliation_counts denied (no finance.view)',
  $q$ select finance.reconciliation_counts() $q$, 'permission denied');
select pg_temp.assert_denied('staff: pos.day_expected_legs is internal — not callable',
  $q$ select * from pos.day_expected_legs(current_date) $q$);
-- 56_finance_override (PR C): the owner override is the ONE key that can move a
-- module-posted number, so every entry point to it is asserted shut here.
select pg_temp.assert_raises('staff: finance.post_correction denied (no finance.override)',
  $q$ select finance.post_correction(
        (select id from finance.entries limit 1), 1, 'x') $q$, 'permission denied');
select pg_temp.assert_raises('staff: finance.correction_preview denied (no finance.override)',
  $q$ select finance.correction_preview((select id from finance.entries limit 1)) $q$,
  'permission denied');
select pg_temp.assert_denied('staff: finance.correction_target is internal — not callable',
  $q$ select * from finance.correction_target((select id from finance.entries limit 1)) $q$);
select pg_temp.assert_denied('staff: pos.day_is_pinned is internal — not callable',
  $q$ select pos.day_is_pinned(current_date) $q$);
select pg_temp.assert_rows('staff: pos.day_pins hidden (no pos.reports, no finance.view)',
  $q$ select 1 from pos.day_pins $q$, 0);
select pg_temp.assert_denied('staff: cannot freeze a day',
  $q$ insert into pos.day_pins (business_date, reason) values ('2099-09-09','x') $q$);
select pg_temp.assert_rows('staff: finance.entries hidden',
  $q$ select 1 from finance.entries where note like 'rls-test%' $q$, 0);
select pg_temp.assert_rows('staff: finance.transfers hidden (no finance.view)',
  $q$ select 1 from finance.transfers $q$, 0);
select pg_temp.assert_denied('staff: cannot record a transfer',
  $q$ insert into finance.transfers (amount, from_method, to_method)
      values (10, 'cash', 'bank') $q$);
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
  $q$ insert into core.roles (key, label_he) values ('rls-test-role', 'nope') $q$);
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
-- 51_pos_menu: managers hold pos.menu — they may edit the menu
select pg_temp.assert_ok('manager: can add a menu category (pos.menu)',
  $q$ insert into pos.menu_categories (id, name_he, name_ar, sort) values ('rls-test-cat', 'בדיקה', 'اختبار', 999) $q$);
select pg_temp.assert_ok('manager: can edit a menu item price (pos.menu)',
  $q$ update pos.menu_items set price = 34 where id = 'hummus' $q$);
select pg_temp.assert_ok('manager: can add a menu option group (pos.menu)',
  $q$ insert into pos.menu_option_groups (id, item_id, name_he, name_ar, kind, min_sel, max_sel, included, sort)
      values ('rls-test-og','hummus','בדיקה','اختبار','add',0,1,0,999) $q$);
select pg_temp.assert_ok('manager: can add a menu option (pos.menu)',
  $q$ insert into pos.menu_options (id, group_id, name_he, name_ar, price_delta, sort)
      values ('rls-test-o','rls-test-og','בדיקה','اختبار',7,10) $q$);
select pg_temp.assert_ok('manager: can edit a menu option price (pos.menu)',
  $q$ update pos.menu_options set price_delta = 6 where id = 'o_hummus_egg' $q$);
select pg_temp.assert_ok('manager: can edit a MANUAL finance entry',
  $q$ update finance.entries set amount = 51
      where id = 'bbbbbbbb-0000-0000-0000-000000000002' $q$);
select pg_temp.assert_raises('manager: DERIVED finance entry rejects UPDATE (guard)',
  $q$ update finance.entries set amount = 999
      where id = 'bbbbbbbb-0000-0000-0000-000000000001' $q$, 'אינו ניתן לעריכה או מחיקה');
select pg_temp.assert_raises('manager: DERIVED finance entry rejects DELETE (guard)',
  $q$ delete from finance.entries
      where id = 'bbbbbbbb-0000-0000-0000-000000000001' $q$, 'אינו ניתן לעריכה או מחיקה');
-- 54_finance_categories: the taxonomy reads with finance.view but writes need
-- finance.categories (owner-only) — a manager has the first and not the second.
select pg_temp.assert_rows('manager: sees the category taxonomy (finance.view)',
  $q$ select 1 from finance.categories where kind = 'expense' and key = 'rent' $q$, 1);
select pg_temp.assert_denied('manager: cannot add a category (no finance.categories)',
  $q$ insert into finance.categories (kind, key, label_he, label_ar)
      values ('expense','rls_test_cat','בדיקה','اختبار') $q$);
select pg_temp.assert_noop('manager: cannot rename a category (RLS hides the row)',
  $q$ update finance.categories set label_he = 'שינוי' where kind = 'expense' and key = 'rent' $q$);
-- the one-writer rule is now DATA: the guard resolves owned_by_module per row
select pg_temp.assert_raises('manager: MODULE-OWNED category still rejects a manual entry',
  $q$ insert into finance.entries (kind, category, amount, entry_date, note)
      values ('income','pos', 5, current_date, 'rls-test cat') $q$, 'נרשמת אוטומטית');
select pg_temp.assert_fk_denied('manager: unknown category rejected by the taxonomy FK',
  $q$ insert into finance.entries (kind, category, amount, entry_date, note)
      values ('expense','no_such_category', 5, current_date, 'rls-test cat') $q$);
select pg_temp.assert_fk_denied('manager: category from the OTHER kind rejected (composite FK)',
  $q$ insert into finance.entries (kind, category, amount, entry_date, note)
      values ('income','rent', 5, current_date, 'rls-test cat') $q$);
select pg_temp.assert_fk_denied('manager: expected row with a direction/category mismatch rejected',
  $q$ insert into finance.expected (direction, category, amount, note)
      values ('in','rent', 5, 'rls-test cat') $q$);
-- archived is a DB rule too, not merely a hidden option in the picker
select pg_temp.assert_raises('manager: ARCHIVED category rejects a new entry',
  $q$ insert into finance.entries (kind, category, amount, entry_date, note)
      values ('expense','rls_archived', 5, current_date, 'rls-test cat') $q$, 'בארכיון');
-- ...and on the PLAN side, or the rule is only half a rule: an expectation
-- filed under an archived category posts an entry under it on fulfilment,
-- because record_payment() runs behind the posting GUC and the entries guard
-- above never sees it
select pg_temp.assert_raises('manager: ARCHIVED category rejects a new expectation',
  $q$ insert into finance.expected (direction, category, amount, note)
      values ('out','rls_archived', 5, 'rls-test cat') $q$, 'בארכיון');
select pg_temp.assert_raises('manager: MODULE-OWNED category rejects a hand-written expectation',
  $q$ insert into finance.expected (direction, category, amount, note)
      values ('in','events', 5, 'rls-test cat') $q$, 'מודול');
-- ...and CLAIMING to be the module does not help. `grant insert on
-- finance.expected` covers every column, so source_module is client-writable:
-- an earlier revision of expected_guard() keyed its carve-out on that column,
-- which let any finance.manage holder forge provenance, file money under a
-- derived-only category, charge another module's drift badge and forge its
-- "open the source" link. Only the posting GUC may open that door.
select pg_temp.assert_raises('manager: ...and cannot get in by FORGING source_module',
  $q$ insert into finance.expected (direction, category, amount, note, source_module, source_ref)
      values ('in','events', 5, 'rls-test cat', 'quotes', 'rls-test-quote:forged') $q$, 'מודול');
select pg_temp.assert_rows('manager: the forged expectation really was not written',
  $q$ select 1 from finance.expected where source_ref = 'rls-test-quote:forged' $q$, 0);
-- Provenance on the PLAN side is module-written only, or record_payment() will
-- launder a forged tag into the ledger: it copies the expectation's own
-- source_module into the entry it posts, behind the GUC. 'override' is the
-- sharpest case — PR C mints it for OWNER-only corrections, so a manager
-- reaching it would put a row badged "תיקון בעלים" in the books with their own
-- note, and correction_target() then throws on that row (it casts
-- split_part('expected:<uuid>', ':', 2) to date), so even the owner cannot
-- repair it. `grant insert on finance.expected` covers every column, so this
-- has to be a guard, not a grant.
select pg_temp.assert_raises('manager: cannot create an expectation carrying PROVENANCE',
  $q$ insert into finance.expected (direction, category, amount, note, source_module, source_ref)
      values ('in','bookings', 5000, 'rls-test forge', 'override', 'x') $q$, 'מודול');
select pg_temp.assert_rows('manager: ...so no override-badged row can be laundered in',
  $q$ select 1 from finance.expected where note = 'rls-test forge' $q$, 0);
-- own fixtures, so these do not depend on a row created further down the file
insert into finance.expected (id, direction, category, amount, note)
values ('bbbbbbbb-0000-0000-0000-0000000000fe', 'in', 'bookings', 300, 'rls-test provenance');
insert into finance.expected (direction, category, amount, note)
values ('in', 'bookings', 50, 'rls-test provenance-free');
select pg_temp.assert_raises('manager: cannot re-tag an existing expectation either',
  $q$ update finance.expected set source_module = 'override'
      where id = 'bbbbbbbb-0000-0000-0000-0000000000fe' $q$, 'מקור');
-- and the amount amplifier: record_payment posts with non-null provenance, where
-- finance_entries_amount_check permits negatives (module reversals need that) —
-- so an unvalidated p_amount was the one client path to a negative entry
select pg_temp.assert_raises('manager: record_payment refuses a NEGATIVE amount',
  $q$ select finance.record_payment('bbbbbbbb-0000-0000-0000-0000000000fe'::uuid,
        -5000, 'cash', current_date, 'rls-test negative') $q$, 'חיובי');
select pg_temp.assert_raises('manager: ...and refuses zero',
  $q$ select finance.record_payment('bbbbbbbb-0000-0000-0000-0000000000fe'::uuid,
        0, 'cash', current_date, 'rls-test zero') $q$, 'חיובי');
delete from finance.expected where id = 'bbbbbbbb-0000-0000-0000-0000000000fe';
-- DELETE erases provenance as effectively as re-tagging it, and it is what
-- entries_guard() blocks on the ledger side. Deleting a quotes-planned deposit
-- would destroy the module's record of money owed AND silently clear that
-- expectation's overdue drift item, so the books would stop reporting a real
-- problem. Cancelling is the supported retirement (status='cancelled').
select pg_temp.assert_raises('manager: cannot DELETE a module-planned expectation',
  $q$ delete from finance.expected
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'למחיקה');
select pg_temp.assert_rows('manager: ...and the module expectation is still there',
  $q$ select 1 from finance.expected
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 1);
select pg_temp.assert_ok('manager: but CAN cancel it, which is the supported path',
  $q$ update finance.expected set status = 'cancelled'
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$);
update finance.expected set status = 'open'
 where id = 'bbbbbbbb-0000-0000-0000-000000000003';

-- ── H6: a module-sourced expectation is MODULE-owned (2026-08-12) ──────
-- Before this, any finance.manage holder could rewrite amount / due_date /
-- reason / note / event_id / fulfilled_by on a QUOTES-planned expectation as
-- long as they left the category alone — breaking the pairing with the signed
-- quote, and (via fulfilled_by) pointing it at an arbitrary entry.
select pg_temp.assert_raises('manager: cannot change a module expectation''s AMOUNT',
  $q$ update finance.expected set amount = 999
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'רק את הסטטוס');
select pg_temp.assert_raises('manager: ...nor its DUE DATE',
  $q$ update finance.expected set due_date = current_date + 90
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'רק את הסטטוס');
select pg_temp.assert_raises('manager: ...nor its REASON/NOTE',
  $q$ update finance.expected set reason = 'hijacked', note = 'x'
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'רק את הסטטוס');
select pg_temp.assert_raises('manager: ...nor point fulfilled_by at an arbitrary entry',
  $q$ update finance.expected set fulfilled_by = 'bbbbbbbb-0000-0000-0000-00000000000e'
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'רק את הסטטוס');
select pg_temp.assert_raises('manager: ...nor hand-set paid_amount to fake a payment',
  $q$ update finance.expected set paid_amount = 500
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'רק את הסטטוס');
-- source_ref is the quotes↔expectation PAIRING KEY, and the first version of
-- this guard (a deny-list of ten named columns) left it editable. Repointing it
-- detaches the expectation from its signed quote, redirects every UI source
-- link, and makes plan_money_for_quote silently decline to plan the real one.
-- The guard is now an allow-list, so this and every future column are covered.
select pg_temp.assert_raises('manager: ...nor REPOINT source_ref at another quote',
  $q$ update finance.expected set source_ref = 'rls-test-other-quote:deposit'
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'רק את הסטטוס');
select pg_temp.assert_raises('manager: ...nor backdate created_at',
  $q$ update finance.expected set created_at = now() - interval '5 years'
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$, 'רק את הסטטוס');
select pg_temp.assert_rows('manager: the module expectation is untouched after all of that',
  $q$ select 1 from finance.expected
      where id = 'bbbbbbbb-0000-0000-0000-000000000003'
        and amount = 500 and paid_amount = 0 and reason <> 'hijacked' $q$, 1);
-- a hand-created expectation carries no provenance and stays freely deletable
select pg_temp.assert_ok('manager: a hand-created expectation is still deletable',
  $q$ delete from finance.expected where note = 'rls-test provenance-free' $q$);
-- expected_guard() cannot read new.kind (GENERATED STORED columns are computed
-- AFTER before-row triggers), so it re-derives direction→kind. If that copy ever
-- diverges from the column's own expression, the guard looks up a (kind, key)
-- pair that matches no category, takes the "not found" path and fails OPEN —
-- silently, while the composite FK still passes on the real kind. Pin them.
insert into finance.expected (direction, category, amount, note)
values ('in','bookings', 1, 'rls-test kindmap'), ('out','suppliers', 1, 'rls-test kindmap');
select pg_temp.assert_rows('the generated kind matches the mapping expected_guard() derives',
  $q$ select 1 from finance.expected
      where note = 'rls-test kindmap'
        and kind = case direction when 'in' then 'income' else 'expense' end $q$, 2);
delete from finance.expected where note = 'rls-test kindmap';
-- the UPDATE carve-out: an edit that leaves the category where it is skips the
-- check entirely, so a row under a category archived later stays editable
-- (archiving must not freeze history); MOVING one into an archived category is
-- still refused
insert into finance.expected (direction, category, amount, note)
values ('out','maintenance', 7, 'rls-test archive-edit');
select pg_temp.assert_ok('manager: editing an expectation without moving its category is fine',
  $q$ update finance.expected set amount = 8 where note = 'rls-test archive-edit' $q$);
select pg_temp.assert_raises('manager: ...but it cannot be MOVED into an archived category',
  $q$ update finance.expected set category = 'rls_archived'
      where note = 'rls-test archive-edit' $q$, 'בארכיון');
delete from finance.expected where note = 'rls-test archive-edit';
-- record_payment() UPDATEs finance.expected AFTER it has reset the posting GUC,
-- so the new guard DOES see that write. It falls through the carve-out above
-- (status changes, category does not) — asserted rather than reasoned about,
-- because a guard that quietly broke fulfilment would break the money path.
insert into finance.expected (id, direction, category, amount, note)
values ('bbbbbbbb-0000-0000-0000-00000000000f', 'out', 'suppliers', 120, 'rls-test fulfil');
select pg_temp.assert_ok('manager: record_payment can still fulfil an expectation',
  $q$ select finance.record_payment('bbbbbbbb-0000-0000-0000-00000000000f'::uuid,
        null, 'cash', current_date, 'rls-test fulfilled') $q$);
select pg_temp.assert_rows('manager: ...and the expectation is closed against its entry',
  $q$ select 1 from finance.expected e join finance.entries n on n.id = e.fulfilled_by
      where e.id = 'bbbbbbbb-0000-0000-0000-00000000000f'
        and e.status = 'fulfilled' and n.category = 'suppliers' and n.amount = 120 $q$, 1);
-- manager holds finance.view → the report runs and is well-formed
select pg_temp.assert_rows('manager: finance.reconciliation returns a report',
  $q$ select 1 where (finance.reconciliation() ? 'items')
                 and (finance.reconciliation() ? 'count') $q$, 1);
-- count is the ACTIONABLE count, not items length: pinned days (severity 'low')
-- are listed but must never light a badge. Assert the contract that actually
-- holds, or a pin would make this pass only by luck.
select pg_temp.assert_rows('manager: counts.finance = the non-low item count',
  $q$ select 1 where (finance.reconciliation_counts()->>'finance')::int
                     = (select count(*)
                        from jsonb_array_elements(finance.reconciliation()->'items') x
                        where x->>'severity' <> 'low') $q$, 1);
select pg_temp.assert_rows('manager: reconciliation.count agrees with counts.finance',
  $q$ select 1 where (finance.reconciliation()->>'count')::int
                     = (finance.reconciliation_counts()->>'finance')::int $q$, 1);
-- manager has pos.reports (so a pin is visible to them) but NOT finance.override
select pg_temp.assert_ok('manager: CAN read pos.day_pins (pos.reports)',
  $q$ select 1 from pos.day_pins $q$);
select pg_temp.assert_denied('manager: cannot freeze a day (no finance.override)',
  $q$ insert into pos.day_pins (business_date, reason) values ('2099-09-09','x') $q$);
select pg_temp.assert_raises('manager: cannot post an owner correction',
  $q$ select finance.post_correction(
        (select id from finance.entries where source_module = 'pos' limit 1), 1, 'x') $q$,
  'permission denied');
-- 57_finance_transfers (PR D): a transfer is ordinary money handling, gated by
-- the same finance.view/manage pair as entries — no new permission.
select pg_temp.assert_ok('manager: can record a cash -> bank transfer',
  $q$ insert into finance.transfers (amount, from_method, to_method, note)
      values (2000, 'cash', 'bank', 'rls-test transfer') $q$);
select pg_temp.assert_rows('manager: and can read it back',
  $q$ select 1 from finance.transfers where note = 'rls-test transfer' $q$, 1);
select pg_temp.assert_check_denied('manager: a transfer to the SAME pocket is rejected',
  $q$ insert into finance.transfers (amount, from_method, to_method)
      values (50, 'cash', 'cash') $q$);
select pg_temp.assert_check_denied('manager: an unknown payment method is rejected',
  $q$ insert into finance.transfers (amount, from_method, to_method)
      values (50, 'cash', 'crypto') $q$);
select pg_temp.assert_check_denied('manager: a non-positive transfer is rejected',
  $q$ insert into finance.transfers (amount, from_method, to_method)
      values (0, 'cash', 'bank') $q$);
select pg_temp.assert_denied('manager: cannot forge a transfer''s author (column grant)',
  $q$ update finance.transfers set created_by = '00000000-0000-0000-0000-000000000009'
      where note = 'rls-test transfer' $q$);
-- THE invariant this table exists for: a transfer is neither income nor
-- expense, so nothing that sums either may see it. If a later change ever
-- routes transfers into finance.entries, this fails loudly.
select pg_temp.assert_rows('manager: a transfer creates NO finance.entries row',
  $q$ select 1 from finance.entries where note = 'rls-test transfer' $q$, 0);
select pg_temp.assert_num('manager: and it does not move the P&L',
  (select (finance.report(current_date - 1, current_date + 1)->>'income_total')::numeric
   + (finance.report(current_date - 1, current_date + 1)->>'expense_total')::numeric
   - (select coalesce(sum(amount), 0) from finance.entries
      where entry_date between current_date - 1 and current_date + 1)), 0);
select pg_temp.assert_denied('manager: pos.day_expected_legs is internal — not callable',
  $q$ select * from pos.day_expected_legs(current_date) $q$);
select pg_temp.assert_rows('manager: sees raw pos_expenses (pos.reports)',
  $q$ select 1 from pos.pos_expenses where note = 'rls-test' $q$, 2);
-- receipt/paid RPCs: manage may flag either kind and mark/clear paid
select pg_temp.assert_ok('manager: can flag receipt on a LABOR expense (pos.manage)',
  $q$ select pos.set_expense_receipt(900002, true) $q$);
select pg_temp.assert_ok('manager: can mark an expense paid (pos.manage)',
  $q$ select pos.set_expense_paid(900001, current_date) $q$);
select pg_temp.assert_ok('manager: can clear the paid date (pos.manage)',
  $q$ select pos.set_expense_paid(900001, null) $q$);
-- note kept as 'rls-test' so the later owner row-count assertion still sees 2
select pg_temp.assert_ok('manager: can edit an expense name + amount (pos.manage)',
  $q$ select pos.set_expense(900001, 'rls-test', 12) $q$);
select pg_temp.assert_raises('manager: expense edit rejects a non-positive amount',
  $q$ select pos.set_expense(900001, 'x', 0) $q$, 'סכום לא תקין');
select pg_temp.assert_denied('manager: direct pos_expenses UPDATE denied (no UPDATE grant — RPC-only path)',
  $q$ update pos.pos_expenses set has_receipt = true where id = 900002 $q$);

-- payments (47_pos_payments): a manager may correct recorded money, but only
-- while the bill is open — a closed bill must be re-opened first, so booked
-- money never changes without a visible re-open.
select pg_temp.assert_ok('manager: can edit a payment on an OPEN bill (pos.manage)',
  $q$ select pos.edit_payment(990001, 'card', 60, 'rls-test') $q$);
select pg_temp.assert_raises('manager: cannot edit a payment on a CLOSED bill (must reopen)',
  $q$ select pos.edit_payment(990002, 'cash', 10, null) $q$, 'לפתוח אותו מחדש');
select pg_temp.assert_raises('manager: cannot void a payment on a CLOSED bill (must reopen)',
  $q$ select pos.void_payment(990002) $q$, 'לפתוח אותו מחדש');
select pg_temp.assert_raises('manager: payment edit rejects a non-positive amount',
  $q$ select pos.edit_payment(990001, 'cash', 0, null) $q$, 'סכום לא תקין');
select pg_temp.assert_raises('manager: payment edit rejects an unknown method',
  $q$ select pos.edit_payment(990001, 'bitcoin', 10, null) $q$, 'אמצעי תשלום');
select pg_temp.assert_ok('manager: can void an already-fired item (pos.manage)',
  $q$ select pos.void_item('rls-test-tbl', 'rls-test item', 1, 10, true, 'burnt') $q$);
select pg_temp.assert_ok('manager: can void a payment on an OPEN bill (pos.manage)',
  $q$ select pos.void_payment(990001) $q$);
select pg_temp.assert_ok('manager: can read day posting status (pos.reports)',
  $q$ select pos.day_status(current_date) $q$);
-- backward compat: a legacy 2-arg close (no recorded payments) must still work,
-- falling back to the payload's cash_paid/card_paid — the deployed client path
select pg_temp.assert_ok('legacy 2-arg close (no payments → payload cash/card) still works',
  $q$ select pos.pos_close_table(
        jsonb_build_object('id','rls-legacy-tbl','table_num',995,'pricing_mode','a_la_carte',
          'oh_charge',0,'extras_total',50,'menu_value',50,'discount',0,'grand_total',50,'tip',0,
          'cash_paid',50,'card_paid',0),
        '[{"item_name":"x","is_custom":true,"unit_price":50,"qty":1,"is_open_house":false}]'::jsonb) $q$);

-- every discount must be attributed — enforced in the DB, not just the UI
select pg_temp.assert_raises('manager: cannot close a discounted bill with no discount reason',
  $q$ select pos.pos_close_table(
        jsonb_build_object('id','rls-test-tbl','table_num',991,'pricing_mode','a_la_carte',
          'oh_charge',0,'extras_total',0,'discount',20,'grand_total',-20,'tip',0),
        '[]'::jsonb) $q$, 'סיבת ההנחה');
select pg_temp.assert_raises('manager: discount kind "other" still requires a written reason',
  $q$ select pos.pos_close_table(
        jsonb_build_object('id','rls-test-tbl','table_num',991,'pricing_mode','a_la_carte',
          'oh_charge',0,'extras_total',0,'discount',20,'grand_total',-20,'tip',0,
          'discount_kind','other'),
        '[]'::jsonb) $q$, 'לפרט את סיבת ההנחה');
select pg_temp.assert_raises('manager: SIGNED contract rejects UPDATE (immutable)',
  $q$ update quotes.contracts set signed_name = 'tampered'
      where id = 'cccccccc-0000-0000-0000-000000000002' $q$, 'כבר נחתם');
select pg_temp.assert_raises('manager: SIGNED contract rejects DELETE (immutable)',
  $q$ delete from quotes.contracts
      where id = 'cccccccc-0000-0000-0000-000000000002' $q$, 'לא ניתן למחוק');
select pg_temp.assert_denied('manager: cannot write core catalog (roles)',
  $q$ insert into core.roles (key, label_he) values ('rls-test-role', 'nope') $q$);
select pg_temp.assert_noop('manager: role_permissions delete is a silent noop',
  $q$ delete from core.role_permissions where true $q$);
select pg_temp.assert_noop('manager: role rename is a silent noop (no users.manage)',
  $q$ update core.roles set label_he = 'nope' where key = 'staff' $q$);
-- removes-only payload on purpose: this is the path RLS would turn into a
-- silent noop — core.require() must make it raise loudly instead
select pg_temp.assert_raises('manager: atomic matrix-apply RPC raises (no users.manage, removes-only)',
  $q$ select core.apply_role_permissions('[]'::jsonb,
        (select jsonb_build_array(jsonb_build_object('role_id', r.id, 'permission_id', p.id))
         from core.roles r, core.permissions p where r.key = 'staff' and p.key = 'pos.view')) $q$,
  'users.manage');
select pg_temp.assert_rows('manager: admin_list_users() works via users.view',
  $q$ select 1 from core.admin_list_users()
      where email = 'rls-test-owner@levyam.test' $q$, 1);
-- email_confirmed_at (added 2026-07-30) must come through faithfully — the users
-- module decides "invited but never accepted" from it and gates the confirm_email
-- action on that verdict, so a stale/wrong value would either hide a locked-out
-- account or offer a pointless action. Both states are asserted against the
-- literals the fixtures were seeded with (below): joining auth.users here would
-- fail — `authenticated` has no grant on it — and comparing the function to
-- itself via a join would pass even if the column were a constant.
select pg_temp.assert_rows('manager: admin_list_users() reports the confirmed fixture''s timestamp',
  $q$ select 1 from core.admin_list_users()
      where email = 'rls-test-manager@levyam.test'
        and email_confirmed_at = '2020-01-02 03:04:05+00'::timestamptz $q$, 1);
select pg_temp.assert_rows('manager: admin_list_users() reports null for the unconfirmed fixtures',
  $q$ select 1 from core.admin_list_users()
      where email <> 'rls-test-manager@levyam.test' and email_confirmed_at is null $q$, 4);

-- =====================================================================
--  OWNER — full control, but the DB guards still hold the line
-- =====================================================================
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');

-- ── PARTIAL PAYMENTS + the owner override (2026-08-12) ────────────────
-- Before this, record_payment() closed an expectation at ANY amount: ₪1
-- against ₪500 marked it fulfilled and the rest vanished from the plan.
select pg_temp.assert_ok('owner: a PARTIAL payment posts and leaves the expectation open',
  $q$ select finance.record_payment('bbbbbbbb-0000-0000-0000-000000000003', 200) $q$);
select pg_temp.assert_rows('owner: ...paid_amount accumulated, status still open',
  $q$ select 1 from finance.expected
      where id = 'bbbbbbbb-0000-0000-0000-000000000003'
        and paid_amount = 200 and amount = 500 and status = 'open' $q$, 1);
select pg_temp.assert_raises('owner: cannot pay MORE than the remaining balance',
  $q$ select finance.record_payment('bbbbbbbb-0000-0000-0000-000000000003', 301) $q$,
  'גדול מהיתרה');
select pg_temp.assert_ok('owner: paying the remainder closes it',
  $q$ select finance.record_payment('bbbbbbbb-0000-0000-0000-000000000003', 300) $q$);
select pg_temp.assert_rows('owner: ...now fulfilled, fully paid, with fulfilled_by set',
  $q$ select 1 from finance.expected
      where id = 'bbbbbbbb-0000-0000-0000-000000000003'
        and paid_amount = 500 and status = 'fulfilled' and fulfilled_by is not null $q$, 1);
-- Each payment needs its own source_ref or the posting unique index collides.
select pg_temp.assert_rows('owner: the two payments posted as separate :pN entries',
  $q$ select 1 from finance.entries
      where source_ref like 'expected:bbbbbbbb-0000-0000-0000-000000000003:p%' $q$, 2);
select pg_temp.assert_rows('owner: ...and they sum to the expectation, not double it',
  $q$ select 1 from finance.entries
      where source_ref like 'expected:bbbbbbbb-0000-0000-0000-000000000003:p%'
      having sum(amount) = 500 $q$, 1);

-- The owner bypass on module-sourced rows, and its receipt.
update finance.expected set status = 'open', paid_amount = 0
 where id = 'bbbbbbbb-0000-0000-0000-000000000003';
select pg_temp.assert_ok('owner: CAN rewrite a module-planned expectation (manager cannot)',
  $q$ update finance.expected set amount = 750
      where id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$);
select pg_temp.assert_rows('owner: ...and finance.audit_log recorded it with the actor',
  $q$ select 1 from finance.audit_log
      where table_name = 'finance.expected' and action = 'UPDATE'
        and row_id = 'bbbbbbbb-0000-0000-0000-000000000003'
        and actor = 'aaaaaaaa-0000-0000-0000-000000000001'
        and (row_after->>'amount')::numeric = 750 $q$, 1);
-- The audit log is append-only from the app's side: only `select` is granted
-- and there is no write policy, so these are 42501 denials (assert_denied),
-- not guard exceptions (assert_raises pins P0001).
select pg_temp.assert_denied('owner: cannot forge a finance.audit_log row',
  $q$ insert into finance.audit_log (action, table_name)
      values ('UPDATE', 'finance.expected') $q$);
select pg_temp.assert_denied('owner: cannot erase a finance.audit_log row',
  $q$ delete from finance.audit_log
      where row_id = 'bbbbbbbb-0000-0000-0000-000000000003' $q$);

select pg_temp.assert_ok('owner: can create a custom role',
  $q$ insert into core.roles (key, label_he, sort)
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
-- role RENAME (bilingual labels): a label-only UPDATE fires the roles guard
-- trigger but leaves every users.manage grant intact, so it must PASS.
select pg_temp.assert_ok('owner: can rename a role — bilingual label UPDATE passes the guard',
  $q$ update core.roles set label_he = 'שם בדיקה', label_ar = 'اسم اختبار'
      where key = 'manager' $q$);
select pg_temp.assert_rows('owner: the rename persisted in both languages',
  $q$ select 1 from core.roles where key = 'manager'
        and label_he = 'שם בדיקה' and label_ar = 'اسم اختبار' $q$, 1);
select pg_temp.assert_raises('owner: LAST-ADMIN guard blocks deleting every users.manage grant',
  $q$ delete from core.role_permissions rp using core.permissions p
      where rp.permission_id = p.id and p.key = 'users.manage' $q$, 'users.manage');
-- a role assigned to users can't be deleted out from under them: the BEFORE
-- DELETE in-use guard fires first (the owner role is held by the test owner),
-- ahead of any cascade or the cascade-aware last-admin guard behind it
select pg_temp.assert_raises('owner: cannot delete a role assigned to users (in-use guard)',
  $q$ delete from core.roles where key = 'owner' $q$, 'role_in_use');
select pg_temp.assert_ok('owner: atomic matrix apply — grant via RPC',
  $q$ select core.apply_role_permissions(
        (select jsonb_build_array(jsonb_build_object('role_id', r.id, 'permission_id', p.id))
         from core.roles r, core.permissions p where r.key = 'staff' and p.key = 'users.view'),
        '[]'::jsonb) $q$);
select pg_temp.assert_rows('owner: the RPC grant landed',
  $q$ select 1 from core.role_permissions rp
      join core.roles r on r.id = rp.role_id
      join core.permissions p on p.id = rp.permission_id
      where r.key = 'staff' and p.key = 'users.view' $q$, 1);
select pg_temp.assert_ok('owner: atomic matrix apply — revoke via RPC',
  $q$ select core.apply_role_permissions('[]'::jsonb,
        (select jsonb_build_array(jsonb_build_object('role_id', r.id, 'permission_id', p.id))
         from core.roles r, core.permissions p where r.key = 'staff' and p.key = 'users.view')) $q$);
select pg_temp.assert_rows('owner: sees both events',
  $q$ select 1 from events.events where title like 'rls-test%' $q$, 2);
select pg_temp.assert_rows('owner: sees the raw pos_expenses (pos.reports)',
  $q$ select 1 from pos.pos_expenses where note = 'rls-test' $q$, 2);

-- 54_finance_categories: owner is the only role holding finance.categories.
select pg_temp.assert_ok('owner: can add a category (finance.categories)',
  $q$ insert into finance.categories (kind, key, label_he, label_ar, sort)
      values ('expense','rls_test_cat','בדיקה','اختبار',990) $q$);
select pg_temp.assert_ok('owner: can rename a category in both languages',
  $q$ update finance.categories set label_he = 'בדיקה 2', label_ar = 'اختبار ٢'
      where kind = 'expense' and key = 'rls_test_cat' $q$);
select pg_temp.assert_ok('owner: can archive a category',
  $q$ update finance.categories set active = false
      where kind = 'expense' and key = 'rls_test_cat' $q$);
-- module ownership is declared by the module in SQL, never from the admin UI —
-- enforced by a COLUMN grant, so even the owner is refused
select pg_temp.assert_denied('owner: cannot claim module ownership (column grant)',
  $q$ update finance.categories set owned_by_module = 'pos'
      where kind = 'expense' and key = 'rls_test_cat' $q$);
select pg_temp.assert_denied('owner: cannot re-key a category (column grant)',
  $q$ update finance.categories set key = 'rls_test_renamed'
      where kind = 'expense' and key = 'rls_test_cat' $q$);
select pg_temp.assert_ok('owner: can delete an UNUSED category',
  $q$ delete from finance.categories where kind = 'expense' and key = 'rls_test_cat' $q$);
-- archive-not-delete is enforced by the FK, not merely by the UI
-- 56_finance_override (PR C) — the owner really does get the last word, and it
-- lands as an ADDITIVE row: the module posting it corrects stays untouched.
select pg_temp.assert_ok('owner: can freeze a day',
  $q$ insert into pos.day_pins (business_date, reason)
      values ('2099-09-09', 'rls-test freeze') $q$);
-- reason is editable; pinned_by is NOT — a client that could write it could
-- forge who froze a day, which is the whole audit value of the row
select pg_temp.assert_ok('owner: can restate the freeze reason',
  $q$ update pos.day_pins set reason = 'rls-test freeze 2' where business_date = '2099-09-09' $q$);
select pg_temp.assert_denied('owner: cannot forge who froze a day (column grant)',
  $q$ update pos.day_pins set pinned_by = null where business_date = '2099-09-09' $q$);
select pg_temp.assert_ok('owner: can unfreeze a day',
  $q$ delete from pos.day_pins where business_date = '2099-09-09' $q$);
select pg_temp.assert_fk_denied('owner: cannot delete a category history references',
  $q$ delete from finance.categories where kind = 'income' and key = 'other' $q$);
-- §7.4 holds for the owner too: no role bypasses the one-writer rule
select pg_temp.assert_raises('owner: MODULE-OWNED category rejects a manual entry (no owner bypass)',
  $q$ insert into finance.entries (kind, category, amount, entry_date, note)
      values ('income','pos', 5, current_date, 'rls-test cat') $q$, 'נרשמת אוטומטית');
select pg_temp.assert_rows('finance.categories is granted to owner ONLY',
  $q$ select 1 from core.role_permissions rp
      join core.roles r on r.id = rp.role_id
      join core.permissions p on p.id = rp.permission_id
      where p.key = 'finance.categories' and r.key <> 'owner' $q$, 0);

-- =====================================================================
--  USER LIFECYCLE — delete & deactivate (plans/users-delete-deactivate.md)
--  Runs LAST on purpose: it strips every other users.manage grant in-tx
--  to stage a true "last admin" state, which would poison earlier sections.
-- =====================================================================
reset role;
select pg_temp.assert_rows('users.delete permission is seeded',
  $q$ select 1 from core.permissions where key = 'users.delete' $q$, 1);
select pg_temp.assert_rows('users.delete is granted to owner ONLY',
  $q$ select 1 from core.role_permissions rp
      join core.roles r on r.id = rp.role_id
      join core.permissions p on p.id = rp.permission_id
      where p.key = 'users.delete' and r.key <> 'owner' $q$, 0);
-- users.password (set/reset another user's password) — same owner-only posture
select pg_temp.assert_rows('users.password permission is seeded',
  $q$ select 1 from core.permissions where key = 'users.password' $q$, 1);
select pg_temp.assert_rows('users.password is granted to owner ONLY',
  $q$ select 1 from core.role_permissions rp
      join core.roles r on r.id = rp.role_id
      join core.permissions p on p.id = rp.permission_id
      where p.key = 'users.password' and r.key <> 'owner' $q$, 0);

-- the admin-user-ops helpers are service-side only — even an owner's client
-- JWT must not be able to probe arbitrary users or forge audit rows
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert_denied('owner (client JWT) cannot call users_manage_survives_without',
  $q$ select core.users_manage_survives_without('aaaaaaaa-0000-0000-0000-000000000004') $q$);
select pg_temp.assert_denied('owner (client JWT) cannot call admin_audit_user_event',
  $q$ select core.admin_audit_user_event('aaaaaaaa-0000-0000-0000-000000000001',
        'user.delete', '{}'::jsonb) $q$);
-- the self-grant-owner hole (found + closed 2026-07-16): the service-role-only
-- definer functions must be unreachable from a client JWT — `revoke from
-- authenticated` was a no-op while PUBLIC kept the default execute grant. Test
-- as the no-role user (any authenticated user was the actual exposure).
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000005');
select pg_temp.assert_denied('no-role user cannot call admin_assign_role (no PUBLIC execute → no self-grant owner)',
  $q$ select core.admin_assign_role('aaaaaaaa-0000-0000-0000-000000000005',
        (select id from core.roles where key='owner'),
        'aaaaaaaa-0000-0000-0000-000000000005') $q$);
select pg_temp.assert_denied('no-role user cannot call has_permission_for (no PUBLIC execute)',
  $q$ select core.has_permission_for('aaaaaaaa-0000-0000-0000-000000000001','users.manage') $q$);

reset role;
-- the lifecycle audit writer (as the Edge Function would call it, service-side)
select pg_temp.assert_ok('admin_audit_user_event accepts a lifecycle event',
  $q$ select core.admin_audit_user_event('aaaaaaaa-0000-0000-0000-000000000001',
        'user.deactivate', '{"user_id":"rls-test"}'::jsonb) $q$);
select pg_temp.assert_rows('the lifecycle audit row landed with the real actor',
  $q$ select 1 from core.audit_log
      where action = 'user.deactivate' and table_name = 'auth.users'
        and actor = 'aaaaaaaa-0000-0000-0000-000000000001'
        and row_data->>'user_id' = 'rls-test' $q$, 1);

-- Stage "the no-role test user is the last ACTIVE admin": grant it owner,
-- lift its ban (in-tx only; its random password + unconfirmed email keep it
-- inert regardless), then strip every OTHER users.manage-granting assignment.
-- The statement-level guard passes because one holder survives.
insert into core.user_roles (user_id, role_id)
select 'aaaaaaaa-0000-0000-0000-000000000005', r.id from core.roles r where r.key = 'owner';
update auth.users set banned_until = null
where id = 'aaaaaaaa-0000-0000-0000-000000000005';
delete from core.user_roles ur
using core.role_permissions rp, core.permissions p
where rp.role_id = ur.role_id and p.id = rp.permission_id
  and p.key = 'users.manage'
  and ur.user_id <> 'aaaaaaaa-0000-0000-0000-000000000005';

-- survives-check semantics: banned holders don't count as survivors (every
-- other test user is banned-forever, real grants are stripped above)
select pg_temp.assert_rows('users_manage_survives_without(a non-admin) is true',
  $q$ select 1 where core.users_manage_survives_without('aaaaaaaa-0000-0000-0000-000000000004') $q$, 1);
select pg_temp.assert_rows('users_manage_survives_without(the last active admin) is false',
  $q$ select 1 where core.users_manage_survives_without('aaaaaaaa-0000-0000-0000-000000000005') $q$, 0);

-- THE cascade hole (closed 2026-07-16): statement triggers don't fire on FK
-- cascades, so only the row-level twin can catch a hard delete of the last
-- admin's auth account — this is exactly the admin-user-ops delete path
select pg_temp.assert_raises('deleting the last admin AUTH USER trips the row-level guard (cascade)',
  $q$ delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000005' $q$,
  'users.manage');
-- ...while deleting a record-less NON-admin account (the invite-cleanup path)
-- sails through the same trigger
select pg_temp.assert_ok('deleting a record-less non-admin auth user succeeds',
  $q$ delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000004' $q$);

-- Done — discard everything (test users, seeds, edits).
reset role;
-- ---------------------------------------------------------------------
--  Auto re-post (48_pos_day_lifecycle) — functional, as postgres. A booked
--  day whose money changes afterward must self-correct in finance, including
--  a REDUCING change (the negative-delta path that a leftover finance
--  constraint used to block — see 21_finance_spine.sql). Uses a far-future
--  date so it can't collide with real postings; the whole tx rolls back.
-- ---------------------------------------------------------------------
reset role;
-- re-assert a valid actor: intervening become()/user-delete tests changed the
-- claim, and these postings' corrections need a non-null, still-existing created_by.
select pg_temp.seed_actor();
insert into pos.pos_expenses (business_date, kind, amount, note) values ('2099-01-01', 'food', 100, 'ar-test');
select pos.post_day('2099-01-01'::date);  -- manual first post (as postgres)
select pg_temp.assert_num('auto-repost: books hold the food total after the first post',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-01-01:food%'), 100);
insert into pos.pos_expenses (business_date, kind, amount, note) values ('2099-01-01', 'food', 50, 'ar-test2');
select pg_temp.assert_num('auto-repost: ADDING an expense to a booked day auto-corrects the books',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-01-01:food%'), 150);
delete from pos.pos_expenses where note = 'ar-test' and business_date = '2099-01-01';
select pg_temp.assert_num('auto-repost: DELETING an expense posts a negative correction (was constraint-blocked)',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-01-01:food%'), 50);

-- ---------------------------------------------------------------------
--  Legacy-day revenue preservation (47 post_day two-source fix). A bill
--  closed BEFORE split-payments shipped has no pos_payments rows — its
--  money lives only on the bill. post_day must still book that revenue
--  (net of tip) from the bill, and re-posting after an expense change must
--  NOT wipe it (the bug: revenue recomputed from empty pos_payments → 0,
--  a giant negative correction). grand 200, cash 120 + card 130 = 250 =
--  grand + tip(50). Old grammar: card=least(130,200)=130, cash=200-130=70.
-- ---------------------------------------------------------------------
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid, tip)
values ('rls-legacy-day', 993, 'paid', '2099-03-03 12:00+02', 200, 120, 130, 50);
select pos.post_day('2099-03-03'::date);
select pg_temp.assert_num('legacy-day: revenue booked from the bill (cash leg, net of tip)',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-03-03:cash%'), 70);
select pg_temp.assert_num('legacy-day: revenue booked from the bill (card leg, net of tip)',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-03-03:card%'), 130);
-- an expense edit fires auto-repost; revenue must survive it, not zero out
insert into pos.pos_expenses (business_date, kind, amount, note) values ('2099-03-03', 'food', 40, 'legacy-day-exp');
select pg_temp.assert_num('legacy-day: revenue PRESERVED after auto-repost (was wiped to 0)',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-03-03:cash%'), 70);
select pg_temp.assert_num('legacy-day: card revenue PRESERVED after auto-repost',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-03-03:card%'), 130);
select pg_temp.assert_num('legacy-day: the new expense DID post to food',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-03-03:food%'), 40);

-- ---------------------------------------------------------------------
--  55_finance_reconciliation: the drift report must actually DETECT, not just
--  return well-formed JSON. A day with real money and no posting is the exact
--  production failure this initiative exists for (July 2026, found by hand).
-- ---------------------------------------------------------------------
-- Reads finance.reconciliation_items() (the internal row source) rather than
-- finance.reconciliation(): this phase runs as postgres, LATE in the
-- transaction, after the user-lifecycle section has stripped role grants — so a
-- has_permission-gated wrapper would fail for reasons unrelated to detection.
-- The gate itself is asserted in the staff/manager phases above.
select pg_temp.seed_actor();
-- Year-2000 dates, not the 2099 the rest of the suite uses: check 1 only reports
-- a day that is actually OVER (`e.d < today`), so a future-dated fixture would
-- make every assertion below pass for the wrong reason. Still unmistakably
-- synthetic, and every assertion filters on business_date, so widening p_since
-- to reach them isolates nothing less than a narrow future window did.
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid, tip)
values ('rls-unposted-day', 994, 'paid', '2000-05-05 12:00+02', 500, 200, 300, 0);
select pg_temp.assert_rows('recon: an UNPOSTED day with money is reported',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'type' = 'unposted_day' and r.item->>'business_date' = '2000-05-05' $q$, 1);
select pg_temp.assert_num('recon: it reports the day''s full revenue',
  (select (r.item->>'revenue')::numeric from finance.reconciliation_items('2000-01-01') r
   where r.item->>'type' = 'unposted_day' and r.item->>'business_date' = '2000-05-05'), 500);
-- posting it must make the item disappear — the alert clears because the
-- problem is gone, never because someone dismissed it
select pos.post_day('2000-05-05'::date);
select pg_temp.assert_rows('recon: posting the day clears the item',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'type' = 'unposted_day' and r.item->>'business_date' = '2000-05-05' $q$, 0);
-- TODAY is not late. Every other detection fixture here uses year-2099 dates, so
-- the live path -- a service in progress -- was the one case the suite could not
-- see: an unbounded check 1 reported the current day the moment its first bill
-- was paid, lighting both launcher badges and offering a one-click post of a
-- PARTIAL day. Dated with real now(), deliberately, since that is the bug.
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid, tip)
values ('rls-today-open', 991, 'paid', now(), 300, 300, 0, 0);
select pg_temp.assert_rows('recon: the day being served is NOT reported as unposted',
  $q$ select 1 from finance.reconciliation_items((current_date - 2)::date) r
      where r.item->>'type' = 'unposted_day'
        and r.item->>'business_date' = (now() at time zone 'Asia/Jerusalem')::date::text $q$, 0);
-- ...while yesterday, genuinely over and never posted, still is
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid, tip)
values ('rls-yesterday', 990, 'paid', now() - interval '1 day', 300, 300, 0, 0);
select pg_temp.assert_rows('recon: but YESTERDAY unposted still is',
  $q$ select 1 from finance.reconciliation_items((current_date - 2)::date) r
      where r.item->>'type' = 'unposted_day'
        and r.item->>'business_date'
            = ((now() - interval '1 day') at time zone 'Asia/Jerusalem')::date::text $q$, 1);
delete from pos.pos_bills where id in ('rls-today-open', 'rls-yesterday');

-- and a silent money change on a booked day must surface as recompute drift
select set_config('levyam.suppress_repost', 'on', true);
update pos.pos_bills set grand_total = 700 where id = 'rls-unposted-day';
select set_config('levyam.suppress_repost', '', true);
select pg_temp.assert_rows('recon: a silently-changed booked day is reported as drift',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'type' = 'recompute_drift' and r.item->>'business_date' = '2000-05-05' $q$, 1);
select pos.post_day('2000-05-05'::date);
select pg_temp.assert_rows('recon: re-posting clears the drift',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2000-05-05' $q$, 0);
-- A drift whose legs CANCEL is still a drift: the same money moved from cash to
-- card and the books did not follow. The day is now grand_total 700 / card 300,
-- booked as cash 400 + card 300; paying 600 of it by card makes the legs
-- -300 cash / +300 card. total_delta is a MAGNITUDE precisely so this reports
-- 600 rather than the "0" a signed roll-up would give it.
select set_config('levyam.suppress_repost', 'on', true);
update pos.pos_bills set card_paid = 600 where id = 'rls-unposted-day';
select set_config('levyam.suppress_repost', '', true);
select pg_temp.assert_rows('recon: legs that cancel are still reported as drift',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'type' = 'recompute_drift' and r.item->>'business_date' = '2000-05-05' $q$, 1);
select pg_temp.assert_num('recon: and its amount is the money that moved, not the net',
  (select (r.item->>'total_delta')::numeric from finance.reconciliation_items('2000-01-01') r
   where r.item->>'type' = 'recompute_drift' and r.item->>'business_date' = '2000-05-05'), 600);
select pos.post_day('2000-05-05'::date);
select pg_temp.assert_rows('recon: re-posting clears the cancelling drift too',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2000-05-05' $q$, 0);

-- ---------------------------------------------------------------------
--  56_finance_override (PR C) — the owner correction and the day pin.
--
--  The two behaviours below are the reason this PR's design differs from the
--  plan, so they are pinned as assertions rather than left to a comment:
--    1. an ADDITIVE correction survives a re-post on its own. post_day totals
--       a leg from source_module = 'pos' rows only, so it cannot see, and
--       therefore cannot undo, an override row. No pin is needed to protect it.
--    2. a pin freezes the WHOLE day — which is why correcting must NOT pin
--       automatically: every cost entered afterwards would silently never land.
-- ---------------------------------------------------------------------
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid, tip)
values ('rls-override-day', 993, 'paid', '2099-06-06 12:00+02', 400, 400, 0, 0);
select pos.post_day('2099-06-06'::date);
select pg_temp.assert_num('override: day booked at its computed cash',
  (select coalesce(sum(amount), 0) from finance.entries
   where source_ref like 'pos:2099-06-06:cash%'), 400);

-- post_correction is permission-gated, and this phase runs after the
-- user-lifecycle section stripped role grants — user ...0005 is the one owner
-- left standing, so act as them for the gated call.
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000005', 'role', 'authenticated')::text,
  true);
-- the owner says the drawer really held 350
select finance.post_correction(
  (select id from finance.entries where source_ref = 'pos:2099-06-06:cash'), 350, 'ספירת קופה');
select pg_temp.assert_num('override: the correction moved the leg to the stated total',
  (select coalesce(sum(amount), 0) from finance.entries
   where source_ref like '%pos:2099-06-06:cash%'), 350);
select pg_temp.assert_num('override: the ORIGINAL posting is untouched (§7.4 holds)',
  (select amount from finance.entries where source_ref = 'pos:2099-06-06:cash'), 400);
select pg_temp.assert_rows('override: correcting does NOT freeze the day',
  $q$ select 1 from pos.day_pins where business_date = '2099-06-06' $q$, 0);
select pg_temp.seed_actor();  -- back to the default actor for the rest

-- (1) a re-post cannot undo it, and new money still lands
insert into pos.pos_expenses (business_date, kind, amount, note)
values ('2099-06-06', 'food', 60, 'rls-test');
select pg_temp.assert_num('override: the correction SURVIVES the auto re-post',
  (select coalesce(sum(amount), 0) from finance.entries
   where source_ref like '%pos:2099-06-06:cash%'), 350);
select pg_temp.assert_num('override: later costs still reach the books',
  (select coalesce(sum(amount), 0) from finance.entries
   where source_ref like 'pos:2099-06-06:food%'), 60);

-- (2) an explicit pin freezes the day: drift is reported as 'pinned', the
--     manual post is refused outright, and the trigger path skips silently
insert into pos.day_pins (business_date, reason) values ('2099-06-06', 'rls-test pin');
select pg_temp.assert_rows('pin: a frozen day is reported as pinned, never as drift',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2099-06-06'
        and r.item->>'type' = 'recompute_drift' $q$, 0);
select pg_temp.assert_rows('pin: and it IS listed, so the freeze stays visible',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2099-06-06' and r.item->>'type' = 'pinned' $q$, 1);
select pg_temp.assert_rows('pin: a clean frozen day is severity low (never badges)',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2099-06-06' and r.severity = 'low' $q$, 1);
select pg_temp.assert_raises('pin: pos.post_day refuses a frozen day',
  $q$ select pos.post_day('2099-06-06'::date) $q$, 'נעול');
-- money entered behind the freeze does NOT reach the books, and the item
-- escalates to 'medium' so the badge lights rather than hiding it
insert into pos.pos_expenses (business_date, kind, amount, note)
values ('2099-06-06', 'labor', 90, 'rls-test');
select pg_temp.assert_num('pin: the trigger skipped silently — labor never posted',
  (select coalesce(sum(amount), 0) from finance.entries
   where source_ref like 'pos:2099-06-06:labor%'), 0);
select pg_temp.assert_rows('pin: money piling up behind the freeze escalates to medium',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2099-06-06' and r.item->>'type' = 'pinned'
        and r.severity = 'medium' $q$, 1);
-- A day pinned BEFORE it was ever posted is the nastier case: reported as
-- 'unposted_day' it would offer a post button that post_day() refuses, so the
-- item could never clear and both badges would stay lit forever. It must be
-- reported as pinned — and at 'medium', because its whole takings sit outside
-- the books, which is precisely money piling up behind a freeze.
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid, tip)
values ('rls-pinned-unposted', 992, 'paid', '2000-07-07 12:00+02', 250, 250, 0, 0);
insert into pos.day_pins (business_date, reason) values ('2000-07-07', 'rls-test never posted');
select pg_temp.assert_rows('pin: a never-posted frozen day is NOT reported as unposted_day',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2000-07-07'
        and r.item->>'type' = 'unposted_day' $q$, 0);
select pg_temp.assert_rows('pin: it is reported as pinned at medium (its takings are outside)',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'business_date' = '2000-07-07' and r.item->>'type' = 'pinned'
        and r.severity = 'medium' $q$, 1);
select pg_temp.assert_num('pin: and it reports the full withheld amount',
  (select (r.item->>'total_delta')::numeric from finance.reconciliation_items('2000-01-01') r
   where r.item->>'business_date' = '2000-07-07'), 250);
delete from pos.day_pins where business_date = '2000-07-07';

-- ---------------------------------------------------------------------
--  The quotes -> finance money seam, against 54's finance.expected_guard().
--
--  This is the REAL call site of the guard's module carve-out: signing a
--  contract fires quotes_contracts_plan_money, which files two expectations
--  under the quotes-OWNED 'events' category. A guard that rejected them would
--  not fail a test -- it would stop the business from being able to sign a
--  contract. The rule is asserted above with a synthetic insert; this asserts
--  the seam, through the trigger rather than by calling the planner directly
--  (which is correctly revoked from every client role).
--
--  Runs as the one owner surviving this phase's grant stripping (...0005):
--  plan_money_for_quote() gates on quotes.contracts whenever auth.uid() is set.
-- ---------------------------------------------------------------------
select pg_temp.become('aaaaaaaa-0000-0000-0000-000000000005');
do $$
declare q uuid;
begin
  -- created_by via auth.uid(), NOT a read of auth.users: `authenticated` has no
  -- select there, and such a join silently kills every later assertion
  insert into quotes.quotes
    (quote_number, issue_date, customer_name, final_price, deposit_pct, event_date, status, created_by)
  values ('LY-RLS-GUARD', current_date, 'rls-test', 10000, 30, current_date + 30, 'draft', auth.uid())
  returning id into q;
  insert into quotes.contracts (quote_id, contract_number, status)
  values (q, 'C-LY-RLS-GUARD', 'draft');
  update quotes.contracts set status = 'signed' where quote_id = q;   -- fires the trigger
end $$;
select pg_temp.assert_rows('quotes seam: signing a contract still plans BOTH expectations',
  $q$ select 1 from finance.expected e, quotes.quotes q
      where q.quote_number = 'LY-RLS-GUARD'
        and e.source_module = 'quotes' and e.category = 'events'
        and e.source_ref in (q.id::text || ':deposit', q.id::text || ':balance') $q$, 2);
-- behind the GUC: since 54's guard covers DELETE, a provenance-carrying
-- expectation cannot be deleted by a client, which is the point of the assertion
-- further down. Test cleanup is a posting-function-equivalent motion.
select set_config('levyam.finance_posting', 'on', true);
delete from finance.expected
 where source_module = 'quotes'
   and source_ref like (select id::text from quotes.quotes where quote_number = 'LY-RLS-GUARD') || ':%';
select set_config('levyam.finance_posting', '', true);
-- the quote and its now-SIGNED contract are deliberately left in place: a signed
-- contract is undeletable by design ("הסכם חתום הוא מסמך משפטי"), and this whole
-- suite runs inside one transaction that rolls back. Neither row is overdue, so
-- neither reaches the reconciliation assertions below.
-- become() switched the DB role; this phase must go back to postgres (it
-- bypasses RLS and calls internal functions), so reset the role, not just the
-- claim. seed_actor() alone leaves `role` = authenticated and the very next
-- fixture insert dies on an RLS with-check.
reset role;
select pg_temp.seed_actor();  -- back to the default actor

-- ---------------------------------------------------------------------
--  Per-module badge counts. Every drift item names the module RESPONSIBLE for
--  it, so the launcher badges that tile rather than lighting POS up with
--  problems POS cannot solve (an overdue deposit is not a POS failure).
--  The shell names no module: the DATA decides which tiles badge.
-- ---------------------------------------------------------------------
-- an expectation created by the quotes module, overdue -> quotes owns it.
-- Behind the GUC, because 'events' is quotes-owned and expected_guard() trusts
-- nothing else (the seam test above proves the real planner does the same).
select set_config('levyam.finance_posting', 'on', true);
insert into finance.expected
  (direction, category, amount, due_date, reason, status, source_module, source_ref)
values ('in', 'events', 4000, current_date - 20, 'deposit', 'open',
        'quotes', 'rls-test-quote:deposit');
select set_config('levyam.finance_posting', '', true);
-- a hand-created one belongs to nobody but finance. The reason carries an
-- rls-test marker so the assertion below identifies THIS row: run against a
-- tier that holds real data (staging, via the management API) a bare
-- 'supplier' also matches the real overdue supplier bill sitting there.
insert into finance.expected (direction, category, amount, due_date, reason, status)
values ('out', 'suppliers', 900, current_date - 5, 'rls-test supplier', 'open');
select pg_temp.assert_rows('badges: a quotes-sourced overdue expectation is owned by quotes',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'expected_id' = (select id::text from finance.expected
                                      where source_ref = 'rls-test-quote:deposit')
        and r.modules = array['quotes'] $q$, 1);
select pg_temp.assert_rows('badges: a hand-created expectation is owned by no module',
  $q$ select 1 from finance.reconciliation_items('2000-01-01') r
      where r.item->>'reason' = 'rls-test supplier' and r.modules = '{}'::text[] $q$, 1);
select pg_temp.assert_rows('badges: POS items are owned by pos',
  $q$ select 1 where not exists (
        select 1 from finance.reconciliation_items('2000-01-01') r
        where r.item->>'type' in ('unposted_day','recompute_drift','pinned')
          and r.modules <> array['pos']) $q$, 1);
-- the point of the whole change: POS must NOT be badged for finance problems
select pg_temp.assert_rows('badges: no overdue expectation is ever charged to pos',
  $q$ select 1 where not exists (
        select 1 from finance.reconciliation_items('2000-01-01') r
        where r.item->>'type' = 'overdue_expected' and 'pos' = any(r.modules)) $q$, 1);
select set_config('levyam.finance_posting', 'on', true);   -- provenance row, see above
delete from finance.expected where source_ref = 'rls-test-quote:deposit';
select set_config('levyam.finance_posting', '', true);
delete from finance.expected where reason = 'rls-test supplier';

-- unfreezing lets the day resume, and the correction still stands
delete from pos.day_pins where business_date = '2099-06-06';
select pos.post_day('2099-06-06'::date);
select pg_temp.assert_num('pin: unfreezing lets the withheld labor post',
  (select coalesce(sum(amount), 0) from finance.entries
   where source_ref like 'pos:2099-06-06:labor%'), 90);
select pg_temp.assert_num('pin: and the owner correction is still standing',
  (select coalesce(sum(amount), 0) from finance.entries
   where source_ref like '%pos:2099-06-06:cash%'), 350);

-- ---------------------------------------------------------------------
--  pos_bills auto-repost (48). Because post_day now reads revenue from
--  payment-less bills, mutating such a bill on a BOOKED day must re-post it:
--  a fallback/legacy close (INSERT) and a re-open (DELETE) both flow through
--  the new pos_bills triggers — no manual re-post, no silent drift.
-- ---------------------------------------------------------------------
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid)
values ('rls-arb-1', 991, 'paid', '2099-04-04 12:00+02', 100, 100, 0);
select pos.post_day('2099-04-04'::date);  -- book the day (cash 100)
select pg_temp.assert_num('pos_bills repost: first payment-less bill booked',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-04-04:cash%'), 100);
-- a SECOND payment-less bill lands on the already-booked day (fallback-close shape)
insert into pos.pos_bills (id, table_num, status, paid_at, grand_total, cash_paid, card_paid)
values ('rls-arb-2', 992, 'paid', '2099-04-04 12:00+02', 60, 0, 60);
select pg_temp.assert_num('pos_bills INSERT auto-reposts a booked day (card leg picked up)',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-04-04:card%'), 60);
select pg_temp.assert_num('pos_bills INSERT auto-repost: cash leg unchanged',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-04-04:cash%'), 100);
-- re-open = delete the bill row; the day must re-post and shed its revenue
delete from pos.pos_bills where id = 'rls-arb-1';
select pg_temp.assert_num('pos_bills DELETE (re-open) auto-reposts: cash leg shed',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-04-04:cash%'), 0);
select pg_temp.assert_num('pos_bills DELETE auto-repost: other bill''s card leg preserved',
  (select coalesce(sum(amount), 0) from finance.entries where source_ref like 'pos:2099-04-04:card%'), 60);

-- ---------------------------------------------------------------------
--  Last-admin guard + bootstrap bypass (staging-environment diff, 2026-07-28).
--  The guard blocks any statement that would leave zero users.manage holders.
--  The new bypass in core.guard_users_manage_survives() must stay INERT unless
--  levyam.bootstrap='on' — otherwise it would be a lockout/last-admin hole.
--  Run as postgres (reset role): session_user is 'postgres', not a data-API
--  role, so it exercises the flag branch. The session_user denylist itself
--  can't be tripped here — every runtime request connects through PostgREST as
--  'authenticator', which is denied — so that half is covered by construction.
--  `delete from core.user_roles` (wipe every role grant → zero admins) is the
--  cleanest trigger; assert_raises catches+rolls back the guarded attempts, and
--  the one allowed delete is wrapped in a savepoint.
-- ---------------------------------------------------------------------
reset role;
select pg_temp.assert_num('bootstrap flag is OFF by default (runtime state)',
  (case when current_setting('levyam.bootstrap', true) = 'on' then 1 else 0 end), 0);
select pg_temp.assert_raises('last-admin guard fires when bypass flag is off',
  $q$ delete from core.user_roles $q$, 'users.manage');

set levyam.bootstrap = 'on';
savepoint guard_bypass;
select pg_temp.assert_ok('bootstrap bypass permits the wipe only when flag is on',
  $q$ delete from core.user_roles $q$);
rollback to savepoint guard_bypass;
reset levyam.bootstrap;

select pg_temp.assert_raises('last-admin guard active again after the flag resets',
  $q$ delete from core.user_roles $q$, 'users.manage');

do $$ begin raise notice 'RLS MATRIX: ALL ASSERTIONS PASSED'; end $$;
rollback;
