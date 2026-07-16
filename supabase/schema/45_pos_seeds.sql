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
