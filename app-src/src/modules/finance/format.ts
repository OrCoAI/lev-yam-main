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
