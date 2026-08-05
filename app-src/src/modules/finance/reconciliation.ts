// "Are the books aligned?" — the shared read of finance.reconciliation().
//
// Live-computed, never stored and never dismissible: an alert you can dismiss is
// an alert that lies. The DB is the authority (55_finance_reconciliation.sql
// gates both entry points on finance.view); this module only shapes the result.
//
// Ownership: FinanceModule holds ONE useReconciliation and hands it to the tab,
// so the banner, the tab badge and the list all read the same fetch and all
// refresh together when a day is posted. The launcher uses the counts-only hook
// because it must not pay for a payload it never renders.
import { useCallback, useEffect, useState } from 'react'
import { finance } from '../../lib/supabase'

// stable empty map: a fresh object literal each render would re-run consumers
const NO_COUNTS: Record<string, number> = {}

// 'low' = listed but deliberately not counted by the badge (a pinned day that
// is currently costing nothing). The DB decides this, not the client.
type Severity = 'high' | 'medium' | 'low'

/** One leg of a POS day that differs from what the books hold. */
export interface LegDelta {
  leg: string
  delta: number
}

/** Discriminated on `type`: each variant carries exactly the fields the DB
 *  emits for it, so the UI narrows instead of asserting non-null. */
export type DriftItem =
  | {
      type: 'unposted_day'
      severity: Severity
      fix: 'post_day'
      business_date: string
      cash: number
      card: number
      food: number
      labor: number
      revenue: number
    }
  | {
      type: 'recompute_drift'
      severity: Severity
      fix: 'post_day'
      business_date: string
      legs: LegDelta[] | null
      total_delta: number
    }
  | {
      // a day the owner froze: POS has stopped writing it to the books at all
      type: 'pinned'
      severity: Severity
      fix: 'unpin'
      business_date: string
      reason: string
      pinned_at: string
      /** null when the pin predates the scanned window — see check 4 */
      legs: LegDelta[] | null
      total_delta: number
    }
  | {
      type: 'overdue_expected'
      severity: Severity
      fix: 'record_payment'
      expected_id: string
      direction: 'in' | 'out'
      category: string
      amount: number
      due_date: string
      reason: string | null
      days_overdue: number
      /** provenance of the expectation, so the item can link to whatever
       *  created it (a signed quote), not just to where it gets paid */
      source_module: string | null
      source_ref: string | null
    }

export interface Reconciliation {
  since: string
  generated_at: string
  /** ACTIONABLE items only — pinned days that cost nothing are listed but not
   *  counted, so the badge never sits permanently lit on a deliberate state.
   *  "Is everything clear?" is `items.length === 0`, never `count === 0`. */
  count: number
  items: DriftItem[]
}

async function fetchReconciliation(): Promise<Reconciliation> {
  const { data, error } = await finance().rpc('reconciliation')
  if (error) throw new Error(error.message)
  return data as Reconciliation
}

export interface UseReconciliation {
  data: Reconciliation | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useReconciliation(): UseReconciliation {
  const [data, setData] = useState<Reconciliation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchReconciliation())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}

/** Per-module drift counts — `{ finance: 3, pos: 1, quotes: 1 }` — which is
 *  what the launcher badges. The DB decides which module owns each item, so a
 *  new module that posts to finance gets a badge by writing its own
 *  provenance, with no change to the shell.
 *
 *  Returns {} rather than throwing: a badge is decoration, and a failed count
 *  must never break the launcher. Aborts on unmount, since users click a tile
 *  long before a scan returns. */
export function useDriftCounts(enabled: boolean): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>(NO_COUNTS)
  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    finance()
      .rpc('reconciliation_counts')
      .abortSignal(ctrl.signal)
      .then(({ data, error }) => {
        if (!error && data && typeof data === 'object') setCounts(data as Record<string, number>)
      })
    return () => ctrl.abort()
  }, [enabled])
  return counts
}
