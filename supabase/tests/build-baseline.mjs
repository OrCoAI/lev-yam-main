#!/usr/bin/env node
// Baseline migration generator + drift guard.
//
// `supabase/schema/*.sql` stays the human-readable source of truth for the DB
// (CLAUDE.md). The Supabase CLI, however, applies `supabase/migrations/*.sql`
// on `supabase db reset` (local) and `supabase db push` (staging). This script
// bridges the two: it concatenates the schema files — in the documented
// fresh-install order, which is exactly their filename sort order
// (00_core → 01_passkeys → 10_pos → 20/21 → 30 → 40 → 42→45 → 46→48 → 50) —
// into a single baseline migration.
//
//   node build-baseline.mjs --write   regenerate the baseline from schema/*.sql
//   node build-baseline.mjs           (default --check) fail if it's out of sync
//
// The --check form runs in ci.yml + deploy.yml so the baseline can never drift
// from schema/ silently: edit a schema file, regenerate, commit both.
//
// The baseline applies the pre-cut-over POS layers (10_pos, 42) followed by the
// cut-over (43) in order — correct for a FRESH local/staging DB (it lands on the
// cut-over end state). It is NEVER replayed on prod (README §First-time-setup):
// prod only ever receives new, post-baseline migrations.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSchemaFiles } from './schema-files.mjs';

const supabaseDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(supabaseDir, 'migrations', '20260728120000_baseline.sql');

const files = readSchemaFiles();

const banner = (name) =>
  `-- ${'='.repeat(69)}\n-- schema/${name}\n-- ${'='.repeat(69)}\n`;

const header =
  `-- GENERATED FILE — do not edit by hand.\n` +
  `-- Baseline migration: supabase/schema/*.sql concatenated in fresh-install\n` +
  `-- (filename-sort) order. Regenerate after any schema change:\n` +
  `--   node supabase/tests/build-baseline.mjs --write\n` +
  `-- Guarded in CI by \`--check\`. See build-baseline.mjs for why.\n\n`;

// Open a bootstrap window for the whole baseline: the last-admin guard
// (core.guard_users_manage_survives) is seeded here before any admin user
// exists, which would otherwise block its own creation on a fresh DB. The
// guard only honours this flag when session_user is NOT a data-API role
// (authenticator/authenticated/anon), so it is inert for every runtime
// request. `reset` closes it so later migrations run
// under the real guard. Plain SET (not SET LOCAL) so it holds whether or not
// the CLI wraps the migration in a transaction; the trailing reset bounds it
// to this file. Only the schema between them is source-of-truth from schema/*.
//
// The flag name 'levyam.bootstrap' MUST match the one read by the guard in
// supabase/schema/00_core.sql (core.guard_users_manage_survives). It fails
// safe if they ever diverge: a rename here leaves the guard active, so the
// baseline install just errors loudly instead of silently skipping the guard.
const bootstrapOpen =
  `-- Bootstrap window (added by build-baseline.mjs — NOT from schema/*.sql):\n` +
  `set levyam.bootstrap = 'on';\n\n`;
const bootstrapClose =
  `\n-- End bootstrap window (added by build-baseline.mjs):\n` +
  `reset levyam.bootstrap;\n`;

const generated =
  header +
  bootstrapOpen +
  files.map(({ name, sql }) => banner(name) + sql.trimEnd() + '\n').join('\n') +
  bootstrapClose;

const mode = process.argv.includes('--write') ? 'write' : 'check';

if (mode === 'write') {
  writeFileSync(BASELINE, generated);
  console.log(`build-baseline: wrote baseline from ${files.length} schema files → ${BASELINE.replace(supabaseDir, 'supabase')}`);
} else {
  let current = '';
  try {
    current = readFileSync(BASELINE, 'utf8');
  } catch {
    console.error(`build-baseline: baseline migration missing (${BASELINE.replace(supabaseDir, 'supabase')}). Run: node supabase/tests/build-baseline.mjs --write`);
    process.exit(1);
  }
  if (current !== generated) {
    console.error(
      'build-baseline: baseline migration is OUT OF SYNC with supabase/schema/*.sql.\n' +
        '  A schema file changed without regenerating the baseline. Run:\n' +
        '    node supabase/tests/build-baseline.mjs --write\n' +
        '  then commit the updated baseline migration.'
    );
    process.exit(1);
  }
  console.log(`build-baseline: baseline in sync with ${files.length} schema files`);
}
