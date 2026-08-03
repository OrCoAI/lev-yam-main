# Finance — books integrity (categories · reconciliation · owner override · transfers)

**Kickoff:** 2026-07-31 (Or's brief: "categories must be fixed", "notification if the books
are not aligned with the rest of the modules", "ability to override everything by the owner").
**Branch:** `finance-books-integrity`. **Status:** aligned, not started.

Background: [cross-module-foundation.md](cross-module-foundation.md) §3 (the money spine),
[finance-ux-pass.md](finance-ux-pass.md), [pos-day-lifecycle.md](pos-day-lifecycle.md)
(auto re-post), [modules/finance.md](../modules/finance.md).

---

## 1. Why

Three gaps in the finance module, all of them about the books being *trustworthy*:

1. **The category taxonomy is code, not data.** It lives in a hardcoded `CHECK` constraint
   declared three times across two files — inline on the table
   ([20_finance.sql:33](../../supabase/schema/20_finance.sql#L33)), re-declared `NOT VALID`
   below it ([20_finance.sql:54](../../supabase/schema/20_finance.sql#L54)), then re-declared
   again to add the POS categories
   ([21_finance_spine.sql:55](../../supabase/schema/21_finance_spine.sql#L55)) — and mirrored
   client-side in [categories.ts](../../app-src/src/modules/finance/categories.ts). Adding one
   category costs a schema change, a baseline rebuild and a production deploy. The list is also
   incomplete — no rent, utilities, insurance, taxes/VAT, payment fees, event costs or
   donations, so real money gets filed under whatever is closest. Worse,
   `finance.expected.category` has **no constraint at all**, so plan and actual can already
   name different categories for the same money.

2. **Nothing tells you the books are behind.** The first write of a POS day to the books is a
   deliberate manual act (`pos.close_day`). If nobody presses it, the revenue simply isn't
   there and nothing says so. This has already happened once in production: the first week of
   July 2026 was never posted and was found only during the POS parity trial, then backfilled
   by hand (ROADMAP Phase 1, POS parity trial note). Overdue deposits have the same silence —
   `finance.expected` rows sit `open` past their `due_date` with no surface.

3. **The owner can't correct a module-posted number.** By design: `entries_guard()`
   ([21_finance_spine.sql:81](../../supabase/schema/21_finance_spine.sql#L81)) blocks every
   client edit or delete of a row carrying provenance, for everyone including the owner.
   Corrections are supposed to be reversals posted by the source module — but when reality and
   the module disagree (a cash count that doesn't match, a POS day that can't be recomputed
   correctly), there is no way out.

Alongside these, cash→bank movement has nowhere to live: it is neither income nor expense, so
today it either goes unrecorded or distorts both totals.

## 2. Scope

### In

- **PR A — categories as data.** `finance.categories` table, owner-editable, replacing both
  `CHECK` constraints and the client mirror; constrains `finance.expected` too; admin UI.
- **PR B — reconciliation.** Live drift detection over three checks, surfaced as launcher
  badges (finance **and** POS), an in-module banner, and a dedicated tab — each item carrying
  the action that resolves it.
- **PR C — owner override.** An owner-only *correction entry* against any row or category
  including module-derived ones, plus a **pin** that stops POS auto-re-post from overwriting
  the corrected day.
- **PR D — transfers.** A separate `finance.transfers` table (cash→bank and back), deliberately
  outside every income/expense total.

### Out (decided at kickoff, 2026-07-31)

- **Signed-quote-vs-booked reconciliation** — a fourth drift check comparing a signed
  contract's total against posted income + open expectations. Real, deferred; it needs the
  events module surface to be actionable.
- **Partial payments on `finance.expected`** — the pre-existing open item
  ([modules/finance.md](../modules/finance.md)); untouched here. Note the interaction: check 3
  below flags an expectation as overdue on `due_date`, and once partial payments land it will
  need a *remaining* amount rather than the full one.
- **Tips in the books** — confirmed at kickoff that tips stay netted out of POS revenue and
  never reach finance. They are the staff's money passing through, not business income.
- **Server-side provenance resolution** and the **hand-created-expectation reversal path** —
  both remain open items in the module log. PR C partially relieves the second (an owner
  correction can now offset such a row) but does not implement a proper corrector.
- **Sub-categories / hierarchy** — flat list only; roll-up reporting is not in this initiative.
- **A write guard on `finance.expected`** — PR A gives that table the taxonomy FK but no
  trigger, so a `finance.manage` holder can still create an expectation naming a module-owned
  category (`record_payment` would then post it into `entries` behind the posting GUC). This is
  *pre-existing* — before PR A `expected.category` was unconstrained free text, so the diff only
  narrows it — and it is precisely roadmap item **H6** (`finance.expected` module-row guard).
  Left whole for H6 rather than half-done here. The shared
  `finance.assert_category_writable()` PR A introduces is the hook H6 should call.
  **PR A's security review traced the same hole one step further** (2026-08-03): the reachable
  path is not a direct insert but `finance.record_payment()`
  ([21_finance_spine.sql:166](../../supabase/schema/21_finance_spine.sql#L166)) — it is
  `SECURITY DEFINER`, checks only `finance.manage`, flips the posting GUC, and posts using
  `exp.category` without consulting the one-writer rule. So a **manager** can create an
  expectation with `direction='in', category='pos'`, call `record_payment`, and land a row in
  the POS-owned income category that the guard then makes permanently un-editable by everyone,
  owner included. Pre-existing and unchanged by PR A (the old CHECK permitted income `pos` and
  `expected.category` was unconstrained), but H6 must cover `record_payment`, not just a write
  guard on the table — a table-only guard would leave this path open.

## 3. Decisions locked at kickoff

| Question | Decision |
|---|---|
| Category model | Owner-editable table (`finance.categories`), not an expanded `CHECK` |
| Who edits categories | **Owner only** — new `finance.categories` permission (tighter than POS's `pos.menu`, which is owner+manager, because categories reshape every historical report) |
| Drift checks | POS day never posted · POS recompute mismatch · overdue expectations |
| Alert surfaces | Finance tile badge · POS tile badge · in-module banner · dedicated tab |
| Alert behavior | Live-computed, never dismissible; each item carries its one-click fix |
| Override model | Correction entry + day pin. Derived rows stay immutable — §7.4 preserved |
| Tips | Stay out of the books |
| `makrer` | Kept ACTIVE with a clearer label (מקרר ושתייה / برّاد ومشروبات). Revised from "archive it" at kickoff once the existing HE/AR labels showed it means *fridge* — i.e. live drinks income, not a legacy tender. Slug deliberately not renamed: history references it |
| Transfers | Own table, **not** a third `kind` on `finance.entries` |
| Sequencing | A → B → C → D |

**Why the override is additive, not an edit.** Beyond invariant §7.4, there is a mechanical
reason: POS re-posts a booked day automatically on any change to its bills, payments or
expenses ([48_pos_day_lifecycle.sql](../../supabase/schema/48_pos_day_lifecycle.sql)). A direct
hand-edit of a POS revenue row would be silently recomputed away by the next expense edit. So
"owner can edit anything" without a pin is a feature that quietly does not work. Correction +
pin gives the same practical power — any number ends up whatever the owner says — while the
original posting stays visible and auditable.

**Why transfers get their own table.** A third `kind` on `finance.entries` would put a
non-income, non-expense row inside every existing sum, filter and report branch — `report()`,
`event_pnl()`, `post_day()`'s two-source revenue read, the provenance guard, the drift checks.
That is the same shape as the change that once recomputed legacy POS days to zero and wiped
their income (see [pos-operations-v2.md](pos-operations-v2.md) close-out). A separate table
cannot break a query that does not read it; the entries list merges the two for display only.

## 4. Schema changes

New files, continuing the existing numbering (last is `53_pos_close_options.sql`):

### `54_finance_categories.sql` (PR A)

```
finance.categories
  id               uuid pk
  kind             text not null check (kind in ('income','expense'))
  key              text not null              -- stable slug; posting functions reference it
  label_he         text not null
  label_ar         text not null
  owned_by_module  text                       -- non-null ⇒ derived-only, one writer
  active           boolean not null default true
  sort             int not null default 0
  unique (kind, key)
```

- Seeded with **every** category currently valid, so no historical row is orphaned, plus the
  additions approved at kickoff: expense `rent`, `utilities`, `insurance`, `taxes`,
  `payment_fees`, `event_costs`; income `donations`. `makrer` stays active with a clearer
  label (see the decisions table).
- `owned_by_module` seeds `'pos'` for `pos`/`pos_food`/`pos_labor` and `'quotes'` for `events`
   — this table becomes the single source of the derived-only rule, replacing the hardcoded
   `derived_only` array in `entries_guard()` **and** the `DERIVED_ONLY` set in `categories.ts`.
- Composite FK `finance.entries (kind, category) → finance.categories (kind, key)`, added
  `NOT VALID` so re-runs never choke on history while every new write is enforced. Drops
  `finance_entries_category_check`.
- **Open implementation question:** `finance.expected` keys money by `direction` (`in`/`out`),
  not `kind`, so it cannot take the same composite FK directly. Options: a stored generated
  `kind` column mapping `in→income` / `out→expense` and an FK on that, or a validation trigger.
  To be settled in PR A — either way `expected.category` stops being free text.
- Guards: a category with rows in `entries` or `expected` cannot be deleted (archive instead);
  `owned_by_module` is not client-writable — module ownership is declared by the module, never
  by the admin UI.

### `55_finance_reconciliation.sql` (PR B)

- Refactor `pos.post_day()`'s leg computation into a read-only `pos.day_expected_legs(date)`
  returning the four legs (cash / card / food / labor). `post_day()` then consumes it, so the
  `'pos:<date>:<leg>[:r<n>]'` `source_ref` grammar stays authored in exactly one place — check
  2 needs "what *would* post_day produce" without writing anything.
- `finance.reconciliation()` → jsonb, one round trip, invoker rights (inherits `finance.view`
  RLS like `report()` and `event_pnl()` already do). Three checks:
  1. **Unposted POS day** — a date with paid bills or payment rows where
     `pos.day_is_posted()` is false.
  2. **Recompute mismatch** — a booked day where `day_expected_legs()` differs from what
     finance holds. Should always be zero; a non-zero means the auto-re-post trigger failed or
     was bypassed. Days pinned by PR C are reported as *pinned*, not as drift.
  3. **Overdue expectation** — `finance.expected` still `open` with `due_date < current_date`.
- `finance.reconciliation_count()` → int, the cheap version the launcher badges call.

### `56_finance_override.sql` (PR C)

- `finance.post_correction(...)` — owner-only, posts an adjustment entry with
  `source_module = 'override'` and a `source_ref` referencing the corrected entry or day. The
  original posting is never touched.
- `pos.day_pins (business_date pk, pinned_by, pinned_at, reason)`; `pos.repost_if_posted()`
  skips a pinned day. Note this file touches **two schemas** — the pin table belongs next to
  the re-post logic that honours it (`pos`), while the permission gating it is finance's.
  RLS on `day_pins`: read with `pos.reports`-level access, write with `finance.override`.
- New owner-only permission `finance.override`.
- A pinned day is deliberately a **visible** state, not a silent one: PR B's check 2 reports it
  as *pinned* rather than hiding it, so a day frozen months ago never becomes invisible drift.

### `57_finance_transfers.sql` (PR D)

- `finance.transfers (id, amount, from_method, to_method, transfer_date, note, created_by,
  created_at)`, RLS mirroring `finance.entries` (`finance.view` / `finance.manage`).
- Read by nothing that sums income or expense — by construction.

Each PR regenerates the baseline (`node supabase/tests/build-baseline.mjs --write`) and extends
`supabase/tests/rls_matrix.sql` with assertions for what it added, per the pre-commit gate.

### Function security posture (applies to every function above)

This repo has been bitten twice by the same class of bug — a `SECURITY DEFINER` function left
executable by `PUBLIC` (`core` role self-grant escalation found by the gate on
[users-delete-deactivate.md](users-delete-deactivate.md); the POS price functions in
[pos-menu-kitchen.md](pos-menu-kitchen.md)). Standing rules for this initiative:

- **`pos.day_expected_legs()` must stay invoker-rights**, or be `SECURITY DEFINER` with an
  explicit `core.has_permission` check inside. It returns a day's full revenue; as a bare
  definer function granted to `authenticated` it would hand POS takings to any logged-in user,
  including roles with no finance or POS-reports permission at all.
- **`finance.reconciliation()` and `reconciliation_count()`** are gated in the *database* on
  `finance.view` — invoker rights, inheriting RLS like `report()` and `event_pnl()` do. The
  launcher only fetching them for permission holders is a UI convenience, never the gate: a
  badge count leaks how many days of revenue are unbooked.
- **`finance.post_correction()`** is `SECURITY DEFINER` by necessity (it writes derived rows
  behind the posting GUC), so it checks `finance.override` on entry and **`revoke execute from
  public`** explicitly — revoking from `authenticated` alone does not remove the `PUBLIC` grant.
- Same `revoke ... from public` treatment for every new function in PRs A–D.

## 5. Permissions

| Key | Roles | Purpose |
|---|---|---|
| `finance.categories` | owner | Edit the category taxonomy |
| `finance.override` | owner | Post correction entries, pin a POS day |

Existing `finance.view` / `finance.manage` are unchanged. Reconciliation *reads* under
`finance.view`; each fix action requires the permission it would have required anyway (posting
a day → the POS close-day permission, recording a payment → `finance.manage`), so the tab
cannot become a privilege side-door.

## 6. UI surface

All new UI goes through the shell i18n layer (HE + AR) and is designed phone-first, per the
platform requirements. Category labels are bilingual **in the data**, so a new category is
bilingual the moment the owner creates it — the admin form requires both.

- **CategoriesTab** (owner only) — list by kind, add/rename/archive/reorder. Module-owned
  categories are shown with their owning module and are label-editable only.
- **ReconcileTab** — drift items grouped by check, each with its fix button.
- **Banner** in `FinanceModule` — a live strip when any item is open, linking to the tab.
- **Launcher badges** — count on the finance tile and the POS tile
  ([Launcher.tsx](../../app-src/src/shell/Launcher.tsx), `MODULE_META`), fetched only for users
  holding `finance.view`.
- **Correction action** (owner only) on any entry row, including module-posted ones; **pin
  toggle** on the POS day view.
- **TransfersTab** — or a filter within the entries list; decided in PR D.

## 7. Architecture invariants check

Walked against [ARCHITECTURE.md](../ARCHITECTURE.md) §7:

| Invariant | Verdict |
|---|---|
| 1. RLS on every table, UI never the only gate | ✅ `categories`, `day_pins`, `transfers` all ship with RLS + policies; permission checks live in the functions |
| 2. Anon keys only in the browser | ✅ no new secrets, no edge function |
| 3. No PII in the public repo | ✅ categories are labels; no customer data |
| 4. Business invariants in Postgres | ✅ **preserved by design** — the override is additive, `entries_guard()` keeps rejecting edits and deletes of derived rows for everyone. The pin is a DB table checked inside `repost_if_posted()`, not a UI flag |
| 5. HE + AR everywhere | ✅ bilingual labels stored in the data; all new UI through shell i18n |
| 6. Public content visibility flag | n/a — finance is internal |
| 7. Live tools keep working | ⚠️ **watch item:** the `post_day()` refactor must leave the `'pos:<date>:<leg>[:r<n>]'` `source_ref` grammar byte-identical, or `day_is_posted()` and the auto-re-post read stop matching history. Covered by an rls_matrix assertion in PR B |
| 8. ROADMAP is the tracker | ✅ item added under Phase 1 finance follow-ups |

Also checked against the architecture body: **permissions DB-first** (both new keys are RLS/
function-enforced, UI mirrors second) ✅; **schema in `supabase/schema/` as source of truth**
✅; **money through the cross-module spine, no module-local silos** ✅ — reconciliation reads
the spine rather than inventing a second ledger, and transfers live in `finance`, not in POS;
**mobile-first** ✅.

## 8. Vision check

Against [VISION.md](../VISION.md):

- **Principle 6, "real ventures, real numbers — tightly guarded"** — directly served. Phase 3
  initiatives are meant to track real budgets through this module; books that silently lag
  reality, or a taxonomy nobody can extend, would make that promise hollow. Owner-only category
  and override permissions match the "tightly guarded" half.
- **Principle 2, "everything is a module"** — categories become data with modules *declaring*
  ownership (`owned_by_module`) instead of finance hardcoding a list of its neighbours. A future
  module posts to finance without editing a `CHECK` constraint.
- **Principle 5, bilingual from day one** — labels are bilingual in the data, not retrofitted.
- **Principle 7, evolution not revolution** — every change is additive; no existing posting
  function changes behaviour, no historical row is invalidated.

**Forward-compatibility note (not a blocker, raised for the record):** principle 6 also
requires *per-initiative* money visibility in Phase 3. This initiative builds a single global
taxonomy with no visibility dimension. That is correct for today — there are no initiatives yet
— but when Phase 3 lands, `finance.categories` will likely need either a scope column or
per-initiative categories. Noted here so it is a known extension point rather than a surprise.

## 9. Open questions

- ~~`finance.expected` category enforcement: stored generated `kind` column + composite FK, or
  validation trigger?~~ **Resolved (PR A):** the generated column works — verified on the local
  stack that a stored generated column is usable as an FK referencing column and that an `in`
  row pointing at an expense category is rejected. Declarative, no trigger. One constraint
  discovered: Postgres rejects `ON UPDATE CASCADE` on an FK containing a generated column, so
  neither taxonomy FK cascades — safe, because `key` is not client-updatable (column grant).
- Does the reconciliation banner belong in `FinanceModule` only, or also on the POS day view
  where the unposted-day fix actually happens? (PR B)
- Transfers UI: own tab, or a kind-filter chip inside the entries list? (PR D)

## 10. Close-out

*(to be written when the initiative completes — what shipped, decisions made along the way,
what was deliberately left out, and the alignment verdict against VISION.md + ARCHITECTURE.md)*
