import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import Tip from './Tip'
import EmptyState from './EmptyState'
import { Modal } from './Induction'
import { IconSearch, IconRefresh, IconDownload, IconPlus, IconClose, IconChevron, IconSort, IconSettings, IconError, IconCheck, IconAttach } from './icons'
import './Namespaces.css'
import './Induction.css'
import './Metrics.css'
import PageTitle from './PageHead'

type Metric = {
  id: number
  name: string
  description: string
  source: string
  table: string
  grain: string
  unit: string
  dialects: string[]
  by: string
  expression: string
}

const OWNER = 'rfpravin@kaartech.com'
const GRAINS = ['Day', 'Week', 'Month', 'Quarter']
const DIALECTS = ['ANSI', 'Postgres', 'Snowflake']
const SOURCES = ['Lexical Graph', 'aws-source-1', 'engineering-docs']
const PAGE = 10

const COLUMNS = [
  { id: 'description', label: 'Description' },
  { id: 'source', label: 'Data source' },
  { id: 'table', label: 'Table' },
  { id: 'grain', label: 'Time grain' },
  { id: 'unit', label: 'Unit' },
  { id: 'dialects', label: 'Dialects' },
  { id: 'by', label: 'Defined by' },
] as const
type ColId = (typeof COLUMNS)[number]['id']

const SAMPLE_OSI = `version: 0.1
metrics:
  - name: Monthly revenue
    description: Total invoiced revenue, grouped by month
    source: Lexical Graph
    table: invoices
    grain: Month
    unit: USD
    dialects: ANSI, Postgres
    expression: SUM(amount)
  - name: Active users
    description: Distinct users who signed in during the period
    source: aws-source-1
    table: sessions
    grain: Day
    unit: users
    dialects: ANSI
    expression: COUNT(DISTINCT user_id)
  - name: Open incidents
    description: Incidents not yet resolved
    source: engineering-docs
    table: incidents
    grain: Week
    unit: incidents
    dialects: ANSI, Snowflake
    expression: COUNT(*) FILTER (WHERE status = 'open')
`

/* A small reader for the flat OSI shape: a list of metrics with simple key: value lines. JSON is accepted too. */
function parseOsi(text: string): Partial<Metric>[] {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('The file is empty.')
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed)
    const list = Array.isArray(data) ? data : data.metrics
    if (!Array.isArray(list)) throw new Error('No metrics list found.')
    return list.map((m) => ({ ...m, dialects: Array.isArray(m.dialects) ? m.dialects : String(m.dialects ?? 'ANSI').split(',').map((x: string) => x.trim()) }))
  }
  const out: Partial<Metric>[] = []
  let cur: Record<string, string> | null = null
  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '')
    const item = /^\s*-\s+(\w+):\s*(.*)$/.exec(line)
    const kv = /^\s+(\w+):\s*(.*)$/.exec(line)
    if (item) { cur = { [item[1]]: item[2] }; out.push(cur as Partial<Metric>) }
    else if (kv && cur) cur[kv[1]] = kv[2]
  }
  if (!out.length) throw new Error('No metrics found. Each metric starts with "- name:".')
  return out.map((m) => ({ ...m, dialects: String((m as Record<string, string>).dialects ?? 'ANSI').split(',').map((x) => x.trim()).filter(Boolean) }))
}

export default function Metrics() {
  const [rows, setRows] = useState<Metric[]>([])
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [banner, setBanner] = useState(true)
  const [query, setQuery] = useState('')
  const [asc, setAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<number[]>([])
  const [cols, setCols] = useState<Record<ColId, boolean>>({ description: true, source: true, table: true, grain: true, unit: true, dialects: true, by: true })
  const [colsOpen, setColsOpen] = useState(false)
  const [note, setNote] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [importError, setImportError] = useState('')
  const [pasted, setPasted] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const emptyForm = { name: '', description: '', source: SOURCES[0], table: '', grain: 'Month', unit: '', expression: '', dialects: ['ANSI'] as string[] }
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    setLoad('loading')
    setBanner(true)
    const t = window.setTimeout(() => setLoad(navigator.onLine ? 'ready' : 'error'), 550)
    return () => window.clearTimeout(t)
  }, [attempt])

  useEffect(() => {
    if (!colsOpen) return
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setColsOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setColsOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [colsOpen])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((m) => !q || m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.table.toLowerCase().includes(q))
      .sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1) * (asc ? 1 : -1))
  }, [rows, query, asc])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice((page - 1) * PAGE, page * PAGE)
  useEffect(() => { setPage(1) }, [query])
  useEffect(() => { if (page > pages) setPage(pages) }, [pages, page])

  const allPicked = shown.length > 0 && shown.every((m) => picked.includes(m.id))
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const visible = COLUMNS.filter((c) => cols[c.id])

  const addMetrics = (incoming: Partial<Metric>[]) => {
    const have = new Set(rows.map((r) => r.name.toLowerCase()))
    let skipped = 0
    const next: Metric[] = []
    incoming.forEach((m, i) => {
      const name = String(m.name ?? '').trim()
      if (!name) { skipped++; return }
      if (have.has(name.toLowerCase())) { skipped++; return }
      have.add(name.toLowerCase())
      next.push({
        id: Date.now() + i,
        name,
        description: String(m.description ?? ''),
        source: String(m.source ?? SOURCES[0]),
        table: String(m.table ?? ''),
        grain: String(m.grain ?? 'Month'),
        unit: String(m.unit ?? ''),
        dialects: m.dialects?.length ? m.dialects : ['ANSI'],
        by: OWNER,
        expression: String(m.expression ?? ''),
      })
    })
    setRows((r) => [...r, ...next])
    return { added: next.length, skipped }
  }

  const doImport = (text: string) => {
    try {
      const { added, skipped } = addMetrics(parseOsi(text))
      if (added === 0) { setImportError(skipped ? 'Every metric in this file already exists. Rename them or remove the existing ones first.' : 'No metrics were found in this file.'); return }
      setImportOpen(false)
      setImportError('')
      setPasted('')
      setNote(`Imported ${added} ${added === 1 ? 'metric' : 'metrics'}${skipped ? `, skipped ${skipped} that already exist` : ''}.`)
    } catch (e) {
      setImportError(`This doesn’t look like a valid OSI file. ${e instanceof Error ? e.message : ''}`.trim())
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 1_000_000) { setImportError('This file is larger than 1 MB. Split it and import the parts.'); return }
    doImport(await file.text())
  }

  const exportOsi = () => {
    const body = `version: 0.1\nmetrics:\n${rows.map((m) => `  - name: ${m.name}\n    description: ${m.description}\n    source: ${m.source}\n    table: ${m.table}\n    grain: ${m.grain}\n    unit: ${m.unit}\n    dialects: ${m.dialects.join(', ')}\n    expression: ${m.expression}`).join('\n')}\n`
    const url = URL.createObjectURL(new Blob([body], { type: 'text/yaml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'metrics.osi.yaml'
    a.click()
    URL.revokeObjectURL(url)
    setNote(`Exported ${rows.length} ${rows.length === 1 ? 'metric' : 'metrics'} to metrics.osi.yaml.`)
  }

  const create = () => {
    if (!form.name.trim()) { setFormError('Enter a metric name.'); return }
    if (rows.some((r) => r.name.toLowerCase() === form.name.trim().toLowerCase())) { setFormError('A metric with this name already exists. Choose a different name.'); return }
    if (!form.expression.trim()) { setFormError('Enter the SQL expression that calculates this metric.'); return }
    addMetrics([{ ...form, name: form.name.trim() }])
    setCreateOpen(false)
    setForm(emptyForm)
    setFormError('')
    setNote(`Created ${form.name.trim()}.`)
  }

  const remove = () => {
    setRows((r) => r.filter((m) => !picked.includes(m.id)))
    setNote(`Deleted ${picked.length} ${picked.length === 1 ? 'metric' : 'metrics'}.`)
    setPicked([])
    setConfirmDel(false)
  }

  const Th = ({ id, label }: { id: ColId; label: string }) => (cols[id] ? <th scope="col">{label}</th> : null)

  return (
    <section className="ns" aria-labelledby="met-title">
      {load === 'error' && banner && (
        <div className="met__banner" role="alert">
          <IconError />
          <span>Failed to load metrics. The server didn’t respond.</span>
          <Button variant="ghost" className="h-auto met__banner-btn" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          <Button variant="ghost" className="h-auto met__banner-x" aria-label="Dismiss" onClick={() => setBanner(false)}><IconClose /></Button>
        </div>
      )}

      <div className="ns__card ns__panel met__card">
        <div className="ns__head">
          <PageTitle id="met-title" title="Metrics" count={rows.length} help="metrics" />
          <div className="ns__toolbar met__tools">
            <Tip label="Reload metrics" side="bottom">
              <Button variant="ghost" className="h-auto ns__btn met__icon" aria-label="Reload metrics" onClick={() => setAttempt((n) => n + 1)}><IconRefresh className={load === 'loading' ? 'is-spinning' : ''} /></Button>
            </Tip>
            <Button variant="ghost" className="h-auto ns__btn" disabled={picked.length === 0} onClick={() => setConfirmDel(true)}>Delete{picked.length ? ` (${picked.length})` : ''}</Button>
            <Button variant="ghost" className="h-auto ns__btn" onClick={() => { setImportError(''); setImportOpen(true) }}><IconAttach /> Import OSI</Button>
            <Button variant="ghost" className="h-auto ns__btn" disabled={rows.length === 0} onClick={exportOsi}><IconDownload /> Export OSI</Button>
            <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" onClick={() => { setForm(emptyForm); setFormError(''); setCreateOpen(true) }}><IconPlus /> Create metric</Button>
          </div>
        </div>

        <div className="met__bar">
          <label className="ns__search met__search">
            <IconSearch />
            <Input className="h-auto" placeholder="Find metrics" aria-label="Find metrics" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <p className="ns__note met__note" role="status" aria-live="polite">{note}</p>
          <nav className="exp__pager" aria-label="Pages">
            <Button variant="ghost" className="h-auto exp__pg" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><IconChevron className="exp__prev" /></Button>
            <span aria-live="polite">{page} / {pages}</span>
            <Button variant="ghost" className="h-auto exp__pg" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><IconChevron className="exp__next" /></Button>
          </nav>
          <div className="met__cols" ref={menu}>
            <Tip label="Choose columns" side="bottom">
              <Button variant="ghost" className="h-auto exp__pg" aria-label="Choose columns" aria-haspopup="menu" aria-expanded={colsOpen} onClick={() => setColsOpen((v) => !v)}><IconSettings /></Button>
            </Tip>
            {colsOpen && (
              <div className="ns__pop met__pop" role="menu" aria-label="Columns">
                {COLUMNS.map((c) => (
                  <label key={c.id} className="met__pop-item" role="menuitemcheckbox" aria-checked={cols[c.id]}>
                    <input type="checkbox" checked={cols[c.id]} onChange={() => setCols((cur) => ({ ...cur, [c.id]: !cur[c.id] }))} /> {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {load !== 'error' && (
          <div className="ns__tablewrap ns__tablewrap--flat" aria-busy={load === 'loading'}>
            <table className="ns__table">
              <thead>
                <tr>
                  <th scope="col" className="ns__check">
                    <input type="checkbox" aria-label="Select all metrics on this page" checked={allPicked} onChange={() => setPicked(allPicked ? picked.filter((id) => !shown.some((m) => m.id === id)) : [...new Set([...picked, ...shown.map((m) => m.id)])])} />
                  </th>
                  <th scope="col" aria-sort={asc ? 'ascending' : 'descending'}>
                    <button type="button" className="ns__sort" onClick={() => setAsc((v) => !v)}>Name <IconSort className="ns__sort-icon is-on" /></button>
                  </th>
                  <Th id="description" label="Description" />
                  <Th id="source" label="Data source" />
                  <Th id="table" label="Table" />
                  <Th id="grain" label="Time grain" />
                  <Th id="unit" label="Unit" />
                  <Th id="dialects" label="Dialects" />
                  <Th id="by" label="Defined by" />
                </tr>
              </thead>
              <tbody>
                {load === 'loading' && [0, 1, 2].map((n) => (
                  <tr key={n} className="ns__skel" aria-hidden="true">{Array.from({ length: visible.length + 2 }, (_, i) => <td key={i}><span /></td>)}</tr>
                ))}
                {load === 'ready' && shown.map((m) => (
                  <tr key={m.id} className={picked.includes(m.id) ? 'is-picked' : ''}>
                    <td className="ns__check"><input type="checkbox" aria-label={`Select ${m.name}`} checked={picked.includes(m.id)} onChange={() => toggle(m.id)} /></td>
                    <th scope="row">{m.name}</th>
                    {cols.description && <td className="exp__desc">{m.description || '—'}</td>}
                    {cols.source && <td>{m.source}</td>}
                    {cols.table && <td className="ns__mono">{m.table || '—'}</td>}
                    {cols.grain && <td>{m.grain}</td>}
                    {cols.unit && <td>{m.unit || '—'}</td>}
                    {cols.dialects && <td>{m.dialects.join(', ')}</td>}
                    {cols.by && <td>{m.by}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {load === 'ready' && rows.length === 0 && (
              <EmptyState art="gauge" compact title="No metrics" action={<Button variant="ghost" className="h-auto ns__btn" onClick={() => { setImportError(''); setImportOpen(true) }}>Import OSI</Button>}>
                No metrics have been defined yet. Import an OSI file to get started.
              </EmptyState>
            )}
            {load === 'ready' && rows.length > 0 && list.length === 0 && (
              <EmptyState art="loupe" compact title="No metrics match" action={<Button variant="ghost" className="h-auto ns__btn" onClick={() => setQuery('')}>Clear search</Button>}>
                Try a different name or table.
              </EmptyState>
            )}
          </div>
        )}
      </div>

      <Modal open={importOpen} title="Import OSI" onClose={() => setImportOpen(false)}>
        <p className="ns__sub">Open Semantic Interchange (OSI) files describe your metrics. Choose a .yaml or .json file, paste its contents, or try the sample.</p>
        <input ref={fileRef} type="file" accept=".yaml,.yml,.json,text/yaml,application/json" className="sr-only" aria-label="Choose an OSI file" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
        <div className="met__import-row">
          <Button variant="ghost" className="h-auto ns__btn" onClick={() => fileRef.current?.click()}><IconAttach /> Choose a file</Button>
          <Button variant="ghost" className="h-auto ns__btn" onClick={() => doImport(SAMPLE_OSI)}>Use the sample file</Button>
        </div>
        <label className="ns__label" htmlFor="met-paste">Or paste the file contents</label>
        <Textarea id="met-paste" className="ind__ta [field-sizing:fixed]" rows={5} value={pasted} onChange={(e) => { setPasted(e.target.value); setImportError('') }} placeholder="version: 0.1" />
        {importError && <p className="ns__error" role="alert">{importError}</p>}
        <div className="ns__actions">
          <Button variant="ghost" className="h-auto ns__btn" onClick={() => setImportOpen(false)}>Cancel</Button>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" disabled={!pasted.trim()} onClick={() => doImport(pasted)}>Import pasted file</Button>
        </div>
      </Modal>

      <Modal open={createOpen} title="Create metric" onClose={() => setCreateOpen(false)} wide>
        <div className="met__form">
          <div className="ns__field">
            <label className="ns__label" htmlFor="m-name">Name</label>
            <Input id="m-name" className="h-auto ns__input" placeholder="e.g., Monthly revenue" value={form.name} aria-invalid={!!formError && !form.name.trim()} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormError('') }} />
          </div>
          <div className="ns__field">
            <label className="ns__label" htmlFor="m-unit">Unit</label>
            <Input id="m-unit" className="h-auto ns__input" placeholder="e.g., USD" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="ns__field met__wide">
            <label className="ns__label" htmlFor="m-desc">Description <em>optional</em></label>
            <Input id="m-desc" className="h-auto ns__input" placeholder="What this metric measures" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="ns__field">
            <label className="ns__label" htmlFor="m-src">Data source</label>
            <select id="m-src" className="ind__select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div className="ns__field">
            <label className="ns__label" htmlFor="m-table">Table</label>
            <Input id="m-table" className="h-auto ns__input" placeholder="e.g., invoices" value={form.table} onChange={(e) => setForm({ ...form, table: e.target.value })} />
          </div>
          <div className="ns__field">
            <label className="ns__label" htmlFor="m-grain">Time grain</label>
            <select id="m-grain" className="ind__select" value={form.grain} onChange={(e) => setForm({ ...form, grain: e.target.value })}>{GRAINS.map((g) => <option key={g}>{g}</option>)}</select>
          </div>
          <fieldset className="ind__fields">
            <legend className="ns__label">Dialects</legend>
            <div className="met__dialects">
              {DIALECTS.map((d) => (
                <label key={d} className="ind__check">
                  <input type="checkbox" checked={form.dialects.includes(d)} onChange={() => setForm((f) => ({ ...f, dialects: f.dialects.includes(d) ? f.dialects.filter((x) => x !== d) : [...f.dialects, d] }))} /> {d}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="ns__field met__wide">
            <label className="ns__label" htmlFor="m-sql">SQL expression</label>
            <Textarea id="m-sql" className="ind__ta [field-sizing:fixed]" rows={3} placeholder="SUM(amount)" value={form.expression} onChange={(e) => { setForm({ ...form, expression: e.target.value }); setFormError('') }} />
          </div>
        </div>
        {formError && <p className="ns__error" role="alert">{formError}</p>}
        <div className="ns__actions">
          <Button variant="ghost" className="h-auto ns__btn" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" onClick={create}><IconCheck /> Create metric</Button>
        </div>
      </Modal>

      <Modal open={confirmDel} title={`Delete ${picked.length} ${picked.length === 1 ? 'metric' : 'metrics'}?`} onClose={() => setConfirmDel(false)}>
        <p className="ns__sub">This removes {picked.length === 1 ? 'it' : 'them'} from the governed surface. Anything that uses {picked.length === 1 ? 'it' : 'them'} will stop working. You can import the file again later.</p>
        <div className="ns__actions">
          <Button variant="ghost" className="h-auto ns__btn" onClick={() => setConfirmDel(false)}>Cancel</Button>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--danger" onClick={remove}>Delete</Button>
        </div>
      </Modal>
    </section>
  )
}
