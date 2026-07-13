import { Fragment, useEffect, useMemo, useState } from 'react'
import { finance } from '../../lib/supabase'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import type { FinanceEntry, FinanceKind, FinanceReport } from '../../types'
import DateField from './DateField'
import { displayDate, signedAmount, shortDate, toDateStr } from './format'
import { useFT, type FinanceDict } from './i18n'
import KindFilterChips, { type KindFilter } from './KindFilterChips'
import { sourceHref, useQuoteMap } from './provenance'
import SourceBadge from './SourceBadge'

// Drill-down cap — one range query feeds the expandable rows; the report
// totals always come from the finance.report RPC, so past the cap only the
// per-entry detail is truncated (and says so), never the numbers.
const DETAIL_LIMIT = 1000

// Only what the drill-down lines render — the range query selects exactly this
// (one list drives both the type and the select, so they can't drift).
const DETAIL_FIELDS = [
  'id',
  'kind',
  'category',
  'amount',
  'payment_method',
  'entry_date',
  'note',
  'source_module',
  'source_ref',
] as const
type DetailEntry = Pick<FinanceEntry, (typeof DETAIL_FIELDS)[number]>
const DETAIL_COLUMNS = DETAIL_FIELDS.join(', ')

// group keys shared by the memoized index and the row builders — one format,
// or a tweak on one side silently empties the other's drill-downs
const catKey = (kind: string, category: string) => `${kind}:${category}`
const payKey = (kind: string, method: string | null) => `${kind}:${method ?? 'unknown'}`

function monthRange(offset: number) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: toDateStr(first), to: toDateStr(last) }
}

function lastDays(n: number) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (n - 1))
  return { from: toDateStr(first), to: toDateStr(now) }
}

function presetRanges(ft: FinanceDict): { label: string; from: string; to: string }[] {
  const now = new Date()
  const today = toDateStr(now)
  return [
    { label: ft.presetToday, from: today, to: today },
    { label: ft.preset7, ...lastDays(7) },
    { label: ft.presetMonth, ...monthRange(0) },
    { label: ft.presetPrevMonth, ...monthRange(-1) },
    { label: ft.presetYear, from: toDateStr(new Date(now.getFullYear(), 0, 1)), to: today },
  ]
}

type BreakdownRow = {
  key: string
  kind: FinanceKind
  label: string
  total: number
  count: number
  entries: DetailEntry[]
}

const groupPush = (map: Map<string, DetailEntry[]>, key: string, e: DetailEntry) => {
  const arr = map.get(key)
  if (arr) arr.push(e)
  else map.set(key, [e])
}

export default function ReportTab() {
  const ft = useFT()
  const [from, setFrom] = useState(() => monthRange(0).from)
  const [to, setTo] = useState(() => monthRange(0).to)
  const [customOpen, setCustomOpen] = useState(false)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [rep, setRep] = useState<FinanceReport | null>(null)
  const [detail, setDetail] = useState<DetailEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!from || !to) return // a cleared custom date field must not query the whole table
    let alive = true
    setLoading(true)
    Promise.all([
      finance().rpc('report', { p_from: from, p_to: to }),
      finance()
        .from('entries')
        .select(DETAIL_COLUMNS)
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(DETAIL_LIMIT),
    ]).then(([repRes, entriesRes]) => {
      if (!alive) return
      const err = repRes.error ?? entriesRes.error
      if (err) setError(err.message)
      else {
        setRep(repRes.data as FinanceReport)
        setDetail((entriesRes.data as DetailEntry[] | null) ?? [])
        setError(null)
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [from, to])

  // one pass over the (≤1000-row) detail set → O(1) lookup per breakdown row
  const grouped = useMemo(() => {
    const byCat = new Map<string, DetailEntry[]>()
    const byPay = new Map<string, DetailEntry[]>()
    for (const e of detail) {
      groupPush(byCat, catKey(e.kind, e.category), e)
      groupPush(byPay, payKey(e.kind, e.payment_method), e)
    }
    return { byCat, byPay }
  }, [detail])

  const quoteMap = useQuoteMap(detail)

  // recomputed every render on purpose: 'today'-anchored ranges must not go
  // stale across midnight (a memo on [ft] would freeze them)
  const presets = presetRanges(ft)
  const activePreset = presets.find((p) => p.from === from && p.to === to)?.label ?? null

  function applyPreset(p: { from: string; to: string }) {
    setFrom(p.from)
    setTo(p.to)
    setCustomOpen(false)
  }

  const income = rep ? Number(rep.income_total) || 0 : 0
  const expense = rep ? Number(rep.expense_total) || 0 : 0
  const net = rep ? Number(rep.net) || 0 : 0
  const byCategory = rep?.by_category ?? []
  const byPayment = rep?.by_payment ?? []
  let incomeCount = 0
  let expenseCount = 0
  for (const b of byCategory) {
    if (b.kind === 'income') incomeCount += b.entry_count
    else expenseCount += b.entry_count
  }

  const matchesFilter = (kind: FinanceKind) => kindFilter === 'all' || kind === kindFilter

  const categoryRows: BreakdownRow[] = byCategory
    .filter((b) => matchesFilter(b.kind))
    .map((b) => ({
      key: `cat:${catKey(b.kind, b.category)}`,
      kind: b.kind,
      label: ft.categoryLabels[b.category] ?? b.category,
      total: Number(b.total),
      count: b.entry_count,
      entries: grouped.byCat.get(catKey(b.kind, b.category)) ?? [],
    }))

  const paymentRows: BreakdownRow[] = byPayment
    .filter((b) => matchesFilter(b.kind))
    .map((b) => ({
      key: `pay:${payKey(b.kind, b.payment_method)}`,
      kind: b.kind,
      label: ft.paymentLabels[b.payment_method] ?? '—',
      total: Number(b.total),
      count: b.entry_count,
      entries: grouped.byPay.get(payKey(b.kind, b.payment_method)) ?? [],
    }))

  return (
    <div>
      <div className="card finance-form">
        <div className="chips chips-scroll">
          {presets.map((p) => (
            <button
              key={p.label}
              className={activePreset === p.label && !customOpen ? 'chip on' : 'chip'}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
          <button
            className={customOpen || !activePreset ? 'chip on' : 'chip'}
            onClick={() => setCustomOpen((v) => !v)}
          >
            {ft.presetCustom}
          </button>
        </div>
        {customOpen && (
          <div className="field-row">
            <label className="field">
              <span className="field-label">{ft.fromDate}</span>
              <DateField value={from} onChange={setFrom} />
            </label>
            <label className="field">
              <span className="field-label">{ft.toDate}</span>
              <DateField value={to} onChange={setTo} />
            </label>
          </div>
        )}
        <div className="muted finance-range-caption" dir="ltr">
          {displayDate(from)} – {displayDate(to)}
        </div>
      </div>

      {error && (
        <div className="error">
          {ft.errorPrefix} {error}
        </div>
      )}

      {loading ? (
        <div className="muted">{ft.loadingReport}</div>
      ) : (
        <>
          <div className="finance-summary">
            <div className="card finance-stat stat-income">
              <span className="muted">{ft.statIncome}</span>
              <strong className="finance-income">{income.toLocaleString('he-IL')} ₪</strong>
              <span className="finance-stat-sub">
                {incomeCount} {ft.entriesCount}
              </span>
            </div>
            <div className="card finance-stat stat-expense">
              <span className="muted">{ft.statExpenses}</span>
              <strong className="finance-expense">{expense.toLocaleString('he-IL')} ₪</strong>
              <span className="finance-stat-sub">
                {expenseCount} {ft.entriesCount}
              </span>
            </div>
            <div className="card finance-stat stat-net">
              <span className="muted">{ft.statNet}</span>
              <strong className={net >= 0 ? 'finance-income' : 'finance-expense'}>
                {net.toLocaleString('he-IL')} ₪
              </strong>
              <span className="finance-stat-sub">
                {incomeCount + expenseCount} {ft.entriesCount}
              </span>
            </div>
          </div>

          <KindFilterChips value={kindFilter} onChange={setKindFilter} />

          {detail.length === DETAIL_LIMIT && (
            <p className="muted">{ft.detailLimit(DETAIL_LIMIT.toLocaleString('he-IL'))}</p>
          )}

          <h2 className="section-title">{ft.byCategory}</h2>
          <BreakdownTable rows={categoryRows} labelHeader={ft.colCategory} quoteMap={quoteMap} />

          <h2 className="section-title">{ft.byPayment}</h2>
          <BreakdownTable rows={paymentRows} labelHeader={ft.colMethod} quoteMap={quoteMap} />
        </>
      )}
    </div>
  )
}

/** One breakdown table (by category / by payment): every row expands into the
 *  entries behind its number — the shared .rowline disclosure on all viewports
 *  (desktop affordance = the trailing .rl-chev cell; phones use the row's own
 *  chevron). One row open at a time. */
function BreakdownTable({
  rows,
  labelHeader,
  quoteMap,
}: {
  rows: BreakdownRow[]
  labelHeader: string
  quoteMap: ReadonlyMap<string, string>
}) {
  const ft = useFT()
  const { openId, rowProps } = useRowDisclosure({ allViewports: true })

  // share-of-side denominators: each kind's rows always arrive complete (the
  // kind filter removes whole kinds), so per-kind sums equal the report totals
  const sums = { income: 0, expense: 0 }
  for (const r of rows) sums[r.kind] += r.total

  return (
    <div className="card rowline">
      <table className="grid">
        <thead>
          <tr>
            <th>{ft.colKind}</th>
            <th>{labelHeader}</th>
            <th>{ft.colAmount}</th>
            <th>{ft.entriesCount}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const open = openId === r.key
            const side = sums[r.kind]
            const share = side > 0 ? Math.round((100 * r.total) / side) : null
            const tone = r.kind === 'income' ? 'finance-income' : 'finance-expense'
            return (
              <Fragment key={r.key}>
                <tr {...rowProps(r.key)}>
                  <td className={`rl-more ${tone}`} data-label={ft.colKind}>
                    {r.kind === 'income' ? ft.income : ft.expense}
                  </td>
                  <td className="rl-main">{r.label}</td>
                  <td className={`rl-amt finance-amount ${tone}`}>
                    {/* reversal rows can turn a range's total negative — sign follows the net */}
                    <span dir="ltr">{signedAmount(r.kind, r.total)}</span>
                  </td>
                  <td className="rl-tail">{r.count}</td>
                  <td className="rl-chev">
                    <span className="chev" aria-hidden="true" />
                  </td>
                </tr>
                {open && (
                  <tr className="rl-formrow report-detail">
                    <td colSpan={5}>
                      <div className="muted report-detail-head">
                        {r.count} {ft.entriesCount}
                        {share !== null &&
                          ` · ${share}% ${r.kind === 'income' ? ft.ofIncome : ft.ofExpenses}`}
                      </div>
                      <ul className="report-entries">
                        {r.entries.map((e) => (
                          <li key={e.id}>
                            <span className="re-date muted" title={e.entry_date}>
                              {shortDate(e.entry_date)}
                            </span>
                            <span className="re-main">
                              {e.note ?? (ft.categoryLabels[e.category] ?? e.category)}
                              <SourceBadge
                                module={e.source_module}
                                sourceRef={e.source_ref}
                                href={sourceHref(e.source_module, e.source_ref, quoteMap)}
                              />
                            </span>
                            {e.payment_method && (
                              <span className="re-method muted">
                                {ft.paymentLabels[e.payment_method]}
                              </span>
                            )}
                            <span className={`finance-amount ${e.kind === 'income' ? 'finance-income' : 'finance-expense'}`}>
                              <span dir="ltr">{signedAmount(e.kind, e.amount)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                {ft.emptyRange}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
