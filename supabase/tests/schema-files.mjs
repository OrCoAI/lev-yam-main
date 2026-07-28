// Single source of truth for "which schema files, in what order."
//
// Shared by build-baseline.mjs (concatenates them into the baseline migration)
// and check-permission-drift.mjs (parses permission seeds out of them). These
// two MUST agree on the file set and order; keeping the selection in one place
// stops them from silently diverging. Fresh-install order IS filename-sort
// order — the NN_ numbering convention (00_core → 01_passkeys → 10_pos →
// 20/21 → 30 → 40 → 42→45 → 46→48 → 50). Keep it that way.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schema');

/** Ordered schema filenames, e.g. ['00_core.sql', ...]. */
export const schemaFilenames = () =>
  readdirSync(schemaDir).filter((f) => f.endsWith('.sql')).sort();

/** Ordered [{ name, sql }] for each schema file. */
export const readSchemaFiles = () =>
  schemaFilenames().map((name) => ({ name, sql: readFileSync(join(schemaDir, name), 'utf8') }));
