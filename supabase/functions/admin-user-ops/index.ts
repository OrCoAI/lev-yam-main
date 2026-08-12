// admin-user-ops — user lifecycle + password actions.
// Lev Yam platform (docs/plans/users-delete-deactivate.md, users-ux-admin-caps.md).
//
// One action per call: POST { action, user_id, password? }. Caller must be
// signed in; the required permission is re-checked here server-side via
// core.has_permission_for(), never trusted from the client — and it differs by
// action group:
//   lifecycle (delete/deactivate/reactivate) → 'users.delete'   (owner-only seed)
//   password  (set_password/send_reset/confirm_email)
//                                             → 'users.password' (owner-only seed)
//
// Semantics (owner-aligned 2026-07-16, extended 2026-07-20, 2026-07-30):
//  - delete       hard-deletes the auth account. The DB blocks it for users
//                 with work history (finance/quotes/events FKs have no
//                 cascade) → mapped to 'has_records'; and the row-level
//                 last-admin guard on core.user_roles blocks deleting the
//                 last users.manage holder → mapped to 'last_admin'.
//  - deactivate   bans sign-in (~100y) but keeps the account and every record
//                 attributed. No table trigger can see a ban, so the lockout
//                 check runs here via core.users_manage_survives_without().
//  - reactivate   lifts the ban.
//  - set_password sets a new password directly (owner types it). No force-change
//                 on next login (owner decision 2026-07-20). The value is never
//                 logged or audited — only that a set happened. It ALSO marks the
//                 email confirmed (see confirm_email) — without that, setting a
//                 password for a user who never accepted their invite produced an
//                 account that silently could not log in (live bug, 2026-07-30).
//  - confirm_email marks the address confirmed without touching credentials, for
//                 an invitee who never clicked their invite link (the link
//                 expired, went to spam, or the mailbox isn't reachable). The
//                 project runs with mailer_autoconfirm off, so until this is set
//                 GoTrue rejects every password sign-in with
//                 email_not_confirmed no matter how correct the password is. An
//                 owner asserting the address out-of-band is the same vouch the
//                 invite link would have been — hence 'users.password', not a
//                 permission of its own (owner decision 2026-07-30).
//  - send_reset   sends the standard recovery email (same flow as self-service
//                 reset) so the user sets their own; the owner never sees it.
// Lifecycle actions refuse acting on your own account ('self_forbidden');
// password actions ALLOW self (resetting your own password is legitimate).
//
// Deploy with JWT verification OFF (does its own auth, same as admin-invite):
//   supabase functions deploy admin-user-ops --no-verify-jwt

import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as http from '../_shared/http.ts'
import { errorFacts, traced } from '../_shared/otel.ts'

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
// anon client only for send_reset: resetPasswordForEmail is a GoTrue *public*
// call that triggers the recovery email via the configured SMTP — the same path
// the login screen's self-service reset uses. The service-role client can't send
// it; generateLink would only return a link we'd have to mail ourselves.
const anon = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { auth: { persistSession: false } },
)
const db = admin.schema('core')

// ~100 years — GoTrue has no "indefinite", this is the established stand-in.
const BAN_FOREVER = '876000h'

// Every action declares its own policy facts. This used to be two category sets
// (LIFECYCLE / PASSWORD_OPS) with one `isPassword` boolean driving *both* the
// permission key and the self-targeting rule — fine while the two categories
// happened to agree on both, but adding confirm_email (a non-password action
// permissioned like one) made the category name a lie and would have opted it
// into "self allowed" by inheritance rather than by decision. Facts per action,
// so a new action can't silently acquire a policy nobody chose:
//   perm       — re-checked server-side via core.has_permission_for()
//   allowSelf  — may the caller target their own account?
//   needsEmail — refuse (no_email) if the target has no address
const POLICY = {
  delete: { perm: 'users.delete', allowSelf: false, needsEmail: false },
  deactivate: { perm: 'users.delete', allowSelf: false, needsEmail: false },
  reactivate: { perm: 'users.delete', allowSelf: false, needsEmail: false },
  // resetting/setting your own password is legitimate (owner decision 2026-07-20)
  set_password: { perm: 'users.password', allowSelf: true, needsEmail: false },
  send_reset: { perm: 'users.password', allowSelf: true, needsEmail: true },
  // self is pointless rather than dangerous — an unconfirmed account can't be
  // signed in to call this — so it stays closed by default.
  confirm_email: { perm: 'users.password', allowSelf: false, needsEmail: true },
} as const satisfies Record<string, { perm: string; allowSelf: boolean; needsEmail: boolean }>

type Action = keyof typeof POLICY
// typeof guard first: a JSON array like ["delete"] would stringify to a real key
// under hasOwn/index access. hasOwn (not `in`) also keeps 'constructor' & friends
// off the table.
const isAction = (a: unknown): a is Action => typeof a === 'string' && Object.hasOwn(POLICY, a)
// only these two can strip the last active admin; reactivate can only add one back
const NEEDS_SURVIVES = new Set<Action>(['delete', 'deactivate'])
// GoTrue's own minimum is 6; we require a little more for an admin-set password.
const MIN_PASSWORD_LEN = 8

/** The `email_confirm` flag to send with an update — only when the address isn't
 *  already confirmed.
 *
 *  `email_confirm: true` is NOT idempotent (measured against GoTrue 2026-07-30):
 *  it re-stamps email_confirmed_at with now() every time, so sending it
 *  unconditionally would let a routine password reset erase the record of when a
 *  long-standing account was actually verified — on the very column the users
 *  module now shows the owner. Omitting the flag leaves the timestamp alone. */
const confirmIfNeeded = (user: { email_confirmed_at?: string | null }) =>
  user.email_confirmed_at ? {} : { email_confirm: true as const }

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })

  // Pre-flight rejects stay OUTSIDE the telemetry wrapper — see the same note in
  // admin-invite: each traced request costs an awaited OTLP round trip, and
  // `Origin` filters scanners and cross-origin pages, not a determined caller.
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin_not_allowed' }, 403, origin)
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)

  // Telemetry wrapper (roadmap H8). The platform's highest-privilege surface, so
  // the allow-list matters most here: `report` accepts a fixed field set and the
  // wrapper sanitizes every value, which is why no target email, password, or
  // error text can reach a span. `outcome` is derived from the response status.
  // See ../_shared/otel.ts.
  return traced('admin-user-ops', req, async (report) => {
    // An expected refusal: the code recorded is the same short machine string
    // already returned to the client, never a message. Outcome follows the status.
    const deny = (code: string, statusCode: number) => {
      report({ error_code: code })
      return json({ error: code }, statusCode, origin)
    }
    // A GoTrue/DB write that failed unexpectedly. `detail` still reaches the
    // caller unchanged; only the code reaches the span. No `step` argument —
    // each of these lives in a different action branch, and `levyam.action`
    // already distinguishes them.
    const failed = (err: { message?: string; code?: unknown }) => {
      report({ error_code: err.code })
      return json({ error: 'update_failed', detail: err.message }, 500, origin)
    }
    try {
      const body = await req.json()
      const action: unknown = body.action
      // typeof on both: a JSON array like ["<uuid>"] would slip past the
      // `userId === caller.id` self-check while still stringifying into a working
      // GoTrue URL — harmless today (owner-only, and the outcome is a no-op) but
      // it makes the self guard mean what it says.
      const userId: unknown = body.user_id
      if (!isAction(action) || typeof userId !== 'string' || !userId) {
        return deny('missing_fields', 400)
      }
      const policy = POLICY[action]
      // action + permission are both already in hand, so recording them costs no
      // extra query. They are what makes a span answer "which privileged
      // operation, checked against which permission" without naming anyone.
      report({ action, permission: policy.perm })

      const caller = await requireUser(admin, req, origin)

      // authorization verdict first — nothing about the target is revealed below to
      // a caller who isn't allowed to act at all. 'users.password' and
      // 'users.delete' are both owner-only seeds but kept separate, so password
      // rights don't ride on delete rights or vice-versa.
      const { data: allowed, error: permErr } = await db.rpc('has_permission_for', {
        target_user: caller.id,
        perm_key: policy.perm,
      })
      if (permErr || !allowed) return deny('forbidden', 403)

      if (!policy.allowSelf && userId === caller.id) return deny('self_forbidden', 400)
      // validate the new password before any lookup — cheap reject, no target probe.
      // typeof guard so a non-string JSON value can't slip past the length floor.
      const newPassword: unknown = body.password
      if (
        action === 'set_password' &&
        (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LEN)
      ) {
        return deny('weak_password', 400)
      }

      // target lookup and the lockout check both concern the target user and
      // neither depends on the other — run them together (same shape as
      // admin-invite), still after the auth verdict above. The lockout check is
      // for the two actions that can remove an active admin: for delete the DB's
      // row-level guard is the real enforcement (this is the friendly error);
      // for deactivate this IS the enforcement — a ban never touches a guarded
      // table. Other actions skip it (null) — none of them can remove an admin.
      const needsSurvives = NEEDS_SURVIVES.has(action)
      const [{ data: target, error: getErr }, survives] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        needsSurvives ? db.rpc('users_manage_survives_without', { p_user: userId }) : Promise.resolve(null),
      ])
      if (getErr || !target?.user) return deny('user_not_found', 404)
      if (needsSurvives) {
        if (survives!.error) {
          report({ step: 'survives_check', error_code: survives!.error.code })
          return json({ error: 'server_error' }, 500, origin)
        }
        if (!survives!.data) return deny('last_admin', 400)
      }
      // one precondition, declared per action: confirming or mailing an address
      // requires there to be one.
      if (policy.needsEmail && !target.user.email) return deny('no_email', 400)

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
          // last_admin/has_records are the guards working as designed (409);
          // only the unmatched case is a real fault worth alerting on.
          if (code === 'server_error') {
            report({ step: 'delete_user', error_code: delErr.code })
          } else {
            report({ error_code: code })
          }
          return json({ error: code, detail: msg }, code === 'server_error' ? 500 : 409, origin)
        }
      } else if (action === 'deactivate' || action === 'reactivate') {
        const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: action === 'deactivate' ? BAN_FOREVER : 'none',
        })
        if (banErr) return failed(banErr)
      } else if (action === 'set_password') {
        // validated a string ≥ MIN_PASSWORD_LEN above.
        // email_confirm rides along: an owner-typed password is worthless if GoTrue
        // still refuses the sign-in as email_not_confirmed.
        const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
          password: newPassword as string,
          ...confirmIfNeeded(target.user),
        })
        if (pwErr) return failed(pwErr)
      } else if (action === 'confirm_email') {
        // credentials untouched — this only vouches for the address (policy.needsEmail
        // already guaranteed there is one).
        const { error: confErr } = await admin.auth.admin.updateUserById(userId, confirmIfNeeded(target.user))
        if (confErr) return failed(confErr)
      } else {
        // send_reset — mail the standard recovery link to the target's own address.
        const { error: resetErr } = await anon.auth.resetPasswordForEmail(target.user.email!, {
          redirectTo: `${origin}/app/reset-password`,
        })
        if (resetErr) return failed(resetErr)
      }

      // audit with the real actor — the GoTrue admin API acts on its own
      // connection, so the levyam.audit_actor mechanism can't cover these.
      const { error: auditErr } = await db.rpc('admin_audit_user_event', {
        p_actor: caller.id,
        p_action: `user.${action}`,
        p_data: { user_id: userId, email: target.user.email },
      })
      // Unchanged: still non-fatal, still logged in full to Supabase's own logs.
      // A silently-missing audit trail on the privileged surface is exactly the
      // kind of thing that should be visible in Bluebox — and it is the one case
      // where the status genuinely lies: the request returns 200 because the
      // action DID succeed, so `outcome` must be forced rather than derived.
      if (auditErr) {
        console.error('admin-user-ops audit write failed:', auditErr)
        report({ outcome: 'error', step: 'audit_write', error_code: auditErr.code })
      }

      return json({ done: true, action, user_id: userId }, 200, origin)
    } catch (e) {
      // requireUser throws its 401 Response as control flow — a refusal, not a
      // fault, and its status already says so.
      if (e instanceof Response) return e
      // Unchanged: the full error still goes to Supabase's own function logs.
      // Only its class/code is exported to Bluebox.
      console.error('admin-user-ops error:', e)
      report(errorFacts(e))
      return json({ error: 'server_error' }, 500, origin)
    }
  })
})
