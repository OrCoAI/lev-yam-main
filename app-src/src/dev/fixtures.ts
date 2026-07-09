// Realistic in-memory data for the dev preview (`?preview`). Dates are
// generated relative to "today" so day-chips, the calendar and auto-expire
// visuals always look alive. Never imported by production code.
import type { ContractRow, QuoteRow } from '../modules/quotes/types'
import {
  DEFAULT_CLAUSES,
  DEFAULT_CONTRACT_DATA,
  DEFAULT_DETAILS_FIELDS,
} from '../modules/quotes/contract-defaults'

const iso = (daysFromToday: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ddmm = (daysFromToday: number): string => iso(daysFromToday).split('-').reverse().join('/')

let n = 0
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

const q = (over: Partial<QuoteRow>): QuoteRow => ({
  id: uid(),
  quote_number: 'LY-260601-001',
  customer_name: '',
  contact_person: '',
  phone: '050-1234567',
  email: '',
  event_type: '',
  event_date: null,
  guests: '',
  hours: '10:00–16:00',
  issue_date: iso(-3),
  status: 'draft',
  sent_date: null,
  paid_date: null,
  archived: false,
  event_confirmed: false,
  notes: '',
  subtotal: null,
  discount_pct: null,
  final_price: null,
  vat_rate: 0.18,
  deposit_pct: 30,
  content: {},
  prep_checklist: [],
  ...over,
})

export const quotesFixture: QuoteRow[] = [
  q({
    quote_number: 'LY-260706-019',
    customer_name: 'משפחת אבו חמיד',
    contact_person: 'מוחמד',
    event_type: 'יום הולדת',
    event_date: iso(15),
    guests: '25',
    issue_date: iso(-3),
    status: 'draft',
  }),
  q({
    quote_number: 'LY-260708-020',
    customer_name: 'אלביט מערכות',
    contact_person: 'נועה ברק',
    email: 'noa@elbit.example',
    event_type: 'גיבוש צוות',
    guests: '18',
    issue_date: iso(-1),
    status: 'draft',
    notes: 'מחכים לתאריך סופי מהם',
  }),
  q({
    quote_number: 'LY-260705-018',
    customer_name: 'קרן רש"י',
    contact_person: 'יעל',
    event_type: 'סדנת דיג וקהילה',
    event_date: iso(9),
    guests: '15',
    issue_date: iso(-4),
    status: 'sent',
    sent_date: iso(-4),
    subtotal: 7200,
    final_price: 8496,
  }),
  q({
    quote_number: 'LY-260701-017',
    customer_name: 'בית ספר אורט חדרה',
    contact_person: 'רונית לוי',
    phone: '052-9876543',
    event_type: 'סיור חינוכי',
    event_date: iso(55),
    guests: '30',
    hours: '09:00–13:00',
    issue_date: iso(-8),
    status: 'sent',
    sent_date: iso(-7),
    subtotal: 4200,
    final_price: 4956,
  }),
  q({
    quote_number: 'LY-260628-016',
    customer_name: 'אינטל ישראל',
    contact_person: 'דנה פרידמן',
    email: 'dana@intel.example',
    event_type: 'יום כיף צוות',
    event_date: iso(6),
    guests: '28',
    issue_date: iso(-11),
    status: 'approved',
    subtotal: 12500,
    final_price: 14750,
    notes: 'סגרו תפריט דגים — לוודא ספק',
    content: {
      items: [
        { id: 'a1', desc: 'אירוח במתחם לב ים — יום שלם', qty: '1', price: '6500' },
        { id: 'a2', desc: 'ארוחת דגים מלאה', qty: '28', price: '180' },
        { id: 'a3', desc: 'סדנת רשתות עם דייג מקומי', qty: '1', price: '960' },
      ],
    },
  }),
  q({
    quote_number: 'LY-260622-015',
    customer_name: 'משפחת כהן',
    contact_person: 'אבי כהן',
    event_type: 'בר מצווה',
    event_date: iso(2),
    guests: '30',
    hours: '16:00–22:00',
    issue_date: iso(-17),
    status: 'approved',
    event_confirmed: true,
    subtotal: 8400,
    final_price: 9912,
    prep_checklist: [
      { text: 'אישור סופי של מספר אורחים', done: true },
      { text: 'הזמנת דגים מהמזח', done: true },
      { text: 'סידור שולחנות ותאורה', done: true },
      { text: 'תיאום חניה עם הכפר', done: true },
      { text: 'הכנת פינת קפה', done: false },
      { text: 'בדיקת מערכת הגברה', done: false },
    ],
  }),
  q({
    quote_number: 'LY-260615-014',
    customer_name: 'עיריית חדרה',
    contact_person: 'משה אדרי',
    event_type: 'כנס קיץ',
    event_date: iso(20),
    guests: '60',
    issue_date: iso(-24),
    status: 'declined',
    subtotal: 22000,
    final_price: 25960,
    notes: 'גדול מדי למתחם — הפניתי לחוף הצפוני',
  }),
  q({
    quote_number: 'LY-260610-013',
    customer_name: 'גלית אזולאי',
    event_type: 'מסיבת רווקות',
    event_date: iso(-2),
    guests: '12',
    issue_date: iso(-29),
    status: 'expired',
    sent_date: iso(-29),
    subtotal: 5100,
    final_price: 6018,
  }),
  q({
    quote_number: 'LY-260601-012',
    customer_name: 'וויקס בע"מ',
    contact_person: 'תום',
    event_type: 'סדנת גיבוש',
    event_date: iso(-19),
    guests: '22',
    issue_date: iso(-38),
    status: 'paid',
    paid_date: iso(-17),
    subtotal: 10500,
    final_price: 12390,
  }),
  q({
    quote_number: 'LY-260520-011',
    customer_name: 'משפחת מרציאנו',
    contact_person: 'שירה',
    event_type: 'אירוסין',
    event_date: iso(-40),
    guests: '30',
    issue_date: iso(-50),
    status: 'paid',
    paid_date: iso(-38),
    archived: true,
    subtotal: 7800,
    final_price: 9204,
  }),
]

const contract = (quote: QuoteRow, over: Partial<ContractRow>): ContractRow => ({
  id: uid(),
  quote_id: quote.id,
  contract_number: 'C-' + quote.quote_number,
  status: 'draft',
  generated_date: quote.issue_date,
  sent_date: null,
  signed_date: null,
  signed_name: null,
  content: {
    data: {
      ...DEFAULT_CONTRACT_DATA,
      signDate: ddmm(-2),
      customerName: quote.customer_name,
      phone: quote.phone,
      email: quote.email,
      eventDate: quote.event_date ? quote.event_date.split('-').reverse().join('/') : '',
      hours: quote.hours,
      eventType: quote.event_type,
      guests: quote.guests,
      price: quote.final_price ? `${quote.final_price.toLocaleString('en-US')} ₪ (כולל מע״מ)` : '',
    },
    clauses: DEFAULT_CLAUSES,
    fields: DEFAULT_DETAILS_FIELDS,
    ownerSignature: '',
  },
  ...over,
})

const intel = quotesFixture[4]
const cohen = quotesFixture[5]
const wix = quotesFixture[8]

export const contractsFixture: ContractRow[] = [
  contract(intel, {}),
  contract(cohen, { status: 'signed', signed_date: iso(-10), signed_name: 'אבי כהן' }),
  contract(wix, { status: 'signed', signed_date: iso(-30), signed_name: 'תום שגב' }),
]

export const settingsFixture = {
  id: true,
  default_prep_checklist: [
    'אישור סופי של מספר אורחים',
    'הזמנת דגים מהמזח',
    'סידור שולחנות ותאורה',
    'תיאום חניה עם הכפר',
  ],
  quote_defaults: {},
  contract_template: {},
}

export const ownerSecretsFixture = {
  id: true,
  owner_signature: '',
}

export const permissionsFixture = [
  'quotes.view',
  'quotes.manage',
  'quotes.contracts',
  'quotes.settings',
  'users.view',
  'finance.view',
]
