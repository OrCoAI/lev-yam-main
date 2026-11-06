/**
 * What the snapshot scripts share (scripts/analytics-snapshot.mjs, scripts/social-snapshot.mjs): the
 * never-fail contract, one JSON request, one output format. Tokens travel in a header, never a URL.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { reason } from './scrub.mjs'

const TIMEOUT_MS = 20_000

/** A date `offset` days before `now`. Pass one `now` for the whole run: two clocks can straddle midnight. */
export const dayFrom = (now) => (offset) => new Date(now - offset * 86_400_000).toISOString().slice(0, 10)

// Every part of a source is fetched independently: one failing part must not cost the others.
export const settle = async (parts) => {
  const settled = await Promise.allSettled(Object.values(parts))
  return Object.fromEntries(Object.keys(parts).map((name, i) =>
    [name, settled[i].status === 'fulfilled' ? settled[i].value : { error: reason(settled[i].reason) }]))
}
export const failed = (part) => part?.error ?? null
export const errorsOf = (parts) => Object.fromEntries(Object.entries(parts).filter(([, p]) => failed(p)).map(([n, p]) => [n, p.error]))

// A provider's error body is summarised, never dumped: the text reaches a public issue through reason().
export const fetchJson = async (url, token, init = {}) => {
  const res = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${res.status} ${body.error?.status ?? body.error?.code ?? ''}: ${body.error?.message || 'request failed'}`.trim())
  return body
}

export const exchangeToken = async (url, params) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    redirect: 'error', // a 307 would resend the client secret
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.access_token) throw new Error(`token exchange failed: ${res.status} ${body.error || 'no token'}`)
  return body.access_token
}

export const writeJson = (file, data) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

/** `<source> ok`, `<source> ok (partial: …)` or `<source> n/a — <reason>`, one per source. */
export const statusLine = (names, sources) => names
  .map((n) => (failed(sources[n]) ? `${n} n/a — ${sources[n].error}` : `${n} ok${sources[n].errors ? ` (partial: ${Object.keys(sources[n].errors).join(', ')})` : ''}`))
  .join(' · ')
