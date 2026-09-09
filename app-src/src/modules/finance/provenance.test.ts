// The client-side source_ref grammar (interim — the roadmap tracks moving it into a
// DB view). Every branch here is a link that either opens the right page or,
// wrongly, a relative URL under /app/finance.
import { describe, expect, it } from 'vitest'
import { sourceHref } from './provenance'

const Q = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'
const E = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

describe('sourceHref', () => {
  it('returns null without a module or a ref (manual rows)', () => {
    expect(sourceHref(null, 'x')).toBeNull()
    expect(sourceHref('pos', null)).toBeNull()
  })
  it('pos refs deep-link to the day report, or fall back to /pos on a malformed date', () => {
    expect(sourceHref('pos', 'pos:2026-09-09:cash')).toBe('/pos?report=2026-09-09')
    expect(sourceHref('pos', 'pos:2026-09-09:cash:r2')).toBe('/pos?report=2026-09-09')
    expect(sourceHref('pos', 'pos:bad')).toBe('/pos')
  })
  it('override refs unwrap to their target (pos only)', () => {
    expect(sourceHref('override', 'override:pos:2026-09-09:cash:c1')).toBe('/pos?report=2026-09-09')
    expect(sourceHref('override', `override:expected:${E}:c1`)).toBeNull()
  })
  it('quotes refs: bare quote uuid links to the quote page; anything else is null', () => {
    expect(sourceHref('quotes', `${Q}:deposit`)).toBe(`/quotes/${Q}`)
    expect(sourceHref('quotes', 'not-a-uuid:deposit')).toBeNull()
  })
  it('expected refs resolve through the expectation→quote map, with or without the :pN suffix', () => {
    const map = new Map([[E, Q]])
    expect(sourceHref('quotes', `expected:${E}`, map)).toBe(`/quotes/${Q}`)
    expect(sourceHref('quotes', `expected:${E}:p3`, map)).toBe(`/quotes/${Q}`)
    expect(sourceHref('quotes', `expected:${E}`)).toBeNull()          // no map yet → no link, never a relative URL
    expect(sourceHref('quotes', 'expected:not-a-uuid', map)).toBeNull()
  })
  it('unknown modules produce no link', () => {
    expect(sourceHref('finance', `expected:${E}`)).toBeNull()
  })
})
