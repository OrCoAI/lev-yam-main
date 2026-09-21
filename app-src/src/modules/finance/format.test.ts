// Money and date formatting shared by every finance tab (G6.2): the report, the
// reconciliation badge and the entries list must all round and sign identically.
import { describe, expect, it } from 'vitest'
import { amount, displayDate, shortDate, signedAmount, toDateStr } from './format'

describe('signedAmount', () => {
  it('signs by kind and formats in the he-IL locale', () => {
    expect(signedAmount('income', 1234.5)).toBe('+1,234.5 ₪')
    expect(signedAmount('expense', 1234.5)).toBe('−1,234.5 ₪') // U+2212 minus, not a hyphen
  })
  it('a negative derived row (reversal) flips the sign — the net effect wins', () => {
    expect(signedAmount('income', -50)).toBe('−50 ₪')
    expect(signedAmount('expense', -50)).toBe('+50 ₪')
  })
})

describe('amount', () => {
  it('formats plain money with the same locale and treats undefined as 0', () => {
    expect(amount(1000000)).toBe('1,000,000 ₪')
    expect(amount(undefined)).toBe('0 ₪')
  })
})

describe('dates', () => {
  it('toDateStr is the local calendar day, not UTC', () => {
    // `npm test` pins TZ=Asia/Jerusalem: 00:30 local is still the previous day in UTC,
    // so a UTC-based implementation would answer 2026-09-08 here.
    expect(toDateStr(new Date(2026, 8, 9, 0, 30))).toBe('2026-09-09')
  })
  it('shortDate / displayDate reorder ISO to DD.MM / DD.MM.YYYY and tolerate an empty input', () => {
    expect(shortDate('2026-09-09')).toBe('09.09')
    expect(displayDate('2026-09-09')).toBe('09.09.2026')
    expect(displayDate('')).toBe('')
  })
})
