// admin-user-ops — user lifecycle actions: delete / deactivate / reactivate.
// Lev Yam platform (docs/plans/users-delete-deactivate.md).
//
// One action per call: POST { action: 'delete' | 'deactivate' | 'reactivate',
// user_id }. Caller must be signed in and hold 'users.delete' — re-checked
// here server-side via core.has_permission_for(), never trusted from the client.
//
// Semantics (owner-aligned 2026-07-16):
//  - delete       hard-deletes the auth account. The DB blocks it for users
//                 with work history (finance/quotes/events FKs have no
//                 cascade) → mapped to 'has_records'; and the row-level
//                 last-admin guard on core.user_roles blocks deleting the
//                 last users.manage holder → mapped to 'last_admin'.
//  - deactivate   bans sign-in (~100y) but keeps the account and every record
//                 attributed. No table trigger can see a ban, so the lockout
//                 check runs here via core.users_manage_survives_without().
//  - reactivate   lifts the ban.
// Acting on your own account is always refused ('self_forbidden').
//
// Deploy with JWT verification OFF (does its own auth, same as admin-invite):
//   supabase functions deploy admin-user-ops --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as http from '../_shared/http.ts'

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'https://levyam.com',
  'https://www.levyam.com',
])
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

// ~100 years — GoTrue has no "indefinite", this is the established stand-in.
const BAN_FOREVER = '876000h'

const ACTIONS = new Set(['delete', 'deactivate', 'reactivate'])

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })

  try {
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin_not_allowed' }, 403, origin)
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)

    const body = await req.json()
    const action: string = body.action
    const userId: string = body.user_id
    if (!ACTIONS.has(action) || !userId) return json({ error: 'missing_fields' }, 400, origin)

    const caller = await requireUser(admin, req, origin)

    // authorization verdict first — nothing about the target is revealed below
    // to a caller who isn't allowed to act at all.
    const { data: allowed, error: permErr } = await db.rpc('has_permission_for', {
      target_user: caller.id,
      perm_key: 'users.delete',
    })
    if (permErr || !allowed) return json({ error: 'forbidden' }, 403, origin)

    if (userId === caller.id) return json({ error: 'self_forbidden' }, 400, origin)

    // target lookup and the lockout check both concern the target user and
    // neither depends on the other — run them together (same shape as
    // admin-invite), still after the auth verdict above. The lockout check is
    // for the two actions that can remove an active admin: for delete the DB's
    // row-level guard is the real enforcement (this is the friendly error);
    // for deactivate this IS the enforcement — a ban never touches a guarded
    // table. reactivate skips it (null) — it can only add an admin back.
    const needsSurvives = action === 'delete' || action === 'deactivate'
    const [{ data: target, error: getErr }, survives] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      needsSurvives ? db.rpc('users_manage_survives_without', { p_user: userId }) : Promise.resolve(null),
    ])
    if (getErr || !target?.user) return json({ error: 'user_not_found' }, 404, origin)
    if (needsSurvives) {
      if (survives!.error) return json({ error: 'server_error' }, 500, origin)
      if (!survives!.data) return json({ error: 'last_admin' }, 400, origin)
    }

    if (action === 'delete') {
      const { error: delErr } = await admin.auth.admin.deleteUser(userId)
      if (delErr) {
        // Expected DB rejections: the row-level last-admin guard (its bilingual
        // message names users.manage; possible if the pre-check raced a
        // concurrent role change), or FK NO ACTION from finance/quotes/events
        // created_by → the account has work history and must be deactivated
        // instead. Anything that matches neither is an unexpected failure — 500
        // it rather than telling the owner "has records" (a retryable transient
        // error would otherwise read as a permanent, wrong reason).
        const msg = delErr.message ?? ''
        const code = msg.includes('users.manage')
          ? 'last_admin'
          : /foreign key|violates|constraint/i.test(msg)
            ? 'has_records'
            : 'server_error'
        return json({ error: code, detail: msg }, code === 'server_error' ? 500 : 409, origin)
      }
    } else {
      const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: action === 'deactivate' ? BAN_FOREVER : 'none',
      })
      if (banErr) return json({ error: 'update_failed', detail: banErr.message }, 500, origin)
    }

    // audit with the real actor — the GoTrue admin API acts on its own
    // connection, so the levyam.audit_actor mechanism can't cover these.
    const { error: auditErr } = await db.rpc('admin_audit_user_event', {
      p_actor: caller.id,
      p_action: `user.${action}`,
      p_data: { user_id: userId, email: target.user.email },
    })
    if (auditErr) console.error('admin-user-ops audit write failed:', auditErr)

    return json({ done: true, action, user_id: userId }, 200, origin)
  } catch (e) {
    if (e instanceof Response) return e
    console.error('admin-user-ops error:', e)
    return json({ error: 'server_error' }, 500, origin)
  }
})
