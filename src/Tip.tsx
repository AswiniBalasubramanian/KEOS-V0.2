import type { ReactNode } from 'react'
import { Tooltip } from '@base-ui/react/tooltip'

/* One tooltip for the whole app: appears after a short delay on hover or keyboard focus,
   skips the delay when moving between neighbours, never on touch. */
export function TipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delay={450} closeDelay={60} timeout={350}>
      {children}
    </Tooltip.Provider>
  )
}

type Props = {
  label: string
  /** Keyboard shortcut shown beside the label, for example "Enter". Only pass real shortcuts. */
  shortcut?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Fill the width of the parent, for full-width rows such as sidebar items. */
  block?: boolean
  /** Render the child as is, with no tooltip. */
  disabled?: boolean
  children: ReactNode
}

export default function Tip({ label, shortcut, side = 'bottom', block = false, disabled = false, children }: Props) {
  if (disabled) return <>{children}</>
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<span className={`tip-anchor${block ? ' tip-anchor--block' : ''}`} />}>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side={side} sideOffset={8} className="tip-pos">
          <Tooltip.Popup className="tip">
            <span>{label}</span>
            {shortcut && <kbd className="tip__key">{shortcut}</kbd>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
