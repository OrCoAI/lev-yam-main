// The drift list — one row per thing that makes the books disagree with the
// rest of the platform, each carrying the action that resolves it.
//
// Fix actions require the permission they would have required anyway (posting a
// day → pos.manage, recording a payment → finance.manage), so this tab can never
// become a privilege side-door: a finance reader sees the problem and is told
// where it is, but cannot act on it from here.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCan, PERM } from '../../lib/permissions'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import { posReportHref } from '../pos/logic'
import { pos } from '../../lib/supabase'
import ErrorNotice from './ErrorNotice'
import { amount, shortDate } from './format'
import { sourceHref } from './provenance'
import { useFT, type FinanceDict } from './i18n'
import type { DriftItem, LegDelta, UseReconciliation } from './reconciliation'

export default function ReconcileTab({
  recon,
  onGoExpected,
}: {
  /** owned by FinanceModule so the banner, the tab badge and this list all
   *  refresh together after a fix — otherwise the badge keeps the stale count */
  recon: UseReconciliation
  /** jump to the Expected tab AND focus the exact row, so the fix lands on the
   *  item the user was looking at rather than a list they must re-scan */
  onGoExpected: (expectedId: string) => void
}) {
  const ft = useFT()
  const canPostDay = useCan(PERM.posManage)
  const canOverride = useCan(PERM.financeOverride)
  // .rl-actions and .rl-more are display:none under 640px until the row is
  // expanded — without this the fix buttons are invisible and untappable on
  // exactly the device the staff use (MODULE-TEMPLATE.md §3)
  const { rowProps } = useRowDisclosure()
  const { data, loading, error, reload } = recon
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  /** Every fix runs the same way: do the write, surface any error, refresh the
   *  shared fetch so the banner, the tab badge and this list move together. */
  async function runFix(key: string, fix: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key)
    setActionError(null)
    const { error: err } = await fix()
    setBusy(null)
    if (err) setActionError(err.message)
    else await reload()
  }

  const postDay = (date: string) => runFix(date, () => pos().rpc('close_day', { p_date: date }))

  // unfreezing a day lets POS resume posting it — the correction itself is a
  // separate additive row and is not affected either way
  const unpin = (date: string) =>
    runFix(date, () => pos().from('day_pins').delete().eq('business_date', date))

  if (loading) return <div className="muted">{ft.reconLoading}</div>
  if (error) return <ErrorNotice error={error} />
  if (!data) return null

  // all-clear is about the LIST being empty, not the count: a pinned day that
  // costs nothing is listed with count 0, and claiming "all clear" over it
  // would hide the very freeze this check exists to keep visible
  if (data.items.length === 0)
    return (
      <div className="card finance-recon-clear">
        <p className="finance-recon-clear-title">{ft.reconAllClear}</p>
        <p className="muted">{ft.reconAllClearSub}</p>
      </div>
    )

  return (
    <div>
      <p className="notice">{ft.reconIntro}</p>
      {actionError && <ErrorNotice error={actionError} />}

      <div className="card rowline">
        <table className="grid">
          <thead>
            <tr>
              <th>{ft.reconColWhen}</th>
              <th>{ft.reconColWhat}</th>
              <th>{ft.reconColAmount}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={itemKey(item)}
                className={`finance-recon-${item.severity}`}
                {...rowProps(itemKey(item))}
              >
                <td className="rl-lead">{shortDate(when(item))}</td>
                <td className="rl-main">
                  {title(ft, item)}
                  <span className="muted finance-recon-detail">{detail(ft, item)}</span>
                </td>
                <td className="rl-amt finance-amount">
                  <span dir="ltr">{amount(money(item))}</span>
                </td>
                <td className="rl-actions">
                  {item.fix === 'post_day' && (
                    <>
                      <Link className="btn-ghost btn-sm" to={posReportHref(item.business_date)}>
                        {ft.reconOpenDay}
                      </Link>
                      {canPostDay && (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={busy !== null}
                          onClick={() => postDay(item.business_date)}
                        >
                          {busy === item.business_date ? ft.loading : ft.reconPostDay}
                        </button>
                      )}
                    </>
                  )}
                  {item.fix === 'unpin' && (
                    <>
                      <Link className="btn-ghost btn-sm" to={posReportHref(item.business_date)}>
                        {ft.reconOpenDay}
                      </Link>
                      {canOverride && (
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          disabled={busy !== null}
                          onClick={() => unpin(item.business_date)}
                        >
                          {busy === item.business_date ? ft.loading : ft.reconUnpin}
                        </button>
                      )}
                    </>
                  )}
                  {item.fix === 'record_payment' && (
                    <>
                      {/* the thing that CAUSED it: a deposit that never arrived
                          belongs to the signed quote behind it */}
                      {sourceLink(item.source_module, item.source_ref) && (
                        <Link
                          className="btn-ghost btn-sm"
                          to={sourceLink(item.source_module, item.source_ref) as string}
                        >
                          {ft.reconOpenSource}
                        </Link>
                      )}
                      {/* the expected tab owns the payment form (amount, method,
                          date) — a second money-moving form would be a second
                          way to get it wrong, so this jumps there instead */}
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => onGoExpected(item.expected_id)}
                      >
                        {ft.reconGoExpected}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Where did this item come from? Only quotes-sourced expectations resolve
 *  today; a hand-created one has no page to open and simply shows no link. */
const sourceLink = (module: string | null, ref: string | null) => sourceHref(module, ref)

const itemKey = (i: DriftItem) =>
  i.type === 'overdue_expected' ? `${i.type}:${i.expected_id}` : `${i.type}:${i.business_date}`

const when = (i: DriftItem) => (i.type === 'overdue_expected' ? i.due_date : i.business_date)

function money(i: DriftItem) {
  if (i.type === 'unposted_day') return i.revenue
  if (i.type === 'overdue_expected') return i.amount
  return i.total_delta // recompute_drift and pinned both report a leg delta
}

function title(ft: FinanceDict, i: DriftItem) {
  if (i.type === 'unposted_day') return ft.reconUnposted
  if (i.type === 'recompute_drift') return ft.reconDrift
  if (i.type === 'pinned') return ft.reconPinned
  return ft.reconOverdue
}

function detail(ft: FinanceDict, i: DriftItem) {
  if (i.type === 'unposted_day') return ft.reconUnpostedDetail
  if (i.type === 'recompute_drift') return ft.reconDriftDetail + legSummary(i.legs)
  if (i.type === 'pinned')
    // A frozen day that has started accumulating money outside the books is a
    // different situation from one that is simply frozen — say which. Keyed on
    // `legs`, exactly as the SQL sets severity: `total_delta` would call a
    // cancelling drift (+100 cash / −100 card) "costing nothing".
    return i.legs === null
      ? ft.reconPinnedDetail(i.reason)
      : ft.reconPinnedStaleDetail(i.reason) + legSummary(i.legs)
  return ft.reconOverdueDetail(String(i.days_overdue))
}

/** Per-leg breakdown, so a drift whose legs cancel out still shows the money
 *  that moved instead of a bare and baffling "0 ₪". */
function legSummary(legs: LegDelta[] | null) {
  if (!legs?.length) return ''
  return ' · ' + legs.map((l) => `${l.leg} ${l.delta > 0 ? '+' : ''}${l.delta}`).join(' · ')
}
