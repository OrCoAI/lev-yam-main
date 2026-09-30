// Row shape of events.events as the /app/events screen reads it — the public
// "What's happening" fields added by 58_events_public.sql. Quote-projected rows
// are never listed here (the screen filters source_module is null).

export type EventVisibility = 'public' | 'internal'

export interface EventItem {
  id: string
  title: string
  event_date: string // 'YYYY-MM-DD' — the date, or the first date of a recurring item
  starts_at: string | null // 'HH:MM:SS'
  ends_at: string | null
  status: string
  visibility: EventVisibility
  slug: string | null
  title_he: string
  title_ar: string
  summary_he: string
  summary_ar: string
  body_he: string
  body_ar: string
  /** the gallery in display order — [0] is the cover; at most 8 (events_image_paths_valid) */
  image_paths: string[]
  /** 0 = Sunday … 6 = Saturday; null = a dated item */
  recur_weekdays: number[] | null
  recur_until: string | null
  /** the landing page's optional lines (59_events_landing.sql): who it is for, what to
   *  bring / where to meet. A public row fills each in both languages or in neither. */
  audience_he: string
  audience_ar: string
  bring_he: string
  bring_ar: string
  /** the cost line (60_events_cost.sql), optional and bilingual the same way; the flag
   *  renders as one fixed line per language on the page */
  cost_he: string
  cost_ar: string
  booking_required: boolean
  /** the Arabic is an unconfirmed machine draft — the DB refuses to publish it (ADR 0055) */
  ar_machine_translated: boolean
  /** read-only, computed by events.next_date() — the same live rule as the public feed;
   *  null once the item is over */
  next_date: string | null
  updated_at: string
}

/** What the form writes. `title` is the internal calendar title (the Hebrew one). */
export type EventPayload = Omit<EventItem, 'id' | 'status' | 'updated_at' | 'next_date'>
