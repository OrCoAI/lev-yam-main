// Native <input type="date"> stays for the tap target + OS picker, but its closed-state
// text is rendered by the OS using the device's system locale — width and format we can't
// control or predict (that's what was overflowing on some iPhones). Show our own short,
// fixed-format text on top instead; the native input stays fully functional, just invisible.
function formatDisplay(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export default function DateField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="date-field-wrap">
      <input type="date" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="date-display" aria-hidden="true">
        {formatDisplay(value)}
      </span>
    </div>
  )
}
