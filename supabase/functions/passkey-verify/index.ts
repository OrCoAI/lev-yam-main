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

const RP_NAME = 'לב ים'

// Allowed browser origins → the WebAuthn Relying Party ID (a registrable suffix
// of the origin host). Add more origins here if the app moves.
const ORIGIN_RPID: Record<string, string> = {
  'http://localhost:5173': 'localhost',
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

  try {
    const rpID = origin ? ORIGIN_RPID[origin] : undefined
    if (!origin || !rpID) return json({ error: 'origin_not_allowed' }, 403, origin)

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
        const user = await requireUser()
        const { challengeId, response, label } = body
        const { data: ch } = await db.from('webauthn_challenges')
          .select('*').eq('id', challengeId).single()
        if (!ch || ch.kind !== 'register' || ch.user_id !== user.id || new Date(ch.expires_at) < new Date())
          return json({ error: 'challenge_invalid' }, 400, origin)

        const v = await verifyRegistrationResponse({
          response,
          expectedChallenge: ch.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
        })
        if (!v.verified || !v.registrationInfo) return json({ error: 'not_verified' }, 400, origin)

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
        const { challengeId, response } = body
        const { data: ch } = await db.from('webauthn_challenges')
          .select('*').eq('id', challengeId).single()
        if (!ch || ch.kind !== 'login' || new Date(ch.expires_at) < new Date())
          return json({ error: 'challenge_invalid' }, 400, origin)

        const { data: pk } = await db.from('passkeys').select('*').eq('id', response.id).single()
        if (!pk) return json({ error: 'unknown_credential' }, 400, origin)

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
        if (!v.verified) return json({ error: 'not_verified' }, 400, origin)

        await db.from('passkeys').update({
          counter: v.authenticationInfo.newCounter,
          last_used_at: new Date().toISOString(),
        }).eq('id', pk.id)
        await db.from('webauthn_challenges').delete().eq('id', challengeId)

        // Mint a real Supabase session for this user without a password:
        // generate a magic-link token the client exchanges via verifyOtp.
        const { data: u } = await admin.auth.admin.getUserById(pk.user_id)
        const email = u.user?.email
        if (!email) return json({ error: 'no_email' }, 400, origin)
        const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'magiclink',
          email,
        })
        if (linkErr || !link) return json({ error: 'link_failed' }, 500, origin)
        return json({ token_hash: link.properties.hashed_token, email }, 200, origin)
      }

      default:
        return json({ error: 'unknown_action' }, 400, origin)
    }
  } catch (e) {
    if (e instanceof Response) {
      return new Response(e.body, { status: e.status, headers: { 'Content-Type': 'application/json', ...cors(origin) } })
    }
    // Full detail stays in the function logs only — a raw String(e) can leak
    // internals (stack fragments, dependency messages) to any caller.
    console.error('passkey-verify error:', e)
    return json({ error: 'server_error' }, 500, origin)
  }
})
