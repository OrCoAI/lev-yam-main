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

  try {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin_not_allowed' }, 403, origin)
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)

    const body = await req.json()
    const email: string = (body.email ?? '').trim()
    const roleId: string = body.role_id
    if (!email || !roleId) return json({ error: 'missing_fields' }, 400, origin)

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
    if (permErr || !allowed) return json({ error: 'forbidden' }, 403, origin)

    if (!roleRes.data) return json({ error: 'unknown_role' }, 400, origin)

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/app/reset-password`,
    })
    if (inviteErr || !invited?.user) {
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
      return json({ error: 'role_assign_failed', detail: roleErr.message }, 500, origin)
    }

    return json({ invited: true, user_id: invited.user.id }, 200, origin)
  } catch (e) {
    if (e instanceof Response) return e
    console.error('admin-invite error:', e)
    return json({ error: 'server_error' }, 500, origin)
  }
})
