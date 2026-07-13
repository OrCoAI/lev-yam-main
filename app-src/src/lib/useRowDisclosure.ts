import { useCallback, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { PHONE_MQ, useMediaQuery } from './useMediaQuery'

const isInteractive = (target: EventTarget | null) =>
  Boolean((target as HTMLElement | null)?.closest('button, a, input, select, label'))

/** Row disclosure for `.rowline` tables (see styles.css): spread
 *  `rowProps(id)` on a summary `<tr>` to make it tap/keyboard-expandable into
 *  its full detail. One row open at a time. Phone-only by default — on desktop
 *  the props are empty and the table renders all columns as usual; pass
 *  `{ allViewports: true }` for rows that also expand on desktop (render a
 *  trailing `.rl-chev` cell there — the phone chevron is the row's own
 *  ::after). Taps on interactive children (buttons, links, inputs) never
 *  toggle the row.
 *  A toggle re-renders the whole consuming component — fine at finance-sized
 *  lists; a module with big lists should extract a `React.memo` row taking
 *  `open={openId === id}` + the stable `toggle` instead of spreading
 *  `rowProps`. */
export function useRowDisclosure({ allViewports = false }: { allViewports?: boolean } = {}) {
  const isPhone = useMediaQuery(PHONE_MQ)
  const active = allViewports || isPhone
  const [openId, setOpenId] = useState<string | null>(null)

  const toggle = useCallback((id: string, e: MouseEvent | KeyboardEvent) => {
    if (isInteractive(e.target)) return
    setOpenId((cur) => (cur === id ? null : id))
  }, [])

  const rowProps = (id: string) =>
    active
      ? {
          'aria-expanded': openId === id,
          tabIndex: 0,
          onClick: (e: MouseEvent) => toggle(id, e),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            // guard BEFORE preventDefault: a bubbled keypress from a button
            // inside the row must keep its default activation
            if (isInteractive(e.target)) return
            e.preventDefault()
            toggle(id, e)
          },
        }
      : {}

  return { isPhone, openId, rowProps, toggle }
}
