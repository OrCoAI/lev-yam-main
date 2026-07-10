// Live shared data: Supabase realtime + localStorage cache, ported from
// pos.html's usePosData. Local-first — paint from cache, sync in the
// background, queue dirty tables while offline (venue Wi-Fi is flaky).
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  archiveBills, closeTableRpc, deleteTable, fetchAll, markItemRpc, reopenBillRpc, upsertTable,
} from './api'
import { buildBillPayload, makeTable, mergeKitchen, nextTableNum, reconcileItems, todayKey } from './logic'
import type { ClosedBill, Payment, PosTable } from './types'

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
  const [online, setOnline] = useState(true)
  const dataRef = useRef(data)
  dataRef.current = data
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
        const fresh = await fetchAll()
        if (!alive) return
        setOnline(true)
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_tables' }, ping)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_bills' }, ping)
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

  const payAndClose = (id: string, payment: Payment) => {
    const t = dataRef.current.tables.find((x) => x.id === id)
    if (!t) return
    clearTimeout(pushers.current[id])
    const { bill, items } = buildBillPayload(t, payment)
    const rec: ClosedBill = {
      id: t.id, num: t.num, name: t.name || '', items: t.items, guests: t.guests,
      useOH: t.useOH, openedAt: t.openedAt, paidAt: Date.now(),
      cash: payment.cash, card: payment.card,
      discount: payment.discount || 0, tip: payment.tip || 0, total: payment.total,
    }
    setData((d) => ({ ...d, tables: d.tables.filter((x) => x.id !== id), closed: [rec, ...d.closed] }))
    void closeTableRpc(bill, items).then(({ error }) => {
      setOnline(!error)
      if (error) {
        console.error(error)
        onWriteError(error.message)
      }
    })
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

  return { data, online, openNew, updateTable, payAndClose, cancelTable, reopen, clearToday, fireTable, markDone, serveReady }
}
