import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import { IconClock } from './icons'
import './SessionGuard.css'

/* Signs the person out after a period with no activity, and warns them first.
   The prototype uses 15 minutes of quiet and a 60 second warning. */
export const IDLE_MS = 15 * 60 * 1000
export const WARN_S = 60

const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function SessionGuard({ onExpire, onSignOut, previewWarning }: { onExpire: () => void; onSignOut: () => void; previewWarning: number }) {
  const reduce = useReducedMotion()
  const last = useRef(Date.now())
  const [left, setLeft] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')
  const box = useRef<HTMLDivElement>(null)

  const touch = useCallback(() => { last.current = Date.now() }, [])

  // anything the person does counts as activity, until the warning is showing
  useEffect(() => {
    const on = () => { if (left === null) touch() }
    ACTIVITY.forEach((e) => window.addEventListener(e, on, { passive: true }))
    return () => ACTIVITY.forEach((e) => window.removeEventListener(e, on))
  }, [left, touch])

  // check once a second
  useEffect(() => {
    const t = setInterval(() => {
      const remaining = Math.ceil((IDLE_MS - (Date.now() - last.current)) / 1000)
      if (remaining <= 0) { setLeft(null); onExpire(); return }
      setLeft(remaining <= WARN_S ? remaining : null)
    }, 1000)
    return () => clearInterval(t)
  }, [onExpire])

  // let the design review jump straight to the warning
  useEffect(() => {
    if (!previewWarning) return
    last.current = Date.now() - (IDLE_MS - WARN_S * 1000) + 500
    setLeft(WARN_S)
  }, [previewWarning])

  // announce to screen readers only at a few moments, not every second
  useEffect(() => {
    if (left === null) { setAnnounce(''); return }
    if ([60, 30, 10, 5].includes(left)) setAnnounce(`You will be signed out in ${left} seconds.`)
  }, [left])

  useEffect(() => { if (left !== null) requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('.session__btn--primary')?.focus()) }, [left === null]) // eslint-disable-line react-hooks/exhaustive-deps

  const keep = () => { touch(); setLeft(null) }
  const open = left !== null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="dialog__scrim session__scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard } }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
        >
          <motion.div
            ref={box}
            className="dialog session"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-title"
            aria-describedby="session-text"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); keep() } }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
          >
            <span className="session__icon" aria-hidden="true"><IconClock /></span>
            <h2 id="session-title" className="session__title">Are you still there?</h2>
            <p id="session-text" className="session__text">
              For your security, you will be signed out in <b className="session__time">{fmt(left ?? 0)}</b> because there has been no activity. Unsaved changes on this page may be lost.
            </p>
            <div className="session__bar" aria-hidden="true"><i style={{ width: `${((left ?? 0) / WARN_S) * 100}%` }} /></div>
            <div className="session__actions">
              <Button type="button" variant="ghost" className="h-auto session__btn" onClick={onSignOut}>Sign out now</Button>
              <Button type="button" variant="ghost" className="h-auto session__btn session__btn--primary" onClick={keep}>Stay signed in</Button>
            </div>
            <p className="sr-only" role="status" aria-live="polite">{announce}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
