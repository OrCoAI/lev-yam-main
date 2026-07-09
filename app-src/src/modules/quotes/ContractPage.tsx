import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PERM, useCan } from '../../lib/permissions'
import {
  contractDataFromQuote,
  getContractByQuote,
  getOwnerSignature,
  getQuote,
  setContractStatus,
  updateContract,
} from './api'
import { useQT } from './i18n'
import type { ContractContent, ContractRow, ContractStatus, QuoteRow } from './types'
import './quote-doc.css'
import './contract-doc.css'

// The contract document — port of ~/lev-yam-quotes/contract-template.html:
// same ct-* structure, three A4 sheets (clauses ×2, details+signature), each
// independently scaleY-fitted (a4-fit per sheet, compress-only). Content is
// the snapshot taken at generation; a signed contract is locked (and the DB
// trigger enforces it regardless of the UI).

const BRAND = '/app/brand/'

function AutoGrow(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = () => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }
  useEffect(resize)
  return <textarea ref={ref} rows={1} {...props} onInput={resize} />
}

function Zigzag() {
  const path = useMemo(() => {
    let p = 'M0 13'
    let up = true
    for (let x = 24; x <= 1200; x += 24) {
      p += ' L' + x + ' ' + (up ? 3 : 13)
      up = !up
    }
    return p
  }, [])
  return (
    <div className="ct-zigzag">
      <svg viewBox="0 0 1200 16" preserveAspectRatio="none" aria-hidden="true" style={{ height: '14px' }}>
        <path d={path} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}

function CtFooter() {
  return (
    <footer className="ct-footer">
      <div className="ct-footer-brand">
        <img className="ct-footer-mark" src={BRAND + 'logo-mark.png'} alt="לב ים" />
        <span className="ct-footer-name">לב ים</span>
        <span className="ct-footer-tag">המקום שבו הלב פוגש את הים</span>
      </div>
      <div className="ct-footer-contact">
        <bdi>כפר הדייגים, ג׳יסר א-זרקא</bdi>
        <span className="ct-footer-dot">·</span>
        <bdi>050-666-9138</bdi>
        <span className="ct-footer-dot">·</span>
        <bdi>info@levyam.com</bdi>
      </div>
    </footer>
  )
}

export default function ContractPage() {
  const { id } = useParams<{ id: string }>() // quote id (contracts are 1:1)
  const qt = useQT()
  const canContracts = useCan(PERM.quotesContracts)

  const [quote, setQuote] = useState<QuoteRow | null>(null)
  const [row, setRow] = useState<ContractRow | null>(null)
  const [content, setContent] = useState<ContractContent | null>(null)
  const [status, setStatus] = useState<ContractStatus>('draft')
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getQuote(id), getContractByQuote(id)])
      .then(([q, c]) => {
        if (!c) {
          setNotFound(true)
          return
        }
        setQuote(q)
        setRow(c)
        setStatus(c.status)
        const raw = c.content as Partial<ContractContent>
        setContent({
          data: raw.data ?? {},
          clauses: raw.clauses ?? [],
          fields: raw.fields ?? [],
          ownerSignature: raw.ownerSignature ?? '',
        })
      })
      .catch(() => setNotFound(true))
  }, [id])

  useEffect(() => {
    document.body.classList.add('lq-doc-open')
    return () => document.body.classList.remove('lq-doc-open')
  }, [])

  // Fit, per sheet (a4-fit): one measuring pass computes BOTH scales.
  // Screen: uniform scale(s) so the fixed-210mm sheet fits the stage width
  // (without this the sheet is wider than the container and gets clipped).
  // Print: --ct-scale = scaleY compress-only toward 297mm, measured with the
  // editor chrome hidden (mirrors print CSS), applied by the !important rule.
  useEffect(() => {
    if (!content) return
    const stage = stageRef.current
    if (!stage) return
    const A4H = (297 / 25.4) * 96
    let tid: ReturnType<typeof setTimeout>
    const fit = () => {
      const cs = getComputedStyle(stage)
      const avail = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const chrome = Array.from(stage.querySelectorAll<HTMLElement>('.ct-del, .ct-add-btn, .ct-row-del'))
      stage.querySelectorAll<HTMLElement>('.ct-fit').forEach((fitEl) => {
        const sheet = fitEl.querySelector<HTMLElement>('.ct-sheet')
        const scaler = fitEl.querySelector<HTMLElement>('.ct-scaler')
        if (!sheet || !scaler) return
        scaler.style.transform = 'none'
        fitEl.style.width = ''
        fitEl.style.height = ''
        const w = sheet.offsetWidth
        const hScreen = sheet.offsetHeight
        chrome.forEach((el) => (el.style.display = 'none'))
        const hPrint = sheet.offsetHeight
        chrome.forEach((el) => (el.style.display = ''))
        scaler.style.setProperty('--ct-scale', (hPrint > A4H ? A4H / hPrint : 1).toFixed(6))
        const s = Math.min(1, avail / w)
        // RTL document: the sheet anchors to the scaler's right edge, so the
        // scale must originate there or the sheet drifts out of its box.
        scaler.style.transformOrigin = 'top right'
        scaler.style.transform = `scale(${s})`
        fitEl.style.width = w * s + 'px'
        fitEl.style.height = hScreen * s + 'px'
      })
    }
    const raf = requestAnimationFrame(fit)
    const queueFit = () => {
      clearTimeout(tid)
      tid = setTimeout(fit, 60)
    }
    window.addEventListener('resize', queueFit)
    const ro = new ResizeObserver(queueFit)
    stage.querySelectorAll('.ct-sheet').forEach((s) => ro.observe(s))
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', queueFit)
      ro.disconnect()
      clearTimeout(tid)
    }
  }, [content === null])

  if (notFound) return <div className="card notice">{qt.docNotFound}</div>
  if (!quote || !row || !content) return <div className="muted">{qt.loading}</div>

  const locked = status === 'signed' || !canContracts
  const d = content.data
  const splitAt = Math.ceil(content.clauses.length / 2)

  const setData = (key: string, v: string) => setContent((c) => c && { ...c, data: { ...c.data, [key]: v } })
  const setClause = (i: number, patch: Partial<{ title: string; text: string }>) =>
    setContent((c) => c && { ...c, clauses: c.clauses.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const removeClause = (i: number) => {
    if (!confirm(`למחוק את סעיף ${i + 1}?`)) return
    setContent((c) => c && { ...c, clauses: c.clauses.filter((_, j) => j !== i) })
  }
  const addClause = () =>
    setContent((c) => c && { ...c, clauses: [...c.clauses, { title: 'סעיף חדש', text: 'תוכן הסעיף...' }] })
  const setField = (i: number, patch: Partial<{ label: string; notes: string }>) =>
    setContent((c) => c && { ...c, fields: c.fields.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const removeField = (i: number) => {
    if (!confirm(`למחוק את "${content.fields[i].label}"?`)) return
    setContent((c) => c && { ...c, fields: c.fields.filter((_, j) => j !== i) })
  }
  const addField = () =>
    setContent(
      (c) => c && { ...c, fields: [...c.fields, { key: 'field' + Date.now(), label: 'שדה חדש', notes: '' }] },
    )

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateContract(row.id, { content: content as unknown as ContractRow['content'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Re-import the quote-derived fields (and the signature, if it was missing)
  // into the open contract — covers contracts generated before the quote was
  // finalized. Only touches local state; nothing changes until Save.
  const syncFromQuote = async () => {
    let sig = content.ownerSignature
    if (!sig) {
      try {
        sig = await getOwnerSignature()
      } catch {
        /* stays blank — a signature line prints instead */
      }
    }
    const fresh = contractDataFromQuote(quote)
    setContent((c) => c && { ...c, ownerSignature: sig, data: { ...c.data, ...fresh } })
  }

  const changeStatus = async (s: ContractStatus) => {
    if (s === 'signed' && !confirm(qt.markSignedConfirm)) return
    try {
      if (s === 'signed') {
        // persist any pending edits first — the row is immutable afterwards
        await updateContract(row.id, { content: content as unknown as ContractRow['content'] })
      }
      await setContractStatus(row.id, s)
      setStatus(s)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const renderClause = (c: { title: string; text: string }, i: number) => (
    <div className="ct-clause-wrap" key={i}>
      {!locked && (
        <button className="ct-del" title={qt.remove} onClick={() => removeClause(i)}>
          ×
        </button>
      )}
      <div className="ct-clause">
        <span className="ct-clause-num">{i + 1}</span>
        <input
          className="ct-clause-title-input"
          value={c.title}
          readOnly={locked}
          onChange={(e) => setClause(i, { title: e.target.value })}
        />
        <AutoGrow
          className="ct-clause-text-input"
          value={c.text}
          readOnly={locked}
          onChange={(e) => setClause(i, { text: (e.target as HTMLTextAreaElement).value })}
        />
      </div>
    </div>
  )

  return (
    <div className="ct-stage" ref={stageRef}>
      {/* Sheet 1: header + parties + first half of clauses */}
      <div className="ct-fit">
        <div className="ct-scaler">
          <div className="ct-sheet">
            <div className="ct-topbar" />
            <header className="ct-header">
              <div className="ct-header-row">
                <div className="ct-brand">
                  <img className="ct-logo" src={BRAND + 'logo-full.png'} alt="לב ים" />
                  <div>
                    <div className="ct-brand-name">לב ים</div>
                    <div className="ct-brand-tag">המקום שבו הלב פוגש את הים</div>
                  </div>
                </div>
                <div className="ct-title-block">
                  <h1 className="ct-doc-title">הסכם שכירות ושימוש</h1>
                  <div className="ct-doc-sub">מתחם "לב ים" – ג׳סר א-זרקא</div>
                  <div className="ct-meta-row">
                    <span className="ct-meta-label">מס׳ הצעה</span>
                    <span className="ct-pill">{quote.quote_number}</span>
                  </div>
                  <div className="ct-meta-row">
                    <span className="ct-meta-label">תאריך</span>
                    <span className="ct-pill">{d.signDate || '—'}</span>
                  </div>
                </div>
              </div>
            </header>
            <Zigzag />
            <div className="ct-parties">
              בין <strong>גיסר אל פז בע״מ</strong> (להלן: "המשכיר") ובין{' '}
              <strong>{d.customerName || 'המזמין/ה'}</strong> (להלן: "השוכר") — הוסכם כדלקמן:
            </div>
            <div className="ct-body">{content.clauses.slice(0, splitAt).map((c, i) => renderClause(c, i))}</div>
            <CtFooter />
          </div>
        </div>
      </div>

      {/* Sheet 2: remaining clauses */}
      <div className="ct-fit">
        <div className="ct-scaler">
          <div className="ct-sheet">
            <div className="ct-topbar" />
            <div className="ct-body">
              {content.clauses.slice(splitAt).map((c, i) => renderClause(c, splitAt + i))}
              {!locked && (
                <button className="ct-add-btn" onClick={addClause}>
                  + הוסף סעיף
                </button>
              )}
            </div>
            <CtFooter />
          </div>
        </div>
      </div>

      {/* Sheet 3: details table + signatures */}
      <div className="ct-fit">
        <div className="ct-scaler">
          <div className="ct-sheet">
            <div className="ct-topbar" />
            <div className="ct-body">
              <div className="ct-details-section">
                <h3 className="ct-details-title">
                  <img src={BRAND + 'house-blue.png'} alt="" />
                  טבלת פרטים לאירוע
                </h3>
                <table className="ct-details">
                  <thead>
                    <tr>
                      <th>פריט</th>
                      <th>פרטים</th>
                      <th>הערות</th>
                      <th style={{ width: 28 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.fields.map((f, i) => (
                      <tr key={f.key}>
                        <td className="ct-field-name">
                          <input value={f.label} readOnly={locked} onChange={(e) => setField(i, { label: e.target.value })} />
                        </td>
                        <td className="ct-field-value">
                          {/* dir=auto: LTR runs (hours, phones, emails) keep their
                              internal order instead of being reordered by the RTL cell */}
                          <input dir="auto" value={d[f.key] ?? ''} readOnly={locked} onChange={(e) => setData(f.key, e.target.value)} />
                        </td>
                        <td className="ct-field-notes">
                          <input
                            value={f.notes}
                            placeholder={locked ? '' : 'הערה...'}
                            readOnly={locked}
                            onChange={(e) => setField(i, { notes: e.target.value })}
                          />
                        </td>
                        <td>
                          {!locked && (
                            <button className="ct-row-del" title={qt.remove} onClick={() => removeField(i)}>
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!locked && (
                      <tr>
                        <td colSpan={4}>
                          <button className="ct-add-btn" style={{ margin: 0 }} onClick={addField}>
                            + הוסף שדה
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ct-sig-section">
                <h3 className="ct-details-title" style={{ marginTop: 14 }}>
                  <img src={BRAND + 'palm-orange.png'} alt="" />
                  הצהרת השוכר
                </h3>
                <div className="ct-sig-declaration">
                  אני מאשר/ת כי קראתי את ההסכם, הבנתי את תנאיו, אני מסכים/ה להם ומתחייב/ת לפעול לפיהם. ידוע לי כי הפרה
                  של תנאי מהותי עשויה להביא להפסקת האירוע לאלתר וללא החזר כספי.
                </div>
                <div className="ct-sig-row">
                  <div className="ct-sig-box">
                    <div className="ct-sig-label">חתימת השוכר</div>
                    <div className="ct-sig-sub">{d.customerName || '________'}</div>
                    <div className="ct-sig-line">חתימה</div>
                    {status === 'signed' && (
                      <div className="ct-sig-signed-meta">
                        ✓ נחתם{row.signed_date ? ` בתאריך ${row.signed_date.split('-').reverse().join('/')}` : ''}
                        {row.signed_name ? ` ע״י ${row.signed_name}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="ct-sig-box">
                    <div className="ct-sig-label">המשכיר – גיסר אל פז בע״מ</div>
                    <div className="ct-sig-sub">{d.signerName || '________'}</div>
                    {content.ownerSignature ? (
                      <img className="ct-sig-image" src={content.ownerSignature} alt="חתימה" />
                    ) : (
                      <div className="ct-sig-line">חתימה</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <CtFooter />
          </div>
        </div>
      </div>

      <div className="lq-controls">
        <Link to="/quotes" className="lq-ctrl-back">
          {qt.docBack}
        </Link>
        {status === 'signed' && <div className="ct-signed-banner">{qt.signedLocked}</div>}
        <div className="lq-ctrl-sect">{qt.docStatus}</div>
        <select
          className="lq-ctrl-select"
          value={status}
          disabled={locked}
          onChange={(e) => changeStatus(e.target.value as ContractStatus)}
        >
          {(Object.keys(qt.contractStatus) as ContractStatus[]).map((s) => (
            <option key={s} value={s}>
              {qt.contractStatus[s]}
            </option>
          ))}
        </select>
        <div className="lq-ctrl-sect">{qt.docActions}</div>
        {!locked && (
          <button className="lq-ctrl-btn" disabled={saving} data-saved={String(saved)} onClick={save}>
            {saving ? qt.saving : saved ? qt.docSaved : qt.docSaveContract}
          </button>
        )}
        {!locked && (
          <button className="lq-ctrl-btn secondary" onClick={syncFromQuote}>
            {qt.docSyncQuote}
          </button>
        )}
        <button className="lq-ctrl-btn" onClick={() => window.print()}>
          {qt.docPrint}
        </button>
        <Link to={`/quotes/${quote.id}`} className="lq-ctrl-back" style={{ textAlign: 'center' }}>
          {quote.quote_number} ←
        </Link>
      </div>
    </div>
  )
}
