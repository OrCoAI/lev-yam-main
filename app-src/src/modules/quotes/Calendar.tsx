import { useMemo, useState } from 'react'
import { useQT } from './i18n'
import type { ContractRow, QuoteRow } from './types'
import { isConfirmed } from './types'

/** Month calendar of event dates. Confirmed events are solid ✓ chips that open
 *  the prep checklist; unconfirmed ones are colored by quote status (the quote
 *  document page arrives in a later step — until then chips aren't links). */
export default function Calendar({
  quotes,
  contractsByQuoteId,
  onOpenChecklist,
}: {
  quotes: QuoteRow[]
  contractsByQuoteId: Record<string, ContractRow>
  onOpenChecklist: (q: QuoteRow) => void
}) {
  const qt = useQT()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [confirmedOnly, setConfirmedOnly] = useState(false)

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }
  const prev = () => {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else setMonth(month - 1)
  }
  const next = () => {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else setMonth(month + 1)
  }

  // event_date is already YYYY-MM-DD — group directly by it.
  const eventMap = useMemo(() => {
    const map: Record<string, QuoteRow[]> = {}
    for (const q of quotes) {
      if (!q.event_date) continue
      if (confirmedOnly && !isConfirmed(q, contractsByQuoteId[q.id])) continue
      ;(map[q.event_date] = map[q.event_date] ?? []).push(q)
    }
    return map
  }, [quotes, contractsByQuoteId, confirmedOnly])

  const firstDay = new Date(year, month, 1)
  const startDow = firstDay.getDay() // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells: { day: number; other: boolean; date: Date }[] = []
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, other: true, date: new Date(year, month - 1, prevMonthDays - i) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, other: false, date: new Date(year, month, d) })
  }
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, other: true, date: new Date(year, month + 1, d) })
    }
  }

  const keyOf = (d: Date) =>
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  const isToday = (d: Date) =>
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()

  return (
    <div className="cal-wrap card">
      <div className="cal-header">
        <div className="cal-title">
          {qt.months[month]} {year}
        </div>
        <div className="cal-nav">
          <button
            className={'btn-ghost cal-btn' + (confirmedOnly ? ' on' : '')}
            onClick={() => setConfirmedOnly(!confirmedOnly)}
          >
            {qt.confirmedOnly}
          </button>
          <button className="btn-ghost cal-btn" onClick={goToday}>
            {qt.today}
          </button>
          <button className="btn-ghost cal-btn cal-arrow" onClick={next} aria-label="next">
            ‹
          </button>
          <button className="btn-ghost cal-btn cal-arrow" onClick={prev} aria-label="previous">
            ›
          </button>
        </div>
      </div>
      <div className="cal-grid">
        {qt.dow.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          const events = eventMap[keyOf(c.date)] ?? []
          return (
            <div key={i} className={'cal-day' + (c.other ? ' cal-other' : '') + (isToday(c.date) ? ' cal-today' : '')}>
              <div className="cal-day-num">{c.day}</div>
              {events.map((q) => {
                const conf = isConfirmed(q, contractsByQuoteId[q.id])
                if (conf) {
                  const done = q.prep_checklist.filter((it) => it.done).length
                  const total = q.prep_checklist.length
                  return (
                    <button
                      key={q.id}
                      className="cal-event confirmed"
                      title={`${q.customer_name} — ${qt.confirmedEvent}${total ? ` (${qt.prepProgress} ${done}/${total})` : ''}`}
                      onClick={() => onOpenChecklist(q)}
                    >
                      ✓ {q.customer_name}
                    </button>
                  )
                }
                return (
                  <span
                    key={q.id}
                    className="cal-event"
                    data-s={q.status}
                    title={`${q.customer_name} — ${qt.status[q.status]}`}
                  >
                    {q.customer_name}
                  </span>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
