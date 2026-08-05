# Finance — books integrity (categories · reconciliation · owner override · transfers)

**Kickoff:** 2026-07-31 (Or's brief: "categories must be fixed", "notification if the books
are not aligned with the rest of the modules", "ability to override everything by the owner").
**Branch:** `finance-books-integrity`. **Status:** PR A committed (2026-08-03, `5f66a26`);
PRs B and C code-complete and verified locally, pending review + commit; PR D not started.

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
| Alert surfaces | Per-module tile badges · in-module banner · dedicated tab. **Revised 2026-08-05:** each tile shows only the items that module *owns*, not the global total — see §4 |
| Alert behavior | Live-computed, never dismissible; each item carries its one-click fix |
| Override model | Correction entry; derived rows stay immutable — §7.4 preserved. The day pin ships too but is a **separate, explicit** action — see the PR C deviation below (revised 2026-08-03 on measured behaviour) |
| Tips | Stay out of the books |
| `makrer` | Kept ACTIVE with a clearer label (מקרר ושתייה / برّاد ومشروبات). Revised from "archive it" at kickoff once the existing HE/AR labels showed it means *fridge* — i.e. live drinks income, not a legacy tender. Slug deliberately not renamed: history references it |
| Transfers | Own table, **not** a third `kind` on `finance.entries` |
| Sequencing | A → B → C → D |

**Why the override is additive, not an edit.** Beyond invariant §7.4, there is a mechanical
reason: POS re-posts a booked day automatically on any change to its bills, payments or
expenses ([48_pos_day_lifecycle.sql](../../supabase/schema/48_pos_day_lifecycle.sql)). A direct
hand-edit of a POS revenue row would be silently recomputed away by the next expense edit. The
additive correction has no such problem — and that turns out to matter more than expected; see
the deviation recorded under PR C.

> **Deviation, recorded 2026-08-03 (PR C build).** The kickoff decision above paired every
> correction with an automatic day pin, on the premise that the auto re-post would otherwise
> overwrite it. **That premise is false**, and the difference was measured, not argued:
> `pos.post_day()` totals a leg from `source_module = 'pos'` rows only, so an `override` row is
> invisible to it. A day corrected to ₪150 and then given another ₪100 of takings re-posts to
> ₪300 pos + (−50) override = **₪250** — the right answer, since the correction records a known
> discrepancy rather than a permanent ceiling.
>
> Auto-pinning was therefore not merely unnecessary but **harmful**: a pin freezes the *whole*
> day, so the first test of it silently swallowed ₪80 of real food cost entered afterwards.
> PR C ships the correction with **no** implicit pin. Pinning remains as an explicit owner
> action for when freezing is the actual intent (a closed period, a disputed day), and the
> reconciliation list keeps every pin visible so a freeze cannot decay into invisible drift.
> Both behaviours are pinned as assertions in `rls_matrix.sql` rather than left to comments.

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
- `finance.reconciliation_counts()` → jsonb map of module key → count, the cheap version the
  launcher badges call. **Revised 2026-08-05** (Or, verifying on staging: "why in the pos it is
  marked like 2?"). Both tiles used to show the same global total, so POS advertised problems
  POS cannot solve — an overdue deposit is not a POS failure. Every item now names the module
  RESPONSIBLE for it (`reconciliation_items.modules`): POS owns unposted days, recompute drift
  and pins; an expectation is owned by the module that created it, so a deposit from a signed
  quote badges **quotes**. `finance` is always the full actionable total — the books are
  finance's business whoever caused the drift, and a hand-created expectation is owned by
  nobody else.
  The shell names no module: the DATA decides which tiles light up, so a future module that
  posts to finance badges itself by writing its own provenance, with no shell change
  (ARCHITECTURE.md §6). This deleted the `BadgeSource` indirection in `Launcher.tsx`.

### `56_finance_override.sql` (PR C) — **shipped 2026-08-03**

- `finance.post_correction(p_entry, p_amount, p_reason)` — owner-only. The owner states the
  correct **total**; the server computes the delta from what the books actually hold and posts
  it as an additive row with `source_module = 'override'` and
  `source_ref = 'override:<target>:c<n>'`. The original posting is never touched.
- **The target is resolved, not assumed.** Correcting a POS leg means the whole leg — its
  original posting, every `:r<n>` re-post correction since, and every override already applied
  — because correcting only the row the owner happened to click would be undone by the next
  re-post. Correcting a correction resolves back to the original target rather than nesting.
  `finance.correction_target()` owns this and is internal; `correction_preview()` is the gated
  read the form needs (the client must never compute a leg total it has not loaded).
- A reason is **required** by the DB, not just the form: an override with no stated reason is an
  unauditable number, and staying explainable is the entire basis for allowing it.
- `pos.day_pins (business_date pk, reason, pinned_by, pinned_at)` — an explicit freeze, **not**
  implied by a correction (see the deviation above). Lives in
  [48_pos_day_lifecycle.sql](../../supabase/schema/48_pos_day_lifecycle.sql), next to the
  re-post logic that honours it and — decisively — *before* `55`, which reads it: a table
  created in a later-numbered file could not be referenced there on a fresh install.
- The refusal lives in `pos.post_day()` rather than `pos.close_day()`, so **every** caller
  inherits it. `pos.repost_if_posted()` checks the pin first and skips **silently**, because it
  runs inside a trigger on someone else's expense edit and must not abort an unrelated write.
- New owner-only permission `finance.override`; `pos.day_pins` RLS reads with
  `pos.reports` **or** `finance.view` (a pin is never a secret) and writes with
  `finance.override`. `pinned_by`/`pinned_at` are not client-writable — a client that could
  write them could forge who froze a day.
- **PR B's check 2 amended, as required:** pinned days are excluded from `recompute_drift` and
  reported by a new check 4 as `type = 'pinned'`. Severity is **not** constant — `low` while the
  freeze costs nothing (so the badge never sits permanently lit on a deliberate state),
  escalating to `medium` the moment money starts piling up behind it. `reconciliation_count()`
  counts non-`low` items only, and the UI's "all clear" now keys off `items.length`, never
  `count`.
- Also retired here: `47_pos_payments.sql`'s stale copy of `pos.post_day` (superseded by 55).
  Left in place, a re-run of 47 would have restored a `post_day` with no pin check at all.

### `57_finance_transfers.sql` (PR D) — **shipped 2026-08-03**

- `finance.transfers (id, amount, from_method, to_method, transfer_date, note, created_by,
  created_at, updated_at)`, RLS mirroring `finance.entries` (`finance.view` / `finance.manage`).
  **No new permission** — a transfer is ordinary money handling.
- Read by nothing that sums income or expense, by construction. `rls_matrix` asserts this
  directly: recording a transfer creates no `finance.entries` row and does not move
  `finance.report()`'s totals, so a future change that routes transfers through the ledger
  fails loudly instead of silently distorting the P&L.
- Constraints: positive amount, both methods from the same four `finance.entries` allows, and
  `from_method <> to_method` (a transfer to the same pocket is a typo that would read as real
  movement in any future balance view). `created_by` is not client-writable.
- **Open question resolved:** a dedicated **TransfersTab**, not a filter inside the entries
  list. The entries list, its kind filter, its pagination and its edit/delete paths all assume
  every row is an income or an expense; threading a third kind through them would reintroduce
  one layer up exactly the coupling the separate table exists to avoid. The tab strip was made
  to wrap on phones to fit the sixth tab.
- Deliberately **not** included: a running cash-on-hand balance. That needs an opening balance
  per method and a rule for which POS takings reach the drawer — its own initiative.

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

**Deviations taken in PR B, recorded here because this section is the contract:**
- `finance.reconciliation()` / `reconciliation_count()` are **`SECURITY DEFINER` with an
  explicit `core.has_permission('finance.view')` check**, not invoker-rights as written
  above. Invoker rights are right for `report()`/`event_pnl()`, which read only
  `finance.entries` — every `finance.view` holder can already see those rows. These two must
  read `pos.pos_payments` / `pos_bills` / `pos_expenses` to know whether a day's money exists
  at all, and under invoker rights a finance reader without POS permissions would see zero POS
  rows and be told the books are perfectly aligned — the worst possible answer from a function
  whose job is finding missing money.
- `pos.day_expected_legs()` took the third option: **definer with NO permission check, revoked
  from every client role** (the `pos.post_day` posture). It has two callers that cannot share a
  gate — the auto re-post trigger, which runs as whichever staff member edited an expense, and
  the reconciliation report, which runs for a finance reader who may hold no POS permission at
  all. The gate therefore lives on the public entry points, and `rls_matrix` asserts the
  function is unreachable from `staff` and `manager` alike.
- `finance.reconciliation_items()` (added during PR B's `/simplify`) is internal for the same
  reason: it is the shared row source both public entry points read, so the count can be a real
  `count(*)` instead of building a payload and discarding it.

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
- ~~Does the reconciliation banner belong in `FinanceModule` only, or also on the POS day view
  where the unposted-day fix actually happens?~~ **Answered (PR B):** banner in `FinanceModule`
  only, plus a count badge on **both** the finance and POS launcher tiles — the books drift in
  finance but the usual fix is a POS action, so the warning must be visible from whichever tile
  you were reaching for. No POS day-view surface: each drift row already deep-links into
  `/pos?report=<date>` via the existing `posReportHref()` contract.
- Transfers UI: own tab, or a kind-filter chip inside the entries list? (PR D)

## 10. Close-out

**Delivered 2026-08-03**, all four PRs, on branch `finance-books-integrity`
(`5f66a26` PR A · `3d1bf42` PRs B+C · PR D in the following commit).

### What shipped

| PR | Delivered |
|---|---|
| **A** | `finance.categories` — owner-editable taxonomy replacing a `CHECK` declared 3× across 2 files plus a client mirror; `owned_by_module` becomes the single source of the derived-only rule; composite `(kind, category)` FKs on **both** `entries` and `expected`, closing the free-text hole on `expected.category`; owner-only `finance.categories` permission; CategoriesTab |
| **B** | `finance.reconciliation()` / `_count()` over live checks; `pos.day_expected_legs()` extraction so the `source_ref` grammar has one author; launcher badges on the finance **and** POS tiles, in-module banner, dedicated ReconcileTab with a one-click fix per item |
| **C** | `finance.post_correction()` — additive owner correction against any module-posted row; `pos.day_pins` freeze with the refusal in `post_day()` so every caller inherits it; owner-only `finance.override` permission; CorrectionForm + pin toggle on the POS day view |
| **D** | `finance.transfers` — cash↔bank as its own table, outside every income/expense total; dedicated TransfersTab |

### Decisions that changed during the build

1. **`makrer` kept active, not archived** (PR A). Its existing HE/AR labels showed it means
   *fridge* — live drinks income, not a legacy tender. Relabelled `מקרר ושתייה` /
   `برّاد ومشروبات`; slug deliberately unchanged, since renaming a key silently re-files history.
2. **A correction does NOT auto-pin its day** (PR C) — the significant one. The kickoff decision
   paired the two on the premise that the auto re-post would otherwise overwrite the correction.
   Measured: `post_day()` totals a leg from `source_module = 'pos'` rows only, so an override row
   is invisible to it and survives re-posting unaided. Auto-pinning was also actively harmful — a
   pin freezes the whole day, and the first test silently swallowed ₪80 of food cost entered
   afterwards. Full reasoning under §3; both behaviours are now `rls_matrix` assertions.
3. **Pinned days get their own reconciliation check** with variable severity — `low` while the
   freeze costs nothing (so the badge never sits permanently lit on a deliberate state),
   `medium` once money piles up behind it. `reconciliation_count()` counts non-`low` items only.
4. **Transfers get a dedicated tab**, not a filter in the entries list (§4, PR D).

### Deliberately left out

Signed-quote-vs-booked reconciliation (needs the events module surface), partial payments on
`finance.expected` (pre-existing open item — note it will need a *remaining* amount once it
lands, since check 3 flags on `due_date` against the full amount), tips in the books,
sub-categories, and a running cash-on-hand balance (needs opening balances per method).

### Alignment verdict

**ARCHITECTURE.md §7 — passes.** Re-checked against the delivered code, not the plan:

| Invariant | Verdict on what shipped |
|---|---|
| 1. RLS everywhere, UI never the only gate | ✅ `categories`, `day_pins`, `transfers` all ship RLS + policies; every gated function checks `core.has_permission` in the DB. `rls_matrix` proves staff and manager are shut out of each owner-only path |
| 2. Anon keys only in the browser | ✅ no new secrets, no edge function |
| 3. No PII in the public repo | ✅ labels and amounts only |
| 4. Business invariants in Postgres | ✅ **§7.4 preserved exactly** — the override is additive; `entries_guard()` still rejects every client edit and delete of a derived row, for the owner too. The pin is a DB table checked inside `post_day()`/`repost_if_posted()`, never a UI flag |
| 5. HE + AR everywhere | ✅ category labels bilingual *in the data*; all new UI through shell i18n; both languages required by a DB CHECK |
| 6. Public visibility flag | n/a — finance is internal |
| 7. Live tools keep working | ✅ the §7 watch item held: the `'pos:<date>:<leg>[:r<n>]'` grammar is byte-identical, now authored in exactly one place (`day_ref_prefix` writer / `day_ref_leg` reader) and asserted by the re-post tests. PR C additionally retired 47's stale `post_day` copy, which would have restored a pin-blind version on any re-run |
| 8. ROADMAP is the tracker | ✅ all four PRs ticked |

**VISION.md — passes.** Principle 6 ("real ventures, real numbers — tightly guarded") is the
direct target: the books now say when they lag reality instead of failing silently, which is the
production failure that started this. Principle 2 ("everything is a module") is served by
`owned_by_module` — modules declare their own category ownership instead of finance hardcoding a
list of its neighbours. Principle 5 (bilingual) and 7 (evolution, not revolution — every change
additive, no historical row invalidated) both hold.

**No drift found; no conflict to escalate.** The one deviation from the kickoff contract
(decision 2 above) is a change to *how* the agreed capability is delivered, not to the capability
or to any invariant — it makes §7.4 more true, not less. It is recorded in §3 and was surfaced to
the owner when it was made.

### Follow-ups discovered

- **Cash-on-hand balance per payment method** — transfers now record the movement, but nothing
  yet shows the resulting drawer/bank position. Needs opening balances and a rule for which POS
  takings land in the drawer.
- **Phase 3 forward-compat** (carried from §8): per-initiative money visibility will want a scope
  dimension on `finance.categories`. Known extension point, not a blocker.
- **H6** (`finance.expected` write guard, which must also cover `finance.record_payment()`)
  remains open and is tracked on the roadmap independently of this initiative.
