-- =====================================================================
--  Lev Yam platform — FINANCE SPINE (cross-module money foundation)
--  Run in the Supabase SQL editor AFTER 20_finance.sql, BEFORE 40_events.sql.
--  Design: docs/plans/cross-module-foundation.md §3 (decisions locked 2026-07-09:
--  amounts post GROSS; POS posts per-day summaries; deposits due signing + N days).
--
--  What this adds to the finance module:
--    * PROVENANCE on finance.entries — source_module/source_ref/event_id.
--      Manual rows (source_module IS NULL) keep working exactly as today.
--    * Derived rows are written ONLY by module posting functions (a GUC-guarded
--      trigger blocks direct client insert/update/delete) — corrections are
--      reversals posted by the source module, never edits.
--    * IDEMPOTENT postings — unique index on the provenance key.
--    * finance.expected — money that SHOULD move (deposits, balances, supplier
--      bills), linked to the actual entry that fulfilled it.
--    * finance.record_payment() — fulfill an expectation + post the entry in one
--      transaction.
--    * finance.event_pnl() — per-event P&L over the event_id attribution column
--      (FK to events.events is added by 40_events.sql, which creates that table).
--
--  Category ownership rule (docs §3b): every category has exactly ONE writer.
--    Derived-only categories added here: income 'pos'; expense 'pos_food',
--    'pos_labor' (written by pos.close_day() when the POS module lands).
--    Income 'events' becomes quotes-written; the finance UI stops offering it
--    for manual entry (UI pass, roadmap Phase 1).
-- =====================================================================

-- ---------------------------------------------------------------------
--  1) Provenance columns (idempotent adds; existing manual rows untouched)
-- ---------------------------------------------------------------------
alter table finance.entries add column if not exists source_module text;
alter table finance.entries add column if not exists source_ref    text;
alter table finance.entries add column if not exists event_id      uuid;  -- FK in 40_events.sql

do $$ begin
  alter table finance.entries add constraint finance_entries_source_pair_check
    check ((source_module is null) = (source_ref is null));
exception when duplicate_object then null; end $$;

-- Manual rows stay strictly positive; derived rows may be negative (a reversal
-- posted by the source module nets out in every sum the report already does).
-- NOTE: the column definition in 20_finance.sql carries an inline `check
-- (amount > 0)` that Postgres auto-named `entries_amount_check` — it must be
-- dropped here too, or it silently overrides the rule below and blocks every
-- negative reversal (it did: POS day-lifecycle auto re-post hit it on the first
-- reducing correction). Dropping it lets the module-aware check govern.
alter table finance.entries drop constraint if exists entries_amount_check;
alter table finance.entries drop constraint if exists finance_entries_amount_check;
alter table finance.entries add constraint finance_entries_amount_check
  check (amount <> 0 and (source_module is not null or amount > 0));

-- The category taxonomy (and the derived-only POS categories) used to be a CHECK
-- constraint re-declared here. Superseded by 54_finance_categories.sql: the list
-- is data, and `finance.categories.owned_by_module` — not a literal — is what
-- makes a category derived-only. Re-declaring it here would resurrect a stale
-- taxonomy on any re-run of this file.

-- One posting per source fact — modules can re-run their posting functions
-- forever without double-counting (same philosophy as every file in this folder).
create unique index if not exists finance_entries_posting_uniq
  on finance.entries (source_module, source_ref, kind, category)
  where source_module is not null;

create index if not exists finance_entries_event_idx  on finance.entries (event_id)
  where event_id is not null;

-- ---------------------------------------------------------------------
--  2) Derived rows are module-written only.
--     Posting functions set the transaction-local GUC 'levyam.finance_posting'
--     before writing; without it, any insert/update/delete touching a row with
--     provenance is rejected — a client cannot forge, edit, or erase a posted
--     fact (the same "the DB is the law" stance as signed contracts).
-- ---------------------------------------------------------------------
-- finance.entries_guard() and its trigger are authored in
-- 54_finance_categories.sql — ONE definition, because the one-writer rule it
-- enforces now reads finance.categories.owned_by_module instead of a literal
-- array. Keeping a copy here meant a re-run of this file silently restored the
-- old four-slug array: newly added module categories would stop being protected
-- while the old ones kept working, which looks like it works.

-- ---------------------------------------------------------------------
--  3) finance.expected — money that SHOULD move (docs §3c)
--     Created by module triggers (quote signed → deposit + balance) or by hand
--     (supplier bill). Fulfilled via finance.record_payment(), which links the
--     actual entry back here — plan and actual stay one navigable pair.
-- ---------------------------------------------------------------------
create table if not exists finance.expected (
  id             uuid primary key default gen_random_uuid(),
  direction      text not null check (direction in ('in','out')),
  category       text not null,                  -- the entries category the money will post under
  amount         numeric(12,2) not null check (amount > 0),
  due_date       date,
  reason         text not null default '',       -- 'deposit' | 'balance' | 'supplier' | free text
  event_id       uuid,                           -- FK in 40_events.sql
  source_module  text,
  source_ref     text,
  status         text not null default 'open' check (status in ('open','fulfilled','cancelled')),
  fulfilled_by   uuid references finance.entries(id),
  note           text not null default '',
  created_by     uuid default auth.uid() references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint finance_expected_source_pair_check
    check ((source_module is null) = (source_ref is null))
);

create unique index if not exists finance_expected_source_uniq
  on finance.expected (source_module, source_ref)
  where source_module is not null;
create index if not exists finance_expected_status_idx on finance.expected (status);
create index if not exists finance_expected_due_idx    on finance.expected (due_date)
  where status = 'open';
create index if not exists finance_expected_event_idx  on finance.expected (event_id)
  where event_id is not null;

drop trigger if exists finance_expected_touch on finance.expected;
create trigger finance_expected_touch
  before update on finance.expected
  for each row execute function finance.set_updated_at();

-- ---------------------------------------------------------------------
--  4) finance.record_payment — the one motion that turns plan into actual:
--     posts the entry (with the expectation's provenance + event attribution)
--     and marks the expectation fulfilled, atomically.
-- ---------------------------------------------------------------------
create or replace function finance.record_payment(
  p_expected uuid,
  p_amount   numeric default null,     -- null = the expected amount
  p_method   text    default null,     -- 'cash' | 'private' | 'grow' | 'bank'
  p_date     date    default current_date,
  p_note     text    default null
) returns uuid
language plpgsql security definer
set search_path = finance, core, public
as $$
declare
  exp     finance.expected%rowtype;
  v_entry uuid;
begin
  if not core.has_permission('finance.manage') then
    raise exception 'permission denied';
  end if;

  select * into exp from finance.expected where id = p_expected for update;
  if not found then
    raise exception 'expected payment not found';
  end if;
  if exp.status <> 'open' then
    raise exception 'הצפי כבר במצב % — רק צפי פתוח ניתן לרישום', exp.status;
  end if;

  perform set_config('levyam.finance_posting', 'on', true);
  insert into finance.entries
    (kind, category, amount, payment_method, entry_date, note, source_module, source_ref, event_id)
  values (
    case exp.direction when 'in' then 'income' else 'expense' end,
    exp.category,
    coalesce(p_amount, exp.amount),
    p_method,
    p_date,
    coalesce(p_note, nullif(exp.reason, '')),
    coalesce(exp.source_module, 'finance'),
    'expected:' || exp.id,
    exp.event_id
  )
  returning id into v_entry;
  perform set_config('levyam.finance_posting', '', true);

  update finance.expected
  set status = 'fulfilled', fulfilled_by = v_entry
  where id = exp.id;

  return v_entry;
end; $$;

-- ---------------------------------------------------------------------
--  5) finance.event_pnl — what did this event actually make?
--     Invoker rights like finance.report(): inherits the finance.view RLS
--     policies, so a caller without the permission sees zeros, not everything.
-- ---------------------------------------------------------------------
create or replace function finance.event_pnl(p_event uuid)
returns jsonb
language sql stable
set search_path = finance, public
as $$
  with e as (select * from finance.entries  where event_id = p_event),
       x as (select * from finance.expected where event_id = p_event)
  select jsonb_build_object(
    'event_id', p_event,
    'income',  coalesce((select sum(amount) from e where kind = 'income'), 0),
    'expense', coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'net',     coalesce((select sum(amount) from e where kind = 'income'), 0)
             - coalesce((select sum(amount) from e where kind = 'expense'), 0),
    'expected_in_open',  coalesce((select sum(amount) from x where direction = 'in'  and status = 'open'), 0),
    'expected_out_open', coalesce((select sum(amount) from x where direction = 'out' and status = 'open'), 0),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'kind', kind, 'category', category, 'amount', amount,
        'entry_date', entry_date, 'source_module', source_module, 'note', note
      ) order by entry_date) from e), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'direction', direction, 'amount', amount, 'due_date', due_date,
        'reason', reason, 'status', status
      ) order by due_date nulls last) from x), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------
--  Row-Level Security — same gates as the rest of the module
-- ---------------------------------------------------------------------
alter table finance.expected enable row level security;

drop policy if exists "finance_expected_select" on finance.expected;
drop policy if exists "finance_expected_write"  on finance.expected;

-- (select ...) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "finance_expected_select" on finance.expected for select to authenticated
  using ((select core.has_permission('finance.view')));
create policy "finance_expected_write" on finance.expected for all to authenticated
  using ((select core.has_permission('finance.manage')))
  with check ((select core.has_permission('finance.manage')));

-- ---------------------------------------------------------------------
--  Grants (RLS still gates every statement)
-- ---------------------------------------------------------------------
grant select, insert, update, delete on finance.expected to authenticated;
grant execute on function finance.record_payment(uuid, numeric, text, date, text) to authenticated;
grant execute on function finance.event_pnl(uuid) to authenticated;
