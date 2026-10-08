import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  IconChevron, IconFile, IconDownload, IconFolder, IconBook, IconCopy, IconCheck,
  IconRefresh, IconShare, IconThumbUp, IconThumbDown, IconFollow,
} from './icons'
import Tip from './Tip'
import './AssistantReply.css'

/* 5x5 Bayer-style ordering so the pixels light up in a dithered pattern, not a sweep. */
const BAYER = [
  0, 12, 3, 15, 6,
  8, 4, 11, 1, 18,
  2, 14, 5, 13, 9,
  10, 7, 16, 19, 22,
  17, 20, 23, 21, 24,
]

export function PixelLoader({ className = '' }: { className?: string }) {
  return (
    <span className={`pixel-loader ${className}`} role="presentation" aria-hidden="true">
      {BAYER.map((o, i) => (
        <i key={i} style={{ ['--o' as string]: o }} />
      ))}
    </span>
  )
}

const REASONING = [
  'Reading your scope and sources',
  'Searching project memory',
  'Checking the open risks',
  'Drafting the PRD',
]

const INTRO = [
  'Done!', 'I’ve', 'created', 'a', 'comprehensive', 'PRD', 'for', 'Acme,', 'an', 'analytics',
  'and', 'reporting', 'SaaS', 'platform', 'currently', 'in', 'MVP', 'development.',
]
const CITE_AFTER: Record<number, number> = { 8: 1, 13: 2, 18: 3 } // word count -> source number

const SOURCES = [
  { n: 1, label: 'brief/acme-mvp.md', kind: 'file' as const },
  { n: 2, label: 'Ras Tanura scope freeze', kind: 'memory' as const },
  { n: 3, label: 'Jubail ILI report', kind: 'folder' as const },
]

const FOLLOW_UPS = [
  'Break the PRD into user stories',
  'Draft the launch checklist',
  'List the top risks by severity',
]

type Props = {
  logo: string
  sections: string[]
  fresh: boolean
  onDone: () => void
  onTick: () => void
  onOpenDoc: () => void
  onFollowUp: (text: string) => void
}

type Phase = 'thinking' | 'streaming' | 'done'

export default function AssistantReply({ logo, sections, fresh, onDone, onTick, onOpenDoc, onFollowUp }: Props) {
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<Phase>(fresh ? 'thinking' : 'done')
  const [step, setStep] = useState(0)
  const [t, setT] = useState(fresh ? 0 : 9999)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  const tickRef = useRef(onTick)
  doneRef.current = onDone
  tickRef.current = onTick

  // Timeline: thinking (rotating reasoning steps) -> streaming -> done
  useEffect(() => {
    if (!fresh && run === 0) return
    setPhase('thinking')
    setStep(0)
    setT(0)
    if (reduce) {
      const id = window.setTimeout(() => { setT(9999); setPhase('done'); doneRef.current() }, 500)
      return () => window.clearTimeout(id)
    }
    const timers: number[] = []
    const stepMs = 850
    REASONING.forEach((_, i) => { if (i > 0) timers.push(window.setTimeout(() => setStep(i), i * stepMs)) })
    let ticker: number | undefined
    timers.push(
      window.setTimeout(() => {
        setPhase('streaming')
        let n = 0
        ticker = window.setInterval(() => {
          n += 1
          setT(n)
          tickRef.current()
          if (n >= TOTAL_TICKS) {
            window.clearInterval(ticker)
            setPhase('done')
            doneRef.current()
          }
        }, 45)
      }, REASONING.length * stepMs),
    )
    return () => { timers.forEach((id) => window.clearTimeout(id)); if (ticker) window.clearInterval(ticker) }
  }, [fresh, run, reduce])

  const loading = phase !== 'done'
  // Block schedule (in ticks): intro words first, then blocks every 3 ticks
  const W = INTRO.length
  const at = (i: number) => W + 2 + i * 3
  const show = (i: number) => t >= at(i)
  const wordsShown = Math.min(W, t)

  const copy = useCallback(() => {
    const text = `Done! I’ve created a comprehensive PRD for Acme.\n\n${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }, [sections])

  return (
    <div className="msg msg--assistant" aria-busy={loading}>
      {loading ? <PixelLoader className="reply__avatar reply__avatar--loading" /> : <img className="reply__avatar" src={logo} alt="" aria-hidden />}
      <div className="reply__body" ref={body}>
        {phase === 'thinking' && (
          <div className="reply__status" role="status" aria-live="polite">
            <span className="reply__thinking">Thinking</span>
            <span key={step} className="reply__step">{REASONING[step]}</span>
          </div>
        )}

        {phase !== 'thinking' && (
          <>
            <Button variant="ghost" className="h-auto reply__tools reply__in" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
              <span>Ran 3 commands, viewed a file, read a file</span>
              <IconChevron className={`reply__tools-chev${open ? ' is-open' : ''}`} />
            </Button>
            {open && (
              <ul className="reply__steps">
                <li>Read <code>brief/acme-mvp.md</code></li>
                <li>Ran <code>analyze --scope mvp</code></li>
                <li>Generated <code>prd/acme-mvp.md</code></li>
              </ul>
            )}

            <p className="reply__p">
              {INTRO.slice(0, wordsShown).map((w, i) => (
                <span key={i} className="reply__word">
                  {w}
                  {CITE_AFTER[i + 1] && <Tip label={`Source ${CITE_AFTER[i + 1]}: ${SOURCES[CITE_AFTER[i + 1] - 1].label}`} side="top"><sup className="cite">{CITE_AFTER[i + 1]}</sup></Tip>}{' '}
                </span>
              ))}
              {phase === 'streaming' && wordsShown < W && <span className="reply__caret" aria-hidden />}
            </p>

            {show(0) && <h2 className="reply__h reply__in">What&rsquo;s included:</h2>}
            {show(1) && (
              <p className="reply__note reply__in">
                <span className="reply__square" aria-hidden />
                10 sections covering:
              </p>
            )}
            {show(2) && (
              <ol className="reply__list">
                {sections.map((s, i) => (t >= at(2) + i * 2 ? <li key={i} className="reply__in">{s}</li> : null))}
              </ol>
            )}

            {t >= at(2) + sections.length * 2 && (
              <p className="reply__p reply__in">
                The PRD is tailored to the analytics/reporting space with realistic personas, feature
                prioritization, and a concrete implementation timeline. Feel free to customize it for
                your specific use case, target markets, or roadmap adjustments.
              </p>
            )}

            {t >= at(2) + sections.length * 2 + 3 && (
              <div className="reply__doc reply__in">
                <span className="reply__doc-thumb"><IconFile /></span>
                <div className="reply__doc-info">
                  <b>Acme PRD</b>
                  <small>Document · DOCX</small>
                </div>
                <Button variant="ghost" className="h-auto reply__doc-btn" onClick={onOpenDoc}>
                  <IconDownload /> Download &amp; open
                </Button>
              </div>
            )}

            {phase === 'streaming' && <span className="reply__streaming" role="status" aria-live="polite"><PixelLoader className="reply__mini" /> Writing</span>}
          </>
        )}

        {phase === 'done' && (
          <>
            <section className="reply__sources reply__in" aria-label="Sources">
              <span className="reply__label">Sources</span>
              {SOURCES.map((s) => (
                <button key={s.n} type="button" className="source" aria-label={`Source ${s.n}: ${s.label} (sample)`}>
                  <span className="source__n">{s.n}</span>
                  {s.kind === 'file' ? <IconFile className="source__i" /> : s.kind === 'folder' ? <IconFolder className="source__i" /> : <IconBook className="source__i" />}
                  <span className="source__t">{s.label}</span>
                </button>
              ))}
            </section>

            <div className="reply__actions reply__in" role="group" aria-label="Reply actions">
              <Tip label={copied ? 'Copied' : 'Copy'} side="top"><Button variant="ghost" className="h-auto reply__act" aria-label={copied ? 'Copied' : 'Copy reply'} onClick={copy}>
                {copied ? <IconCheck /> : <IconCopy />}
              </Button></Tip>
              <Tip label="Good reply" side="top"><Button variant="ghost" className={`h-auto reply__act${vote === 'up' ? ' is-on' : ''}`} aria-label="Good reply" aria-pressed={vote === 'up'} onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}>
                <IconThumbUp />
              </Button></Tip>
              <Tip label="Poor reply" side="top"><Button variant="ghost" className={`h-auto reply__act${vote === 'down' ? ' is-on' : ''}`} aria-label="Poor reply" aria-pressed={vote === 'down'} onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}>
                <IconThumbDown />
              </Button></Tip>
              <Tip label="Regenerate" side="top"><Button variant="ghost" className="h-auto reply__act" aria-label="Regenerate reply" onClick={() => setRun((r) => r + 1)}>
                <IconRefresh />
              </Button></Tip>
              <Tip label="Share" side="top"><Button variant="ghost" className="h-auto reply__act" aria-label="Share reply">
                <IconShare />
              </Button></Tip>
            </div>

            <div className="reply__followups reply__in" aria-label="Follow-up actions">
              {FOLLOW_UPS.map((f) => (
                <button key={f} type="button" className="followup" onClick={() => onFollowUp(f)}>
                  <IconFollow className="followup__i" />
                  <span>{f}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* Total streaming ticks: intro words + gap + blocks + list items + tail blocks. */
const LIST_COUNT = 10
const TOTAL_TICKS = INTRO.length + 2 + 2 * 3 + LIST_COUNT * 2 + 3 * 3 + 6
