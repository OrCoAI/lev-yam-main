import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { PERM, useCan } from '../../lib/permissions'
import {
  autoExpire,
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
import { eventDayChip, formatDate, ILS, todayDbDate } from './format'
import { useQT } from './i18n'
import NewQuoteModal from './NewQuoteModal'
import SettingsModal from './SettingsModal'
import type { ChecklistItem, ContractRow, QuoteRow, QuoteStatus } from './types'
import { isConfirmed, isWaitingPayment } from './types'
import './quotes.css'

const STATUSES: QuoteStatus[] = ['draft', 'sent', 'approved', 'declined', 'expired', 'paid']
type ViewMode = 'live' | 'happy' | 'archive' | 'all'
/** 'waiting_payment' is a derived filter (confirmed + event date passed + not paid),
 *  not a real quotes.status value — see isWaitingPayment. */
type StatusFilter = 'all' | QuoteStatus | 'waiting_payment'

/* ── small inline icons (stroke = currentColor, work in both directions) ── */
const IcCal = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4.5" width="14" height="12" rx="2" />
    <path d="M3 8.5h14M7 2.5v3.5M13 2.5v3.5" />
  </svg>
)
const IcGear = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="10" r="2.6" />
    <path d="M10 3.2v2M10 14.8v2M3.2 10h2M14.8 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M14.8 5.2l-1.4 1.4M6.6 13.4l-1.4 1.4" />
  </svg>
)
const IcDoc = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5.5 2.5h6L15 6v11.5h-9.5z" />
    <path d="M11.5 2.5V6H15" />
  </svg>
)
const IcArchive = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3.5" width="14" height="4" rx="1" />
    <path d="M4.5 7.5V15a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7.5M8 10.8h4" />
  </svg>
)
const IcRestore = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.5 8.5 3.5 11l3 2.5" />
    <path d="M3.5 11h8a4.5 4.5 0 1 0-1-8.9" />
  </svg>
)
const IcTrash = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.3 8.5v5M11.7 8.5v5" />
  </svg>
)
const Caret = () => (
  <svg className="q-caret" width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 3.5 5 6.5 8 3.5" />
  </svg>
)

interface MenuOption {
  key: string
  label: string
  /** which data attribute drives the pill tint (quote vs contract palette) */
  attr: 'data-s' | 'data-cs'
}

/** Status picker: the same tinted pills as in the table, laid out as a small
 *  floating palette. Rendered in a portal on document.body so no ancestor can
 *  clip or reposition it; on touch widths it becomes a bottom sheet. */
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
  anchorRef: React.RefObject<HTMLElement | null>
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
    const panelW = Math.min(320, window.innerWidth - 16)
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
    <div className="q-pop-chips">
      {options.map((o) => (
        <button
          key={o.key}
          className="q-pill"
          {...{ [o.attr]: o.key }}
          onClick={() => {
            onPick(o.key)
            onClose()
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )

  if (isSheet) {
    return createPortal(
      <div className="q-sheet-backdrop" onClick={onClose}>
        <div className="q-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="q-sheet-handle" />
          <div className="q-sheet-title">{title}</div>
          {chips}
        </div>
      </div>,
      document.body,
    )
  }

  if (!pos) return null
  return createPortal(
    <div ref={panelRef} className="q-pop" style={{ top: pos.top, left: pos.left }}>
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
    <span ref={ref} className="q-badge-anchor">
      <button className="q-pill" data-s={quote.status} disabled={!canEdit} onClick={() => setOpen(!open)}>
        {qt.status[quote.status]}
        {canEdit && <Caret />}
      </button>
      <StatusMenu
        open={open}
        title={qt.thProgress}
        anchorRef={ref}
        options={STATUSES.filter((s) => s !== quote.status).map((s) => ({
          key: s,
          label: qt.status[s],
          attr: 'data-s',
        }))}
        onPick={(s) => onUpdate(quote.id, s as QuoteStatus)}
        onClose={() => setOpen(false)}
      />
    </span>
  )
}

/** Contract chip: opens the contract document; status changes live there. */
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
        <button className="q-chip q-chip-new" onClick={() => onGenerate(quote.id)}>
          <IcDoc /> {qt.createContract}
        </button>
      )
    }
    return null
  }

  return (
    <Link
      to={`/quotes/${quote.id}/contract`}
      className="q-chip"
      data-cs={contract.status}
      title={contract.contract_number}
      onClick={(e) => e.stopPropagation()}
    >
      <IcDoc />
      {qt.contractWord} · {qt.contractStatus[contract.status]}
    </Link>
  )
}

export default function QuotesModule() {
  const qt = useQT()
  const navigate = useNavigate()
  const canManage = useCan(PERM.quotesManage)
  const canContracts = useCan(PERM.quotesContracts)
  const canSettings = useCan(PERM.quotesSettings)

  const [data, setData] = useState<AllData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: 'date' | 'price'; dir: 1 | -1 } | null>(null)
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
  useEffect(() => {
    // sweep once per mount, then fetch — not on every reload/mutation
    void autoExpire().then(load)
  }, [load])

  // Mutations patch the affected row locally instead of refetching the whole
  // board — the write either succeeded with exactly this value or threw
  // (api.ts asserts the affected-row count).
  const run = (p: Promise<unknown>, patch: (d: AllData) => AllData) =>
    p.then(() => setData((d) => (d ? patch(d) : d))).catch((e: Error) => alert(e.message))
  const patchQuote =
    (id: string, p: Partial<QuoteRow>) =>
    (d: AllData): AllData => ({ ...d, quotes: d.quotes.map((q) => (q.id === id ? { ...q, ...p } : q)) })

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

  const searchQ = search.trim().toLowerCase()
  const searchedQuotes = searchQ
    ? quotesForView.filter((q) =>
        [q.customer_name, q.contact_person, q.phone, q.email, q.quote_number].some((v) => v.toLowerCase().includes(searchQ)),
      )
    : quotesForView

  // computed once per quote, then reused for the count, the filter and the row tint
  const waitingIds = new Set(
    searchedQuotes.filter((q) => isWaitingPayment(q, contractsByQuoteId[q.id])).map((q) => q.id),
  )

  // one grouping pass instead of a separate .filter() per status — counts and
  // statusFiltered both read from the same buckets rather than re-scanning
  const byStatus = new Map<QuoteStatus, QuoteRow[]>()
  for (const qu of searchedQuotes) {
    const bucket = byStatus.get(qu.status)
    if (bucket) bucket.push(qu)
    else byStatus.set(qu.status, [qu])
  }

  const counts: Record<string, number> = { all: searchedQuotes.length, waiting_payment: waitingIds.size }
  for (const s of STATUSES) counts[s] = byStatus.get(s)?.length ?? 0
  const statusFiltered =
    filter === 'all'
      ? searchedQuotes
      : filter === 'waiting_payment'
        ? searchedQuotes.filter((q) => waitingIds.has(q.id))
        : (byStatus.get(filter) ?? [])

  const filtered = sort
    ? [...statusFiltered].sort((a, b) => {
        if (sort.key === 'date') return sort.dir * (a.event_date ?? '').localeCompare(b.event_date ?? '')
        const av = a.final_price ?? a.subtotal ?? 0
        const bv = b.final_price ?? b.subtotal ?? 0
        return sort.dir * (av - bv)
      })
    : statusFiltered

  const toggleSort = (key: 'date' | 'price') =>
    setSort((cur) => (cur?.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: 1 }))
  const sortArrow = (key: 'date' | 'price') => (sort?.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '')

  const revenueStatus: QuoteStatus = viewMode === 'happy' ? 'paid' : 'approved'
  const revenueTotal = quotesForView
    .filter((q) => q.status === revenueStatus)
    .reduce((sum, q) => sum + (q.final_price ?? q.subtotal ?? 0), 0)

  const segments: { key: ViewMode; label: string; n?: number }[] = [
    { key: 'live', label: qt.segLive, n: liveQuotes.length },
    { key: 'happy', label: qt.segHappy, n: happyQuotes.length },
    { key: 'archive', label: qt.segArchive, n: archivedQuotes.length },
    { key: 'all', label: qt.segAll },
  ]

  // statuses (+ the derived "waiting for payment" filter) that can actually appear
  // in the current view — the filter row stays short and meaningful instead of
  // listing the whole vocabulary; one array drives one render loop below.
  const filterStatuses =
    viewMode === 'live' ? STATUSES.filter((s) => s !== 'paid') : viewMode === 'happy' ? [] : STATUSES
  const filterChips: { key: StatusFilter; label: string }[] =
    filterStatuses.length > 0
      ? [...filterStatuses.map((s) => ({ key: s as StatusFilter, label: qt.status[s] })), { key: 'waiting_payment', label: qt.waitingPayment }]
      : []

  const todayChip = `${qt.dayPrefix} ${qt.dow[new Date().getDay()]} · ${formatDate(todayDbDate())}`

  const checklistQuote = checklistQuoteId ? allQuotes.find((q) => q.id === checklistQuoteId) : null

  const filterLabel = filter === 'waiting_payment' ? qt.waitingPayment : filter !== 'all' ? qt.status[filter] : null
  const emptyText = searchQ
    ? qt.emptySearch
    : viewMode === 'archive'
      ? qt.emptyArchive
      : viewMode === 'happy'
        ? qt.emptyHappy
        : `${qt.emptyLive}${filterLabel ? ` ${qt.emptyInStatus} ${filterLabel}` : ''}`

  return (
    <div className="qdash">
      <header className="q-head">
        <div>
          <h1 className="q-title">{qt.title}</h1>
          <div className="q-date">{todayChip}</div>
        </div>
        <div className="q-head-actions">
          <button className={'q-btn' + (showCal ? ' on' : '')} onClick={() => setShowCal(!showCal)}>
            <IcCal />
            <span>{qt.calendarBtn}</span>
          </button>
          {canSettings && (
            <button className="q-btn q-btn-icon" title={qt.settingsTitle} onClick={() => setShowSettings(true)}>
              <IcGear />
            </button>
          )}
          {canManage && (
            <button className="btn-primary q-btn-new" onClick={() => setShowNew(true)}>
              {qt.newQuote}
            </button>
          )}
        </div>
      </header>

      <div className="q-toolbar">
        <div className="q-seg" role="tablist">
          {segments.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={viewMode === m.key}
              className={'q-seg-btn' + (viewMode === m.key ? ' on' : '')}
              onClick={() => {
                setViewMode(m.key)
                setFilter('all')
              }}
            >
              {m.label}
              {m.n != null && m.n > 0 && <span className="q-seg-n">{m.n}</span>}
            </button>
          ))}
        </div>
        {revenueTotal > 0 && (
          <div className="q-kpi">
            <span className="q-kpi-label">{viewMode === 'happy' ? qt.revenuePaid : qt.revenueApproved}</span>
            <span className="q-kpi-val">{ILS(revenueTotal)}</span>
          </div>
        )}
      </div>

      <div className="q-search">
        <input
          type="search"
          className="q-search-input"
          placeholder={qt.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filterChips.length > 0 && (
        <div className="q-filters">
          <button className={'q-filter' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>
            {qt.segAll}
            <span className="q-count">{counts.all}</span>
          </button>
          {filterChips.map((c) => (
            <button
              key={c.key}
              className={'q-filter' + (filter === c.key ? ' on' : '')}
              data-s={c.key}
              disabled={counts[c.key] === 0 && filter !== c.key}
              onClick={() => setFilter(filter === c.key ? 'all' : c.key)}
            >
              <span className="s-dot" data-s={c.key} />
              {c.label}
              <span className="q-count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
      )}

      {showCal && (
        <Calendar quotes={activeQuotes} contractsByQuoteId={contractsByQuoteId} onOpenChecklist={(q) => setChecklistQuoteId(q.id)} />
      )}

      {filtered.length === 0 ? (
        <div className="q-empty">
          <img src="/app/brand/halfcircle-blue.png" alt="" />
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="q-tablecard">
          <table className="q-table">
            <thead>
              <tr>
                <th className="q-th-customer">{qt.thCustomer}</th>
                <th className="q-th-center q-th-sortable" onClick={() => toggleSort('date')}>
                  {qt.thEvent}
                  {sortArrow('date')}
                </th>
                <th className="q-th-price q-th-center q-th-sortable" onClick={() => toggleSort('price')}>
                  {qt.thPrice}
                  {sortArrow('price')}
                </th>
                <th className="q-th-center">{qt.thProgress}</th>
                <th className="q-th-center">{qt.thDocs}</th>
                <th className="q-th-notes">{qt.thNotes}</th>
                <th className="q-th-center" aria-hidden="true"></th>
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
                const showStrike =
                  (q.discount_pct ?? 0) > 0 && subtotal > 0 && q.final_price != null && subtotal !== q.final_price
                // same tweaks read as contractDataFromQuote — a quote saved with
                // the VAT toggle off must not claim its total includes VAT
                const withVat =
                  (q.content as { tweaks?: { showVat?: boolean } } | null)?.tweaks?.showVat !== false
                const showVat = q.final_price != null && q.final_price > 0 && withVat
                const done = q.prep_checklist.filter((it) => it.done).length
                const clTotal = q.prep_checklist.length
                const waiting = waitingIds.has(q.id)
                return (
                  <tr
                    key={q.id}
                    className={
                      'q-row' +
                      (q.archived && viewMode !== 'archive' ? ' q-row-archived' : '') +
                      (waiting ? ' q-row-waiting' : '')
                    }
                    onClick={() => navigate(`/quotes/${q.id}`)}
                  >
                    <td className="q-cell-customer">
                      <div className="q-main">{q.customer_name || '—'}</div>
                      <div className="q-sub">
                        {custBits.length > 0 && (
                          <>
                            {custBits.join(' · ')}
                            <span className="q-sep">·</span>
                          </>
                        )}
                        <span className="q-num">{q.quote_number}</span>
                      </div>
                    </td>
                    <td className="q-cell-event">
                      <div className="q-event-line">
                        {q.event_date ? (
                          <span className="q-date-val">{formatDate(q.event_date)}</span>
                        ) : (
                          <span className="q-date-val q-none">{qt.noDate}</span>
                        )}
                        {day && <span className={'q-day ' + day.kind}>{day.text}</span>}
                      </div>
                      {(q.event_type || q.hours) && (
                        <div className="q-sub">
                          {q.event_type}
                          {q.event_type && q.hours && <span className="q-sep">·</span>}
                          {/* bdi: the LTR time range must not get reordered by the RTL line */}
                          {q.hours && <bdi className="q-hours">{q.hours}</bdi>}
                        </div>
                      )}
                    </td>
                    <td className="q-cell-price">
                      <div className="q-main q-price">{total ? ILS(total) : '—'}</div>
                      {(showStrike || showVat) && (
                        <div className="q-sub">
                          {showStrike && <span className="q-strike">{ILS(subtotal)}</span>}
                          {showVat && <span>{qt.vatIncluded}</span>}
                        </div>
                      )}
                    </td>
                    <td className="q-cell-status" onClick={(e) => e.stopPropagation()}>
                      <StatusBadge
                        quote={q}
                        canEdit={canManage}
                        onUpdate={(id, s) => run(setQuoteStatus(id, s), patchQuote(id, { status: s }))}
                      />
                      {waiting && <span className="q-pill" data-s="waiting_payment">{qt.waitingPayment}</span>}
                    </td>
                    <td className="q-cell-docs" onClick={(e) => e.stopPropagation()}>
                      <div className="q-chip-row">
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
                            className={'q-chip q-chip-prep' + (clTotal > 0 && done === clTotal ? ' done' : '')}
                            onClick={() => setChecklistQuoteId(q.id)}
                          >
                            {qt.prepBtn}
                            <span className="q-count">{clTotal ? `${done}/${clTotal}` : '✓'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="q-cell-notes" onClick={(e) => e.stopPropagation()}>
                      <input
                        className="q-note"
                        defaultValue={q.notes}
                        placeholder={qt.notePlaceholder}
                        disabled={!canManage}
                        onBlur={(e) => {
                          if (e.target.value !== q.notes)
                            run(setQuoteNotes(q.id, e.target.value), patchQuote(q.id, { notes: e.target.value }))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                      />
                    </td>
                    <td className="q-cell-actions" onClick={(e) => e.stopPropagation()}>
                      {canManage && (
                        <span className="q-rowact">
                          <button
                            className="q-iconbtn"
                            title={q.archived ? qt.restoreTitle : qt.archiveTitle}
                            onClick={() =>
                              run(setQuoteArchived(q.id, !q.archived), patchQuote(q.id, { archived: !q.archived }))
                            }
                          >
                            {q.archived ? <IcRestore /> : <IcArchive />}
                          </button>
                          {!q.archived && (
                            <button
                              className="q-iconbtn q-iconbtn-danger"
                              title={qt.deleteTitle}
                              onClick={() => {
                                if (confirm(`${qt.deleteConfirm} ${q.quote_number}?`))
                                  run(deleteQuote(q.id), (d) => ({
                                    ...d,
                                    quotes: d.quotes.filter((x) => x.id !== q.id),
                                  }))
                              }}
                            >
                              <IcTrash />
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
          existingQuotes={activeQuotes}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            navigate(`/quotes/${id}`)
          }}
        />
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {checklistQuote && (
        <ChecklistModal
          quote={checklistQuote}
          readOnly={!canManage}
          onClose={() => setChecklistQuoteId(null)}
          onChanged={(items: ChecklistItem[]) =>
            setData((d) => (d ? patchQuote(checklistQuote.id, { prep_checklist: items })(d) : d))
          }
        />
      )}
    </div>
  )
}
