/**
 * Scrubbing for text that leaves a snapshot script for a PUBLIC GitHub issue — one definition for
 * scripts/analytics-snapshot.mjs and scripts/social-snapshot.mjs (ADR 0047 §3, ADR 0073).
 */

// Control and bidi-override characters, then the punctuation that turns a value into
// markdown (a backtick closes the code span the report renders it in; brackets and
// parentheses make links; `!` makes an image, which GitHub fetches through camo), then what
// GitHub links on its own outside a code span: an @mention, an issue reference, a URL.
export const clean = (value) => String(value ?? '')
  .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
  .replace(/[`$<>|\\[\]()!@#]/g, ' ')
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
// match, so any long token-shaped run goes too, before the clamp.
export const reason = (e) => String(e?.message ?? e ?? 'unknown error')
  .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
  .replace(/[`<>|\[\]()!#]/g, ' ')                                 // strip first, so the markers below survive
  .replace(/https?:\/\/\S+/g, 'URL')                              // console links name the GCP project
  .replace(/[\w.+-]+@[\w.-]*\.iam\.gserviceaccount\.com/g, 'SERVICE-ACCOUNT') // IAM denials name the principal
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, 'EMAIL')
  .replace(/\/\S*\//g, 'PATH')                                     // a local key path is nobody's business
  .replace(/\d{6,}/g, 'ID')
  .replace(/(?=[a-z_-]*[A-Z0-9])[\w-]{24,}/g, 'TOKEN')           // a digit or capital spares snake_case names
  .replace(/@/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 200) || 'unknown error'
