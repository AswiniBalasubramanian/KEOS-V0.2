import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import Tip from './Tip'
import { IconFeedback, IconThumbUp, IconThumbDown, IconCheck, IconClose } from './icons'

type Kind = 'idea' | 'bug' | 'praise'

const KINDS: { id: Kind; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'bug', label: 'Problem' },
  { id: 'praise', label: 'Praise' },
]

const KEY = 'keos-feedback'

export default function FeedbackMenu() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>('idea')
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [text, setText] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [mode, setMode] = useState<'feedback' | 'ticket'>('feedback')
  const [subject, setSubject] = useState('')
  const [ticketId, setTicketId] = useState('')
  const reduce = useReducedMotion()
  const trigger = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = () => {
    setOpen(false)
    trigger.current?.querySelector<HTMLElement>('.feedback__trigger')?.focus()
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('textarea')?.focus())
  }, [open])

  // Reset the form a moment after the dialog closes
  useEffect(() => {
    if (open) return
    const t = window.setTimeout(() => { setState('idle'); setText(''); setVote(null); setKind('idea'); setMode('feedback'); setSubject('') }, 300)
    return () => window.clearTimeout(t)
  }, [open])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return }
    if (e.key === 'Tab') {
      const f = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), textarea') ?? [])
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'ticket') {
      if (!subject.trim() || !text.trim()) return
      setState('sending')
      const n = 1000 + Math.floor(Math.random() * 9000)
      try {
        const prev = JSON.parse(localStorage.getItem('keos-tickets') ?? '[]')
        localStorage.setItem('keos-tickets', JSON.stringify([...prev, { id: `KEOS-${n}`, subject: subject.trim(), text: text.trim(), at: Date.now() }]))
      } catch { /* storage blocked */ }
      setTicketId(`KEOS-${n}`)
      window.setTimeout(() => setState('sent'), 600)
      return
    }
    if (!text.trim() && !vote) return
    setState('sending')
    // Prototype: keep the note on this device
    try {
      const prev = JSON.parse(localStorage.getItem(KEY) ?? '[]')
      localStorage.setItem(KEY, JSON.stringify([...prev, { kind, vote, text: text.trim(), at: Date.now() }]))
    } catch { /* storage blocked */ }
    window.setTimeout(() => setState('sent'), 600)
  }

  const canSend = state === 'idle' && (mode === 'ticket' ? subject.trim().length > 0 && text.trim().length > 0 : text.trim().length > 0 || vote !== null)

  return (
    <div className="feedback" ref={trigger}>
      <Tip label="Send feedback" side="top"><Button
        variant="ghost"
        className={`h-auto feedback__trigger${open ? ' is-open' : ''}`}
        aria-label="Send feedback"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (state === 'sent') { setState('idle'); setText(''); setVote(null); setKind('idea'); setMode('feedback'); setSubject('') }
          setOpen(true)
        }}
      >
        <IconFeedback />
      </Button></Tip>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="dialog__scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard } }}
              exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
              onPointerDown={(e) => { if (e.target === e.currentTarget) close() }}
            >
              <motion.div
                ref={panel}
                className="dialog feedback__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${id}-title`}
                onKeyDown={onKey}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
                exit={{ opacity: 0, y: reduce ? 0 : 6, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
              >
                <div className="dialog__head">
                  <h2 id={`${id}-title`} className="dialog__title">{mode === 'ticket' ? 'Open a support ticket' : 'Help us improve KEOS'}</h2>
                  <Button variant="ghost" className="h-auto dialog__close" aria-label="Close feedback" onClick={close}>
                    <IconClose />
                  </Button>
                </div>

                <span className="feedback__badge" aria-hidden="true" />

                {state === 'sent' ? (
                  <div className="feedback__done" role="status">
                    <IconCheck className="feedback__done-icon" />
                    <p className="feedback__done-title">{mode === 'ticket' ? `Ticket ${ticketId} created` : 'Thanks, we got it'}</p>
                    <p className="feedback__done-text">
                      {mode === 'ticket'
                        ? 'In this prototype the ticket stays on this device. In production, the support team replies by email.'
                        : 'In this prototype your note stays on this device. Every idea helps shape what we build next.'}
                    </p>
                    <Button variant="ghost" className="h-auto feedback__btn" onClick={close}>Close</Button>
                  </div>
                ) : (
                  <form onSubmit={submit}>
                    {mode === 'feedback' && (<>
                    <div className="feedback__row">
                      <span className="feedback__q" id={`${id}-q`}>How is KEOS working for you?</span>
                      <div className="feedback__votes" role="group" aria-labelledby={`${id}-q`}>
                        <button type="button" className={`feedback__vote${vote === 'up' ? ' is-on' : ''}`} aria-pressed={vote === 'up'} aria-label="Working well" onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}>
                          <IconThumbUp />
                        </button>
                        <button type="button" className={`feedback__vote${vote === 'down' ? ' is-on' : ''}`} aria-pressed={vote === 'down'} aria-label="Needs work" onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}>
                          <IconThumbDown />
                        </button>
                      </div>
                    </div>

                    <div className="feedback__kinds" role="radiogroup" aria-label="Type of feedback">
                      {KINDS.map((k) => (
                        <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`feedback__kind${kind === k.id ? ' is-on' : ''}`} onClick={() => setKind(k.id)}>
                          {k.label}
                        </button>
                      ))}
                    </div>
                    </>)}
                    {mode === 'ticket' && (
                      <label className="feedback__field">
                        <span className="feedback__label">Subject</span>
                        <input className="feedback__input" value={subject} maxLength={90} placeholder="Summarise the issue in a few words" onChange={(e) => setSubject(e.target.value)} />
                      </label>
                    )}

                    <label className="feedback__field">
                      <span className="feedback__label">{mode === 'ticket' ? 'What do you need help with?' : 'Tell us more'}</span>
                      <textarea
                        className="feedback__text"
                        rows={5}
                        value={text}
                        placeholder={mode === 'ticket' ? 'Describe what you were doing, what you expected, and what happened.' : kind === 'bug' ? 'What went wrong, and what did you expect?' : kind === 'praise' ? 'What worked well for you?' : 'What would make KEOS better for you?'}
                        onChange={(e) => setText(e.target.value)}
                      />
                    </label>

                    <div className="feedback__actions">
                      <Button variant="ghost" type="button" className="h-auto feedback__btn" onClick={close}>Cancel</Button>
                      <Button variant="ghost" type="submit" className="h-auto feedback__btn feedback__btn--primary" disabled={!canSend} aria-busy={state === 'sending'}>
                        {state === 'sending' ? 'Sending' : mode === 'ticket' ? 'Submit ticket' : 'Send feedback'}
                      </Button>
                    </div>

                    <p className="feedback__alt">
                      {mode === 'feedback' ? 'Need help instead? ' : 'Just sharing a thought? '}
                      <button type="button" className="feedback__link" onClick={() => { setMode(mode === 'feedback' ? 'ticket' : 'feedback'); setText('') }}>
                        {mode === 'feedback' ? 'Open a ticket' : 'Send feedback'}
                      </button>
                    </p>
                  </form>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
