import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { IconRoute, IconSliders } from './icons'

type Props = {
  children: ReactNode
  onWalkthrough: () => void
  onSettings: () => void
}

export default function ProfileMenu({ children, onWalkthrough, onSettings }: Props) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) root.current?.querySelector<HTMLElement>('.profile__trigger')?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }

  const items = [
    { label: 'Walkthrough', hint: 'A quick tour of KEOS', Icon: IconRoute, run: onWalkthrough },
    { label: 'Personal settings', hint: 'Mascot and preferences', Icon: IconSliders, run: onSettings },
  ]

  return (
    <div className="profile" ref={root}>
      <button
        type="button"
        className="profile__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label="Profile menu"
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            className="scope__menu profile__menu"
            role="menu"
            aria-label="Profile"
            onKeyDown={onKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, y: reduce ? 0 : 4, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
          >
            {items.map((it, n) => (
              <motion.button
                key={it.label}
                type="button"
                role="menuitem"
                className="scope__item"
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: n * motionTokens.stagger.item } }}
                onClick={() => { setOpen(false); it.run() }}
              >
                <it.Icon className="scope__icon" />
                <span className="scope__text">
                  <span className="scope__label">{it.label}</span>
                  <span className="scope__hint">{it.hint}</span>
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
