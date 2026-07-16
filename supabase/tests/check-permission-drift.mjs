#!/usr/bin/env node
// H1 drift check: the UI permission mirror (app-src/src/lib/permissions.ts PERM)
// must list exactly the keys seeded into core.permissions by supabase/schema/*.sql.
// The mirror otherwise drifts silently — the DB stays correct (RLS never reads
// PERM), but the UI shows/hides the wrong controls. Runs in ci.yml; exits 1 on
// any difference, printing which side is missing what.
//
// Keys must appear in a schema file's `insert into core.permissions` seed to
// count as real; keys later retired with `delete from core.permissions` (the
// Phase-0 pos placeholders) are subtracted.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// --- UI side: string values inside the PERM object ---------------------
const permsTs = readFileSync(join(root, 'app-src/src/lib/permissions.ts'), 'utf8');
const permBlock = permsTs.match(/export const PERM = \{([\s\S]*?)\} as const/);
if (!permBlock) {
  console.error('check-permission-drift: could not find `export const PERM = { … } as const` in permissions.ts');
  process.exit(1);
}
const uiKeys = new Set([...permBlock[1].matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map(m => m[1]));

// --- DB side: seeded minus retired keys across all schema files --------
const schemaDir = join(root, 'supabase/schema');
const sql = readdirSync(schemaDir).filter(f => f.endsWith('.sql')).sort()
  .map(f => readFileSync(join(schemaDir, f), 'utf8')).join('\n');

const dbKeys = new Set();
const seedBlocks = [];
// Anchored to the seed idiom's terminator rather than the first ';' — a label
// containing a semicolon must not truncate the block (keys after it would
// silently vanish from both dbKeys and the parse-gap scan below).
for (const block of sql.matchAll(/insert into core\.permissions[\s\S]*?on conflict \(key\) do nothing;/g)) {
  seedBlocks.push(block[0]);
  for (const m of block[0].matchAll(/\(\s*'([a-z_]+\.[a-z_]+)'\s*,/g)) dbKeys.add(m[1]);
}
const seedStatementCount = [...sql.matchAll(/insert into core\.permissions/g)].length;
if (seedStatementCount !== seedBlocks.length) {
  console.error(`check-permission-drift: found ${seedStatementCount} core.permissions inserts but parsed ${seedBlocks.length} — a seed block doesn't end with the standard "on conflict (key) do nothing;"; update this script.`);
  process.exit(1);
}
const retiredKeys = new Set();
for (const del of sql.matchAll(/delete from core\.permissions where key in \(([^)]*)\)/g)) {
  for (const m of del[1].matchAll(/'([a-z_]+\.[a-z_]+)'/g)) {
    retiredKeys.add(m[1]);
    dbKeys.delete(m[1]);
  }
}

// Coverage self-check: a key both patterns miss would otherwise be silently
// unverified forever (the check would certify sync it never saw). Any quoted
// dotted token in the PERM block or a seed block that the strict pattern did
// NOT capture is a parse gap — fail loudly so the pattern gets updated.
const parseGaps = new Set();
for (const source of [permBlock[1], ...seedBlocks]) {
  for (const m of source.matchAll(/'([^']*\.[^']*)'/g)) {
    if (!uiKeys.has(m[1]) && !dbKeys.has(m[1]) && !retiredKeys.has(m[1])) parseGaps.add(m[1]);
  }
}
if (parseGaps.size) {
  console.error(`check-permission-drift: quoted dotted token(s) my patterns cannot parse — update this script:\n  ${[...parseGaps].sort().join('\n  ')}`);
  process.exit(1);
}

// --- compare ------------------------------------------------------------
const missingInUi = [...dbKeys].filter(k => !uiKeys.has(k)).sort();
const missingInDb = [...uiKeys].filter(k => !dbKeys.has(k)).sort();

if (missingInUi.length || missingInDb.length) {
  if (missingInUi.length)
    console.error(`Seeded in supabase/schema but missing from PERM (permissions.ts):\n  ${missingInUi.join('\n  ')}`);
  if (missingInDb.length)
    console.error(`In PERM (permissions.ts) but never seeded in supabase/schema:\n  ${missingInDb.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-permission-drift: PERM ↔ core.permissions seeds in sync (${dbKeys.size} keys)`);
