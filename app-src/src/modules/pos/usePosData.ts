// Live shared data: Supabase realtime + localStorage cache, ported from
// pos.html's usePosData. Local-first — paint from cache, sync in the
// background, queue dirty tables while offline (venue Wi-Fi is flaky).
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  addPaymentRpc, archiveBills, closeTableRpc, deleteTable, editPaymentRpc, fetchAll,
  fetchOpenPayments, markItemRpc, reopenBillRpc, upsertTable, voidItemRpc, voidPaymentRpc,
} from './api'
import { buildBillPayload, makeTable, mergeKitchen, nextTableNum, reconcileItems, todayKey } from './logic'
import type { ClosedBill, Payment, PosPayment, PosTable } from './types'

// Separate cache key from pos.html's (same origin, different app state).
const STORE_KEY = 'levyam_app_pos_v1'

interface PosData {
  tables: PosTable[]
  closed: ClosedBill[]
}

function loadCache(): PosData {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') as PosData | null
    if (d && Array.isArray(d.tables) && Array.isArray(d.closed))
      return { tables: d.tables.map((t) => ({ ...t, items: reconcileItems(t.items) })), closed: d.closed }
  } catch { /* corrupted cache → start fresh */ }
  return { tables: [], closed: [] }
}

function saveCache(d: PosData) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(d)) } catch { /* quota — cache only */ }
}

export function usePosData(activeId: string | null, onWriteError: (message: string) => void) {
  const [data, setData] = useState<PosData>(loadCache)
  const [payments, setPayments] = useState<Record<string, PosPayment[]>>({})
  const [online, setOnline] = useState(true)
  const dataRef = useRef(data)
  dataRef.current = data
  const paymentsRef = useRef(payments)
  paymentsRef.current = payments
  const activeRef = useRef(activeId)
  activeRef.current = activeId
  const pushers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const dirty = useRef(new Set<string>())

  useEffect(() => { saveCache(data) }, [data]) // keep cache fresh

  // initial load + realtime subscription
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const reload = async () => {
      try {
        const [fresh, pmts] = await Promise.all([fetchAll(), fetchOpenPayments().catch(() => ({}))])
        if (!alive) return
        setOnline(true)
        setPayments(pmts)
        setData((prev) => {
          const id = activeRef.current
          const localActive = id ? prev.tables.find((t) => t.id === id) : null
          if (!localActive) return fresh // not editing — take server truth
          const serverActive = fresh.tables.find((t) => t.id === id)
          // keep the waiter's in-progress items, but overlay the chef's kitchen flags
          const mergedActive = serverActive ? mergeKitchen(localActive, serverActive) : localActive
          const tables = serverActive
            ? fresh.tables.map((t) => (t.id === id ? mergedActive : t))
            : [...fresh.tables, mergedActive]
          return { tables, closed: fresh.closed } // never yank the table being edited
        })
      } catch {
        if (alive) setOnline(false)
      }
    }
    const flushDirty = async () => {
      for (const id of [...dirty.current]) {
        const t = dataRef.current.tables.find((x) => x.id === id)
        try {
          if (t) await upsertTable(t)
          dirty.current.delete(id)
        } catch { /* stays dirty, retried on next resync */ }
      }
    }
    const resync = async () => { await flushDirty(); void reload() }
    const ping = () => { clearTimeout(timer); timer = setTimeout(reload, 250) }

    void reload()
    const ch = supabase.channel('pos-live')
      .on('postgres_changes', { event: '*', schema: 'pos', table: 'pos_tables' }, ping)
      .on('postgres_changes', { event: '*', schema: 'pos', table: 'pos_bills' }, ping)
      .on('postgres_changes', { event: '*', schema: 'pos', table: 'pos_payments' }, ping)
      .subscribe((st) => { if (st === 'SUBSCRIBED') void resync() })
    window.addEventListener('online', resync)
    return () => {
      alive = false
      clearTimeout(timer)
      void supabase.removeChannel(ch)
      window.removeEventListener('online', resync)
    }
  }, [])

  // RLS/permission rejections (42501, or P0001 from our raise-exception guards)
  // are NOT connectivity problems — surface them instead of retrying forever
  // behind the offline banner.
  const isDenial = (error: { code?: string } | null) =>
    !!error && (error.code === '42501' || error.code === 'P0001')

  const pushTable = (t: PosTable, immediate: boolean) => {
    const run = () => upsertTable(t).then(({ error }) => {
      if (error) {
        if (isDenial(error)) { dirty.current.delete(t.id); onWriteError(error.message); return }
        dirty.current.add(t.id)
        setOnline(false)
      } else { dirty.current.delete(t.id); setOnline(true) }
    })
    if (immediate) { void run(); return }
    clearTimeout(pushers.current[t.id])
    pushers.current[t.id] = setTimeout(run, 500) // batch rapid qty taps
  }

  const openNew = () => {
    const t = makeTable(dataRef.current.tables)
    setData((d) => ({ ...d, tables: [...d.tables, t] }))
    pushTable(t, true)
    return t.id
  }

  const updateTable = (id: string, updater: (t: PosTable) => PosTable) => {
    const cur = dataRef.current.tables.find((t) => t.id === id)
    if (!cur) return
    const next = updater(cur)
    setData((d) => ({ ...d, tables: d.tables.map((t) => (t.id === id ? next : t)) }))
    pushTable(next, false)
  }

  // Sum a bill's payments by method across prior (recorded) + the closing array,
  // so the optimistic ClosedBill mirrors what the server derives.
  const sumPaid = (id: string, closing: { method: 'cash' | 'card'; amount: number }[], m: 'cash' | 'card') =>
    (paymentsRef.current[id] || []).filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0)
    + closing.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0)

  const payAndClose = (id: string, payment: Payment) => {
    const t = dataRef.current.tables.find((x) => x.id === id)
    if (!t) return
    clearTimeout(pushers.current[id])
    const closing = payment.payments || []
    const { bill, items } = buildBillPayload(t, payment)
    const rec: ClosedBill = {
      id: t.id, num: t.num, name: t.name || '', items: t.items, guests: t.guests,
      useOH: t.useOH, openedAt: t.openedAt, paidAt: Date.now(),
      cash: sumPaid(id, closing, 'cash'), card: sumPaid(id, closing, 'card'),
      discount: payment.discount || 0, tip: payment.tip || 0, total: payment.total,
    }
    setData((d) => ({ ...d, tables: d.tables.filter((x) => x.id !== id), closed: [rec, ...d.closed] }))
    void closeTableRpc(bill, items, closing).then(({ error }) => {
      setOnline(!error)
      if (error) { console.error(error); onWriteError(error.message) }
    })
  }

  const refreshPayments = () =>
    void fetchOpenPayments().then(setPayments).catch(() => { /* realtime ping will refresh */ })
  // Payment writes share one tail: surface the error, else pull the fresh list.
  const afterWrite = (p: PromiseLike<{ error: { message: string } | null }>) =>
    p.then(({ error }) => { if (error) onWriteError(error.message); else refreshPayments() })

  // Record one or more payments on an open table (deposit / split / one guest pays),
  // then refresh once for the whole batch.
  const recordPayments = (id: string, pmts: { method: 'cash' | 'card'; amount: number }[]) =>
    Promise.all(pmts.map((p) => addPaymentRpc(id, p.method, p.amount))).then((rs) => {
      const failed = rs.find((r) => r.error)
      if (failed?.error) onWriteError(failed.error.message)
      refreshPayments()
    })
  const voidPayment = (paymentId: number) => afterWrite(voidPaymentRpc(paymentId))
  const editPayment = (paymentId: number, method: 'cash' | 'card', amount: number, note?: string) =>
    afterWrite(editPaymentRpc(paymentId, method, amount, note))
  // Audit an item removed at checkout; returns whether it was accepted, so the
  // caller removes it locally only on success.
  const voidItem = async (id: string, name: string, qty: number, unitPrice: number, wasFired: boolean, reason?: string) => {
    const { error } = await voidItemRpc(id, name, qty, unitPrice, wasFired, reason)
    if (error) { onWriteError(error.message); return false }
    return true
  }

  const cancelTable = (id: string) => {
    clearTimeout(pushers.current[id])
    dirty.current.delete(id)
    setData((d) => ({ ...d, tables: d.tables.filter((x) => x.id !== id) }))
    void deleteTable(id).then(({ error }) => { setOnline(!error); if (isDenial(error)) onWriteError(error!.message) })
  }

  const reopen = (id: string) => {
    const rec = dataRef.current.closed.find((x) => x.id === id)
    if (!rec) return
    const num = nextTableNum(dataRef.current.tables)
    const t: PosTable = {
      id: rec.id, num, name: rec.name, items: reconcileItems(rec.items), guests: rec.guests,
      useOH: rec.useOH, openedAt: rec.openedAt || Date.now(),
    }
    setData((d) => ({ ...d, closed: d.closed.filter((x) => x.id !== id), tables: [...d.tables, t] }))
    void reopenBillRpc(id, num).then(({ error }) => { setOnline(!error); if (isDenial(error)) onWriteError(error!.message) })
  }

  // Waiter "send to kitchen": send the delta (sent = qty) on any line with more ordered
  // than already sent — this is what makes re-ordering more of an item reach the kitchen.
  const fireTable = (id: string) => {
    const cur = dataRef.current.tables.find((t) => t.id === id)
    if (!cur) return
    const now = new Date().toISOString()
    const next = { ...cur, items: cur.items.map((it) =>
      (it.qty || 0) > (it.sent || 0) ? { ...it, sent: it.qty, firedAt: it.firedAt || now } : it) }
    setData((d) => ({ ...d, tables: d.tables.map((t) => (t.id === id ? next : t)) }))
    pushTable(next, true)
  }

  // Chef "mark ready / undo": done = sent (ready) or done = served (undo). Atomic per-item
  // RPC reads sent/served on the server, so it never clobbers a waiter editing the table.
  const markDone = (tableId: string, itemId: string, ready: boolean) => {
    setData((d) => ({ ...d, tables: d.tables.map((t) => (t.id !== tableId ? t
      : { ...t, items: t.items.map((it) => (it.id === itemId
          ? { ...it, done: ready ? it.sent || 0 : it.served || 0 } : it)) })) }))
    void markItemRpc(tableId, itemId, ready).then(({ error }) => { setOnline(!error); if (isDenial(error)) onWriteError(error!.message) })
  }

  // Waiter opens a table → its ready dishes are acknowledged as served (served = done),
  // clearing them from the "ready to serve" signal.
  const serveReady = (id: string) => {
    const cur = dataRef.current.tables.find((t) => t.id === id)
    if (!cur || !cur.items.some((it) => (it.done || 0) > (it.served || 0))) return
    const next = { ...cur, items: cur.items.map((it) =>
      (it.done || 0) > (it.served || 0) ? { ...it, served: it.done } : it) }
    setData((d) => ({ ...d, tables: d.tables.map((t) => (t.id === id ? next : t)) }))
    pushTable(next, true)
  }

  // "End day" archives (hides) today's bills — data is kept for analytics, never deleted.
  const clearToday = () => {
    const today = todayKey()
    const ids = dataRef.current.closed.filter((c) => new Date(c.paidAt).toDateString() === today).map((c) => c.id)
    setData((d) => ({ ...d, closed: d.closed.filter((c) => new Date(c.paidAt).toDateString() !== today) }))
    if (ids.length) void archiveBills(ids).then(({ error }) => { setOnline(!error); if (isDenial(error)) onWriteError(error!.message) })
  }

  return {
    data, payments, online, openNew, updateTable, payAndClose, cancelTable, reopen, clearToday,
    fireTable, markDone, serveReady, recordPayments, voidPayment, editPayment, voidItem,
  }
}
