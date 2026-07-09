import { useEffect, useRef, useState } from 'react'
import { useCan } from '../../lib/permissions'
import { PERM } from '../../lib/permissions'
import { getOwnerSignature, getSettings, saveDefaultChecklist, saveOwnerSignature } from './api'
import { useQT } from './i18n'

function SignatureTab() {
  const qt = useQT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef(false)
  const [existing, setExisting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getOwnerSignature().then(setExisting).catch(() => setExisting(''))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a3340'
    let drawing = false
    let lx = 0
    let ly = 0
    const pos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect()
      const t = 'touches' in e ? e.touches[0] : e
      return { x: t.clientX - r.left, y: t.clientY - r.top }
    }
    const start = (e: MouseEvent | TouchEvent) => {
      drawing = true
      const p = pos(e)
      lx = p.x
      ly = p.y
      e.preventDefault()
    }
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing) return
      const p = pos(e)
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      lx = p.x
      ly = p.y
      drawnRef.current = true
      e.preventDefault()
    }
    const end = () => {
      drawing = false
    }
    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    window.addEventListener('mouseup', end)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', end)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [])

  const clear = () => {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    drawnRef.current = false
  }

  const save = async () => {
    if (!drawnRef.current || !canvasRef.current) {
      alert(qt.signatureDrawFirst)
      return
    }
    setSaving(true)
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      await saveOwnerSignature(dataUrl)
      setExisting(dataUrl)
      clear()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cfg-section">
      <p className="muted cfg-help">{qt.signatureHelp}</p>
      {existing ? (
        <div className="cfg-sig-current">
          <div className="muted">{qt.signatureCurrent}</div>
          <img src={existing} alt="" />
        </div>
      ) : null}
      <canvas ref={canvasRef} className="cfg-sig-canvas" />
      <div className="modal-actions">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? qt.saving : qt.signatureSave}
        </button>
        <button className="btn-ghost" onClick={clear}>
          {qt.signatureClear}
        </button>
      </div>
    </div>
  )
}

function PrepDefaultsTab() {
  const qt = useQT()
  const [items, setItems] = useState<string[] | null>(null)
  const [newText, setNewText] = useState('')

  useEffect(() => {
    getSettings()
      .then((s) => setItems(s.default_prep_checklist))
      .catch(() => setItems([]))
  }, [])

  const save = (next: string[]) => {
    setItems(next)
    saveDefaultChecklist(next).catch((e: Error) => alert(e.message))
  }

  const swap = (i: number, j: number) => {
    if (!items || j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next)
  }
  const edit = (i: number, text: string) => save(items!.map((t, j) => (j === i ? text : t)))
  const remove = (i: number) => save(items!.filter((_, j) => j !== i))
  const add = () => {
    const t = newText.trim()
    if (!t || !items) return
    save([...items, t])
    setNewText('')
  }

  if (items === null) return <div className="muted cfg-help">{qt.loading}</div>

  return (
    <div className="cfg-section">
      <p className="muted cfg-help">{qt.prepHelp}</p>
      <div className="cfg-prep-list">
        {items.map((t, i) => (
          <div key={i} className="cfg-prep-item">
            <button className="cfg-prep-arrow" title={qt.moveUp} disabled={i === 0} onClick={() => swap(i, i - 1)}>
              ↑
            </button>
            <button
              className="cfg-prep-arrow"
              title={qt.moveDown}
              disabled={i === items.length - 1}
              onClick={() => swap(i, i + 1)}
            >
              ↓
            </button>
            <input
              defaultValue={t}
              onBlur={(e) => {
                if (e.target.value !== t) edit(i, e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
            <button className="cfg-prep-del" title={qt.remove} onClick={() => remove(i)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="chk-add">
        <input
          value={newText}
          placeholder={qt.checklistAddPlaceholder}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button disabled={!newText.trim()} onClick={add}>
          {qt.add}
        </button>
      </div>
    </div>
  )
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const qt = useQT()
  const canSettings = useCan(PERM.quotesSettings)
  const [tab, setTab] = useState<'signature' | 'prep'>(canSettings ? 'signature' : 'prep')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{qt.settingsTitle}</div>
        <div className="cfg-tabs">
          {canSettings && (
            <button className={'cfg-tab' + (tab === 'signature' ? ' active' : '')} onClick={() => setTab('signature')}>
              {qt.tabSignature}
            </button>
          )}
          <button className={'cfg-tab' + (tab === 'prep' ? ' active' : '')} onClick={() => setTab('prep')}>
            {qt.tabPrep}
          </button>
        </div>
        {tab === 'signature' && canSettings && <SignatureTab />}
        {tab === 'prep' && <PrepDefaultsTab />}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            {qt.close}
          </button>
        </div>
      </div>
    </div>
  )
}
