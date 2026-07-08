// Default document body for a new quote — ported verbatim from the master
// template's DEFAULT_DATA (~/lev-yam-quotes/Lev Yam Price Quote.html), minus
// the client fields (those live as columns on quotes.quotes).
// Document content is Hebrew: these are customer-facing business documents.
import type { QuoteContent } from './types'

export const DEFAULT_CONTENT: QuoteContent = {
  greeting: 'מצורפת הצעת מחיר מפורטת — נשמח לתאם ולענות על כל שאלה.',
  items: [
    { id: 'i1', desc: 'השכרת המתחם - יום שלם', qty: '1', price: '4500' },
    { id: 'i2', desc: 'כיבוד וארוחת צהריים (לאדם)', qty: '25', price: '140' },
    { id: 'i3', desc: 'הנחיית יום גיבוש ופעילות', qty: '1', price: '2200' },
    { id: 'i4', desc: 'ציוד הגברה, מקרן ומסך', qty: '1', price: '850' },
  ],
  included: [
    'שימוש חופשי במתחם לב ים במלואו',
    'גישה ישירה לחוף ולפינות ישיבה',
    'Wi-Fi Starlink בכל המתחם',
    'חניה לכלל המשתתפים בכניסה לכפר הדייגים',
    'פינת קפה, תה ומים כל היום',
    'סידור וניקיון לפני ואחרי האירוע',
  ],
  agenda: [
    { time: '09:00', activity: 'התכנסות וקפה בוקר' },
    { time: '09:30', activity: 'פתיחה והיכרות' },
    { time: '10:00', activity: 'פעילות גיבוש ראשונה' },
    { time: '11:30', activity: 'הפסקה ושחייה חופשית' },
    { time: '12:00', activity: 'ארוחת צהריים' },
    { time: '13:30', activity: 'פעילות גיבוש שנייה' },
  ],
  vatRate: 0.18,
  discountPct: '10',
  depositPct: '30',
  cancellation:
    'ביטול עד 14 יום לפני האירוע — החזר מלא של המקדמה. ביטול בין 7 ל-14 יום — חיוב 50% מהמקדמה. ביטול בפחות מ-7 ימים — חיוב מלא. שינוי מועד ללא עלות עד 10 ימים מראש, בכפוף לזמינות.',
  terms:
    'המחירים נקובים בשקלים ואינם כוללים מע"מ אלא אם צוין אחרת. ההצעה תקפה לשבוע מתאריך ההפקה וכפופה לזמינות. אישור ההזמנה מותנה בתשלום מקדמה; יתרת התשלום תיגבה ביום האירוע. לא קיימת אפשרות לינה במתחם.',
  tweaks: { showVat: true, showDiscount: false, leftSection: 'included', showTerms: true },
}
