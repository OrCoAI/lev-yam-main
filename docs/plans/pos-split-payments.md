# POS — split / partial payments + checkout item voids (PR C)

Third PR of [pos-operations-v2.md](pos-operations-v2.md). Covers request **#1**: a bill can
take payments **over time while still open** (deposit now, rest later), and items can be
removed at checkout with a void trail.

Module: `app-src/src/modules/pos/`. Schema: new `supabase/schema/47_pos_payments.sql`.

## Locked decisions (owner, 2026-07-21)

- **Partial-while-open.** A table can take payments before it closes; it closes when the
  balance reaches zero. Needs a **balance-due** concept on the open table.
- **Payments belong to the day they were taken** (not the bill's close date), so the cash
  drawer reconciles daily. This is the change that reaches the finance spine — see below.
- **Take a payment = `pos.order`** (floor staff already close tables today).
  **Void a recorded payment = `pos.manage`**, with a confirm.
- **Checkout item delete**: not-yet-sent = `pos.order`; **already fired to the kitchen =
  `pos.manage`** (the cost is incurred), recorded in the void trail with who/why.
- **Every discount is attributed.** Discounts stay underpayment-derived (paying less than the
  total is the discount), but a close with a discount is **rejected unless a category is
  given**. Categories: `family_friends` (משפחה וחברים), `staff` (צוות), `service` (פיצוי),
  `other` (אחר — **note required**). Enforced in the DB, not just the UI: the governing idea
  is *everything passes through the system, nothing from the side*, so `other` exists
  deliberately — a discount that fits no category must still be recorded and explained rather
  than blocked, because a blocked close is what pushes money off-system.
- **Payments are editable only while the bill is open.** Add = `pos.order`; edit/void =
  `pos.manage`, and only when the bill is still open. Changing a **closed** bill's payments
  requires explicitly reopening it first — a visible, audited act instead of a silent edit to
  money that may already be booked.

## Why this touches the finance spine

Today an open table has **no bill** — `pos_bills` is only created at close, and
`cash_paid`/`card_paid` live there. `pos.close_day` posts the day's income legs as:

```sql
v_card = sum(least(card_paid, grand_total))
v_cash = sum(grand_total - least(card_paid, grand_total))
```

i.e. it posts **`sum(grand_total)` — tips deliberately excluded** from income (tips are
tracked on `pos_bills.tip`, never posted as revenue).

Deriving the legs from payments by payment-date must preserve that. Summing raw payment
amounts would post tips as revenue and overstate income.

**Solution:** `pos_payments.tip_part` — the portion of a payment that is tip rather than
revenue. Tips are only knowable at close (overpayment beyond `grand_total`), so `tip_part`
is set on the **closing** payment only. `close_day` then posts:

```sql
v_cash = sum(amount - tip_part) filter (where method = 'cash')  -- payments taken that day
v_card = sum(amount - tip_part) filter (where method = 'card')
```

Discounts need no special handling: a discount reduces `grand_total`, and payments sum to
`grand_total + tip`, so `amount - tip_part` is exactly the revenue collected. The idempotent
correction mechanism in `close_day` (delta re-posting via `source_ref`) is unchanged, so a
re-post after a late payment still self-corrects — and PR E's drift detection builds on it.

## Schema (`47_pos_payments.sql`)

```sql
pos.pos_payments (
  id        bigint identity pk,
  bill_id   text not null,   -- pos_tables.id while open; same id on pos_bills after close
  method    text not null check (method in ('cash','card')),
  amount    numeric not null check (amount > 0),
  tip_part  numeric not null default 0 check (tip_part >= 0 and tip_part <= amount),
  note      text,
  taken_by  text,            -- stamped from the JWT, never client-supplied
  taken_at  timestamptz not null default now()
)
pos.pos_item_voids (
  id         bigint identity pk,
  bill_id    text not null,
  item_name  text not null,
  qty        numeric not null,
  unit_price numeric not null,
  was_fired  boolean not null default false,  -- kitchen had already been sent it
  reason     text,
  voided_by  text,           -- from the JWT
  voided_at  timestamptz not null default now()
)
```

No FK to `pos_bills` — the bill does not exist while the table is open. Indexed on
`bill_id` and `taken_at`.

Plus on `pos.pos_bills`: `discount_kind text` (`family_friends` | `staff` | `service` |
`other`) and `discount_reason text`, so every discount carries who-it-was-for.

### RPCs (the only write path; no UPDATE/DELETE grants on either table)

- `pos.add_payment(p_bill_id, p_method, p_amount, p_note)` — `pos.require('pos.order')`;
  rejects non-positive amounts; stamps `taken_by` from the JWT.
- `pos.void_payment(p_id)` / `pos.edit_payment(p_id, p_method, p_amount, p_note)` —
  `pos.require('pos.manage')`, **and both reject unless the bill is still open** (i.e. a row
  exists in `pos.pos_tables`), with a message telling the caller to reopen the bill first.
- `pos.void_item(p_bill_id, p_name, p_qty, p_unit_price, p_was_fired, p_reason)` —
  `pos.order` when `p_was_fired` is false, **`pos.manage`** when true.
- `pos.bill_payments(p_bill_id)` / open-table payment sums for the balance-due UI.
- All `security definer`, `set search_path`, **revoked from `public, anon`** then granted to
  `authenticated` (the PUBLIC-execute default bit this repo before — see PR B close-out).

### Changed

- `pos.pos_close_table` — records the final payment (with `tip_part`), derives the bill's
  `cash_paid`/`card_paid` from the payments table so the existing bill columns stay truthful
  for reports/receipts, and **raises unless a `discount > 0` carries a `discount_kind`**
  (and a `discount_reason` when the kind is `other`).
- `pos.close_day` — cash/card legs derived from payments taken that date, net of `tip_part`.

## UI

- **Open table**: balance-due row (total · paid so far · remaining), a payment history list,
  and an "add payment" action (cash/card + amount). Table stays open until the balance is 0.
- **Floor cards**: a part-paid table shows its remaining balance.
- **Checkout**: remove an item, with the fired ones gated to managers and a reason captured.
- **Discount capture**: when the amount paid is short of the total, the close dialog requires
  a category (family & friends / staff / service / other) and a note, instead of today's
  bare yes/no confirm.
- **Reopened bill**: its payments are listed and a manager can edit or void each one before
  re-closing.
- **Report**: discounts broken down by category, so family & friends is visible as its own
  number rather than buried in a single "discounts" total.
- Bilingual HE/AR, phone-first, matching the PR A/B chip + accordion language.

## Out of scope / notes

- **Refunds / negative payments** — a void is the correction path.
- Reopening a bill (`pos_reopen_bill`) keeps its payments; the re-close path derives from the
  payments table rather than accumulating, so it cannot double-count.

## Close-out (build 2026-07-22)

Shipped in `47_pos_payments.sql` (applied to prod, idempotent):
- `pos.pos_payments` + `pos.pos_item_voids` (RLS on, no policies/grants — RPC-only), plus
  `pos_bills.discount_kind` / `discount_reason`.
- RPCs: `add_payment` (order), `edit_payment` / `void_payment` (manage, **open bills only** —
  a closed bill must be reopened first), `void_item` (order un-fired / manage fired),
  `open_payments`, `bill_is_open`. All revoked from `public, anon`.
- `pos_close_table(p_bill, p_items, p_payments jsonb)` — records the closing payment(s)
  atomically, **derives cash/card from `pos_payments`** (client values ignored), allocates
  the tip newest-first (`tip_part`), and **refuses a discounted close with no attribution**.
- `close_day` split into internal `pos.post_day` (no perm check — PR E's auto re-post calls
  it) + `pos.close_day` (manage wrapper). Legs now come from **payments taken that day**,
  net of `tip_part`.
- `report_for_range` superseded here to add `discounts_by_kind` (family & friends visible as
  its own number; reports-permission only).

UI: open-table **balance-due** box (total / paid / remaining) + payment history with
manager **edit** (tap amount) and **void**; part-paid indicator on floor cards; PaymentModal
reworked for partial ("record payment", keep open) vs close, with a **discount-attribution
picker** on a short close; fired-item removal → manager + reason → void trail (un-fired items
removed locally, no round-trip).

Verified against prod (all tx-rolled-back): tip never posts as revenue (200 bill / 50 tip →
100+100 across two days, not 250); cross-day deposit lands on its own day; discount breakdown
returns `{family_friends: 30}`; `rls_matrix` +18 assertions green.

## Gate

Full gate + `rls_matrix` assertions for every new RPC (take/edit/void payment on open vs
closed bills, void fired vs un-fired item, discount attribution refusals) across
owner / manager / staff / viewer.
