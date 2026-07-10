// Menu data, ported verbatim from pos.html — one source of truth for the module.
// (At cut-over this becomes owner-editable data; for parity it stays code.)

export interface ComboOption {
  name: string
  nameAr: string
  other?: boolean
}

export interface ComboSlot {
  name: string
  nameAr: string
  options?: ComboOption[]
  count?: boolean
  min?: number
  max?: number
  unit?: string
  unitAr?: string
}

export interface ComboDef {
  includes: { name: string; nameAr: string }[]
  slots: ComboSlot[]
}

export interface MenuItem {
  name: string
  nameAr: string
  price: number
  combo?: ComboDef
}

export interface MenuGroup {
  cat: string
  catAr: string
  oh: boolean
  items: MenuItem[]
}

export const MENU: MenuGroup[] = [
  { cat: 'פתיחים וסלטים', catAr: 'مقبلات وسلطات', oh: true, items: [
    { name: 'טחינה וחמוצים', nameAr: 'طحينة ومخللات', price: 15 },
    { name: 'לבנה', nameAr: 'لبنة', price: 20 },
    { name: 'סלט כרוב', nameAr: 'سلطة ملفوف', price: 20 },
    { name: 'סלט טבולה', nameAr: 'تبولة', price: 20 },
    { name: 'עלי גפן', nameAr: 'ورق عنب', price: 25 },
    { name: 'כרוב ממולא', nameAr: 'ملفوف محشي', price: 25 },
    { name: 'צלחת ממולאים', nameAr: 'صحن محاشي', price: 45 },
  ] },
  { cat: 'מאפים מהטאבון', catAr: 'معجنات الطابون', oh: true, items: [
    { name: 'זעתר', nameAr: 'زعتر', price: 20 },
    { name: 'פיצה', nameAr: 'بيتزا', price: 25 },
    { name: 'תרד', nameAr: 'سبانخ', price: 30 },
  ] },
  { cat: 'שתייה חמה', catAr: 'مشروبات ساخنة', oh: true, items: [
    { name: 'אספרסו / שחור', nameAr: 'إسبريسو / قهوة سوداء', price: 5 },
    { name: 'קפה עם חלב', nameAr: 'قهوة بحليب', price: 8 },
    { name: 'תה בכוס', nameAr: 'شاي بكوب', price: 8 },
    { name: 'קנקן תה', nameAr: 'إبريق شاي', price: 15 },
  ] },
  { cat: 'מתוקים', catAr: 'حلويات', oh: true, items: [
    { name: 'אבטיח טרי', nameAr: 'بطيخ طازج', price: 25 },
    { name: 'מתוקים', nameAr: 'حلويات', price: 15 },
  ] },
  { cat: 'תוספות', catAr: 'إضافات', oh: false, items: [
    { name: 'מנת דג', nameAr: 'صحن سمك', price: 80 },
    { name: "צ'יפס", nameAr: 'بطاطا مقلية', price: 30 },
  ] },
  { cat: 'ארוחות', catAr: 'وجبات', oh: false, items: [
    { name: 'ארוחת בוקר', nameAr: 'فطور', price: 65, combo: {
      includes: [],
      slots: [
        { name: 'עיקרית', nameAr: 'الطبق الرئيسي', options: [
          { name: 'שקשוקה', nameAr: 'شكشوكة' },
          { name: 'חביתה', nameAr: 'عجة' },
          { name: 'חביתת ירק', nameAr: 'عجة خضار' },
        ] },
        { name: 'סלט', nameAr: 'سلطة', options: [
          { name: 'סלט טבולה', nameAr: 'تبولة' },
          { name: 'סלט כרוב', nameAr: 'سلطة ملفوف' },
          { name: 'סלט אחר', nameAr: 'سلطة أخرى', other: true },
        ] },
        { name: 'ממרח', nameAr: 'إضافة', options: [
          { name: 'טחינה', nameAr: 'طحينة' },
          { name: 'לבנה', nameAr: 'لبنة' },
        ] },
        { name: 'פיתות', nameAr: 'خبز', count: true, min: 0, max: 2, unit: 'פיתה', unitAr: 'خبز' },
      ],
    } },
    { name: 'עסקית דג', nameAr: 'وجبة سمك', price: 110, combo: {
      includes: [
        { name: 'מנת דג', nameAr: 'صحن سمك' },
        { name: "צ'יפס", nameAr: 'بطاطا مقلية' },
      ],
      slots: [
        { name: 'סלט', nameAr: 'سلطة', options: [
          { name: 'סלט טבולה', nameAr: 'تبولة' },
          { name: 'סלט כרוב', nameAr: 'سلطة ملفوف' },
          { name: 'סלט אחר', nameAr: 'سلطة أخرى', other: true },
        ] },
      ],
    } },
  ] },
]

// Open-house cover prices
export const OH = { adult: 75, child: 60, family: 60 }

// Hebrew name → Arabic name, so lines saved before the Arabic menu existed still translate.
export const NAME_AR: Record<string, string> = {}
MENU.forEach((g) => g.items.forEach((it) => { NAME_AR[it.name] = it.nameAr }))

// Combo defs flattened with their category/pricing for the picker.
export interface FlatComboDef {
  name: string
  nameAr: string
  price: number
  oh: boolean
  cat: string
  catAr: string
  combo: ComboDef
}

export const COMBO_DEFS: FlatComboDef[] = []
MENU.forEach((g) => g.items.forEach((it) => {
  if (it.combo) COMBO_DEFS.push({ name: it.name, nameAr: it.nameAr, price: it.price, oh: g.oh, cat: g.cat, catAr: g.catAr, combo: it.combo })
}))
