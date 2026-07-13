import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PERM, useCan } from '../../lib/permissions'
import { getQuote, setQuoteStatus, updateQuote } from './api'
import { DEFAULT_CONTENT } from './defaults'
import { ILS, formatDate, swapAdjacent } from './format'
import { useQT } from './i18n'
import type { AgendaItem, QuoteContent, QuoteItem, QuoteRow, QuoteStatus, QuoteTweaks } from './types'
import './quote-doc.css'

// The quote document — a faithful port of the master template
// (~/lev-yam-quotes/Lev Yam Price Quote.html): same .lq-* markup and print
// behavior (a4-fit: scaleY(--lq-print-scale)), with the DB replacing
// localStorage + /save. Document content is Hebrew (customer-facing).

const num = (v: string | number) => {
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''))
  return Number.isNaN(n) ? 0 : n
}
const uid = () => Math.random().toString(36).slice(2, 9)

const BRAND = '/app/brand/'

/** Client fields kept as columns on quotes.quotes (edited on the sheet). */
interface ClientFields {
  customer_name: string
  contact_person: string
  phone: string
  email: string
  event_type: string
  event_date: string
  guests: string
  hours: string
}

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = () => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }
  // re-measure only when the content changes (typing goes through onInput) —
  // an empty-less dep array would force a sync reflow per textarea per render
  useLayoutEffect(resize, [props.value])
  return <textarea ref={ref} rows={1} {...props} onInput={resize} />
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="lq-field">
      <span className="lq-field-label">{label}</span>
      {/* dir=auto keeps LTR values (hours, phone, email) in their real order
          inside the RTL sheet; CSS pins the visual alignment */}
      <input type={type ?? 'text'} dir="auto" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

const Tick = () => (
  <svg className="lq-tick" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 10.5l3.5 3.5L16 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function QuotePage() {
  const { id } = useParams<{ id: string }>()
  const qt = useQT()
  const canManage = useCan(PERM.quotesManage)

  const [row, setRow] = useState<QuoteRow | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [c, setC] = useState<ClientFields | null>(null)
  const [d, setDRaw] = useState<QuoteContent | null>(null)
  const [status, setStatus] = useState<QuoteStatus>('draft')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Undo stack over the document body (Ctrl/Cmd+Z outside inputs), as in the template.
  const historyRef = useRef<QuoteContent[]>([])
  const skipHistoryRef = useRef(false)
  const setD = useCallback((valOrFn: QuoteContent | ((cur: QuoteContent) => QuoteContent)) => {
    setDRaw((cur) => {
      if (!cur) return cur
      const next = typeof valOrFn === 'function' ? valOrFn(cur) : valOrFn
      if (!skipHistoryRef.current) historyRef.current = [...historyRef.current.slice(-50), cur]
      skipHistoryRef.current = false
      return next
    })
  }, [])
  const undo = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1]
    if (!prev) return
    historyRef.current = historyRef.current.slice(0, -1)
    skipHistoryRef.current = true
    setDRaw(prev)
  }, [])

  useEffect(() => {
    if (!id) return
    getQuote(id)
      .then((q) => {
        setRow(q)
        setStatus(q.status)
        setC({
          customer_name: q.customer_name,
          contact_person: q.contact_person,
          phone: q.phone,
          email: q.email,
          event_type: q.event_type,
          event_date: q.event_date ?? '',
          guests: q.guests,
          hours: q.hours,
        })
        const content = q.content as Partial<QuoteContent>
        setDRaw({
          ...DEFAULT_CONTENT,
          ...content,
          tweaks: { ...DEFAULT_CONTENT.tweaks, ...(content.tweaks ?? {}) },
        })
      })
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const el = document.activeElement
        if (el && ['INPUT', 'TEXTAREA'].includes(el.tagName)) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  // Mark the body while the document page is open so print CSS can hide the
  // platform chrome and show only the A4 sheet.
  useEffect(() => {
    document.body.classList.add('lq-doc-open')
    return () => document.body.classList.remove('lq-doc-open')
  }, [])

  // Browsers suggest the tab title as the "print to PDF" filename — use the
  // quote number so exports are the same identifier the app tracks it by.
  useEffect(() => {
    if (!row) return
    const prevTitle = document.title
    document.title = row.quote_number
    return () => {
      document.title = prevTitle
    }
  }, [row])

  // ── Screen fit (zoom-invariant scale, ported from the template) ──────
  const fitRef = useRef<HTMLDivElement>(null)
  const scalerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!d) return
    const baseDpr = window.devicePixelRatio || 1
    const fit = () => {
      const fitEl = fitRef.current
      const scaler = scalerRef.current
      const sheet = sheetRef.current
      if (!fitEl || !scaler || !sheet) return
      const zoom = (window.devicePixelRatio || 1) / baseDpr
      scaler.style.transform = 'none'
      const w = sheet.offsetWidth
      const h = sheet.offsetHeight
      const s = Math.min(1, (window.innerWidth * zoom - 48) / w, (window.innerHeight * zoom - 48) / h)
      // RTL document: the sheet anchors to the scaler's right edge, so the
      // scale must originate there or the sheet drifts out of its box.
      scaler.style.transformOrigin = 'top right'
      scaler.style.transform = 'scale(' + s + ')'
      fitEl.style.width = w * s + 'px'
      fitEl.style.height = h * s + 'px'
    }
    fit()
    window.addEventListener('resize', fit)
    const ro = new ResizeObserver(fit)
    if (sheetRef.current) ro.observe(sheetRef.current)
    return () => {
      window.removeEventListener('resize', fit)
      ro.disconnect()
    }
  }, [d === null])

  // ── Fit-to-A4 print scale (the a4-fit mechanism, ported 1:1) ─────────
  useEffect(() => {
    if (!d) return
    const A4H = (297 / 25.4) * 96
    let tid: ReturnType<typeof setTimeout>
    const updateScale = () => {
      const sheet = sheetRef.current
      if (!sheet) return
      // Mirror print CSS: hide UI controls that won't appear in the PDF
      const els = Array.from(sheet.querySelectorAll<HTMLElement>('.lq-row-del, .lq-add, .lq-included-del, .lq-row-move'))
      els.forEach((el) => (el.style.display = 'none'))
      const h = sheet.offsetHeight
      els.forEach((el) => (el.style.display = ''))
      document.documentElement.style.setProperty('--lq-print-scale', h > 0 ? (A4H / h).toFixed(6) : '1')
    }
    updateScale()
    const ro = new ResizeObserver(() => {
      clearTimeout(tid)
      tid = setTimeout(updateScale, 60)
    })
    if (sheetRef.current) ro.observe(sheetRef.current)
    return () => {
      ro.disconnect()
      clearTimeout(tid)
      document.documentElement.style.removeProperty('--lq-print-scale')
    }
  }, [d === null])

  const zigPath = useMemo(() => {
    let p = 'M0 13'
    let up = true
    for (let x = 24; x <= 1200; x += 24) {
      p += ' L' + x + ' ' + (up ? 3 : 13)
      up = !up
    }
    return p
  }, [])

  if (notFound) return <div className="card notice">{qt.docNotFound}</div>
  if (!row || !c || !d) return <div className="muted">{qt.loading}</div>

  const tweaks = d.tweaks
  const setTweak = <K extends keyof QuoteTweaks>(k: K, v: QuoteTweaks[K]) =>
    setD((cur) => ({ ...cur, tweaks: { ...cur.tweaks, [k]: v } }))
  const set = (patch: Partial<QuoteContent>) => setD((cur) => ({ ...cur, ...patch }))
  const setClient = (k: keyof ClientFields) => (v: string) => setC((cur) => (cur ? { ...cur, [k]: v } : cur))

  const subtotal = d.items.reduce((s, it) => s + num(it.qty) * num(it.price), 0)
  const discount = tweaks.showDiscount ? subtotal * (num(d.discountPct) / 100) : 0
  const taxable = subtotal - discount
  const vat = tweaks.showVat ? taxable * d.vatRate : 0
  const total = taxable + vat
  const deposit = total * (num(d.depositPct) / 100)

  const updateItem = (itemId: string, k: keyof QuoteItem, v: string) =>
    set({ items: d.items.map((it) => (it.id === itemId ? { ...it, [k]: v } : it)) })
  const moveItem = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= d.items.length) return
    set({ items: swapAdjacent(d.items, index, j) })
  }
  const setAgendaItem = (i: number, k: keyof AgendaItem, v: string) =>
    set({ agenda: d.agenda.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })

  const saveQuote = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateQuote(row.id, {
        customer_name: c.customer_name,
        contact_person: c.contact_person,
        phone: c.phone,
        email: c.email,
        event_type: c.event_type,
        event_date: (c.event_date || null) as QuoteRow['event_date'],
        guests: c.guests,
        hours: c.hours,
        content: d as unknown as QuoteRow['content'],
        subtotal,
        discount_pct: tweaks.showDiscount ? num(d.discountPct) : 0,
        final_price: Math.round(total),
        vat_rate: d.vatRate,
        deposit_pct: num(d.depositPct),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = (s: QuoteStatus) => {
    const prev = status
    setStatus(s)
    setQuoteStatus(row.id, s).catch((e: Error) => {
      setStatus(prev) // the DB rejected it — don't keep showing the new status
      alert(e.message)
    })
  }

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="lq-ctrl-row">
      <label>{label}</label>
      <button type="button" className="lq-ctrl-toggle" data-on={String(value)} onClick={() => onChange(!value)}>
        <i />
      </button>
    </div>
  )

  return (
    <div className="lq-stage">
      <div className="lq-fit" ref={fitRef}>
        <div className="lq-scaler" ref={scalerRef}>
          <div className="lq-sheet" ref={sheetRef}>
            <div className="lq-topbar" />
            <header className="lq-header">
              <div className="lq-header-row">
                <div className="lq-brand-col">
                  <div className="lq-brand">
                    <div className="lq-logo-square">
                      <img src={BRAND + 'logo-full.png'} alt="לב ים" />
                    </div>
                    <div className="lq-brand-text">
                      <div className="lq-brand-name">לב ים</div>
                      <div className="lq-brand-tag">המקום שבו הלב פוגש את הים</div>
                    </div>
                  </div>
                  <div className="lq-header-note">
                    <AutoTextarea
                      value={d.greeting}
                      onChange={(e) => set({ greeting: (e.target as HTMLTextAreaElement).value })}
                      style={{ fontSize: '13px', width: '350px' }}
                    />
                  </div>
                </div>
                <div className="lq-title-block">
                  <h1 className="lq-doc-title">הצעת מחיר</h1>
                  <div className="lq-meta">
                    <div className="lq-meta-row">
                      <span className="lq-meta-label">מספר הצעה</span>
                      <span className="lq-pill lq-pill--blue">{row.quote_number}</span>
                    </div>
                    <div className="lq-meta-row">
                      <span className="lq-meta-label">תאריך הפקה</span>
                      <span className="lq-pill lq-pill--blue">{formatDate(row.issue_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lq-zigzag">
                <svg viewBox="0 0 1200 16" preserveAspectRatio="none" aria-hidden="true" style={{ height: '14px' }}>
                  <path d={zigPath} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </header>

            <main className="lq-body lq-body--classic">
              <section style={{ height: '128px', lineHeight: '1.4' }}>
                <h3 className="lq-h">
                  <img className="lq-h-icon" src={BRAND + 'house-blue.png'} alt="" />
                  פרטי הלקוח
                </h3>
                <div className="lq-client">
                  <Field label="שם הלקוח / חברה" value={c.customer_name} onChange={setClient('customer_name')} />
                  <Field label="איש קשר" value={c.contact_person} onChange={setClient('contact_person')} />
                  <Field label="טלפון" value={c.phone} onChange={setClient('phone')} />
                  <Field label='דוא"ל' value={c.email} onChange={setClient('email')} />
                  <Field label="סוג האירוע" value={c.event_type} onChange={setClient('event_type')} />
                  <Field label="מספר משתתפים" value={c.guests} onChange={setClient('guests')} />
                  <Field label="תאריך האירוע" value={c.event_date} onChange={setClient('event_date')} type="date" />
                  <Field label="שעות" value={c.hours} onChange={setClient('hours')} />
                </div>
              </section>

              <section>
                <h3 className="lq-h">
                  <img className="lq-h-icon" src={BRAND + 'sun-orange.png'} alt="" />
                  פירוט השירותים
                </h3>
                <table className="lq-table">
                  <thead>
                    <tr>
                      <th>תיאור השירות</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>כמות</th>
                      <th style={{ width: '110px', textAlign: 'center' }}>מחיר ליחידה</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>סה"כ</th>
                      <th style={{ width: '38px' }} aria-label={qt.reorderRow}></th>
                      <th style={{ width: '26px' }} aria-label={qt.remove}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((it, i) => (
                      <tr key={it.id}>
                        <td style={{ verticalAlign: 'top', paddingTop: '9px' }}>
                          <AutoTextarea
                            className="lq-desc"
                            value={it.desc}
                            onChange={(e) => updateItem(it.id, 'desc', (e.target as HTMLTextAreaElement).value)}
                          />
                        </td>
                        <td className="lq-col-amt">
                          <input className="lq-num" value={it.qty} onChange={(e) => updateItem(it.id, 'qty', e.target.value)} />
                        </td>
                        <td className="lq-col-amt">
                          <input className="lq-num" value={it.price} onChange={(e) => updateItem(it.id, 'price', e.target.value)} />
                        </td>
                        <td className="lq-col-amt lq-col-tot">{ILS(num(it.qty) * num(it.price))}</td>
                        <td className="lq-row-move">
                          <button title={qt.moveUp} disabled={i === 0} onClick={() => moveItem(i, -1)}>
                            ↑
                          </button>
                          <button title={qt.moveDown} disabled={i === d.items.length - 1} onClick={() => moveItem(i, 1)}>
                            ↓
                          </button>
                        </td>
                        <td>
                          <button
                            className="lq-row-del"
                            title={qt.removeRow}
                            onClick={() => set({ items: d.items.filter((x) => x.id !== it.id) })}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  className="lq-add"
                  onClick={() => set({ items: [...d.items, { id: uid(), desc: 'שירות נוסף', qty: '1', price: '0' }] })}
                >
                  {qt.addRow}
                </button>
              </section>

              <div className="lq-twocol" style={tweaks.leftSection === 'off' ? { gridTemplateColumns: '1fr' } : undefined}>
                {tweaks.leftSection === 'included' ? (
                  <section>
                    <h3 className="lq-h">
                      <img className="lq-h-icon" src={BRAND + 'heart-quad-green.png'} alt="" />
                      מה כלול בהצעה
                    </h3>
                    <ul className="lq-included">
                      {d.included.map((x, i) => (
                        <li key={i}>
                          <Tick />
                          <input
                            value={x}
                            onChange={(e) => set({ included: d.included.map((y, j) => (j === i ? e.target.value : y)) })}
                          />
                          <button
                            className="lq-included-del"
                            title={qt.remove}
                            onClick={() => set({ included: d.included.filter((_, j) => j !== i) })}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button className="lq-add" style={{ marginTop: '8px' }} onClick={() => set({ included: [...d.included, 'פריט נוסף'] })}>
                      {qt.addItem}
                    </button>
                  </section>
                ) : tweaks.leftSection === 'agenda' ? (
                  <section style={{ minWidth: 0, overflow: 'hidden' }}>
                    <h3 className="lq-h">
                      <img className="lq-h-icon" src={BRAND + 'heart-quad-green.png'} alt="" />
                      אג׳נדה
                    </h3>
                    <div className="lq-agenda-wrap">
                      {d.agenda.map((x, i) => (
                        <div className="lq-agenda-row" key={i}>
                          <input className="lq-agenda-time" value={x.time} onChange={(e) => setAgendaItem(i, 'time', e.target.value)} />
                          <div className="lq-agenda-sep" />
                          <input
                            className="lq-agenda-activity"
                            value={x.activity}
                            onChange={(e) => setAgendaItem(i, 'activity', e.target.value)}
                          />
                          <button
                            className="lq-included-del"
                            title={qt.remove}
                            onClick={() => set({ agenda: d.agenda.filter((_, j) => j !== i) })}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="lq-add"
                      style={{ marginTop: '8px' }}
                      onClick={() => set({ agenda: [...d.agenda, { time: '00:00', activity: 'פעילות נוספת' }] })}
                    >
                      {qt.addStep}
                    </button>
                  </section>
                ) : null}

                <section>
                  <h3 className="lq-h">
                    <img className="lq-h-icon" src={BRAND + 'halfcircle-blue.png'} alt="" />
                    סיכום מחיר
                  </h3>
                  <div className="lq-summary">
                    <div className="lq-sum-row">
                      <span className="lab">סכום ביניים</span>
                      <span className="val">{ILS(subtotal)}</span>
                    </div>
                    {tweaks.showDiscount && (
                      <div className="lq-sum-row lq-sum-discount">
                        <span className="lab">
                          הנחה (
                          <input className="lq-disc-input" value={d.discountPct} onChange={(e) => set({ discountPct: e.target.value })} />
                          %)
                        </span>
                        <span className="val">−{ILS(discount)}</span>
                      </div>
                    )}
                    {tweaks.showVat && (
                      <div className="lq-sum-row">
                        <span className="lab">מע"מ ({Math.round(d.vatRate * 100)}%)</span>
                        <span className="val">{ILS(vat)}</span>
                      </div>
                    )}
                    <div className="lq-sum-total">
                      <span className="lab">סה"כ לתשלום</span>
                      <span className="val">{ILS(total)}</span>
                    </div>
                    <div className="lq-sum-deposit">
                      <span className="lab">
                        מקדמה (
                        <input className="lq-dep-input" value={d.depositPct} onChange={(e) => set({ depositPct: e.target.value })} />
                        %)
                      </span>
                      <span className="val">{ILS(deposit)}</span>
                    </div>
                  </div>
                </section>
              </div>

              {tweaks.showTerms && (
                <div className="lq-fine">
                  <div className="lq-fine-block">
                    <h3 className="lq-h">
                      <img className="lq-h-icon" src={BRAND + 'palm-blue.png'} alt="" />
                      תנאים כלליים
                    </h3>
                    <AutoTextarea value={d.terms} onChange={(e) => set({ terms: (e.target as HTMLTextAreaElement).value })} />
                  </div>
                  <div className="lq-fine-block">
                    <h3 className="lq-h">
                      <img className="lq-h-icon" src={BRAND + 'palm-orange.png'} alt="" />
                      מדיניות ביטול
                    </h3>
                    <AutoTextarea value={d.cancellation} onChange={(e) => set({ cancellation: (e.target as HTMLTextAreaElement).value })} />
                  </div>
                </div>
              )}
            </main>

            <footer className="lq-footer">
              <div className="lq-footer-brand">
                <div className="lq-footer-circle">
                  <img src={BRAND + 'logo-mark.png'} alt="לב ים" />
                </div>
                <span className="lq-footer-name">לב ים</span>
                <span className="lq-footer-tag">המקום שבו הלב פוגש את הים</span>
              </div>
              <div className="lq-footer-contact">
                <bdi>כפר הדייגים, ג׳יסר א-זרקא</bdi>
                <span className="lq-footer-dot">·</span>
                <bdi>050-666-9138</bdi>
                <span className="lq-footer-dot">·</span>
                <bdi>info@levyam.com</bdi>
                <span className="lq-footer-dot">·</span>
                <bdi>www.levyam.com</bdi>
              </div>
            </footer>
          </div>
        </div>
      </div>

      <div className="lq-controls">
        <Link to="/quotes" className="lq-ctrl-back">
          {qt.docBack}
        </Link>
        <div className="lq-ctrl-sect">{qt.docStatus}</div>
        <div className="lq-ctrl-row">
          <select className="lq-ctrl-select" value={status} disabled={!canManage} onChange={(e) => changeStatus(e.target.value as QuoteStatus)}>
            {(Object.keys(qt.status) as QuoteStatus[]).map((s) => (
              <option key={s} value={s}>
                {qt.status[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="lq-ctrl-sect">{qt.docSections}</div>
        <Toggle label={qt.docVat} value={tweaks.showVat} onChange={(v) => setTweak('showVat', v)} />
        <Toggle label={qt.docDiscount} value={tweaks.showDiscount} onChange={(v) => setTweak('showDiscount', v)} />
        <div className="lq-ctrl-row lq-ctrl-col">
          <label>{qt.docSide}</label>
          <div className="lq-ctrl-seg">
            {(
              [
                ['off', qt.docSideOff],
                ['included', qt.docSideIncluded],
                ['agenda', qt.docSideAgenda],
              ] as const
            ).map(([val, lab]) => (
              <button
                key={val}
                type="button"
                data-on={String(tweaks.leftSection === val)}
                onClick={() => setTweak('leftSection', val)}
              >
                {lab}
              </button>
            ))}
          </div>
        </div>
        <Toggle label={qt.docTerms} value={tweaks.showTerms} onChange={(v) => setTweak('showTerms', v)} />
        <div className="lq-ctrl-sect">{qt.docActions}</div>
        {canManage && (
          <button className="lq-ctrl-btn" disabled={saving} data-saved={String(saved)} onClick={saveQuote}>
            {saving ? qt.saving : saved ? qt.docSaved : qt.docSave}
          </button>
        )}
        <button className="lq-ctrl-btn secondary" disabled={historyRef.current.length === 0} onClick={undo}>
          {qt.docUndo}
        </button>
        <button className="lq-ctrl-btn" onClick={() => window.print()}>
          {qt.docPrint}
        </button>
      </div>
    </div>
  )
}
