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
import { insertItem, removeImages, translateToArabic, updateItem, uploadImage } from './api'
import { friendlyError, useET } from './i18n'
import PhotosField, { photosFromPaths, type Photo } from './PhotosField'
import { hhmm } from './format'
import type { EventItem, EventPayload } from './types'

interface Props {
  initial: EventItem | null
  onDone: () => void
  onCancel: () => void
}

/** Where the Arabic stands: typed by a person, drafted by the translate button,
 *  or drafted and then confirmed. Only 'machine' blocks publishing (ADR 0055). */
type ArState = 'human' | 'machine' | 'checked'

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
  })
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [storySlug, setStorySlug] = useState(initial?.story_slug ?? '')
  const [publish, setPublish] = useState(initial ? initial.visibility === 'public' : false)
  const [photos, setPhotos] = useState<Photo[]>(() => photosFromPaths(initial?.image_paths ?? []))
  const [arState, setArState] = useState<ArState>(initial?.ar_machine_translated ? 'machine' : 'human')
  const arMachine = arState !== 'human' // the draft marks (outline, pill) stay until a person edits
  // what is in flight, if anything — both disable the buttons
  const [pending, setPending] = useState<null | 'translate' | 'save'>(null)
  // raw error, translated at render (as in EventsModule) so a language switch re-words it
  const [error, setError] = useState<unknown>(null)

  const set = (k: keyof typeof text) => (v: string) => {
    setText((t) => ({ ...t, [k]: v }))
    // a person editing the Arabic has read it (owner's rule, ADR 0055)
    if (k.endsWith('_ar')) setArState('human')
  }

  async function translate() {
    const hasArabic = [text.title_ar, text.summary_ar, text.body_ar].some((v) => v.trim())
    if (hasArabic && !window.confirm(et.confirmOverwrite)) return
    setPending('translate')
    setError(null)
    try {
      const ar = await translateToArabic({
        title: text.title_he,
        summary: text.summary_he,
        body: text.body_he,
      })
      setText((t) => ({
        ...t,
        title_ar: ar.title ?? t.title_ar,
        summary_ar: ar.summary ?? t.summary_ar,
        body_ar: ar.body ?? t.body_ar,
      }))
      setArState('machine')
    } catch (e) {
      // 'forbidden' here means "may not translate", not "not saved"
      setError(e instanceof Error && e.message === 'forbidden' ? new Error('translate_forbidden') : e)
    }
    setPending(null)
  }
  const hasStory = storySlug.trim() !== ''

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
    if (!hasStory) {
      need(text.body_he, `${et.fBody} (${et.hebrew})`)
      need(text.body_ar, `${et.fBody} (${et.arabic})`)
    }
    need(slug, et.slug)
    return missing
  }

  async function submit() {
    if (!date) return setError(et.errDate)
    if (recurring && weekdays.length === 0) return setError(et.errWeekdays)
    if (publish) {
      const missing = missingForPublish()
      if (missing.length) return setError(`${et.errMissing} ${missing.join(' · ')}`)
      if (arState === 'machine') return setError(et.errReviewArabic)
    }

    setPending('save')
    setError(null)
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
        story_slug: storySlug.trim() || null,
        recur_weekdays: recurring ? weekdays : null,
        recur_until: recurring && until ? until : null,
        ar_machine_translated: arState === 'machine',
      }
      if (initial) await updateItem(id, payload)
      else await insertItem(id, payload)
      uploaded = [] // the row references them now — never roll these back
      // photos the owner removed are no longer referenced by the row
      await removeImages((initial?.image_paths ?? []).filter((p) => !image_paths.includes(p)))
      onDone()
    } catch (e) {
      // the row never took the new photos — don't leave them orphaned in a public bucket
      await removeImages(uploaded)
      setError(e)
      setPending(null)
    }
  }

  // One row per field, Hebrew beside Arabic, so each pair stays level however
  // much is typed or translated. Everything that comes and goes (the translate
  // state, the "I checked" tick) lives in the fixed header strip, never between
  // the boxes.
  const FIELDS = [
    { key: 'title', label: et.fTitle, rows: 0, max: 120 },
    { key: 'summary', label: et.fSummary, rows: 2, max: 240 },
    { key: 'body', label: et.fBody, rows: 7, max: undefined },
  ] as const

  function box(field: (typeof FIELDS)[number], lang: Lang) {
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
      <label className="field" key={lang}>
        <span className="field-label">
          {field.label}
          <span className="ev-lang-tag"> · {lang === 'he' ? et.hebrew : et.arabic}</span>
        </span>
        {field.rows ? <textarea rows={field.rows} {...common} /> : <input type="text" {...common} />}
      </label>
    )
  }

  const bilingual = (
    <div className="ev-bi">
      <div className="ev-bi-head">
        <div className="ev-bi-lang ev-bi-he">{et.hebrew}</div>
        <div className="ev-bi-lang ev-bi-ar">
          <span className="ev-bi-name">{et.arabic}</span>
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
      {FIELDS.map((f) => (
        <div className="ev-bi-row" key={f.key}>
          {box(f, 'he')}
          {box(f, 'ar')}
        </div>
      ))}
      <p className="field-hint muted ev-bi-hint">
        {arMachine ? et.machineNote : hasStory ? `${et.fBody}: ${et.bodyOptionalWithStory}` : '\u00a0'}
      </p>
    </div>
  )

  return (
    <div className="card ev-form">
      <h2 className="section-title">{initial ? et.formEdit : et.formNew}</h2>

      <div className="seg seg-2" role="group" aria-label={et.kind}>
        <button
          type="button"
          className={`seg-btn${!recurring ? ' on' : ''}`}
          onClick={() => setRecurring(false)}
        >
          {et.kindDated}
        </button>
        <button
          type="button"
          className={`seg-btn${recurring ? ' on' : ''}`}
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
            <div className="ev-date-clear">
              <DateField value={until} onChange={setUntil} />
              {/* always laid out, only shown — so setting a date moves nothing */}
              <button
                type="button"
                className="btn-ghost btn-sm"
                style={{ visibility: until ? 'visible' : 'hidden' }}
                aria-hidden={!until}
                tabIndex={until ? 0 : -1}
                onClick={() => setUntil('')}
              >
                {et.clearDate}
              </button>
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

      {bilingual}

      <SlugInput label={et.slug} hint={et.slugHint} value={slug} onChange={setSlug} />
      <SlugInput label={et.storySlug} hint={et.storySlugHint} value={storySlug} onChange={setStorySlug} />

      <PhotosField photos={photos} onChange={setPhotos} />

      <label className="ev-publish">
        <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
        <span>
          <strong>{et.published}</strong>
          <span className="field-hint muted"> — {et.publishedHint}</span>
        </span>
      </label>

      {error != null && <div className="error">{friendlyError(et, error)}</div>}

      <div className="field-actions">
        <button className="btn-primary btn-block" disabled={pending !== null} onClick={() => void submit()}>
          {pending === 'save' ? et.saving : et.save}
        </button>
        <button className="btn-ghost" disabled={pending !== null} onClick={onCancel}>
          {et.cancel}
        </button>
      </div>
    </div>
  )
}
