// Shared date helpers for the finance tabs.

// 'YYYY-MM-DD' in local time (not UTC — the venue's calendar day)
export function toDateStr(d: Date) {
  return d.toLocaleDateString('en-CA')
}

export function todayStr() {
  return toDateStr(new Date())
}

// 'YYYY-MM-DD' -> 'DD.MM' — compact for one-line rows; full date shown via title.
export function shortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

// 'YYYY-MM-DD' -> 'DD.MM.YYYY' — full date for captions (module-local format).
export function displayDate(iso: string) {
  if (!iso) return '' // a cleared date input passes '' mid-edit
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// Derived rows may be negative (reversals) — the sign follows the net effect.
export function signedAmount(kind: 'income' | 'expense', amount: number) {
  const net = kind === 'income' ? amount : -amount
  return `${net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString('he-IL')} ₪`
}
