import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import { IconChevron, IconTarget, IconLocal, IconFolder, IconOrg, IconCheck } from './icons'

export type Scope = 'local' | 'project' | 'organization'

const OPTIONS: { id: Scope; label: string; hint: string; Icon: typeof IconLocal }[] = [
  { id: 'local', label: 'Local', hint: 'Files and chats on this device', Icon: IconLocal },
  { id: 'project', label: 'Project', hint: 'Only the projects you select', Icon: IconFolder },
  { id: 'organization', label: 'Organization', hint: 'Everything shared across KaarTech', Icon: IconOrg },
]

export function scopeLabel(s: Scope) {
  return OPTIONS.find((o) => o.id === s)!.label
}

export default function ScopeMenu({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) root.current?.querySelector<HTMLElement>(".chip")?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    // Move focus to the selected option when the menu opens
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.focus(),
    )
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className="scope" ref={root}>
      <Button
        variant="ghost"
        className={`h-auto chip${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <IconTarget className="chip__icon" />
        <span>Scope: {scopeLabel(value)}</span>
        <IconChevron className={`chip__chev scope__chev${open ? ' is-open' : ''}`} />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            className="scope__menu"
            role="menu"
            aria-label="Search scope"
            onKeyDown={onMenuKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, y: reduce ? 0 : 4, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
          >
            <p className="scope__title">Search in</p>
            {OPTIONS.map((o, n) => (
              <motion.button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={value === o.id}
                tabIndex={value === o.id ? 0 : -1}
                className={`scope__item${value === o.id ? ' is-selected' : ''}`}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: n * motionTokens.stagger.item } }}
                onClick={() => { onChange(o.id); close() }}
              >
                <o.Icon className="scope__icon" />
                <span className="scope__text">
                  <span className="scope__label">{o.label}</span>
                  <span className="scope__hint">{o.hint}</span>
                </span>
                {value === o.id && <IconCheck className="scope__check" />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
