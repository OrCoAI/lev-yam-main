# Lev Yam Platform — Roadmap

The path from today's platform to the [vision](VISION.md). Ordered by **value and
dependency** (steady pace, no external deadline). Tick tasks as they complete; each work
session should start by reading this file and end by updating it.

**How we work:** one phase = one or more feature branches off `main`; verify against the
**local Supabase stack** (`supabase start && supabase db reset`, then `cd app-src && npm run dev`;
static pages via `python3 -m http.server 8080`) — and, for prod-like checks, the **staging tier**
(`lev-yam-staging` / staging.levyam.com) — before pushing. `main` still deploys straight to prod.
DB changes go through `supabase/schema/*.sql` (source of truth) plus the generated baseline the
migration pipeline applies (`supabase/tests/build-baseline.mjs`; see
[plans/platform-staging-environment.md](plans/platform-staging-environment.md)). `pos.html` and the
marketing site stay untouched until their replacement earns cut-over on real service days.

---

## Phase 0 — Platform foundation ✅ (done, live)

- [x] `/app` shell: Vite + React + TS, react-router (`basename /app`), CI deploy to Pages
- [x] Supabase auth + passkeys (`01_passkeys.sql`, `passkey-verify` edge function)
- [x] RBAC: role → module → action, RLS via `core.has_permission()` (`00_core.sql`)
- [x] Users admin module (roles: owner / manager / staff / viewer)
- [x] Finance module: entries + report (`20_finance.sql`)

## Phase 1 — First migrations: quotes manager, then POS (+ bilingual core)

*The quotes manager goes first: it's the smallest complete tool — the cheapest way to prove
the module pattern — and it's used by one person, so a migration hiccup costs nothing (the
POS is live on real service days). Its migration produces the documented module template
that POS and every later module follow. The i18n layer lands at the very start so nothing
bilingual is ever a retrofit.*

- [x] **Foundation:** platform i18n layer (HE + Levantine Arabic, RTL-aware) in the app
      shell — dictionaries, language switcher, translated shell/login/launcher; every module
      from here on ships in both languages *(live 2026-07-08; follow-ups: bilingual module
      labels in `core.modules`, Arabic webfont — system-font fallback for now)*
- [x] **Quotes manager joins the platform** — migrate the local quotes & contracts app
      (`~/lev-yam-quotes`: Python API + React dashboard + `quotes-tracker.json` as source of
      truth) into a quotes module at `/app/quotes`.
      **Never copy that app into this repo** — it holds customer PII, signed contracts, and
      the owner's signature, and everything here deploys publicly to GitHub Pages; it stays a
      separate local app until this migration. **Full migration plan:
      [plans/quotes-module.md](plans/quotes-module.md)** — schema `30_quotes.sql`, dashboard
      → module UI, documents rendered from DB, one-time data import, parity cut-over
      *(done 2026-07-09: module live at `/app/quotes`; data imported — 12 quotes,
      3 contracts with full document content parsed from the saved HTML files, checklist
      template, signed-contract PDF/HTML snapshots in the private `quotes-docs` bucket;
      `~/lev-yam-quotes` archived to a private GitHub repo, read-only from now on)*
- [x] **Foundation:** extract a documented module template from the quotes migration
      ("how to add a module": schema + RLS, `core.modules` row, permissions, folder, route,
      launcher tile) — this is what makes the flexibility dream cheap later
      *(written 2026-07-09: [MODULE-TEMPLATE.md](MODULE-TEMPLATE.md) — the checklist the
      POS migration follows; update it whenever a migration teaches something new)*
- [x] **Foundation: cross-module spines (events, money, preparation)** — design + owner
      decisions (gross amounts, POS day-summaries, deposit due signing+N days, tentative
      quotes on calendar): [plans/cross-module-foundation.md](plans/cross-module-foundation.md).
      Landed **before** the POS port so POS integrates on day one:
  - [x] `21_finance_spine.sql`: provenance (`source_module`/`source_ref`/`event_id`) +
        derived-row immutability on `finance.entries`; `finance.expected` (deposits,
        balances due); `finance.record_payment()`; `finance.event_pnl()`
        *(applied to prod 2026-07-09)*
  - [x] `40_events.sql`: `events` schema — canonical events + tasks, calendar/feed/
        conflicts views, RLS + permission seeds (module row seeded **disabled** until the
        Phase 2 UI); quotes → events projection trigger, backfill, expectations-on-sign,
        income-on-paid *(applied + backfilled 2026-07-09: 2 confirmed + 1 tentative event
        projected; full sent→signed→paid lifecycle verified on prod, 13/13 assertions)*
  - [x] Finance UI pass: provenance badges, derived-only categories (`events`, `pos`,
        `pos_food`, `pos_labor`) blocked for manual entry, "expected" tab *(done
        2026-07-10; one-writer-per-category is now also DB-enforced in `entries_guard`;
        verified end-to-end in the preview harness at phone width)*
  - [x] **Partial payments** on `finance.expected` *(done 2026-08-12, plan
        [phase1-closeout.md](plans/phase1-closeout.md) §B)* — `record_payment()` closed an
        expectation at **any** amount, so ₪1 against a ₪5,000 deposit marked it paid and the
        remaining ₪4,999 left the plan entirely (out of the open list, the open-expected
        total, and reconciliation's overdue check). Now: `paid_amount` column, remainder
        arithmetic, overpay rejected, one `expected:<id>:pN` entry per payment (the posting
        unique index forbids reusing one ref), `quotes.settle_on_paid` settles only the
        remainder, reconciliation reports what is still owed, and the UI shows
        "paid X of Y · remaining Z" instead of the old are-you-sure confirm
  - [x] **Reversal path** — *rewritten rather than ticked as specified.* The original entry
        said payments on hand-created expectations are "immutable with no corrector"; that
        stopped being true with PR C (2026-08-03), whose owner override reaches
        `source='finance'` rows through `correction_target()`'s fallback and is already
        exposed in `EntriesTab`. What was genuinely missing — the *plan* side never
        re-opening after a correction — is closed by §B's owner bypass: the owner can reset
        `status`/`paid_amount` directly and `finance.audit_log` records it, so no separate
        reversal function was needed. **Still open, logged:** correction rows carry
        `payment_method = null` by design, so a reversed cash payment leaves the `by_payment`
        cash column overstated while the totals stay right
  - [ ] **Server-side provenance resolution** — deferred with a concrete trigger rather than
        an open-ended one (2026-08-12). The `source_ref` grammar is parsed client-side in
        `modules/finance/provenance.ts`; finance is still its only consumer, through a single
        shared helper, so the cost of moving it has not yet been paid back. **Do it when the
        first surface OUTSIDE finance needs entry→quote/POS links** — the Phase 2 events
        module or a dashboard — or when a fifth in-module consumer appears. Shape: a
        `security_invoker` `finance.entries_resolved` view next to the posting functions that
        own the formats, which also retires `useQuoteMap`'s extra round trip and the dev
        mock's third copy of the grammar
  - [x] Finance UX pass (kickoff 2026-07-12, Or's brief; **done 2026-07-13, PR #6**) —
        [plans/finance-ux-pass.md](plans/finance-ux-pass.md): report tab drill-down
        (expandable breakdown rows → underlying entries), date-preset chips + kind
        filters, source links on module-posted rows (`/pos?report=<date>` deep link,
        quotes → quote page); folds in two tracked follow-ups: **HE/AR retrofit** of
        the finance module chrome (predates the i18n layer) and EntriesTab form →
        child component (keystrokes re-render the entries table)
  - [x] **Finance books integrity** (kickoff 2026-07-31, Or's brief; delivered 2026-08-03,
        verified on staging + review pass 2026-08-05) —
        [plans/finance-books-integrity.md](plans/finance-books-integrity.md): four PRs,
        A → B → C → D.
        - [x] **PR A** categories as data *(done 2026-08-03, commit 5f66a26; gate
              fully run — /simplify 18 fixes incl. a supersession hazard,
              /security-review clean, /code-review high 5 findings all fixed)* — owner-editable `finance.categories`
              (`54_finance_categories.sql`) replacing the thrice-declared `CHECK` + the
              client mirror; constrains `finance.expected.category` (free text today);
              seeds the missing real categories (rent, utilities, insurance, taxes,
              payment fees, event costs, donations);
              `owned_by_module` becomes the single source of the derived-only rule;
              new owner-only `finance.categories` permission
        - [x] **PR B** reconciliation — `finance.reconciliation()` over four checks
              (POS day never posted · POS recompute mismatch · overdue expectations ·
              pinned days, added by PR C), live-computed with a one-click fix per item;
              launcher badges on the finance **and** POS tiles, in-module banner, dedicated
              tab. Directly targets the failure the parity trial found by hand (first week
              of July never posted). Set-based after a measured 718ms → ~4ms rewrite
        - [x] **PR C** owner override — owner-only correction entries against any row
              incl. module-derived (`56_finance_override.sql`, new `finance.override` perm);
              §7.4 immutability preserved: the override is additive, never an edit. The POS day
              **pin** ships as a *separate explicit* action, not as an implicit companion to a
              correction — measured during the build: an additive correction already survives
              the auto re-post untouched, while a pin freezes the whole day and would silently
              swallow every cost entered afterwards (deviation recorded in the plan). Pinned
              days are reported by reconciliation as `pinned`, escalating from `low` to
              `medium` once money starts piling up behind the freeze
        - [x] **PR D** transfers — `finance.transfers` as its own table (cash↔bank),
              deliberately outside every income/expense total; dedicated TransfersTab
              (decided in PR D), no new permission, asserted to leave the P&L untouched
        - Out of scope (kickoff): signed-quote-vs-booked check, partial payments (stays
          an open item above), tips in the books, sub-categories
        - [x] **Staging verification + review pass** *(2026-08-05, plan §11)* — four bugs Or
              found on staging (silent `±` button, stale reconciliation, the POS tile badged
              with finance's problems, table buttons breaking the row layout) and five
              `/code-review high` findings, the last of which was a real half-rule: archiving
              a category blocked new **entries** but not new **expectations**, closed by a new
              `finance.expected_guard()`. `rls_matrix` green locally *and* against the staging
              database
- [x] **PROD privilege escalation closed** *(2026-08-05, found by the gate while verifying the
      finance branch — [modules/users.md](modules/users.md))* — `core.admin_assign_role()` was
      executable by `authenticated` on prod and staging though `00_core.sql` revokes it, so any
      signed-up user could grant themselves **owner** (`core` is an exposed schema and
      `disable_signup` is `false`). Fixed on both tiers, probe-verified; grant audit across all
      62 declared revokes now reports 0 drift on both. **Root cause is process:** prod is not on
      the migration pipeline and each PR only hand-applied the *new* objects it added, so a
      `grant`/`revoke`/`alter` added later against an existing object never ran there
      - [x] **A live grant audit exists and runs every deploy** *(2026-08-12,
            [phase1-closeout.md](plans/phase1-closeout.md) §D)* — `supabase/tests/audit-grants.mjs`
            replays every CREATE/GRANT/REVOKE/DROP/ALTER-SET-SCHEMA from `schema/*.sql` **in
            order** and compares the result against the live catalog. Wired into `deploy.yml`
            (gating) and `deploy-staging.yml` (advisory). **This is the item the entry below
            used to point at as already existing — it did not.** On its first real run it found
            a live hole: `authenticated` held **TRUNCATE** on all four `pos.pos_*` tables, and
            TRUNCATE is not governed by RLS, so any signed-in staff account could have wiped
            the billing history. Plus 15 anon-callable functions and 2 passkey objects. All
            closed on both tiers; both now report 0 drift
      - [ ] **Put prod on the migration pipeline** — deferred with the prerequisites named
            (2026-08-12), because the obvious move is destructive: prod has never been linked,
            so its migration ledger is empty and `supabase db push` would **replay the entire
            baseline**, which re-creates the anon-writable POS surface the 2026-07-14 cut-over
            closed ([10_pos.sql:250-263](../supabase/schema/10_pos.sql)) and re-seeds POS
            permissions over live rows. Required first, in order: (1) a real schema diff
            proving prod matches the baseline, (2) `supabase migration repair --status applied`
            to stamp it **without executing it**, (3) connectivity from CI — the dev box cannot
            reach the DB pooler. Until then §D's audit is the check that actually runs
      - [x] ~~Make `rls_matrix` runnable against prod~~ — **dropped 2026-08-12, the premise was
            wrong.** The entry claimed the suite borrows `supabase/seed.sql`'s actors; `seed.sql`
            contains **zero** `aaaaaaaa-…` UUIDs and the suite has always seeded its own five
            (`rls_matrix.sql:203-223`), so the stated fix was a no-op. The real blocker is that
            the suite *deliberately* deletes real `users.manage` grants and every
            `core.user_roles` row to stage global guard states — it is destructive **by design**
            and belongs on local/staging only. Prod is verified by §D's audit instead
      - [x] **A second `users.manage` holder on prod** *(2026-08-12)* — a dedicated break-glass
            account was invited and granted `owner`; the guard now counts 2 unbanned holders.
            (The address is deliberately not written down here: this repo is public, and
            naming the highest-privilege account hands over the login target for free.)
            **Note:** it is not a working break-glass until its email is confirmed — prod runs
            `mailer_autoconfirm` OFF, so an unconfirmed account cannot sign in at all
      - [x] **Set `disable_signup = true`** *(2026-08-12)* — applied to prod and staging and
            probe-verified live (`422 signup_disabled`), with a control proving the password
            grant still reaches GoTrue. `config.toml` given local parity. Behaviourally inert:
            nothing calls `signUp`, and invites go through the service-role Admin API. The
            audit now asserts this setting on every run, so it cannot silently revert
- [x] **The topbar overflows below ~370px** *(fixed 2026-08-12,
      [phase1-closeout.md](plans/phase1-closeout.md) §C)* — **the diagnosis above was wrong**
      and is kept here as the record: `.user-email` was *already* `display:none` at ≤640px
      (since 2026-07-01, before the bug was logged), so the proposed fix would have saved
      nothing. The real 268px was sign-out 78 · passkey 58 · language 54 · role chip 54 · gaps.
      Fixed by collapsing sign-out to the house `.btn-icon-label` pattern and hiding the role
      chip at phone width — but the *actual* bug was structural: `.topbar-right` had no
      `flex-wrap`, so a nowrap flex item's minimum size is its whole row and it could never
      shrink. It now wraps, which means the next control added cannot re-open this.
      **Root cause of the five-week miss:** `screenshot.mjs` shot 390px only, and 390 is
      exactly the width it fit at. 360 is now in the default set, and every shot reports
      horizontal overflow automatically
- [x] POS: map `pos.html` features → module design under `app-src/src/modules/pos/`
      (against the spines: `pos.close_day()` posts to finance; bills carry optional `event_id`)
      — **full migration plan: [plans/pos-module.md](plans/pos-module.md)** (kickoff
      2026-07-09: finance UI pass first; scope = parity-ready + deployed alongside
      `pos.html`; reuses the live `public.pos_*` tables)
- [x] Port billing: bills, items, combos, tips/discounts, payments, reopen/voids
      *(done 2026-07-10, PR #4 — `42_pos_platform.sql` applied to prod, `pos` schema
      exposed; anon pos.html path probe-verified unchanged)*
- [x] Port kitchen pipeline (chef mode: qty → sent → done → served)
- [x] Port day report (chef ops view / manager P&L) + expenses + date presets
      (+ new: close-day button posting the business day into finance)
- [x] Wire `pos.*` permissions per role (order/kitchen/analytics/costs/reports/manage;
      legacy create_bill/refund retired)
- [x] Parity trial: run `/app/pos` alongside `pos.html` on real service days
      *(confirmed clean 2026-07-14: full shifts matched `pos_day_report` to the shekel;
      one gap found — first week of July not posted to finance — backfilled separately,
      not a POS-code issue)*
- [x] Cut over: `pos.html` redirects to `/app/pos` (+ drop anon policies, harden
      `created_by` from JWT, `pos` schema move + server-recompute validation +
      `pos.range_report`) — **done 2026-07-15, full plan + close-out:
      [plans/pos-cutover-hardening.md](plans/pos-cutover-hardening.md)** (full
      menu-as-data admin UI deferred beyond this initiative)

## POS operations v2 — post-cut-over hardening (kickoff 2026-07-20)

*Owner-directed batch of six operational capabilities on the live POS, sequenced into five
PRs. Not a numbered phase — hardening of the Phase 1 POS that feeds Phase 4 (QR menu sourced
from POS items) and Phase 5 (inventory ↔ menu, shifts ↔ labor). Umbrella plan + locked scope
decisions: [plans/pos-operations-v2.md](plans/pos-operations-v2.md).*

- [x] **PR A** — Kitchen in/out visibility (floor + table view: cooking / ready / served)
      *(done 2026-07-21, PR #26 merged + deployed; prod bundle probe-verified HE+AR.
      Shared `kitchenCounts()` helper + `KitchenChips`; status sits inline beside the
      table/item title per owner direction, not on its own row)*
- [x] **PR B** — Summary tab redesign (week/month presets, accordions) + expenses upgrade
      (who/when, receipt flag, paid date, full-period list) *(done 2026-07-21, PR #27
      merged + deployed; `46_pos_expenses_tracking.sql` on prod, `rls_matrix` green.
      Also added manager-only inline **edit** of an expense's name+amount and a delete
      confirm — stronger when the expense is paid. Gate closed a PUBLIC-execute default
      on the three new RPCs — revoked from `public, anon`)*
- [x] **PR C** — Split/partial payments (partial-while-open, balance-due) + checkout item-delete
      *(done 2026-07-22, PR #28 merged + deployed; `47_pos_payments.sql` on prod. Money now
      flows through `pos_payments`; cash/card DERIVED from payments; every discount attributed;
      fired-item removal → manager + structured reason. Backward-compat fallback kept the
      deployed 2-arg client closing tables during the transition)*
- [x] **PR D** — Menu-as-data (owner-editable items/prices/categories); retires the
      `pos.menu_price()` literal mirror. **Expanded 2026-07-28** into a full initiative that
      also retires open house (forward-only, history kept), makes meals first-class with
      components, and folds in three kitchen/floor fixes (realtime reliability, per-unit
      "done", floor grid). Plan: [plans/pos-menu-kitchen.md](plans/pos-menu-kitchen.md)
      *(done 2026-07-30 — shipped as PR1 `9c0eb7b` + PR2 `9a85450`, both on prod (levyam.com)
      and staging; DB `49/51/52/53` applied to prod + staging via the management-API. PR2
      added per-item options (choice/count/add) with server-side price validation, notes on
      lines, the single "ההזמנה" order status list, saved kitchen filter presets, closed-tables
      on the floor, and the owner/manager menu admin UI (`pos.menu`). Full gate green;
      owner-verified on local + staging. Follow-ups below.)*
- [x] **PR E** — Day lifecycle: open → booked, drift detection, explicit re-post/override
      *(done 2026-07-22, PR #29 merged + deployed; `48_pos_day_lifecycle.sql` on prod. Manual
      first post, then auto re-post on any change to a booked day; report badge (✓ booked / ⟳
      updated). Included the finance-spine negative-reversal fix (20/21). **Hotfix same day
      (4aab7dd):** `post_day` was wiping legacy-day revenue on re-post — every pre-split-payments
      bill has money only on `pos_bills`, so it now reads revenue from both sources; added
      `pos_bills` auto-repost triggers; reconciled two stale food-cost days. Full gate green)*

## Phase 1.5 — Platform hardening (2026-07-10 audit)

*Follow-ups from the full-project best-practices audit — details, sizing, and owner
questions: [plans/platform-hardening.md](plans/platform-hardening.md). The audit's #1
item — the anon `pos_*` surface — is the POS cut-over task above, not repeated here.*

**Closing out both phases (kickoff 2026-08-12):** the remaining open items in Phase 1 *and*
Phase 1.5 are being finished as one batch — plan:
[plans/phase1-closeout.md](plans/phase1-closeout.md). Its kickoff audit found **four roadmap
entries that were factually wrong** (the topbar diagnosis, H6's prescribed fix, the
`rls_matrix`-on-prod blocker, and a prod audit script that does not exist) plus a destructive
`supabase db push` trap; the corrections and the owner's decisions are recorded there and
written back into the entries below as each ships. Sequence: ops → topbar → prod audit →
finance money integrity → doc rewrites.

- [x] **H1** RLS regression suite (`supabase/tests/rls_matrix.sql`: per-role can/can't
      matrix) + `PERM` ↔ `core.permissions` drift check in `ci.yml` AND `deploy.yml`
      *(done 2026-07-16 — PR #11 of [plans/users-permissions-suite.md](plans/users-permissions-suite.md);
      caught real drift on its first prod run: viewer role held zero permissions)*
- [x] **H2** Schema migration pipeline — **absorbed by the Staging environment initiative**
      (2026-07-28): `supabase/schema/*.sql` stays the readable source of truth, a generated
      baseline migration is what local and staging actually apply, and the drift check runs in
      both `ci.yml` and `deploy.yml`. See
      [plans/platform-staging-environment.md](plans/platform-staging-environment.md).
      *(Checkbox corrected 2026-08-12: it was left unticked while the entry that absorbed it
      was ticked — the tracker contradicted itself.)* **Scope note:** this is done for local and
      staging. **Prod is still not on the pipeline** — that half is its own open item under
      Phase 1's prod-hardening block, with the `db push` replay hazard and prerequisites named.
- [x] **H3** Permission governance: last-admin lockout guard + `core.audit_log` on
      role/permission changes *(done 2026-07-15, bundled with H5 + users-scoped H7 —
      plan: [plans/users-hardening.md](plans/users-hardening.md); landed **ahead of**
      H1/H2/H4 in the table below, owner-acknowledged deviation. Not bundled with H6
      after all — H6 stays separate, still open. Guard widened during code review to
      also cover `core.permissions` updates/deletes and `role_permissions` updates, not
      just the originally-scoped delete paths; a real pre-existing gap was found and
      fixed along the way — the only account in prod held `manager`, not `owner`, so
      nobody actually held `users.manage` until this landed*)
- [x] **H4** RLS initplan sweep: wrap `core.has_permission()` / `auth.uid()` in policies
      as `(select …)`; add the pattern to MODULE-TEMPLATE.md — gates Phase 2's
      public feed *(done 2026-07-16 — PR #11 of
      [plans/users-permissions-suite.md](plans/users-permissions-suite.md), applied to prod)*
- [x] **H5** Invite flow (`admin-invite` edge function + users-module action) +
      self-service password reset on the login screen *(done 2026-07-15, plan:
      [plans/users-hardening.md](plans/users-hardening.md); gates Phase 3's member role,
      still to come)*
- [x] **H5b** User lifecycle: delete & deactivate/reactivate users (owner-only
      `users.delete` permission, `admin-user-ops` edge function, last-admin-guard
      cascade-hole fix) — *(done 2026-07-16, PR #24 merged + deployed; plan +
      close-out: [plans/users-delete-deactivate.md](plans/users-delete-deactivate.md);
      also closed a live PUBLIC-execute privilege-escalation in `core` found by
      the gate)*
- [x] **H6** `finance.expected` module-row guard *(done 2026-08-12,
      [phase1-closeout.md](plans/phase1-closeout.md) §B)* — module-sourced expectations are now
      status-only for `finance.manage` holders; amount / due_date / reason / note / event_id /
      `fulfilled_by` / `paid_amount` are refused, closing a path that silently broke the pairing
      with a signed quote (and, via `fulfilled_by`, let a manager point an expectation at an
      arbitrary entry). `record_payment()`'s bypass is closed too.
      **The prescribed fix could not be used as written:** calling
      `finance.assert_category_writable()` there would have **rejected the quotes module's own
      primary money path**, because the `events` category is `owned_by_module='quotes'` and every
      quotes deposit posts under it. Resolved with the owner-vs-poster predicate
      (`finance.assert_category_writer()`), which asks "is this poster the module that owns the
      category?" rather than "may a human write here?", and deliberately does not consult
      `active` (archiving must never strand already-planned money).
      **Owner decision 2026-08-12:** the owner is exempt from both guards — quotes can get a
      deposit wrong and the owner must be able to correct it — with every such edit recorded in
      the new `finance.audit_log` (readable at `finance.view`, trigger-written, no client write
      policy). That also subsumed the separately-planned expectation re-open path.
- [x] **H8** Platform observability — Bluebox/OTel tracing on the three Supabase edge
      functions (`admin-invite`, `admin-user-ops`, `passkey-verify`), the only server-side
      code the platform owns. Traces + **sanitized** log export: span attributes are an
      allow-list enforced in the wrapper, error *class*/code only, never message text, per
      architecture invariant 3. *(done 2026-08-12 — PRs #44 + #45, live on staging AND prod,
      spans verified in Bluebox; plan + close-out:
      [plans/bluebox-observability.md](plans/bluebox-observability.md). Added
      `ARCHITECTURE.md` §6b Observability. Also closed a pre-existing prototype-pollution
      hole in `passkey-verify`'s origin gate, a staging/prod `verify_jwt` drift, and the
      missing `staging.levyam.com` origin that left the staging tier unable to exercise
      these functions at all.)*
- [x] **H7** Hygiene batch — nine small repo/UX/ops items; **8 of 9 done** (3 with
      H3/H5 on 2026-07-15, 5 more on 2026-07-16 via PR #11 of
      [plans/users-permissions-suite.md](plans/users-permissions-suite.md): storage
      posture into `supabase/schema/50_storage.sql`, shell error boundary, dependabot,
      `passkey-verify` error detail, `quotes.next_quote_number()` gated via
      `core.require()`). **PITR stays parked** by the 20-signed-contracts rule —
      the one open item, tracked in the plan.
- [x] **Mobile-UX foundation pass** (owner-directed 2026-07-11, not from the audit):
      progressive-disclosure rows (summary → tap → full detail + actions) shell-wide,
      ≥44px touch targets, ≥16px inputs (iOS zoom), launcher tile descriptions, users
      tab → role-chip cards, class-keyed mobile CSS (unblocks the HE/AR retrofits).
      POS deliberately untouched (parity trial). Plan:
      [plans/platform-mobile-ux.md](plans/platform-mobile-ux.md)
      *(done 2026-07-12: PR #5 merged + deployed, smoke-checked; new bundle
      probe-verified on prod — rowline CSS + bilingual strings served; close-out +
      alignment verdict in the plan)*
- [x] **Users & permissions suite** (kickoff 2026-07-15 — plan + close-out:
      [plans/users-permissions-suite.md](plans/users-permissions-suite.md)): bundled
      H1 + H4 + the non-PITR H7 remainder with the users-module feature backlog —
      role badge, login activity, permission-matrix explicit Save (atomic
      `core.apply_role_permissions` RPC), phone accordion, by-user effective lens,
      custom roles (+ cascade-aware last-admin guard on `core.roles` — real lockout
      hole found and closed), view-as permission preview (intersection semantics).
      *(done 2026-07-16: PRs #11/#12/#13 gated + prod-applied, awaiting merge; out of
      scope by owner decision: H2, H6, per-user overrides, true impersonation)*
- [x] **Users module — UX pass + admin capabilities** (kickoff 2026-07-20, owner-directed —
      plan + close-out: [plans/users-ux-admin-caps.md](plans/users-ux-admin-caps.md)):
      cleaner/denser users list with small buttons; per-user **accordion** consolidating all
      per-user data + actions (by-user effective lens moved out of the matrix tab);
      **owner-only admin password set/override** (direct-set or send reset link — new
      `users.password` perm + `admin-user-ops` actions); **bilingual role rename** (adds HE/AR
      labels to `core.roles`, **dropped the legacy `label` column** — paid off the tracked
      bilingual-role-label debt). Per-user permission overrides considered and **dropped** —
      stays role-based. *(done 2026-07-20: full gate run; schema + `users.password` applied to
      prod + `admin-user-ops` redeployed, `rls_matrix` green, awaiting merge. Newly-tracked
      follow-up: unify `core.modules`/`core.permissions` labels onto the same bilingual DB
      shape.)*

- [x] **Staging environment** (kickoff + delivered 2026-07-28, owner-directed — plan +
      close-out: [plans/platform-staging-environment.md](plans/platform-staging-environment.md)):
      three tiers now live — local Colima/Docker Supabase stack (daily dev) + cloud
      `lev-yam-staging` project + **`staging.levyam.com`** (Cloudflare Pages, noindex) — so dev
      and the `/verify` gate no longer run against production. Synthetic seed only (no prod data).
      **Absorbed H2** (versioned migration pipeline). Resolved the "one project / no staging"
      wording in ARCHITECTURE/ROADMAP/CLAUDE.md. Free-tier cap turned out moot (survey + b2b
      already inactive). Fixed a fresh-install last-admin-guard lockout along the way. **Deferred
      follow-ups:** deploy Supabase edge functions to staging (from a normal machine), and a
      GitHub Action for auto-deploy on `staging` push (currently manual `wrangler pages deploy`).

## Phase 2 — What's happening: bookings & events

*Replaces WhatsApp-thread reservation tracking. The shared calendar itself is the `events`
spine landed in Phase 1 ([plans/cross-module-foundation.md](plans/cross-module-foundation.md))
— this phase builds the bookings module **on** it and takes it public, because the feed is
public by default.*

- [ ] `41_bookings.sql`: reservations table (RLS, permission keys) feeding the `events`
      spine; spine events already carry the **visibility flag — `public` by default,
      `internal` opt-out** (anon RLS reads published events only)
- [ ] Bookings module: day/week calendar, reservation CRUD (party size, contact, notes, status)
- [ ] Events management: community events, workshops, hosted dinners (title, time, capacity,
      owner) — designed so Phase 3 initiatives create these same events
- [ ] Confirmed quote events surface in the same calendar — the projection trigger +
      backfill land with the Phase 1 spine; here: verify in the calendar UI and migrate
      quotes prep checklists (jsonb) into `events.tasks`, then retire the column
- [ ] "Happening" feed v1 on the launcher: today's reservations + upcoming events —
      the first taste of *see what's happening*
- [ ] **Public "What's happening" on levyam.com** (HE/AR): the village and visitors see
      published events on the marketing site, read straight from Supabase
      *(prereq: the H4 initplan sweep — Phase 1.5)*

## Phase 3 — Community creation (the heart of the dream)

*Members propose ideas and bring them to life inside the app. An initiative is a generic
container for **any** dream (fishing trip, workshop, festival, tour…) — no hardcoded
categories.*

- [ ] New role: **member** (community), created **by team invitation only** for now
      (staff invite people they know; opening a public request → approve flow is Phase 6).
      *Prerequisite: the H5 invite + password-reset flows (timing = plan Q3) — members
      must onboard without anyone opening the Supabase dashboard*
- [ ] `50_initiatives.sql` + Initiatives module: **propose → approve → run** (any member
      proposes; the Lev Yam team approves before it goes live)
- [ ] Initiative workspace: description, team, tasks/next-steps, its own events
      (flowing into the Phase 2 calendar and, when public, the levyam.com feed)
- [ ] Initiative **budget & expenses tied to finance from day one** — with **per-initiative
      access control**: only that initiative's lead(s) + finance-permission holders see its
      money. This needs row-level, per-initiative grants (finer than role → module → action) —
      design the RLS model carefully before any UI
- [ ] Activity feed v2: venue life + initiative updates in one stream; public items flow to
      levyam.com, internal ones stay behind login
- [ ] Onboard the first real community members and run 1–2 real initiatives through it

## Phase 4 — Open the doors: transactions from outside

*The public already sees what's happening (Phase 2); now they can act on it. Everything here
is bilingual HE/AR like the marketing site.*

- [ ] Online booking on levyam.com → bookings module (anon insert with verification via an
      edge function; WhatsApp stays as a parallel channel)
- [ ] Event signup/tickets on the public "What's happening" feed (capacity, confirmation)
- [ ] Digital menu (QR at the table) — read-only first, sourced from POS items
- [ ] Table ordering → POS kitchen pipeline (only after the QR menu is proven)
- [ ] Notifications channel (WhatsApp/email confirmations) — needed once booking goes public

## Phase 5 — Deep operations

- [ ] Staff & shifts module: scheduling on top of users/roles, hours overview
- [ ] Inventory & suppliers: stock, purchasing → finance expenses, linked to POS menu items
- [ ] Dashboards v2: consolidated P&L (POS + quotes + finance), trends over time,
      per-initiative views

## Phase 6 — Community & loyalty

- [ ] Returning-guest recognition (from bookings + POS history)
- [ ] **Open the membership door:** public request → approve flow on levyam.com — membership
      grows beyond team invitations (revisits the Phase 3 invite-only decision)
- [ ] Social-impact storytelling: real numbers from the platform feeding the marketing site

---

## Marketing site — organic reach (parallel track, 2026-08)

*Not a platform module: this track lives entirely in the static site (`index.html`,
`stories/`, `robots.txt`, `sitemap.xml`) and the deploy workflow. It runs alongside the
platform phases and shares nothing but the repo and the deploy pipeline. The content
strategy driving it is private and lives outside the repo.*

- [x] **Phase 0 — stories section & SEO foundation**
      ([plans/content-engine-phase0.md](plans/content-engine-phase0.md)): `/stories/`
      template + bilingual hub, build-time sitemap + hub generator, `robots.txt`,
      `llms.txt`, `FACTS.md`→`/facts.txt`, homepage `EventVenue` JSON-LD, GA4
      `whatsapp_click` with `page_slug`
- [ ] First real story pages (HE + AR twins, one query cluster each) — written in
      dedicated sessions, each gated on Or's tone + facts review before commit
- [ ] Fill the `[חסר]` markers in `FACTS.md` — seasonality (Nimer's fishing calendar,
      needs Nimer), plus whatever the first content sessions surface as missing
- [ ] Mark `whatsapp_click` as a key event in the GA4 UI (console-side, not repo)
- [ ] *(Optional)* **Self-hosted Arabic webfont.** Arabic copy renders in a system stack —
      `css/styles.css` switches `html[lang="ar"]` to `SF Arabic`/`Geeza Pro`/`Noto Sans Arabic`
      deliberately, and the Heebo/Assistant `unicode-range`s exclude Arabic. That is a working
      design decision, not a bug; revisit only if the system stack looks wrong next to Hebrew
      pages now that whole pages are Arabic
- [ ] **Make `js/app.js` metadata translation opt-in.** `applyTranslations` writes
      `document.title` and four meta tags through hardcoded selectors, so it would erase any
      page's own SEO metadata — the one part of its i18n layer that isn't `data-i18n*`-driven.
      Harmless today (only `index.html` loads it), but it's why `/stories/` needed `js/stories.js`
- [ ] English (`/stories/en/<slug>/`) — reserved in the URL structure, not built

---

## Cross-cutting foundations (touched in every phase)

- **Module template** (created in Phase 1, improved after): keep "new module" a ~1-hour task
- **Bilingual everywhere:** HE + Levantine Arabic from Phase 1, internal and public alike —
  the i18n layer lands with the first module and nothing is retrofitted
- **Public by default:** feed/calendar content is visible on levyam.com unless marked
  internal — every content table carries a visibility flag from its first migration
- **Mobile-first:** staff and members work from phones — test there first
- **RLS is the guard — and it's tested, not just written** (from Phase 1.5): every new
  table gets policies before UI; the regression suite runs after every schema apply and
  a new module adds its can/can't assertions with its policies; `lib/permissions.ts`
  mirrors the seeded keys. Money data is the strictest: initiative finance uses
  per-initiative grants, never platform-wide visibility
- **This file is the tracker:** update checkboxes and add discovered tasks each session
