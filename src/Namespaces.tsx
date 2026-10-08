import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Tabs, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import Tip from './Tip'
import { IconSearch, IconCheck, IconChevron, IconPlus, IconSort, IconClose, IconLock, IconEdit, IconError, IconInfo } from './icons'
import './Namespaces.css'

type Status = 'Active' | 'Inactive'
type Row = { id: string; name: string; description: string; sources: number; status: Status; created: string; updated: string }

const SEED: Row[] = [
  { id: 'aws', name: 'AWS', description: '', sources: 1, status: 'Active', created: '2026-10-06', updated: '2026-10-06' },
  { id: 'engineering', name: 'Engineering', description: '', sources: 1, status: 'Active', created: '2026-10-07', updated: '2026-10-07' },
  { id: 'insurance-data', name: 'Insurance data', description: '', sources: 3, status: 'Active', created: '2026-10-01', updated: '2026-10-01' },
  { id: 'kaartech-crm', name: 'Kaartech CRM', description: '', sources: 1, status: 'Active', created: '2026-10-05', updated: '2026-10-05' },
  { id: 'ontologyvskb', name: 'ONTOLOGYvsKB', description: '', sources: 1, status: 'Active', created: '2026-10-08', updated: '2026-10-08' },
  { id: 'testing', name: 'Testing', description: '', sources: 1, status: 'Active', created: '2026-10-01', updated: '2026-10-01' },
]

type SortKey = 'name' | 'sources' | 'status' | 'created' | 'updated'

const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}/${y}`
}
const fmtLong = (iso: string) =>
  new Date(`${iso}T11:02:00`).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
const today = () => new Date().toISOString().slice(0, 10)
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/* Sample identifier so every namespace has a stable-looking ID. */
const fakeUuid = (s: string) => {
  let h = 2166136261
  const hex: string[] = []
  for (let i = 0; i < 32; i++) {
    h = Math.imul(h ^ (s.charCodeAt(i % s.length) + i), 16777619) >>> 0
    hex.push((h & 15).toString(16))
  }
  const x = hex.join('')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-9${x.slice(17, 20)}-${x.slice(20, 32)}`
}

const SOURCE_KINDS = [
  { type: 'Documents', tables: '—' },
  { type: 'Database', tables: '12' },
  { type: 'API', tables: '4' },
]
const sourcesFor = (r: Row) =>
  Array.from({ length: r.sources }, (_, i) => ({
    name: r.id === 'ontologyvskb' ? 'test-docs' : `${r.id}-source-${i + 1}`,
    type: SOURCE_KINDS[i % SOURCE_KINDS.length].type,
    tables: SOURCE_KINDS[i % SOURCE_KINDS.length].tables,
    status: 'Completed',
  }))

const TABS = [
  { id: 'sources', label: 'Sources' },
  { id: 'ontologies', label: 'Ontologies' },
  { id: 'metrics', label: 'Metrics' },
]

function Detail({ row, onSave }: { row: Row; onSave: (description: string) => void }) {
  const [tab, setTab] = useState('sources')
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState(row.description)
  const [note, setNote] = useState('')
  const degraded = row.id === 'ontologyvskb'
  const sources = sourcesFor(row)

  return (
    <section className="ns" aria-labelledby="ns-detail-title">
      <header className="ns__head">
        <div><h1 id="ns-detail-title" className="ns__title">{row.name}</h1></div>
        <div className="ns__toolbar">
          {editing ? (
            <>
              <Button variant="ghost" className="h-auto ns__btn" onClick={() => { setEditing(false); setDesc(row.description) }}>Cancel</Button>
              <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" onClick={() => { onSave(desc.trim()); setEditing(false); setNote('Namespace updated.') }}>Save changes</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="h-auto ns__btn" onClick={() => setEditing(true)}><IconEdit /> Edit</Button>
              <Button variant="ghost" className="h-auto ns__btn" onClick={() => setNote('Permissions are managed by your workspace admin.')}><IconLock /> Permissions</Button>
            </>
          )}
        </div>
      </header>
      <p className="ns__note ns__note--solo" role="status" aria-live="polite">{note}</p>

      <div className="ns__card ns__summary">
        <h2 className="ns__card-title">Summary</h2>
        <dl className="ns__grid">
          <div><dt>Namespace ID</dt><dd>{fakeUuid(row.id)}</dd></div>
          <div><dt>Name</dt><dd>{row.id}</dd></div>
          <div><dt>Owner</dt><dd>rfpravin@kaartech.com</dd></div>
          <div>
            <dt>Status</dt>
            <dd><span className={`ns__status ns__status--${row.status.toLowerCase()}`}>{row.status === 'Active' && <IconCheck />} {row.status}</span></dd>
          </div>
          <div>
            <dt>Knowledge graph health</dt>
            <dd>
              {degraded
                ? <span className="ns__status ns__status--bad"><IconError /> Degraded</span>
                : <span className="ns__status ns__status--active"><IconCheck /> Healthy</span>}
            </dd>
          </div>
          <div><dt>Sources</dt><dd className="ns__num">{row.sources}</dd></div>
          <div><dt>Created</dt><dd>{fmtLong(row.created)}</dd></div>
          <div><dt>Updated</dt><dd>{fmtLong(row.updated)}</dd></div>
          <div>
            <dt><label htmlFor="ns-d-desc">Description</label></dt>
            <dd>
              {editing
                ? <Input id="ns-d-desc" className="h-auto ns__input" value={desc} placeholder="Add a short description" onChange={(e) => setDesc(e.target.value)} />
                : (row.description || '—')}
            </dd>
          </div>
        </dl>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="ns__tabs">
        <TabsList aria-label="Namespace sections">
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      <div className="ns__card ns__panel">
        {tab === 'sources' && (
          <>
            <h2 className="ns__card-title">Sources <span className="ns__count">({sources.length})</span></h2>
            <div className="ns__tablewrap ns__tablewrap--flat">
              <table className="ns__table">
                <thead><tr><th scope="col">Source name</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Tables</th></tr></thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.name}>
                      <td><span className="ns__name">{s.name}</span></td>
                      <td>{s.type}</td>
                      <td><span className="ns__status ns__status--info"><IconInfo /> {s.status}</span></td>
                      <td className="ns__num">{s.tables}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === 'ontologies' && (
          <div className="ns__empty-block">
            <h2 className="ns__card-title">Ontologies</h2>
            <p>No ontologies in this namespace yet. Run Induction on a source to generate one.</p>
          </div>
        )}
        {tab === 'metrics' && (
          <>
            <h2 className="ns__card-title">Metrics</h2>
            <dl className="ns__grid ns__grid--metrics">
              <div><dt>Entities</dt><dd className="ns__num">{degraded ? '1,284' : '3,902'}</dd></div>
              <div><dt>Relationships</dt><dd className="ns__num">{degraded ? '2,016' : '7,415'}</dd></div>
              <div><dt>Queries this week</dt><dd className="ns__num">{degraded ? '38' : '214'}</dd></div>
            </dl>
          </>
        )}
      </div>
    </section>
  )
}

function CreateDialog({ open, existing, onClose, onCreate }: { open: boolean; existing: string[]; onClose: () => void; onCreate: (name: string, description: string) => void }) {
  const reduce = useReducedMotion()
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('input')?.focus())
    else {
      const t = window.setTimeout(() => { setName(''); setDesc(''); setError('') }, 250)
      return () => window.clearTimeout(t)
    }
  }, [open])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return }
    if (e.key === 'Tab') {
      const f = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea') ?? [])
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const s = slug(name)
    if (!s) { setError('Enter a namespace name.'); return }
    if (existing.includes(s)) { setError('A namespace with this name already exists. Choose a different name.'); return }
    onCreate(name.trim(), desc.trim())
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="dialog__scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard } }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            ref={panel}
            className="dialog ns__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            onKeyDown={onKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, y: reduce ? 0 : 6, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
          >
            <div className="dialog__head">
              <h2 id={`${id}-title`} className="dialog__title">Create namespace</h2>
              <Button variant="ghost" className="h-auto dialog__close" aria-label="Close" onClick={onClose}><IconClose /></Button>
            </div>
            <p className="ns__sub">Create a new namespace to partition your semantic graph into an isolated scope.</p>

            <form onSubmit={submit} noValidate>
              <div className="ns__field">
                <label htmlFor={`${id}-name`} className="ns__label">Namespace name</label>
                <p className="ns__hint" id={`${id}-hint`}>Machine-friendly identifier: <code>{slug(name) || '—'}</code></p>
                <Input
                  id={`${id}-name`}
                  className="h-auto ns__input"
                  placeholder="e.g., Insurance Prod"
                  value={name}
                  aria-describedby={`${id}-hint ${id}-err`}
                  aria-invalid={!!error}
                  onChange={(e) => { setName(e.target.value); setError('') }}
                />
                {error && <p className="ns__error" id={`${id}-err`} role="alert">{error}</p>}
              </div>

              <div className="ns__field">
                <label htmlFor={`${id}-desc`} className="ns__label">Description <em>optional</em></label>
                <p className="ns__hint">A brief description of the namespace purpose.</p>
                <Textarea
                  id={`${id}-desc`}
                  className="ns__textarea [field-sizing:fixed]"
                  rows={3}
                  placeholder="e.g., Production namespace for insurance domain data"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <div className="ns__actions">
                <Button variant="ghost" type="button" className="h-auto ns__btn" onClick={onClose}>Cancel</Button>
                <Button variant="ghost" type="submit" className="h-auto ns__btn ns__btn--primary" disabled={!name.trim()}>Create namespace</Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

type Props = { detail: { id: string; name: string } | null; onDetail: (d: { id: string; name: string } | null) => void }

export default function Namespaces({ detail, onDetail }: Props) {
  const [rows, setRows] = useState<Row[]>(SEED)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const [picked, setPicked] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [note, setNote] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => (statusFilter === 'all' || r.status === statusFilter) && (!q || r.name.toLowerCase().includes(q)))
    return [...list].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key]
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.dir
    })
  }, [rows, query, statusFilter, sort])

  const allPicked = shown.length > 0 && shown.every((r) => picked.includes(r.id))
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const togglePickAll = () => setPicked(allPicked ? picked.filter((id) => !shown.some((r) => r.id === id)) : [...new Set([...picked, ...shown.map((r) => r.id)])])

  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))

  const setStatus = (status: Status) => {
    setRows((rs) => rs.map((r) => (picked.includes(r.id) ? { ...r, status, updated: today() } : r)))
    setNote(`${picked.length} ${picked.length === 1 ? 'namespace' : 'namespaces'} set to ${status.toLowerCase()}.`)
    setPicked([])
    setMenuOpen(false)
  }

  const create = (name: string, description: string) => {
    setRows((rs) => [...rs, { id: slug(name), name, description, sources: 0, status: 'Active', created: today(), updated: today() }])
    setNote(`Created ${name}.`)
    setCreating(false)
  }

  const Th = ({ k, children }: { k: SortKey; children: string }) => (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="ns__sort" onClick={() => sortBy(k)}>
        {children}
        <IconSort className={`ns__sort-icon${sort.key === k ? ' is-on' : ''}`} />
      </button>
    </th>
  )

  const open = rows.find((r) => r.id === detail?.id)
  if (open) {
    return (
      <Detail
        key={open.id}
        row={open}
        onSave={(description) => setRows((rs) => rs.map((r) => (r.id === open.id ? { ...r, description, updated: today() } : r)))}
      />
    )
  }

  return (
    <section className="ns" aria-labelledby="ns-title">
      <header className="ns__head">
        <div>
          <h1 id="ns-title" className="ns__title">Namespaces <span className="ns__count">({rows.length})</span></h1>
          <p className="ns__sub">Namespaces partition the semantic graph into isolated scopes. Each namespace has its own data sources, ontology, and access policies.</p>
        </div>
        <div className="ns__toolbar">
          <div className="ns__menu">
            <Button
              variant="ghost"
              className="h-auto ns__btn"
              disabled={picked.length === 0}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              Change status <IconChevron />
            </Button>
            {menuOpen && (
              <div className="ns__pop" role="menu" aria-label="Change status">
                <button type="button" role="menuitem" className="ns__pop-item" onClick={() => setStatus('Active')}>Set to active</button>
                <button type="button" role="menuitem" className="ns__pop-item" onClick={() => setStatus('Inactive')}>Set to inactive</button>
              </div>
            )}
          </div>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" onClick={() => setCreating(true)}>
            <IconPlus /> Create namespace
          </Button>
        </div>
      </header>

      <div className="ns__filters">
        <SegmentedControl
          label="Filter by status"
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | Status)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
          ]}
        />
        <p className="ns__note" role="status" aria-live="polite">{note}</p>
        <label className="ns__search">
          <IconSearch />
          <Input className="h-auto" placeholder="Find namespaces" aria-label="Find namespaces" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="ns__tablewrap">
        <table className="ns__table">
          <thead>
            <tr>
              <th scope="col" className="ns__check">
                <input type="checkbox" aria-label="Select all namespaces" checked={allPicked} onChange={togglePickAll} />
              </th>
              <Th k="name">Namespace</Th>
              <Th k="sources">Sources</Th>
              <Th k="status">Status</Th>
              <Th k="created">Created</Th>
              <Th k="updated">Updated</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={picked.includes(r.id) ? 'is-picked' : ''}>
                <td className="ns__check">
                  <input type="checkbox" aria-label={`Select ${r.name}`} checked={picked.includes(r.id)} onChange={() => togglePick(r.id)} />
                </td>
                <td>
                  <Tip label="Open details" side="top"><button type="button" className="ns__name" onClick={() => onDetail({ id: r.id, name: r.name })}>{r.name}</button></Tip>
                </td>
                <td className="ns__num">{r.sources}</td>
                <td>
                  <span className={`ns__status ns__status--${r.status.toLowerCase()}`}>
                    {r.status === 'Active' && <IconCheck />} {r.status}
                  </span>
                </td>
                <td className="ns__num">{fmt(r.created)}</td>
                <td className="ns__num">{fmt(r.updated)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="ns__empty">
                  No namespaces match. Clear the search or choose another status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateDialog open={creating} existing={rows.map((r) => r.id)} onClose={() => setCreating(false)} onCreate={create} />
    </section>
  )
}
