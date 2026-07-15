// Shared CORS/JSON-response scaffolding for Edge Functions. passkey-verify
// predates this file and keeps its own copy (working, deployed — not touched
// for this); new functions should import from here instead of copying again.
//
// `allowedOrigins` is required (not defaulted) so a caller can't forget it —
// echoing back an unrecognized Origin verbatim would make the allow-list a
// body-only distinction instead of a real browser-enforced CORS boundary.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export const cors = (origin: string | null, allowedOrigins: Set<string>) => ({
  // 'null' matches no real Origin header, so disallowed origins get a
  // response the browser won't let their script read — same effect as
  // omitting the header, but every response still carries one.
  'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
})

export const json = (body: unknown, status: number, origin: string | null, allowedOrigins: Set<string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(origin, allowedOrigins) },
  })

/** Identify the caller from their bearer token — throws the 401 Response directly. */
export async function requireUser(
  admin: SupabaseClient,
  req: Request,
  origin: string | null,
  allowedOrigins: Set<string>,
) {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw json({ error: 'unauthorized' }, 401, origin, allowedOrigins)
  return data.user
}
