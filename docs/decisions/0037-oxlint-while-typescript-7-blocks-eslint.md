# 0037 — ADR 0020's tooling assumptions corrected at kickoff: oxlint (TypeScript 7 blocks typescript-eslint) and the real money-math test target

- **Date:** 2026-09-09
- **Status:** accepted — amends 0020 (which named eslint); revisit when typescript-eslint supports TS ≥ 7.1
- **Decided by:** owner + Claude Code (Step 3 kickoff finding; owner sign-off on the Step 3 PR)
- **Source:** work order G6.3; `typescript-eslint` startup error "does not support TS 7.0"

## Context

Work order G6.3 asked for "eslint, existing Vite+TS preset" in `ci.yml`. The platform is on
TypeScript 7 (the Go-based compiler, `app-src/package.json`). `typescript-eslint` 8.70 refuses to
load against it ("Please … run typescript-eslint using the TS 6 API … tracking support for
TS >= 7.1"), and every TypeScript-aware ESLint preset depends on it. Running two TypeScript
versions side by side only to lint is the kind of complexity a one-person org should not carry.

## Decision

`oxlint` is the linter: TypeScript-native, no `typescript` peer dependency, React and hooks rules
included, sub-second. Configuration in `app-src/.oxlintrc.json`; `npm run lint` runs it and
`ci.yml` gates on it before the build. **Errors gate; warnings are ratcheted:** oxlint's default categories (`correctness` = error) plus
the React plugin — note `plugins` in `.oxlintrc.json` *replaces* the default set, so `typescript`,
`unicorn`, `oxc` are listed explicitly and are load-bearing. `npm run lint` runs
`oxlint --max-warnings=24`: the warning count on 2026-09-09 (27 pre-existing, 24 after the
Step 3 fix of `QuotePage`'s render-scoped `Toggle`) is the ceiling, a PR that
adds a warning fails, and every fix lowers the number in the same PR. The warnings themselves are
not silenced; the module logs point at `npm run lint` as the live list.

## Consequences

- G6.3 acceptance ("lint gate active") is met; the preset differs from the work order's wording.
- Tests are **hermetic by config**: `vitest.config.ts` pins `VITE_SUPABASE_*` to empty (Vite's
  test mode would otherwise load `.env.local`, and `lib/supabase.ts` builds its client at import) and
  restricts the suite to `src/**/*.test.ts` in a Node environment; `npm test` pins `TZ=Asia/Jerusalem`
  so the business-day helpers are tested in the venue's zone. `pos/logic.ts` no longer imports the
  menu store — callers pass `getMenuGroups()` — so it is genuinely pure and outside the
  `menuData → api → logic` import cycle.
- The lint/test policy files (`.oxlintrc.json`, `vitest.config.ts`, `.node-version`) join the
  Tier-A leash class (ADR 0036): they decide whether the rails can fail.
- CI, staging and prod builds all read Node from the committed `.node-version` (`22.12`, the real
  floor: vitest 5 needs ^22.12); `package.json` `engines` mirrors vitest's range (`^22.12 || ^24`).
  `deploy.yml` runs the same lint + test steps before the prod build.
- When typescript-eslint gains
  TS 7 support, decide at the quarterly ceremony audit whether to switch back or keep oxlint
  (likely keep — the rule overlap is high and the speed is real).
- **Test target corrected** (the second amendment to ADR 0020): `finance/reconciliation.ts` is a React
  hook over the `finance.reconciliation()` RPC (the logic is SQL, covered by `rls_matrix.sql`);
  the pure money-math tests cover `pos/logic.ts` (bill payload, totals, kitchen pipeline, business
  days), `finance/format.ts` (signing/locale) and `finance/provenance.ts` (`sourceHref`).
