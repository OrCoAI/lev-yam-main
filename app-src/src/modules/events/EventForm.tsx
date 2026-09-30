// The one form for a "What's happening" item. Owns its field state so
// keystrokes don't re-render the list; remounted via key on edit.
//
// The Hebrew and Arabic fields sit side by side on desktop and stack on a phone.
// Publishing is checked here only to say *what* is missing before the round
// trip — events_public_bilingual (58_events_public.sql) is the actual gate.
import { useState } from 'react'
import { type Lang } from '../../lib/i18n'
import DateField from '../finance/DateField'
import { jerusalemDate } from '../pos/logic'
import { insertItem, rebuildNote, removeImages, translateToArabic, updateItem, uploadImage } from './api'
import { friendlyError, useET } from './i18n'
import PhotosField, { photosFromPaths, type Photo } from './PhotosField'
import { hhmm } from './format'
import type { EventItem, EventPayload } from './types'

interface Props {
  initial: EventItem | null
  /** called after a successful save; `note` is what the site rebuild answered, for the list to show */
  onDone: (note: string | null) => void
  onCancel: () => void
}

/** Where the Arabic stands: typed by a person, drafted by the translate button,
 *  or drafted and then confirmed. Only 'machine' blocks publishing (ADR 0055). */
type ArState = 'human' | 'machine' | 'checked'

/** events_slug_format (58_events_public.sql) */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

// A URL slug as it is typed: lower case, spaces become hyphens.
function SlugInput({ label, hint, value, onChange }: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        dir="ltr"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
      />
      <span className="field-hint muted">{hint}</span>
    </label>
  )
}

export default function EventForm({ initial, onDone, onCancel }: Props) {
  const et = useET()
  const [recurring, setRecurring] = useState(Boolean(initial?.recur_weekdays?.length))
  const [date, setDate] = useState(initial?.event_date ?? jerusalemDate())
  const [weekdays, setWeekdays] = useState<number[]>(initial?.recur_weekdays ?? [])
  const [until, setUntil] = useState(initial?.recur_until ?? '')
  const [startsAt, setStartsAt] = useState(hhmm(initial?.starts_at ?? null))
  const [endsAt, setEndsAt] = useState(hhmm(initial?.ends_at ?? null))
  const [text, setText] = useState({
    title_he: initial?.title_he ?? '',
    title_ar: initial?.title_ar ?? '',
    summary_he: initial?.summary_he ?? '',
    summary_ar: initial?.summary_ar ?? '',
    body_he: initial?.body_he ?? '',
    body_ar: initial?.body_ar ?? '',
    audience_he: initial?.audience_he ?? '',
    audience_ar: initial?.audience_ar ?? '',
    bring_he: initial?.bring_he ?? '',
    bring_ar: initial?.bring_ar ?? '',
    cost_he: initial?.cost_he ?? '',
    cost_ar: initial?.cost_ar ?? '',
  })
  const [booking, setBooking] = useState(initial?.booking_required ?? false)
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [publish, setPublish] = useState(initial ? initial.visibility === 'public' : false)
  const [photos, setPhotos] = useState<Photo[]>(() => photosFromPaths(initial?.image_paths ?? []))
  const [arState, setArState] = useState<ArState>(initial?.ar_machine_translated ? 'machine' : 'human')
  const arMachine = arState !== 'human' // the draft marks (outline, pill) stay until a person edits
  // what is in flight, if anything — both disable the buttons
  const [pending, setPending] = useState<null | 'translate' | 'save'>(null)
  // The form's own checks run on every render, so the message they produce
  // goes away the moment the owner fixes what it named. They only show once
  // a save has been tried, so a fresh form does not open with a red box.
  const [attempted, setAttempted] = useState(false)
  // An error the server (or the upload) answered, with the form as it was at
  // that moment: it describes that attempt, so any later edit clears it.
  // Raw, translated at render (as in EventsModule) so a language switch re-words it.
  const [serverError, setServerError] = useState<{ err: unknown; at: string } | null>(null)

  const set = (k: keyof typeof text) => (v: string) => {
    setText((t) => ({ ...t, [k]: v }))
    // a person editing the Arabic has read it (owner's rule, ADR 0055)
    if (k.endsWith('_ar')) setArState('human')
  }

  // everything the owner can change — a server error is shown while this still
  // matches what it was answered for. Every field added to the form goes here too.
  const fingerprint = JSON.stringify([
    recurring, date, weekdays, until, startsAt, endsAt, text, booking, slug, publish, arState,
    photos.map((p) => p.key),
  ])
  const fail = (err: unknown) => setServerError({ err, at: fingerprint })

  async function translate() {
    const hasArabic = [
      text.title_ar, text.summary_ar, text.body_ar, text.audience_ar, text.bring_ar, text.cost_ar,
    ].some((v) => v.trim())
    if (hasArabic && !window.confirm(et.confirmOverwrite)) return
    setPending('translate')
    setServerError(null)
    try {
      const ar = await translateToArabic({
        title: text.title_he,
        summary: text.summary_he,
        body: text.body_he,
        audience: text.audience_he,
        bring: text.bring_he,
        cost: text.cost_he,
      })
      setText((t) => ({
        ...t,
        title_ar: ar.title ?? t.title_ar,
        summary_ar: ar.summary ?? t.summary_ar,
        body_ar: ar.body ?? t.body_ar,
        audience_ar: ar.audience ?? t.audience_ar,
        bring_ar: ar.bring ?? t.bring_ar,
        cost_ar: ar.cost ?? t.cost_ar,
      }))
      setArState('machine')
    } catch (e) {
      // 'forbidden' here means "may not translate", not "not saved"
      fail(e instanceof Error && e.message === 'forbidden' ? new Error('translate_forbidden') : e)
    }
    setPending(null)
  }
  function toggleDay(d: number) {
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))
  }

  /** What publishing still needs, in the owner's words — empty when complete. */
  function missingForPublish(): string[] {
    const missing: string[] = []
    const need = (v: string, label: string) => {
      if (!v.trim()) missing.push(label)
    }
    need(text.title_he, `${et.fTitle} (${et.hebrew})`)
    need(text.title_ar, `${et.fTitle} (${et.arabic})`)
    need(text.summary_he, `${et.fSummary} (${et.hebrew})`)
    need(text.summary_ar, `${et.fSummary} (${et.arabic})`)
    need(text.body_he, `${et.fBody} (${et.hebrew})`)
    need(text.body_ar, `${et.fBody} (${et.arabic})`)
    need(slug, et.slug)
    return missing
  }

  /** The first thing the DB would refuse, in the owner's words — null when the
   *  form would save. Mirrors 58_events_public.sql's checks; the DB is the gate. */
  function problem(): string | null {
    if (!date) return et.errDate
    if (recurring && weekdays.length === 0) return et.errWeekdays
    if (recurring && until && until < date) return et.errRecurrence
    if (slug && !SLUG_RE.test(slug)) return et.errSlugFormat
    if (publish) {
      const missing = missingForPublish()
      if (missing.length) return `${et.errMissing} ${missing.join(' · ')}`
      if (arState === 'machine') return et.errReviewArabic
      // events_public_optional_bilingual (59): a shown line exists in both languages
      const half = (he: string, ar: string) => Boolean(he.trim()) !== Boolean(ar.trim())
      if (
        half(text.audience_he, text.audience_ar) ||
        half(text.bring_he, text.bring_ar) ||
        half(text.cost_he, text.cost_ar)
      ) {
        return et.errOptionalBilingual
      }
    }
    return null
  }
  const live = problem()
  // the live problem, else the server's answer while the form is still the one it answered
  const shownError: string | null =
    (attempted && live) || (serverError?.at === fingerprint ? friendlyError(et, serverError.err) : null)

  async function submit() {
    setAttempted(true)
    if (live) return

    setPending('save')
    setServerError(null)
    const id = initial?.id ?? crypto.randomUUID()
    let uploaded: string[] = []
    try {
      // new photos upload in parallel; the result keeps the order the owner arranged
      const settled = await Promise.allSettled(
        photos.map((p) => (p.path ? Promise.resolve(p.path) : uploadImage(id, p.file!))),
      )
      uploaded = settled.flatMap((r, i) =>
        r.status === 'fulfilled' && !photos[i].path ? [r.value] : [],
      )
      const failed = settled.find((r) => r.status === 'rejected')
      if (failed) throw failed.reason
      const image_paths = settled.map((r) => (r as PromiseFulfilledResult<string>).value)
      const payload: EventPayload = {
        // the internal calendar title — Hebrew first, never empty (NOT NULL)
        title: text.title_he.trim() || text.title_ar.trim() || slug.trim() || '—',
        event_date: date,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
        visibility: publish ? 'public' : 'internal',
        slug: slug.trim() || null,
        title_he: text.title_he.trim(),
        title_ar: text.title_ar.trim(),
        summary_he: text.summary_he.trim(),
        summary_ar: text.summary_ar.trim(),
        body_he: text.body_he.trim(),
        body_ar: text.body_ar.trim(),
        image_paths,
        recur_weekdays: recurring ? weekdays : null,
        recur_until: recurring && until ? until : null,
        audience_he: text.audience_he.trim(),
        audience_ar: text.audience_ar.trim(),
        bring_he: text.bring_he.trim(),
        bring_ar: text.bring_ar.trim(),
        cost_he: text.cost_he.trim(),
        cost_ar: text.cost_ar.trim(),
        booking_required: booking,
        ar_machine_translated: arState === 'machine',
      }
      if (initial) await updateItem(id, payload)
      else await insertItem(id, payload)
      uploaded = [] // the row references them now — never roll these back
      // photos the owner removed are no longer referenced by the row
      await removeImages((initial?.image_paths ?? []).filter((p) => !image_paths.includes(p)))
      // The landing pages are static (ADR 0056): a save that changes what the
      // public sees — publishing, unpublishing, or editing a public item — asks
      // the site to rebuild. A draft edit changes nothing public and asks nothing.
      const wasPublic = initial?.visibility === 'public'
      onDone(publish || wasPublic ? await rebuildNote(et) : null)
    } catch (e) {
      // the row never took the new photos — don't leave them orphaned in a public bucket
      await removeImages(uploaded)
      fail(e)
      setPending(null)
    }
  }

  // DOM order is the phone order — all Hebrew, the translate bar, all Arabic
  // (write, translate, review) — so keyboard and screen-reader order match the
  // screen. On desktop, grid placement (events.css: .ev-he/.ev-ar + .ev-rN)
  // puts each Arabic box level with its Hebrew twin. Everything that comes and
  // goes (the translate state, the "I checked" tick) lives in the fixed bar,
  // never between the boxes.
  const FIELDS = [
    { key: 'title', label: et.fTitle, hint: '', rows: 0, max: 120 },
    { key: 'summary', label: et.fSummary, hint: et.fSummaryHint, rows: 2, max: 240 },
    { key: 'body', label: et.fBody, hint: et.fBodyHint, rows: 7, max: undefined },
    // the landing page's optional lines (59, 60): shown only when filled, in both languages
    { key: 'audience', label: et.fAudience, hint: et.fAudienceHint, rows: 0, max: 160 },
    { key: 'bring', label: et.fBring, hint: et.fBringHint, rows: 0, max: 200 },
    { key: 'cost', label: et.fCost, hint: et.fCostHint, rows: 0, max: 120 },
  ] as const

  function box(field: (typeof FIELDS)[number], lang: Lang, i: number) {
    const k = `${field.key}_${lang}` as keyof typeof text
    const common = {
      value: text[k],
      maxLength: field.max,
      lang,
      dir: 'rtl' as const,
      className: lang === 'ar' && arMachine ? 'ev-machine-box' : undefined,
      // typing into the Arabic while Google answers would be overwritten by the reply
      readOnly: lang === 'ar' && pending === 'translate',
      onChange: (e: { target: { value: string } }) => set(k)(e.target.value),
    }
    return (
      <label className={`field ev-${lang} ev-r${i + 1}`} key={`${field.key}-${lang}`}>
        <span className="field-label">
          {field.label}
          {field.hint && <span className="ev-label-hint"> — {field.hint}</span>}
        </span>
        {field.rows ? <textarea rows={field.rows} {...common} /> : <input type="text" {...common} />}
      </label>
    )
  }

  const bilingual = (
    <div className="ev-bi">
      <div className="ev-bi-lang ev-he ev-r0">{et.hebrew}</div>
      {FIELDS.map((f, i) => box(f, 'he', i))}
      <div className="ev-bi-lang ev-bi-ar ev-ar ev-r0">
        <span className="ev-bi-name">{et.arabic}</span>
        <div className="ev-bi-actions">
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={pending !== null}
            onClick={() => void translate()}
          >
            {pending === 'translate' ? et.translating : `⇄ ${et.translate}`}
          </button>
          {/* always laid out, only shown — its arrival must not move the boxes */}
          <label
            className="ev-machine"
            title={et.machineNote}
            style={{ visibility: arMachine ? 'visible' : 'hidden' }}
            aria-hidden={!arMachine}
          >
            <input
              type="checkbox"
              checked={arState === 'checked'}
              tabIndex={arMachine ? 0 : -1}
              onChange={(e) => setArState(e.target.checked ? 'checked' : 'machine')}
            />
            <span>{et.arabicChecked}</span>
          </label>
        </div>
      </div>
      {FIELDS.map((f, i) => box(f, 'ar', i))}
      <p className="field-hint muted ev-bi-hint">
        {arMachine ? et.machineNote : '\u00a0'}
      </p>
    </div>
  )

  return (
    <div className="card ev-form">
      <h2 className="section-title">{initial ? et.formEdit : et.formNew}</h2>

      {/* Frozen while a save or translation is in flight: the request carries
          the form as it was at the click, so an edit made meanwhile would be
          lost on success and would hide the answer on failure (fingerprint). */}
      <fieldset className="ev-fields" disabled={pending !== null}>
      {/* four titled sections: tight inside, a clear gap + divider between */}
      <section className="ev-sec">
        <h3 className="ev-sec-title">{et.secWhen}</h3>
        <div className="seg seg-2" role="group" aria-label={et.kind}>
          <button
            type="button"
            className={`seg-btn${!recurring ? ' on' : ''}`}
            aria-pressed={!recurring}
            onClick={() => setRecurring(false)}
          >
            {et.kindDated}
          </button>
          <button
            type="button"
            className={`seg-btn${recurring ? ' on' : ''}`}
            aria-pressed={recurring}
            onClick={() => setRecurring(true)}
          >
            {et.kindRecurring}
          </button>
        </div>

        {recurring && (
          <div className="field">
            <span className="field-label">{et.weekdays}</span>
            <div className="chips ev-days">
              {et.weekdayShort.map((label, d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip${weekdays.includes(d) ? ' on' : ''}`}
                  aria-pressed={weekdays.includes(d)}
                  onClick={() => toggleDay(d)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span className="field-label">{recurring ? et.startsFrom : et.date}</span>
            <DateField value={date} onChange={setDate} />
          </label>
          {recurring ? (
            <div className="field">
              <span className="field-label">{et.untilOptional}</span>
              {/* the clear ✕ sits inside the box, so "until" is as wide as "from" */}
              <div className="ev-date-clear">
                <DateField value={until} onChange={setUntil} />
                {until && (
                  <button
                    type="button"
                    className="ev-x ev-clear-x"
                    aria-label={et.clearDateLabel}
                    title={et.clearDateLabel}
                    onClick={() => setUntil('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ) : (
            <span />
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field-label">{et.startsAt}</span>
            <input type="time" dir="ltr" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">{et.endsAt}</span>
            <input type="time" dir="ltr" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>

      </section>

      <section className="ev-sec">
        <h3 className="ev-sec-title">{et.secText}</h3>
        {bilingual}
        {/* the cost tile's second line: a flag, worded by the page in each language */}
        <div className="field">
          <span className="field-label">{et.fBooking}</span>
          <div className="seg seg-2" role="group" aria-label={et.fBooking}>
            <button type="button" className={`seg-btn${!booking ? ' on' : ''}`} aria-pressed={!booking} onClick={() => setBooking(false)}>
              {et.bookingNone}
            </button>
            <button type="button" className={`seg-btn${booking ? ' on' : ''}`} aria-pressed={booking} onClick={() => setBooking(true)}>
              {et.bookingRequired}
            </button>
          </div>
        </div>
      </section>

      <section className="ev-sec">
        <h3 className="ev-sec-title">{et.secLink}</h3>
        <SlugInput label={et.slug} hint={et.slugHint} value={slug} onChange={setSlug} />
      </section>

      <section className="ev-sec">
        <h3 className="ev-sec-title">{et.secPhotos}</h3>
        <PhotosField photos={photos} onChange={setPhotos} />
      </section>

      <section className="ev-sec">
        <label className="ev-publish">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          <span>
            <strong>{et.published}</strong>
            <span className="field-hint muted"> — {et.publishedHint}</span>
          </span>
        </label>
      </section>
      </fieldset>

      <div className="ev-actions">
        {/* the live message re-words itself as fields fill — polite, not an interruption */}
        {shownError && (
          <div className="error error-box" role={attempted && live ? 'status' : 'alert'}>
            {shownError}
          </div>
        )}

        <div className="field-actions">
          <button className="btn-primary btn-block" disabled={pending !== null} onClick={() => void submit()}>
            {pending === 'save' ? et.saving : et.save}
          </button>
          <button className="btn-ghost" disabled={pending !== null} onClick={onCancel}>
            {et.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
