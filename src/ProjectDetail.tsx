import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Tip from './Tip'
import { Tabs, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import './ProjectDetail.css'
import {
  IconChat, IconSettings, IconExternal,
  IconExpand, IconPlus, IconMinus, IconRefresh, IconSearch, IconClose,
  IconFile, IconBook, IconServer, IconGavel, IconCalendar, IconList, IconOntology,
} from './icons'

const A = '/assets'
const BRAIN_IMG = `${A}/brain-3d.svg`

/* Dot positions as % of the brain stage box — tuned to sit on a roughly
   brain-shaped silhouette (frontal / temporal / occipital / cerebellum). */
const BRAIN_DOTS: Record<Kind, [number, number]> = {
  fact: [28, 38],
  instruction: [55, 18],
  infrastructure: [76, 42],
  decision: [64, 76],
  event: [38, 84],
}

/* Purely decorative "neural activity" dots scattered across the brain
   surface — fixed (not re-randomized per render), non-interactive. */
const AMBIENT_DOTS: { x: number; y: number; size: number; delay: number }[] = [
  { x: 22, y: 22, size: 4, delay: 0 },
  { x: 45, y: 12, size: 3, delay: 0.4 },
  { x: 68, y: 20, size: 5, delay: 0.9 },
  { x: 82, y: 33, size: 3, delay: 1.3 },
  { x: 60, y: 58, size: 4, delay: 0.2 },
  { x: 33, y: 62, size: 3, delay: 1.6 },
  { x: 18, y: 55, size: 4, delay: 0.7 },
  { x: 50, y: 40, size: 3, delay: 1.1 },
  { x: 72, y: 65, size: 4, delay: 1.9 },
  { x: 40, y: 78, size: 3, delay: 0.5 },
  { x: 88, y: 55, size: 3, delay: 1.4 },
  { x: 28, y: 40, size: 3, delay: 0.9 },
]

type Kind = 'fact' | 'instruction' | 'infrastructure' | 'decision' | 'event'
type Selected = 'core' | Kind

type CatMeta = {
  label: string
  color: string
  soft: string
  Icon: (p: { className?: string }) => JSX.Element
  count: number
  edgeLabel: string
}

const catVars = (c: CatMeta) => ({ '--cat': c.color, '--cat-soft': c.soft }) as CSSProperties

const CATS: Record<Kind, CatMeta> = {
  fact: { label: 'Fact', color: '#d98a3d', soft: '#fbeee0', Icon: IconFile, count: 35, edgeLabel: 'current state' },
  instruction: { label: 'Instruction', color: '#3aa86b', soft: '#e5f6ec', Icon: IconBook, count: 5, edgeLabel: 'guides' },
  infrastructure: { label: 'Infrastructure', color: '#3f7fd9', soft: '#e7f0fd', Icon: IconServer, count: 6, edgeLabel: 'affects' },
  decision: { label: 'Decision', color: '#8b5fd6', soft: '#f0eafb', Icon: IconGavel, count: 2, edgeLabel: 'decided as' },
  event: { label: 'Event', color: '#e0525c', soft: '#fbe9ea', Icon: IconCalendar, count: 2, edgeLabel: 'observed in' },
}

type MemItem = { kind: Kind; title: string; body: string }
const ITEMS: MemItem[] = [
  { kind: 'fact', title: 'SAP S/4HANA Adoption', body: 'SAP system has zero CDS view adoption and zero test classes.' },
  { kind: 'instruction', title: 'Custom Code Modernization', body: 'Identify non-modernisation, classic ABAP codebase.' },
  { kind: 'infrastructure', title: 'Transport in SAP', body: 'Transport activity in SAP is heavily manual.' },
  { kind: 'decision', title: 'Migration Strategy', body: 'S/4HANA migration work will be applied to custom code.' },
  { kind: 'event', title: '90 Days Transport Activity', body: 'Transport freeze window observed across three change cycles ahead of cutover.' },
]
const itemOf = (k: Kind) => ITEMS.find((i) => i.kind === k)!

/* Node positions in a fixed 1000x620 coordinate space — kept in lockstep
   with the SVG viewBox below so percentage-positioned HTML nodes and the
   SVG connector lines never drift apart regardless of render width. */
const POS: Record<'core' | Kind, [number, number]> = {
  core: [500, 330],
  instruction: [500, 110],
  infrastructure: [830, 230],
  decision: [710, 530],
  event: [290, 530],
  fact: [170, 230],
}
const DOTS: Partial<Record<Kind, { pos: [number, number]; label?: string }>> = {
  fact: { pos: [40, 330], label: 'includes' },
  infrastructure: { pos: [960, 190], label: 'implemented in' },
  decision: { pos: [860, 610] },
  event: { pos: [140, 610] },
}

const TABS: { id: string; label: string; count?: number }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agents', count: 5 },
  { id: 'skills', label: 'Skills', count: 4 },
  { id: 'connectors', label: 'Connectors', count: 6 },
  { id: 'kb', label: 'Knowledge base', count: 6 },
  { id: 'threads', label: 'Threads', count: 4 },
  { id: 'memory', label: 'Memory', count: 4 },
]

export default function ProjectDetail() {
  const [tab, setTab] = useState('memory')
  const [memView, setMemView] = useState<'list' | 'graph'>('graph')
  const [filter, setFilter] = useState<'all' | Kind>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Selected>('core')
  const [zoom, setZoom] = useState(1)
  const [tipOpen, setTipOpen] = useState(true)
  const [graphPage, setGraphPage] = useState<1 | 2 | 3>(1)
  const [revealedKind, setRevealedKind] = useState<Kind | null>(null)

  const total = Object.values(CATS).reduce((n, c) => n + c.count, 0)

  const matches = (k: Kind) => {
    const passFilter = filter === 'all' || filter === k
    const q = query.trim().toLowerCase()
    const passQuery = !q || CATS[k].label.toLowerCase().includes(q) || itemOf(k).title.toLowerCase().includes(q)
    return passFilter && passQuery
  }

  const listRows = useMemo(
    () => ITEMS.filter((i) => matches(i.kind)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, query],
  )

  return (
    <div className="pd">
      <header className="pd__header">
        <div className="pd__title-row">
          <h1 className="pd__title">Aramco Ras Tanura Turnaround (TAR-2026)</h1>
          <span className="pd__badge">Active</span>
          <span className="pd__updated">Updated 16 days ago</span>
          <div className="pd__header-right">
            <div className="pd__avatars">
              <span className="pd__avatar" style={{ background: 'var(--accent-solid)' }}>R</span>
              <span className="pd__avatar" style={{ background: '#3f7fd9' }}>S</span>
              <span className="pd__avatar" style={{ background: '#3aa86b' }}>K</span>
              <span className="pd__avatar-more">+120</span>
            </div>
            <Button variant="ghost" className="h-auto pd__btn"><IconChat /> Chat</Button>
            <Button variant="ghost" className="h-auto pd__btn pd__btn--accent"><IconSettings /> Configure pod</Button>
          </div>
        </div>
        <p className="pd__subtitle">
          Planning and execution of the CDU-1/FCC turnaround at Ras Tanura Refinery: scope
          freeze, work orders, permits, and inspection findings tracked in one place.
        </p>

        <Tabs value={tab} onValueChange={setTab} className="pd__tabs">
          <TabsList aria-label="Pod sections">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
                {t.count != null && <span className="pd__tab-count">{t.count}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <div className="pd__body">
        {tab !== 'memory' ? (
          <div className="pd__placeholder">
            <p>{TABS.find((t) => t.id === tab)?.label} will appear here soon. Try Memory to see what is ready.</p>
          </div>
        ) : (
          <>
            <div className="pd__mem-head">
              <div>
                <h2>Pod memory</h2>
                <p>What your agents remember about this pod, shared with every agent.</p>
              </div>
              <div className="pd__mem-actions">
                <div className="pd__seg">
                  <Tip label="List view" side="bottom"><Button variant="ghost" aria-label="List view" className={`h-auto ${memView === 'list' ? 'is-active' : ''}`} onClick={() => setMemView('list')}>
                    <IconList />
                  </Button></Tip>
                  <Tip label="Graph view" side="bottom"><Button variant="ghost" aria-label="Graph view" className={`h-auto ${memView === 'graph' ? 'is-active' : ''}`} onClick={() => setMemView('graph')}>
                    <IconOntology />
                  </Button></Tip>
                </div>
                <Button variant="ghost" className="h-auto pd__btn pd__btn--accent pd__btn--solid">
                  <IconExternal /> Export to pods
                </Button>
              </div>
            </div>

            <div className="pd__filters">
              <Button variant="ghost" className={`h-auto mem-filter${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>
                All <b>({total})</b>
              </Button>
              {(Object.keys(CATS) as Kind[]).map((k) => (
                <Button variant="ghost" 
                  key={k}
                  className={`h-auto mem-filter${filter === k ? ' is-active' : ''}`}
                  onClick={() => setFilter(k)}
                >
                  <span className="mem-filter__dot" style={{ background: CATS[k].color }} />
                  {CATS[k].label} <b>({CATS[k].count})</b>
                </Button>
              ))}
            </div>

            {memView === 'list' ? (
              <div className="pd__list-wrap">
                <div className="pd__list-toolbar">
                  <div className="pd__search">
                    <IconSearch />
                    <Input
                      className="h-auto"
                      placeholder="Search memories"
                      aria-label="Search memories"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <Table className="mem-table">
                  <TableHeader>
                    <TableRow><TableHead>Type</TableHead><TableHead>Title</TableHead><TableHead>Description</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {listRows.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="mem-table__empty">No memories match. Clear a filter or try another search.</TableCell></TableRow>
                    ) : (
                      listRows.map((it) => (
                        <TableRow key={it.kind} onClick={() => setSelected(it.kind)}>
                          <TableCell>
                            <span className="mem-tag cat-chip" style={catVars(CATS[it.kind])}>
                              {CATS[it.kind].label}
                            </span>
                          </TableCell>
                          <TableCell className="mem-table__title">{it.title}</TableCell>
                          <TableCell className="mem-table__body">{it.body}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="pd__graph-row">
                <div className="pd__graph-card">
                  <div className="pd__graph-toolbar">
                    <Tip label="Reset view" side="bottom"><Button variant="ghost" className="h-auto" aria-label="Expand" onClick={() => setZoom(1)}><IconExpand /></Button></Tip>
                    <Tip label="Zoom in" side="bottom"><Button variant="ghost" className="h-auto" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}><IconPlus /></Button></Tip>
                    <Tip label="Zoom out" side="bottom"><Button variant="ghost" className="h-auto" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}><IconMinus /></Button></Tip>
                    <Tip label="Reset graph" side="bottom"><Button variant="ghost" className="h-auto" aria-label="Reset" onClick={() => { setZoom(1); setSelected('core'); setQuery('') }}><IconRefresh /></Button></Tip>
                    <div className="pd__search pd__search--toolbar">
                      <IconSearch />
                      <Input
                        className="h-auto"
                        placeholder="Search memories"
                      aria-label="Search memories"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pd__graph-pages">
                    <SegmentedControl
                      label="Graph style"
                      value={String(graphPage)}
                      onValueChange={(v) => setGraphPage(Number(v) as 1 | 2 | 3)}
                      options={[
                        { value: '1', label: 'Classic' },
                        { value: '2', label: 'Minimal' },
                        { value: '3', label: 'Neon' },
                      ]}
                    />
                  </div>

                  {tipOpen && (
                    <div className="brain-tip">
                      <span><b>Tip:</b> Drag to rotate, scroll to zoom, click a dot for details.</span>
                      <Button variant="ghost" className="h-auto" aria-label="Dismiss tip" onClick={() => setTipOpen(false)}><IconClose /></Button>
                    </div>
                  )}

                  <div className={`mem-graph${graphPage === 3 ? ' mem-graph--neon' : ''}`}>
                    <div
                      className="mem-graph__canvas"
                      style={{ transform: `scale(${zoom})` }}
                      onMouseLeave={() => setRevealedKind(null)}
                    >
                      <svg className="mem-graph__lines" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet">
                        {(Object.keys(CATS) as Kind[]).map((k) => {
                          const [x1, y1] = POS.core
                          const [x2, y2] = POS[k]
                          const mx = (x1 + x2) / 2
                          const my = (y1 + y2) / 2
                          const shown = revealedKind === k
                          return (
                            <g
                              key={k}
                              opacity={(shown ? 1 : 0) * (matches(k) ? 1 : 0.25)}
                              className="mem-edge-fade"
                            >
                              <line
                                x1={x1} y1={y1} x2={x2} y2={y2}
                                className={`mem-edge${graphPage === 3 ? ' mem-edge--neon' : ''}`}
                                style={graphPage === 3 ? { stroke: CATS[k].color, color: CATS[k].color } : undefined}
                              />
                              <text
                                x={mx} y={my - 8}
                                className={`mem-edge__label${graphPage === 3 ? ' mem-edge__label--neon' : ''}`}
                                style={graphPage === 3 ? { fill: CATS[k].color, color: CATS[k].color } : undefined}
                              >
                                {CATS[k].edgeLabel}
                              </text>
                            </g>
                          )
                        })}
                        {(Object.keys(DOTS) as Kind[]).map((k) => {
                          const dot = DOTS[k]!
                          const [x1, y1] = POS[k]
                          const [x2, y2] = dot.pos
                          const shown = revealedKind === k
                          return (
                            <g key={`dot-${k}`} opacity={(shown ? 1 : 0) * (matches(k) ? 1 : 0.25)} className="mem-edge-fade">
                              <line x1={x1} y1={y1} x2={x2} y2={y2} className="mem-edge mem-edge--sub" />
                              {dot.label && (
                                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} className="mem-edge__label">
                                  {dot.label}
                                </text>
                              )}
                              <circle cx={x2} cy={y2} r={7} fill={CATS[k].color} />
                            </g>
                          )
                        })}
                      </svg>

                      <BrainCore
                        selected={selected}
                        onSelectCore={() => setSelected('core')}
                        onSelectDot={(k) => setSelected(k)}
                        style={{ left: `${POS.core[0] / 10}%`, top: `${(POS.core[1] / 620) * 100}%` }}
                        onDotHover={(k) => setRevealedKind(k)}
                        variant={graphPage === 1 ? 'node' : 'plain'}
                        neon={graphPage === 3}
                        imgSrc={graphPage === 3 ? `${A}/brain-neon.svg` : undefined}
                      />

                      {(Object.keys(CATS) as Kind[]).map((k) => {
                        const cat = CATS[k]
                        const [x, y] = POS[k]
                        const shown = revealedKind === k
                        return (
                          <Button variant="ghost" 
                            key={k}
                            className={`h-auto mem-node${selected === k ? ' is-selected' : ''} mem-cat-node${shown ? ' is-shown' : ' is-hidden'}${graphPage === 3 ? ' mem-node--neon' : ''}`}
                            style={{
                              left: `${x / 10}%`,
                              top: `${(y / 620) * 100}%`,
                              opacity: shown ? (matches(k) ? 1 : 0.35) : 0,
                              transitionDelay: shown ? '0.2s' : '0s',
                              ...(graphPage === 3 ? ({ '--glow': cat.color } as CSSProperties) : {}),
                            }}
                            onClick={() => setSelected(k)}
                          >
                            <span
                              className={`mem-node__icon${graphPage === 3 ? '' : ' cat-chip'}`}
                              style={
                                graphPage === 3
                                  ? { background: 'var(--bg-elevated)', color: cat.color, borderColor: cat.color }
                                  : { ...catVars(cat), borderColor: cat.color }
                              }
                            >
                              <cat.Icon />
                            </span>
                            <span className="mem-node__label">{cat.label}<br />{cat.count}</span>
                          </Button>
                        )
                      })}

                      {(Object.keys(CATS) as Kind[]).map((k) => {
                        const item = itemOf(k)
                        const cat = CATS[k]
                        const [x, y] = POS[k]
                        const cardOffset = CARD_OFFSET[k]
                        const shown = revealedKind === k
                        return (
                          <Button variant="ghost" 
                            key={`card-${k}`}
                            className={`h-auto mem-card${shown ? ' is-shown' : ' is-hidden'}${graphPage === 3 ? ' mem-card--neon' : ''}`}
                            style={{
                              left: `${(x + cardOffset[0]) / 10}%`,
                              top: `${((y + cardOffset[1]) / 620) * 100}%`,
                              opacity: shown ? (matches(k) ? 1 : 0.35) : 0,
                              transitionDelay: shown ? '0.4s' : '0s',
                              ...(graphPage === 3 ? ({ '--glow': cat.color } as CSSProperties) : {}),
                            }}
                            onClick={() => setSelected(k)}
                          >
                            <span className="mem-card__tag cat-text" style={catVars(cat)}>
                              <span className="mem-card__dot" style={{ background: cat.color }} /> {cat.label.toUpperCase()}
                            </span>
                            <b>{item.title}</b>
                            <small>{item.body}</small>
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <DetailPanel selected={selected} onSelect={setSelected} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* Card offsets (dx, dy in the 1000x620 space) relative to their category node. */
const CARD_OFFSET: Record<Kind, [number, number]> = {
  fact: [-90, -130],
  instruction: [70, -100],
  infrastructure: [70, -110],
  decision: [110, 60],
  event: [10, 130],
}

/* Rotatable-feeling Core Context node: drag to tilt in 3D, scroll to zoom,
   click a dot to inspect that memory category. Falls back to the plain
   gradient orb until a real render lands at BRAIN_IMG. */
function BrainCore({
  selected,
  onSelectCore,
  onSelectDot,
  style,
  variant = 'node',
  onDotHover,
  neon = false,
  imgSrc = BRAIN_IMG,
}: {
  selected: Selected
  onSelectCore: () => void
  onSelectDot: (k: Kind) => void
  style?: CSSProperties
  variant?: 'node' | 'plain'
  neon?: boolean
  onDotHover?: (k: Kind | null) => void
  imgSrc?: string
}) {
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [imgSrc])
  const [rot, setRot] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [hoverKind, setHoverKind] = useState<Kind | null>(null)
  const dragRef = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cycleRef = useRef<number | null>(null)

  const ORDER: Kind[] = ['fact', 'instruction', 'infrastructure', 'decision', 'event']
  const startCycle = () => {
    if (cycleRef.current != null) return
    let i = 0
    onDotHover?.(ORDER[0])
    cycleRef.current = window.setInterval(() => {
      i = (i + 1) % ORDER.length
      onDotHover?.(ORDER[i])
    }, 2200)
  }
  const stopCycle = () => {
    if (cycleRef.current != null) {
      window.clearInterval(cycleRef.current)
      cycleRef.current = null
    }
  }
  useEffect(() => () => stopCycle(), [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(1.6, Math.max(0.75, z - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: ReactPointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    setRot({ x: d.rx - dy * 0.5, y: d.ry + dx * 0.5 })
  }
  const endDrag = () => { dragRef.current = null }

  return (
    <div
      className={`mem-node mem-node--core${variant === 'plain' ? ' mem-node--core-plain' : ''}${selected === 'core' ? ' is-selected' : ''}`}
      style={style}
    >
      <div
        ref={stageRef}
        className={`brain-viewer${variant === 'plain' ? ' brain-viewer--plain' : ''}${neon ? ' brain-viewer--neon' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClick={onSelectCore}
        onMouseEnter={startCycle}
        onMouseLeave={stopCycle}
      >
        <div
          className="brain-viewer__stage"
          style={{ transform: `perspective(700px) rotateX(${rot.x}deg) rotateY(${rot.y}deg) scale(${zoom})` }}
        >
          {imgOk ? (
            <img
              src={imgSrc}
              alt="Core context"
              className="brain-viewer__img"
              draggable={false}
              onError={() => setImgOk(false)}
            />
          ) : (
            <span className="mem-node__core-orb" />
          )}
          {AMBIENT_DOTS.map((d, i) => (
            <span
              key={i}
              className="brain-glow-dot"
              style={{
                left: `${d.x}%`,
                top: `${d.y}%`,
                width: d.size,
                height: d.size,
                animationDelay: `${d.delay}s`,
              }}
            />
          ))}
          {(Object.keys(CATS) as Kind[]).map((k) => {
            const [x, y] = BRAIN_DOTS[k]
            return (
              <Button variant="ghost" 
                key={k}
                className={`h-auto brain-dot${selected === k ? ' is-selected' : ''}${variant === 'plain' ? ' brain-dot--plain' : ''}`}
                style={{ left: `${x}%`, top: `${y}%`, background: CATS[k].color, color: CATS[k].color }}
                onClick={(e) => { e.stopPropagation(); onSelectDot(k) }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={() => { setHoverKind(k); onDotHover?.(k) }}
                onMouseLeave={() => setHoverKind(null)}
                onFocus={() => { setHoverKind(k); onDotHover?.(k) }}
                onBlur={() => setHoverKind(null)}
              />
            )
          })}
          {hoverKind && (() => {
            const cat = CATS[hoverKind]
            const item = itemOf(hoverKind)
            const [x, y] = BRAIN_DOTS[hoverKind]
            return (
              <div
                className="brain-dot-tip"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, calc(-100% - 14px)) rotateY(${-rot.y}deg) rotateX(${-rot.x}deg)`,
                }}
              >
                <span className="brain-dot-tip__tag cat-chip" style={catVars(cat)}>
                  {cat.label.toUpperCase()}
                </span>
                <b>{item.title}</b>
                <small>{item.body}</small>
              </div>
            )
          })()}
        </div>
      </div>
      {variant !== 'plain' && (
        <Button variant="ghost" className="h-auto mem-node__label mem-node__label--btn" onClick={onSelectCore}>
          CORE CONTEXT
        </Button>
      )}
    </div>
  )
}

function DetailPanel({ selected, onSelect }: { selected: Selected; onSelect: (s: Selected) => void }) {
  if (selected === 'core') {
    return (
      <aside className="pd__detail">
        <div className="pd__detail-head">
          <span className="pd__detail-icon">
            <span className="mem-node__core-orb mem-node__core-orb--sm" />
          </span>
          <div>
            <b>Aramco</b>
            <span className="pd__detail-tag">CORE CONTEXT</span>
          </div>
        </div>
        <p className="pd__detail-desc">
          This is the central context node that connects key facts, events, decisions, and
          instructions extracted from agent conversations.
        </p>
        <div className="pd__detail-section">
          <span className="pd__detail-label">Connected insights</span>
          {(Object.keys(CATS) as Kind[]).map((k) => (
            <Button variant="ghost" key={k} className="h-auto pd__detail-row" onClick={() => onSelect(k)}>
              <span><span className="mem-filter__dot" style={{ background: CATS[k].color }} /> {CATS[k].label}</span>
              <span className="pd__detail-count">{CATS[k].count}</span>
            </Button>
          ))}
        </div>
        <div className="pd__detail-section">
          <span className="pd__detail-label">Top connections</span>
          {(Object.keys(CATS) as Kind[]).slice(0, 3).map((k) => (
            <Button variant="ghost" key={k} className="h-auto pd__detail-row" onClick={() => onSelect(k)}>
              <span><span className="mem-filter__dot" style={{ background: CATS[k].color }} /> {itemOf(k).title}</span>
              <span className="pd__detail-rel">{CATS[k].edgeLabel}</span>
            </Button>
          ))}
        </div>
      </aside>
    )
  }

  const cat = CATS[selected]
  const item = itemOf(selected)
  return (
    <aside className="pd__detail">
      <div className="pd__detail-head">
        <span className="pd__detail-icon cat-chip" style={catVars(cat)}>
          <cat.Icon />
        </span>
        <div>
          <b>{item.title}</b>
          <span className="pd__detail-tag cat-chip" style={catVars(cat)}>
            {cat.label.toUpperCase()}
          </span>
        </div>
      </div>
      <p className="pd__detail-desc">{item.body}</p>
      <div className="pd__detail-section">
        <span className="pd__detail-label">Connected to</span>
        <Button variant="ghost" className="h-auto pd__detail-row" onClick={() => onSelect('core')}>
          <span><span className="mem-filter__dot" style={{ background: 'var(--accent-solid)' }} /> Core Context</span>
          <span className="pd__detail-rel">{cat.edgeLabel}</span>
        </Button>
      </div>
    </aside>
  )
}
