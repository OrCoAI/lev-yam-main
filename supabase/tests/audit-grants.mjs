#!/usr/bin/env node
// Prod/staging GRANT drift audit — the check the roadmap claimed already existed.
//
// WHY THIS EXISTS (2026-08-05): `core.admin_assign_role()` was EXECUTE-able by
// `authenticated` on prod and staging even though 00_core.sql revokes it, so any
// signed-up account could grant itself `owner`. Root cause is structural, not a
// typo: prod is off the migration pipeline, and every PR only ever hand-applied
// the NEW objects it added — so a `grant`/`revoke` added later against an
// EXISTING object silently never ran there. `check-permission-drift.mjs` and
// `build-baseline.mjs` are both file-vs-file and cannot see this class of drift;
// only asking the live database can.
//
// WHAT IT CHECKS: for every function/table/view/sequence in the project schemas,
// compare the privileges the schema files INTEND for the three dangerous
// grantees (PUBLIC, anon, authenticated) against what the live database
// actually grants. Anything live holds that the files do not intend is drift.
//
// Deliberately scoped to those three grantees: they are the reachable ones
// (`core` is an exposed schema), and every privilege incident in this repo's
// history has been one of them — the escalation above, the PUBLIC-execute
// self-grant found by the users-delete gate, and the PUBLIC-execute default on
// the three PR-B RPCs. Grants to owners/service_role are not audited here.
//
//   node supabase/tests/audit-grants.mjs --ref <project-ref>
//
// Needs SUPABASE_ACCESS_TOKEN (a management-API token). Runs read-only: one
// SELECT over the catalog, no DDL, no DML. Exits 1 on drift, 0 when clean.
//
// ── HOW INTENT IS COMPUTED, AND WHY IT IS AN ORDERED REPLAY ──────────────
// Privileges are not a set union — they are a sequence where the last statement
// wins, and `grant ... on all functions in schema s` applies only to the objects
// that exist AT THAT MOMENT. The first version of this script modelled intent as
// an unordered union of "per-object" and "schema-wide" layers, and two reviewers
// independently proved it blind to its own headline case: `00_core.sql:521`
// grants EXECUTE on all core functions to `authenticated`, and `:539` revokes it
// from `admin_assign_role` — the union re-added it, so the 2026-08-05
// self-grant-owner hole would have run GREEN through this audit. The same bug
// discarded the wholesale `anon` revoke on the POS tables.
//
// So: every CREATE / GRANT / REVOKE / ALTER…SET SCHEMA is collected as an event
// with its file order and character offset, then replayed in order against an
// object map. A function is born with `PUBLIC = {EXECUTE}` (Postgres's real
// default, and the foot-gun this repo has been bitten by three times); a table is
// born with nothing. `on all … in schema` expands over the objects registered so
// far, which is exactly what Postgres does — and is why a late-created function
// is NOT covered by an earlier schema-wide revoke.
//
// ── SCOPE: WHAT THIS DOES NOT CHECK ──────────────────────────────────────
//  - **Column-level grants** (`pg_attribute.attacl`). The repo uses these as a
//    real access-control mechanism (`events.events` for anon, `finance.transfers`,
//    `finance.categories`, `pos.day_pins`), so a hand-run
//    `grant update (kind) on finance.categories to authenticated` on prod would
//    NOT be caught here. Column-scoped statements are parsed, reported, and
//    deliberately excluded from table-level intent rather than flattened into it.
//  - **Missing grants.** This is one-directional: it finds privileges live has
//    that the files do not intend. A `grant` that never ran on prod shows up as
//    a runtime "permission denied" for staff, not as drift.
//  - **Non-audited grantees.** Only PUBLIC/anon/authenticated; owners and
//    service_role are out of scope by design.
//
// NOTE ON PRECISION: functions are compared by NAME, not by overload signature.
// This repo revokes across all overloads of a name, so name-level is the right
// granularity; if that ever stops being true this check gets coarser, not wrong.
// Anything it cannot parse is PRINTED, never silently skipped — an audit that
// under-reports while looking green is worse than no audit.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSchemaFiles } from './schema-files.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// This repo is PUBLIC, so GitHub Actions logs are world-readable. Object names
// are already public (they are in the schema files), but the live DIVERGENCE is
// not — printing "authenticated has TRUNCATE on pos.pos_bills" while that is
// still true publishes a working exploitation recipe for anyone watching the
// Actions tab. In CI we therefore print counts plus a digest (so a changed
// result is still visible) and keep the detail for a local run.
const SUMMARY_ONLY = process.argv.includes('--summary') || (!!process.env.CI && !process.argv.includes('--detail'));

const GRANTEES = ['PUBLIC', 'anon', 'authenticated'];

// `all` expanded per object kind, so the sentinel never leaks into a privilege
// set (where a later targeted revoke could not remove it).
const ALL_PRIVS = {
  function: ['EXECUTE'],
  table: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'],
  sequence: ['USAGE', 'SELECT', 'UPDATE'],
};

const args = process.argv.slice(2);
const refIdx = args.indexOf('--ref');
const ref = refIdx >= 0 ? args[refIdx + 1] : process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || !token) {
  console.error('audit-grants: need --ref <project-ref> (or SUPABASE_PROJECT_REF) and SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

// ------------------------------------------------------------- parse ----
// One flat, ordered event list. Nothing is applied while parsing.
const events = [];
// Seed with every API-EXPOSED schema, not just the ones a repo file creates.
// `graphql_public` is exposed but created by the platform, so parsing alone
// would never audit it — an exposed schema nobody checks is the worst kind.
const schemas = new Set(['public']);
try {
  const cfg = readFileSync(join(repoRoot, 'supabase', 'config.toml'), 'utf8');
  const m = cfg.match(/^\s*schemas\s*=\s*\[([^\]]*)\]/m);
  if (m) for (const s of m[1].matchAll(/"([a-z_][a-z_0-9]*)"/gi)) schemas.add(s[1].toLowerCase());
} catch {
  // config.toml is optional for this check; parsed schemas below still apply.
}
const unparsed = [];
const columnScoped = [];

const norm = (s) => s.trim().toLowerCase();
const normGrantee = (g) => (norm(g) === 'public' ? 'PUBLIC' : norm(g));
const splitPrivs = (p, kind) => {
  const t = norm(p);
  if (t === 'all' || t.startsWith('all privileges')) return ALL_PRIVS[kind];
  return t.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
};
// Strip comments so they can never contribute a statement.
const strip = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
// Blank out dollar-quoted bodies (function bodies, DO blocks) while PRESERVING
// offsets, so the statement scanner never reads SQL that isn't a top-level
// statement. Without this, a `grant`/`revoke` inside a plpgsql body is matched
// mid-string and produces a phantom grantee — e.g. the version-guarded
// `execute 'revoke maintain ... from authenticated'` in 43_pos_cutover.sql
// parsed as grantee `authenticated'` (trailing quote) with ZERO unparsed
// entries, which is exactly the silent under-reporting this file forbids.
// Dynamic SQL inside those bodies is recovered separately below.
const blankDollarBodies = (sql) =>
  sql.replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, (m) => ' '.repeat(m.length));
const qualify = (raw) => {
  const p = norm(raw).split('.');
  return p.length === 2 ? { sch: p[0], name: p[1] } : { sch: 'public', name: p[0] };
};

readSchemaFiles().forEach(({ name: file, sql: rawSql }, fileIdx) => {
  const sql = strip(rawSql);
  const aclSql = blankDollarBodies(sql);
  const push = (at, ev) => events.push({ file, fileIdx, at, ...ev });

  for (const m of sql.matchAll(/create\s+schema\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z_0-9]*)/gi)) {
    schemas.add(norm(m[1]));
  }
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z_0-9.]*)\s*\(/gi)) {
    const { sch, name } = qualify(m[1]);
    schemas.add(sch);
    push(m.index, { type: 'create', kind: 'function', sch, name });
  }
  for (const m of sql.matchAll(
    // `or replace` matters: every view in this repo is `create or replace view`,
    // so omitting it left all seven unmodelled (and invisible to
    // `grant ... on all tables in schema ...`, which Postgres does apply to views).
    /create\s+(?:or\s+replace\s+)?(?:unlogged\s+)?(table|view|materialized\s+view|sequence)\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z_0-9.]*)/gi,
  )) {
    const kind = /sequence/i.test(m[1]) ? 'sequence' : 'table'; // views share table ACLs
    const { sch, name } = qualify(m[2]);
    schemas.add(sch);
    push(m.index, { type: 'create', kind, sch, name });
  }
  // Drops matter: 43_pos_cutover.sql drops the original `public.pos_*` functions
  // after recreating them in `pos`. Without this they linger in the model as
  // PUBLIC-executable objects that no longer exist.
  for (const m of sql.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?([a-z_][a-z_0-9.]*)\s*\(/gi)) {
    const { sch, name } = qualify(m[1]);
    push(m.index, { type: 'drop', kind: 'function', sch, name });
  }
  for (const m of sql.matchAll(
    /drop\s+(table|view|materialized\s+view|sequence)\s+(?:if\s+exists\s+)?([a-z_][a-z_0-9.]*)/gi,
  )) {
    const kind = /sequence/i.test(m[1]) ? 'sequence' : 'table';
    const { sch, name } = qualify(m[2]);
    push(m.index, { type: 'drop', kind, sch, name });
  }
  for (const m of sql.matchAll(
    /alter\s+(table|view|materialized\s+view|sequence)\s+([a-z_][a-z_0-9.]*)\s+set\s+schema\s+([a-z_][a-z_0-9]*)/gi,
  )) {
    const kind = /sequence/i.test(m[1]) ? 'sequence' : 'table';
    const { sch, name } = qualify(m[2]);
    schemas.add(norm(m[3]));
    push(m.index, { type: 'move', kind, sch, name, to: norm(m[3]) });
  }

  // Top-level statements (dollar-quoted bodies blanked out), plus the dynamic
  // SQL those bodies execute — recovered from `execute '<sql>'` string literals
  // so a version-guarded or conditional revoke is still modelled, not lost.
  const aclStatements = [
    ...[...aclSql.matchAll(/\b(grant|revoke)\b([\s\S]*?);/gi)].map((m) => ({ verb: m[1], body: m[2], at: m.index })),
    ...[...sql.matchAll(/execute\s+'((?:[^']|'')*)'/gi)].flatMap((m) =>
      [...m[1].replace(/''/g, "'").matchAll(/\b(grant|revoke)\b(.*)$/gi)].map((s) => ({
        verb: s[1], body: s[2], at: m.index,
      })),
    ),
  ];

  for (const m of aclStatements) {
    const verb = norm(m.verb);
    const body = m.body.replace(/\s+/g, ' ').trim().replace(/;$/, '');
    const at = m.at;
    // A quote surviving into a parsed statement means the match crossed a string
    // boundary — refuse it loudly rather than inventing a grantee.
    if (body.includes("'")) { unparsed.push(`${file}: ${body}`); continue; }
    // Column-scoped grants (`grant select (id, title) on ...`) live in
    // pg_attribute.attacl, which this audit does not read — see the header's
    // scope note. Skipping them is deliberate: folding them into table-level
    // intent would mark a table-wide privilege as intended when only a few
    // columns were granted, masking real drift.
    if (/^[^(]*\([^)]*\)\s+on\s/i.test(body)) { columnScoped.push(`${file}: ${body}`); continue; }

    // ... on function f(args) to/from roles      (may list several functions)
    let mm = body.match(/^(.+?) on function (.+?) (?:to|from) (.+)$/i);
    if (mm) {
      const privs = splitPrivs(mm[1], 'function');
      const grantees = mm[3].split(',').map(normGrantee);
      for (const fn of mm[2].split(/\)\s*,\s*/)) {
        const nm = fn.match(/([a-z_][a-z_0-9.]*)\s*\(/i);
        if (!nm) { unparsed.push(`${file}: ${body}`); continue; }
        const { sch, name } = qualify(nm[1]);
        schemas.add(sch);
        push(at, { type: 'acl', verb, kind: 'function', sch, name, grantees, privs });
      }
      continue;
    }

    // ... on all {functions|tables|sequences} in schema s to/from roles
    mm = body.match(/^(.+?) on all (functions|tables|sequences) in schema ([a-z_][a-z_0-9]*) (?:to|from) (.+)$/i);
    if (mm) {
      const kind = { functions: 'function', tables: 'table', sequences: 'sequence' }[norm(mm[2])];
      schemas.add(norm(mm[3]));
      push(at, {
        type: 'acl', verb, kind, sch: norm(mm[3]), name: '*',
        grantees: mm[4].split(',').map(normGrantee), privs: splitPrivs(mm[1], kind),
      });
      continue;
    }

    // schema-level USAGE — a different object class; not a parse gap
    if (/^.+ on schema /i.test(body)) continue;

    // ... on [table|sequence] <object list> to/from roles
    mm = body.match(/^(.+?) on (?:(sequence|table) )?(.+?) (?:to|from) (.+)$/i);
    if (mm && !/ on all /i.test(body)) {
      const kind = norm(mm[2] || '') === 'sequence' ? 'sequence' : 'table';
      const privs = splitPrivs(mm[1], kind);
      const grantees = mm[4].split(',').map(normGrantee);
      for (const obj of mm[3].split(',')) {
        const bare = obj.trim();
        if (!/^[a-z_][a-z_0-9]*(\.[a-z_][a-z_0-9]*)?$/i.test(bare)) { unparsed.push(`${file}: ${body}`); continue; }
        const { sch, name } = qualify(bare);
        schemas.add(sch);
        push(at, { type: 'acl', verb, kind, sch, name, grantees, privs });
      }
      continue;
    }

    unparsed.push(`${file}: ${body}`);
  }
});

// ------------------------------------------------------------ replay ----
events.sort((a, b) => a.fileIdx - b.fileIdx || a.at - b.at);

/** `${kind}:${sch}.${name}` -> Map<grantee, Set<priv>> */
const intent = new Map();
const idOf = (kind, sch, name) => `${kind}:${sch}.${name}`;

for (const ev of events) {
  if (ev.type === 'create') {
    const id = idOf(ev.kind, ev.sch, ev.name);
    // `create or replace` on an existing function keeps its ACL; only a genuinely
    // new object is born with the default.
    if (intent.has(id)) continue;
    const acl = new Map();
    // Postgres's real default: EXECUTE to PUBLIC on every new function. Tables
    // and sequences are born owner-only.
    if (ev.kind === 'function') acl.set('PUBLIC', new Set(['EXECUTE']));
    intent.set(id, acl);
    continue;
  }

  if (ev.type === 'drop') {
    intent.delete(idOf(ev.kind, ev.sch, ev.name));
    continue;
  }

  if (ev.type === 'move') {
    const from = idOf(ev.kind, ev.sch, ev.name);
    const to = idOf(ev.kind, ev.to, ev.name);
    if (!intent.has(from)) continue;
    // The ACL travels with the object — this is exactly how the POS tables kept
    // their public-schema TRUNCATE/TRIGGER grants through `set schema pos`.
    intent.set(to, intent.get(from));
    intent.delete(from);
    continue;
  }

  // acl: resolve `*` against the objects that exist right now, like Postgres does
  const targets = ev.name === '*'
    ? [...intent.keys()].filter((id) => id.startsWith(`${ev.kind}:${ev.sch}.`))
    : [idOf(ev.kind, ev.sch, ev.name)];

  for (const id of targets) {
    if (!intent.has(id)) intent.set(id, new Map());
    const acl = intent.get(id);
    for (const g of ev.grantees) {
      if (!acl.has(g)) acl.set(g, new Set());
      for (const p of ev.privs) {
        if (ev.verb === 'grant') acl.get(g).add(p);
        else acl.get(g).delete(p);
      }
    }
  }
}

// -------------------------------------------------------------- live ----
const schemaList = [...schemas].map((s) => `'${s}'`).join(',');
const granteeList = GRANTEES.map((g) => `'${g}'`).join(',');

const query = `
  select 'function' as kind, n.nspname as sch, p.proname as name,
         coalesce(r.rolname, 'PUBLIC') as grantee, a.privilege_type as priv
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    left join pg_roles r on r.oid = a.grantee
   where n.nspname in (${schemaList})
     and coalesce(r.rolname, 'PUBLIC') in (${granteeList})
  union all
  select case c.relkind when 'S' then 'sequence' else 'table' end, n.nspname, c.relname,
         coalesce(r.rolname, 'PUBLIC'), a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl,
           acldefault((case c.relkind when 'S' then 's' else 'r' end)::"char", c.relowner))) a
    left join pg_roles r on r.oid = a.grantee
   where c.relkind in ('r','v','m','S')
     and n.nspname in (${schemaList})
     and coalesce(r.rolname, 'PUBLIC') in (${granteeList})
`;

async function runSql(sqlText) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sqlText }),
  });
  if (!r.ok) {
    console.error(`audit-grants: management API ${r.status} — ${await r.text()}`);
    process.exit(2);
  }
  const out = await r.json();
  if (!Array.isArray(out)) {
    console.error(`audit-grants: unexpected response — ${JSON.stringify(out).slice(0, 300)}`);
    process.exit(2);
  }
  return out;
}

// Sanity-check that we are pointed at the right database BEFORE trusting a
// "clean" result — a wrong --ref naming a real but unrelated project would
// otherwise report green forever while auditing nothing.
//
// The test is whether the SCHEMAS EXIST, not whether they have privileges: a
// schema with zero grants to PUBLIC/anon/authenticated is a correctly
// locked-down schema, which is the desired end state. Testing for privilege
// rows instead made staging (whose `public` schema is legitimately empty) exit 2
// on every run — an "audit" that refused to audit — and would have hard-failed
// the prod deploy the moment the one stray `public.rls_auto_enable` was dropped.
// The three network calls (schema presence, catalog query, auth config) are
// mutually independent — issue them together, then evaluate in TRUST order:
// presence decides whether the other two mean anything at all. The auth fetch
// gets a .catch(null) so a network-level failure degrades to the same
// "unverified" warning a non-OK status does, instead of crashing the audit.
const [presentRows, rows, authRes] = await Promise.all([
  runSql(
    `select nspname from pg_namespace where nspname in (${[...schemas].map((s) => `'${s}'`).join(',')})`,
  ),
  runSql(query),
  fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null),
]);
const present = new Set(presentRows.map((r) => r.nspname));
const missing = [...schemas].filter((s) => !present.has(s));
if (missing.length) {
  console.error(
    `audit-grants: refusing to report on ${ref} — these schemas do not exist there: ${missing.join(', ')}.` +
      `\n  Wrong --ref, or a paused/restored project.`,
  );
  process.exit(2);
}

// ------------------------------------------------------ auth posture ----
// Grants are only half the story: every privilege hole in this repo's history
// needed an `authenticated` JWT first, and open signup is how an outsider gets
// one. That setting lives in the cloud auth config, which no file-vs-file check
// can see and which `config.toml` only governs LOCALLY — so a comment claiming
// "kept in sync with prod" is exactly the unverifiable intent this tool exists
// to replace. Assert it instead.
const authIssues = [];
if (!authRes || !authRes.ok) {
  // "We could not check" is NOT "the check failed" — reporting it as a finding
  // would fail the deploy on a management-API blip or a token whose scope covers
  // database/query but not config/auth. Warn and move on.
  console.error(`audit-grants: WARNING — could not read auth config (${authRes ? authRes.status : 'network error'}); auth posture unverified.`);
} else {
  const auth = await authRes.json();
  if (auth.disable_signup !== true) {
    authIssues.push('disable_signup is FALSE — anyone with the public anon key can mint an authenticated account');
  }
  if (auth.external_anonymous_users_enabled === true) {
    authIssues.push('anonymous sign-ins are ENABLED — unauthenticated visitors get an authenticated JWT');
  } else if (!('external_anonymous_users_enabled' in auth)) {
    // Absent is NOT disabled: `undefined === true` is false, so a renamed or
    // partial payload would silently read as green — the exact quiet failure
    // mode this script exists to end. Warn like every other unverifiable.
    console.error('audit-grants: WARNING — auth config carries no external_anonymous_users_enabled field; anonymous-sign-in posture unverified.');
  }
}

// ----------------------------------------------------------- compare ----
const drift = [];
for (const { kind, sch, name, grantee, priv } of rows) {
  const acl = intent.get(idOf(kind, sch, name));
  if (acl?.get(grantee)?.has(priv)) continue;
  drift.push({ kind, sch, name, grantee, priv, known: !!acl });
}

// Functions the FILES themselves leave PUBLIC-executable. With an ordered replay
// this falls straight out of intent — no heuristic — and it catches the case a
// schema-wide revoke cannot: a function created AFTER the sweep that ran.
const unrevoked = [...intent.entries()]
  .filter(([id, acl]) => id.startsWith('function:') && acl.get('PUBLIC')?.has('EXECUTE'))
  .map(([id]) => id.slice('function:'.length))
  .sort();

// ------------------------------------------------------------ report ----
// Objects no schema file declares are FATAL by default — that bucket is where
// the standing hazard lands: anything created in `public` inherits Supabase's
// default `ALL to anon, authenticated`, so an object added by hand in the SQL
// editor arrives world-writable and declared nowhere. The allowlist is a ratchet:
// today's known-benign entries are named explicitly, so the backlog cannot grow
// quietly while the report still reads green.
const UNDECLARED_ALLOWLIST = [
  /^function graphql_public\.graphql$/, // Supabase's own GraphQL endpoint
  /^function public\.rls_auto_enable$/, // event-trigger helper; tracked as a follow-up to adopt or drop
];
const declared = drift.filter((d) => d.known);
const undeclaredAll = drift.filter((d) => !d.known);
const allowed = (d) => UNDECLARED_ALLOWLIST.some((re) => re.test(`${d.kind} ${d.sch}.${d.name}`));
const undeclared = undeclaredAll.filter((d) => !allowed(d));
const undeclaredKnownBenign = undeclaredAll.filter(allowed);
const line = (d) => `${d.grantee} has ${d.priv} on ${d.kind} ${d.sch}.${d.name}`;

// Stable across runs, so "same digest" means "same findings" without disclosing
// which privilege is live-but-undeclared.
const digest = (items) => createHash('sha256').update(items.slice().sort().join('\n')).digest('hex').slice(0, 12);

const report = (label, items, hint) => {
  if (!items.length) return;
  if (SUMMARY_ONLY) {
    console.error(`  ${label}: ${items.length} (digest ${digest(items)}) — re-run locally with --detail`);
    return;
  }
  console.error(`\n${label} (${items.length})${hint ? `\n   ${hint}` : ''}`);
  for (const i of items) console.error(`  • ${i}`);
};

if (SUMMARY_ONLY && (declared.length || undeclared.length || unrevoked.length || unparsed.length)) {
  console.error(`\naudit-grants: ${ref} — detail withheld (public CI logs).`);
}

report('?? NOT PARSED — coverage gap, fix the parser', unparsed);
report(
  '!! GRANT DRIFT — live grants what the schema files do not',
  declared.map(line),
  'Apply the revoke from the schema files to this tier.',
);
report(
  '!! UNDECLARED OBJECTS — privileges on objects no schema file declares',
  undeclared.map(line),
  'Adopt the object into supabase/schema/, drop it, or allowlist it in this script.',
);
report('?? Column-scoped grants — not modelled (see header scope note)', columnScoped);
// Auth posture is safe to print even in public logs: it names a setting, not a
// reachable object, and "signup is open" is observable from outside anyway.
if (authIssues.length) {
  console.error(`\n!! AUTH POSTURE on ${ref} (${authIssues.length})`);
  for (const i of authIssues) console.error(`  • ${i}`);
}
report(
  '~~ PUBLIC-EXECUTABLE BY THE FILES — not drift; a fresh install is wide open',
  unrevoked,
  'Add `revoke all on function <fn> from public;` after each create.',
);

if (!declared.length && !undeclared.length && !unparsed.length && !unrevoked.length && !authIssues.length) {
  console.log(
    `audit-grants: ${ref} clean — ${rows.length} live privilege rows across ${schemas.size} schemas; ` +
      `0 drift (${undeclaredKnownBenign.length} allowlisted, ${columnScoped.length} column-scoped not modelled).`,
  );
} else {
  console.error(
    `\naudit-grants: ${ref} — ${declared.length} drift, ${undeclared.length} undeclared, ` +
      `${unrevoked.length} public-executable, ${unparsed.length} unparsed, ${authIssues.length} auth.`,
  );
}
// Unrevoked PUBLIC defaults are a real hazard but a pre-existing, separately
// tracked one; failing on them would block every deploy until the backlog is
// cleared. Drift and parse gaps fail; the backlog reports.
// `process.exitCode` rather than `process.exit()`: stderr is a pipe under GitHub
// Actions and therefore async, so exiting immediately after emitting a long
// report can truncate the findings — the only reason anyone reads this.
process.exitCode = declared.length || undeclared.length || unparsed.length || authIssues.length ? 1 : 0;
