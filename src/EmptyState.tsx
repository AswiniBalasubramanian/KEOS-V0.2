import { useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { graph, loupe, bubble, screen, gauge } from './emptyArt'
import './EmptyArt.css'
import './EmptyState.css'

const ART = { graph, loupe, bubble, screen, gauge }
export type EmptyArtName = keyof typeof ART

type Props = {
  art: EmptyArtName
  title: string
  children?: ReactNode
  action?: ReactNode
  /** Smaller illustration for tight spots such as a table row or a side panel. */
  compact?: boolean
}

/* An empty state: an isometric object, a plain headline, one line of help, and at most one action.
   The object reacts to the pointer or a tap. It is decoration, so it stays out of the tab order and the reading order. */
export default function EmptyState({ art, title, children, action, compact }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  const [steer, setSteer] = useState(false)

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (art !== 'loupe') return
    const box = e.currentTarget.getBoundingClientRect()
    const share = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width))
    root.current?.style.setProperty('--t', String((share * 18).toFixed(2)))
    setSteer(true)
  }

  return (
    <div ref={root} className={`empty${compact ? ' empty--compact' : ''}${on ? ' is-on' : ''}${steer ? ' is-steer' : ''}`}>
      <div
        className="empty-art empty__art"
        aria-hidden="true"
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOn(true) }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') { setOn(false); setSteer(false) } }}
        onPointerMove={(e) => { if (e.pointerType === 'mouse') move(e) }}
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') setOn((v) => !v) }}
        dangerouslySetInnerHTML={{ __html: ART[art] }}
      />
      <h3 className="empty__title">{title}</h3>
      {children && <p className="empty__text">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}
