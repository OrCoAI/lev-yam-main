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
-- ...and the same default-privilege leftovers for `authenticated`. These tables
-- were born in `public`, where Supabase's default privileges grant ALL to
-- anon/authenticated, and ACLs travel with the object through the `set schema`
-- above. 44_initplan_sweep.sql:64 already cleared exactly these leftovers off
-- the four v_sales_* VIEWS on 2026-07-15 — the TABLES twin was missed, and
-- that is why this survived: TRUNCATE is NOT governed by RLS, so every policy
-- below was bypassable and any signed-in staff account could wipe the billing
-- history in one statement. Found live on prod + staging by
-- supabase/tests/audit-grants.mjs 2026-08-12, revoked on both the same day.
-- The privileges the app actually uses are granted in 42_pos_platform.sql.
revoke truncate, trigger, references
  on pos.pos_tables, pos.pos_bills, pos.pos_bill_items, pos.pos_expenses from authenticated;
-- MAINTAIN is PG17+. Every tier is on 17 today (config.toml pins major_version 17;
-- both cloud projects reported 17.6 on 2026-08-12), but naming it unguarded would
-- make this whole file a syntax error on an older or restored instance — which
-- would abort the migration and leave TRUNCATE granted. Failing open on the
-- privilege is the one outcome this statement exists to prevent, so it is guarded.
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on pos.pos_tables, pos.pos_bills, pos.pos_bill_items, pos.pos_expenses from authenticated';
  end if;
end $$;

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
-- revoke-before-grant on every function: Postgres grants EXECUTE to PUBLIC (which
-- includes anon) on creation, so a bare grant leaves an anon path into pos.* —
-- the very thing this cut-over closed at the table level. Found live on prod AND
-- staging by supabase/tests/audit-grants.mjs on 2026-08-12, fixed on both.
revoke all on function pos.pos_reopen_bill(text, int)      from public;
revoke all on function pos.pos_mark_item(text, text, bool) from public;
revoke all on function pos.pos_day_report(date)            from public;
revoke all on function pos.range_report(date, date)        from public;
grant execute on function pos.pos_close_table(jsonb, jsonb)   to authenticated;
grant execute on function pos.pos_reopen_bill(text, int)      to authenticated;
grant execute on function pos.pos_mark_item(text, text, bool) to authenticated;
grant execute on function pos.pos_day_report(date)            to authenticated;
grant execute on function pos.range_report(date, date)        to authenticated;
grant execute on function pos.close_day(date)                 to authenticated;
-- Internal helpers — reached only through the definer functions above, but kept
-- executable by `authenticated` so no indirect non-definer call path can break.
revoke all on function pos.require(text)                from public;
grant execute on function pos.require(text)             to authenticated;
revoke all on function pos.oh_charge(integer, integer)  from public;
grant execute on function pos.oh_charge(integer, integer) to authenticated;
revoke all on function pos.report_for_range(date, date) from public;
grant execute on function pos.report_for_range(date, date) to authenticated;
