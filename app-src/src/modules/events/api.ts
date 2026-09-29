// All data access for /app/events. RLS is the gate (events.manage writes,
// events.view reads); every write asserts it touched a row, because PostgREST
// answers an RLS-filtered UPDATE/DELETE with a silent 204 (MODULE-TEMPLATE §3).
import { invokeFunction, supabase } from '../../lib/supabase'
import type { EventsDict } from './i18n'
import type { EventItem, EventPayload } from './types'

const events = () => supabase.schema('events')
const BUCKET = 'events-public'

const COLUMNS =
  'id,title,event_date,starts_at,ends_at,status,visibility,slug,title_he,title_ar,' +
  'summary_he,summary_ar,body_he,body_ar,image_paths,story_slug,recur_weekdays,recur_until,' +
  'audience_he,audience_ar,bring_he,bring_ar,ar_machine_translated,next_date,updated_at'

/** Items created here — quote projections (customer names) are never listed. */
export async function listItems(): Promise<EventItem[]> {
  const { data, error } = await events()
    .from('events')
    .select(COLUMNS)
    .is('source_module', null)
    .order('event_date', { ascending: false })
  if (error) throw error
  return (data as unknown as EventItem[] | null) ?? []
}

// Same guard as quotes' assertWritten; 'not_written' is mapped to bilingual
// text by friendlyError.
function assertWritten({ data, error }: { data: unknown[] | null; error: unknown }): void {
  if (error) throw error
  if (!data?.length) throw new Error('not_written')
}

export async function insertItem(id: string, payload: EventPayload): Promise<void> {
  assertWritten(await events().from('events').insert({ id, ...payload }).select('id'))
}

export async function updateItem(id: string, patch: Partial<EventPayload>): Promise<void> {
  assertWritten(await events().from('events').update(patch).eq('id', id).select('id'))
}

export async function deleteItem(item: EventItem): Promise<void> {
  assertWritten(await events().from('events').delete().eq('id', item.id).select('id'))
  await removeImages(item.image_paths)
}

// a type alias, not an interface: invokeFunction takes a Record, and only an
// alias is assignable to one without a spread
export type HebrewText = {
  title: string
  summary: string
  body: string
  audience: string
  bring: string
}

/** Hebrew → Arabic through the `translate` edge function (it holds the Google
 *  key and re-checks events.manage). Returns only the fields it translated. */
export function translateToArabic(text: HebrewText): Promise<Partial<HebrewText>> {
  return invokeFunction<Partial<HebrewText>>('translate', text)
}

/** What the site answered a rebuild request with. 'not_configured' is the
 *  local stack (or a project whose GitHub token was never set) — not an error. */
export type RebuildResult = 'dispatched' | 'not_configured'

/** Ask GitHub to rebuild the public site so a publish/unpublish/edit of a
 *  public item reaches levyam.com (the landing pages are static, ADR 0056).
 *  The `rebuild-site` function holds the token and re-checks events.manage. */
export async function requestRebuild(): Promise<RebuildResult> {
  const { result } = await invokeFunction<{ result: RebuildResult }>('rebuild-site', {})
  return result
}

/** Trigger the site rebuild and say what happened, in the owner's words.
 *  A failed dispatch is reported, never thrown: the row is saved either way and
 *  the nightly rebuild (prod) catches up. */
export async function rebuildNote(et: EventsDict): Promise<string> {
  try {
    return (await requestRebuild()) === 'dispatched' ? et.rebuildQueued : et.rebuildNotConfigured
  } catch {
    return et.rebuildFailed
  }
}

/** The public landing page of an item, on the site this app is served from
 *  (levyam.com, staging.levyam.com). Under `npm run dev` nothing serves the
 *  static site, so the link 404s there — expected. */
export function landingPath(slug: string, lang: 'he' | 'ar'): string {
  return lang === 'ar' ? `/happening/ar/${slug}/` : `/happening/${slug}/`
}

/** Days after its last date a passed item's page stays up (events.passed, 59). */
export const PASSED_PAGE_DAYS = 90

export function imageUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export const MAX_PHOTOS = 8

/** Best-effort: an orphaned photo in a public bucket is untidy, not a leak. */
export async function removeImages(paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths)
}

// Phone photos arrive at 3–8 MB; the bucket caps at 5 MB and the public page
// wants ~1600px. Downscale in the browser so the upload always fits.
const MAX_EDGE = 1600

async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const g = canvas.getContext('2d')!
  // JPEG has no transparency: paint white first, or a transparent PNG turns black
  g.fillStyle = '#fff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image'))), 'image/jpeg', 0.85),
  )
}

/** Uploads under `<item id>/<random>.jpg` — the only shape events_image_paths_valid accepts. */
export async function uploadImage(itemId: string, file: File): Promise<string> {
  const path = `${itemId}/${crypto.randomUUID().slice(0, 8)}.jpg`
  try {
    const blob = await downscale(file)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
  } catch {
    // unreadable file, size/type refusal, network — one bilingual message (errImage)
    throw new Error('upload_failed')
  }
  return path
}
