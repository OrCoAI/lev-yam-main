import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { PERM, useCan } from '../../lib/permissions'
import {
  deleteQuote,
  generateContract,
  loadAll,
  setQuoteArchived,
  setQuoteNotes,
  setQuoteStatus,
  type AllData,
} from './api'
import Calendar from './Calendar'
import ChecklistModal from './ChecklistModal'
import { eventDayChip, formatDate, ILS } from './format'
import { useQT } from './i18n'
import NewQuoteModal from './NewQuoteModal'
import SettingsModal from './SettingsModal'
import type { ContractRow, QuoteRow, QuoteStatus } from './types'
import { isConfirmed } from './types'
import './quotes.css'

const STATUSES: QuoteStatus[] = ['draft', 'sent', 'approved', 'declined', 'expired', 'paid']
type ViewMode = 'live' | 'happy' | 'archive' | 'all'

interface MenuOption {
  key: string
  label: string
  /** data attribute driving the colored dot (mirrors the badge palette) */
  dot: { attr: 'data-s' | 'data-cs'; value: string }
}

/** Status picker: a compact chip palette (never a vertical list), rendered in
 *  a portal on document.body so no ancestor can clip or reposition it.
 *  Desktop: small floating panel by the anchor. Touch: bottom sheet. */
function StatusMenu({
  open,
  title,
  anchorRef,
  options,
  onPick,
  onClose,
}: {
  open: boolean
  title: string
  anchorRef: React.RefObject<HTMLElement>
  options: MenuOption[]
  onPick: (key: string) => void
  onClose: () => void
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isSheet = open && window.matchMedia('(max-width: 760px)').matches

  useLayoutEffect(() => {
    if (!open || isSheet || !anchorRef.current) {
      setPos(null)
      return
    }
    const r = anchorRef.current.getBoundingClientRect()
    const panelW = Math.min(300, window.innerWidth - 16)
    const left = Math.min(Math.max(8, r.left + r.width / 2 - panelW / 2), window.innerWidth - panelW - 8)
    const below = r.bottom + 8 + 96 <= window.innerHeight
    setPos({ left, top: below ? r.bottom + 8 : Math.max(8, r.top - 104) })
  }, [open, isSheet, anchorRef])

  useEffect(() => {
    if (!open || isSheet) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (anchorRef.current?.contains(t) || panelRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, isSheet, anchorRef, onClose])

  if (!open) return null

  const chips = (
    <div className="status-chips">
      {options.map((o) => (
        <button
          key={o.key}
          className="status-chip"
          onClick={() => {
            onPick(o.key)
            onClose()
          }}
        >
          <span className="s-dot" {...{ [o.dot.attr]: o.dot.value }} />
          {o.label}
        </button>
      ))}
    </div>
  )

  if (isSheet) {
    return createPortal(
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="status-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-title">{title}</div>
          {chips}
        </div>
      </div>,
      document.body,
    )
  }

  if (!pos) return null
  return createPortal(
    <div ref={panelRef} className="status-pop" style={{ top: pos.top, left: pos.left }}>
      {chips}
    </div>,
    document.body,
  )
}

function StatusBadge({
  quote,
  canEdit,
  onUpdate,
}: {
  quote: QuoteRow
  canEdit: boolean
  onUpdate: (id: string, s: QuoteStatus) => void
}) {
  const qt = useQT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  return (
    <span ref={ref} className="badge-anchor">
      <button
        className="status-badge"
        data-s={quote.status}
        disabled={!canEdit}
        onClick={() => setOpen(!open)}
      >
        {qt.status[quote.status]}
        {canEdit && <span className="badge-caret">▾</span>}
      </button>
      <StatusMenu
        open={open}
        title={qt.thProgress}
        anchorRef={ref}
        options={STATUSES.filter((s) => s !== quote.status).map((s) => ({
          key: s,
          label: qt.status[s],
          dot: { attr: 'data-s', value: s },
        }))}
        onPick={(s) => onUpdate(quote.id, s as QuoteStatus)}
        onClose={() => setOpen(false)}
      />
    </span>
  )
}

/** Contract chip: a quiet dot+label that opens the contract document.
 *  Status changes happen on the document page — the dashboard stays clean. */
function ContractCell({
  quote,
  contract,
  canContracts,
  onGenerate,
}: {
  quote: QuoteRow
  contract?: ContractRow
  canContracts: boolean
  onGenerate: (quoteId: string) => void
}) {
  const qt = useQT()

  if (!contract) {
    if (quote.status === 'approved' && canContracts) {
      return (
        <button className="btn-contract" onClick={() => onGenerate(quote.id)}>
          {qt.createContract}
        </button>
      )
    }
    return null
  }

  return (
    <Link
      to={`/quotes/${quote.id}/contract`}
      className="contract-chip"
      title={contract.contract_number}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="s-dot" data-cs={contract.status} />
      {qt.contractStatus[contract.status]}
    </Link>
  )
}

export default function QuotesModule() {
  const qt = useQT()
  const navigate = useNavigate()
  const canManage = useCan(PERM.quotesManage)
  const canContracts = useCan(PERM.quotesContracts)

  const [data, setData] = useState<AllData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | QuoteStatus>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [showCal, setShowCal] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [checklistQuoteId, setChecklistQuoteId] = useState<string | null>(null)

  const load = useCallback(() => {
    loadAll()
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(load, [load])

  const run = (p: Promise<unknown>) => p.then(load).catch((e: Error) => alert(e.message))

  if (error) return <div className="error">{qt.errorLoad} {error}</div>
  if (!data) return <div className="muted">{qt.loading}</div>

  const allQuotes = data.quotes
  const contractsByQuoteId: Record<string, ContractRow> = {}
  for (const c of data.contracts) contractsByQuoteId[c.quote_id] = c

  const activeQuotes = allQuotes.filter((q) => !q.archived)
  const archivedQuotes = allQuotes.filter((q) => q.archived)
  const liveQuotes = activeQuotes.filter((q) => q.status !== 'paid')
  const happyQuotes = activeQuotes.filter((q) => q.status === 'paid')
  const quotesForView =
    viewMode === 'live' ? liveQuotes : viewMode === 'happy' ? happyQuotes : viewMode === 'archive' ? archivedQuotes : allQuotes

  const counts: Record<string, number> = { all: quotesForView.length }
  for (const s of STATUSES) counts[s] = quotesForView.filter((q) => q.status === s).length
  const filtered = filter === 'all' ? quotesForView : quotesForView.filter((q) => q.status === filter)

  const revenueStatus: QuoteStatus = viewMode === 'happy' ? 'paid' : 'approved'
  const revenueTotal = quotesForView
    .filter((q) => q.status === revenueStatus)
    .reduce((sum, q) => sum + (q.final_price ?? q.subtotal ?? 0), 0)

  const statCards: { key: 'all' | QuoteStatus; label: string }[] =
    viewMode === 'happy'
      ? [{ key: 'all', label: qt.statPaid }]
      : [
          { key: 'all', label: qt.statTotal },
          { key: 'draft', label: qt.statDrafts },
          { key: 'sent', label: qt.statSent },
          { key: 'approved', label: qt.statApproved },
          { key: 'declined', label: qt.statDeclined },
          { key: 'expired', label: qt.statExpired },
        ]

  const segments: { key: ViewMode; label: string }[] = [
    { key: 'live', label: qt.segLive },
    { key: 'happy', label: `${qt.segHappy}${happyQuotes.length ? ` (${happyQuotes.length})` : ''}` },
    { key: 'archive', label: `${qt.segArchive}${archivedQuotes.length ? ` (${archivedQuotes.length})` : ''}` },
    { key: 'all', label: qt.segAll },
  ]

  const todayChip = (() => {
    const d = new Date()
    return `${qt.dayPrefix} ${qt.dow[d.getDay()]} · ${formatDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )}`
  })()

  const checklistQuote = checklistQuoteId ? allQuotes.find((q) => q.id === checklistQuoteId) : null

  const emptyText =
    viewMode === 'archive'
      ? qt.emptyArchive
      : viewMode === 'happy'
        ? qt.emptyHappy
        : `${qt.emptyLive}${filter !== 'all' ? ` ${qt.emptyInStatus} ${qt.status[filter]}` : ''}`

  return (
    <div className="qdash">
      <header className="qdash-header">
        <div>
          <h1 className="qdash-title">{qt.title}</h1>
          <div className="muted qdash-date">{todayChip}</div>
        </div>
        <div className="qdash-actions">
          {revenueTotal > 0 && (
            <div className="qdash-revenue">
              <span className="lab">{viewMode === 'happy' ? qt.revenuePaid : qt.revenueApproved}</span>
              <span className="val">{ILS(revenueTotal)}</span>
            </div>
          )}
          <div className="seg">
            {segments.map((m) => (
              <button
                key={m.key}
                className={'seg-btn' + (viewMode === m.key ? ' active' : '')}
                onClick={() => {
                  setViewMode(m.key)
                  setFilter('all')
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button className={'btn-ghost' + (showCal ? ' active' : '')} onClick={() => setShowCal(!showCal)}>
            {qt.calendarBtn}
          </button>
          <button className="btn-ghost" title={qt.settingsTitle} onClick={() => setShowSettings(true)}>
            ⚙
          </button>
          {canManage && (
            <button className="btn-primary" onClick={() => setShowNew(true)}>
              {qt.newQuote}
            </button>
          )}
        </div>
      </header>

      <div className="qdash-stats">
        {statCards.map((s) => {
          const dotStatus = s.key === 'all' ? (viewMode === 'happy' ? 'paid' : null) : s.key
          return (
            <button
              key={s.key}
              className={'stat' + (filter === s.key ? ' active' : '')}
              onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
            >
              <span className="stat-num">{counts[s.key] ?? 0}</span>
              <span className="stat-label">
                {dotStatus && <span className="s-dot" data-s={dotStatus} />}
                {s.label}
              </span>
            </button>
          )
        })}
      </div>

      {showCal && (
        <Calendar quotes={liveQuotes} contractsByQuoteId={contractsByQuoteId} onOpenChecklist={(q) => setChecklistQuoteId(q.id)} />
      )}

      {filtered.length === 0 ? (
        <div className="card qdash-empty">{emptyText}</div>
      ) : (
        <div className="qdash-table-wrap card">
          <table className="qdash-table">
            <thead>
              <tr>
                <th>{qt.thCustomer}</th>
                <th>{qt.thEvent}</th>
                <th>{qt.thPrice}</th>
                <th>{qt.thProgress}</th>
                <th>{qt.thNotes}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => {
                const subtotal = q.subtotal ?? 0
                const total = q.final_price ?? subtotal
                const contract = contractsByQuoteId[q.id]
                const confirmed = isConfirmed(q, contract)
                const day = eventDayChip(q.event_date, qt)
                const custBits = [q.contact_person, q.guests && `${q.guests} ${qt.guestsSuffix}`].filter(Boolean)
                const evtBits = [q.event_type, q.hours].filter(Boolean)
                const showStrike =
                  (q.discount_pct ?? 0) > 0 && subtotal > 0 && q.final_price != null && subtotal !== q.final_price
                const showVat = q.final_price != null && q.final_price > 0
                const done = q.prep_checklist.filter((it) => it.done).length
                const clTotal = q.prep_checklist.length
                return (
                  <tr
                    key={q.id}
                    className={'row-link' + (q.archived && viewMode !== 'archive' ? ' archived-row' : '')}
                    onClick={() => navigate(`/quotes/${q.id}`)}
                  >
                    <td className="cell-customer">
                      <div className="cell-primary">{q.customer_name || '—'}</div>
                      <div className="cell-secondary">
                        {custBits.length > 0 && (
                          <>
                            {custBits.join(' · ')}
                            <span className="dot">·</span>
                          </>
                        )}
                        <span className="quote-num">{q.quote_number}</span>
                      </div>
                    </td>
                    <td className="cell-event">
                      <div className="event-line">
                        {q.event_date ? (
                          <span className="event-date">{formatDate(q.event_date)}</span>
                        ) : (
                          <span className="event-date empty">{qt.noDate}</span>
                        )}
                        {day && <span className={'day-chip ' + day.kind}>{day.text}</span>}
                      </div>
                      {evtBits.length > 0 && <div className="cell-secondary">{evtBits.join(' · ')}</div>}
                    </td>
                    <td className="cell-price">
                      <div className="cell-primary">{total ? ILS(total) : '—'}</div>
                      {(showStrike || showVat) && (
                        <div className="cell-secondary">
                          {showStrike && <span className="price-strike">{ILS(subtotal)}</span>}
                          {showVat && <span className="vat-tag">{qt.vatIncluded}</span>}
                        </div>
                      )}
                    </td>
                    <td className="cell-progress" onClick={(e) => e.stopPropagation()}>
                      <div className="cell-progress-row">
                        <StatusBadge quote={q} canEdit={canManage} onUpdate={(id, s) => run(setQuoteStatus(id, s))} />
                        <ContractCell
                          quote={q}
                          contract={contract}
                          canContracts={canContracts}
                          onGenerate={(quoteId) =>
                            generateContract(quoteId)
                              .then(() => navigate(`/quotes/${quoteId}/contract`))
                              .catch((e: Error) => alert(e.message))
                          }
                        />
                        {confirmed && (
                          <button
                            className={'btn-checklist' + (clTotal > 0 && done === clTotal ? ' all-done' : '')}
                            onClick={() => setChecklistQuoteId(q.id)}
                          >
                            {qt.prepBtn}
                            <span className="chk-count">{clTotal ? `${done}/${clTotal}` : '✓'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="cell-notes" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="notes-input"
                        defaultValue={q.notes}
                        placeholder={qt.notePlaceholder}
                        disabled={!canManage}
                        onBlur={(e) => {
                          if (e.target.value !== q.notes) run(setQuoteNotes(q.id, e.target.value))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </td>
                    <td className="cell-actions" onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <span className="row-action-cluster">
                          <button
                            className={'row-archive' + (q.archived ? ' restore' : '')}
                            title={q.archived ? qt.restoreTitle : qt.archiveTitle}
                            onClick={() => run(setQuoteArchived(q.id, !q.archived))}
                          >
                            {q.archived ? '↩' : '⊡'}
                          </button>
                          {!q.archived && (
                            <button
                              className="row-del"
                              title={qt.deleteTitle}
                              onClick={() => {
                                if (confirm(`${qt.deleteConfirm} ${q.quote_number}?`)) run(deleteQuote(q.id))
                              }}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewQuoteModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false)
            load()
          }}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {checklistQuote && (
        <ChecklistModal quote={checklistQuote} onClose={() => setChecklistQuoteId(null)} onChanged={load} />
      )}
    </div>
  )
}
