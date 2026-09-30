// translate — Hebrew → Arabic draft for a "What's happening" item.
// Lev Yam platform (docs/plans/events-whats-happening.md · ADR 0055).
//
// One action: POST { title, summary, body, audience, bring } (Hebrew) → the
// same keys in Arabic (the last two are the landing page's optional lines,
// 59_events_landing.sql).
// Caller must be signed in and hold 'events.manage' — re-checked here server
// side via core.has_permission_for(), never trusted from the client. That is
// also the spend guard: the Google key is billed per character.
//
// The result is a DRAFT. The form marks the item ar_machine_translated, and
// events_public_reviewed_arabic (58_events_public.sql) refuses to publish it
// until a person confirms the Arabic. Google returns Modern Standard Arabic,
// not the Levantine the site is written in — the review is the point.
//
// Deploy with JWT verification OFF (does its own auth, same as admin-invite):
//   supabase functions deploy translate --no-verify-jwt
// Secret (never in the repo):
//   supabase secrets set --project-ref <ref> GOOGLE_TRANSLATE_API_KEY=<key>
// Local dev without a key: the function echoes "[AR] <text>" so the button
// works offline. That mode is decided by where it runs, not by a setting — a
// config secret was tried and `supabase secrets set` silently pushed it to the
// cloud (2026-09-28). Cloud functions see an https *.supabase.co URL and can
// never enter it; a key in the gitignored supabase/functions/.env wins locally.

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

const API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY')
// the local stack's functions reach the API at http://kong:8000
const LOCAL = /^http:\/\/(kong|localhost|127\.0\.0\.1)(:\d+)?$/.test(Deno.env.get('SUPABASE_URL') ?? '')
const FAKE = !API_KEY && LOCAL

const FIELDS = ['title', 'summary', 'body', 'audience', 'bring', 'cost'] as const
type Field = (typeof FIELDS)[number]
// A title + summary + a long body + the three optional lines is ~3k characters;
// the cap bounds what one call can cost.
const MAX_CHARS = 8000

// Names Google would otherwise translate word by word ("לב ים" → "heart of the
// sea"). Spellings from FACTS.md. Longest first so a longer name wins.
const GLOSSARY: [string, string][] = [
  ["ג'סר א-זרקא", 'جسر الزرقاء'],
  ['ג׳סר א-זרקא', 'جسر الزرقاء'],
  ['לב ים', 'ليف يام'],
]

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Hebrew text → HTML Google can translate: names pinned, line breaks kept. */
function toHtml(text: string): string {
  let out = escapeHtml(text)
  for (const [he, ar] of GLOSSARY) {
    out = out.split(escapeHtml(he)).join(`<span translate="no">${ar}</span>`)
  }
  return out.replace(/\r?\n/g, '<br>')
}

/** Google's HTML back to plain text. */
function fromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    // Google pads a no-translate span with spaces: "جسر الزرقاء ." → "جسر الزرقاء."
    .replace(/ +([.,!?:;،؛؟])/g, '$1')
}

async function googleTranslate(texts: string[]): Promise<string[]> {
  // The key goes in a header, never the URL: a runtime network error quotes the
  // request URL, and that message reaches the function logs.
  const res = await fetch('https://translation.googleapis.com/language/translate/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': API_KEY! },
      body: JSON.stringify({ q: texts.map(toHtml), source: 'he', target: 'ar', format: 'html' }),
  })
  if (!res.ok) throw new Error(`google_${res.status}`)
  const data = await res.json()
  const out: string[] = (data?.data?.translations ?? []).map(
    (t: { translatedText: string }) => fromHtml(t.translatedText),
  )
  if (out.length !== texts.length) throw new Error('google_shape')
  return out
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin_not_allowed' }, 403, origin)
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)

  // Only fixed codes reach the span — never the text being translated
  // (allow-list rule, ARCHITECTURE invariant 3 / ADR 0013).
  return traced('translate', req, async (report) => {
    report({ action: 'he_to_ar', permission: 'events.manage' })
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

      // refuse an oversized body before parsing it (MAX_CHARS of Hebrew is ~16 KB as JSON).
      // The app always sends a length; a request without one (chunked) is refused
      // rather than buffered unbounded.
      const len = Number(req.headers.get('content-length'))
      if (!Number.isFinite(len) || len <= 0) return deny('bad_request', 411)
      if (len > 64 * 1024) return deny('too_long', 413)
      const body = await req.json().catch(() => null)
      const input: Partial<Record<Field, string>> = {}
      for (const f of FIELDS) {
        const v = body?.[f]
        if (v != null && typeof v !== 'string') return deny('bad_request', 400)
        if (v && v.trim()) input[f] = v
      }
      const keys = Object.keys(input) as Field[]
      if (keys.length === 0) return deny('nothing_to_translate', 400)
      if (keys.reduce((n, k) => n + input[k]!.length, 0) > MAX_CHARS) return deny('too_long', 413)

      if (!API_KEY && !FAKE) return deny('not_configured', 503)

      const texts = keys.map((k) => input[k]!)
      const translated = FAKE ? texts.map((t) => `[AR] ${t}`) : await googleTranslate(texts)
      return json(Object.fromEntries(keys.map((k, i) => [k, translated[i]])), 200, origin)
    } catch (e) {
      if (e instanceof Response) return e
      console.error('translate error:', e instanceof Error ? e.message : 'unknown')
      report(errorFacts(e))
      return json({ error: 'translate_failed' }, 502, origin)
    }
  })
})
