import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

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
  'layout.system': { he: 'מערכת', ar: 'نظام' },
  'layout.signOut': { he: 'יציאה', ar: 'خروج' },
  'launcher.loading': { he: 'טוען מודולים…', ar: 'جارٍ تحميل الوحدات…' },
  'launcher.error': { he: 'שגיאה בטעינת המודולים:', ar: 'خطأ في تحميل الوحدات:' },
  'launcher.empty': { he: 'אין מודולים זמינים להרשאות שלך עדיין.', ar: 'لا توجد وحدات متاحة لصلاحياتك بعد.' },
  'launcher.greeting': { he: 'מה נעשה היום?', ar: 'شو منعمل اليوم؟' },
  'launcher.sub': { he: 'בחרו מודול כדי להתחיל', ar: 'اختاروا وحدة للبدء' },
  'launcher.open': { he: 'פתח ←', ar: 'افتح ←' },
  'launcher.soon': { he: 'בקרוב', ar: 'قريبًا' },
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
