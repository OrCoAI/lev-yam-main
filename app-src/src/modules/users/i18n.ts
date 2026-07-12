// Users module dictionary — started with the mobile-UX pass (2026-07). Holds
// only the strings born bilingual; the module's older Hebrew-hardcoded chrome
// is a tracked retrofit (ROADMAP Phase 1.5, H7) and lands here when it runs.
import { makeDictHook } from '../../lib/i18n'

const he = {
  // display names for permission-matrix module group headers (fallback: raw key)
  moduleNames: {
    core: 'ליבה',
    users: 'משתמשים',
    pos: 'קופה',
    finance: 'כספים',
    quotes: 'הצעות מחיר',
    events: 'אירועים',
  } as Record<string, string>,
}

const ar: typeof he = {
  moduleNames: {
    core: 'النواة',
    users: 'المستخدمون',
    pos: 'الكاسا',
    finance: 'المالية',
    quotes: 'عروض الأسعار',
    events: 'الفعاليات',
  },
}

export const useUT = makeDictHook(he, ar)
