// 'HH:MM:SS' (Postgres time) → 'HH:MM', '' for no time.
export function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

// A time range held left-to-right (LRI…PDI), as hours() in js/happening-render.js does:
// an en dash in an RTL line reads "18:30–17:00". One end alone is shown as is.
export function timeRange(from: string | null, to: string | null): string {
  const a = hhmm(from)
  const b = hhmm(to)
  return a && b ? `\u2066${a}–${b}\u2069` : a || b
}
