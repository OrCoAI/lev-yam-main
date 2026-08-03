-- =====================================================================
--  57_finance_transfers.sql — cash↔bank movement (PR D of the finance
--  books-integrity initiative, and the last of the four).
--
--  Moving ₪2,000 from the drawer to the bank is neither income nor expense:
--  the business is no richer or poorer, the money just changed pocket. Today
--  it has nowhere to live, so it either goes unrecorded — and then the cash
--  count never reconciles — or it gets filed as an expense and understates
--  the profit by its full amount.
--
--  WHY ITS OWN TABLE, not a third `kind` on finance.entries: a non-income,
--  non-expense row inside finance.entries would land inside every existing
--  sum, filter and report branch — finance.report(), finance.event_pnl(),
--  pos.post_day()'s two-source revenue read, the entries_guard provenance
--  rules, and now the four reconciliation checks in 55. That is the exact
--  shape of the change that once recomputed legacy POS days to zero and wiped
--  their income (see docs/plans/pos-operations-v2.md close-out). A separate
--  table cannot break a query that does not read it, and nothing that sums
--  income or expense reads this one.
--
--  Deliberately NOT here: a running cash-on-hand balance. That needs an
--  opening balance per method and a rule for which POS takings land in the
--  drawer, which is its own initiative — this file only records the movement.
--
--  Re-runnable; apply after 56. Plan: docs/plans/finance-books-integrity.md
-- =====================================================================

create table if not exists finance.transfers (
  id            uuid primary key default gen_random_uuid(),
  amount        numeric(12,2) not null check (amount > 0),
  from_method   text not null,
  to_method     text not null,
  transfer_date date not null default current_date,
  note          text,
  created_by    uuid not null default auth.uid() references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- same four methods finance.entries.payment_method allows (20_finance.sql).
  -- Kept as a CHECK rather than a lookup table: unlike categories, this list is
  -- not owner-editable — a new payment method means new code in the POS close
  -- and the report breakdown, so it is a schema change by nature.
  constraint finance_transfers_from_check
    check (from_method in ('cash','private','grow','bank')),
  constraint finance_transfers_to_check
    check (to_method   in ('cash','private','grow','bank')),
  -- a transfer to the same pocket is a typo, and it would read as real
  -- movement in every future balance view
  constraint finance_transfers_distinct_check check (from_method <> to_method)
);

create index if not exists finance_transfers_date_idx
  on finance.transfers (transfer_date desc);

drop trigger if exists finance_transfers_touch on finance.transfers;
create trigger finance_transfers_touch
  before update on finance.transfers
  for each row execute function finance.set_updated_at();

-- ---------------------------------------------------------------------
--  RLS — mirrors finance.entries exactly: view to read, manage to write.
--  No provenance and no guard: a transfer is always a human statement about
--  money the human moved. No module posts one, so there is nothing for
--  entries_guard's one-writer rule to protect.
-- ---------------------------------------------------------------------
alter table finance.transfers enable row level security;

drop policy if exists "finance_transfers_select" on finance.transfers;
drop policy if exists "finance_transfers_write"  on finance.transfers;

-- (select …) wrapper = one InitPlan eval per statement, not per row (MODULE-TEMPLATE.md §1)
create policy "finance_transfers_select" on finance.transfers for select to authenticated
  using ((select core.has_permission('finance.view')));
create policy "finance_transfers_write" on finance.transfers for all to authenticated
  using ((select core.has_permission('finance.manage')))
  with check ((select core.has_permission('finance.manage')));

-- created_by is stamped from the JWT default and must not be client-writable:
-- a client that could set it could attribute its own transfer to someone else.
revoke all on finance.transfers from anon, authenticated;
grant select on finance.transfers to authenticated;
grant insert (amount, from_method, to_method, transfer_date, note)
  on finance.transfers to authenticated;
grant update (amount, from_method, to_method, transfer_date, note)
  on finance.transfers to authenticated;
grant delete on finance.transfers to authenticated;

-- No new permission: a transfer is ordinary money handling, the same
-- finance.view / finance.manage pair that governs entries and expectations.
