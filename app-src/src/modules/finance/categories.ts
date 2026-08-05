// The category taxonomy — DB data since 54_finance_categories.sql, not a code
// literal. `finance.categories` is the single source of truth for which
// categories exist, their HE/AR labels, and which are derived-only
// (`owned_by_module` non-null ⇒ a module posting function is the one writer,
// mirrored in the DB by finance.entries_guard()).
//
// Loaded once per session into a module-level cache and shared by every tab —
// the entries form, the report breakdown, the expected list and the admin tab
// all read the same rows, so an owner edit shows everywhere at once.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { pickDbLabel, useI18n } from '../../lib/i18n'
import { finance } from '../../lib/supabase'
import type { FinanceCategoryRow, FinanceKind, FinancePaymentMethod } from '../../types'

export const PAYMENT_METHODS: FinancePaymentMethod[] = ['cash', 'private', 'grow', 'bank']

// Stable empty array: returned while loading so downstream useMemo deps don't
// see a fresh identity on every render.
const NO_ROWS: FinanceCategoryRow[] = []

let cache: FinanceCategoryRow[] | null = null
// One shared request in flight. Several consumers mount in the same commit (the
// entries tab alone mounts three), and without this each would fire its own
// identical SELECT and then stomp `cache` with a different array identity.
let inflight: Promise<FinanceCategoryRow[]> | null = null
// monotonic request id — only the newest load may commit to `cache`
let loadSeq = 0
const listeners = new Set<() => void>()

async function fetchAll(): Promise<FinanceCategoryRow[]> {
  const { data, error } = await finance()
    .from('categories')
    .select('*')
    .order('kind', { ascending: true })
    .order('sort', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as FinanceCategoryRow[]
}

/** Refetch and push to every mounted consumer — call after an admin edit.
 *  Generation-guarded (same shape as EntriesTab's loadIdRef): a forced reload can
 *  start while the initial fetch is still open, and without the guard whichever
 *  request happens to finish LAST wins — so adding a category mid-load would
 *  broadcast the pre-add snapshot and the new row would vanish from every tab. */
async function load(force: boolean): Promise<void> {
  if (!force && inflight) {
    await inflight
    return
  }
  const seq = ++loadSeq
  const pending = fetchAll()
  inflight = pending
  let rows: FinanceCategoryRow[]
  try {
    rows = await pending
  } finally {
    if (inflight === pending) inflight = null
  }
  if (seq !== loadSeq) return // a newer load superseded this one — its result wins
  cache = rows
  listeners.forEach((notify) => notify())
}

interface UseCategories {
  rows: FinanceCategoryRow[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useCategories(): UseCategories {
  const [rows, setRows] = useState<FinanceCategoryRow[] | null>(cache)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (force: boolean) => {
    try {
      setError(null)
      await load(force)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const reload = useCallback(() => run(true), [run])

  useEffect(() => {
    const notify = () => setRows(cache)
    listeners.add(notify)
    if (cache) setRows(cache)
    else void run(false)
    return () => {
      listeners.delete(notify)
    }
  }, [run])

  return { rows: rows ?? NO_ROWS, loading: rows === null && error === null, error, reload }
}

/** Categories a human may pick for a new entry of this kind: active, and not
 *  owned by a module (those are posted automatically — the DB rejects them). */
export function pickable(rows: FinanceCategoryRow[], kind: FinanceKind): FinanceCategoryRow[] {
  return rows.filter((c) => c.kind === kind && c.active && !c.owned_by_module)
}

/** Display label for a category, in the active language. Delegates the
 *  language/fallback rule to pickDbLabel() — the same one behind useRoleName —
 *  so categories and roles can never drift apart on it. */
export function useCategoryName(): (kind: FinanceKind, key: string) => string {
  const { lang } = useI18n()
  const { rows } = useCategories()
  return useMemo(() => {
    const byKey = new Map(rows.map((c) => [`${c.kind}:${c.key}`, c]))
    return (kind, key) => {
      const row = byKey.get(`${kind}:${key}`)
      // no row = a slug deleted from under an entry, or a legacy one adopted
      // before this table existed: show the slug rather than nothing
      return row ? pickDbLabel(lang, row) : key
    }
  }, [rows, lang])
}
