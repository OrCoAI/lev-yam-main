-- =====================================================================
--  Lev Yam POS — analytics-ready schema (run once in Supabase SQL editor)
--  Tables:  pos_tables (live), pos_bills (paid), pos_bill_items (lines)
--  RPC:     pos_close_table, pos_reopen_bill
--  Views:   v_sales_daily, v_item_sales, v_category_sales, v_sales_hourly
-- =====================================================================

-- 1) LIVE OPEN TABLES — operational state, syncs across devices
create table public.pos_tables (
  id              text primary key,
  num             int,
  name            text,
  guests_adults   int  not null default 0,
  guests_children int  not null default 0,
  pricing_mode    text not null default 'open_house',   -- 'open_house' | 'a_la_carte'
  opened_at       timestamptz not null default now(),
  items           jsonb not null default '[]'::jsonb,    -- live cart (drives the UI)
  updated_at      timestamptz not null default now()
);

-- 2) BILLS — one row per paid bill (money + timing)
create table public.pos_bills (
  id               text primary key,
  table_num        int,
  name             text,
  status           text not null default 'paid',         -- 'paid' | 'voided'
  closed_by        text,                                  -- for future per-staff analytics
  guests_adults    int  not null default 0,
  guests_children  int  not null default 0,
  headcount        int  generated always as (guests_adults + guests_children) stored,
  pricing_mode     text not null default 'open_house',
  opened_at        timestamptz,
  paid_at          timestamptz not null default now(),
  duration_minutes int  generated always as
        ((greatest(0, extract(epoch from (paid_at - opened_at)) / 60))::int) stored,
  items_count      int     not null default 0,
  oh_charge        numeric not null default 0,            -- open-house cover portion
  extras_total     numeric not null default 0,            -- a la carte / extras portion
  menu_value       numeric not null default 0,            -- all items valued at menu price
  grand_total      numeric not null default 0,            -- amount charged
  cash_paid        numeric not null default 0,
  card_paid        numeric not null default 0,
  paid_total       numeric generated always as (cash_paid + card_paid) stored,
  items            jsonb   not null default '[]'::jsonb,  -- snapshot for re-open / receipt
  archived_at      timestamptz,                           -- hidden from day view, kept for analytics
  created_at       timestamptz not null default now()
);
create index on public.pos_bills (paid_at);
create index on public.pos_bills (status);

-- 3) BILL ITEMS — one row per item line (item-level analytics)
create table public.pos_bill_items (
  id             bigint generated always as identity primary key,
  bill_id        text not null references public.pos_bills(id) on delete cascade,
  table_num      int,
  paid_at        timestamptz not null default now(),
  item_name      text not null,
  category       text,
  is_open_house  boolean not null default false,
  is_custom      boolean not null default false,
  unit_price     numeric not null default 0,
  qty            int     not null default 0,
  line_total     numeric generated always as (unit_price * qty) stored
);
create index on public.pos_bill_items (paid_at);
create index on public.pos_bill_items (item_name);
create index on public.pos_bill_items (bill_id);

-- 4) Atomic close: bill + items written, open table removed — one transaction
create or replace function public.pos_close_table(p_bill jsonb, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id text := p_bill->>'id';
begin
  insert into public.pos_bills (
    id, table_num, name, status, closed_by, guests_adults, guests_children,
    pricing_mode, opened_at, paid_at, items_count,
    oh_charge, extras_total, menu_value, grand_total, cash_paid, card_paid, items
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
    coalesce((p_bill->>'grand_total')::numeric,0),
    coalesce((p_bill->>'cash_paid')::numeric,0),
    coalesce((p_bill->>'card_paid')::numeric,0),
    coalesce(p_bill->'items','[]'::jsonb)
  )
  on conflict (id) do update set
    status=excluded.status, paid_at=excluded.paid_at,
    cash_paid=excluded.cash_paid, card_paid=excluded.card_paid,
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

-- 5) Atomic re-open: bill back to an open table (removes the bill so no double-count)
create or replace function public.pos_reopen_bill(p_id text, p_num int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.pos_tables (id, num, name, guests_adults, guests_children, pricing_mode, opened_at, items)
  select b.id, p_num, b.name, b.guests_adults, b.guests_children, b.pricing_mode, b.opened_at, b.items
  from public.pos_bills b where b.id = p_id;
  delete from public.pos_bills where id = p_id;
end; $$;

-- 6) Ready-made analytics reports
create or replace view public.v_sales_daily as
select (paid_at at time zone 'Asia/Jerusalem')::date as day,
       count(*) as bills, sum(headcount) as covers,
       sum(grand_total) as revenue, sum(cash_paid) as cash, sum(card_paid) as card,
       round(avg(grand_total),2) as avg_bill, round(avg(duration_minutes),1) as avg_table_minutes
from public.pos_bills where status='paid' group by 1 order by 1 desc;

create or replace view public.v_item_sales as
select item_name, category, sum(qty) as units_sold,
       count(distinct bill_id) as times_ordered, sum(line_total) as menu_value
from public.pos_bill_items group by 1,2 order by units_sold desc;

create or replace view public.v_category_sales as
select category, sum(qty) as units_sold, sum(line_total) as menu_value
from public.pos_bill_items group by 1 order by units_sold desc;

create or replace view public.v_sales_hourly as
select extract(hour from (paid_at at time zone 'Asia/Jerusalem'))::int as hour,
       count(*) as bills, sum(headcount) as covers, sum(grand_total) as revenue
from public.pos_bills where status='paid' group by 1 order by 1;

-- 7) Realtime sync
alter publication supabase_realtime add table public.pos_tables;
alter publication supabase_realtime add table public.pos_bills;

-- 8) Access (anon key may read/write; staff PIN in the app is the guard)
alter table public.pos_tables     enable row level security;
alter table public.pos_bills      enable row level security;
alter table public.pos_bill_items enable row level security;
create policy "pos_tables anon"     on public.pos_tables     for all to anon using (true) with check (true);
create policy "pos_bills anon"      on public.pos_bills      for all to anon using (true) with check (true);
create policy "pos_bill_items anon" on public.pos_bill_items for all to anon using (true) with check (true);
-- Table privileges the RLS policies sit on top of (not auto-granted on newer projects)
grant select, insert, update, delete on public.pos_tables     to anon;
grant select, insert, update, delete on public.pos_bills      to anon;
grant select, insert, update, delete on public.pos_bill_items to anon;
grant execute on function public.pos_close_table(jsonb, jsonb) to anon;
grant execute on function public.pos_reopen_bill(text, int)    to anon;
grant select on public.v_sales_daily, public.v_item_sales, public.v_category_sales, public.v_sales_hourly to anon;
