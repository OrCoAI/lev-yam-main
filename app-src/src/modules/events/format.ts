// 'HH:MM:SS' (Postgres time) → 'HH:MM', '' for no time.
export function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}
