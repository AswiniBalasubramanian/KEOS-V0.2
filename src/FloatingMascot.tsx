import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useReducedMotion } from 'motion/react'
import { Mascot } from 'page-mascot'
import { IconClose } from './icons'

const KEY = 'keos-mascot-pos'

type Props = {
  directions: string
  reactions: string
  name: string
  size?: number
  onHide: () => void
}

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (typeof p.x === 'number' && typeof p.y === 'number') return p
    }
  } catch { /* storage blocked */ }
  return { x: 0, y: 0 }
}

/* Sits on the prompt box by default. Drag it anywhere to float it; hover or focus shows a close button. */
export default function FloatingMascot({ directions, reactions, name, size = 88, onHide }: Props) {
  const reduce = useReducedMotion()
  const start = useRef(loadPos())
  const x = useMotionValue(start.current.x)
  const y = useMotionValue(start.current.y)
  const wrap = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const [dragging, setDragging] = useState(false)

  // Keep it on screen after a resize
  useEffect(() => {
    const clamp = () => {
      const el = wrap.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const dx = r.left < 8 ? 8 - r.left : r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : 0
      const dy = r.top < 8 ? 8 - r.top : r.bottom > window.innerHeight - 8 ? window.innerHeight - 8 - r.bottom : 0
      if (dx) x.set(x.get() + dx)
      if (dy) y.set(y.get() + dy)
    }
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [x, y])

  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ x: x.get(), y: y.get() })) } catch { /* storage blocked */ }
  }

  const reset = () => {
    x.set(0)
    y.set(0)
    save()
  }

  return (
    <motion.div
      ref={wrap}
      className={`mascot-float${dragging ? ' is-dragging' : ''}`}
      style={{ x, y, touchAction: 'none' }}
      drag
      dragMomentum={false}
      dragElastic={0.08}
      whileDrag={reduce ? undefined : { scale: 1.06 }}
      onDragStart={() => { dragged.current = true; setDragging(true) }}
      onDragEnd={() => {
        setDragging(false)
        const el = wrap.current
        if (el) {
          const r = el.getBoundingClientRect()
          const dx = r.left < 8 ? 8 - r.left : r.right > window.innerWidth - 8 ? window.innerWidth - 8 - r.right : 0
          const dy = r.top < 8 ? 8 - r.top : r.bottom > window.innerHeight - 8 ? window.innerHeight - 8 - r.bottom : 0
          x.set(x.get() + dx)
          y.set(y.get() + dy)
        }
        save()
        window.setTimeout(() => { dragged.current = false }, 60)
      }}
      onClickCapture={(e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault() } }}
      onDoubleClick={reset}
      title="Drag to move. Double-click to put it back."
    >
      <Mascot
        className="composer-mascot"
        directions={directions}
        reactions={reactions}
        size={size}
        label={`${name} mascot. It follows your cursor and reacts when clicked. Drag to move it.`}
      />
      <button type="button" className="mascot-float__close" aria-label="Hide mascot" onClick={onHide}>
        <IconClose />
      </button>
    </motion.div>
  )
}
