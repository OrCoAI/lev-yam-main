import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { PERM, useCan } from '../../lib/permissions'
import {
  deleteQuote,
  generateContract,
  loadAll,
  setContractStatus,
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
import type { ContractRow, ContractStatus, QuoteRow, QuoteStatus } from './types'
import { isConfirmed } from './types'
import './quotes.css'

const STATUSES: QuoteStatus[] = ['draft', 'sent', 'approved', 'declined', 'expired', 'paid']
const CONTRACT_STATUSES: ContractStatus[] = ['draft', 'sent', 'signed']
type ViewMode = 'live' | 'happy' | 'archive' | 'all'

/** Fixed-position dropdown coords anchored to a trigger, flipped up near the
 *  viewport bottom (escapes the table's overflow clipping). */
function usePopoverPos(open: boolean, anchorRef: React.RefObject<HTMLElement>, optionCount: number) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null)
      return
    }
    const r = anchorRef.current.getBoundingClientRect()
    const h = optionCount * 34 + 12
    const below = r.bottom + 4 + h <= window.innerHeight
    setPos({
      left: Math.max(8, r.right - 130),
      top: below ? r.bottom + 4 : Math.max(8, r.top - h - 4),
    })
  }, [open, anchorRef, optionCount])
  return pos
}

function useCloseOnOutside(open: boolean, ref: React.RefObject<HTMLElement>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, ref, close])
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
  const options = STATUSES.filter((s) => s !== quote.status)
  const pos = usePopoverPos(open, ref, options.length)
  useCloseOnOutside(open, ref, () => setOpen(false))

  return (
    <span ref={ref} className="badge-anchor">
      <button
        className="status-badge"
        data-s={quote.status}
        disabled={!canEdit}
        onClick={() => setOpen(!open)}
      >
        {qt.status[quote.status]}
      </button>
      {open && pos && (
        <div className="status-dropdown" style={{ top: pos.top, left: pos.left }}>
          {options.map((s) => (
            <button
              key={s}
              className="status-option"
              onClick={() => {
                onUpdate(quote.id, s)
                setOpen(false)
              }}
            >
              {qt.status[s]}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

function ContractCell({
  quote,
  contract,
  canContracts,
  onGenerate,
  onStatus,
}: {
  quote: QuoteRow
  contract?: ContractRow
  canContracts: boolean
  onGenerate: (quoteId: string) => void
  onStatus: (id: string, s: ContractStatus) => void
}) {
  const qt = useQT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const options = contract ? CONTRACT_STATUSES.filter((s) => s !== contract.status) : []
  const pos = usePopoverPos(open, ref, options.length)
  useCloseOnOutside(open, ref, () => setOpen(false))

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
    <span ref={ref} className="badge-anchor">
      <button
        className="contract-badge"
        data-cs={contract.status}
        title={contract.contract_number}
        disabled={!canContracts || contract.status === 'signed'}
        onClick={() => setOpen(!open)}
      >
        {qt.contractStatus[contract.status]}
      </button>
      {open && pos && (
        <div className="status-dropdown" style={{ top: pos.top, left: pos.left }}>
          {options.map((s) => (
            <button
              key={s}
              className="status-option"
              onClick={() => {
                onStatus(contract.id, s)
                setOpen(false)
              }}
            >
              {qt.contractStatus[s]}
            </button>
          ))}
        </div>
      )}
    </span>
  )
}

export default function QuotesModule() {
  const qt = useQT()
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

      <div className="qdash-stats" data-single={statCards.length === 1 || undefined}>
        {statCards.map((s) => (
          <button
            key={s.key}
            className={'stat-card' + (filter === s.key ? ' active' : '')}
            data-status={s.key === 'all' && viewMode === 'happy' ? 'paid' : s.key}
            onClick={() => setFilter(filter === s.key ? 'all' : s.key)}
          >
            <div className="stat-num">{counts[s.key] ?? 0}</div>
            <div className="stat-label">{s.label}</div>
          </button>
        ))}
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
                  <tr key={q.id} className={q.archived && viewMode !== 'archive' ? 'archived-row' : ''}>
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
                    <td className="cell-progress">
                      <div className="cell-progress-row">
                        <StatusBadge quote={q} canEdit={canManage} onUpdate={(id, s) => run(setQuoteStatus(id, s))} />
                        <ContractCell
                          quote={q}
                          contract={contract}
                          canContracts={canContracts}
                          onGenerate={(id) => run(generateContract(id))}
                          onStatus={(id, s) => run(setContractStatus(id, s))}
                        />
                        {confirmed && (
                          <button
                            className={'btn-checklist' + (clTotal > 0 && done === clTotal ? ' all-done' : '')}
                            onClick={() => setChecklistQuoteId(q.id)}
                          >
                            ✓{clTotal ? ` ${done}/${clTotal}` : ` ${qt.prepBtn}`}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="cell-notes">
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
                    <td className="cell-actions">
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
