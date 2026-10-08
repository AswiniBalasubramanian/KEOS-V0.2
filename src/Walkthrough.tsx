import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'

export type Step = { target: string; title: string; body: string }

type Props = { open: boolean; steps: Step[]; onClose: () => void }

type Box = { top: number; left: number; width: number; height: number }

const PAD = 6
const CARD_W = 320

export default function Walkthrough({ open, steps, onClose }: Props) {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const card = useRef<HTMLDivElement>(null)

  // Only keep steps whose target is on screen right now
  const [live, setLive] = useState<Step[]>([])
  useEffect(() => {
    if (!open) return
    setLive(steps.filter((s) => document.querySelector(s.target)))
    setIndex(0)
  }, [open, steps])

  const step = live[index]

  const measure = useCallback(() => {
    if (!step) return
    const el = document.querySelector<HTMLElement>(step.target)
    if (!el) { setBox(null); return }
    const r = el.getBoundingClientRect()
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
  }, [step])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [open, measure])

  useEffect(() => {
    if (open) requestAnimationFrame(() => card.current?.querySelector<HTMLElement>('[data-primary]')?.focus())
  }, [open, index])

  const last = index === live.length - 1
  const next = () => (last ? onClose() : setIndex((i) => i + 1))
  const back = () => setIndex((i) => Math.max(0, i - 1))

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
  }

  // Place the card: prefer below the target, else above, else beside; keep it on screen
  const place = () => {
    if (!box) return { top: window.innerHeight / 2 - 80, left: window.innerWidth / 2 - CARD_W / 2 }
    const gap = 12
    const h = 170
    let top = box.top + box.height + gap
    let left = box.left
    if (top + h > window.innerHeight - 12) top = Math.max(12, box.top - h - gap)
    if (top < 12 || (box.top + box.height + gap + h > window.innerHeight - 12 && box.top - h - gap < 12)) {
      top = Math.min(Math.max(12, box.top), window.innerHeight - h - 12)
      left = box.left + box.width + gap
    }
    left = Math.min(Math.max(12, left), window.innerWidth - CARD_W - 12)
    return { top, left }
  }

  if (!open || !step) return null
  const pos = place()

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        className="tour"
        role="dialog"
        aria-modal="true"
        aria-label="KEOS walkthrough"
        onKeyDown={onKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard } }}
        exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
      >
        {box && (
          <motion.div
            className="tour__spot"
            aria-hidden="true"
            animate={{ top: box.top, left: box.left, width: box.width, height: box.height }}
            transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
          />
        )}
        <motion.div
          ref={card}
          className="tour__card"
          animate={{ top: pos.top, left: pos.left }}
          initial={false}
          transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
          style={{ width: CARD_W }}
        >
          <p className="tour__count">Step {index + 1} of {live.length}</p>
          <h2 className="tour__title">{step.title}</h2>
          <p className="tour__body">{step.body}</p>
          <div className="tour__actions">
            <Button variant="ghost" className="h-auto tour__skip" onClick={onClose}>Skip tour</Button>
            <span className="tour__spacer" />
            {index > 0 && <Button variant="ghost" className="h-auto tour__btn" onClick={back}>Back</Button>}
            <Button variant="ghost" className="h-auto tour__btn tour__btn--primary" data-primary onClick={next}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
