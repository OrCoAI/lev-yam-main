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
