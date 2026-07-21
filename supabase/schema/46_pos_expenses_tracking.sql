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
