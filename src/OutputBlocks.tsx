import { useId, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { IconCopy, IconCheck, IconDownload, IconSort, IconSearch, IconError, IconRefresh, IconChevron } from './icons'
import './OutputBlocks.css'

export type Stage = 'skeleton' | 'ready' | 'error'

type BlockProps = {
  stage: Stage
  /** 0 to 1 while the block is still streaming in. 1 when finished. */
  progress: number
  onRetry: () => void
}

/* ---------- Shared pieces ---------- */

function BlockError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="ob ob--error" role="alert">
      <IconError />
      <p><b>Couldn’t build the {what}.</b> KEOS lost its connection. Your answer above is safe.</p>
      <Button variant="ghost" className="h-auto ob__btn" onClick={onRetry}><IconRefresh /> Try again</Button>
    </div>
  )
}

function useCopy() {
  const [done, setDone] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setDone(true)
    window.setTimeout(() => setDone(false), 1600)
  }
  return { done, copy }
}

/* ---------- Table ---------- */

type Status = 'Behind' | 'At risk' | 'On track'
type Row = { contractor: string; pkg: string; planned: number; actual: number; late: number; status: Status }

const ROWS: Row[] = [
  { contractor: 'Gulf Piping Co.', pkg: 'E-1104 bundle delivery', planned: 80, actual: 52, late: 9, status: 'Behind' },
  { contractor: 'Al Rashid Scaffolding', pkg: 'CDU-1 scaffold erection', planned: 100, actual: 74, late: 6, status: 'Behind' },
  { contractor: 'Nordic Insulation', pkg: 'FCC line insulation', planned: 60, actual: 45, late: 5, status: 'Behind' },
  { contractor: 'SteelWorks Arabia', pkg: 'Flange replacement IR-2214', planned: 70, actual: 58, late: 3, status: 'Behind' },
  { contractor: 'Delta Electrical', pkg: 'MCC panel upgrade', planned: 55, actual: 49, late: 2, status: 'At risk' },
  { contractor: 'Petro Inspect', pkg: 'ILI pipeline survey', planned: 90, actual: 84, late: 1, status: 'At risk' },
  { contractor: 'Red Sea Cranes', pkg: 'Heavy lift schedule', planned: 40, actual: 40, late: 0, status: 'On track' },
  { contractor: 'Najd Coatings', pkg: 'Tank 7 recoating', planned: 35, actual: 36, late: 0, status: 'On track' },
  { contractor: 'Eastern Safety', pkg: 'Permit to work audit', planned: 25, actual: 25, late: 0, status: 'On track' },
]
const TABLE_VISIBLE = 6

type SortKey = 'contractor' | 'planned' | 'actual' | 'late' | 'status'
const STATUS_ORDER: Record<Status, number> = { Behind: 0, 'At risk': 1, 'On track': 2 }

export const TABLE_CSV = ['Contractor,Package,Planned %,Actual %,Days late,Status', ...ROWS.map((r) => [r.contractor, r.pkg, r.planned, r.actual, r.late, r.status].map((v) => `"${v}"`).join(','))].join('\n')

export function TableBlock({ stage, progress, onRetry }: BlockProps) {
  const reduce = useReducedMotion()
  const id = useId()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'late', dir: -1 })
  const [all, setAll] = useState(false)
  const { done, copy } = useCopy()

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    const f = ROWS.filter((r) => !q || r.contractor.toLowerCase().includes(q) || r.pkg.toLowerCase().includes(q))
    return [...f].sort((a, b) => {
      const av = sort.key === 'status' ? STATUS_ORDER[a.status] : a[sort.key]
      const bv = sort.key === 'status' ? STATUS_ORDER[b.status] : b[sort.key]
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir
    })
  }, [query, sort])

  if (stage === 'error') return <BlockError what="table" onRetry={onRetry} />

  const streaming = progress < 1
  const limit = all || query ? list.length : TABLE_VISIBLE
  const revealed = streaming ? Math.ceil(progress * Math.min(limit, TABLE_VISIBLE)) : limit
  const shown = list.slice(0, revealed)

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'contractor' ? 1 : -1 }))
  const Th = ({ k, children, num }: { k: SortKey; children: string; num?: boolean }) => (
    <th scope="col" className={num ? 'is-num' : undefined} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="ob__sort" onClick={() => sortBy(k)} disabled={stage === 'skeleton' || streaming}>
        {children} <IconSort className={`ob__sort-i${sort.key === k ? ' is-on' : ''}`} />
      </button>
    </th>
  )

  const download = () => {
    const url = URL.createObjectURL(new Blob([TABLE_CSV], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'contractors-behind-plan.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <figure className="ob ob--table" aria-busy={stage === 'skeleton' || streaming}>
      <figcaption className="ob__head">
        <div>
          <b>Contractors behind plan</b>
          <small>
            {stage === 'skeleton' ? 'Building the table…' : streaming ? 'Adding rows…' : `${list.length} of ${ROWS.length} packages · Updated 8 Oct 2026, 11:02 am`}
          </small>
        </div>
        <div className="ob__tools">
          <label className="ob__search">
            <IconSearch />
            <input
              id={`${id}-q`}
              value={query}
              placeholder="Filter contractors"
              aria-label="Filter contractors"
              disabled={stage === 'skeleton' || streaming}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <Button variant="ghost" className="h-auto ob__btn" disabled={stage === 'skeleton' || streaming} onClick={() => copy(TABLE_CSV)} aria-label="Copy table as CSV">
            {done ? <IconCheck /> : <IconCopy />} {done ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="ghost" className="h-auto ob__btn" disabled={stage === 'skeleton' || streaming} onClick={download} aria-label="Download table as CSV">
            <IconDownload /> CSV
          </Button>
        </div>
      </figcaption>

      <div className="ob__scroll">
        <table className="ob__table">
          <thead>
            <tr>
              <Th k="contractor">Contractor</Th>
              <th scope="col">Package</th>
              <Th k="planned" num>Planned</Th>
              <Th k="actual" num>Actual</Th>
              <Th k="late" num>Days late</Th>
              <Th k="status">Status</Th>
            </tr>
          </thead>
          <tbody>
            {stage === 'skeleton' && [0, 1, 2, 3, 4].map((n) => (
              <tr key={n} className="ob__skel-row" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((c) => <td key={c}><span className="ob-shimmer" style={{ width: c === 1 ? '80%' : c === 0 ? '70%' : '50%' }} /></td>)}
              </tr>
            ))}
            {stage === 'ready' && shown.map((r, i) => (
              <tr key={r.contractor} className={reduce ? undefined : 'ob__row-in'} style={{ animationDelay: reduce ? undefined : `${Math.min(i, 5) * 30}ms` }}>
                <th scope="row">{r.contractor}</th>
                <td>{r.pkg}</td>
                <td className="is-num">{r.planned}%</td>
                <td className="is-num">{r.actual}%</td>
                <td className="is-num">{r.late === 0 ? '0' : r.late}</td>
                <td><span className={`ob__badge ob__badge--${r.status === 'Behind' ? 'bad' : r.status === 'At risk' ? 'warn' : 'ok'}`}>{r.status}</span></td>
              </tr>
            ))}
            {stage === 'ready' && !streaming && list.length === 0 && (
              <tr>
                <td colSpan={6} className="ob__empty">
                  No contractors match “{query}”. <button type="button" className="ob__link" onClick={() => setQuery('')}>Clear the filter</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {stage === 'ready' && !streaming && !query && list.length > TABLE_VISIBLE && (
        <button type="button" className="ob__more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${list.length} packages`} <IconChevron className={`ob__more-chev${all ? ' is-open' : ''}`} />
        </button>
      )}
      {stage === 'skeleton' && <span className="sr-only" role="status">Building the table</span>}
    </figure>
  )
}

/* ---------- Chart ---------- */

const WEEKS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']
const PLANNED = [40, 48, 56, 60, 60, 56, 48, 44]
const ACTUAL = [38, 52, 66, 74, 78, 70, 58, 50]
const MAXV = 90

type View = 'bars' | 'line' | 'table'

export function ChartBlock({ stage, progress, onRetry }: BlockProps) {
  const reduce = useReducedMotion()
  const [view, setView] = useState<View>('bars')
  const [hover, setHover] = useState<number | null>(null)
  const { done, copy } = useCopy()

  if (stage === 'error') return <BlockError what="chart" onRetry={onRetry} />

  const W = 640, H = 230, L = 36, B = 28, T = 12, R = 8
  const iw = W - L - R, ih = H - T - B
  const x = (i: number) => L + (iw / WEEKS.length) * (i + 0.5)
  const y = (v: number) => T + ih - (v / MAXV) * ih
  const bw = 16
  const peak = ACTUAL.indexOf(Math.max(...ACTUAL))
  const over = Math.round(((ACTUAL[peak] - PLANNED[peak]) / PLANNED[peak]) * 100)
  const csv = ['Week,Planned (k hours),Actual (k hours)', ...WEEKS.map((w, i) => `${w},${PLANNED[i]},${ACTUAL[i]}`)].join('\n')
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const streaming = progress < 1
  const summary = `Planned versus actual manhours by week, in thousands of hours. Actual peaks in ${WEEKS[peak]} at ${ACTUAL[peak]}, ${over}% above plan.`

  return (
    <figure className="ob ob--chart" aria-busy={stage === 'skeleton' || streaming}>
      <figcaption className="ob__head">
        <div>
          <b>Planned vs. actual manhours</b>
          <small>{stage === 'skeleton' ? 'Drawing the chart…' : `Thousand hours per week · Peak in ${WEEKS[peak]}, ${over}% over plan`}</small>
        </div>
        <div className="ob__tools">
          <SegmentedControl
            label="Chart view"
            value={view}
            onValueChange={(v) => { setView(v as View); setHover(null) }}
            options={[{ value: 'bars', label: 'Bars' }, { value: 'line', label: 'Line' }, { value: 'table', label: 'Table' }]}
          />
          <Button variant="ghost" className="h-auto ob__btn" disabled={stage === 'skeleton'} onClick={() => copy(csv)} aria-label="Copy chart data as CSV">
            {done ? <IconCheck /> : <IconCopy />} {done ? 'Copied' : 'Copy data'}
          </Button>
        </div>
      </figcaption>

      {stage === 'skeleton' && (
        <div className="ob__chart-skel" aria-hidden="true">
          {[40, 55, 70, 80, 85, 75, 60, 50].map((h, i) => <span key={i} className="ob-shimmer" style={{ height: `${h}%` }} />)}
        </div>
      )}

      {stage === 'ready' && view !== 'table' && (
        <div className="ob__plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="ob__svg">
            {[0, 30, 60, 90].map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className="ob__grid" />
                <text x={L - 8} y={y(g) + 4} textAnchor="end" className="ob__tick">{g}</text>
              </g>
            ))}
            {view === 'bars' && WEEKS.map((w, i) => (
              <g key={w}>
                <rect x={x(i) - bw - 1} y={y(PLANNED[i])} width={bw} height={ih - (y(PLANNED[i]) - T)} rx={3} className={`ob__bar ob__bar--plan${reduce ? '' : ' is-anim'}`} style={{ ['--i' as string]: i }} />
                <rect x={x(i) + 1} y={y(ACTUAL[i])} width={bw} height={ih - (y(ACTUAL[i]) - T)} rx={3} className={`ob__bar ob__bar--act${reduce ? '' : ' is-anim'}`} style={{ ['--i' as string]: i + 0.5 }} />
              </g>
            ))}
            {view === 'line' && (
              <>
                <path d={line(PLANNED)} className={`ob__line ob__line--plan${reduce ? '' : ' is-anim'}`} pathLength={1} />
                <path d={line(ACTUAL)} className={`ob__line ob__line--act${reduce ? '' : ' is-anim'}`} pathLength={1} />
                {WEEKS.map((w, i) => <circle key={w} cx={x(i)} cy={y(ACTUAL[i])} r={hover === i ? 5 : 3} className="ob__dot" />)}
              </>
            )}
            {WEEKS.map((w, i) => (
              <g key={w}>
                <text x={x(i)} y={H - 8} textAnchor="middle" className="ob__tick">{w}</text>
                <rect
                  x={x(i) - iw / WEEKS.length / 2}
                  y={T}
                  width={iw / WEEKS.length}
                  height={ih}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${w}: planned ${PLANNED[i]}, actual ${ACTUAL[i]} thousand hours`}
                  className="ob__hit"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            ))}
          </svg>
          {hover !== null && (
            <div className="ob__tip" role="status" style={{ left: `${(x(hover) / W) * 100}%` }}>
              <b>{WEEKS[hover]}</b>
              <span><i className="ob__sw ob__sw--plan" /> Planned {PLANNED[hover]}k</span>
              <span><i className="ob__sw ob__sw--act" /> Actual {ACTUAL[hover]}k</span>
            </div>
          )}
          <ul className="ob__legend" aria-hidden="true">
            <li><i className="ob__sw ob__sw--plan" /> Planned</li>
            <li><i className="ob__sw ob__sw--act" /> Actual</li>
          </ul>
        </div>
      )}

      {stage === 'ready' && view === 'table' && (
        <div className="ob__scroll">
          <table className="ob__table">
            <thead><tr><th scope="col">Week</th><th scope="col" className="is-num">Planned (k hours)</th><th scope="col" className="is-num">Actual (k hours)</th><th scope="col" className="is-num">Difference</th></tr></thead>
            <tbody>
              {WEEKS.map((w, i) => (
                <tr key={w}>
                  <th scope="row">{w}</th>
                  <td className="is-num">{PLANNED[i]}</td>
                  <td className="is-num">{ACTUAL[i]}</td>
                  <td className="is-num">{ACTUAL[i] - PLANNED[i] > 0 ? '+' : ''}{ACTUAL[i] - PLANNED[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {stage === 'skeleton' && <span className="sr-only" role="status">Drawing the chart</span>}
    </figure>
  )
}

/* ---------- Code ---------- */

const CODE = [
  'import csv',
  'import sys',
  '',
  'def export_table(rows, path):',
  '    """Write the contractor table to a CSV file."""',
  '    fields = ["contractor", "package", "planned", "actual", "days_late", "status"]',
  '    with open(path, "w", newline="") as f:',
  '        writer = csv.DictWriter(f, fieldnames=fields)',
  '        writer.writeheader()',
  '        writer.writerows(rows)',
  '    return len(rows)',
  '',
  'if __name__ == "__main__":',
  '    print(export_table([], sys.argv[1]))',
]

export const CODE_TEXT = CODE.join('\n')

export function CodeBlock({ stage, progress, onRetry }: BlockProps) {
  const reduce = useReducedMotion()
  const { done, copy } = useCopy()
  if (stage === 'error') return <BlockError what="script" onRetry={onRetry} />
  const streaming = progress < 1
  const count = streaming ? Math.ceil(progress * CODE.length) : CODE.length

  return (
    <figure className="ob ob--code" aria-busy={stage === 'skeleton' || streaming}>
      <figcaption className="ob__head ob__head--code">
        <b>export_table.py</b>
        <small>Python</small>
        <Button variant="ghost" className="h-auto ob__btn ob__btn--end" disabled={stage === 'skeleton' || streaming} onClick={() => copy(CODE_TEXT)} aria-label="Copy code">
          {done ? <IconCheck /> : <IconCopy />} {done ? 'Copied' : 'Copy'}
        </Button>
      </figcaption>
      {stage === 'skeleton' ? (
        <div className="ob__code-skel" aria-hidden="true">
          {[60, 35, 0, 75, 85, 90, 70, 80].map((w, i) => <span key={i} className="ob-shimmer" style={{ width: `${w}%`, opacity: w ? 1 : 0 }} />)}
          <span className="sr-only" role="status">Writing the script</span>
        </div>
      ) : (
        <pre className="ob__code" tabIndex={0} aria-label="Python code">
          <code>
            {CODE.slice(0, count).map((l, i) => (
              <span key={i} className={reduce ? 'ob__line-c' : 'ob__line-c is-in'}>
                <i className="ob__ln" aria-hidden="true">{i + 1}</i>
                {l || ' '}
                {'\n'}
              </span>
            ))}
          </code>
        </pre>
      )}
    </figure>
  )
}
