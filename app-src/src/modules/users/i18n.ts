// Users module dictionary — started with the mobile-UX pass (2026-07); the
// full-chrome retrofit (ROADMAP Phase 1.5, H7) landed with the users-hardening
// initiative (docs/plans/users-hardening.md, 2026-07).
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

  title: 'ניהול משתמשים והרשאות',
  viewOnly: 'תצוגה בלבד — אין לך הרשאת ניהול',
  tabUsers: 'משתמשים',
  tabMatrix: 'תפקידים והרשאות',
  loadingUsers: 'טוען משתמשים…',
  loadingPermissions: 'טוען הרשאות…',
  errorPrefix: 'שגיאה:',
  noUsers: 'אין משתמשים עדיין. הזמינו משתמש כדי להתחיל.',
  permHeader: 'הרשאה',

  inviteUser: '+ הזמנת משתמש',
  inviteEmail: 'אימייל',
  inviteRole: 'תפקיד',
  selectRole: 'בחר/י תפקיד',
  inviteSubmit: 'שליחת הזמנה',
  inviting: 'שולח הזמנה…',
  inviteCancel: 'ביטול',
  inviteErrorForbidden: 'אין לך הרשאה לבצע פעולה זו.',
  inviteErrorGeneric: 'שליחת ההזמנה נכשלה. נסו שוב.',

  lastLogin: 'כניסה אחרונה:',
  neverLoggedIn: 'טרם נכנס/ה',

  viewByRole: 'לפי תפקיד',
  viewByUser: 'לפי משתמש',
  save: 'שמירה',
  saving: 'שומר…',
  discard: 'ביטול שינויים',
  pendingChanges: 'שינויים שממתינים לשמירה:',

  addRole: '+ תפקיד חדש',
  retry: 'ניסיון חוזר',
  rolesLocked: 'שמרו או בטלו את השינויים בטבלה לפני עריכת תפקידים.',
  roleKeyHint: 'אותיות קטנות באנגלית, ספרות וקו תחתון',
  roleKeyLabel: 'מזהה (אותיות באנגלית)',
  roleLabelLabel: 'שם תצוגה',
  roleCreate: 'יצירת תפקיד',
  roleCreating: 'יוצר…',
  roleDelete: 'מחיקת תפקיד',
  roleDeleteConfirm: 'למחוק את התפקיד? כל ההרשאות והשיוכים שלו יימחקו.',

  selectUser: 'בחר/י משתמש',
  viewAs: 'תצוגה כמשתמש זה',
  effectiveNote: 'הרשאות בפועל — נגזרות מהתפקידים. עריכה נעשית על התפקיד, בתצוגת "לפי תפקיד".',
  noPerms: 'אין הרשאות למשתמש זה.',
  viaRole: 'דרך תפקיד',
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

  title: 'إدارة المستخدمين والصلاحيات',
  viewOnly: 'عرض فقط — لا تملك صلاحية إدارة',
  tabUsers: 'المستخدمون',
  tabMatrix: 'الأدوار والصلاحيات',
  loadingUsers: 'جارٍ تحميل المستخدمين…',
  loadingPermissions: 'جارٍ تحميل الصلاحيات…',
  errorPrefix: 'خطأ:',
  noUsers: 'لا يوجد مستخدمون بعد. ادعوا مستخدماً للبدء.',
  permHeader: 'صلاحية',

  inviteUser: '+ دعوة مستخدم',
  inviteEmail: 'البريد الإلكتروني',
  inviteRole: 'الدور',
  selectRole: 'اختر/ي دوراً',
  inviteSubmit: 'إرسال الدعوة',
  inviting: 'جارٍ إرسال الدعوة…',
  inviteCancel: 'إلغاء',
  inviteErrorForbidden: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  inviteErrorGeneric: 'فشل إرسال الدعوة. حاولوا مجدداً.',

  lastLogin: 'آخر دخول:',
  neverLoggedIn: 'لم يدخل بعد',

  viewByRole: 'حسب الدور',
  viewByUser: 'حسب المستخدم',
  save: 'حفظ',
  saving: 'جارٍ الحفظ…',
  discard: 'إلغاء التغييرات',
  pendingChanges: 'تغييرات بانتظار الحفظ:',

  addRole: '+ دور جديد',
  retry: 'إعادة المحاولة',
  rolesLocked: 'احفظوا التغييرات في الجدول أو ألغوها قبل تعديل الأدوار.',
  roleKeyHint: 'أحرف إنجليزية صغيرة وأرقام وشرطة سفلية',
  roleKeyLabel: 'المعرّف (أحرف إنجليزية)',
  roleLabelLabel: 'اسم العرض',
  roleCreate: 'إنشاء دور',
  roleCreating: 'جارٍ الإنشاء…',
  roleDelete: 'حذف الدور',
  roleDeleteConfirm: 'حذف الدور؟ ستُحذف كل صلاحياته وارتباطاته.',

  selectUser: 'اختر/ي مستخدماً',
  viewAs: 'عرض كهذا المستخدم',
  effectiveNote: 'الصلاحيات الفعلية — مشتقة من الأدوار. التعديل يتم على الدور، في عرض "حسب الدور".',
  noPerms: 'لا توجد صلاحيات لهذا المستخدم.',
  viaRole: 'عبر دور',
}

export const useUT = makeDictHook(he, ar)
