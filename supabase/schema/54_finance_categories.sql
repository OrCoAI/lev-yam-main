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
