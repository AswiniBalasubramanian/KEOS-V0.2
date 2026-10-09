import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import NewBadge from './NewBadge'
import Tip from './Tip'
import { IconPlus, IconAttach, IconFolder, IconGlobe, IconPlug, IconCheck } from './icons'

type Props = {
  webSearch: boolean
  onToggleWebSearch: () => void
  onPickFiles: () => void
  onUnavailable: (what: string) => void
}

type Item =
  | { id: 'upload'; label: string; hint: string; Icon: typeof IconAttach; kind: 'action'; isNew?: boolean }
  | { id: 'project'; label: string; hint: string; Icon: typeof IconAttach; kind: 'action'; isNew?: boolean }
  | { id: 'connectors'; label: string; hint: string; Icon: typeof IconAttach; kind: 'action'; isNew?: boolean }
  | { id: 'web'; label: string; hint: string; Icon: typeof IconAttach; kind: 'toggle'; isNew?: boolean }

const ITEMS: Item[] = [
  { id: 'upload', label: 'Add files or photos', hint: 'From this device', Icon: IconAttach, kind: 'action' },
  { id: 'project', label: 'Add from pod', hint: 'Reuse files from your pods', Icon: IconFolder, kind: 'action' },
  { id: 'connectors', label: 'Add connectors', hint: 'Bring in data from tools like SAP', Icon: IconPlug, kind: 'action' },
  { id: 'web', label: 'Web search', hint: 'Add live results from the web', Icon: IconGlobe, kind: 'toggle', isNew: true },
]

export default function AttachMenu({ webSearch, onToggleWebSearch, onPickFiles, onUnavailable }: Props) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) root.current?.querySelector<HTMLElement>('.composer__attach')?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus())
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    else if (e.key === 'Tab') setOpen(false)
  }

  const run = (it: Item) => {
    if (it.id === 'upload') onPickFiles()
    else if (it.id === 'web') { onToggleWebSearch(); return }
    else onUnavailable(it.label)
    close()
  }

  return (
    <div className="attach" ref={root}>
      <Tip label="Add to message" side="top"><Button
        variant="ghost"
        className={`h-auto composer__attach${open ? ' is-open' : ''}`}
        aria-label="Add to message"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <IconPlus />
      </Button></Tip>

      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            className="scope__menu attach__menu"
            role="menu"
            aria-label="Add to message"
            onKeyDown={onMenuKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, y: reduce ? 0 : 4, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
          >
            {ITEMS.map((it, n) => (
              <motion.button
                key={it.id}
                type="button"
                role={it.kind === 'toggle' ? 'menuitemcheckbox' : 'menuitem'}
                aria-checked={it.kind === 'toggle' ? webSearch : undefined}
                className={`scope__item${it.kind === 'toggle' && webSearch ? ' is-selected' : ''}`}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: reduce ? { duration: 0 } : { ...motionTokens.spring.smooth, delay: n * motionTokens.stagger.item } }}
                onClick={() => run(it)}
              >
                <it.Icon className="scope__icon" />
                <span className="scope__text">
                  <span className="scope__label">{it.label}{it.isNew && <NewBadge scale={0.72} />}</span>
                  <span className="scope__hint">{it.hint}</span>
                </span>
                {it.kind === 'toggle' && webSearch && <IconCheck className="scope__check" />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
