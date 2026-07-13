import type { FinanceKind } from '../../types'
import { useFT } from './i18n'

export type KindFilter = FinanceKind | 'all'

/** The all / income / expense view filter shared by the entries and report tabs. */
export default function KindFilterChips({
  value,
  onChange,
}: {
  value: KindFilter
  onChange: (v: KindFilter) => void
}) {
  const ft = useFT()
  const options: [KindFilter, string][] = [
    ['all', ft.filterAll],
    ['income', ft.filterIncome],
    ['expense', ft.filterExpenses],
  ]
  return (
    <div className="seg seg-3 finance-kind-filter">
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          className={`seg-btn ${value === k ? 'on' : ''} ${k === 'all' ? '' : k}`.trim()}
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
