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
    // fixed id: finance fixtures point their provenance refs here (quote links)
    id: '00000000-0000-4000-8000-00000000c002',
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
    // fixed id: finance fixtures point their provenance refs here (quote links)
    id: '00000000-0000-4000-8000-00000000c001',
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
  'users.manage',
  'finance.view',
  'finance.manage',
  'pos.view',
  'pos.order',
  'pos.kitchen',
  'pos.analytics',
  'pos.costs_food',
  'pos.costs_labor',
  'pos.reports',
  'pos.manage',
]

// ── POS fixtures: two open tables (kitchen states) + today's paid bills + costs ──
const nowIso = new Date().toISOString()
const hourAgo = new Date(Date.now() - 3600_000).toISOString()

export const posTablesFixture = [
  {
    id: 't-preview-1', num: 1, name: 'משפחת מרינה', guests_adults: 2, guests_children: 3,
    pricing_mode: 'open_house', opened_at: hourAgo, updated_at: nowIso,
    items: [
      { id: '0-1', name: 'לבנה', nameAr: 'لبنة', price: 20, oh: true, cat: 'פתיחים וסלטים', qty: 2, sent: 2, done: 1, served: 0, firedAt: hourAgo },
      { id: '4-0', name: 'מנת דג', nameAr: 'صحن سمك', price: 80, oh: false, cat: 'תוספות', qty: 1, sent: 1, done: 0, served: 0, firedAt: hourAgo },
    ],
  },
  {
    id: 't-preview-2', num: 2, name: '', guests_adults: 2, guests_children: 0,
    pricing_mode: 'a_la_carte', opened_at: nowIso, updated_at: nowIso,
    items: [
      { id: '2-1', name: 'קפה עם חלב', nameAr: 'قهوة بحليب', price: 8, oh: true, cat: 'שתייה חמה', qty: 2, sent: 0, done: 0, served: 0 },
    ],
  },
]

export const posBillsFixture = [
  {
    id: 'b-preview-1', table_num: 3, name: '', status: 'paid', closed_by: null,
    guests_adults: 4, guests_children: 0, pricing_mode: 'open_house',
    opened_at: hourAgo, paid_at: nowIso, items_count: 3,
    oh_charge: 300, extras_total: 80, menu_value: 140, discount: 0, tip: 20,
    grand_total: 380, cash_paid: 400, card_paid: 0, items: [], archived_at: null,
  },
  {
    id: 'b-preview-2', table_num: 4, name: 'זוג ליד הים', status: 'paid', closed_by: null,
    guests_adults: 2, guests_children: 0, pricing_mode: 'a_la_carte',
    opened_at: hourAgo, paid_at: nowIso, items_count: 2,
    oh_charge: 0, extras_total: 130, menu_value: 130, discount: 10, tip: 0,
    grand_total: 120, cash_paid: 0, card_paid: 120, items: [], archived_at: null,
  },
]

export const posExpensesFixture = [
  { id: 9001, business_date: nowIso.slice(0, 10), kind: 'food', amount: 250, note: 'דגים — שוק', created_by: 'preview@levyam.com', created_at: nowIso },
  { id: 9002, business_date: nowIso.slice(0, 10), kind: 'labor', amount: 400, note: 'משמרת בוקר', created_by: 'preview@levyam.com', created_at: nowIso },
]

// finance.entries — a manual row, a quote-posted row, and a POS reversal pair.
// Relative dates keep the report's "this month / 7 days" presets alive;
// provenance refs use the REAL schema formats ('expected:<uuid>' from
// finance.record_payment, 'pos:<date>:<leg>[:rN]' from pos.close_day) so the
// source links resolve in the preview.
// -3 days: always inside the report's default '7 days' preset (and 'this
// month' except the first days of a month) so the POS legs + reversal demo show
const posDay = iso(-3)
export const financeEntriesFixture = [
  {
    id: '00000000-0000-4000-8000-00000000f001',
    kind: 'expense', category: 'suppliers', amount: 1250, payment_method: 'bank',
    entry_date: iso(-6), note: 'דגים — שוק הדייגים', source_module: null, source_ref: null,
    event_id: null, created_by: '00000000-0000-4000-8000-00000000dead',
    created_at: `${iso(-6)}T09:00:00Z`, updated_at: `${iso(-6)}T09:00:00Z`,
  },
  {
    id: '00000000-0000-4000-8000-00000000f002',
    kind: 'income', category: 'events', amount: 2520, payment_method: 'bank',
    entry_date: iso(-7), note: 'מקדמה', source_module: 'quotes',
    source_ref: 'expected:00000000-0000-4000-8000-00000000e001', event_id: null,
    created_by: '00000000-0000-4000-8000-00000000dead',
    created_at: `${iso(-7)}T12:00:00Z`, updated_at: `${iso(-7)}T12:00:00Z`,
  },
  {
    id: '00000000-0000-4000-8000-00000000f003',
    kind: 'income', category: 'pos', amount: 3480, payment_method: 'cash',
    entry_date: posDay, note: 'סגירת יום', source_module: 'pos',
    source_ref: `pos:${posDay}:cash`, event_id: null,
    created_by: '00000000-0000-4000-8000-00000000dead',
    created_at: `${posDay}T22:00:00Z`, updated_at: `${posDay}T22:00:00Z`,
  },
  {
    id: '00000000-0000-4000-8000-00000000f004',
    kind: 'income', category: 'pos', amount: -180, payment_method: 'cash',
    entry_date: posDay, note: 'היפוך — חשבון בוטל', source_module: 'pos',
    source_ref: `pos:${posDay}:cash:r2`, event_id: null,
    created_by: '00000000-0000-4000-8000-00000000dead',
    created_at: `${posDay}T23:00:00Z`, updated_at: `${posDay}T23:00:00Z`,
  },
]

// finance.expected — open balance, overdue deposit, fulfilled deposit.
// Quote-planned rows carry '<quote_uuid>:deposit|:balance' (quotes.plan_money),
// pointing at the fixed-id quote fixtures above.
export const financeExpectedFixture = [
  {
    id: '00000000-0000-4000-8000-00000000e002',
    direction: 'in', category: 'events', amount: 5880, due_date: iso(33),
    reason: 'balance', event_id: null, source_module: 'quotes',
    source_ref: '00000000-0000-4000-8000-00000000c001:balance',
    status: 'open', fulfilled_by: null, note: 'יתרה — אירוע', created_by: null,
    created_at: `${iso(-7)}T12:00:00Z`, updated_at: `${iso(-7)}T12:00:00Z`,
  },
  {
    id: '00000000-0000-4000-8000-00000000e003',
    direction: 'in', category: 'events', amount: 1800, due_date: iso(-10),
    reason: 'deposit', event_id: null, source_module: 'quotes',
    source_ref: '00000000-0000-4000-8000-00000000c002:deposit',
    status: 'open', fulfilled_by: null, note: '', created_by: null,
    created_at: `${iso(-17)}T10:00:00Z`, updated_at: `${iso(-17)}T10:00:00Z`,
  },
  {
    id: '00000000-0000-4000-8000-00000000e001',
    direction: 'in', category: 'events', amount: 2520, due_date: iso(-7),
    reason: 'deposit', event_id: null, source_module: 'quotes',
    source_ref: '00000000-0000-4000-8000-00000000c001:deposit',
    status: 'fulfilled', fulfilled_by: '00000000-0000-4000-8000-00000000f002', note: '',
    created_by: null, created_at: `${iso(-11)}T09:00:00Z`, updated_at: `${iso(-7)}T12:00:00Z`,
  },
]

// ── users module: role catalog, user↔role links, and the permission matrix ──
export const rolesFixture = [
  { id: 'role-owner', key: 'owner', label: 'בעלים', sort: 10 },
  { id: 'role-manager', key: 'manager', label: 'מנהל', sort: 20 },
  { id: 'role-staff', key: 'staff', label: 'צוות', sort: 30 },
  { id: 'role-viewer', key: 'viewer', label: 'צפייה', sort: 40 },
]

export const adminUsersFixture = [
  { user_id: '00000000-0000-4000-8000-00000000aa01', email: 'or@levyam.com', created_at: '2026-01-01T08:00:00Z' },
  { user_id: '00000000-0000-4000-8000-00000000aa02', email: 'manager@levyam.com', created_at: '2026-02-10T08:00:00Z' },
  { user_id: '00000000-0000-4000-8000-00000000aa03', email: 'staff@levyam.com', created_at: '2026-03-15T08:00:00Z' },
]

export const userRolesFixture = [
  { user_id: '00000000-0000-4000-8000-00000000aa01', role_id: 'role-owner' },
  { user_id: '00000000-0000-4000-8000-00000000aa02', role_id: 'role-manager' },
  { user_id: '00000000-0000-4000-8000-00000000aa03', role_id: 'role-staff' },
]

// A representative subset of the real catalog, in the '<module>.<action>'
// format of lib/permissions.ts (PERM itself is not imported: fixtures must stay
// free of app-runtime imports — PERM pulls in auth → supabase, which would
// evaluate before mock-net seeds the fake session).
const permRow = (key: string, label: string) => {
  const [module, action] = key.split('.')
  return { id: `perm-${key}`, key, module, action, label }
}
const grant = (role: string, permKey: string) => ({ role_id: `role-${role}`, permission_id: `perm-${permKey}` })

// ordered by module then action — the UI groups on module transitions
export const permissionRowsFixture = [
  permRow('finance.manage', 'ניהול כספים'),
  permRow('finance.view', 'צפייה בכספים'),
  permRow('pos.order', 'הזמנות'),
  permRow('pos.view', 'צפייה בקופה'),
  permRow('quotes.manage', 'ניהול הצעות'),
  permRow('quotes.view', 'צפייה בהצעות'),
  permRow('users.manage', 'ניהול משתמשים'),
  permRow('users.view', 'צפייה במשתמשים'),
]

export const rolePermissionsFixture = [
  ...permissionRowsFixture.map((p) => ({ role_id: 'role-owner', permission_id: p.id })),
  grant('manager', 'finance.manage'),
  grant('manager', 'finance.view'),
  grant('manager', 'pos.view'),
  grant('manager', 'quotes.manage'),
  grant('manager', 'quotes.view'),
  grant('staff', 'pos.order'),
  grant('staff', 'pos.view'),
  grant('viewer', 'finance.view'),
]
