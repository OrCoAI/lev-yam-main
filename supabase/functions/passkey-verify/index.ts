// passkey-verify — WebAuthn (Face ID / Touch ID) for the Lev Yam platform.
//
// One function, four actions (POST JSON { action, ... }):
//   register/options  (auth) → challenge + options to create a passkey
//   register/verify   (auth) → store the new credential
//   login/options     (public) → challenge + options to sign in
//   login/verify      (public) → verify assertion, mint a Supabase session
//
// Deploy with JWT verification OFF (login is pre-auth); we validate the user
// ourselves for the register actions:
//   supabase functions deploy passkey-verify --no-verify-jwt
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase —
// the service-role key never leaves the Edge runtime.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from 'npm:@simplewebauthn/server@^10.0.0'
import { isoBase64URL } from 'npm:@simplewebauthn/server@^10.0.0/helpers'
import { errorFacts, traced } from '../_shared/otel.ts'

const RP_NAME = 'לב ים'

// Allowed browser origins → the WebAuthn Relying Party ID (a registrable suffix
// of the origin host). Add more origins here if the app moves.
//
// staging maps to 'staging.levyam.com', deliberately NOT 'levyam.com'. Both are
// valid registrable suffixes of the staging origin, but an RP ID of 'levyam.com'
// would make a passkey enrolled on staging a working production credential —
// staging is a test tier with synthetic users, so its credentials must not be
// able to sign anyone in to prod. Scoping the RP ID to the staging host keeps
// the two credential sets disjoint.
const ORIGIN_RPID: Record<string, string> = {
  'http://localhost:5173': 'localhost',
  'https://staging.levyam.com': 'staging.levyam.com',
  'https://levyam.com': 'levyam.com',
  'https://www.levyam.com': 'levyam.com',
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)
const db = admin.schema('core')

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
})
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin) },
  })

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })

  // Cheap rejects stay OUTSIDE the telemetry wrapper. This function is the most
  // exposed of the three — login/* is pre-auth, so anyone can reach it — and a
  // traced request costs an awaited OTLP round trip plus a DB round trip, so
  // every request that gets past here is work an unauthenticated caller can
  // make us do. To be clear about what this buys: `Origin` is a plain request
  // header with no integrity outside a browser, so this filters scanners and
  // cross-origin pages, NOT a determined attacker with curl. It is a CSRF
  // boundary, not an authentication one.
  // Origin before method, matching admin-invite and admin-user-ops — otherwise a
  // non-POST from a disallowed origin answers 405 here and 403 there.
  //
  // Object.hasOwn, not a bare lookup: ORIGIN_RPID is an object literal, so
  // `ORIGIN_RPID['__proto__']` / `['constructor']` / `['toString']` all resolve
  // to truthy inherited members and walked straight past this gate into
  // login/options — which does an unauthenticated INSERT into
  // core.webauthn_challenges. (admin-invite/admin-user-ops use Set.has and were
  // never affected.) Found by the security review, 2026-08-12.
  const rpID = origin && Object.hasOwn(ORIGIN_RPID, origin) ? ORIGIN_RPID[origin] : undefined
  if (!origin || !rpID) return json({ error: 'origin_not_allowed' }, 403, origin)
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)

  // Telemetry wrapper (roadmap H8). Auth failures here were undiagnosable before.
  // Nothing WebAuthn-shaped may reach a span: no credential ID, public key,
  // challenge, or email — `report` only accepts the fixed field set in
  // ../_shared/otel.ts, every value is sanitized there, and the action is
  // recorded from the literal in each case below rather than from body.action,
  // which is attacker-controlled free text.
  return traced('passkey-verify', req, async (report) => {
    // Outcome is derived from the response status by the wrapper, so a success
    // path cannot forget to report one; `deny` only adds the machine code, which
    // is the same short string already returned to the client.
    const deny = (code: string, statusCode: number) => {
      report({ error_code: code })
      return json({ error: code }, statusCode, origin)
    }
    try {
      try {
        await db.rpc('purge_expired_challenges') // opportunistic cleanup; never fatal
      } catch { /* ignore */ }

      const body = await req.json()
      const action: string = body.action

      // Identify the caller from their bearer token (register actions only).
      const requireUser = async () => {
        const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
        const { data, error } = await admin.auth.getUser(token)
        if (error || !data.user) throw new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
        return data.user
      }

      switch (action) {
        /* ----------------------------------------------------- register */
        case 'register/options': {
          report({ action: 'register/options' })
          const user = await requireUser()
          const { data: existing } = await db.from('passkeys')
            .select('id, transports').eq('user_id', user.id)
          const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID,
            userID: new TextEncoder().encode(user.id),
            userName: user.email ?? user.id,
            userDisplayName: user.email ?? 'Lev Yam',
            attestationType: 'none',
            excludeCredentials: (existing ?? []).map((c) => ({
              id: c.id,
              transports: c.transports ?? undefined,
            })),
            authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
          })
          const { data: ch } = await db.from('webauthn_challenges')
            .insert({ challenge: options.challenge, user_id: user.id, kind: 'register' })
            .select('id').single()
          return json({ options, challengeId: ch!.id }, 200, origin)
        }

        case 'register/verify': {
          report({ action: 'register/verify' })
          const user = await requireUser()
          const { challengeId, response, label } = body
          const { data: ch } = await db.from('webauthn_challenges')
            .select('*').eq('id', challengeId).single()
          if (!ch || ch.kind !== 'register' || ch.user_id !== user.id || new Date(ch.expires_at) < new Date())
            return deny('challenge_invalid', 400)

          const v = await verifyRegistrationResponse({
            response,
            expectedChallenge: ch.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
          })
          if (!v.verified || !v.registrationInfo) return deny('not_verified', 400)

          await db.from('passkeys').upsert({
            id: v.registrationInfo.credentialID,
            user_id: user.id,
            public_key: isoBase64URL.fromBuffer(v.registrationInfo.credentialPublicKey),
            counter: v.registrationInfo.counter,
            transports: response.response?.transports ?? null,
            label: label ?? 'מכשיר זה',
          })
          await db.from('webauthn_challenges').delete().eq('id', challengeId)
          return json({ verified: true }, 200, origin)
        }

        /* -------------------------------------------------------- login */
        case 'login/options': {
          report({ action: 'login/options' })
          const options = await generateAuthenticationOptions({
            rpID,
            allowCredentials: [], // discoverable credentials — no username needed
            userVerification: 'preferred',
          })
          const { data: ch } = await db.from('webauthn_challenges')
            .insert({ challenge: options.challenge, kind: 'login' })
            .select('id').single()
          return json({ options, challengeId: ch!.id }, 200, origin)
        }

        case 'login/verify': {
          report({ action: 'login/verify' })
          const { challengeId, response } = body
          const { data: ch } = await db.from('webauthn_challenges')
            .select('*').eq('id', challengeId).single()
          if (!ch || ch.kind !== 'login' || new Date(ch.expires_at) < new Date())
            return deny('challenge_invalid', 400)

          const { data: pk } = await db.from('passkeys').select('*').eq('id', response.id).single()
          if (!pk) return deny('unknown_credential', 400)

          const v = await verifyAuthenticationResponse({
            response,
            expectedChallenge: ch.challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            authenticator: {
              credentialID: pk.id,
              credentialPublicKey: isoBase64URL.toBuffer(pk.public_key),
              counter: Number(pk.counter),
              transports: pk.transports ?? undefined,
            },
          })
          if (!v.verified) return deny('not_verified', 400)

          await db.from('passkeys').update({
            counter: v.authenticationInfo.newCounter,
            last_used_at: new Date().toISOString(),
          }).eq('id', pk.id)
          await db.from('webauthn_challenges').delete().eq('id', challengeId)

          // Mint a real Supabase session for this user without a password:
          // generate a magic-link token the client exchanges via verifyOtp.
          const { data: u } = await admin.auth.admin.getUserById(pk.user_id)
          const email = u.user?.email
          if (!email) return deny('no_email', 400)
          const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
          })
          // A verified passkey that then can't be turned into a session is a
          // real fault, not a refusal — the user did everything right.
          if (linkErr || !link) {
            report({ step: 'magic_link', error_code: linkErr?.code })
            return json({ error: 'link_failed' }, 500, origin)
          }
          return json({ token_hash: link.properties.hashed_token, email }, 200, origin)
        }

        default:
          // body.action is free text, so it is NOT recorded — only the fact that
          // it matched nothing.
          return deny('unknown_action', 400)
      }
    } catch (e) {
      // A thrown Response is control flow (the local requireUser's 401), not a
      // fault — its status already says so.
      if (e instanceof Response) {
        return new Response(e.body, { status: e.status, headers: { 'Content-Type': 'application/json', ...cors(origin) } })
      }
      // Full detail stays in the function logs only — a raw String(e) can leak
      // internals (stack fragments, dependency messages) to any caller. Only the
      // error's class/code is exported to Bluebox.
      console.error('passkey-verify error:', e)
      report(errorFacts(e))
      return json({ error: 'server_error' }, 500, origin)
    }
  })
})
