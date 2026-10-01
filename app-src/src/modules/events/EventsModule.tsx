// /app/events — publish what is happening at Lev Yam to levyam.com/happening/.
// Plan: docs/plans/events-whats-happening.md. The list is ordered the way the
// public page reads: live items by their next date, then drafts, then ended.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { useCan, PERM } from '../../lib/permissions'
import { useRowDisclosure } from '../../lib/useRowDisclosure'
import { shortDate } from '../finance/format'
import { jerusalemDate } from '../pos/logic'
import { PASSED_PAGE_DAYS, deleteItem, landingPath, listItems, rebuildNote, updateItem } from './api'
import EventForm from './EventForm'
import { timeRange } from './format'
import { friendlyError, useET, type EventsDict } from './i18n'
import type { EventItem } from './types'
import './events.css'

type State = 'live' | 'draft' | 'ended'

interface Row {
  item: EventItem
  state: State
  /** the date the row is filed under: its next occurrence, or its own date once over */
  shown: string
}

const STATE_ORDER: Record<State, number> = { live: 0, draft: 1, ended: 2 }
const STATE_KEY = { live: 'stateLive', draft: 'stateDraft', ended: 'stateEnded' } as const

function whenText(et: EventsDict, item: EventItem): string {
  const hours = timeRange(item.starts_at, item.ends_at)
  if (!item.recur_weekdays?.length) {
    return [shortDate(item.event_date), hours].filter(Boolean).join(' · ')
  }
  const days = item.recur_weekdays.map((d) => et.weekdayShort[d]).join(', ')
  const until = item.recur_until ? `${et.until} ${shortDate(item.recur_until)}` : ''
  return [`${et.every} ${days}`, hours, until].filter(Boolean).join(' · ')
}

/** The item's public page: a link while a page exists (live, or over for less than
 *  PASSED_PAGE_DAYS — the "this one has passed" page), plain text otherwise. */
function LandingLink({ path, live }: { path: string; live: boolean }) {
  return live ? (
    <a href={path} target="_blank" rel="noopener" className="ev-slug" dir="ltr">
      {path}
    </a>
  ) : (
    <bdi dir="ltr" className="ev-slug">
      {path}
    </bdi>
  )
}

export default function EventsModule() {
  const et = useET()
  const { lang } = useI18n()
  // the item's own text in the screen's language, falling back to the other one
  const pick = (heText: string, arText: string) => (lang === 'ar' ? arText || heText : heText || arText)
  const canManage = useCan(PERM.eventsManage)
  const { rowProps } = useRowDisclosure()
  const [items, setItems] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  // raw error, translated at render so a language switch re-words it
  const [error, setError] = useState<unknown>(null)
  // what the site rebuild answered after the last public change — one line, until the next action
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // null = form closed; 'new' = blank form; an item = editing it
  const [editing, setEditing] = useState<EventItem | 'new' | null>(null)
  // bumping it re-reads the list; `loading` only covers the first fetch, so a
  // reload keeps the list on screen
  const [epoch, setEpoch] = useState(0)
  const reload = useCallback(() => setEpoch((n) => n + 1), [])

  useEffect(() => {
    let live = true
    listItems()
      .then((rows) => {
        if (!live) return
        setItems(rows)
        setError(null)
      })
      .catch((e: unknown) => live && setError(e))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [epoch])

  // next_date comes from events.next_date() — the feed's own rule, so "on the
  // site" here means exactly what levyam.com shows
  const rows: Row[] = useMemo(
    () =>
      items
        .map((item) => {
          const next = item.next_date
          const state: State = !next ? 'ended' : item.visibility === 'public' ? 'live' : 'draft'
          // an ended item is filed under its last day (a recurring one's end date)
          const shown = next ?? item.recur_until ?? item.event_date
          return { item, state, shown }
        })
        .sort(
          (a, b) =>
            STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
            // upcoming soonest first; ended most recent first
            (a.state === 'ended' ? b.shown.localeCompare(a.shown) : a.shown.localeCompare(b.shown)),
        ),
    [items],
  )

  // while the form is open, a list action on the same item would be undone by
  // the form's save (it writes the visibility it loaded), so the list waits
  const rowLocked = busy || editing !== null

  // `rebuild`: the action changed what the public sees, so the static site is
  // asked to rebuild afterwards (ADR 0056); the answer is shown as a note
  async function run(fn: () => Promise<void>, rebuild = false) {
    setBusy(true)
    setNote(null)
    try {
      await fn()
      setError(null)
      if (rebuild) setNote(await rebuildNote(et))
      reload()
    } catch (e) {
      setError(e)
    }
    setBusy(false)
  }

  function togglePublish(item: EventItem) {
    void run(
      () => updateItem(item.id, { visibility: item.visibility === 'public' ? 'internal' : 'public' }),
      true,
    )
  }

  function remove(item: EventItem) {
    if (!window.confirm(et.confirmDelete)) return
    void run(() => deleteItem(item), item.visibility === 'public')
  }

  return (
    <section>
      <h1 className="page-title">{et.title}</h1>
      <p className="notice">{et.intro}</p>
      {!canManage && <p className="notice">{et.viewOnly}</p>}

      {canManage && editing === null && (
        <button className="btn-primary form-open-btn ev-add" onClick={() => setEditing('new')}>
          + {et.add}
        </button>
      )}
      {canManage && editing !== null && (
        <EventForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onDone={(saved) => {
            setEditing(null)
            setNote(saved)
            reload()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {error != null && (
        <div className="error">
          {et.errorPrefix} {friendlyError(et, error)}
        </div>
      )}
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}

      {loading ? (
        <div className="muted">{et.loading}</div>
      ) : (
        <div className="card rowline">
          <table className="grid">
            <thead>
              <tr>
                <th>{et.colWhen}</th>
                <th>{et.colItem}</th>
                <th>{et.colState}</th>
                <th>{et.colSummary}</th>
                <th>{et.colLink}</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, state, shown }) => (
                // ev-${state} / badge ev-badge-${state}: live · draft · ended (built, not literal)
                <tr key={item.id} {...rowProps(item.id)} className={`ev-row ev-${state}`}>
                  <td className="rl-lead">{shortDate(shown)}</td>
                  <td className="rl-main">
                    <div className="ev-title">{pick(item.title_he, item.title_ar) || item.title}</div>
                    <div className="ev-when muted">{whenText(et, item)}</div>
                  </td>
                  <td className="rl-tail">
                    <span className={`badge ev-badge-${state}`}>{et[STATE_KEY[state]]}</span>
                    {item.ar_machine_translated && (
                      <span className="badge ev-badge-machine">{et.machineBadge}</span>
                    )}
                  </td>
                  <td className="rl-more" data-label={et.colSummary}>
                    {pick(item.summary_he, item.summary_ar)}
                  </td>
                  <td className="rl-more" data-label={et.colLink}>
                    {item.slug && (
                      <LandingLink
                        path={landingPath(item.slug, lang)}
                        live={
                          state === 'live' ||
                          (state === 'ended' &&
                            (Date.parse(jerusalemDate()) - Date.parse(shown)) / 86_400_000 <= PASSED_PAGE_DAYS)
                        }
                      />
                    )}
                  </td>
                  {canManage && (
                    <td className="rl-actions">
                      <button
                        className="btn-ghost btn-sm"
                        disabled={rowLocked}
                        onClick={() => {
                          setEditing(item)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        {et.edit}
                      </button>
                      {state !== 'ended' && (
                        <button
                          className="btn-ghost btn-sm"
                          disabled={rowLocked}
                          onClick={() => togglePublish(item)}
                        >
                          {item.visibility === 'public' ? et.unpublish : et.publish}
                        </button>
                      )}
                      <button className="btn-ghost btn-sm" disabled={rowLocked} onClick={() => remove(item)}>
                        {et.delete}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="muted">
                    {et.none}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
