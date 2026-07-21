# PR B — Summary tab redesign + expenses upgrade (#4 + #6)

Part of [pos-operations-v2](pos-operations-v2.md). Kickoff 2026-07-21, owner-aligned.
Branch `feat/pos-summary-expenses`.

## Scope

**#4 Summary tab** — richer date filtering + an accordion-organised, aligned report:
- Add **this-week** and **this-month** one-click presets (alongside today / yesterday /
  7d / 30d), plus the existing custom range picker.
- Reorganise `ReportView` sections into collapsible **accordions** (summary tiles stay
  visible; details / items-sold / food / labor / closed-tables collapse), phone-first
  and aligned.

**#6 Expenses upgrade** — on `pos_expenses`:
- Surface **who** (`created_by`) + **when** (`created_at`) on each expense row (data
  already captured; just not shown).
- **Receipt flag** — new `has_receipt boolean` with a ✓/✗ toggle.
- **Paid date** — new `paid_on date` (nullable = unpaid); "mark paid" stamps today,
  date editable.
- **Full expenses over the selected period** — the itemized expense list, currently
  single-day only, now spans the chosen date range.

## Locked decisions (owner, 2026-07-21)

- Receipt = **yes/no flag only** (no photo upload; attachment is a later pass).
- **Permission split:** ticking the **receipt** flag = holders of that expense kind's
  cost permission (`pos.costs_food` / `pos.costs_labor`, or `pos.manage`); **marking
  paid** = `pos.manage` only.
- **Paid** = toggle stamps today's date, editable; unpaid = `null`.
- Paid-date is **operational only** — finance posting stays on `business_date`
  (accrual); `paid_on` does **not** move any `finance.entries` (per pos-operations-v2).

## Schema (`supabase/schema/46_pos_expenses_tracking.sql`)

1. `alter table pos.pos_expenses`
   - `add column if not exists has_receipt boolean not null default false`
   - `add column if not exists paid_on date` (null = unpaid)
2. **Update path = SECURITY DEFINER RPCs** (no blanket UPDATE policy — mirrors
   `pos_close_table` / `close_day`; the only update route into the table):
   - `pos.set_expense_receipt(p_id bigint, p_has_receipt boolean)` — allowed if
     `has_permission('pos.costs_' || kind)` **or** `has_permission('pos.manage')`.
   - `pos.set_expense_paid(p_id bigint, p_paid_on date)` — `has_permission('pos.manage')`
     only; `p_paid_on` may be null to un-mark.
   - `pos.set_expense(p_id bigint, p_note text, p_amount numeric)` — **edit** an
     expense's name + amount; `pos.manage` only (amount is financially sensitive,
     same tier as delete); rejects non-positive amounts.
   - grant execute to `authenticated` (each checks its own permission).
3. `create or replace function pos.report_for_range` — the single report source both
   `pos_day_report` and `range_report` delegate to:
   - add `has_receipt`, `paid_on` to each expense object;
   - **remove the `p_from <> p_to → []` restriction** so the itemized expense list spans
     the range (keep the `v_reports or v_food` gate + labor-only-for-reports rule);
     order by `business_date, created_at`.

## RLS matrix (`supabase/tests/rls_matrix.sql`)

Add assertions:
- `pos.set_expense_receipt` — a `costs_food` holder can flag a food expense; **cannot**
  flag a labor expense; a `costs_labor` holder can flag labor; `manage` can flag either.
- `pos.set_expense_paid` — `manage` can mark paid; a costs-only holder **cannot**.
- No direct `update` on `pos.pos_expenses` succeeds for any non-owner role.

## UI (`app-src/src/modules/pos/`)

- `types.ts` — `DayReportExpense` gains `has_receipt: boolean`, `paid_on: string | null`.
- `api.ts` — `setExpenseReceipt(id, has)` + `setExpensePaid(id, paidOn)` RPC wrappers.
- `logic.ts` — `startOfWeek(ymd)` (Sunday, Israel) + `startOfMonth(ymd)` helpers.
- `ReportView.tsx` — accordion layout; week/month presets; expense rows show by/when +
  receipt toggle (cost-perm gated) + paid toggle/date (manage gated) + **inline edit**
  of name/amount (manage gated) + **delete with confirm** (always; stronger warning when
  paid — names amount, paid date, finance-drift caveat); expense sections render over the
  selected range. Receipt/paid/edit update the chip **in place** (optimistic), no refetch.
- `styles.ts` — accordion + expense-row styles.

## Alignment

- **Architecture:** DB-first (RPC + `has_permission`, RLS-tested), schema in
  `supabase/schema/`, money stays on the finance spine (paid_on is non-finance),
  bilingual HE/AR, phone-first. ✅
- **Roadmap:** PR B of the POS ops v2 line. Feeds Phase 5 (inventory/suppliers →
  expenses). ✅
- **Vision:** strengthens live operations bookkeeping. ✅

## Gate & close-out

Full gate (`/simplify`, `/code-review high`, `/security-review`, `/verify` incl. an
extended `rls_matrix.sql` green run). Close-out appended here on completion.
