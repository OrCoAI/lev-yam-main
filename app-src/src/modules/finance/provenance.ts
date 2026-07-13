// Resolve a posted row's provenance (source_module + source_ref) to the in-app
// page that owns it — derived finance rows are immutable here by design, so
// "edit" means going to the source module. Real ref formats (supabase/schema):
//   pos.close_day():            'pos:<YYYY-MM-DD>:<leg>[:rN]'
//   finance.record_payment():   'expected:<expected_uuid>'  (module = the
//                               expectation's own source, e.g. 'quotes')
//   quotes → finance.expected:  '<quote_uuid>:deposit' | '<quote_uuid>:balance'
// Client-side parsing is the interim mechanism — the roadmap tracks moving
// this into a DB view next to the posting functions that own the grammar.
import { useEffect, useRef, useState } from 'react'
import { finance } from '../../lib/supabase'
import { posReportHref, REPORT_DATE_RE } from '../pos/logic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXPECTED_PREFIX = 'expected:'

type ProvenanceRow = { source_module: string | null; source_ref: string | null }

/** Entries posted off a quotes expectation carry 'expected:<uuid>' — resolving
 *  them to a quote page needs the expectation's own source_ref. This hook
 *  fetches exactly the expectation ids visible in `rows` (batched, cached for
 *  the component's lifetime, best-effort: on error the links just don't
 *  render) and returns expected.id → quote uuid. */
export function useQuoteMap(rows: readonly ProvenanceRow[]): ReadonlyMap<string, string> {
  const [map, setMap] = useState<ReadonlyMap<string, string>>(new Map())
  const requested = useRef(new Set<string>())

  const needed: string[] = []
  for (const r of rows) {
    if (r.source_module !== 'quotes' || !r.source_ref?.startsWith(EXPECTED_PREFIX)) continue
    const id = r.source_ref.slice(EXPECTED_PREFIX.length)
    if (UUID_RE.test(id) && !requested.current.has(id)) needed.push(id)
  }
  const neededKey = needed.join(',')

  useEffect(() => {
    if (!neededKey) return
    const ids = neededKey.split(',')
    for (const id of ids) requested.current.add(id)
    let alive = true
    finance()
      .from('expected')
      .select('id, source_ref')
      .eq('source_module', 'quotes')
      .in('id', ids)
      .then(({ data }) => {
        if (!alive || !data) return
        setMap((prev) => {
          const next = new Map(prev)
          for (const row of data as { id: string; source_ref: string | null }[]) {
            const quoteId = row.source_ref?.split(':')[0]
            if (quoteId && UUID_RE.test(quoteId)) next.set(row.id, quoteId)
          }
          return next
        })
      })
    return () => {
      alive = false
    }
  }, [neededKey])

  return map
}

/** In-app href for a provenance ref, or null when there is no page to open
 *  (manual rows; 'finance'-sourced payments on hand-created expectations). */
export function sourceHref(
  module: string | null,
  ref: string | null,
  quoteByExpected?: ReadonlyMap<string, string>,
): string | null {
  if (!module || !ref) return null
  if (module === 'pos') {
    const date = ref.split(':')[1]
    return date && REPORT_DATE_RE.test(date) ? posReportHref(date) : '/pos'
  }
  if (module === 'quotes') {
    if (ref.startsWith(EXPECTED_PREFIX)) {
      const quoteId = quoteByExpected?.get(ref.slice(EXPECTED_PREFIX.length))
      return quoteId ? `/quotes/${quoteId}` : null
    }
    const quoteId = ref.split(':')[0]
    return UUID_RE.test(quoteId) ? `/quotes/${quoteId}` : null
  }
  return null
}
