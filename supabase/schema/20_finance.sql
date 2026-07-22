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

  constraint finance_entries_kind_check check (kind in ('income','expense')),
  constraint finance_entries_category_check check (
    (kind = 'expense' and category in
      ('equipment','inventory','maintenance','marketing','salaries','or_prati','nimer','suppliers'))
    or
    (kind = 'income' and category in
      ('events','bookings','makrer','other'))
  )
);

-- Idempotent add for databases created before payment_method existed.
alter table finance.entries add column if not exists payment_method text;
do $$ begin
  alter table finance.entries add constraint finance_entries_payment_check
    check (payment_method is null or payment_method in ('cash','private','grow','bank'));
exception when duplicate_object then null; end $$;

-- Idempotent replace: category taxonomy updated to the venue's real categories
-- (was a placeholder set: rent/utilities/insurance/... — never matched real usage).
-- NOT VALID so it doesn't choke re-running this on a live DB that already has
-- rows under the old category names; it still applies to every new insert/update.
alter table finance.entries drop constraint if exists finance_entries_category_check;
alter table finance.entries add constraint finance_entries_category_check check (
  (kind = 'expense' and category in
    ('equipment','inventory','maintenance','marketing','salaries','or_prati','nimer','suppliers'))
  or
  (kind = 'income' and category in
    ('events','bookings','makrer','other'))
) not valid;

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
