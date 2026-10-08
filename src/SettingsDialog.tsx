import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mascot } from 'page-mascot'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import { IconClose, IconCheck } from './icons'
import { MASCOTS } from './mascots'
import type { MascotId } from './mascots'

type Props = {
  open: boolean
  onClose: () => void
  mascot: MascotId
  onMascot: (id: MascotId) => void
  showMascot: boolean
  onShowMascot: (on: boolean) => void
}

export default function SettingsDialog({ open, onClose, mascot, onMascot, showMascot, onShowMascot }: Props) {
  const reduce = useReducedMotion()
  const panel = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus())
    return () => opener.current?.focus?.()
  }, [open])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]') ?? [])
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const i = MASCOTS.findIndex((m) => m.id === mascot)
    const last = MASCOTS.length - 1
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % MASCOTS.length : (i - 1 + MASCOTS.length) % MASCOTS.length
    onMascot(MASCOTS[next].id)
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus())
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="dialog__scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard } }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            ref={panel}
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onKeyDown={onKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, y: reduce ? 0 : 6, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
          >
            <div className="dialog__head">
              <h2 id="settings-title" className="dialog__title">Personal settings</h2>
              <Button variant="ghost" className="h-auto dialog__close" aria-label="Close settings" onClick={onClose}>
                <IconClose />
              </Button>
            </div>

            <section className="dialog__section" aria-labelledby="mascot-label">
              <div className="dialog__row">
                <div>
                  <h3 id="mascot-label" className="dialog__h">Mascot</h3>
                  <p className="dialog__p">Pick the buddy that sits on your prompt box. It follows your cursor.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showMascot}
                  aria-label="Show mascot"
                  className={`switch${showMascot ? ' is-on' : ''}`}
                  onClick={() => onShowMascot(!showMascot)}
                >
                  <span className="switch__thumb" />
                </button>
              </div>

              <div className="mascot-grid" role="radiogroup" aria-label="Mascot" onKeyDown={onGridKey}>
                {MASCOTS.map((m) => {
                  const on = m.id === mascot
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      className={`mascot-card${on ? ' is-selected' : ''}`}
                      onClick={() => onMascot(m.id)}
                    >
                      <span className="mascot-card__art" aria-hidden="true">
                        <Mascot directions={m.directions} reactions={m.reactions} size={64} label="" />
                      </span>
                      <span className="mascot-card__name">{m.name}</span>
                      {on && <IconCheck className="mascot-card__check" />}
                    </button>
                  )
                })}
              </div>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
