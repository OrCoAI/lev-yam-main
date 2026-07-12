# Platform mobile-UX foundation pass

**Initiative plan.** Owner-directed (2026-07-11): *"optimize mobile visualization so
everything is easy to modify directly from mobile … every line, every button, every label
should show the current context of information with ability to expand for deeper
understanding."* This pass hardens the platform's phone experience **before** the
per-module feature work the owner plans next, so every later module inherits the pattern
instead of retrofitting it.

## Design philosophy (the bar every surface is held to)

1. **Progressive disclosure, never amputation.** A row/label is a glanceable summary of
   its highest-signal fields; a tap expands it in place to the *full* record + actions.
   Nothing that exists on desktop becomes unreachable on a phone (today finance hides
   payment method / type / note at phone width with no way in — that class of loss is
   what this pass eliminates).
2. **Context on the control itself.** Buttons and labels state what they act on and what
   state it's in (role chips show the role + on/off, launcher tiles say what's inside,
   immutable rows explain *why* they can't be edited) — no naked icons for meaning.
3. **Touch ergonomics (Apple HIG / Material):** ≥44px tap targets, primary actions
   thumb-reachable, `touch-action: manipulation`, pressed-state feedback.
4. **Phone mechanics done right:** ≥16px form-control text (kills iOS focus auto-zoom),
   safe-area insets, no horizontal page scroll, `:focus-visible` rings,
   `prefers-reduced-motion` respected, tabular numerals for money.
5. **RTL-native + bilingual:** logical properties only; **every new string ships HE + AR**
   (shell dict for shell strings; module `i18n.ts` files — via `makeDictHook`, see the
   close-out — are *started* for finance/users to hold the new strings; the full retrofit
   of their old hardcoded-Hebrew chrome stays its own tracked roadmap item).
6. **One design language.** Brand tokens from `styles.css`; disclosure CSS lives once at
   shell level and is class-keyed (the current mobile CSS keys on *Hebrew `data-label`
   attribute values*, which is fragile and blocks the i18n retrofit — replaced).

## Scope — what changes

**Schema / RLS / permissions: none.** This is a presentation-layer pass; no new write
paths, no DB changes.

| Surface | Change |
|---|---|
| `styles.css` (shell) | Mobile foundation: 16px form controls, focus-visible, reduced-motion, safe-area topbar, `touch-action`, and the shared **expandable-row disclosure CSS** (summary line + chevron → stacked full detail), class-keyed |
| Launcher | Each tile gains a bilingual one-line description of what's inside (static, from the shell dict — **not** live data; see conflicts) |
| Finance — entries | Mobile row = `date · category+provenance … ±amount ⌄`; tap expands to type, payment, note, and full-width actions; derived rows explain their immutability; **add/edit form collapses behind a prominent button on mobile** (opens automatically when editing) |
| Finance — expected | Same disclosure pattern (fixes the current one-line squish); summary = due+overdue · reason+badge · amount; expanded = direction, status, note, record-payment / cancel |
| Finance — report | Breakdown rows stay one-line (no hidden info — sign carries kind); CSS re-keyed to classes |
| Users — users tab | Checkbox matrix → **card per user with role toggle-chips** (chip = role name + state = context on the button itself); works with mock/preview fixtures |
| Users — matrix tab | Stays a matrix (it is one): sticky first column kept, plus module group headers and comfortable touch targets |
| Quotes dashboard | Touch-target bump on row icon buttons; ≥16px note/modal inputs via the shell rule (already the reference mobile surface — cards + bottom sheet stay) |
| POS | **Deliberately untouched** (see conflicts) |

**Out of scope (tracked elsewhere or later):** the full finance/users HE/AR retrofit
(existing roadmap items); quotes document pages (A4 print artifacts); live "what's
happening" data on the launcher (Phase 2); relative-day chips on finance dates (nice
follow-up); PWA/offline.

## Conflicts surfaced (kickoff rule) and their resolution

1. **POS visual freeze vs. "optimize every module".** The POS module is mid **parity
   trial** with `pos.html` on real service days (Phase 1 tail; `styles.ts` states inline
   styles are deliberate for pixel parity). Restyling it now would invalidate the trial.
   **Resolution: POS ships zero visual changes in this pass** — it is already the
   platform's most phone-optimized surface (built phone-first for mid-service use). Its
   turn comes with the post-cut-over follow-ups (plan §8a). *Owner can override.*
2. **Launcher live context vs. Phase 2.** "Every button shows current context" taken to
   its limit means live counts (open tables, due payments) on launcher tiles — that is
   Phase 2's "Happening feed v1". Building it now jumps phases and adds per-module
   queries to the shell. **Resolution: static bilingual descriptions now; live context
   arrives with Phase 2 on the events spine.**

## Roadmap alignment

Added to **Phase 1.5** in [ROADMAP.md](../ROADMAP.md) as an owner-directed item (not from
the 2026-07-10 audit): the roadmap's cross-cutting "Mobile-first" foundation says *"staff
and members work from phones — test there first"* — this pass is that foundation paid
down platform-wide, ahead of the per-module work the owner plans next.

## Architecture invariants check

- **Permissions DB-first:** no change to any gate; UI-only. Disclosure reveals only data
  the row query already returned under RLS. ✅
- **Schema as source of truth:** no schema changes. ✅
- **Spine, no silos:** no data-flow changes; provenance badges stay on rows. ✅
- **Bilingual HE/AR:** every new string in both languages (shell dict + new
  `finance/i18n.ts`, `users/i18n.ts` seeded with this pass's strings); no existing
  string loses a language. ✅
- **Mobile-first:** the point of the initiative. Verified at 390px first. ✅
- **Live tools untouched:** `pos.html` untouched; `/app/pos` pixel-frozen for the trial. ✅

## Vision check

Serves principle 5 directly (*"Mobile-first: staff and members use phones during real
work"*) and principle 2's flexibility promise — the disclosure pattern + started module
dictionaries become part of the module template every future module (bookings,
initiatives) inherits, which is what keeps "new module in ~1 hour" true on phones. ✅

## Verification plan (gate step 4)

`npm run dev` + the `?preview` mock harness, driven with `playwright-core` + system
Chrome at 390×844 (and a desktop width for no-regression): launcher descriptions;
finance entries collapse/expand round-trip incl. actions and immutable-row explainer;
add-form disclosure; expected rows; users role chips toggling against the mock; quotes
touch targets. Screenshots attached to the close-out.

## Open questions (non-blocking; defaults chosen)

- **Q1:** POS exclusion OK? (Default: yes — parity trial protected.)
- **Q2:** Users tab as role-chip cards on desktop too (one code path), matrix tab
  unchanged? (Default: yes — chips read better at every width for ~5 users; the matrix
  tab remains the dense power view.)

## Close-out (2026-07-12 — PR #5 MERGED + DEPLOYED to production: deploy run green
incl. smoke checks; live bundle probe-verified serving the rowline CSS + bilingual strings)

**What shipped** (branch `feat/mobile-ux`, 18 files, +702/−217):

- **The disclosure system** — shared `.rowline` CSS (styles.css) + `useRowDisclosure`
  / `useMediaQuery` hooks: rows collapse to a one-line summary at phone width and
  tap-expand into the full record (all fields as label→value lines, full-width 44px
  labeled actions, keyboard operable). Nothing that exists on desktop is unreachable
  on a phone anymore — the old CSS *deleted* payment/type/note at phone width.
- **Finance** — entries + expected on disclosure rows; module-posted rows explain
  their immutability in-place; the add/edit form collapses behind a `+ הוספת תנועה`
  button on phones (opens for edits, closes after a phone save); the record-payment
  form opens inline under its expectation row (desktop too — better context);
  report re-keyed with a payment-label fallback.
- **Users** — users tab is now a card per user with role toggle-chips (each chip
  shows role + state = context on the button itself); permission matrix gained
  bilingual module group headers whose label stays pinned during horizontal scroll.
- **Launcher** — one `MODULE_META` record per module (route + icon + bilingual
  description); every tile now says what's behind it.
- **Quotes** — 40px icon buttons, visible (not hover-only) checklist delete,
  16px note input. Cards/bottom-sheet pattern untouched (it was the reference).
- **Shell foundation** — ≥16px form controls at phone width (kills iOS focus
  auto-zoom), 44px tap targets everywhere, `touch-action: manipulation`,
  `:focus-visible` rings, `prefers-reduced-motion`, safe-area insets.
- **i18n** — `makeDictHook` in `lib/i18n.tsx` is now THE module-dictionary pattern;
  `finance/i18n.ts` + `users/i18n.ts` created holding every string this pass added
  (HE + AR). Mobile CSS is class-keyed, no longer keyed on Hebrew label text —
  this unblocks the tracked finance/users HE/AR retrofits.
- **Dev harness** — users-module fixtures + `admin_list_users`/`report` RPC mocks;
  order-dependence mirrored; all redesigned surfaces drivable in `?preview`.
- **MODULE-TEMPLATE.md** — rowline contract (cell roles, data-label rule, formrow,
  collapsed-form recipe), the 640px platform breakpoint (`PHONE_MQ`; quotes' 760px
  recorded as the sanctioned exception), `MODULE_META` registration, `makeDictHook`.

**Decisions made along the way**
- POS shipped zero visual changes (parity trial protected) — per plan conflict #1.
- Launcher context is static descriptions, not live counts — per plan conflict #2
  (Phase 2's happening feed owns live data).
- Disclosure state is gated by viewport (`isPhone`): desktop renders the full table
  with no row interactivity; rotation resets the finance form to the mode default
  unless an edit is in progress.
- A row stays expanded after saving its edit (you see what you just changed) —
  deliberate.
- Screen-reader depth: rows carry `aria-expanded` + keyboard toggle but not
  `role="button"` (nested-button validity); noted as a future a11y refinement.

**Quality gate** — `/simplify` (11 fixes: i18n factory + canonical shape, users CSS
namespacing, launcher registry merge, actions-cell single-keying, fixture helpers,
template write-backs…); `/code-review high` (10 findings fixed, incl. a real
keyboard bug — `preventDefault` before the interactive-child guard blocked Enter on
buttons inside rows); `/security-review` (no findings; dev-harness prod-exclusion
independently verified); `/verify` (19-step Playwright drive at 390×844 + desktop:
add/edit round-trips, record-payment crossing into the entries tab, chip-toggle
persistence, rotation across the breakpoint, keyboard paths, zero page errors).

**Deliberately left out** (tracked): full finance/users HE/AR retrofit (roadmap);
quotes document pages (A4 print artifacts); live launcher data (Phase 2);
`role="button"` row semantics; relative-day chips on finance dates; quotes i18n
migration to `makeDictHook` (opportunistic).

**Alignment verdict** — **Aligned.** Architecture: no schema/RLS/permission
changes; disclosure reveals only data the RLS-gated query already returned; all new
strings HE+AR through dictionaries; mobile-first is the substance of the work; POS
freeze honors invariant 7 (live tools until parity). Vision: serves principle 5
(staff and members work from phones) and principle 2 (the pattern + template
write-backs keep "new module in ~1 hour" true on phones). No drift found.
