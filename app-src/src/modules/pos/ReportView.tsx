// Date-scoped day/range report; permission-filtered. Ops view (pos.analytics)
// sees tables/covers/items + food costs; pos.reports adds money + labor + net;
// the DB strips money fields for callers without pos.reports, so the props here
// only mirror what the payload already enforces.
// Sections are collapsible accordions; expenses carry who/when + a receipt flag
// (cost-perm gated) + a paid date (manage gated), and the expense list spans the
// whole selected range. "Post day to finance" (pos.close_day) for pos.manage.
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import {
  addExpense, closeDay, deleteExpense, fetchDayReport, fetchRangeReport,
  setExpensePaid, setExpenseReceipt, updateExpense,
} from './api'
import { itemName, usePosTr } from './i18n'
import { dateRange, dm, fmtTime, jerusalemDate, shiftDate, startOfMonth, startOfWeek, todayKey } from './logic'
import S, { INK, SEA, SEA_DEEP, SUN } from './styles'
import type { ClosedBill, DayReport, DayReportExpense } from './types'
import { TotalCell } from './widgets'

// Discount attribution label (family & friends / staff / service / other / legacy).
const discLabel = (k: string, tr: (he: string, ar: string) => string) =>
  k === 'family_friends' ? tr('משפחה וחברים', 'العائلة والأصدقاء')
  : k === 'staff' ? tr('צוות', 'الطاقم')
  : k === 'service' ? tr('פיצוי', 'تعويض')
  : k === 'other' ? tr('אחר', 'أخرى')
  : tr('ללא שיוך', 'غير مُصنّف')

// Collapsible section with a title, optional right-side summary, and a chevron.
function Section({ title, right, open, onToggle, children }: {
  title: string
  right?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div style={S.acc}>
      <button className="pos-tap" style={S.accHead} onClick={onToggle}>
        <span style={S.accTitle}>{title}</span>
        <span style={S.accRight}>
          {right ? <span style={S.accSummary}>{right}</span> : null}
          <span style={S.accChevron}>{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open && <div style={S.accBody}>{children}</div>}
    </div>
  )
}

export default function ReportView({ initialDate, full, canAddFood, canAddLabor, canManage, closed, onReopen, onClear, onClose }: {
  initialDate?: string
  full: boolean
  canAddFood: boolean
  canAddLabor: boolean
  canManage: boolean
  closed: ClosedBill[]
  onReopen: (id: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const { tr, lang } = usePosTr()
  const today = jerusalemDate()
  const [from, setFrom] = useState(initialDate ?? today)
  const [to, setTo] = useState(initialDate ?? today)
  const [rep, setRep] = useState<DayReport | null>(null)
  const [loading, setLoad] = useState(true)
  const [tick, setTick] = useState(0)
  const [food, setFood] = useState({ amount: '', note: '' })
  const [labor, setLabor] = useState({ amount: '', note: '' })
  const [editId, setEditId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState({ note: '', amount: '' })
  const [open, setOpen] = useState<Record<string, boolean>>({ food: true, labor: false, items: false, details: false, closed: false })
  const [closing, setClosing] = useState(false)
  const [closeMsg, setCloseMsg] = useState<string | null>(null)
  const isRange = from !== to
  const rangeDays = isRange ? dateRange(from, to).length : 1
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  // One-click presets: today / yesterday / this week (Sun→today) / this month.
  const yest = shiftDate(today, -1)
  const wkStart = startOfWeek(today)
  const moStart = startOfMonth(today)
  const presets: [string, string][] = [
    ['today', tr('היום', 'اليوم')],
    ['yesterday', tr('אתמול', 'أمس')],
    ['week', tr('השבוע', 'هذا الأسبوع')],
    ['month', tr('החודש', 'هذا الشهر')],
  ]
  const applyPreset = (k: string) => {
    if (k === 'today') { setFrom(today); setTo(today) }
    else if (k === 'yesterday') { setFrom(yest); setTo(yest) }
    else if (k === 'week') { setFrom(wkStart); setTo(today) }
    else if (k === 'month') { setFrom(moStart); setTo(today) }
  }
  const activePreset =
    from === today && to === today ? 'today'
    : from === yest && to === yest ? 'yesterday'
    : from === wkStart && to === today ? 'week'
    : from === moStart && to === today ? 'month' : ''

  useEffect(() => {
    let alive = true
    // Spinner only when there's nothing to show yet — refetches (date change,
    // add/edit/delete reconcile) swap the data in silently instead of flashing.
    if (rep === null) setLoad(true)
    ;(isRange ? fetchRangeReport(from, to) : fetchDayReport(from))
      .then((r) => { if (alive) { setRep(r); setLoad(false) } })
      .catch(() => { if (alive) { setRep(null); setLoad(false) } })
    return () => { alive = false }
    // rep is read for the spinner decision only — refetching on it would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, tick, isRange])

  // Drop an in-progress inline edit when the date scope changes — the row may
  // not exist in the new range, and its draft must not resurface later.
  useEffect(() => { setEditId(null) }, [from, to])

  const s = rep?.summary ?? { bills: 0, covers: 0, avg_minutes: 0 }
  const isToday = !isRange && from === today
  const foodTotal = rep ? Number(rep.food) || 0 : 0
  const laborTotal = rep ? Number(rep.labor) || 0 : 0
  const rev = Number(s.revenue) || 0
  const net = rev - foodTotal - laborTotal
  const avgBill = s.bills ? Math.round(rev / s.bills) : Number(s.avg_bill) || 0
  const avgCover = s.covers ? Math.round(rev / s.covers) : 0
  const tipRate = rev ? Math.round(((Number(s.tips) || 0) / rev) * 100) : 0
  const foodPct = rev ? Math.round((foodTotal / rev) * 100) : 0
  const laborPct = rev ? Math.round((laborTotal / rev) * 100) : 0
  const netMargin = rev ? Math.round((net / rev) * 100) : 0
  const exp = rep?.expenses ?? []
  const foodList = exp.filter((e) => e.kind === 'food')
  const laborList = exp.filter((e) => e.kind === 'labor')
  const itemAr = (n: string) => itemName({ name: n }, lang)

  const submit = (kind: 'food' | 'labor', d: { amount: string; note: string }, set: (v: { amount: string; note: string }) => void) => {
    const amt = parseInt(d.amount, 10)
    if (!amt) return
    void addExpense(from, kind, amt, d.note.trim()).then(({ error }) => {
      if (error) { alert(tr('שמירת ההוצאה נכשלה', 'فشل حفظ المصروف') + ': ' + error.message); return }
      set({ amount: '', note: '' })
      setTick((t) => t + 1)
    })
  }
  // Patch one expense in place so a toggle updates just its chip instead of
  // refetching the whole report.
  const patchExpense = (id: number, patch: Partial<DayReportExpense>) =>
    setRep((r) => (r ? { ...r, expenses: r.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) } : r))
  // Optimistic write: patch locally for instant feedback, fire the RPC, and pull
  // server truth back only if it failed. `reconcile` additionally resyncs on
  // success — needed when the change moves the day's food/labor totals (edit,
  // delete), which are server-side aggregates the local patch can't update.
  const writeExpense = (
    call: () => PromiseLike<{ error: { message: string } | null }>,
    errMsg: string,
    reconcile = false,
  ) => void call().then(({ error }) => {
    if (error) alert(errMsg + ': ' + error.message)
    if (error || reconcile) setTick((t) => t + 1)
  })
  // Delete always confirms (manager-only + destructive); a paid expense gets a
  // stronger warning naming the amount + paid date + the finance-drift caveat.
  const removeExp = (e: DayReportExpense) => {
    const q = e.paid_on
      ? tr(
          'הוצאה זו מסומנת כשולמה (' + e.amount + ' ₪, ' + dm(e.paid_on) + ').\nמחיקה תסיר אותה מהדוחות; אם היום כבר נרשם לכספים יש לרשום אותו מחדש.\nלמחוק בכל זאת?',
          'هذا المصروف مُعلَّم كمدفوع (' + e.amount + ' ₪، ' + dm(e.paid_on) + ').\nالحذف يزيله من التقارير؛ إذا كان اليوم مسجلاً في المالية فيجب تسجيله من جديد.\nحذف على أي حال؟')
      : tr('למחוק את ההוצאה?', 'حذف المصروف؟')
    if (!window.confirm(q)) return
    setRep((r) => (r ? { ...r, expenses: r.expenses.filter((x) => x.id !== e.id) } : r)) // optimistic
    writeExpense(() => deleteExpense(e.id), tr('מחיקת ההוצאה נכשלה', 'فشل حذف المصروف'), true)
  }
  const startEdit = (e: DayReportExpense) => { setEditId(e.id); setEditDraft({ note: e.note || '', amount: String(e.amount) }) }
  const saveEdit = (id: number) => {
    const amt = parseInt(editDraft.amount, 10)
    if (!amt) return
    const note = editDraft.note.trim()
    patchExpense(id, { note: note || null, amount: amt })
    setEditId(null)
    writeExpense(() => updateExpense(id, note, amt), tr('עדכון ההוצאה נכשל', 'فشل تحديث المصروف'), true)
  }
  const toggleReceipt = (e: DayReportExpense) => {
    const next = !e.has_receipt
    patchExpense(e.id, { has_receipt: next })
    writeExpense(() => setExpenseReceipt(e.id, next), tr('עדכון קבלה נכשל', 'فشل تحديث الفاتورة'))
  }
  const markPaid = (id: number, paidOn: string | null) => {
    patchExpense(id, { paid_on: paidOn })
    writeExpense(() => setExpensePaid(id, paidOn), tr('סימון תשלום נכשל', 'فشل تحديد الدفع'))
  }

  // NEW: post the business day into the finance spine (idempotent; deltas on re-run).
  const postDay = () => {
    setClosing(true)
    setCloseMsg(null)
    closeDay(from)
      .then((r) => {
        setCloseMsg(r.posted.length === 0
          ? tr('אין שינוי — היום כבר רשום בכספים', 'لا تغيير — اليوم مسجل مسبقاً')
          : tr('נרשם לכספים', 'سُجل في المالية') + ': ' + r.posted.map((p) => p.leg + ' ' + p.amount + ' ₪').join(' · '))
      })
      .catch((e: Error) => setCloseMsg(tr('שגיאה', 'خطأ') + ': ' + e.message))
      .finally(() => setClosing(false))
  }

  const detail = (label: string, val: string) => (
    <div style={S.detailRow}>
      <span style={S.detailLbl}>{label}</span>
      <span style={S.detailVal}>{val}</span>
    </div>
  )
  const costForm = (kind: 'food' | 'labor', d: { amount: string; note: string }, set: (v: { amount: string; note: string }) => void, notePh: string) => (
    <div style={S.costAddRow}>
      <input style={S.costNoteInput} placeholder={notePh} value={d.note} onChange={(e) => set({ ...d, note: e.target.value })} />
      <input style={S.costAmtInput} type="number" inputMode="numeric" placeholder="₪" value={d.amount} onChange={(e) => set({ ...d, amount: e.target.value })} />
      <button className="pos-tap" style={S.costAdd} onClick={() => submit(kind, d, set)}>{tr('הוסף', 'إضافة')}</button>
    </div>
  )
  // One expense: note+amount, who/when, then receipt + paid + edit/delete.
  // Managers can switch a row into inline edit (name + amount).
  const expenseRow = (e: DayReportExpense) => {
    const canReceipt = (e.kind === 'food' ? canAddFood : canAddLabor) || canManage
    if (editId === e.id) {
      return (
        <div key={e.id} style={S.expRow}>
          <div style={S.costAddRow}>
            <input style={S.costNoteInput} value={editDraft.note} placeholder={tr('שם / הערה', 'اسم / ملاحظة')} onChange={(ev) => setEditDraft({ ...editDraft, note: ev.target.value })} autoFocus />
            <input style={S.costAmtInput} type="number" inputMode="numeric" placeholder="₪" value={editDraft.amount} onChange={(ev) => setEditDraft({ ...editDraft, amount: ev.target.value })} />
          </div>
          <div style={S.expActions}>
            <button className="pos-tap" style={S.costAdd} onClick={() => saveEdit(e.id)}>{tr('שמור', 'حفظ')}</button>
            <button className="pos-tap" style={S.expChip} onClick={() => setEditId(null)}>{tr('ביטול', 'إلغاء')}</button>
          </div>
        </div>
      )
    }
    return (
      <div key={e.id} style={S.expRow}>
        <div style={S.expTop}>
          <span style={S.expNote}>{e.note || tr('ללא הערה', 'بدون ملاحظة')}</span>
          <span style={S.expAmt}>{e.amount} ₪</span>
        </div>
        {/* full email + time on their own line — wrap freely, never shift the chips below */}
        <div style={S.expWhoLine}>
          {(e.by || tr('לא ידוע', 'غير معروف')) + ' · ' + (isRange ? dm(e.business_date) + ' · ' : '') + fmtTime(e.at)}
        </div>
        {/* actions on a fixed line — same position every row, independent of email length */}
        <div style={S.expActions}>
          <button
            className="pos-tap"
            style={{ ...S.expChip, ...(e.has_receipt ? S.expChipOn : {}), ...(canReceipt ? {} : S.expChipRO) }}
            disabled={!canReceipt}
            onClick={() => canReceipt && toggleReceipt(e)}
          >{'🧾 ' + (e.has_receipt ? tr('קבלה', 'فاتورة') : tr('ללא', 'بدون'))}</button>
          {e.paid_on ? (
            canManage ? (
              <span style={S.expPaidWrap}>
                <span style={S.expPaidTick}>✓</span>
                <input type="date" max={today} value={e.paid_on} style={S.expDate} onChange={(ev) => ev.target.value && markPaid(e.id, ev.target.value)} />
                <button className="pos-tap" style={S.expUnpay} title={tr('בטל תשלום', 'إلغاء الدفع')} onClick={() => markPaid(e.id, null)}>✕</button>
              </span>
            ) : (
              <span style={{ ...S.expChip, ...S.expChipPaid }}>{'✓ ' + tr('שולם', 'مدفوع') + ' ' + dm(e.paid_on)}</span>
            )
          ) : canManage ? (
            <button className="pos-tap" style={S.expChip} onClick={() => markPaid(e.id, today)}>{tr('סמן שולם', 'تحديد مدفوع')}</button>
          ) : (
            <span style={{ ...S.expChip, ...S.expChipRO }}>{tr('לא שולם', 'غير مدفوع')}</span>
          )}
          {canManage && <button className="pos-tap" style={S.expEdit} title={tr('עריכה', 'تعديل')} onClick={() => startEdit(e)}>✎</button>}
          {canManage && <button className="pos-tap" style={S.costDel} title={tr('מחיקה', 'حذف')} onClick={() => removeExp(e)}>✕</button>}
        </div>
      </div>
    )
  }

  const todayClosed = isToday ? closed.filter((c) => new Date(c.paidAt).toDateString() === todayKey()) : []
  const addHint = <div style={S.reportHint}>{tr('בחרו יום ספציפי כדי להוסיף הוצאה', 'اختر يوماً محدداً لإضافة مصروف')}</div>

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.receipt} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...S.receiptHead, background: SEA_DEEP }}>
          <span style={S.receiptBrand}>{full ? tr('דוח', 'تقرير') : tr('דוח מטבח', 'تقرير المطبخ')}</span>
          <div style={S.reportPresets}>
            {presets.map(([k, lbl]) => (
              <button key={k} className="pos-tap" style={{ ...S.reportPreset, ...(activePreset === k ? S.reportPresetOn : {}) }} onClick={() => applyPreset(k)}>{lbl}</button>
            ))}
          </div>
          <div style={S.reportDates}>
            <input type="date" max={to} value={from} style={S.reportDate}
              onChange={(e) => { const v = e.target.value; setFrom(v); if (!full || v > to) setTo(v) }} />
            {full && <span style={S.reportDash}>–</span>}
            {full && (
              <input type="date" max={today} value={to} style={S.reportDate}
                onChange={(e) => { const v = e.target.value; setTo(v); if (v < from) setFrom(v) }} />
            )}
          </div>
        </div>

        <div style={S.receiptScroll}>
          {loading ? (
            <div style={S.receiptEmpty}>{tr('טוען…', 'جار التحميل…')}</div>
          ) : !rep ? (
            <div style={S.receiptEmpty}>{tr('שגיאה בטעינת הדוח', 'خطأ في تحميل التقرير')}</div>
          ) : (
            <Fragment>
              {isRange && (
                <div style={S.reportRangeNote}>
                  {tr('טווח', 'نطاق') + ' · ' + rangeDays + ' ' + tr('ימים', 'أيام') + ' · ' + from + ' → ' + to}
                </div>
              )}

              <div style={S.reportTiles}>
                <TotalCell label={tr('שולחנות', 'طاولات')} val={s.bills || 0} color={SEA_DEEP} cur="" />
                <TotalCell label={tr('סועדים', 'ضيوف')} val={s.covers || 0} color={SEA} cur="" />
                {full && <TotalCell label={tr('הכנסה', 'الدخل')} val={s.revenue || 0} color={INK} />}
                {full && <TotalCell label={tr('מזומן', 'نقداً')} val={s.cash || 0} color="#3a9e6e" />}
                {full && <TotalCell label={tr('אשראי', 'بطاقة')} val={s.card || 0} color={SEA} />}
                {full && <TotalCell label={tr('טיפים', 'بقشيش')} val={s.tips || 0} color="#a9791b" />}
                {full && (s.discounts || 0) > 0 && <TotalCell label={tr('הנחות', 'خصومات')} val={s.discounts || 0} color={SUN} />}
                <TotalCell label={tr('עלות מזון', 'تكلفة الطعام')} val={foodTotal} color={SUN} />
                {full && <TotalCell label={tr('עלות עובדים', 'تكلفة العمال')} val={laborTotal} color={SUN} />}
              </div>

              {full && (
                <div style={S.reportNet}>
                  <span style={S.reportNetLbl}>{tr('רווח נקי', 'الربح الصافي')}</span>
                  <span style={{ ...S.reportNetNum, color: net >= 0 ? '#2f7d57' : '#c2553f' }}>{net} ₪</span>
                </div>
              )}
              {full && <div style={S.reportHint}>{tr('הכנסה − מזון − עובדים · טיפים לא נכללים', 'الدخل − الطعام − العمال · البقشيش غير محتسب')}</div>}

              {/* NEW: business day → finance spine */}
              {canManage && !isRange && (
                <Fragment>
                  <button className="pos-tap" style={{ ...S.reportExpand, borderColor: SEA, color: SEA_DEEP, opacity: closing ? 0.6 : 1 }} disabled={closing} onClick={postDay}>
                    {closing ? tr('רושם…', 'جار التسجيل…') : tr('רישום היום לכספים', 'تسجيل اليوم في المالية')}
                  </button>
                  {closeMsg && <div style={S.reportHint}>{closeMsg}</div>}
                </Fragment>
              )}

              {full && (
                <Section title={tr('פירוט מלא', 'تفاصيل كاملة')} open={open.details} onToggle={() => toggle('details')}>
                  {detail(tr('ממוצע לשולחן', 'متوسط الطاولة'), avgBill + ' ₪')}
                  {detail(tr('ממוצע לסועד', 'متوسط الضيف'), avgCover + ' ₪')}
                  {!isRange && detail(tr('זמן ישיבה ממוצע', 'متوسط مدة الجلوس'), (s.avg_minutes || 0) + ' ' + tr('דק׳', 'د'))}
                  {detail(tr('שיעור טיפ', 'نسبة البقشيش'), tipRate + '%')}
                  {(s.discounts || 0) > 0 && detail(tr('סה״כ הנחות', 'مجموع الخصومات'), (s.discounts || 0) + ' ₪')}
                  {Object.entries(rep.discounts_by_kind || {}).map(([k, v]) =>
                    <Fragment key={k}>{detail('· ' + discLabel(k, tr), (v || 0) + ' ₪')}</Fragment>)}
                  {detail(tr('עלות מזון', 'تكلفة الطعام'), foodTotal + ' ₪' + (rev ? ' · ' + foodPct + '%' : ''))}
                  {detail(tr('עלות עובדים', 'تكلفة العمال'), laborTotal + ' ₪' + (rev ? ' · ' + laborPct + '%' : ''))}
                  {detail(tr('שיעור רווח', 'هامش الربح'), netMargin + '%')}
                </Section>
              )}

              <Section title={tr('פריטים שנמכרו', 'الأصناف المباعة')} right={rep.items?.length ? String(rep.items.length) : ''} open={open.items} onToggle={() => toggle('items')}>
                {rep.items && rep.items.length ? (
                  rep.items.map((it, i) => (
                    <div key={i} style={S.reportItemRow}>
                      <span style={S.reportItemName}>{itemAr(it.name)}</span>
                      <span style={S.reportItemQty}>×{it.units}</span>
                      {full && <span style={S.reportItemVal}>{(it.value || 0) + ' ₪'}</span>}
                    </div>
                  ))
                ) : (
                  <div style={S.reportEmptySec}>—</div>
                )}
              </Section>

              <Section title={tr('עלות מזון / קבלות', 'تكلفة الطعام / فواتير')} right={foodTotal ? foodTotal + ' ₪' : ''} open={open.food} onToggle={() => toggle('food')}>
                {foodList.length ? foodList.map(expenseRow) : <div style={S.reportEmptySec}>—</div>}
                {!isRange ? (canAddFood && costForm('food', food, setFood, tr('ספק / הערה', 'مورد / ملاحظة'))) : (canAddFood && addHint)}
              </Section>

              {full && (
                <Section title={tr('עלות עובדים', 'تكلفة العمال')} right={laborTotal ? laborTotal + ' ₪' : ''} open={open.labor} onToggle={() => toggle('labor')}>
                  {laborList.length ? laborList.map(expenseRow) : <div style={S.reportEmptySec}>—</div>}
                  {!isRange ? (canAddLabor && costForm('labor', labor, setLabor, tr('שם / תפקיד', 'اسم / دور'))) : (canAddLabor && addHint)}
                </Section>
              )}

              {full && isToday && todayClosed.length > 0 && (
                <Section title={tr('שולחנות שנסגרו היום', 'طاولات أُغلقت اليوم')} right={String(todayClosed.length)} open={open.closed} onToggle={() => toggle('closed')}>
                  {todayClosed.map((c) => (
                    <div key={c.id} style={S.closedRow}>
                      <span style={S.closedNum}>{c.num}</span>
                      <div style={S.closedInfo}>
                        <div style={S.closedName}>{(c.name ? c.name + ' · ' : '') + tr('שולחן', 'طاولة') + ' ' + c.num}</div>
                        <div style={S.closedSub}>
                          <span>{fmtTime(c.paidAt)}</span>
                          <span>{c.total} ₪</span>
                        </div>
                      </div>
                      <button className="pos-tap" style={S.reopenBtn} onClick={() => onReopen(c.id)}>{tr('פתח מחדש', 'إعادة فتح')}</button>
                    </div>
                  ))}
                </Section>
              )}
            </Fragment>
          )}
        </div>

        <div style={S.receiptBtns}>
          <button className="pos-tap" style={S.receiptClose} onClick={onClose}>{tr('סגור', 'إغلاق')}</button>
          {canManage && isToday && todayClosed.length > 0 && (
            <button
              className="pos-tap"
              style={S.clearBtn}
              onClick={() => {
                if (window.confirm(tr('לסיים ולאפס את היום? השולחנות שנסגרו יוסרו מהרשימה (הנתונים נשמרים לדוחות).', 'إنهاء وتصفير اليوم؟ ستُزال الطاولات المغلقة من القائمة (تبقى للتقارير).'))) onClear()
              }}
            >
              {tr('סיום יום', 'إنهاء اليوم')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
