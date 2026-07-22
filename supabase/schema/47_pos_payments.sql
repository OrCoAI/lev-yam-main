-- =====================================================================
--  47_pos_payments.sql — POS split / partial payments + attributed
--  discounts + checkout item voids.  (PR C of POS operations v2)
--
--    1) pos.pos_payments      — money taken against a bill, over time
--    2) pos.pos_item_voids    — audit trail for items removed at checkout
--    3) pos_bills.discount_kind / discount_reason — every discount is attributed
--    4) RPCs: add / edit / void a payment, void an item, read open payments
--    5) pos_close_table  — derives cash/card FROM payments (no longer trusts
--       the client), allocates the tip across payments, and refuses to close
--       a discounted bill that has no attribution
--    6) pos.close_day    — cash/card legs now come from payments taken THAT
--       DAY (so the drawer reconciles daily), net of the tip portion
--
--  Re-runnable; apply in the Supabase SQL editor after 43/45/46.
--  Plan: docs/plans/pos-split-payments.md
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Tables
-- ---------------------------------------------------------------------
-- bill_id is pos_tables.id while the bill is open and the same id on
-- pos_bills once closed, so payments survive the close and a re-open.
-- No FK: the bill row does not exist yet while the table is open.
create table if not exists pos.pos_payments (
  id       bigint generated always as identity primary key,
  bill_id  text    not null,
  method   text    not null check (method in ('cash', 'card')),
  amount   numeric not null check (amount > 0),
  tip_part numeric not null default 0 check (tip_part >= 0),  -- portion that is tip, not revenue
  note     text,
  taken_by text,                                              -- stamped from the JWT
  taken_at timestamptz not null default now(),
  constraint pos_payments_tip_le_amount check (tip_part <= amount)
);
create index if not exists pos_payments_bill_idx  on pos.pos_payments (bill_id);
create index if not exists pos_payments_taken_idx on pos.pos_payments (taken_at);

create table if not exists pos.pos_item_voids (
  id         bigint generated always as identity primary key,
  bill_id    text    not null,
  item_name  text    not null,
  qty        numeric not null,
  unit_price numeric not null default 0,
  was_fired  boolean not null default false,  -- kitchen had already been sent it
  reason     text,
  voided_by  text,
  voided_at  timestamptz not null default now()
);
create index if not exists pos_item_voids_bill_idx on pos.pos_item_voids (bill_id);

-- Locked down: RLS on, NO policies and NO grants. Every read and write goes
-- through the security-definer RPCs below, which check permissions themselves.
alter table pos.pos_payments   enable row level security;
alter table pos.pos_item_voids enable row level security;
revoke all on pos.pos_payments, pos.pos_item_voids from anon, authenticated;

-- ---------------------------------------------------------------------
--  2) Discount attribution on the bill
-- ---------------------------------------------------------------------
alter table pos.pos_bills add column if not exists discount_kind   text;
alter table pos.pos_bills add column if not exists discount_reason text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pos_bills_discount_kind_chk') then
    alter table pos.pos_bills add constraint pos_bills_discount_kind_chk
      check (discount_kind is null
             or discount_kind in ('family_friends', 'staff', 'service', 'other'));
  end if;
end $$;

-- ---------------------------------------------------------------------
--  3) Payment RPCs
-- ---------------------------------------------------------------------
-- A bill is "open" while its row still exists in pos_tables. Payments may only
-- be edited/voided while open — changing a closed bill's money requires an
-- explicit re-open, so booked money never changes silently.
create or replace function pos.bill_is_open(p_bill_id text)
returns boolean language sql stable set search_path = pos as $$
  select exists (select 1 from pos.pos_tables where id = p_bill_id);
$$;

-- Taking money is floor work: whoever may run a table may record a payment.
create or replace function pos.add_payment(p_bill_id text, p_method text, p_amount numeric, p_note text default null)
returns bigint language plpgsql security definer set search_path = pos, core, public as $$
declare v_id bigint;
begin
  perform pos.require('pos.order');
  -- payments may only be added to an OPEN table; a standalone add against a
  -- closed bill would still be counted by post_day (which sums by taken_at,
  -- not bill status) — an off-books drawer entry. Closing records its own
  -- payment inside pos_close_table while the table row still exists.
  if not pos.bill_is_open(p_bill_id) then
    raise exception 'החשבון סגור — לא ניתן להוסיף תשלום';
  end if;
  if p_amount is null or p_amount <= 0    then raise exception 'סכום לא תקין'; end if;
  if p_method not in ('cash', 'card')     then raise exception 'אמצעי תשלום לא תקין'; end if;
  insert into pos.pos_payments (bill_id, method, amount, note, taken_by)
  values (p_bill_id, p_method, p_amount, nullif(btrim(p_note), ''),
          coalesce(auth.jwt()->>'email', 'לא ידוע'))
  returning id into v_id;
  return v_id;
end; $$;

create or replace function pos.edit_payment(p_id bigint, p_method text, p_amount numeric, p_note text default null)
returns void language plpgsql security definer set search_path = pos, core, public as $$
declare v_bill text;
begin
  perform pos.require('pos.manage');
  select bill_id into v_bill from pos.pos_payments where id = p_id;
  if v_bill is null then raise exception 'תשלום לא נמצא'; end if;
  if not pos.bill_is_open(v_bill) then
    raise exception 'החשבון סגור — יש לפתוח אותו מחדש כדי לשנות תשלומים';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'סכום לא תקין'; end if;
  if p_method not in ('cash', 'card')  then raise exception 'אמצעי תשלום לא תקין'; end if;
  update pos.pos_payments
     set method = p_method, amount = p_amount, note = nullif(btrim(p_note), '')
   where id = p_id;
end; $$;

create or replace function pos.void_payment(p_id bigint)
returns void language plpgsql security definer set search_path = pos, core, public as $$
declare v_bill text;
begin
  perform pos.require('pos.manage');
  select bill_id into v_bill from pos.pos_payments where id = p_id;
  if v_bill is null then raise exception 'תשלום לא נמצא'; end if;
  if not pos.bill_is_open(v_bill) then
    raise exception 'החשבון סגור — יש לפתוח אותו מחדש כדי לשנות תשלומים';
  end if;
  delete from pos.pos_payments where id = p_id;
end; $$;

-- Removing an item the kitchen already cooked destroys an incurred cost, so it
-- needs a manager; removing something never sent is ordinary floor correction.
create or replace function pos.void_item(
  p_bill_id text, p_name text, p_qty numeric,
  p_unit_price numeric, p_was_fired boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = pos, core, public as $$
begin
  if coalesce(p_was_fired, false) then
    perform pos.require('pos.manage');
  else
    perform pos.require('pos.order');
  end if;
  insert into pos.pos_item_voids (bill_id, item_name, qty, unit_price, was_fired, reason, voided_by)
  values (p_bill_id, p_name, coalesce(p_qty, 0), coalesce(p_unit_price, 0),
          coalesce(p_was_fired, false), nullif(btrim(p_reason), ''),
          coalesce(auth.jwt()->>'email', 'לא ידוע'));
end; $$;

-- Payments for every currently-open table, keyed by bill_id — one round trip
-- for the floor grid and the table view's balance-due.
create or replace function pos.open_payments()
returns jsonb language plpgsql security definer set search_path = pos, core as $$
begin
  perform pos.require('pos.order');
  return coalesce((
    select jsonb_object_agg(bill_id, arr) from (
      select p.bill_id, jsonb_agg(jsonb_build_object(
               'id', p.id, 'method', p.method, 'amount', p.amount,
               'note', p.note, 'by', p.taken_by, 'at', p.taken_at)
             order by p.taken_at, p.id) as arr
      from pos.pos_payments p
      join pos.pos_tables t on t.id = p.bill_id
      group by p.bill_id) x), '{}'::jsonb);
end; $$;

-- ---------------------------------------------------------------------
--  4) pos_close_table — supersedes the 43 version.
--     * p_payments records the closing payment(s) atomically — an array of
--       {method, amount, note}, so a split cash+card close is one tx with
--       any partial payments already taken while the table was open
--     * cash/card are DERIVED from pos_payments (client values ignored)
--     * the bill's tip is allocated across payments, newest first, so
--       close_day can post revenue net of tips
--     * a discount must carry an attribution
--     Everything else (price validation, OH charge, extras cross-check,
--     internal consistency) is unchanged from 43.
-- ---------------------------------------------------------------------
-- the 2-arg signature must go, or a 2-arg call becomes ambiguous against the
-- new 3-arg default-bearing one; drop the 3-arg too so re-running this file can
-- rename the third parameter (p_payment → p_payments) via create-or-replace
drop function if exists pos.pos_close_table(jsonb, jsonb);
drop function if exists pos.pos_close_table(jsonb, jsonb, jsonb);

create or replace function pos.pos_close_table(p_bill jsonb, p_items jsonb, p_payments jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = pos, public as $$
declare
  v_id       text    := p_bill->>'id';
  v_oh       numeric := coalesce((p_bill->>'oh_charge')::numeric, 0);
  v_extras   numeric := coalesce((p_bill->>'extras_total')::numeric, 0);
  v_discount numeric := coalesce((p_bill->>'discount')::numeric, 0);
  v_grand    numeric := coalesce((p_bill->>'grand_total')::numeric, 0);
  v_tip      numeric := coalesce((p_bill->>'tip')::numeric, 0);
  v_kind     text    := nullif(btrim(p_bill->>'discount_kind'), '');
  v_reason   text    := nullif(btrim(p_bill->>'discount_reason'), '');
  v_adults   int     := coalesce((p_bill->>'guests_adults')::int, 0);
  v_children int     := coalesce((p_bill->>'guests_children')::int, 0);
  v_cash     numeric;
  v_card     numeric;
  v_pcount   int;
  v_left     numeric;
  v_computed_extras numeric;
  r          record;
begin
  perform pos.require('pos.order');

  -- every discount is attributed — enforced here, not just in the UI, because
  -- "nothing from the side" is only true if the database refuses the alternative
  if v_discount > 0 then
    if v_kind is null then
      raise exception 'יש לציין את סיבת ההנחה';
    end if;
    if v_kind = 'other' and v_reason is null then
      raise exception 'יש לפרט את סיבת ההנחה';
    end if;
  end if;

  -- server-side price validation: any non-custom line must match the menu
  -- price mirror; custom items are the deliberate no-price-check escape hatch
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
    cross join lateral (select pos.menu_price(it->>'item_name') as price) m
    where not coalesce((it->>'is_custom')::boolean, false)
      and m.price is not null
      and m.price <> coalesce((it->>'unit_price')::numeric, 0)
  ) then
    raise exception 'מחיר פריט אינו תואם לתפריט';
  end if;

  if coalesce(p_bill->>'pricing_mode', 'open_house') = 'open_house'
     and v_oh <> pos.oh_charge(v_adults, v_children) then
    raise exception 'סכום בית פתוח (%) אינו תואם למספר הסועדים', v_oh;
  end if;

  select coalesce(sum(coalesce((it->>'qty')::int, 0) * coalesce((it->>'unit_price')::numeric, 0)), 0)
    into v_computed_extras
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) it
  where coalesce(p_bill->>'pricing_mode', 'open_house') <> 'open_house'
     or not coalesce((it->>'is_open_house')::boolean, false);

  if v_extras <> v_computed_extras then
    raise exception 'סכום התוספות (%) אינו תואם לפריטים שהוזמנו (%)', v_extras, v_computed_extras;
  end if;

  if v_grand <> v_oh + v_extras - v_discount then
    raise exception 'חשבון לא עקבי: סה״כ (%) שונה מ-בית פתוח (%) + תוספות (%) − הנחה (%)', v_grand, v_oh, v_extras, v_discount;
  end if;

  -- record the closing payment(s) before deriving — one row per array entry
  insert into pos.pos_payments (bill_id, method, amount, note, taken_by)
  select v_id,
         coalesce(pmt->>'method', 'cash'),
         (pmt->>'amount')::numeric,
         nullif(btrim(pmt->>'note'), ''),
         coalesce(auth.jwt()->>'email', 'לא ידוע')
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) pmt
  where coalesce((pmt->>'amount')::numeric, 0) > 0
    and coalesce(pmt->>'method', 'cash') in ('cash', 'card');

  -- allocate the bill's tip across its payments, newest first, so that
  -- (amount - tip_part) is exactly the revenue collected by each payment
  update pos.pos_payments set tip_part = 0 where bill_id = v_id;
  v_left := v_tip;
  for r in select id, amount from pos.pos_payments
            where bill_id = v_id order by taken_at desc, id desc loop
    exit when v_left <= 0;
    update pos.pos_payments set tip_part = least(v_left, r.amount) where id = r.id;
    v_left := v_left - least(v_left, r.amount);
  end loop;

  -- cash/card come from the recorded payments — the client no longer gets to
  -- assert what was collected. BACKWARD COMPAT: a legacy client (pre-split-
  -- payments) records no payments and instead sends cash_paid/card_paid in the
  -- payload; when there are zero recorded payments, trust those so the deployed
  -- POS keeps closing tables until the new client ships.
  select coalesce(sum(amount) filter (where method = 'cash'), 0),
         coalesce(sum(amount) filter (where method = 'card'), 0),
         count(*)
    into v_cash, v_card, v_pcount
  from pos.pos_payments where bill_id = v_id;

  if v_pcount = 0 then
    v_cash := coalesce((p_bill->>'cash_paid')::numeric, 0);
    v_card := coalesce((p_bill->>'card_paid')::numeric, 0);
  end if;

  if v_cash + v_card <> v_grand + v_tip then
    raise exception 'חשבון לא עקבי: תשלומים שנרשמו (%) שונים מסה״כ + טיפ (%)', v_cash + v_card, v_grand + v_tip;
  end if;

  insert into pos.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, discount, discount_kind, discount_reason,
    grand_total, tip, cash_paid, card_paid, items
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
    v_discount, v_kind, v_reason,
    v_grand, v_tip, v_cash, v_card,
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
    discount=excluded.discount, discount_kind=excluded.discount_kind,
    discount_reason=excluded.discount_reason, tip=excluded.tip,
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

-- ---------------------------------------------------------------------
--  5) close_day — cash/card now derived from payments taken THAT DAY
--     (net of the tip portion) instead of from bills closed that day, so
--     a deposit taken Monday counts on Monday and the drawer reconciles.
--     Split in two: pos.post_day() holds the posting logic with no
--     permission check (PR E's automatic re-post calls it), and
--     pos.close_day() is the thin permission-checked manual entry point.
-- ---------------------------------------------------------------------
create or replace function pos.post_day(p_date date)
returns jsonb language plpgsql security definer
set search_path = pos, finance, core as $$
declare
  v_cash  numeric; v_card numeric; v_food numeric; v_labor numeric;
  leg record;
  posted jsonb := '[]'::jsonb;
  v_current numeric; v_n int; v_delta numeric; v_ref text; v_entry uuid;
begin
  select coalesce(sum(amount - tip_part) filter (where method = 'cash'), 0),
         coalesce(sum(amount - tip_part) filter (where method = 'card'), 0)
    into v_cash, v_card
  from pos.pos_payments
  where (taken_at at time zone 'Asia/Jerusalem')::date = p_date;

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

create or replace function pos.close_day(p_date date)
returns jsonb language plpgsql security definer set search_path = pos, core as $$
begin
  perform pos.require('pos.manage');
  return pos.post_day(p_date);
end; $$;

-- ---------------------------------------------------------------------
--  5b) report_for_range — supersedes the 46 version, adding a discount
--      breakdown by attribution (family & friends visible as its own
--      number). Reports-permission only; stripped for ops callers. Kept
--      here (not 46) because it references discount_kind, added above.
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
    -- discounts broken out by attribution — governance visibility
    'discounts_by_kind', case when v_reports then (
        select coalesce(jsonb_object_agg(k, s), '{}'::jsonb) from (
          select coalesce(discount_kind, 'unattributed') as k, sum(discount) as s
          from pos.pos_bills
          where status = 'paid' and coalesce(discount, 0) > 0
            and (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to
          group by 1) d) end,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', item_name, 'category', category, 'units', units, 'value', menu_value))
             from (select item_name, category, sum(qty) as units, sum(line_total) as menu_value
                   from pos.pos_bill_items
                   where (paid_at at time zone 'Asia/Jerusalem')::date between p_from and p_to
                   group by item_name, category order by sum(qty) desc) itm), '[]'::jsonb),
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
  if not v_reports then rep = rep - 'labor' - 'discounts_by_kind'; end if;
  return rep;
end; $$;

-- ---------------------------------------------------------------------
--  6) Grants — functions are EXECUTE-to-PUBLIC by default; revoke first,
--     then grant only to authenticated (see PR B: this bit us once).
--     post_day is internal: no role may call it directly.
-- ---------------------------------------------------------------------
revoke all on function pos.bill_is_open(text)                                   from public, anon;
revoke all on function pos.add_payment(text, text, numeric, text)               from public, anon;
revoke all on function pos.edit_payment(bigint, text, numeric, text)            from public, anon;
revoke all on function pos.void_payment(bigint)                                 from public, anon;
revoke all on function pos.void_item(text, text, numeric, numeric, boolean, text) from public, anon;
revoke all on function pos.open_payments()                                      from public, anon;
revoke all on function pos.pos_close_table(jsonb, jsonb, jsonb)                 from public, anon;
revoke all on function pos.post_day(date)                                       from public, anon, authenticated;
revoke all on function pos.close_day(date)                                      from public, anon;

grant execute on function pos.add_payment(text, text, numeric, text)               to authenticated;
grant execute on function pos.edit_payment(bigint, text, numeric, text)            to authenticated;
grant execute on function pos.void_payment(bigint)                                 to authenticated;
grant execute on function pos.void_item(text, text, numeric, numeric, boolean, text) to authenticated;
grant execute on function pos.open_payments()                                      to authenticated;
grant execute on function pos.pos_close_table(jsonb, jsonb, jsonb)                 to authenticated;
grant execute on function pos.close_day(date)                                      to authenticated;
