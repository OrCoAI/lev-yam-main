// Menu TYPES only. The menu content is owner-editable data in the DB
// (pos.menu_categories / pos.menu_items, schema/51_pos_menu.sql) and is loaded
// at runtime into menuData.ts — this file no longer holds a static menu.
// Open house was retired 2026-07-28, so there is no per-category `oh` flag.

// A selectable option within a group (52_pos_menu_options). price is the delta
// added per selection (for a count group, per unit beyond the group's `included`).
export interface MenuOptionChoice {
  id: string
  name: string
  nameAr: string
  price: number
}

// An option group on an item or meal: choose-one / count / optional-add.
export interface MenuOptionGroup {
  id: string
  name: string
  nameAr: string
  kind: 'choice' | 'count' | 'add'
  min: number
  max: number
  included: number // count: free units before per-unit pricing
  options: MenuOptionChoice[]
}

export interface MenuItem {
  name: string
  nameAr: string
  price: number
  isMeal?: boolean
  includes?: { name: string; nameAr: string }[] // meals: fixed dishes (display / kitchen)
  options?: MenuOptionGroup[]                    // per-item / meal options (empty = plain stepper)
}

export interface MenuGroup {
  cat: string
  catAr: string
  items: MenuItem[]
}

// A meal flattened with its category for the picker: fixed includes + option groups.
export interface FlatComboDef {
  name: string
  nameAr: string
  price: number
  cat: string
  catAr: string
  includes: { name: string; nameAr: string }[]
  options: MenuOptionGroup[]
}
