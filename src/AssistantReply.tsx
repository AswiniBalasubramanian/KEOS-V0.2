import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ThinkingOrb } from 'thinking-orbs'
import { Button } from '@/components/ui/button'
import { Cite, CitationsProvider, SourceList } from './Citations'
import type { Source } from './Citations'
import { TableBlock, ChartBlock, CodeBlock, TABLE_CSV, CODE_TEXT } from './OutputBlocks'
import type { Stage } from './OutputBlocks'
import {
  IconChevron, IconFile, IconDownload, IconCopy, IconCheck,
  IconRefresh, IconShare, IconSearch, IconGlobe, IconThumbUp, IconThumbDown, IconFollow,
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

/* Logo-shaped dither: rasterise the mark to a small grid, then pulse the lit cells in a Bayer order. */
const GRID = 16
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const maskCache = new Map<string, boolean[]>()

function useLogoMask(src: string) {
  const [mask, setMask] = useState<boolean[] | null>(maskCache.get(src) ?? null)
  useEffect(() => {
    if (maskCache.has(src)) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = GRID
      c.height = GRID
      const ctx = c.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      const k = Math.min(GRID / img.width, GRID / img.height)
      const w = img.width * k, h = img.height * k
      ctx.drawImage(img, (GRID - w) / 2, (GRID - h) / 2, w, h)
      const d = ctx.getImageData(0, 0, GRID, GRID).data
      const m: boolean[] = []
      for (let i = 0; i < GRID * GRID; i++) m.push(d[i * 4 + 3] > 110)
      maskCache.set(src, m)
      setMask(m)
    }
    img.src = src
  }, [src])
  return mask
}

export function LogoLoader({ src, className = '' }: { src: string; className?: string }) {
  const mask = useLogoMask(src)
  if (!mask) return <PixelLoader className={className} />
  return (
    <span className={`logo-dither ${className}`} role="presentation" aria-hidden="true">
      {mask.map((on, i) => (
        <i key={i} className={on ? 'is-on' : undefined} style={on ? { ['--o' as string]: BAYER4[(i % GRID) % 4 + 4 * (Math.floor(i / GRID) % 4)] } : undefined} />
      ))}
    </span>
  )
}

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
  'Searching pod memory',
  'Checking the open risks',
  'Drafting the PRD',
]

/* The orb's motion follows what the assistant is doing at each step. */
type OrbState = 'working' | 'searching' | 'solving' | 'listening' | 'composing' | 'shaping'
const STEP_ORB: OrbState[] = ['listening', 'searching', 'solving', 'shaping']

const REASONING_TEXT =
  'Reading your scope and sources first. The brief describes an analytics and reporting SaaS platform that is in MVP, so the PRD should stay inside that scope. I will check pod memory for the scope freeze, look at the open risks, and then draft sections the team can act on.'

const INTRO = [
  'Done!', 'I’ve', 'created', 'a', 'comprehensive', 'PRD', 'for', 'Acme,', 'an', 'analytics',
  'and', 'reporting', 'SaaS', 'platform', 'currently', 'in', 'MVP', 'development.',
]
const CITE_AFTER: Record<number, number> = { 14: 1, 18: 2 } // word count -> source number, placed after the claim it backs

const SOURCES: Source[] = [
  {
    n: 1, title: 'brief/acme-mvp.md', publisher: 'Acme brief', kind: 'file', updated: '8 Oct 2026',
    claim: 'an analytics and reporting SaaS platform',
    snippet: 'Acme is an analytics and reporting SaaS platform for finance, ops and sales managers. The MVP covers a no-code dashboard builder and five data connectors.',
    quality: { label: 'Primary document', tone: 'strong' },
  },
  {
    n: 2, title: 'Ras Tanura scope freeze', publisher: 'Pod memory', kind: 'memory', updated: '2 Oct 2026',
    claim: 'currently in MVP development',
    snippet: 'Scope freeze confirmed for the MVP. Post-MVP items (SQL editing, AI insights, mobile) are parked until the beta review.',
    quality: { label: 'Team decision', tone: 'strong' },
  },
  {
    n: 3, title: 'Jubail ILI report', publisher: 'Jubail inspections', kind: 'folder', updated: '19 Sep 2026', flaky: true,
    claim: 'a concrete implementation timeline',
    snippet: 'A 12-week roadmap is proposed: dashboard first, then connectors, reporting and polish, with a beta of 100 testers.',
    quality: { label: 'Older, check before use', tone: 'medium' },
  },
]

/* Prompts that act outside the pod need a person to approve before KEOS goes on. */
const ACTIONS: { re: RegExp; key: string; what: string }[] = [
  { re: /\b(send|email|message|notify)\b/i, key: 'send', what: 'send a message from your account' },
  { re: /\b(share|publish|post)\b/i, key: 'publish', what: 'share this outside the pod' },
  { re: /\b(delete|remove|erase)\b/i, key: 'delete', what: 'delete data in this pod' },
  { re: /\b(deploy|release|ship)\b/i, key: 'deploy', what: 'deploy changes' },
  { re: /\b(export|download all)\b/i, key: 'export', what: 'export data from this pod' },
]
const ALLOW_KEY = 'keos-always-allow'
const alwaysAllowed = (key: string) => {
  try { return (JSON.parse(localStorage.getItem(ALLOW_KEY) ?? '[]') as string[]).includes(key) } catch { return false }
}
const saveAlways = (key: string) => {
  try {
    const v = new Set<string>(JSON.parse(localStorage.getItem(ALLOW_KEY) ?? '[]'))
    v.add(key)
    localStorage.setItem(ALLOW_KEY, JSON.stringify([...v]))
  } catch { /* storage blocked */ }
}

const STEPS = [
  { verb: 'Read', code: 'brief/acme-mvp.md' },
  { verb: 'Ran', code: 'analyze --scope mvp' },
  { verb: 'Generated', code: 'prd/acme-mvp.md' },
]

const FOLLOW_UPS = [
  'Break the PRD into user stories',
  'Draft the launch checklist',
  'List the top risks by severity',
]

type Kind = 'doc' | 'table' | 'chart' | 'code'
const detectKind = (p: string): Kind =>
  /\b(code|script|function|sql|python|snippet)\b/i.test(p) ? 'code'
  : /\b(chart|graph|plot|trend|manhours|vs\.?|versus)\b/i.test(p) ? 'chart'
  : /\b(table|compare|which|list|rank|contractors|behind)\b/i.test(p) ? 'table'
  : 'doc'

type Content = {
  sources: Source[]
  intro: string[]
  citeAfter: Record<number, number>
  reasoning: string
  steps: { verb: string; code: string }[]
  followUps: string[]
  closing: string
  closingAlt: string
  blockTicks: number
  total: number
}

const SOURCES_TABLE: Source[] = [
  { n: 1, title: 'milestones/week-41.xlsx', publisher: 'Contractor tracker', kind: 'file', updated: '8 Oct 2026', claim: 'four contractors are behind plan', snippet: 'Four of nine contractor packages report a milestone slip this week. The largest slip is the E-1104 bundle delivery at nine days.', quality: { label: 'Primary document', tone: 'strong' } },
  { n: 2, title: 'Weekly progress report', publisher: 'Jubail inspections', kind: 'folder', updated: '1 Oct 2026', claim: 'lowest progress is on the E-1104 bundle', snippet: 'E-1104 bundle delivery is at 52% against an 80% plan after the supplier slipped its dispatch date.', quality: { label: 'Older, check before use', tone: 'medium' } },
]
const SOURCES_CHART: Source[] = [
  { n: 1, title: 'manhours/ledger.csv', publisher: 'Manhours ledger', kind: 'file', updated: '8 Oct 2026', claim: 'actual hours ran above plan from week 3', snippet: 'Actual hours exceeded the baseline in every week from W3 to W7, peaking at 78k in W5 against a plan of 60k.', quality: { label: 'Primary document', tone: 'strong' } },
  { n: 2, title: 'Planning baseline v3', publisher: 'Pod memory', kind: 'memory', updated: '2 Oct 2026', claim: 'burn has eased since', snippet: 'Baseline v3 assumes a 60k peak in W4 and W5, then a steady fall as scaffold and insulation packages close.', quality: { label: 'Team decision', tone: 'strong' } },
]
const SOURCES_CODE: Source[] = [
  { n: 1, title: 'docs/api/export.md', publisher: 'Engineering docs', kind: 'file', updated: '29 Sep 2026', claim: 'the table can be exported as CSV', snippet: 'Exports use the standard csv module with a header row. Pass the destination path as the first argument.', quality: { label: 'Primary document', tone: 'strong' } },
]

type Props = {
  logo: string
  sections: string[]
  fresh: boolean
  onDone: () => void
  onTick: () => void
  onOpenDoc: () => void
  onFollowUp: (text: string) => void
  prompt?: string
  stopSignal?: number
  context?: string[]
}

type Phase = 'thinking' | 'awaiting' | 'streaming' | 'done' | 'error' | 'denied' | 'stopped'

export default function AssistantReply({ logo, sections, fresh, onDone, onTick, onOpenDoc, onFollowUp, prompt = '', stopSignal = 0, context }: Props) {
  const kind = useMemo(() => detectKind(prompt), [prompt])
  const C = CONTENT[kind]
  const RWk = useMemo(() => C.reasoning.split(' '), [C])
  const [blockFailed, setBlockFailed] = useState(false)
  const [vCount, setVCount] = useState(1)
  const [viewV, setViewV] = useState(1)
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [run, setRun] = useState(0)
  const [phase, setPhase] = useState<Phase>(fresh ? 'thinking' : 'done')
  const [step, setStep] = useState(0)
  const [t, setT] = useState(fresh ? 0 : 9999)
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [rWords, setRWords] = useState(0)
  const [thinkOpen, setThinkOpen] = useState(true)
  const [thoughtSecs, setThoughtSecs] = useState(0)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const thinkStart = useRef(0)
  const prevPhase = useRef<Phase>('done')
  const body = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  const tickRef = useRef(onTick)
  doneRef.current = onDone
  tickRef.current = onTick

  const action = useMemo(() => ACTIONS.find((a) => a.re.test(prompt)), [prompt])
  const approved = useRef(false)
  const timersRef = useRef<number[]>([])
  const tickerRef = useRef<number>()
  const card = useRef<HTMLDivElement>(null)
  const [expandedN, setExpandedN] = useState<number | null>(null)

  const clearAll = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
    if (tickerRef.current) window.clearInterval(tickerRef.current)
  }, [])

  const startStreaming = useCallback(() => {
    setPhase('streaming')
    let n = 0
    tickerRef.current = window.setInterval(() => {
      n += 1
      setT(n)
      tickRef.current()
      if (kind !== 'doc' && n === C.intro.length + 2 + 12 && !navigator.onLine) {
        window.clearInterval(tickerRef.current)
        setBlockFailed(true)
        setPhase('done')
        doneRef.current()
        return
      }
      if (n >= C.total) {
        window.clearInterval(tickerRef.current)
        setPhase('done')
        doneRef.current()
      }
    }, 45)
  }, [C, kind])

  // Timeline: thinking (rotating reasoning steps) -> [needs your input] -> streaming -> done
  useEffect(() => {
    if (!fresh && run === 0) return
    clearAll()
    setStep(0)
    setT(0)
    setRWords(0)
    setBlockFailed(false)
    setThinkOpen(true)
    setThoughtSecs(0)
    setSourcesOpen(false)
    thinkStart.current = Date.now()
    approved.current = !action || alwaysAllowed(action.key)
    if (!navigator.onLine) {
      setPhase('error')
      doneRef.current()
      return
    }
    setPhase('thinking')
    if (reduce) {
      timersRef.current.push(window.setTimeout(() => {
        if (!approved.current) { setPhase('awaiting'); return }
        setT(9999); setPhase('done'); doneRef.current()
      }, 500))
      return clearAll
    }
    const stepMs = 850
    REASONING.forEach((_, i) => { if (i > 0) timersRef.current.push(window.setTimeout(() => setStep(i), i * stepMs)) })
    timersRef.current.push(window.setTimeout(() => {
      if (approved.current) startStreaming()
      else setPhase('awaiting')
    }, REASONING.length * stepMs))
    return clearAll
  }, [fresh, run, reduce, action, clearAll, startStreaming])

  // Reasoning streams in word by word, then folds into "Thought for Ns"
  useEffect(() => {
    if (phase !== 'thinking') return
    if (reduce) { setRWords(RWk.length); return }
    const id = window.setInterval(() => setRWords((n) => Math.min(RWk.length, n + 1)), 72)
    return () => window.clearInterval(id)
  }, [phase, reduce, run, RWk])

  useEffect(() => {
    if (prevPhase.current === 'thinking' && phase !== 'thinking' && phase !== 'error') {
      setThoughtSecs(Math.max(1, Math.round((Date.now() - thinkStart.current) / 1000)))
      setThinkOpen(false)
    }
    prevPhase.current = phase
  }, [phase])

  const decide = useCallback((choice: 'deny' | 'always' | 'once') => {
    if (choice === 'deny') { clearAll(); setPhase('denied'); doneRef.current(); return }
    if (choice === 'always' && action) saveAlways(action.key)
    approved.current = true
    if (reduce) { setT(9999); setPhase('done'); doneRef.current() } else startStreaming()
  }, [action, clearAll, reduce, startStreaming])

  // Stop generating (composer Stop button or Escape)
  const lastStop = useRef(stopSignal)
  useEffect(() => {
    if (stopSignal === lastStop.current) return
    lastStop.current = stopSignal
    if (phase === 'thinking' || phase === 'streaming' || phase === 'awaiting') {
      clearAll()
      setPhase('stopped')
      doneRef.current()
    }
  }, [stopSignal, phase, clearAll])

  // Approval shortcuts: 1 deny, 2 always allow, 3 allow once, Esc deny, Ctrl+Enter allow once
  useEffect(() => {
    if (phase !== 'awaiting') return
    requestAnimationFrame(() => card.current?.focus())
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === 'Escape') { e.preventDefault(); decide('deny'); return }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); decide(e.shiftKey ? 'always' : 'once'); return }
      if (typing) return
      if (e.key === '1') decide('deny')
      else if (e.key === '2') decide('always')
      else if (e.key === '3') decide('once')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, decide])

  const reveal = (n: number) => {
    setExpandedN(n)
    setSourcesOpen(true)
    window.setTimeout(() => {
      const li = document.getElementById('source-' + n)
      li?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
      li?.querySelector<HTMLElement>('button')?.focus()
    }, 80)
  }

  const announce =
    phase === 'thinking' ? 'KEOS is thinking.'
    : phase === 'awaiting' ? 'KEOS needs your input to continue.'
    : phase === 'done' && fresh ? 'Reply complete. ' + C.sources.length + ' sources.'
    : phase === 'stopped' ? 'Generation stopped.'
    : phase === 'denied' ? 'Action denied. Nothing was changed.'
    : ''

  const loading = phase === 'thinking' || phase === 'streaming' || phase === 'awaiting'
  // Block schedule (in ticks): intro words first, then blocks every 3 ticks
  const W = C.intro.length
  const at = (i: number) => W + 2 + i * 3
  const show = (i: number) => t >= at(i)
  const wordsShown = Math.min(W, t)

  const copy = useCallback(() => {
    const text = kind === 'table' ? TABLE_CSV : kind === 'code' ? CODE_TEXT : kind === 'chart' ? C.intro.join(' ') : `Done! I’ve created a comprehensive PRD for Acme.\n\n${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }, [sections, kind, C])

  return (
    <CitationsProvider sources={C.sources} onReveal={reveal}>
    <div className="msg msg--assistant" aria-busy={loading && phase !== 'awaiting'}>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
      {phase === 'thinking' && step === 0 ? <LogoLoader src={logo} className="reply__avatar reply__avatar--loading" /> : (phase === 'thinking' || phase === 'streaming') ? <span className="reply__avatar reply__avatar--loading reply__avatar--orb" role="presentation" aria-hidden="true"><ThinkingOrb key={phase + step} state={phase === 'thinking' ? STEP_ORB[step] : 'composing'} size={20} paused={reduce} /></span> : <img className="reply__avatar" src={logo} alt="" aria-hidden />}
      <div className="reply__body" ref={body}>
        {(phase === 'thinking' || ((phase === 'awaiting' || phase === 'streaming' || phase === 'done' || phase === 'stopped') && thoughtSecs > 0)) && (
          <div className="think reply__in">
            <button type="button" className="think__head" aria-expanded={thinkOpen} aria-controls="think-body" onClick={() => setThinkOpen((v) => !v)}>
              <span className={phase === 'thinking' ? 'reply__shimmer' : undefined}>{phase === 'thinking' ? 'Thinking' : 'Thought for ' + thoughtSecs + 's'}</span>
              <IconChevron className={'think__chev' + (thinkOpen ? '' : ' is-closed')} />
            </button>
            <AnimatePresence initial={false}>
              {thinkOpen && (
                <motion.div
                  id="think-body"
                  className="think__body"
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0.12 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p>{phase === 'thinking' ? RWk.slice(0, rWords).join(' ') : C.reasoning}{phase === 'thinking' && rWords < RWk.length && <span className="reply__caret" aria-hidden />}</p>
                  {phase !== 'thinking' && (
                    <ul className="think__steps">
                      <li><IconSearch /> Searched {C.sources.length} sources</li>
                      {C.steps.map((st) => <li key={st.code}><IconCheck /> {st.verb} <code>{st.code}</code></li>)}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {(phase === 'streaming' || phase === 'done' || (phase === 'stopped' && t > 0)) && (
          <>

            <p className="reply__p">
              {C.intro.slice(0, wordsShown).map((w, i) => (
                <span key={i} className="reply__word">
                  {w}
                  {C.citeAfter[i + 1] && <Cite n={C.citeAfter[i + 1]} />}{' '}
                </span>
              ))}
              {phase === 'streaming' && wordsShown < W && <span className="reply__caret" aria-hidden />}
            </p>

            {kind === 'doc' && (
              <>
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
                prioritization, and a concrete implementation timeline<Cite n={3} />. Feel free to customize it for
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

              </>
            )}

            {kind !== 'doc' && t >= W + 2 && (() => {
              const bt = t - (W + 2)
              const stage: Stage = blockFailed ? 'error' : bt < 12 ? 'skeleton' : 'ready'
              const progress = phase === 'done' && !blockFailed ? 1 : bt < 12 ? 0 : Math.min(1, (bt - 12) / C.blockTicks)
              const Block = kind === 'table' ? TableBlock : kind === 'chart' ? ChartBlock : CodeBlock
              return (
                <>
                  <div className="reply__in"><Block stage={stage} progress={progress} onRetry={() => setRun((r) => r + 1)} /></div>
                  {stage === 'ready' && progress >= 1 && <p key={viewV} className="reply__p reply__in">{viewV % 2 === 0 ? C.closingAlt : C.closing}</p>}
                </>
              )
            })()}

            {phase === 'streaming' && <span className="reply__streaming" role="status" aria-live="polite"><span className="reply__shimmer">Writing</span></span>}
          </>
        )}

        {phase === 'awaiting' && action && (
          <>
            <div className="reply__needs" role="status"><span className="reply__needs-dot" aria-hidden /> <span className="reply__needs-chip">Needs your input</span></div>
            {(() => {
              const slot = document.getElementById('approval-slot')
              const el = (
                <div className="approve" ref={card} tabIndex={-1} role="group" aria-labelledby="approve-title" aria-describedby="approve-desc">
                  <h3 id="approve-title" className="approve__title">Allow KEOS to {action.what}?</h3>
                  <p id="approve-desc" className="approve__desc">Allow once applies to this reply only. Always allow saves your choice on this device. KEOS won’t do anything else outside this pod without asking.</p>
                  <div className="approve__actions">
                    <Button variant="ghost" className="h-auto approve__btn" onClick={() => decide('deny')}>Deny <kbd>1</kbd><kbd>Esc</kbd></Button>
                    <span className="approve__spacer" />
                    <Button variant="ghost" className="h-auto approve__btn" onClick={() => decide('always')}>Always allow <kbd>2</kbd></Button>
                    <Button variant="ghost" className="h-auto approve__btn approve__btn--primary" onClick={() => decide('once')}>Allow once <kbd>3</kbd><kbd>Ctrl ⏎</kbd></Button>
                  </div>
                </div>
                  )
              return slot ? createPortal(el, slot) : el
            })()}
          </>
        )}

        {phase === 'done' && vCount > 1 && viewV < vCount && (
          <div className="reply__stopped reply__in" role="status">
            <p><b>Earlier version.</b> You are viewing version {viewV} of {vCount}.</p>
            <Button variant="ghost" className="h-auto reply__retry" onClick={() => setViewV(vCount)}>Back to latest</Button>
          </div>
        )}

        {phase === 'denied' && (
          <div className="reply__stopped" role="status">
            <p><b>Action denied.</b> Nothing was changed.</p>
            <Button variant="ghost" className="h-auto reply__retry" onClick={() => setRun((r) => r + 1)}><IconRefresh /> Ask again</Button>
          </div>
        )}

        {phase === 'stopped' && (
          <div className="reply__stopped" role="status">
            <p><b>Stopped.</b> {t > 0 ? 'This is what was written so far.' : 'No reply was written.'}</p>
            <Button variant="ghost" className="h-auto reply__retry" onClick={() => setRun((r) => r + 1)}><IconRefresh /> {t > 0 ? 'Regenerate' : 'Try again'}</Button>
          </div>
        )}

        {phase === 'error' && (
          <div className="reply__error" role="alert">
            <p><b>This reply didn’t finish.</b> KEOS can’t reach the network. Check your connection, then try again.</p>
            <Button variant="ghost" className="h-auto reply__retry" onClick={() => setRun((r) => r + 1)}><IconRefresh /> Try again</Button>
          </div>
        )}

        {phase === 'done' && (
          <>
            {sourcesOpen && <SourceList sources={C.sources} expandedN={expandedN} onToggle={(n) => setExpandedN((c) => (c === n ? null : n))} />}

            <p className="reply__context reply__in"><span>Context used</span> {(context && context.length ? context : ['Scope: Pod']).join(' · ')}</p>

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
              <Tip label="Regenerate" side="top"><Button variant="ghost" className="h-auto reply__act" aria-label="Regenerate reply" onClick={() => { setVCount((c) => c + 1); setViewV(vCount + 1); setRun((r) => r + 1) }}>
                <IconRefresh />
              </Button></Tip>
              <Tip label="Share" side="top"><Button variant="ghost" className="h-auto reply__act" aria-label="Share reply">
                <IconShare />
              </Button></Tip>
              <Button variant="ghost" className={'h-auto reply__act reply__act--text' + (sourcesOpen ? ' is-on' : '')} aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((v) => !v)}>
                <IconGlobe /> {C.sources.length} sources
              </Button>
              {vCount > 1 && (
                <span className="reply__pager" role="group" aria-label="Answer versions">
                  <Button variant="ghost" className="h-auto reply__act" aria-label="Previous version" disabled={viewV <= 1} onClick={() => setViewV((v) => Math.max(1, v - 1))}><IconChevron className="reply__pager-prev" /></Button>
                  <span aria-live="polite">{viewV} / {vCount}</span>
                  <Button variant="ghost" className="h-auto reply__act" aria-label="Next version" disabled={viewV >= vCount} onClick={() => setViewV((v) => Math.min(vCount, v + 1))}><IconChevron className="reply__pager-next" /></Button>
                </span>
              )}
              <span className="reply__model">Atlas</span>
            </div>

            <div className="reply__followups reply__in" aria-label="Follow-up actions">
              {C.followUps.map((f) => (
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
    </CitationsProvider>
  )
}

/* Total streaming ticks: intro words + gap + blocks + list items + tail blocks. */
const LIST_COUNT = 10
const TOTAL_TICKS = INTRO.length + 2 + 2 * 3 + LIST_COUNT * 2 + 3 * 3 + 6


const CONTENT: Record<Kind, Content> = {
  doc: {
    sources: SOURCES,
    intro: INTRO,
    citeAfter: CITE_AFTER,
    reasoning: REASONING_TEXT,
    steps: STEPS,
    followUps: FOLLOW_UPS,
    closing: '',
    closingAlt: '',
    blockTicks: 0,
    total: TOTAL_TICKS,
  },
  table: {
    sources: SOURCES_TABLE,
    intro: ['Four', 'contractors', 'are', 'behind', 'plan', 'this', 'week.', 'The', 'lowest', 'progress', 'is', 'on', 'the', 'E-1104', 'bundle.'],
    citeAfter: { 7: 1, 15: 2 },
    reasoning: 'Reading the contractor milestones for this week first. I will compare each package against its plan, count the days late, and rank the contractors so the biggest slips come first. Then I will flag who is at risk but not yet behind.',
    steps: [{ verb: 'Read', code: 'milestones/week-41.xlsx' }, { verb: 'Ran', code: 'filter --status behind' }, { verb: 'Ranked', code: 'by days late' }],
    followUps: ['Draft a nudge to the four contractors', 'Show only the packages at risk', 'Compare with last week'],
    closingAlt: 'Gulf Piping Co. is nine days late, the most of any contractor. Start there, then work down the list. Download the table if you want to share it.',
    closing: 'Gulf Piping Co. is the biggest slip at nine days late. Sort any column, filter by name, or download the table as a CSV.',
    blockTicks: 22,
    total: 15 + 2 + 12 + 22 + 8,
  },
  chart: {
    sources: SOURCES_CHART,
    intro: ['Actual', 'manhours', 'ran', 'above', 'plan', 'from', 'week', '3,', 'peaking', 'in', 'week', '5.', 'Burn', 'has', 'eased', 'since.'],
    citeAfter: { 12: 1, 16: 2 },
    reasoning: 'Reading the manhours ledger first. I will total the hours by week, line them up against the planning baseline, and look for where the two lines part. A chart with a table view suits this best, so each week can be read exactly.',
    steps: [{ verb: 'Read', code: 'manhours/ledger.csv' }, { verb: 'Ran', code: 'aggregate --by week' }, { verb: 'Built', code: 'bar and line views' }],
    followUps: ['Break the overrun down by contractor', 'Forecast the next four weeks', 'Show cost instead of hours'],
    closingAlt: 'The gap is widest in week 5. Check each week in the Table view, or copy the data to compare it elsewhere.',
    closing: 'Hover or focus a week to read its exact values. Switch to Table for the numbers, or copy the data as CSV.',
    blockTicks: 14,
    total: 16 + 2 + 12 + 14 + 8,
  },
  code: {
    sources: SOURCES_CODE,
    intro: ['Here’s', 'a', 'script', 'that', 'exports', 'the', 'table', 'to', 'CSV.'],
    citeAfter: { 9: 1 },
    reasoning: 'Reading the export notes first. The table needs a header row and one line per package, so the standard csv module is enough and adds no dependency. I will keep the script short and take the file path as an argument.',
    steps: [{ verb: 'Read', code: 'docs/api/export.md' }, { verb: 'Wrote', code: 'export_table.py' }],
    followUps: ['Add error handling for a missing path', 'Write a test for it', 'Export to Excel instead'],
    closingAlt: 'Pass the output path when you run it. The script writes a header row first, then one line per package.',
    closing: 'Run it with the destination path, for example python export_table.py out.csv. Copy the code with the button above.',
    blockTicks: 28,
    total: 9 + 2 + 12 + 28 + 8,
  },
}
