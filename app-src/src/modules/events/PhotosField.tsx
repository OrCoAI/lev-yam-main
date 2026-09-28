// The gallery editor: add several photos at once, remove one, make one the
// cover. Order is the order they show on the public detail page; [0] is the
// card's cover. New files stay local (object URLs) until the form saves.
//
// Every tile has the same shape — the photo with its remove ✕ on top, then
// one full-width row (the cover mark, or the "make cover" button) — so a row
// of tiles lines up whatever mix it holds. The "add" tile is the grid's last
// cell; alone, it stretches to a full-width drop area.
import { useEffect, useRef } from 'react'
import { MAX_PHOTOS, imageUrl } from './api'
import { useET } from './i18n'

export interface Photo {
  key: string
  /** set for a photo already in the bucket */
  path?: string
  /** set for a photo chosen in this form, not uploaded yet */
  file?: File
  url: string
}

export function photosFromPaths(paths: string[]): Photo[] {
  return paths.map((path) => ({ key: path, path, url: imageUrl(path) }))
}

export default function PhotosField({
  photos,
  onChange,
}: {
  photos: Photo[]
  onChange: (next: Photo[]) => void
}) {
  const et = useET()
  // every object URL this form created, revoked when the form goes away
  const created = useRef<string[]>([])
  useEffect(() => {
    const urls = created.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  function add(files: FileList | null) {
    if (!files) return
    const room = MAX_PHOTOS - photos.length
    const added = [...files].slice(0, Math.max(0, room)).map((file) => {
      const url = URL.createObjectURL(file)
      created.current.push(url)
      return { key: url, file, url }
    })
    onChange([...photos, ...added])
  }

  function remove(key: string) {
    const gone = photos.find((p) => p.key === key)
    if (gone?.file) URL.revokeObjectURL(gone.url) // release the picked file now, not at close
    onChange(photos.filter((p) => p.key !== key))
  }

  function makeCover(key: string) {
    const p = photos.find((x) => x.key === key)
    if (p) onChange([p, ...photos.filter((x) => x.key !== key)])
  }

  const full = photos.length >= MAX_PHOTOS

  return (
    <div className="field">
      <span className="field-hint muted">{et.photos}</span>
      <ul className="ev-gallery">
        {photos.map((p, i) => (
          <li key={p.key} className={`ev-photo${i === 0 ? ' ev-cover' : ''}`}>
            <div className="ev-photo-img">
              <img src={p.url} alt="" decoding="async" />
              <button
                type="button"
                className="ev-x ev-photo-x"
                aria-label={et.photoRemove}
                title={et.photoRemove}
                onClick={() => remove(p.key)}
              >
                ✕
              </button>
            </div>
            {i === 0 ? (
              <span className="ev-photo-cover">★ {et.photoIsCover}</span>
            ) : (
              <button type="button" className="btn-ghost ev-photo-make" onClick={() => makeCover(p.key)}>
                ☆ {et.photoCover}
              </button>
            )}
          </li>
        ))}
        {!full && (
          <li className="ev-photo ev-photo-add">
            <label className="ev-file">
              <span className="ev-file-plus" aria-hidden="true">
                +
              </span>
              <span>{et.photoAdd}</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  add(e.target.files)
                  e.target.value = '' // picking the same file again still fires
                }}
              />
            </label>
          </li>
        )}
      </ul>
    </div>
  )
}
