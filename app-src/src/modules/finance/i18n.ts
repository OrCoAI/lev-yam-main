// Finance module dictionary — started with the mobile-UX pass (2026-07): two
// parallel typed objects through makeDictHook (THE module i18n pattern).
// Holds only the strings born bilingual; the module's older Hebrew-hardcoded
// chrome is a tracked retrofit (ROADMAP: finance follow-ups) and lands here.
import { makeDictHook } from '../../lib/i18n'

const he = {
  addEntry: 'הוספת תנועה',
  closeForm: 'סגירה',
  edit: 'ערוך',
  delete: 'מחק',
  recordPayment: 'נרשם תשלום',
  cancelExpected: 'בטל צפי',
  lockedByModule: 'נרשם אוטומטית ממודול המקור — עריכה ותיקונים נעשים שם',
}

const ar: typeof he = {
  addEntry: 'إضافة حركة',
  closeForm: 'إغلاق',
  edit: 'تعديل',
  delete: 'حذف',
  recordPayment: 'تسجيل دفعة',
  cancelExpected: 'إلغاء المتوقّع',
  lockedByModule: 'سُجّل تلقائياً من الوحدة المصدر — التعديل والتصحيح يتمّان هناك',
}

export const useFT = makeDictHook(he, ar)
