import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import { IconFile, IconFolder, IconBook, IconCopy, IconCheck, IconChevron, IconInfo, IconError, IconRefresh } from './icons'

export type Source = {
  n: number
  title: string
  publisher: string
  kind: 'file' | 'memory' | 'folder'
  /** What the source says. Shown in the preview so a claim can be checked in place. */
  snippet: string
  /** The claim in the answer this source backs. */
  claim: string
  /** Quality signal: how much weight the reader should give it. */
  quality: { label: string; tone: 'strong' | 'medium' }
  updated: string
  /** Demo of a failing preview: the first load fails, a retry works. */
  flaky?: boolean
}

type Load = 'idle' | 'loading' | 'ready' | 'error'

const KindIcon = ({ kind, className }: { kind: Source['kind']; className?: string }) =>
  kind === 'file' ? <IconFile className={className} /> : kind === 'folder' ? <IconFolder className={className} /> : <IconBook className={className} />

type Ctx = {
  sources: Source[]
  openN: number | null
  pinnedN: number | null
  show: (n: number, pin?: boolean) => void
  hide: (n?: number) => void
  reveal: (n: number) => void
}
const CiteCtx = createContext<Ctx | null>(null)

export function CitationsProvider({ sources, onReveal, children }: { sources: Source[]; onReveal: (n: number) => void; children: ReactNode }) {
  const [openN, setOpenN] = useState<number | null>(null)
  const [pinnedN, setPinnedN] = useState<number | null>(null)
  const timer = useRef<number>()

  const show = useCallback((n: number, pin = false) => {
    window.clearTimeout(timer.current)
    if (pin) {
      setPinnedN((p) => (p === n ? null : n))
      setOpenN((o) => (o === n && pinnedN === n ? null : n))
    } else {
      timer.current = window.setTimeout(() => setOpenN(n), 120)
    }
  }, [pinnedN])

  const hide = useCallback((n?: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setOpenN((o) => (n == null || o === n ? (pinnedN === o ? o : null) : o))
    }, 140)
  }, [pinnedN])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Escape closes a pinned card from anywhere
  useEffect(() => {
    if (openN == null) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setOpenN(null); setPinnedN(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openN])

  const reveal = (n: number) => { setOpenN(null); setPinnedN(null); onReveal(n) }

  return <CiteCtx.Provider value={{ sources, openN, pinnedN, show, hide, reveal }}>{children}</CiteCtx.Provider>
}

const SHORT = (s: Source) => s.publisher.split(' ')[0]

/* Inline marker: number plus publisher, with a preview card on hover, focus or Enter. */
export function Cite({ n }: { n: number }) {
  const ctx = useContext(CiteCtx)
  const reduce = useReducedMotion()
  const id = useId()
  const [load, setLoad] = useState<Load>('idle')
  const tries = useRef(0)
  const src = ctx?.sources.find((s) => s.n === n)
  const isOpen = ctx?.openN === n
  const [side, setSide] = useState<'down' | 'up'>('down')
  const [end, setEnd] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)

  const fetchPreview = useCallback(() => {
    if (!src) return
    setLoad('loading')
    window.setTimeout(() => {
      tries.current += 1
      setLoad(src.flaky && tries.current === 1 ? 'error' : 'ready')
    }, 380)
  }, [src])

  useEffect(() => {
    if (!isOpen) return
    if (load === 'idle') fetchPreview()
    const r = wrap.current?.getBoundingClientRect()
    if (r) {
      setSide(window.innerHeight - r.bottom < 240 ? 'up' : 'down')
      setEnd(r.left + 340 > window.innerWidth - 16)
    }
  }, [isOpen, load, fetchPreview])

  const [copied, setCopied] = useState(false)
  if (!ctx || !src) return <sup className="cite">{n}</sup>

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape' && isOpen) { e.stopPropagation(); ctx.hide(); }
  }

  const copy = () => {
    navigator.clipboard?.writeText(`${src.title}, ${src.publisher} (${src.updated})`).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="cite-wrap" ref={wrap} onMouseEnter={() => ctx.show(n)} onMouseLeave={() => ctx.hide(n)}>
      <button
        type="button"
        className={`cite${isOpen ? ' is-open' : ''}`}
        aria-label={`Source ${n}: ${src.title}, ${src.publisher}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        onFocus={() => ctx.show(n)}
        onBlur={() => ctx.hide(n)}
        onClick={() => ctx.reveal(n)}
        onKeyDown={onKey}
      >
        <span className="cite__n">{n}</span>
        <span className="cite__pub">{SHORT(src)}</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={id}
            role="dialog"
            aria-label={`Source ${n}: ${src.title}`}
            className={`cite-card cite-card--${side}${end ? ' cite-card--end' : ''}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: side === 'down' ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
            onMouseEnter={() => ctx.show(n)}
            onMouseLeave={() => ctx.hide(n)}
          >
            <div className="cite-card__head">
              <KindIcon kind={src.kind} className="cite-card__icon" />
              <div className="cite-card__id">
                <b>{src.title}</b>
                <span>{src.publisher} · Updated {src.updated}</span>
              </div>
              <span className={`cite-q cite-q--${src.quality.tone}`}>{src.quality.label}</span>
            </div>

            {load === 'loading' && (
              <div className="cite-card__body" aria-busy="true">
                <span className="cite-skel" /><span className="cite-skel cite-skel--short" />
                <span className="sr-only" role="status">Loading source preview</span>
              </div>
            )}
            {load === 'error' && (
              <div className="cite-card__body cite-card__err" role="alert">
                <IconError />
                <p>Preview unavailable. KEOS couldn’t reach this source right now.</p>
                <Button variant="ghost" className="h-auto cite-btn" onClick={fetchPreview}><IconRefresh /> Try again</Button>
              </div>
            )}
            {load === 'ready' && (
              <div className="cite-card__body">
                <p className="cite-card__claim"><span>Supports</span> “{src.claim}”</p>
                <p className="cite-card__snippet">{src.snippet}</p>
              </div>
            )}

            <div className="cite-card__foot">
              <Button variant="ghost" className="h-auto cite-btn" onClick={() => ctx.reveal(n)}><IconInfo /> Show in sources</Button>
              <Button variant="ghost" className="h-auto cite-btn" onClick={copy} aria-label="Copy citation">
                {copied ? <IconCheck /> : <IconCopy />} {copied ? 'Copied' : 'Copy citation'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

/* Sources list: every source is visible and can be opened in place. No "+N". */
export function SourceList({ sources, expandedN, onToggle }: { sources: Source[]; expandedN: number | null; onToggle: (n: number) => void }) {
  const reduce = useReducedMotion()
  return (
    <section className="reply__sources reply__in sources" aria-label={`Sources, ${sources.length}`}>
      <span className="reply__label">Sources</span>
      <ul className="sources__list">
        {sources.map((s) => {
          const open = expandedN === s.n
          return (
            <li key={s.n} id={`source-${s.n}`} className={`sources__item${open ? ' is-open' : ''}`}>
              <button type="button" className="source" aria-expanded={open} aria-controls={`source-${s.n}-panel`} onClick={() => onToggle(s.n)}>
                <span className="source__n">{s.n}</span>
                <KindIcon kind={s.kind} className="source__i" />
                <span className="source__t">{s.title}</span>
                <span className="source__pub">{s.publisher}</span>
                <span className={`cite-q cite-q--${s.quality.tone}`}>{s.quality.label}</span>
                <IconChevron className={`source__chev${open ? ' is-open' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={`source-${s.n}-panel`}
                    className="sources__panel"
                    initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{ duration: reduce ? 0.12 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p className="cite-card__claim"><span>Supports</span> “{s.claim}”</p>
                    <p className="cite-card__snippet">{s.snippet}</p>
                    <small>{s.publisher} · Updated {s.updated}</small>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
