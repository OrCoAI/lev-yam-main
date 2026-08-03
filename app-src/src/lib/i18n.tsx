import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Platform i18n — Hebrew + Levantine Arabic (both RTL, so `dir` never changes;
 * only `lang` does). Hebrew is the source language; Arabic follows the marketing
 * site's register, and the brand stays "ليف يام" (transliterated, never translated).
 *
 * Scope: shell/UI strings. Module *labels* come from `core.modules` rows and are
 * not translated here — bilingual DB labels are a tracked follow-up.
 */

export type Lang = 'he' | 'ar'

const STORAGE_KEY = 'lev-yam-lang'

const dict = {
  'lang.other': { he: 'العربية', ar: 'עברית' }, // label of the *other* language (the switch target)
  'login.title': { he: 'מערכת הצוות', ar: 'نظام الطاقم' },
  'login.sub': { he: 'ברוכים הבאים · לב ים', ar: 'أهلاً وسهلاً · ليف يام' },
  'login.envNotice1': { he: 'החיבור ל-Supabase לא הוגדר. צרו', ar: 'اتصال Supabase غير مُعدّ. أنشئوا' },
  'login.envNotice2': { he: 'מתוך', ar: 'من' },
  'login.email': { he: 'אימייל', ar: 'البريد الإلكتروني' },
  'login.password': { he: 'סיסמה', ar: 'كلمة المرور' },
  'login.signIn': { he: 'כניסה', ar: 'دخول' },
  'login.signingIn': { he: 'מתחבר…', ar: 'جارٍ الدخول…' },
  'login.passkey': { he: 'כניסה עם Face ID', ar: 'الدخول بـ Face ID' },
  'login.verifying': { he: 'מאמת…', ar: 'جارٍ التحقق…' },
  'login.passkeyHint': { he: 'כניסה מהירה עם Face ID / Touch ID', ar: 'دخول سريع بـ Face ID / Touch ID' },
  'login.forgotPassword': { he: 'שכחת סיסמה?', ar: 'نسيت كلمة المرور؟' },
  'login.forgotSub': { he: 'הזינו את כתובת המייל ונשלח קישור לאיפוס סיסמה.', ar: 'أدخلوا البريد الإلكتروني وسنرسل رابطاً لإعادة تعيين كلمة المرور.' },
  'login.sendReset': { he: 'שליחת קישור לאיפוס', ar: 'إرسال رابط إعادة التعيين' },
  'login.sending': { he: 'שולח…', ar: 'جارٍ الإرسال…' },
  'login.resetSent': { he: 'אם הכתובת קיימת במערכת, נשלח אליה קישור לאיפוס סיסמה.', ar: 'إذا كان العنوان موجوداً في النظام، أُرسل إليه رابط إعادة تعيين كلمة المرور.' },
  'login.backToSignIn': { he: 'חזרה להתחברות', ar: 'العودة لتسجيل الدخول' },
  'resetPassword.title': { he: 'קביעת סיסמה חדשה', ar: 'تعيين كلمة مرور جديدة' },
  'resetPassword.newPassword': { he: 'סיסמה חדשה', ar: 'كلمة مرور جديدة' },
  'resetPassword.confirmPassword': { he: 'אימות סיסמה', ar: 'تأكيد كلمة المرور' },
  'resetPassword.submit': { he: 'שמירת סיסמה', ar: 'حفظ كلمة المرور' },
  'resetPassword.saving': { he: 'שומר…', ar: 'جارٍ الحفظ…' },
  'resetPassword.mismatch': { he: 'הסיסמאות אינן תואמות.', ar: 'كلمتا المرور غير متطابقتين.' },
  'resetPassword.tooShort': { he: 'הסיסמה קצרה מדי (לפחות 6 תווים).', ar: 'كلمة المرور قصيرة جداً (6 أحرف على الأقل).' },
  'resetPassword.invalidLink': { he: 'הקישור אינו תקין או שפג תוקפו. יש לבקש קישור חדש.', ar: 'الرابط غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.' },
  'resetPassword.success': { he: 'הסיסמה נשמרה. מעבירים אתכם למערכת…', ar: 'تم حفظ كلمة المرور. جارٍ تحويلكم إلى النظام…' },
  'layout.system': { he: 'מערכת', ar: 'نظام' },
  'layout.signOut': { he: 'יציאה', ar: 'خروج' },
  'preview.viewingAs': { he: 'תצוגה כמשתמש:', ar: 'عرض كمستخدم:' },
  'preview.exit': { he: 'חזרה לתצוגה שלי', ar: 'العودة لعرضي' },
  // role display names now live in core.roles.label_he/label_ar (the single
  // source, editable per role) — see useRoleName; no compile-time dict entries.
  'errorBoundary.title': { he: 'משהו השתבש', ar: 'حدث خطأ ما' },
  'errorBoundary.body': { he: 'המודול נתקל בשגיאה. אפשר לרענן את הדף או לחזור למסך הראשי.', ar: 'واجهت الوحدة خطأ. يمكن تحديث الصفحة أو العودة إلى الشاشة الرئيسية.' },
  'errorBoundary.reload': { he: 'רענון', ar: 'تحديث' },
  'errorBoundary.home': { he: 'למסך הראשי', ar: 'إلى الشاشة الرئيسية' },
  'launcher.loading': { he: 'טוען מודולים…', ar: 'جارٍ تحميل الوحدات…' },
  'launcher.error': { he: 'שגיאה בטעינת המודולים:', ar: 'خطأ في تحميل الوحدات:' },
  'launcher.empty': { he: 'אין מודולים זמינים להרשאות שלך עדיין.', ar: 'لا توجد وحدات متاحة لصلاحياتك بعد.' },
  'launcher.greeting': { he: 'מה נעשה היום?', ar: 'شو منعمل اليوم؟' },
  'launcher.sub': { he: 'בחרו מודול כדי להתחיל', ar: 'اختاروا وحدة للبدء' },
  'launcher.open': { he: 'פתח ←', ar: 'افتح ←' },
  'launcher.soon': { he: 'בקרוב', ar: 'قريبًا' },
  'launcher.driftTitle': { he: 'הספרים לא מעודכנים — לחצו לפרטים', ar: 'الدفاتر غير محدّثة — اضغطوا للتفاصيل' },
  // one-line tile descriptions — every launcher button says what's inside it
  'launcher.desc.users': { he: 'משתמשים, תפקידים והרשאות', ar: 'مستخدمون، أدوار وصلاحيات' },
  'launcher.desc.finance': { he: 'תנועות, צפי ודוח כספי', ar: 'حركات، متوقّع وتقرير مالي' },
  'launcher.desc.pos': { he: 'שולחנות, מטבח ודוח יום', ar: 'طاولات، مطبخ وتقرير اليوم' },
  'launcher.desc.quotes': { he: 'הצעות מחיר, חוזים והכנות', ar: 'عروض أسعار، عقود وتحضيرات' },
  'passkey.enabled': { he: '✓ Face ID מופעל', ar: '✓ Face ID مفعّل' },
  'passkey.enabling': { he: 'מפעיל…', ar: 'جارٍ التفعيل…' },
  'passkey.retry': { he: 'נסה שוב — Face ID', ar: 'حاول مجددًا — Face ID' },
  'passkey.enable': { he: 'הפעלת Face ID', ar: 'تفعيل Face ID' },
  'passkey.hint': { he: 'הוספת כניסה מהירה עם Face ID במכשיר זה', ar: 'إضافة دخول سريع بـ Face ID على هذا الجهاز' },
  'passkey.thisDevice': { he: 'מכשיר זה', ar: 'هذا الجهاز' },
  'shell.noPermission': { he: 'אין לך הרשאה לצפות במודול זה.', ar: 'ليس لديك صلاحية لعرض هذه الوحدة.' },
} as const satisfies Record<string, Record<Lang, string>>

export type TKey = keyof typeof dict

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TKey) => string
}

const I18nContext = createContext<I18nState | undefined>(undefined)

function initialLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'he'
  } catch {
    return 'he'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    // Both languages are RTL — only the lang attribute changes.
    document.documentElement.lang = lang
  }, [lang])

  function setLang(next: Lang) {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode etc. — the choice just won't persist */
    }
  }

  const t = (key: TKey) => dict[key][lang]

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/** Factory for module-local dictionaries (module chrome only): pass two
 *  parallel typed objects and get a hook returning the active one. This is
 *  THE module i18n pattern — see modules/finance/i18n.ts for the shape. */
export function makeDictHook<T>(he: T, ar: T): () => T {
  return function useDict(): T {
    const { lang } = useI18n()
    return lang === 'ar' ? ar : he
  }
}

/** A row that carries its own bilingual label plus a slug to fall back on —
 *  the shape used by every keyed taxonomy in the DB (`core.roles`,
 *  `finance.categories`). */
export interface DbLabelled {
  key: string
  label_he?: string | null
  label_ar?: string | null
}

/** The one place the bilingual-DB-label fallback rule is written: prefer the
 *  active language's label, then the slug. Owner renames show immediately in
 *  both languages. Kept as a plain function so callers that already have `lang`
 *  (or are outside React) can use it too. */
export function pickDbLabel(lang: Lang, row: DbLabelled): string {
  return (lang === 'he' ? row.label_he : row.label_ar) || row.key
}

/** Display name for a role, anywhere a role is shown (header badge, users-tab
 *  chips, matrix headers, per-user lens…). The role's own bilingual DB label is
 *  the single source of truth for every role — built-in and custom alike.
 *  Stable per language, so it's safe in dependency arrays. */
// eslint-disable-next-line react-refresh/only-export-components
export function useRoleName(): (role: DbLabelled) => string {
  const { lang } = useI18n()
  return useMemo(() => (role) => pickDbLabel(lang, role), [lang])
}

/** The one-tap language switch, shown in the topbar and on the login card. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  return (
    <button
      type="button"
      className={`btn-ghost lang-toggle ${className}`.trim()}
      onClick={() => setLang(lang === 'he' ? 'ar' : 'he')}
      aria-label={t('lang.other')}
    >
      {t('lang.other')}
    </button>
  )
}
