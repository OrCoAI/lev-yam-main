import type { QuotesStrings } from './i18n'

export const ILS = (n: number | null | undefined) =>
  '₪' + Math.round(Number(n) || 0).toLocaleString('en-US')

/** DB dates are YYYY-MM-DD; display is DD/MM/YYYY everywhere. */
export function parseDbDate(str: string | null): Date | null {
  if (!str) return null
  const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3])
}

export function formatDate(str: string | null): string {
  const d = parseDbDate(str)
  if (!d) return str ?? ''
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear()
  )
}

export interface DayChip {
  text: string
  kind: 'today' | 'soon' | 'past' | 'default'
}

/** Short day-of-week + soft relative hint when the event is within two weeks. */
export function eventDayChip(eventDate: string | null, qt: QuotesStrings): DayChip | null {
  const d = parseDbDate(eventDate)
  if (!d) return null
  const dow = `${qt.dayPrefix} ${qt.dow[d.getDay()]}`
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return { text: `${qt.today} · ${dow}`, kind: 'today' }
  if (diff === 1) return { text: `${qt.tomorrow} · ${dow}`, kind: 'soon' }
  if (diff === -1) return { text: `${qt.yesterday} · ${dow}`, kind: 'past' }
  if (diff > 1 && diff <= 14) return { text: `${qt.inDays(diff)} · ${dow}`, kind: 'soon' }
  if (diff < -1 && diff >= -14) return { text: `${qt.daysAgo(-diff)} · ${dow}`, kind: 'past' }
  return { text: dow, kind: diff < 0 ? 'past' : 'default' }
}
