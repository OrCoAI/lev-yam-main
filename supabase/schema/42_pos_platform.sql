-- =====================================================================
--  Lev Yam platform — POS PLATFORM LAYER
--  Run in the Supabase SQL editor AFTER 40_events.sql (the event_id FK
--  below needs events.events). Then add `pos` under Settings → API →
--  Exposed schemas.
--
--  Design: docs/plans/pos-module.md. 10_pos.sql stays the LIVE tool's
--  schema — pos.html keeps working untouched through the parity trial.
--  This file is additive only:
--    * `pos` schema for platform-side functions (tables stay in `public`
--      until cut-over — the live tool writes them by name).
--    * pos_bills.event_id — attach a bill to a spine event (P&L).
--    * AUTHENTICATED RLS via core.has_permission() alongside the existing
--      anon policies (today's live posture; dropping anon = cut-over task).
--    * Permission checks inside the shared SECURITY DEFINER RPCs for
--      authenticated callers (anon = pos.html keeps today's behavior).
--    * pos.close_day(date) — the business-day posting rule: one finance
--      row per leg (cash/card income, food/labor expense), idempotent,
--      corrections posted as delta rows (never edits).
--    * Seeds: the 8 real pos.* permission keys (mirroring pos.html's
--      ROLE_PERMS) replacing the Phase-0 placeholders, granted per role.
-- =====================================================================

create schema if not exists pos;

-- ---------------------------------------------------------------------
--  1) Spine attachment: bills can belong to an event (optional)
-- ---------------------------------------------------------------------
alter table public.pos_bills add column if not exists event_id uuid references events.events(id);
create index if not exists pos_bills_event_idx on public.pos_bills (event_id)
  where event_id is not null;

-- ---------------------------------------------------------------------
--  2) RLS for platform users (anon policies from 10_pos.sql stay put)
--     view    → read the floor & bills
--     order   → work tables (open/edit/sync carts)
--     manage  → touch paid bills directly (archive, attach event)
--     costs_* → log expenses of that kind; manage may fix/delete
-- ---------------------------------------------------------------------
drop policy if exists "pos_tables_select_auth" on public.pos_tables;
drop policy if exists "pos_tables_write_auth"  on public.pos_tables;
-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "pos_tables_select_auth" on public.pos_tables for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy "pos_tables_write_auth" on public.pos_tables for all to authenticated
  using ((select core.has_permission('pos.order')))
  with check ((select core.has_permission('pos.order')));

drop policy if exists "pos_bills_select_auth" on public.pos_bills;
drop policy if exists "pos_bills_write_auth"  on public.pos_bills;
create policy "pos_bills_select_auth" on public.pos_bills for select to authenticated
  using ((select core.has_permission('pos.view')));
create policy "pos_bills_write_auth" on public.pos_bills for update to authenticated
  using ((select core.has_permission('pos.manage')))
  with check ((select core.has_permission('pos.manage')));

drop policy if exists "pos_bill_items_select_auth" on public.pos_bill_items;
create policy "pos_bill_items_select_auth" on public.pos_bill_items for select to authenticated
  using ((select core.has_permission('pos.view')));

drop policy if exists "pos_expenses_select_auth" on public.pos_expenses;
drop policy if exists "pos_expenses_insert_auth" on public.pos_expenses;
drop policy if exists "pos_expenses_write_auth"  on public.pos_expenses;
-- raw expense rows carry labor (payroll) amounts — reports-level only; the
-- ops view reads expenses through pos_day_report, which strips labor/money
create policy "pos_expenses_select_auth" on public.pos_expenses for select to authenticated
  using ((select core.has_permission('pos.reports')));
-- kind is 'food' | 'labor' → permission key 'pos.costs_food' / 'pos.costs_labor'
-- (references the row's kind column, so it stays a per-row eval by design)
create policy "pos_expenses_insert_auth" on public.pos_expenses for insert to authenticated
  with check (core.has_permission('pos.costs_' || kind));
create policy "pos_expenses_write_auth" on public.pos_expenses for delete to authenticated
  using ((select core.has_permission('pos.manage')));

grant select, insert, update, delete on public.pos_tables   to authenticated;
grant select, update                 on public.pos_bills    to authenticated;
grant select                         on public.pos_bill_items to authenticated;
grant select, insert, delete         on public.pos_expenses to authenticated;
-- NOTE: the v_sales_* views are deliberately NOT granted to authenticated —
-- they are plain (owner-rights) views over pos_bills and would bypass the
-- pos.reports money gate; the permission-aware pos_day_report RPC is the API.

-- ---------------------------------------------------------------------
--  3) The shared RPCs learn platform permissions.
--     Redefined (same signatures 10_pos.sql declares) with a guard that
--     only binds AUTHENTICATED callers — anon (pos.html + its in-app PIN)
--     keeps today's behavior until cut-over.
-- ---------------------------------------------------------------------
create or replace function pos.require(p_perm text)
returns void language plpgsql
set search_path = core, public as $$
begin
  if auth.role() = 'authenticated' and not core.has_permission(p_perm) then
    raise exception 'אין הרשאה (%)', p_perm;
  end if;
end; $$;

create or replace function public.pos_close_table(p_bill jsonb, p_items jsonb)
returns void language plpgsql security definer set search_path = public, pos as $$
declare
  v_id       text    := p_bill->>'id';
  v_oh       numeric := coalesce((p_bill->>'oh_charge')::numeric, 0);
  v_extras   numeric := coalesce((p_bill->>'extras_total')::numeric, 0);
  v_discount numeric := coalesce((p_bill->>'discount')::numeric, 0);
  v_grand    numeric := coalesce((p_bill->>'grand_total')::numeric, 0);
  v_tip      numeric := coalesce((p_bill->>'tip')::numeric, 0);
  v_cash     numeric := coalesce((p_bill->>'cash_paid')::numeric, 0);
  v_card     numeric := coalesce((p_bill->>'card_paid')::numeric, 0);
begin
  perform pos.require('pos.order');
  -- plan invariant #1, enforced where the money lands: totals must be
  -- internally consistent (these bills feed pos.close_day → finance)
  if v_grand <> v_oh + v_extras - v_discount then
    raise exception 'חשבון לא עקבי: סה״כ (%) שונה מ-בית פתוח (%) + תוספות (%) − הנחה (%)', v_grand, v_oh, v_extras, v_discount;
  end if;
  if v_cash + v_card <> v_grand + v_tip then
    raise exception 'חשבון לא עקבי: מזומן + אשראי (%) שונה מסה״כ + טיפ (%)', v_cash + v_card, v_grand + v_tip;
  end if;
  insert into public.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, discount, grand_total, tip, cash_paid, card_paid, items
  ) values (
    v_id,
    (p_bill->>'table_num')::int, p_bill->>'name',
    coalesce(p_bill->>'status','paid'), p_bill->>'closed_by',
    coalesce((p_bill->>'guests_adults')::int,0),
    coalesce((p_bill->>'guests_children')::int,0),
    coalesce(p_bill->>'pricing_mode','open_house'),
    (p_bill->>'opened_at')::timestamptz,
    coalesce((p_bill->>'paid_at')::timestamptz, now()),
    coalesce((p_bill->>'items_count')::int,0),
    coalesce((p_bill->>'oh_charge')::numeric,0),
    coalesce((p_bill->>'extras_total')::numeric,0),
    coalesce((p_bill->>'menu_value')::numeric,0),
    coalesce((p_bill->>'discount')::numeric,0),
    coalesce((p_bill->>'grand_total')::numeric,0),
    coalesce((p_bill->>'tip')::numeric,0),
    coalesce((p_bill->>'cash_paid')::numeric,0),
    coalesce((p_bill->>'card_paid')::numeric,0),
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
    discount=excluded.discount, tip=excluded.tip,
    grand_total=excluded.grand_total, items=excluded.items;

  delete from public.pos_bill_items where bill_id = v_id;
  insert into public.pos_bill_items
    (bill_id, table_num, paid_at, item_name, category, is_open_house, is_custom, unit_price, qty)
  select v_id, (p_bill->>'table_num')::int,
         coalesce((p_bill->>'paid_at')::timestamptz, now()),
         it->>'item_name', it->>'category',
         coalesce((it->>'is_open_house')::boolean,false),
         coalesce((it->>'is_custom')::boolean,false),
         coalesce((it->>'unit_price')::numeric,0),
         coalesce((it->>'qty')::int,0)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) as it;

  delete from public.pos_tables where id = v_id;
end; $$;

create or replace function public.pos_reopen_bill(p_id text, p_num int)
returns void language plpgsql security definer set search_path = public, pos as $$
begin
  perform pos.require('pos.order');
  insert into public.pos_tables (id, num, name, guests_adults, guests_children, pricing_mode, opened_at, items)
  select b.id, p_num, b.name, b.guests_adults, b.guests_children, b.pricing_mode, b.opened_at, b.items
  from public.pos_bills b where b.id = p_id;
  delete from public.pos_bills where id = p_id;
end; $$;

create or replace function public.pos_mark_item(p_id text, p_item_id text, p_ready boolean)
returns void language plpgsql security definer set search_path = public, pos as $$
begin
  perform pos.require('pos.kitchen');
  update public.pos_tables t
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

-- Day report: authenticated callers without pos.reports get the OPS view —
-- money fields stripped IN THE DB (revenue/cash/card/tips/discounts/avg_bill
-- + labor). Anon (pos.html) keeps the full payload; its manager password
-- gates client-side, today's live behavior.
create or replace function public.pos_day_report(p_date date)
returns jsonb language plpgsql security definer set search_path = public, pos, core as $$
declare
  rep jsonb;
begin
  perform pos.require('pos.analytics');
  select jsonb_build_object(
    'date', p_date,
    'summary', (select jsonb_build_object(
        'bills',     count(*),
        'covers',    coalesce(sum(headcount), 0),
        'revenue',   coalesce(sum(grand_total), 0),
        'cash',      coalesce(sum(cash_paid), 0),
        'card',      coalesce(sum(card_paid), 0),
        'tips',      coalesce(sum(tip), 0),
        'discounts', coalesce(sum(discount), 0),
        'avg_bill',  coalesce(round(avg(grand_total), 0), 0),
        'avg_minutes', coalesce(round(avg(duration_minutes), 0), 0)
      ) from public.pos_bills
      where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date = p_date),
    'food',  (select coalesce(sum(amount), 0) from public.pos_expenses where business_date = p_date and kind = 'food'),
    'labor', (select coalesce(sum(amount), 0) from public.pos_expenses where business_date = p_date and kind = 'labor'),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', item_name, 'category', category, 'units', units, 'value', menu_value))
             from (select item_name, category, sum(qty) as units, sum(line_total) as menu_value
                   from public.pos_bill_items
                   where (paid_at at time zone 'Asia/Jerusalem')::date = p_date
                   group by item_name, category order by sum(qty) desc) itm), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object(
               'id', id, 'kind', kind, 'amount', amount, 'note', note, 'by', created_by, 'at', created_at)
               order by created_at)
             from public.pos_expenses where business_date = p_date), '[]'::jsonb)
  ) into rep;

  if auth.role() = 'authenticated' and not core.has_permission('pos.reports') then
    -- ops view is an ALLOWLIST: money fields never materialize for non-reports
    -- callers, so a summary field added later is private by default
    rep = jsonb_set(rep, '{summary}', jsonb_build_object(
      'bills',       rep #> '{summary,bills}',
      'covers',      rep #> '{summary,covers}',
      'avg_minutes', rep #> '{summary,avg_minutes}'));
    rep = rep - 'labor';
    rep = jsonb_set(rep, '{expenses}', coalesce(
      (select jsonb_agg(e) from jsonb_array_elements(rep->'expenses') e where e->>'kind' <> 'labor'),
      '[]'::jsonb));
    if not core.has_permission('pos.costs_food') then
      rep = rep - 'food';
      rep = jsonb_set(rep, '{expenses}', '[]'::jsonb);
    end if;
  end if;
  return rep;
end; $$;

-- ---------------------------------------------------------------------
--  4) pos.close_day — the business day posts to finance (docs §3b/§5).
--     One row per leg: income 'pos' cash / card (method inside source_ref
--     — the posting unique index has no payment_method), expenses
--     'pos_food' / 'pos_labor'. Idempotent: re-running an unchanged day
--     posts nothing. A changed day (late void, added expense) posts a
--     DELTA row 'pos:<date>:<leg>:rN' — derived rows are never edited.
--     Card income posts under payment_method 'grow' (the card terminal).
-- ---------------------------------------------------------------------
create or replace function pos.close_day(p_date date)
returns jsonb
language plpgsql security definer
set search_path = pos, public, finance, core as $$
declare
  v_cash  numeric; v_card numeric; v_food numeric; v_labor numeric;
  leg record;
  posted jsonb := '[]'::jsonb;
  v_current numeric; v_n int; v_delta numeric; v_ref text; v_entry uuid;
begin
  if not core.has_permission('pos.manage') then
    raise exception 'אין הרשאה (pos.manage)';
  end if;

  -- Income = grand_total per bill (net of discount, BEFORE tip — tips never
  -- post). Per-bill split: the card leg is capped at the bill's revenue
  -- (card overpayment = card tip), the cash leg is the remainder — so
  -- cash + card = revenue exactly, both legs non-negative.
  select coalesce(sum(least(card_paid, grand_total)), 0),
         coalesce(sum(grand_total - least(card_paid, grand_total)), 0)
    into v_card, v_cash
  from public.pos_bills
  where status = 'paid' and (paid_at at time zone 'Asia/Jerusalem')::date = p_date;

  select coalesce(sum(amount) filter (where kind = 'food'), 0),
         coalesce(sum(amount) filter (where kind = 'labor'), 0)
    into v_food, v_labor
  from public.pos_expenses where business_date = p_date;

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

grant usage on schema pos to authenticated;
grant execute on function pos.close_day(date) to authenticated;
grant execute on function public.pos_close_table(jsonb, jsonb) to authenticated;
grant execute on function public.pos_reopen_bill(text, int)    to authenticated;
grant execute on function public.pos_mark_item(text, text, bool) to authenticated;
grant execute on function public.pos_day_report(date)          to authenticated;

-- ---------------------------------------------------------------------
--  SEED DATA — moved to 45_pos_seeds.sql (2026-07-15). This file targets
--  pre-cutover public.pos_* tables and cannot run on a post-43 database,
--  so the seeds (module row, permission keys, role grants) live in their
--  own always-runnable file. On a FRESH replay, run 45 after this file.
-- ---------------------------------------------------------------------
