/**
 * Scrubbing for text that leaves a snapshot script for a PUBLIC GitHub issue — one definition for
 * scripts/analytics-snapshot.mjs and scripts/social-snapshot.mjs (ADR 0047 §3, ADR 0073).
 */

// Every credential this process uses, hidden by value in provider text before any rule below: `hide()` is
// called where one is used. Any 12-character piece counts, so a cut, clamped, URL-encoded or JSON-escaped
// copy goes too. Shorter pieces are left to the shape rules. Never in clean(): its values are typed by
// strangers, and a guess that prints differently when it is right would answer questions about the key.
const PIECE = 12
const pieces = new Set()
export const hide = (...values) => {
  for (const raw of values.map((v) => String(v ?? ''))) {
    for (const form of new Set([raw, raw.replace(/\s+/g, ''), encodeURIComponent(raw), JSON.stringify(raw).slice(1, -1)])) {
      for (let i = 0; i + PIECE <= form.length; i++) pieces.add(form.slice(i, i + PIECE))
    }
  }
}
export const hideKnown = (text) => {
  const hit = new Uint8Array(text.length)
  if (pieces.size) for (let i = 0; i + PIECE <= text.length; i++) if (pieces.has(text.slice(i, i + PIECE))) hit.fill(1, i, i + PIECE)
  let out = ''
  for (let i = 0; i < text.length; i++) out += hit[i] ? (hit[i - 1] ? '' : 'TOKEN') : text[i]
  return out
}
// What GitHub links by itself outside a code span, beyond the characters stripped below.
const unlink = (text) => text.replace(/(?<![A-Za-z0-9])www\./gi, 'www ').replace(/(?<![A-Za-z0-9])GH-(?=\d)/gi, 'GH ')

// Control and bidi-override characters, then the punctuation that turns a value into
// markdown (a backtick closes the code span the report renders it in; brackets and
// parentheses make links; `!` makes an image, which GitHub fetches through camo), then what
// GitHub links on its own outside a code span: an @mention, an issue reference, a URL.
export const clean = (value) => unlink(String(value ?? ''))
  .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
  .replace(/[`$<>|\\[\]()!@#&*~]/g, ' ')
  .replace(/:\/\//g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80) || '(empty)'

// Errors get their own clamp: Google's actionable half ("Enable it at …") sits past
// clean()'s 80-character value limit, and a truncated reason wastes the report's one line.
// But the reason reaches a public step summary and a public issue, and Google's
// SERVICE_DISABLED text carries the GCP project number and its console URL — so URLs and
// long digit runs go, and the sentence that tells the owner what to do stays. A provider can echo
// the token it refused, and a clamped copy would pass GitHub's masking and report-guard's whole-value
// match, so any long token-shaped run goes too, before the clamp, and before the digit runs, which would
// shorten a token below the length this matches. The two slices bound the work, not the meaning. Invisible
// characters are deleted before hiding, so one planted inside a token doesn't split it.
export const reason = (e) => unlink(hideKnown(String(e?.message ?? e ?? 'unknown error').slice(0, 20_000).replace(/\p{Cf}/gu, ''))
  .slice(0, 4000)
  .replace(/\p{Cc}/gu, ' ')
  .replace(/https?:\/\/\S+/gi, 'URL')                             // console links name the GCP project; whole, so first
  .replace(/[`$<>|\[\]()!#&*~]/g, ' ')                            // the markers hold none of these
  .replace(/[\w.+-]+@[\w.-]*\.iam\.gserviceaccount\.com/g, 'SERVICE-ACCOUNT') // IAM denials name the principal
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, 'EMAIL')
  .replace(/\/\S*\//g, 'PATH')                                     // a local key path is nobody's business
  .replace(/(?=[a-z_-]*[A-Z0-9])[\w-]{24,}/g, 'TOKEN')           // a digit or capital spares snake_case names
  .replace(/\d{6,}/g, 'ID')
  .replace(/@/g, ' '))                                             // unlink last: earlier, it would split what those rules match
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200) || 'unknown error'
