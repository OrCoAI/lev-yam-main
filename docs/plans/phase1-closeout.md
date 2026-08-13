# Phase 1 + Phase 1.5 close-out — the remaining stragglers

*Kickoff 2026-08-12 · branch `phase1-closeout` · closes the open items in **Phase 1** and
**Phase 1.5** of [ROADMAP.md](../ROADMAP.md)*

## Why

Phase 1 and Phase 1.5 are ~95% delivered: quotes and POS are migrated and live, the spines
carry money and events, the users suite is complete, staging exists, H8 shipped observability
on the edge functions. What is left is a scatter of stragglers — two live security gaps, one
mobile-first regression, one un-closed security-review finding, and a money bug that silently
loses the remainder of a partial payment. This initiative closes them so Phase 2 (bookings &
events) starts from a clean base.

**H9 (observability coverage) is the one large item still inside Phase 1.5.** It has its own
plan — [observability-coverage.md](observability-coverage.md) — and runs last, after the
stragglers, per the owner's sequencing decision.

## Corrections found at kickoff (2026-08-12)

Four agents mapped every open item against the code before any was scheduled. **Three roadmap
entries turned out to be factually wrong**, and one prescribed fix would have broken a live
flow. These corrections are the reason this plan exists rather than a straight run down the
checklist — and per CLAUDE.md's conflict rule they were raised with the owner and resolved
before any code.

| # | Roadmap said | Ground truth | Resolution |
|---|---|---|---|
| 1 | Topbar fix = "drop `.user-email` to an avatar/initials at the phone breakpoint" | `.user-email` is **already** `display:none` at ≤640px ([styles.css:493](../../app-src/src/styles.css#L493), since `4218c73`, 2026-07-01 — *before* the bug was logged). It measures 0px at 360. The proposed fix saves **nothing**. The roadmap's inventory also omits the `RoleBadge` (53.8px), the second-largest item. | Fix the real contributors instead — see §C. |
| 2 | H6 = "call the `finance.assert_category_writable()` hook PR A added" | The `events` category is `owned_by_module='quotes'` ([54_finance_categories.sql:110](../../supabase/schema/54_finance_categories.sql#L110)) and **every** quotes deposit/balance expectation is filed under it ([40_events.sql:369-381](../../supabase/schema/40_events.sql#L369-L381)). An unconditional call rejects the quotes module's primary money path. Its `active` half would also contradict the deliberate carve-out at [54:170-178](../../supabase/schema/54_finance_categories.sql#L170-L178). | Owner-vs-poster predicate + owner bypass — see §B. |
| 3 | `rls_matrix` "assumes the `aaaaaaaa-…` actors from `supabase/seed.sql`" | `seed.sql` contains **zero** such UUIDs (its users are `00000000-…-00000000000{1,2,3}`, [seed.sql:36-38](../../supabase/seed.sql#L36-L38)). The suite **already seeds its own five actors** at [rls_matrix.sql:203-223](../../supabase/tests/rls_matrix.sql#L203-L223). The stated fix is a no-op. The real blocker is that the suite deliberately deletes **real** grants to stage global guard states ([:978-982](../../supabase/tests/rls_matrix.sql#L978-L982), [:844-846](../../supabase/tests/rls_matrix.sql#L844-L846), [:1374-1382](../../supabase/tests/rls_matrix.sql#L1374-L1382)). | Drop the item, rewrite the entry honestly — see §E. |
| 4 | "the prod check that *does* work is the grant/objects audit in the deploy script" | **That script does not exist.** `deploy.yml` runs only `check-permission-drift.mjs` and `build-baseline.mjs` ([deploy.yml:39-45](../../.github/workflows/deploy.yml#L39-L45)) — both file-vs-file, neither touches any deployed database. The 62-revoke audit was an uncommitted ad-hoc management-API query. | Commit it — see §D. |

**One trap, not a correction, recorded so it is never attempted casually:** `supabase db push`
against prod would be **destructive**. Prod has never been linked, so its migration ledger is
empty and `push` would replay the entire 316KB baseline — which recreates the anon-writable POS
surface the 2026-07-14 cut-over closed ([10_pos.sql:246-263](../../supabase/schema/10_pos.sql#L246-L263):
`for all to anon using (true)` plus grants on `pos_tables`/`pos_bills`/`pos_bill_items`/`pos_expenses`),
runs `delete from core.role_permissions where module='pos'` on live rows, and executes 69
`drop policy` / 39 `drop trigger` statements with the last-admin guard disabled by the bootstrap
window. `supabase migration repair --status applied` must come first, and only after a real
schema diff proves prod matches. This is why §D defers the pipeline. [supabase/README.md:57-62](../../supabase/README.md#L57-L62)
already carries the narrower warning ("never re-run `10_pos.sql`"); this plan widens it.

## Locked scope (owner-aligned 2026-08-12, closed questions)

| Decision | Owner's call |
|---|---|
| H9 sequencing | **Stragglers first, then H9 in full.** Both phases genuinely close; H9 runs as its own four PRs afterwards. |
| Second `users.manage` holder | **Dedicated break-glass owner account** — a new invited account used only for recovery. No existing staff member gains extra power. |
| Topbar fix | **Sign-out → icon + hide the RoleBadge at phone width.** House `.btn-icon-label` pattern, no new component, no new string. |
| H6 predicate | **Owner-vs-poster**, not `assert_category_writable` — reject only when the category is owned by a *different* module than the expectation's own `source_module`. The archived-category check is deliberately **not** applied (honours the [54:170-178](../../supabase/schema/54_finance_categories.sql#L170-L178) carve-out). |
| Owner bypass | **Owner may edit any field on a module-created expectation AND record a payment into any category.** Managers (`finance.manage`) stay restricted. **Derived `finance.entries` stay immutable** — corrections there keep going through PR C's additive override (§7.4 preserved). |
| Audit trail | **New `finance.audit_log`**, readable by `finance.view` holders, trigger-written only. Not `core.audit_log` — that is identity-scoped and readable only by `users.manage`. |
| Expected status rule | **Cancel or fulfil.** Clients may move `open → cancelled` *or* `open → fulfilled` directly, per the original plan wording. |
| Partial payments | **Bundled with H6, one PR** — both rewrite `record_payment()`; splitting means gating and staging the same function twice. |
| Prod migration pipeline | **Commit the audit script, defer the pipeline.** Roadmap entry reworded to name the real prerequisite (a schema-diff proof) instead of staying open-ended. |
| `rls_matrix` against prod | **Drop it**, rewrite the entry. The committed audit covers the real risk without destructive DML. |
| Server-side provenance | **Defer**, reword with a concrete trigger ("first events or dashboard surface"). |

**Explicitly out of scope:**

- **PITR** — checked against the standing 20-signed-contracts rule on 2026-08-12: prod has
  **3 signed** of 7 total `quotes.contracts`. Stays parked, correctly. Not a blocker to
  closing Phase 1.5.
- Server-side provenance resolution (owner decision above) — but note the `:pN` ref grammar
  §B introduces **breaks** `provenance.ts`'s bare-UUID assumption, so that parser is fixed in
  §B regardless.
- Per-user permission overrides, true impersonation — dropped earlier, unchanged.
- Anything in Phase 2 and beyond.

## Work packages, in shipping order

Owner-chosen sequence: **A → C → D → B → E → F**. Ops and quick wins first so the live gaps
close immediately; the large finance PR does not block them.

### A — Ops: close the live gaps *(no PR, management API + app UI)*

- [ ] **`disable_signup = true`** on prod (`teyxtdccsrkdpqnbfcga`) and staging
      (`vhvghcehkcbtygomixmu`) via `PATCH /v1/projects/<ref>/config/auth`. Verified live
      2026-08-12: `false` on **both**. Behaviourally inert — grepped `app-src/src`,
      `supabase/functions`, `js/`, `pos.html`, `index.html`: **zero** `signUp` calls; the only
      auth entry point is `signInWithPassword` ([auth.tsx:154](../../app-src/src/lib/auth.tsx#L154)),
      and invites go through `inviteUserByEmail` ([admin-invite/index.ts:91](../../supabase/functions/admin-invite/index.ts#L91)),
      the service-role Admin API, which `disable_signup` does not gate. Closes the first link
      in the 2026-08-05 escalation chain.
- [ ] **`config.toml` local parity** — `enable_signup = false` at
      [config.toml:184](../../supabase/config.toml#L184) and
      [:229](../../supabase/config.toml#L229) (the CLI uses the *positive* form; the cloud API
      uses the negative). **Do not use `supabase config push`** — it targets the *linked*
      project (staging) and would clobber staging's auth URLs with the localhost values.
- [ ] **Second `users.manage` holder** — invite a dedicated break-glass account and assign it
      `owner` in `/app/users`. Verified live 2026-08-12: exactly one holder (the owner's own
      account, via the `owner` role); the other four accounts are all `staff`. The guard
      counts only **unbanned** holders ([00_core.sql:444](../../supabase/schema/00_core.sql#L444)),
      so a deactivated account does not satisfy this.

### C — Topbar phone fix *(PR 1)*

Measured live at kickoff (`npm run dev` + `?preview`, headless CDP):

| viewport | `documentElement.scrollWidth` | overflow |
|---|---|---|
| 320 | 376 | **56px** |
| 360 | 376 | **16px** |
| 375 | 376 | **1px** |
| 390 | 390 | 0 |

Minimum width needed today is **~390px** = 14 + `.brand` 93.9 + `.topbar-right` 267.9 + 14.
The 267.9 breaks down as sign-out 77.9 · passkey 58.0 · lang-toggle 54.2 · RoleBadge 53.8 ·
3×8px gaps 24 · `.user-email` **0**.

- [ ] Give the sign-out button the house `.btn-icon-label` treatment
      ([Layout.tsx:46-48](../../app-src/src/shell/Layout.tsx#L46-L48)) — it is currently a bare
      `btn-ghost` with a text child, so [styles.css:618](../../app-src/src/styles.css#L618)'s
      existing `.btn-icon-label .btn-label { display: none }` cannot reach it. Same shape
      `EnablePasskey` already uses ([EnablePasskey.tsx:43,50](../../app-src/src/shell/EnablePasskey.tsx#L43)).
- [ ] Hide the `RoleBadge` inside the existing `@media (max-width: 640px)` block
      ([styles.css:489](../../app-src/src/styles.css#L489)) — plain `display:none`, the house
      pattern (precedents: `.user-email` `:493`, `.rowline .rl-more` `:533`, `.u-summaryroles`
      [users.css:238](../../app-src/src/modules/users/users.css#L238)). The role is already
      visible in the users module and the launcher.
- [ ] Keep the 44px tap-target floor ([styles.css:616-617](../../app-src/src/styles.css#L616-L617))
      and the preview-banner offset ([styles.css:98](../../app-src/src/styles.css#L98)) intact.
      Use the **existing** 640px breakpoint — do not add a third (`PHONE_MQ` in
      [useMediaQuery.ts:6](../../app-src/src/lib/useMediaQuery.ts#L6) is kept in sync with it).
- [ ] **Add 360px to [scripts/verify/screenshot.mjs](../../scripts/verify/screenshot.mjs#L39)'s
      viewport list.** It shoots 390 and 1280 only — and 390 is *exactly* the width the topbar
      fits at, which is why every gate screenshot passed clean while 360 was broken. This is
      the item that stops the bug class from recurring, not the CSS fix.

Expected result: `.topbar-right` ~170px → fits 320, 360 and 390 with headroom.

### D — Commit the prod grant/objects audit *(PR 2)*

- [ ] `scripts/audit-prod-grants.mjs` (~40 lines): the 62-revoke audit from 2026-08-05 as
      committed, re-runnable code — asserts every `revoke` declared in `supabase/schema/*.sql`
      is actually in force on the target project, via the management-API `database/query`
      endpoint. Token from a repo secret, never a file.
- [ ] Wire it into `deploy.yml` so prod drift is caught **every deploy**, not once by hand.
- [ ] Document it in [supabase/README.md](../../supabase/README.md) as the prod verification
      path, replacing the claim that this already exists.

This is the cheap 80% of what "make `rls_matrix` runnable against prod" was reaching for, with
none of its destructive DML.

**What it found on its first real run (2026-08-12) — the item paid for itself immediately:**

- 🔴 **`authenticated` held `TRUNCATE` + `TRIGGER` on all four `pos.pos_*` tables, on prod and
  staging.** **TRUNCATE is not governed by RLS**, so every POS policy was bypassable: any
  signed-in staff account could wipe the entire billing history in one statement.
  `finance.entries` and `core.user_roles` were unaffected. **Root cause:** the tables were
  created in `public`, where Supabase's default privileges grant ALL to `anon`/`authenticated`;
  [43_pos_cutover.sql:38-47](../../supabase/schema/43_pos_cutover.sql#L38-L47) moved them to
  schema `pos` and **ACLs travel with the object**. The cut-over revoked `anon` wholesale and
  granted `authenticated` the four DML privileges it needed, but never revoked the four
  inherited ones it did not. *Fixed on both tiers 2026-08-12 and written into `43_pos_cutover.sql`
  §9b; verified `TRUNCATE`/`TRIGGER` now false while SELECT/INSERT/UPDATE survive.*
- 🟠 **15 functions were `EXECUTE`-able by `PUBLIC` (i.e. anon)** because the files granted to
  `authenticated` without first revoking Postgres's default — including the SECURITY DEFINER
  `finance.record_payment`, `pos.pos_day_report`, `pos.range_report`, `quotes.next_quote_number`.
  *Fixed on both tiers and in the files (revoke-before-grant next to each grant). Five of them
  (`pos.require`, `pos.oh_charge`, `pos.report_for_range`, `finance.is_posting`,
  `quotes.try_time`) had **no** explicit `authenticated` grant and lived only on the PUBLIC
  default — a bare revoke would have broken them, so each got an explicit
  `grant execute … to authenticated` in the same statement.*
- 🟡 **14 trigger functions remain PUBLIC-executable** — deliberately deferred (owner decision):
  they return `trigger` and error out when called directly. Tracked as a follow-up below.
- ⬜ **"Staging is more permissive than prod" — RETRACTED 2026-08-12, this was a tool bug, not
  drift.** The first version of `audit-grants.mjs` re-keyed schema-moved objects by *overwriting*
  intent, so `42_pos_platform.sql`'s `authenticated` grants on the POS tables were clobbered by
  `10_pos.sql`'s pre-move map and read as unintended. Re-checked after the ordered-replay rewrite:
  prod and staging are **identical** and both match the files exactly (`pos_bill_items` SELECT ·
  `pos_bills` SELECT+UPDATE · `pos_expenses` SELECT+INSERT+DELETE · `pos_tables` all four).
  **The owner rejected the "fix" mid-session and was right to** — applying it would have revoked
  working privileges from staging and broken POS there. Recorded because it is the sharpest
  lesson of this item: *a new audit's first findings must be treated as suspect until the tool
  itself is verified*, and a confident wrong answer from a security tool is worse than no tool.
- 🟡 **`public.rls_auto_enable`** — a SECURITY DEFINER event-trigger function on prod that
  appears in no schema file. Harmless in shape (event-trigger functions are not usefully
  callable) but undeclared; worth adopting into the files or removing.

### B — Finance money integrity: H6 + owner override + partial payments *(PR 3, the large one)*

Two SQL functions and one new table. **Edit `21_finance_spine.sql` and `54_finance_categories.sql`
in place — do not author a new `58_*.sql` that re-declares the guards.**
[54:200-202](../../supabase/schema/54_finance_categories.sql#L200-L202) is explicit that
`expected_guard`/`entries_guard` are authored "here and ONLY here", because a second copy means
a re-run of `54` silently restores the weaker guard — the exact failure
[21:87-92](../../supabase/schema/21_finance_spine.sql#L87-L92) records.

**H6 — the table guard** ([`finance.expected_guard()`](../../supabase/schema/54_finance_categories.sql#L247-L311)):

- [ ] The hole is [54:303-306](../../supabase/schema/54_finance_categories.sql#L303-L306): on
      UPDATE, if `(category, direction)` are unchanged the guard returns early — so a
      `finance.manage` holder may freely change **amount, due_date, reason, note, event_id,
      status, fulfilled_by, created_by** on a *quotes-created* expectation, silently breaking
      its pairing with the signed quote.
- [ ] New rule: when not posting and `old.source_module is not null` — **owner** (`finance.override`)
      may change anything; everyone else may change only `status`. Manual rows
      (`source_module is null`) keep today's behaviour verbatim.
- [ ] Breaks **zero** existing client flows: `ExpectedTab` is the only writer and only ever
      writes `status='cancelled'` ([ExpectedTab.tsx:144-149](../../app-src/src/modules/finance/ExpectedTab.tsx#L144-L149)).
      No INSERT, no DELETE, no field edit anywhere in the module.

**H6 — the `record_payment()` half** ([21:140-198](../../supabase/schema/21_finance_spine.sql#L140-L198)):

- [ ] Add the owner-vs-poster category check after the `for update` lock
      ([:161](../../supabase/schema/21_finance_spine.sql#L161)) and **before** the posting GUC
      goes on ([:176](../../supabase/schema/21_finance_spine.sql#L176)) — once the GUC is on,
      `entries_guard` short-circuits and `exp.category` lands unchecked. Owner exempt.
- [ ] Move the GUC reset from [:191](../../supabase/schema/21_finance_spine.sql#L191) to *after*
      the `update finance.expected` at [:195](../../supabase/schema/21_finance_spine.sql#L195),
      so the function's own status + `fulfilled_by` write is a posting write. (The alternative —
      whitelisting `fulfilled_by` in the guard — would leave a client able to point it at an
      arbitrary entry.)
- [ ] Add the missing `revoke all … from public` before the `authenticated` grant at
      [21:250](../../supabase/schema/21_finance_spine.sql#L250). Every other finance definer
      function revokes first; this repo has been bitten twice by the leftover implicit PUBLIC
      grant. Unreachable today, same shape.

**`finance.audit_log`** (new, in `21_finance_spine.sql`):

- [ ] `(id, at, actor uuid default auth.uid(), action, table_name, row_before jsonb,
      row_after jsonb)`. RLS: select for `finance.view`; **no client write policy** —
      trigger-written only, same posture as `core.audit_log`
      ([00_core.sql](../../supabase/schema/00_core.sql)). AFTER trigger on `finance.expected`
      recording owner overrides of module-created rows.

**Partial payments:**

- [ ] Today `p_amount` defaults to `exp.amount` and the only validation is `<= 0`
      ([21:172-174](../../supabase/schema/21_finance_spine.sql#L172-L174)); the function then
      *unconditionally* sets `status='fulfilled'`
      ([21:193-195](../../supabase/schema/21_finance_spine.sql#L193-L195)). ₪1 against a ₪5,000
      deposit marks it fully paid and the ₪4,999 vanishes from the plan side — out of the open
      list, out of the open-expected stat, out of reconciliation check 3
      ([55:364-365](../../supabase/schema/55_finance_reconciliation.sql#L364-L365)).
- [ ] Add `finance.expected.paid_amount numeric(12,2) not null default 0`; `record_payment`
      computes the remainder, rejects overpay, and closes the row only when it reaches 0.
- [ ] **Ref grammar must extend** — `finance_entries_posting_uniq` on
      `(source_module, source_ref, kind, category)`
      ([21:60-62](../../supabase/schema/21_finance_spine.sql#L60-L62)) collides on a second
      payment against the fixed ref `'expected:'||exp.id`
      ([21:187](../../supabase/schema/21_finance_spine.sql#L187)). Use `expected:<id>:p<n>` —
      the same device `post_day` uses for `:r<n>` and override for `:c<n>`
      ([56:36-41](../../supabase/schema/56_finance_override.sql#L36-L41)). In the quotes path
      the collision is quieter still: `on conflict … do nothing`
      ([40:439-440](../../supabase/schema/40_events.sql#L439-L440)).
- [ ] **`fulfilled_by` is a 1:1 FK** ([21:111](../../supabase/schema/21_finance_spine.sql#L111))
      — many payments per expectation breaks it. Decide in the PR: keep it pointing at the
      closing entry, or replace with a derived lookup.
- [ ] **`quotes.settle_on_paid()`** ([40:414-451](../../supabase/schema/40_events.sql#L414-L451))
      closes every open deposit/balance at **full** `exp.amount`
      ([40:436](../../supabase/schema/40_events.sql#L436)) — must post only the remainder, or a
      partially-paid deposit double-posts on quote settlement.
- [ ] **Reconciliation check 3** ([55:343-365](../../supabase/schema/55_finance_reconciliation.sql#L343-L365))
      must report `amount - paid_amount` and keep flagging partially-paid overdue rows.
- [ ] **`provenance.ts` is a breaking coupling** —
      [:30-32](../../app-src/src/modules/finance/provenance.ts#L30-L32) and
      [:86-88](../../app-src/src/modules/finance/provenance.ts#L86-L88) both require the segment
      after `expected:` to be a *bare* UUID. A `:p<n>` suffix silently kills every quote link.
      Fix here even though the broader provenance item is deferred. `dev/mock-net.ts` holds a
      third copy of the grammar and follows.
- [ ] **UI, no new surface:** replace the blocking "the expectation will close in full —
      continue?" confirm ([ExpectedTab.tsx:333-349](../../app-src/src/modules/finance/ExpectedTab.tsx#L333-L349),
      strings [i18n.ts:91-92](../../app-src/src/modules/finance/i18n.ts#L91-L92) HE /
      [:279-280](../../app-src/src/modules/finance/i18n.ts#L279-L280) AR) with a real
      paid/remaining display on the row.

**Expectation re-open (finance follow-up #2's real residue):**

- [ ] PR C's owner override **already reaches** `source='finance'` payment rows —
      `correction_target` falls through to `'entry:'||e.id`
      ([56:93-95](../../supabase/schema/56_finance_override.sql#L93-L95)) and the UI already
      renders the `±` button for them ([EntriesTab.tsx:278-289](../../app-src/src/modules/finance/EntriesTab.tsx#L278-L289)).
      The roadmap's "immutable with no corrector" wording is **stale**.
- [ ] What is genuinely missing: after correcting a payment to zero, the expectation stays
      `fulfilled` with a dangling `fulfilled_by`, so the money can never be re-recorded. Add a
      re-open path (behind the posting GUC so `expected_guard` allows it) and, with
      `paid_amount` above, decrement rather than re-open on partial reversals.
- [ ] **Known residue, deliberately not fixed here:** correction rows carry
      `payment_method = null` ([56:206](../../supabase/schema/56_finance_override.sql#L206),
      deliberate — "a correction moves the books, not a drawer"), so `finance.report`'s
      `by_payment` breakdown still shows a reversed payment's full cash leg. Totals stay right;
      the cash column overstates. Changing it alters `by_payment` semantics and deserves its own
      decision — logged as a follow-up.

**`rls_matrix` additions** (fixture `bbbbbbbb-…-000000000003` is already a quotes-sourced
expectation seeded behind the GUC at [:249-256](../../supabase/tests/rls_matrix.sql#L249-L256)):

- [ ] manager: `update finance.expected set amount = 999` on a module row → raises; same for
      `due_date`, `reason`, `note`, `event_id`, `fulfilled_by`.
- [ ] manager: `status` transitions still succeed (existing assertion
      [:624-626](../../supabase/tests/rls_matrix.sql#L624-L626) must keep passing).
- [ ] **owner**: all of the above **succeed**, and each writes a `finance.audit_log` row.
- [ ] manager: `record_payment` on a quotes expectation **still works** and posts under
      `events` — the regression proving the new check did not over-fire.
- [ ] manager: fulfilling an expectation under a **since-archived** category still works — pins
      the [54:170-178](../../supabase/schema/54_finance_categories.sql#L170-L178) carve-out.
- [ ] Two sequential partial payments against one expectation both post, `paid_amount`
      accumulates, and the row closes only on the last one.
- [ ] After `record_payment`, a plain client insert into `finance.entries` with `source_module`
      still raises — proves the moved GUC reset still closes the window.
- [ ] Manual (provenance-free) expectations remain fully editable — existing
      [:648-651](../../supabase/tests/rls_matrix.sql#L648-L651) stays adjacent to the new ones.

Then `node supabase/tests/build-baseline.mjs --write`. Prod (still off the pipeline) takes the
`create or replace function` statements plus the new table/column by hand.

### E — Roadmap rewrites *(docs, folded into the last PR)*

- [ ] **`rls_matrix` against prod** → replace with the honest statement: the destructive suite is
      local/staging-only *by design* (it deletes real grants to stage global guard states), and
      prod is verified by §D's audit script.
- [ ] **Prod on the migration pipeline** → name the real prerequisites: a schema-diff proof that
      prod matches the baseline, `migration repair --status applied` before any push, and
      connectivity from CI (the dev box cannot reach the pooler,
      [platform-staging-environment.md:153-155](platform-staging-environment.md)). Record the
      destructive-replay trap.
- [ ] **Reversal path** → rewrite rather than tick: the corrector exists as of PR C; §B closes
      the plan-side residue.
- [ ] **Server-side provenance** → name the concrete trigger ("first events or dashboard
      surface, or a fifth consumer") instead of leaving it open-ended.
- [ ] **Topbar** → correct the diagnosis in the close-out so the record isn't wrong in history.
- [ ] Tick H6, the topbar, partial payments, and the four prod-hardening items.

### F — H9 observability coverage *(4 PRs, own plan)*

See [observability-coverage.md](observability-coverage.md). Runs last. Phase 0 is 2/3 done.

## Architecture invariants check ([ARCHITECTURE.md §7](../ARCHITECTURE.md#L221))

- **1 — RLS on every table; UI gating never the only gate:** ✅ H6 is a DB trigger; the owner
  bypass is checked by `core.has_permission('finance.override')` server-side, not by hiding a
  button. `finance.audit_log` gets RLS with no client write policy.
- **2 — Anon keys only in the browser; service-role only in Edge Functions:** ✅ unchanged. §D's
  audit script takes its management token from a repo secret at runtime.
- **3 — No PII, secrets, or signatures in the repo:** ✅ `finance.audit_log` stores row snapshots
  **in the database**, never exported to the repo. §D asserts grants, it does not dump data.
- **4 — Business invariants enforced in Postgres:** ✅ this is the heart of §B — the guard, the
  remainder arithmetic, and the audit are all triggers and definer functions, not client rules.
  **§7.4's derived-row immutability is explicitly preserved:** the owner bypass covers
  `finance.expected` only; `finance.entries` corrections stay additive through PR C's override.
- **5 — Both languages, RTL correct:** ✅ new guard exception messages ship HE+AR (the house rule
  from MODULE-TEMPLATE §1). §C adds no new string — it collapses an existing one to an icon and
  hides a badge, and `.btn-label` collapse is already bilingual. `satisfies Record<string,
  Record<Lang, string>>` ([i18n.tsx:74](../../app-src/src/lib/i18n.tsx#L74)) makes a missing
  language a compile error.
- **6 — Visibility flag on public content:** N/A — nothing here is public-facing.
- **7 — Live tools keep working until parity:** N/A — POS is already cut over.
- **8 — ROADMAP is the single tracker:** ✅ §E is literally this, and it corrects four entries
  that were misleading the tracker.
- **§4 Mobile-first:** ✅ §C is a direct mobile-first repair, and the `screenshot.mjs` viewport
  addition makes the invariant *testable* rather than assumed.

**No conflicts.** The one candidate — letting the owner edit derived `finance.entries` directly —
was raised at kickoff and the owner chose the option that preserves §7.4.

## Vision check ([VISION.md](../VISION.md))

Infrastructure, not product: nothing here is seen by a member or guest. Its justification is
that Phase 2 (bookings & events) and Phase 3 (per-initiative finance) both build directly on the
money spine and the permission surface this batch repairs — a partial-payment bug and an
editable module-owned expectation become much more expensive once initiatives have their own
budgets. §C serves "staff and members work from phones" literally. No conflict.

## Follow-ups (logged, not scope)

- **15 functions still PUBLIC-executable by the schema files** (§D) — owner deferred; low risk
  (14 are trigger functions that error when called directly), one sweep. Worth pairing with a
  **ratchet**: an explicit allowlist of the known-deferred names in `audit-grants.mjs`, failing
  on anything outside it, so the backlog stays unblocking but cannot quietly grow.
- **`audit-grants.mjs` gates the prod deploy** — a management-API blip (exit 2) blocks shipping
  an unrelated marketing change. Consider moving it to its own job or a scheduled run so the
  signal goes red without coupling to the Pages publish.
- **`screenshot.mjs` reports overflow but always exits 0** — enforcement lives in a CLAUDE.md
  sentence, the same class of guarantee that failed for five weeks. An opt-in
  `--assert-no-overflow` exit code (plus naming *which* element overflows) would turn the
  symptom into an enforceable diagnosis.
- **Column-level grants are not audited** (`pg_attribute.attacl`) — and the repo uses them as a
  real control (`events.events` for anon, `finance.transfers`, `finance.categories`,
  `pos.day_pins`). A hand-run `grant update (kind) on finance.categories to authenticated` on
  prod would let staff reclassify income as expense and would **not** be caught.
- **The audit is one-directional** — it finds privileges live has that the files don't intend,
  never a `grant` that was never applied. That half shows up as a staff-facing "permission
  denied" instead.
- **`public.rls_auto_enable` is undeclared** (§D) — adopt into `supabase/schema/` or drop.
- **Supabase's default privileges on `public` are a standing hazard** — anything created there
  gets ALL granted to `anon`/`authenticated`, and the grant survives a later `set schema`. Any
  future table born in `public` inherits the same TRUNCATE hole.
- `payment_method` attribution on correction rows (§B residue above).
- Full migration pipeline for prod — blocked on a schema-diff proof (§E).
- Server-side provenance resolution — trigger named in §E.
- PITR — parked at 3/20 signed contracts.
- `deno check` in `ci.yml` and the `login/options` rate limit — absorbed by H9 Phase 3.
