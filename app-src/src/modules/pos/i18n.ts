// POS module i18n: pos.html is written as inline tr(he, ar) pairs — the port
// keeps that shape on top of the shell's language state (one toggle for the
// whole platform). Item/menu names translate via their own nameAr fields.
import { useI18n } from '../../lib/i18n'
import { menuNameAr } from './menuData'

export type Tr = (he: string, ar: string) => string

export function usePosTr(): { tr: Tr; lang: 'he' | 'ar' } {
  const { lang } = useI18n()
  const tr: Tr = (he, ar) => (lang === 'ar' ? ar : he)
  return { tr, lang }
}

// Active-language name for anything carrying { name, nameAr } (order lines,
// combo components, menu items). Falls back through the menu's HE→AR map so
// lines saved before the Arabic menu existed still translate.
export function itemName(it: { name: string; nameAr?: string }, lang: 'he' | 'ar'): string {
  if (lang !== 'ar') return it.name
  return it.nameAr || menuNameAr(it.name) || it.name
}

// A configured line's chosen parts as one "· "-joined string (bill, kitchen, order list).
export function componentsLine(components: { name: string; nameAr?: string; qty?: number }[] | undefined, lang: 'he' | 'ar'): string {
  return (components || []).map((c) => itemName(c, lang) + (c.qty ? ' ×' + c.qty : '')).join(' · ')
}
