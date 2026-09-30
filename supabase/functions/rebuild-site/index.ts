// rebuild-site — ask GitHub to rebuild and redeploy the public site.
// Lev Yam platform (docs/plans/events-whats-happening.md · ADR 0056).
//
// The "What's happening" landing pages are static HTML generated at deploy
// from events.feed (scripts/gen-happening.mjs), so a publish, unpublish or
// edit of a public item needs a deploy to reach levyam.com. This function is
// the trigger: a signed-in caller holding 'events.manage' (re-checked here
// server-side, never trusted from the client) makes it POST a
// workflow_dispatch for the tier's deploy workflow. Nothing is written to the
// DB and nothing is pushed: the workflow rebuilds whatever the tier's branch
// already holds.
//
// Secrets, set ONE AT A TIME (`supabase secrets set NAME=value` — `--env-file`
// uploads every variable in the file, plan gotcha 2026-09-28):
//   GITHUB_DISPATCH_TOKEN  a fine-grained PAT: this one repository, Actions
//                          read + write, nothing else, 1-year expiry (noted
//                          in supabase/README.md). Honest scope: it can
//                          dispatch, re-run, cancel or delete runs of ANY
//                          workflow_dispatch workflow in the repo on any ref;
//                          it cannot push code, read secrets or change
//                          settings. The `github.ref` job guards on both
//                          deploy workflows and the github-pages environment's
//                          main-only branch policy are what keep a dispatch
//                          from publishing anything but the tier's branch.
//   REBUILD_WORKFLOW       deploy.yml (prod) / deploy-staging.yml (staging)
//   REBUILD_REF            main / staging
// Without the token the function answers { result: 'not_configured' } — the
// local stack, or a project whose token was never set — and the form says so
// quietly instead of failing the save.
//
// Repeated calls collapse into the workflow's own `concurrency` group, so a
// burst of edits costs one build. Telemetry carries fixed result codes only
// (ADR 0013): never the caller, never GitHub's response text.
//
// Deploy with JWT verification OFF (does its own auth, like translate):
//   supabase functions deploy rebuild-site --no-verify-jwt --use-api

import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as http from '../_shared/http.ts'
import { errorFacts, traced } from '../_shared/otel.ts'

const { ALLOWED_ORIGINS } = http
const cors = (origin: string | null) => http.cors(origin, ALLOWED_ORIGINS)
const json = (body: unknown, status: number, origin: string | null) =>
  http.json(body, status, origin, ALLOWED_ORIGINS)

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)
const db = admin.schema('core')

const REPO = 'OrCoAI/lev-yam-main'
const TOKEN = Deno.env.get('GITHUB_DISPATCH_TOKEN')
const WORKFLOW = Deno.env.get('REBUILD_WORKFLOW')
const REF = Deno.env.get('REBUILD_REF')
// The workflow file name and the ref are request parameters of the dispatch;
// they come from this project's secrets only, never from the caller. Both are
// pinned to a closed shape so a misconfigured secret cannot name an arbitrary
// workflow or ref.
const WORKFLOW_RE = /^deploy(-staging)?\.yml$/
const REF_RE = /^(main|staging)$/
const WELL_FORMED = Boolean(WORKFLOW && REF && WORKFLOW_RE.test(WORKFLOW) && REF_RE.test(REF))

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin_not_allowed' }, 403, origin)
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)

  return traced('rebuild-site', req, async (report) => {
    report({ action: 'dispatch', permission: 'events.manage' })
    const deny = (code: string, statusCode: number) => {
      report({ error_code: code })
      return json({ error: code }, statusCode, origin)
    }
    try {
      const caller = await http.requireUser(admin, req, origin, ALLOWED_ORIGINS)
      const { data: allowed, error: permErr } = await db.rpc('has_permission_for', {
        target_user: caller.id,
        perm_key: 'events.manage',
      })
      if (permErr || !allowed) return deny('forbidden', 403)

      // No token at all: the local stack, or a project never set up — quiet.
      // A token with a bad workflow/ref: someone set the secrets wrong — loud,
      // so the form says the rebuild failed instead of "not set up here".
      if (!TOKEN) {
        report({ step: 'not_configured' })
        return json({ result: 'not_configured' }, 200, origin)
      }
      if (!WELL_FORMED) return deny('misconfigured', 500)

      const res = await fetch(
        `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'lev-yam-rebuild-site',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: REF }),
        },
      )
      // 204 is GitHub's answer to an accepted dispatch. Anything else (401 =
      // token expired/revoked, 404 = wrong workflow name or token scope,
      // 422 = the ref has no such workflow) is a fixed code for the span
      // and a bilingual line for the owner; the nightly rebuild still runs.
      if (res.status !== 204) {
        report({ step: 'github', error_code: `github_${res.status}` })
        return json({ error: 'dispatch_failed' }, 502, origin)
      }
      return json({ result: 'dispatched' }, 200, origin)
    } catch (e) {
      if (e instanceof Response) return e
      console.error('rebuild-site error:', e instanceof Error ? e.message : 'unknown')
      report(errorFacts(e))
      return json({ error: 'dispatch_failed' }, 502, origin)
    }
  })
})
