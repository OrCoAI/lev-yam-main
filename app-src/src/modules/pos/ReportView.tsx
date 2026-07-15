// Date-scoped day report; permission-filtered. Ops view (pos.analytics) sees
// tables/covers/items + food costs; pos.reports adds money + labor + net; the
// DB strips money fields for callers without pos.reports, so the props here
// only mirror what the payload already enforces.
// NEW vs pos.html: "post day to finance" (pos.close_day) for pos.manage.
import { Fragment, useEffect, useState } from 'react'
import { addExpense, closeDay, deleteExpense, fetchDayReport, fetchRangeReport } from './api'
import { itemName, usePosTr } from './i18n'
import { dateRange, fmtTime, jerusalemDate, shiftDate, todayKey } from './logic'
import S, { INK, SEA, SEA_DEEP, SUN } from './styles'
import type { ClosedBill, DayReport, DayReportExpense } from './types'
import { TotalCell } from './widgets'

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
  const [showDetails, setShowDetails] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeMsg, setCloseMsg] = useState<string | null>(null)
  const isRange = from !== to
  const rangeDays = isRange ? dateRange(from, to).length : 1

  // Quick date presets — ops gets day-only, full report gets multi-day too.
  const yest = shiftDate(today, -1)
  const presets: [string, string][] = full
    ? [['today', tr('היום', 'اليوم')], ['yesterday', tr('אתמול', 'أمس')], ['7', tr('7 ימים', '7 أيام')], ['30', tr('30 יום', '30 يوماً')]]
    : [['today', tr('היום', 'اليوم')], ['yesterday', tr('אתמול', 'أمس')]]
  const applyPreset = (k: string) => {
    if (k === 'today') { setFrom(today); setTo(today) }
    else if (k === 'yesterday') { setFrom(yest); setTo(yest) }
    else if (k === '7') { setFrom(shiftDate(today, -6)); setTo(today) }
    else if (k === '30') { setFrom(shiftDate(today, -29)); setTo(today) }
  }
  const activePreset =
    from === today && to === today ? 'today'
    : from === yest && to === yest ? 'yesterday'
    : to === today && from === shiftDate(today, -6) ? '7'
    : to === today && from === shiftDate(today, -29) ? '30' : ''

  useEffect(() => {
    let alive = true
    setLoad(true)
    ;(isRange ? fetchRangeReport(from, to) : fetchDayReport(from))
      .then((r) => { if (alive) { setRep(r); setLoad(false) } })
      .catch(() => { if (alive) { setRep(null); setLoad(false) } })
    return () => { alive = false }
  }, [from, to, tick, isRange])

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
  const removeExp = (id: number) =>
    void deleteExpense(id).then(({ error }) => {
      if (error) { alert(tr('מחיקת ההוצאה נכשלה', 'فشل حذف المصروف') + ': ' + error.message); return }
      setTick((t) => t + 1)
    })

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
  const costRow = (e: DayReportExpense, canDel: boolean) => (
    <div key={e.id} style={S.costRow}>
      <span style={S.costNote}>{e.note || tr('ללא הערה', 'بدون ملاحظة')}</span>
      <span style={S.costAmt}>{e.amount} ₪</span>
      {canDel && <button className="pos-tap" style={S.costDel} onClick={() => removeExp(e.id)}>✕</button>}
    </div>
  )

  const todayClosed = isToday ? closed.filter((c) => new Date(c.paidAt).toDateString() === todayKey()) : []

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
                <Fragment>
                  <button className="pos-tap" style={S.reportExpand} onClick={() => setShowDetails((v) => !v)}>
                    {(showDetails ? tr('הסתר פירוט', 'إخفاء التفاصيل') : tr('פירוט מלא', 'تفاصيل كاملة')) + (showDetails ? '  ▴' : '  ▾')}
                  </button>
                  {showDetails && (
                    <div style={S.detailBox}>
                      {detail(tr('ממוצע לשולחן', 'متوسط الطاولة'), avgBill + ' ₪')}
                      {detail(tr('ממוצע לסועד', 'متوسط الضيف'), avgCover + ' ₪')}
                      {!isRange && detail(tr('זמן ישיבה ממוצע', 'متوسط مدة الجلوس'), (s.avg_minutes || 0) + ' ' + tr('דק׳', 'د'))}
                      {detail(tr('שיעור טיפ', 'نسبة البقشيش'), tipRate + '%')}
                      {(s.discounts || 0) > 0 && detail(tr('סה״כ הנחות', 'مجموع الخصومات'), (s.discounts || 0) + ' ₪')}
                      {detail(tr('עלות מזון', 'تكلفة الطعام'), foodTotal + ' ₪' + (rev ? ' · ' + foodPct + '%' : ''))}
                      {detail(tr('עלות עובדים', 'تكلفة العمال'), laborTotal + ' ₪' + (rev ? ' · ' + laborPct + '%' : ''))}
                      {detail(tr('שיעור רווח', 'هامش الربح'), netMargin + '%')}
                    </div>
                  )}
                </Fragment>
              )}

              <div style={S.reportSecTitle}>{tr('פריטים שנמכרו', 'الأصناف المباعة')}</div>
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

              {!isRange && (
                <Fragment>
                  <div style={S.reportSecTitle}>{tr('עלות מזון / קבלות', 'تكلفة الطعام / فواتير')}</div>
                  {/* delete is manage-only — mirrors the RLS delete policy, not the add permission */}
                  {foodList.map((e) => costRow(e, canManage))}
                  {canAddFood && costForm('food', food, setFood, tr('ספק / הערה', 'مورد / ملاحظة'))}

                  {full && (
                    <Fragment>
                      <div style={S.reportSecTitle}>{tr('עלות עובדים', 'تكلفة العمال')}</div>
                      {laborList.map((e) => costRow(e, canManage))}
                      {canAddLabor && costForm('labor', labor, setLabor, tr('שם / תפקיד', 'اسم / دور'))}
                    </Fragment>
                  )}
                </Fragment>
              )}

              {full && isToday && todayClosed.length > 0 && (
                <Fragment>
                  <div style={S.reportSecTitle}>{tr('שולחנות שנסגרו היום', 'طاولات أُغلقت اليوم')}</div>
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
                </Fragment>
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
