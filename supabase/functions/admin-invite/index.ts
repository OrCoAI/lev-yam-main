// admin-invite — invite a new staff member by email + assign their initial role.
// Lev Yam platform (H5: docs/plans/users-hardening.md).
//
// One action: POST { email, role_id }. Caller must be signed in and hold
// 'users.manage' — re-checked here server-side via core.has_permission_for(),
// never trusted from the client.
//
// Deploy with JWT verification OFF (does its own auth, same as passkey-verify):
//   supabase functions deploy admin-invite --no-verify-jwt
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase —
// the service-role key never leaves the Edge runtime.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as http from '../_shared/http.ts'
import { errorFacts, traced } from '../_shared/otel.ts'

// Allowed browser origins — same allow-list as passkey-verify; add more if the app moves.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'https://levyam.com',
  'https://www.levyam.com',
])
// bound to this function's allow-list so call sites below stay unchanged
const cors = (origin: string | null) => http.cors(origin, ALLOWED_ORIGINS)
const json = (body: unknown, status: number, origin: string | null) =>
  http.json(body, status, origin, ALLOWED_ORIGINS)
const requireUser = (admin: ReturnType<typeof createClient>, req: Request, origin: string | null) =>
  http.requireUser(admin, req, origin, ALLOWED_ORIGINS)

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)
const db = admin.schema('core')

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  // Pre-flight rejects stay OUTSIDE the telemetry wrapper, alongside OPTIONS:
  // tracing costs an awaited OTLP round trip each, and these are the cheapest
  // requests to send, for a signal Supabase's own request logs already carry.
  // What this does NOT do is stop a determined caller — `Origin` is a plain
  // request header with no integrity outside a browser, so it filters scanners
  // and cross-origin pages, not curl. It is a CSRF boundary, not an auth one.
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin_not_allowed' }, 403, origin)
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)

  // Telemetry wrapper (roadmap H8). `report` is the only channel onto the span,
  // it takes a fixed set of fields, and every value is sanitized inside the
  // wrapper — no email, role name, or error text can reach a span even if a call
  // site here gets it wrong. `outcome` is derived from the response status.
  // See ../_shared/otel.ts.
  return traced('admin-invite', req, async (report) => {
    report({ action: 'invite', permission: 'users.manage' })
    // The error_code is the same short machine string already returned to the
    // client, never a message. Outcome follows from the status.
    const deny = (code: string, statusCode: number) => {
      report({ error_code: code })
      return json({ error: code }, statusCode, origin)
    }
    try {
      const body = await req.json()
      const email: string = (body.email ?? '').trim()
      const roleId: string = body.role_id
      if (!email || !roleId) return deny('missing_fields', 400)

      // caller identity and role validity are independent lookups — run together,
      // but the authorization verdict must be decided before anything about the
      // request (like role_id validity) is revealed to an unauthorized caller.
      const [caller, roleRes] = await Promise.all([
        requireUser(admin, req, origin),
        db.from('roles').select('id').eq('id', roleId).single(),
      ])

      const { data: allowed, error: permErr } = await db.rpc('has_permission_for', {
        target_user: caller.id,
        perm_key: 'users.manage',
      })
      if (permErr || !allowed) return deny('forbidden', 403)

      if (!roleRes.data) return deny('unknown_role', 400)

      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/app/reset-password`,
      })
      if (inviteErr || !invited?.user) {
        // The silent-invite-failure case this whole initiative exists to expose.
        // `detail` still goes to the caller unchanged; only the code reaches the
        // span — inviteErr.message can embed the invitee's address.
        //
        // `step` (not a made-up error_class) says WHICH part of the invite broke;
        // outcome is forced because this returns 400, which would otherwise read
        // as an ordinary refusal rather than a failure worth alerting on.
        report({ outcome: 'error', step: 'send_invite', error_code: inviteErr?.code })
        return json({ error: 'invite_failed', detail: inviteErr?.message }, 400, origin)
      }

      // admin_assign_role (not a raw insert) records `caller.id` as the audit-log
      // actor — auth.uid() would be null for this service-role client otherwise.
      const { error: roleErr } = await db.rpc('admin_assign_role', {
        p_user_id: invited.user.id,
        p_role_id: roleId,
        p_actor: caller.id,
      })
      if (roleErr) {
        // don't leave an invited-but-roleless orphan account behind
        await admin.auth.admin.deleteUser(invited.user.id)
        report({ step: 'assign_role', error_code: roleErr.code })
        return json({ error: 'role_assign_failed', detail: roleErr.message }, 500, origin)
      }

      return json({ invited: true, user_id: invited.user.id }, 200, origin)
    } catch (e) {
      // requireUser throws its 401 Response as control flow — a refusal, not a
      // fault, and its status already says so.
      if (e instanceof Response) return e
      // Unchanged: the full error still goes to Supabase's own function logs.
      // Only its class/code is exported to Bluebox.
      console.error('admin-invite error:', e)
      report(errorFacts(e))
      return json({ error: 'server_error' }, 500, origin)
    }
  })
})
