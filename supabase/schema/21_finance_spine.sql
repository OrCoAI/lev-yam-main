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
-- The GUC has exactly one reader, here, so the string that decides whether
-- EVERY money guard is bypassed is written once. Hand-copying
-- `current_setting('levyam.finance_posting', true)` into each guard is one typo
-- away from a guard that never fires — and a misspelled GUC name reads as ''
-- and fails OPEN, which is the worst possible direction for this particular
-- condition to fail in.
create or replace function finance.is_posting()
returns boolean language sql stable as $$
  select coalesce(current_setting('levyam.finance_posting', true), '') = 'on';
$$;
comment on function finance.is_posting() is
  'True inside a module posting function. The one reader of levyam.finance_posting.';

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
--  3b) Partial payments: how much of this expectation has actually arrived.
-- ---------------------------------------------------------------------
-- Before this column, record_payment() closed an expectation at ANY amount:
-- ₪1 against a ₪5,000 deposit marked it fulfilled and the remaining ₪4,999
-- silently left the plan — out of the open list, out of the open-expected
-- total, and out of reconciliation's overdue check. The UI could only warn.
alter table finance.expected
  add column if not exists paid_amount numeric(12,2) not null default 0
  check (paid_amount >= 0);

-- Backfill from the LEDGER, not from `status`. The obvious version —
-- `set paid_amount = amount where status = 'fulfilled'` — is wrong twice over:
--   * it misses a row that was fulfilled under the old semantics and later
--     RE-OPENED (reachable before H6 landed). That row keeps paid_amount = 0
--     while its entry sits in the ledger, so "pay the remainder" posts the full
--     amount a second time. The fixed bare ref used to make that collide on
--     finance_entries_posting_uniq; with per-payment ':pN' refs the ref is fresh
--     by construction, so that backstop is gone and the double-post is silent.
--   * it fabricates money on a re-run: a row hand-set to 'fulfilled' with no
--     entry behind it would be stamped as fully paid. Prod is off the migration
--     pipeline and takes these files by hand, so a second application is the
--     NORMAL path, not an edge case.
-- Summing the entries actually posted against each expectation is true by
-- construction and idempotent however many times it runs.
do $$
begin
  perform set_config('levyam.finance_posting', 'on', true);
  update finance.expected x
     set paid_amount = coalesce((
           select sum(e.amount) from finance.entries e
            where e.source_module = coalesce(x.source_module, 'finance')
              and e.source_ref like 'expected:' || x.id || '%'), 0)
   where paid_amount = 0;
  perform set_config('levyam.finance_posting', '', true);
end $$;

-- ---------------------------------------------------------------------
--  3c) finance.audit_log — who overrode what, on the money plan.
-- ---------------------------------------------------------------------
-- The owner can rewrite a module-created expectation (owner decision,
-- 2026-08-12): quotes gets the deposit wrong, the owner fixes it, and the
-- books must not silently disagree with the signed quote. That power needs a
-- record. Deliberately NOT core.audit_log: that one is identity-scoped and
-- readable only by users.manage holders, whereas this must be visible to the
-- people who read the books (finance.view). Trigger-written only — there is
-- no client write policy, so a row cannot be forged or erased from the app.
create table if not exists finance.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid default auth.uid() references auth.users(id),
  action     text not null,                    -- 'UPDATE' | 'DELETE'
  table_name text not null,
  row_id     uuid,
  row_before jsonb,
  row_after  jsonb
);
create index if not exists finance_audit_log_at_idx  on finance.audit_log (at desc);
create index if not exists finance_audit_log_row_idx on finance.audit_log (table_name, row_id);

alter table finance.audit_log enable row level security;
drop policy if exists finance_audit_log_select on finance.audit_log;
create policy finance_audit_log_select on finance.audit_log
  for select to authenticated using ((select core.has_permission('finance.view')));
-- No insert/update/delete policy on purpose: the trigger below is SECURITY
-- DEFINER and writes past RLS, so the log is append-only from the app's side.
grant select on finance.audit_log to authenticated;

-- Records every CLIENT edit (never a module posting) to a MODULE-SOURCED
-- expectation. That is broader than just the owner override, deliberately: a
-- manager cancelling a quotes-created deposit is exactly as consequential to
-- the books as the owner rewriting its amount, and both are motions the module
-- did not make. Manual expectations are ordinary editable data and are skipped,
-- since logging them would bury the module-row events in noise.
create or replace function finance.audit_expected_override()
returns trigger language plpgsql security definer
set search_path = finance, core, public as $$
begin
  if finance.is_posting() then return null; end if;
  if coalesce(old.source_module, '') = '' then return null; end if;
  insert into finance.audit_log (action, table_name, row_id, row_before, row_after)
  values (tg_op, 'finance.expected', old.id, to_jsonb(old),
          case tg_op when 'DELETE' then null else to_jsonb(new) end);
  return null;
end; $$;
revoke all on function finance.audit_expected_override() from public;

drop trigger if exists finance_expected_audit on finance.expected;
create trigger finance_expected_audit
  after update or delete on finance.expected
  for each row execute function finance.audit_expected_override();

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
  exp         finance.expected%rowtype;
  v_entry     uuid;
  v_amount    numeric(12,2);
  v_remaining numeric(12,2);
  v_paid      numeric(12,2);
  v_seq       int;
  v_kind      text;
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

  -- PARTIAL PAYMENTS: default to what is still owed, not the full amount.
  v_remaining := exp.amount - exp.paid_amount;
  v_amount    := coalesce(p_amount, v_remaining);

  -- A fulfilment is money ARRIVING, so it is positive. Validated here because
  -- this function posts behind the GUC with non-null provenance, and
  -- finance_entries_amount_check only requires `amount > 0` for provenance-LESS
  -- rows (module reversals must be able to go negative). Without this, an
  -- unvalidated p_amount was the one client-reachable way to write a negative
  -- entry — i.e. to make income disappear from the books through a path the
  -- manual-entry form could never take.
  if v_amount <= 0 then
    raise exception 'סכום התשלום חייב להיות חיובי';
  end if;
  if v_amount > v_remaining then
    raise exception 'הסכום (%) גדול מהיתרה לתשלום (%) — לא ניתן לשלם מעבר לצפי',
      v_amount, v_remaining;
  end if;

  -- H6, the reachable half. This function is SECURITY DEFINER, checks only
  -- finance.manage, and posts exp.category BEHIND the GUC — where entries_guard
  -- short-circuits. So without this check a manager could land a row in a
  -- module-owned category, and that row is then permanently un-editable.
  -- NOT assert_category_writable(): 'events' is owned_by_module='quotes' and
  -- every quotes deposit is filed under it, so the blanket check would reject
  -- the module's own primary money path. The rule is owner-vs-poster, and the
  -- archived check is deliberately not applied (see 54's carve-out).
  -- exp.kind is the row's own GENERATED column (54) — re-deriving the mapping
  -- here would be a third copy, and expected_guard's comment records that a
  -- diverging copy fails OPEN.
  v_kind := exp.kind;
  perform finance.assert_category_writer(v_kind, exp.category, coalesce(exp.source_module, 'finance'));

  -- Each payment needs its own source_ref: finance_entries_posting_uniq is on
  -- (source_module, source_ref, kind, category), so a second payment against a
  -- fixed 'expected:<id>' would collide. Same device post_day uses for ':rN'
  -- and override for ':cN'. Legacy rows carry the bare ref and are counted so
  -- numbering never reuses one.
  -- Scoped by source_module like every sibling (pos.post_day, record_override),
  -- so finance_entries_posting_uniq (source_module, source_ref, …) can serve it
  -- — without the leading column it degrades to a seq scan of the whole ledger.
  -- One LIKE covers both grammars: a UUID is fixed-length, so the legacy bare
  -- 'expected:<id>' is itself a prefix of 'expected:<id>:pN'.
  select count(*) + 1 into v_seq
    from finance.entries
   where source_module = coalesce(exp.source_module, 'finance')
     and source_ref like 'expected:' || exp.id || '%';

  v_paid := exp.paid_amount + v_amount;

  perform set_config('levyam.finance_posting', 'on', true);
  insert into finance.entries
    (kind, category, amount, payment_method, entry_date, note, source_module, source_ref, event_id)
  values (
    v_kind,
    exp.category,
    v_amount,
    p_method,
    p_date,
    coalesce(p_note, nullif(exp.reason, '')),
    coalesce(exp.source_module, 'finance'),
    'expected:' || exp.id || ':p' || v_seq,
    exp.event_id
  )
  returning id into v_entry;

  -- INSIDE the posting window, unlike before: this write sets fulfilled_by and
  -- paid_amount, and the guard below only lets a module touch those on a
  -- module-sourced row. (Whitelisting fulfilled_by for clients instead would
  -- let one point it at an arbitrary entry.)
  update finance.expected
     set paid_amount  = v_paid,
         status       = case when v_paid >= exp.amount then 'fulfilled' else 'open' end,
         fulfilled_by = case when v_paid >= exp.amount then v_entry else fulfilled_by end
   where id = exp.id;
  perform set_config('levyam.finance_posting', '', true);

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
    -- OUTSTANDING, not the original figure: a part-paid deposit is only still
    -- expected for its remainder. Summing `amount` here would overstate the
    -- event's open plan by everything already collected — the same defect
    -- partial payments fixed on the expected tab and in reconciliation.
    'expected_in_open',  coalesce((select sum(amount - paid_amount) from x where direction = 'in'  and status = 'open'), 0),
    'expected_out_open', coalesce((select sum(amount - paid_amount) from x where direction = 'out' and status = 'open'), 0),
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'kind', kind, 'category', category, 'amount', amount,
        'entry_date', entry_date, 'source_module', source_module, 'note', note
      ) order by entry_date) from e), '[]'::jsonb),
    'expected', coalesce((select jsonb_agg(jsonb_build_object(
        -- `amount` keeps its original meaning here — what was PLANNED. This
        -- array is not filtered by status, so emitting the remainder made a
        -- fulfilled row read as 0 and a cancelled one as its full figure.
        -- The outstanding view lives in expected_in_open/expected_out_open
        -- above, which do filter on status.
        'id', id, 'direction', direction, 'amount', amount,
        'amount_paid', paid_amount, 'amount_outstanding', amount - paid_amount,
        'status', status, 'due_date', due_date,
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
-- Every `grant execute` below is preceded by a `revoke ... from public`: Postgres
-- grants EXECUTE to PUBLIC (which includes anon) on every new function, so a bare
-- grant leaves the function anon-callable. Found live on prod AND staging by
-- supabase/tests/audit-grants.mjs on 2026-08-12 and fixed on both tiers.
revoke all on function finance.record_payment(uuid, numeric, text, date, text) from public;
grant execute on function finance.record_payment(uuid, numeric, text, date, text) to authenticated;
revoke all on function finance.event_pnl(uuid) from public;
grant execute on function finance.event_pnl(uuid) to authenticated;
-- Internal helper: only ever called from inside other functions and guards, but
-- it must stay executable by `authenticated` because the non-definer trigger
-- guards call it as the invoking user. Revoke PUBLIC, grant authenticated back.
revoke all on function finance.is_posting() from public;
grant execute on function finance.is_posting() to authenticated;
