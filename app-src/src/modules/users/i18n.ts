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
  tabByRole: 'לפי תפקיד',
  loadingUsers: 'טוען משתמשים…',
  loadingPermissions: 'טוען הרשאות…',
  errorPrefix: 'שגיאה:',
  noUsers: 'אין משתמשים עדיין. הזמינו משתמש כדי להתחיל.',
  permAllowed: 'מותר',
  permBlocked: 'חסום',

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
  statusActive: 'פעיל/ה',

  userDelete: 'מחיקה',
  userDeactivate: 'השבתה',
  userReactivate: 'הפעלה מחדש',
  userDeactivated: 'מושבת/ת',
  userDeleteConfirm: 'למחוק את המשתמש לצמיתות? מחיקה אפשרית רק למשתמש ללא היסטוריית פעילות.',
  userDeactivateConfirm: 'להשבית את המשתמש? הכניסה שלו/ה תיחסם עד הפעלה מחדש.',
  opErrorSelf: 'לא ניתן לבצע פעולה זו על החשבון של עצמך.',
  opErrorLastAdmin: 'לא ניתן — זהו המשתמש הפעיל האחרון עם הרשאת ניהול משתמשים.',
  opErrorHasRecords: 'לא ניתן למחוק — למשתמש יש היסטוריית פעילות במערכת. השביתו אותו במקום.',
  opErrorGeneric: 'הפעולה נכשלה. נסו שוב.',

  save: 'שמירה',
  saving: 'שומר…',
  discard: 'ביטול שינויים',
  pendingChanges: 'שינויים שממתינים לשמירה:',

  addRole: '+ תפקיד חדש',
  rolesLocked: 'שמרו או בטלו את השינויים בטבלה לפני עריכת תפקידים.',
  roleKeyHint: 'אותיות קטנות באנגלית, ספרות וקו תחתון',
  roleKeyLabel: 'מזהה (אותיות באנגלית)',
  roleLabelHe: 'שם בעברית',
  roleLabelAr: 'שם בערבית',
  roleCreate: 'יצירת תפקיד',
  roleCreating: 'יוצר…',
  roleDelete: 'מחיקת תפקיד',
  roleDeleteConfirm: 'למחוק את התפקיד? ההרשאות שלו יימחקו.',
  roleInUse: 'לא ניתן למחוק תפקיד המשויך למשתמשים. הסירו אותו מהמשתמשים תחילה.',
  roleRename: 'שינוי שם',
  roleSave: 'שמירה',
  roleSaving: 'שומר…',

  // per-user accordion + by-role sections
  secRoles: 'תפקידים',
  secAccess: 'גישה למודולים',
  secActions: 'פעולות',
  secMembers: 'משתמשים',
  secPerms: 'הרשאות',

  // by-role: members list
  usersWithRole: 'משתמשים עם תפקיד זה',
  searchUser: 'חיפוש לפי אימייל…',
  noMembers: 'אין משתמשים עם תפקיד זה.',
  noMatch: 'לא נמצאו משתמשים.',

  // admin password set/reset (owner-only)
  setPassword: 'סיסמה',
  pwSendResetOption: 'שליחת קישור איפוס',
  pwNewLabel: 'סיסמה חדשה (לפחות 8 תווים)',
  pwApply: 'החלת סיסמה',
  pwApplying: 'מחיל…',
  pwSetOk: 'הסיסמה עודכנה.',
  pwSending: 'שולח…',
  pwResetSent: 'נשלח קישור איפוס לכתובת האימייל של המשתמש.',
  pwErrorWeak: 'הסיסמה קצרה מדי — לפחות 8 תווים.',
  pwErrorNoEmail: 'למשתמש אין כתובת אימייל לשליחת איפוס.',
  pwErrorGeneric: 'הפעולה נכשלה. נסו שוב.',

  viewAs: 'תצוגה כמשתמש זה',
  noPerms: 'אין הרשאות למשתמש זה.',
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
  tabByRole: 'حسب الدور',
  loadingUsers: 'جارٍ تحميل المستخدمين…',
  loadingPermissions: 'جارٍ تحميل الصلاحيات…',
  errorPrefix: 'خطأ:',
  noUsers: 'لا يوجد مستخدمون بعد. ادعوا مستخدماً للبدء.',
  permAllowed: 'مسموح',
  permBlocked: 'محجوب',

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
  statusActive: 'نشِط/ة',

  userDelete: 'حذف',
  userDeactivate: 'تعطيل',
  userReactivate: 'إعادة تفعيل',
  userDeactivated: 'معطّل/ة',
  userDeleteConfirm: 'حذف المستخدم نهائياً؟ الحذف ممكن فقط لمستخدم بلا سجلّ نشاط.',
  userDeactivateConfirm: 'تعطيل المستخدم؟ رح ينحظر دخوله لحد ما ينرجع يتفعّل.',
  opErrorSelf: 'ما بصير تنفّذ هالإجراء على حسابك.',
  opErrorLastAdmin: 'ما بصير — هاد آخر مستخدم فعّال عندو صلاحية إدارة المستخدمين.',
  opErrorHasRecords: 'ما بينحذف — عند المستخدم سجلّ نشاط بالنظام. عطّلوه بدال الحذف.',
  opErrorGeneric: 'فشل الإجراء. حاولوا مجدداً.',

  save: 'حفظ',
  saving: 'جارٍ الحفظ…',
  discard: 'إلغاء التغييرات',
  pendingChanges: 'تغييرات بانتظار الحفظ:',

  addRole: '+ دور جديد',
  rolesLocked: 'احفظوا التغييرات في الجدول أو ألغوها قبل تعديل الأدوار.',
  roleKeyHint: 'أحرف إنجليزية صغيرة وأرقام وشرطة سفلية',
  roleKeyLabel: 'المعرّف (أحرف إنجليزية)',
  roleLabelHe: 'الاسم بالعبرية',
  roleLabelAr: 'الاسم بالعربية',
  roleCreate: 'إنشاء دور',
  roleCreating: 'جارٍ الإنشاء…',
  roleDelete: 'حذف الدور',
  roleDeleteConfirm: 'حذف الدور؟ ستُحذف صلاحياته.',
  roleInUse: 'لا يمكن حذف دور مُسنَد لمستخدمين. أزيلوه عن المستخدمين أولاً.',
  roleRename: 'تعديل الاسم',
  roleSave: 'حفظ',
  roleSaving: 'جارٍ الحفظ…',

  // per-user accordion + by-role sections
  secRoles: 'الأدوار',
  secAccess: 'الوصول للوحدات',
  secActions: 'الإجراءات',
  secMembers: 'المستخدمون',
  secPerms: 'الصلاحيات',

  // by-role: members list
  usersWithRole: 'المستخدمون بهذا الدور',
  searchUser: 'بحث بالبريد الإلكتروني…',
  noMembers: 'لا مستخدمين بهذا الدور.',
  noMatch: 'لا نتائج.',

  // admin password set/reset (owner-only)
  setPassword: 'كلمة السر',
  pwSendResetOption: 'إرسال رابط إعادة تعيين',
  pwNewLabel: 'كلمة سر جديدة (٨ أحرف على الأقل)',
  pwApply: 'تطبيق كلمة السر',
  pwApplying: 'جارٍ التطبيق…',
  pwSetOk: 'تم تحديث كلمة السر.',
  pwSending: 'جارٍ الإرسال…',
  pwResetSent: 'تم إرسال رابط إعادة التعيين إلى بريد المستخدم.',
  pwErrorWeak: 'كلمة السر قصيرة جداً — ٨ أحرف على الأقل.',
  pwErrorNoEmail: 'المستخدم بلا بريد إلكتروني لإرسال إعادة التعيين.',
  pwErrorGeneric: 'فشل الإجراء. حاولوا مجدداً.',

  viewAs: 'عرض كهذا المستخدم',
  noPerms: 'لا توجد صلاحيات لهذا المستخدم.',
}

export const useUT = makeDictHook(he, ar)
