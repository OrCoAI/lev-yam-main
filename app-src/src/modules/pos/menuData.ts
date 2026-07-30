// Runtime menu store. The menu is owner-editable data in the DB (pos.menu_*,
// schema/51_pos_menu.sql); this module fetches it, caches it in localStorage for
// synchronous first paint (so the floor's pure builders — buildItems /
// reconcileItems — always have a menu even before the network returns), and
// notifies subscribers when it refreshes. Replaces the old static menu.ts data.
import { useEffect, useState } from 'react'
import {
  fetchMenu, type MenuCategoryRow, type MenuItemRow, type MenuOptionGroupRow, type MenuOptionRow,
} from './api'
import type { FlatComboDef, MenuGroup, MenuItem, MenuOptionGroup } from './menu'

const CACHE_KEY = 'levyam_app_pos_menu_v2'

interface MenuBundle {
  groups: MenuGroup[]        // categories → items (meals carry includes + options), for ordering
  combos: FlatComboDef[]     // meals flattened for the picker
  nameAr: Record<string, string> // Hebrew name → Arabic, for lines saved without nameAr
}

const EMPTY: MenuBundle = { groups: [], combos: [], nameAr: {} }

// meal composition jsonb → the fixed `includes` (choices now live in option groups)
function toIncludes(raw: unknown): { name: string; nameAr: string }[] {
  const c = raw as { includes?: { name_he: string; name_ar: string }[] } | null
  if (!c || !Array.isArray(c.includes)) return []
  return c.includes.map((x) => ({ name: x.name_he, nameAr: x.name_ar }))
}

function build(
  categories: MenuCategoryRow[], items: MenuItemRow[],
  groupRows: MenuOptionGroupRow[], optionRows: MenuOptionRow[],
): MenuBundle {
  // option groups (with their options) keyed by item id
  const optsByGroup: Record<string, MenuOptionRow[]> = {}
  optionRows.forEach((o) => { (optsByGroup[o.group_id] ||= []).push(o) })
  const groupsByItem: Record<string, MenuOptionGroup[]> = {}
  ;[...groupRows].sort((a, b) => a.sort - b.sort).forEach((g) => {
    ;(groupsByItem[g.item_id] ||= []).push({
      id: g.id, name: g.name_he, nameAr: g.name_ar, kind: g.kind,
      min: g.min_sel, max: g.max_sel, included: g.included,
      options: (optsByGroup[g.id] || []).sort((a, b) => a.sort - b.sort)
        .map((o) => ({ id: o.id, name: o.name_he, nameAr: o.name_ar, price: Number(o.price_delta) || 0 })),
    })
  })

  const cats = [...categories].sort((a, b) => a.sort - b.sort)
  const groups: MenuGroup[] = cats.map((c) => ({
    cat: c.name_he, catAr: c.name_ar,
    items: items.filter((i) => i.category_id === c.id).sort((a, b) => a.sort - b.sort).map((i) => ({
      name: i.name_he, nameAr: i.name_ar, price: Number(i.price) || 0,
      isMeal: i.is_meal,
      includes: i.is_meal ? toIncludes(i.composition) : undefined,
      options: groupsByItem[i.id],
    })),
  })).filter((g) => g.items.length)
  // Only meals live in the picker section. Plain items — including ones that carry
  // optional add-ons — stay in their category grid (owner 2026-07-29); their options
  // are reached through the per-card ✎ sheet (getMenuItem below), not this list.
  const combos: FlatComboDef[] = []
  groups.forEach((g) => g.items.forEach((it) => {
    if (it.isMeal) combos.push({ name: it.name, nameAr: it.nameAr, price: it.price, cat: g.cat, catAr: g.catAr, includes: it.includes || [], options: it.options || [] })
  }))
  const nameAr: Record<string, string> = {}
  items.forEach((i) => { nameAr[i.name_he] = i.name_ar })
  return { groups, combos, nameAr }
}

// Live bundle: seeded synchronously from cache at module load so the imperative
// builders below never see an empty menu once the venue has loaded it once.
let bundle: MenuBundle = loadCache()
const subs = new Set<() => void>()

function loadCache(): MenuBundle {
  try {
    const d = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as MenuBundle | null
    if (d && Array.isArray(d.groups)) return d
  } catch { /* corrupt cache → empty until the fetch lands */ }
  return EMPTY
}

function setBundle(next: MenuBundle) {
  bundle = next
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch { /* quota — in-memory only */ }
  subs.forEach((fn) => fn())
}

export const getMenuGroups = () => bundle.groups
export const getComboDefs = () => bundle.combos
export const menuNameAr = (name: string) => bundle.nameAr[name]

// A menu item by its Hebrew name — the ✎ configure sheet needs its option groups
// (and includes/price) to open the picker for a plain grid line.
export function getMenuItem(name: string): MenuItem | undefined {
  for (const g of bundle.groups) {
    const it = g.items.find((x) => x.name === name)
    if (it) return it
  }
  return undefined
}

// The dishes a kitchen filter can pick from: every standalone dish PLUS the
// component dishes inside meals (so the chef can filter to e.g. "fish" and still
// see the fish portion of a meal). Meal names themselves are not cookable dishes,
// so they're excluded. Deduped, in menu order.
export function getFilterableDishes(): { name: string; nameAr: string }[] {
  const seen = new Map<string, string>()
  const add = (name: string, nameAr: string) => { if (!seen.has(name)) seen.set(name, nameAr) }
  bundle.groups.forEach((g) => g.items.forEach((it) => {
    if (it.isMeal) {
      ;(it.includes || []).forEach((c) => add(c.name, c.nameAr))
      ;(it.options || []).forEach((grp) => grp.options.forEach((o) => add(o.name, o.nameAr)))
    } else {
      add(it.name, it.nameAr)
    }
  }))
  return [...seen].map(([name, nameAr]) => ({ name, nameAr }))
}

// Fetch the menu and publish it. Safe to call repeatedly (on mount / after edits).
export async function refreshMenu(): Promise<void> {
  const { categories, items, groups, options } = await fetchMenu()
  setBundle(build(categories, items, groups, options))
}

// Subscribe to menu changes; returns an unsubscribe. Used by useMenu to re-render.
export function subscribeMenu(fn: () => void): () => void {
  subs.add(fn)
  return () => { subs.delete(fn) }
}

// Hook: ensures the menu is loaded and re-renders consumers when it refreshes.
// `ready` is false only on the very first run before any menu has ever loaded.
export function useMenu(): { ready: boolean; groups: MenuGroup[]; combos: FlatComboDef[]; refresh: () => Promise<void> } {
  const [, bump] = useState(0)
  useEffect(() => {
    const unsub = subscribeMenu(() => bump((n) => n + 1))
    void refreshMenu().catch(() => { /* keep showing cache; realtime/next open retries */ })
    return unsub
  }, [])
  return { ready: bundle.groups.length > 0, groups: bundle.groups, combos: bundle.combos, refresh: refreshMenu }
}
