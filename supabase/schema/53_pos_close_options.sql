-- =====================================================================
--  53_pos_close_options.sql — option-aware price validation on close (PR 2b)
--
--  With per-item options (52), a line's unit_price is base + Σ option deltas, so
--  the close path can no longer validate `unit_price == menu_price(name)`. This
--  file adds:
--    * pos.option_charge(option_id, qty) — the effective charge of one selected
--      option (count kind: only units beyond `included` are charged);
--    * pos.assert_line_prices(p_items) — validates every non-custom line's
--      unit_price against base + its options, rejecting unknown option ids
--      (tampering) and price mismatches;
--  and redefines pos.pos_close_table to call assert_line_prices in place of the
--  old inline base-only check. The rest of the function is byte-identical to
--  47_pos_payments.sql (money path unchanged).
--
--  Plan: docs/plans/pos-menu-kitchen.md.
-- =====================================================================

-- Effective charge of one selected option. NULL if the id is unknown — an
-- unknown option on a line is tampering, which assert_line_prices rejects.
create or replace function pos.option_charge(p_id text, p_qty int)
returns numeric language sql stable set search_path = pos as $$
  select case g.kind
    when 'count' then greatest(0, coalesce(p_qty, 0) - g.included) * o.price_delta
    else o.price_delta   -- choice / add: one delta per selection
  end
  from pos.menu_options o
  join pos.menu_option_groups g on g.id = o.group_id
  where o.id = p_id
$$;
revoke all on function pos.option_charge(text, int) from public, anon, authenticated;

-- Server-side price guard: each non-custom line's unit_price must equal its base
-- menu price plus the charges of its selected options. Custom items and items not
-- on the menu (menu_price NULL) stay the deliberate no-check escape hatch.
create or replace function pos.assert_line_prices(p_items jsonb)
returns void language plpgsql stable set search_path = pos as $$
declare
  it     jsonb;
  v_base numeric;
  v_opts numeric;
begin
  for it in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce((it->>'is_custom')::boolean, false) then continue; end if;
    v_base := pos.menu_price(it->>'item_name');
    if v_base is null then continue; end if;
    -- reject any selected option whose id isn't in the menu (tampered price)
    if exists (
      select 1 from jsonb_array_elements(coalesce(it->'options', '[]'::jsonb)) o
      where pos.option_charge(o->>'id', coalesce((o->>'qty')::int, 1)) is null
    ) then
      raise exception 'תוספת לא מוכרת בפריט %', it->>'item_name';
    end if;
    select coalesce(sum(pos.option_charge(o->>'id', coalesce((o->>'qty')::int, 1))), 0)
      into v_opts
    from jsonb_array_elements(coalesce(it->'options', '[]'::jsonb)) o;
    if v_base + v_opts <> coalesce((it->>'unit_price')::numeric, 0) then
      raise exception 'מחיר פריט אינו תואם לתפריט (%)', it->>'item_name';
    end if;
  end loop;
end; $$;
revoke all on function pos.assert_line_prices(jsonb) from public, anon, authenticated;

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
  -- this close writes several payment rows + tip_part updates; suppress the
  -- per-row auto re-post (48) so they don't each fire — we re-post once at the
  -- end instead. No-op until 48 is applied.
  perform set_config('levyam.suppress_repost', 'on', true);

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

  -- server-side price validation: each non-custom line's unit_price must equal
  -- its base menu price plus its selected options' charges (52/53). Custom items
  -- and off-menu items stay the deliberate no-price-check escape hatch.
  perform pos.assert_line_prices(p_items);

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

  -- Re-post every already-booked day this bill touches. Usually that's just
  -- today (a no-op — today isn't booked yet). But a reopened past bill can carry
  -- payments on a past, booked day, and the tip_part reallocation above
  -- (suppressed, so it didn't fire the row trigger) changed their revenue. The
  -- bill's own paid_at day is included too: a legacy/fallback close records NO
  -- payment rows (post_day reads its revenue straight off the bill, 47), and the
  -- pos_bills insert was suppressed with everything else — so without paid_at
  -- here a fallback close onto a booked day would never re-post. repost_if_posted
  -- is defined in 48; the reference resolves at call time. Then lift the suppress.
  for r in
    select distinct d from (
      select (taken_at at time zone 'Asia/Jerusalem')::date as d
      from pos.pos_payments where bill_id = v_id
      union
      select (coalesce((p_bill->>'paid_at')::timestamptz, now()) at time zone 'Asia/Jerusalem')::date
    ) days loop
    perform pos.repost_if_posted(r.d);
  end loop;
  perform set_config('levyam.suppress_repost', '', true);
end; $$;
