import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import Tip from './Tip'
import EmptyState from './EmptyState'
import PageTitle from './PageHead'
import Sphere3D, { Details } from './Graph3D'
import type { Hub, Link, PickedNode } from './Graph3D'
import { IconChevron, IconClose, IconSort, IconPlus, IconDownload, IconSpark, IconExpand } from './icons'
import './Namespaces.css'
import './Induction.css'

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

type Status = 'Running' | 'In review' | 'Accepted' | 'Failed'
type Proposal = {
  id: string
  status: Status
  type: 'Unstructured' | 'Structured'
  classes: number
  created: string // ISO date-time
  sources: string[]
  progress: number
}
/* key is the class's stable identity; name is what the person sees and can rename */
export type Cls = { key: string; name: string; rel: number; attrs: number }

export const SEED_CLASSES: Cls[] = [
  { name: 'Agent', rel: 9, attrs: 23 },
  { name: 'Exception', rel: 4, attrs: 5 },
  { name: 'Module', rel: 6, attrs: 9 },
  { name: 'Organization', rel: 1, attrs: 2 },
  { name: 'Process', rel: 5, attrs: 4 },
  { name: 'Technology', rel: 0, attrs: 2 },
  { name: 'Tool', rel: 0, attrs: 3 },
].map((c) => ({ key: c.name, ...c }))

const SEED: Proposal[] = [
  { id: 'b775fdb9-97af-49e9-bad5-cb91be4affc0', status: 'Accepted', type: 'Unstructured', classes: 7, created: '2026-10-06T14:33:25', sources: ['Lexical Graph'], progress: 100 },
]

const SOURCE_OPTIONS = ['Lexical Graph', 'aws-source-1', 'engineering-docs']

const EDGES: { a: string; b: string; label: string }[] = [
  { a: 'Module', b: 'Tool', label: 'uses' },
  { a: 'Module', b: 'Exception', label: 'integrates with' },
  { a: 'Tool', b: 'Process', label: 'part of' },
  { a: 'Tool', b: 'Agent', label: 'invoked by' },
  { a: 'Exception', b: 'Agent', label: 'forwards to' },
  { a: 'Agent', b: 'Process', label: 'evaluates' },
  { a: 'Agent', b: 'Organization', label: 'part of' },
  { a: 'Process', b: 'Organization', label: 'analyzed by' },
  { a: 'Module', b: 'Agent', label: 'required by' },
]

const ATTR_NAMES = ['name', 'identifier', 'description', 'created at', 'updated at', 'owner', 'status', 'version', 'category', 'priority', 'source document', 'confidence', 'language', 'label', 'notes', 'url', 'author', 'start date', 'end date', 'duration', 'cost', 'location', 'tags']
const PREFIXES: [string, string][] = [
  ['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
  ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
  ['owl', 'http://www.w3.org/2002/07/owl#'],
  ['xsd', 'http://www.w3.org/2001/XMLSchema#'],
  ['sh', 'http://www.w3.org/ns/shacl#'],
  ['keos', 'https://keos.kaartech.com/ontology/aws#'],
]

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
const fmtLong = (iso: string) => new Date(iso).toISOString().replace('Z', '+00:00').replace(/\.\d+/, '.912644')
const newId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16) })

const statusClass = (s: Status) => (s === 'Accepted' ? 'done' : s === 'Failed' ? 'fail' : s === 'Running' ? 'run' : 'review')
function StatusChip({ p }: { p: Pick<Proposal, 'status' | 'progress'> }) {
  return (
    <span className={`ns__status ns__status--${statusClass(p.status)}`}>
      {p.status === 'Running' ? `Running ${p.progress}%` : p.status}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Shared pieces: modal and drawer                                     */
/* ------------------------------------------------------------------ */

function useTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('input, button, textarea')?.focus())
  }, [open])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return }
    if (e.key === 'Tab') {
      const f = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select') ?? [])
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  return { ref, onKey }
}

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const reduce = useReducedMotion()
  const id = useId()
  const { ref, onKey } = useTrap(open, onClose)
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
            ref={ref}
            className={`dialog ns__dialog${wide ? ' ind__dialog--wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            onKeyDown={onKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: reduce ? { duration: 0 } : motionTokens.spring.smooth }}
            exit={{ opacity: 0, y: reduce ? 0 : 6, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
          >
            <div className="dialog__head">
              <h2 id={`${id}-t`} className="dialog__title">{title}</h2>
              <Button variant="ghost" className="h-auto dialog__close" aria-label="Close" onClick={onClose}><IconClose /></Button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const reduce = useReducedMotion()
  const id = useId()
  const { ref, onKey } = useTrap(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="ns__drawer-scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: motionTokens.duration.standard } }}
          exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.aside
            ref={ref}
            className="ns__drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            onKeyDown={onKey}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0, transition: motionTokens.spring.smooth }}
            exit={reduce ? { opacity: 0 } : { x: '100%', transition: { duration: motionTokens.duration.exit } }}
          >
            <div className="ns__drawer-head">
              <h2 id={`${id}-t`} className="dialog__title">{title}</h2>
              <Button variant="ghost" className="h-auto dialog__close" aria-label="Close details" onClick={onClose}><IconClose /></Button>
            </div>
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function Section({ title, hint, badge, defaultOpen = false, actions, children }: { title: ReactNode; hint?: string; badge?: string; defaultOpen?: boolean; actions?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  const reduce = useReducedMotion()
  const id = useId()
  return (
    <section className="ns__card ind__sec">
      <div className="ind__sec-head">
        <button type="button" className="ind__sec-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          <IconChevron className={`ind__chev${open ? ' is-open' : ''}`} />
          <span className="ind__sec-title">{title}</span>
          {badge && <span className="ind__beta">{badge}</span>}
        </button>
        {actions && <div className="ind__sec-actions">{actions}</div>}
      </div>
      {hint && <p className="ind__sec-hint">{hint}</p>}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            className="ind__sec-body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="ind__sec-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Proposal graph                                                      */
/* ------------------------------------------------------------------ */

/* ---------- Proposal graph: a spherical, interactive network (see Graph3D.tsx) ---------- */

function relationsFor(c: Cls, classes: Cls[]) {
  const out = EDGES.filter((e) => (e.a === c.key || e.b === c.key) && classes.some((k) => k.key === e.a) && classes.some((k) => k.key === e.b))
    .map((e) => ({ name: e.label, to: classes.find((k) => k.key === (e.a === c.key ? e.b : e.a))?.name ?? '' }))
  const others = classes.filter((k) => k.key !== c.key)
  for (let i = 0; out.length < c.rel && others.length; i++) out.push({ name: ['relates to', 'depends on', 'references'][i % 3], to: others[i % others.length].name })
  return out.slice(0, c.rel)
}

export function Graph({ classes, selected, onSelect, big, data }: { classes: Cls[]; selected: string | null; onSelect: (name: string | null) => void; big?: boolean; data?: { hubs: Hub[]; links: Link[] } }) {
  const [standalone, setStandalone] = useState(false)
  const [picked, setPicked] = useState<PickedNode | null>(null)
  const visible = useMemo(() => classes.filter((c) => c.key !== 'Technology' || standalone), [classes, standalone])
  const hubs: Hub[] = useMemo(
    () => data ? data.hubs : visible.map((c) => ({
      key: c.key,
      name: c.name,
      rel: c.rel,
      attrs: c.attrs,
      rels: relationsFor(c, visible).map((r) => r.name + (r.to ? ' ' + r.to : '')),
      attributes: ATTR_NAMES.slice(0, c.attrs),
    })),
    [visible, data],
  )
  const links: Link[] = useMemo(() => data ? data.links : EDGES.filter((e) => visible.some((c) => c.key === e.a) && visible.some((c) => c.key === e.b)), [visible, data])

  return (
    <div className={`ind__graph${big ? ' is-big' : ''}${data ? ' is-quiet' : ''}`}>
      <Sphere3D hubs={hubs} links={links} selected={selected} onSelect={onSelect} big={big} onPick={setPicked} />
      {picked ? (
        <Details node={picked} hubs={hubs} links={links} onClose={() => { setPicked(null); onSelect(null) }} />
      ) : (
      <div className="ind__legend" aria-label="Legend">
        <h4>Legend</h4>
        <ul>
          <li><i className="ind__key ind__key--hub" /> Class</li>
          <li><i className="ind__key ind__key--rel" /> Relationship</li>
          <li><i className="ind__key ind__key--attr" /> Attribute</li>
        </ul>
        <p>Each dot is a relationship or attribute of the class it orbits. Zoom in to read the smaller labels.</p>
        {data ? <p className="ind__stats"><b>{hubs.length} classes</b> · {links.length} relationships</p> : null}
        <label className="ind__legend-sw" hidden={!!data}>
          <input type="checkbox" checked={standalone} onChange={(e) => setStandalone(e.target.checked)} /> Show 1 standalone class
        </label>
      </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Proposal detail                                                     */
/* ------------------------------------------------------------------ */

type Rule = { id: number; cls: string; prop: string; min: number }

function ProposalDetail({ p, onAccept }: { p: Proposal; onAccept: () => void }) {
  const [classes, setClasses] = useState<Cls[]>(SEED_CLASSES.slice(0, p.classes >= 7 ? 7 : Math.max(3, p.classes)))
  const [draft, setDraft] = useState<Record<string, string>>({}) // renames not yet saved
  const [selected, setSelected] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'' | 'validate' | 'infer'>('')
  const [valid, setValid] = useState<null | { ok: boolean; text: string }>(null)
  const [drawer, setDrawer] = useState(false)
  const [full, setFull] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [shacl, setShacl] = useState<Rule[]>([])
  const [ruleOpen, setRuleOpen] = useState(false)
  const [rule, setRule] = useState({ cls: classes[0]?.name ?? '', prop: '', min: 1 })
  const [moreAttrs, setMoreAttrs] = useState(false)

  const accepted = p.status === 'Accepted'
  const dirty = Object.keys(draft).length > 0
  const sorted = useMemo(() => [...classes].sort((a, b) => (a.name < b.name ? -1 : 1) * (sortAsc ? 1 : -1)), [classes, sortAsc])
  const cur = classes.find((c) => c.key === selected) ?? null
  const nameOf = (key: string) => classes.find((c) => c.key === key)?.name ?? key

  const rels = useMemo(() => {
    if (!cur) return []
    const edge = EDGES.filter((e) => (e.a === cur.key || e.b === cur.key) && classes.some((c) => c.key === e.a) && classes.some((c) => c.key === e.b)).map((e) => ({ name: e.label, to: nameOf(e.a === cur.key ? e.b : e.a) }))
    const others = classes.filter((c) => c.key !== cur.key)
    const out = [...edge]
    for (let i = 0; out.length < cur.rel && others.length; i++) out.push({ name: ['relates to', 'depends on', 'references'][i % 3], to: others[i % others.length].name })
    return out.slice(0, cur.rel)
  }, [cur, classes])

  const turtle = useMemo(() => [
    ...PREFIXES.map(([a, b]) => `@prefix ${a}: <${b}> .`),
    '',
    ...classes.map((c) => `keos:${(draft[c.key] ?? c.name).replace(/\s+/g, '')} a owl:Class ;\n  rdfs:label "${draft[c.key] ?? c.name}" .`),
  ].join('\n'), [classes, draft])

  const save = () => {
    setClasses((cs) => cs.map((c) => (draft[c.key] ? { ...c, name: draft[c.key] } : c)))
    setDraft({})
    setValid(null)
    setNote('Changes saved.')
  }
  const cancel = () => { setDraft({}); setNote('Changes discarded.') }

  const validate = () => {
    if (dirty) { setNote('Save or cancel your changes before validating.'); return }
    setBusy('validate')
    setNote('')
    window.setTimeout(() => {
      setBusy('')
      const dup = new Set(classes.map((c) => c.name.toLowerCase())).size !== classes.length
      setValid(dup ? { ok: false, text: 'Validation found 1 issue: two classes share a name.' } : { ok: true, text: `Validation passed: ${classes.length} classes, 0 issues.` })
    }, 900)
  }

  const infer = () => {
    setBusy('infer')
    window.setTimeout(() => {
      setBusy('')
      setShacl((r) => [...r, ...classes.slice(0, 3).map((c, i) => ({ id: Date.now() + i, cls: c.name, prop: 'name', min: 1 }))])
      setNote('Inferred 3 constraints from the database schema.')
    }, 1000)
  }

  const exportShacl = () => {
    const ttl = shacl.map((r) => `keos:${r.cls}Shape a sh:NodeShape ;\n  sh:targetClass keos:${r.cls} ;\n  sh:property [ sh:path keos:${r.prop.replace(/\s+/g, '')} ; sh:minCount ${r.min} ] .`).join('\n\n')
    const url = URL.createObjectURL(new Blob([ttl], { type: 'text/turtle' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'constraints.ttl'
    a.click()
    URL.revokeObjectURL(url)
    setNote('Exported constraints.ttl.')
  }

  const addRule = () => {
    if (!rule.prop.trim()) return
    setShacl((r) => [...r, { id: Date.now(), cls: rule.cls, prop: rule.prop.trim(), min: rule.min }])
    setRule({ ...rule, prop: '' })
    setNote('Added a custom rule.')
  }

  return (
    <section className="ns" aria-labelledby="ind-detail-title">
      <header className="ns__head">
        <div className="ns__titleblock">
          <div className="ns__titlerow">
            <h1 id="ind-detail-title" className="ns__title">{p.type} induction</h1>
            <StatusChip p={p} />
          </div>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--link ns__btn--under" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)}>View more</Button>
        </div>
        <div className="ns__toolbar ind__actions">
          <Tip label={dirty ? 'Save or cancel your changes first' : 'Check the classes for problems'} side="bottom">
            <Button variant="ghost" className="h-auto ns__btn" disabled={busy === 'validate'} aria-busy={busy === 'validate'} onClick={validate}>
              {busy === 'validate' ? 'Validating…' : 'Validate'}
            </Button>
          </Tip>
          <Button variant="ghost" className="h-auto ns__btn" disabled={!dirty} onClick={cancel}>Cancel</Button>
          <Button variant="ghost" className="h-auto ns__btn" disabled={!dirty} onClick={save}>Save changes</Button>
          <Button variant="ghost" className={`h-auto ns__btn${accepted ? '' : ' ns__btn--primary'}`} disabled={accepted || dirty || p.status !== 'In review'} onClick={() => setConfirm(true)}>
            {accepted ? 'Already accepted' : 'Accept and publish'}
          </Button>
        </div>
      </header>

      <div className="ind__status-line" role="status" aria-live="polite">
        {valid && <span className={`ns__status ns__status--${valid.ok ? 'done' : 'fail'}`}>{valid.text}</span>}
        {note && <span className="ind__note">{note}</span>}
      </div>

      <Section
        defaultOpen
        title="Proposal graph"
        hint="Each cluster is a group of related classes. Click a class to inspect it, and its relationship names appear on the graph."
        actions={<Button variant="ghost" className="h-auto ns__btn" onClick={() => setFull(true)}><IconExpand /> Full screen</Button>}
      >
        <Graph classes={classes} selected={selected} onSelect={setSelected} />
      </Section>

      <Section defaultOpen title={<>Proposed classes <span className="ns__count">({classes.length} classes)</span></>} hint="Select a class to view its relationships, attributes, and mappings.">
        <div className="ns__tablewrap">
          <table className="ns__table">
            <thead>
              <tr>
                <th scope="col" className="ns__check"><span className="sr-only">Select</span></th>
                <th scope="col" aria-sort={sortAsc ? 'ascending' : 'descending'}>
                  <button type="button" className="ns__sort" onClick={() => setSortAsc((v) => !v)}>Class <IconSort className="ns__sort-icon is-on" /></button>
                </th>
                <th scope="col">Origin</th>
                <th scope="col" className="ind__num">Relationships</th>
                <th scope="col" className="ind__num">Attributes</th>
                <th scope="col" className="ind__num">Matches</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.key} className={selected === c.key ? 'is-picked' : ''}>
                  <td className="ns__check">
                    <input type="radio" name="ind-class" aria-label={`Select ${c.name}`} checked={selected === c.key} onChange={() => setSelected(c.key)} />
                  </td>
                  <th scope="row">{draft[c.key] ?? c.name}</th>
                  <td><span className="ns__status ns__status--done">Novel</span></td>
                  <td className="ns__num ind__num">{c.rel}</td>
                  <td className="ns__num ind__num">{c.attrs}</td>
                  <td className="ns__num ind__num">0</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cur ? (
          <div className="ind__class" aria-live="polite">
            <div className="ind__class-head">
              <h3>{draft[cur.key] ?? cur.name}</h3>
              <Button variant="ghost" className="h-auto dialog__close" aria-label="Clear selection" onClick={() => setSelected(null)}><IconClose /></Button>
            </div>
            {!accepted && (
              <div className="ns__field">
                <label htmlFor="ind-rename" className="ns__label">Class name</label>
                <Input id="ind-rename" className="h-auto ns__input" value={draft[cur.key] ?? cur.name} onChange={(e) => {
                  const v = e.target.value
                  setDraft((d) => { const n = { ...d }; if (v === cur.name || !v.trim()) delete n[cur.key]; else n[cur.key] = v; return n })
                }} />
              </div>
            )}
            <div className="ind__cols">
              <div>
                <h4>Relationships ({cur.rel})</h4>
                {rels.length ? <ul>{rels.map((r, i) => <li key={i}><span className="ind__rel">{r.name}</span> {r.to}</li>)}</ul> : <p className="ind__muted">This class has no relationships yet.</p>}
              </div>
              <div>
                <h4>Attributes ({cur.attrs})</h4>
                <ul>{ATTR_NAMES.slice(0, moreAttrs ? cur.attrs : Math.min(6, cur.attrs)).map((a) => <li key={a}>{a}</li>)}</ul>
                {cur.attrs > 6 && <button type="button" className="ob__link" onClick={() => setMoreAttrs((v) => !v)}>{moreAttrs ? 'Show fewer' : `Show all ${cur.attrs}`}</button>}
              </div>
              <div>
                <h4>Mappings</h4>
                <p className="ind__muted">No matches in the reference ontologies. This class is new to your ontology.</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="ind__hint-line">Select a class above to see what it connects to.</p>
        )}
      </Section>

      <Section title="Prefixes (shared)" hint="Namespaces used by every class in this proposal.">
        <div className="ns__tablewrap">
          <table className="ns__table"><thead><tr><th scope="col">Prefix</th><th scope="col">IRI</th></tr></thead>
            <tbody>{PREFIXES.map(([a, b]) => <tr key={a}><th scope="row">{a}</th><td className="ns__mono">{b}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section title="Ontology source (Turtle)" hint="The proposal as Turtle. It updates when you save a rename.">
        <pre className="ind__code" tabIndex={0} aria-label="Ontology source in Turtle"><code>{turtle}</code></pre>
      </Section>

      <Section
        title="SHACL constraints"
        badge="Beta"
        hint="Rules that keep the data honest, such as every Agent needing a name."
        actions={
          <>
            <Button variant="ghost" className="h-auto ns__btn" disabled={busy === 'infer'} aria-busy={busy === 'infer'} onClick={infer}><IconSpark /> {busy === 'infer' ? 'Inferring…' : 'Infer constraints'}</Button>
            <Button variant="ghost" className="h-auto ns__btn" disabled={!shacl.length} onClick={() => { setValid({ ok: true, text: `Checked ${shacl.length} constraints: 0 violations.` }) }}>Validate</Button>
            <Button variant="ghost" className="h-auto ns__btn" disabled={!shacl.length} onClick={exportShacl}><IconDownload /> Export SHACL</Button>
          </>
        }
      >
        {shacl.length === 0 ? (
          <p className="ind__muted">No constraints yet. Infer them from your database schema, or add a custom rule below.</p>
        ) : (
          <ul className="ind__rules">
            {shacl.map((r) => (
              <li key={r.id}>
                <span><b>{r.cls}</b> needs at least {r.min} <b>{r.prop}</b></span>
                <Button variant="ghost" className="h-auto queue__act" aria-label={`Remove rule for ${r.cls} ${r.prop}`} onClick={() => setShacl((cur2) => cur2.filter((x) => x.id !== r.id))}><IconClose /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="ind__rule-add">
          <button type="button" className="ind__sec-toggle" aria-expanded={ruleOpen} onClick={() => setRuleOpen((v) => !v)}>
            <IconChevron className={`ind__chev${ruleOpen ? ' is-open' : ''}`} /> <span>Add custom rule</span>
          </button>
          {ruleOpen && (
            <div className="ind__rule-form">
              <label className="ns__label" htmlFor="ind-r-cls">Class</label>
              <select id="ind-r-cls" className="ind__select" value={rule.cls} onChange={(e) => setRule({ ...rule, cls: e.target.value })}>
                {classes.map((c) => <option key={c.key}>{c.name}</option>)}
              </select>
              <label className="ns__label" htmlFor="ind-r-prop">Property</label>
              <Input id="ind-r-prop" className="h-auto ns__input" placeholder="e.g., name" value={rule.prop} onChange={(e) => setRule({ ...rule, prop: e.target.value })} />
              <label className="ns__label" htmlFor="ind-r-min">Minimum count</label>
              <Input id="ind-r-min" type="number" min={0} className="h-auto ns__input" value={rule.min} onChange={(e) => setRule({ ...rule, min: Math.max(0, Number(e.target.value) || 0) })} />
              <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" disabled={!rule.prop.trim()} onClick={addRule}>Add rule</Button>
            </div>
          )}
        </div>
        <Section title="Custom SHACL (advanced)">
          <Textarea className="ind__ta [field-sizing:fixed]" rows={5} placeholder="Paste SHACL in Turtle" aria-label="Custom SHACL in Turtle" />
        </Section>
      </Section>

      <Drawer open={drawer} title="Proposal details" onClose={() => setDrawer(false)}>
        <dl className="ns__drawer-list">
          <div><dt>Proposal ID</dt><dd className="ns__mono">{p.id}</dd></div>
          <div><dt>Status</dt><dd><StatusChip p={p} /></dd></div>
          <div><dt>Type</dt><dd>{p.type} induction</dd></div>
          <div><dt>Namespace</dt><dd>AWS</dd></div>
          <div><dt>Created</dt><dd>{fmtLong(p.created)}</dd></div>
          <div><dt>Data sources</dt><dd>{p.sources.join(', ')}</dd></div>
          <div><dt>Classes</dt><dd className="ns__num">{classes.length}</dd></div>
        </dl>
      </Drawer>

      <Modal open={full} title="Proposal graph" onClose={() => setFull(false)} wide>
        <Graph classes={classes} selected={selected} onSelect={setSelected} big />
      </Modal>

      <Modal open={confirm} title="Accept and publish this proposal?" onClose={() => setConfirm(false)}>
        <p className="ns__sub">This publishes {classes.length} classes to the AWS namespace. You can run another induction later to refine it.</p>
        <div className="ns__actions">
          <Button variant="ghost" className="h-auto ns__btn" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" onClick={() => { setConfirm(false); onAccept(); setNote('Published to the AWS namespace.') }}>Accept and publish</Button>
        </div>
      </Modal>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

type Props = {
  detail: { id: string; name: string } | null
  onDetail: (d: { id: string; name: string } | null) => void
  onOpenExplorer: () => void
}

export default function Induction({ detail, onDetail, onOpenExplorer }: Props) {
  const [rows, setRows] = useState<Proposal[]>(SEED)
  const [tab, setTab] = useState('proposals')
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [start, setStart] = useState(false)
  const [sources, setSources] = useState<string[]>([])
  const [type, setType] = useState<'Unstructured' | 'Structured'>('Unstructured')
  const [sortAsc, setSortAsc] = useState(false)
  const [note, setNote] = useState('')
  const timers = useRef<number[]>([])

  useEffect(() => {
    setLoad('loading')
    const t = window.setTimeout(() => setLoad(navigator.onLine ? 'ready' : 'error'), 550)
    return () => window.clearTimeout(t)
  }, [attempt])
  useEffect(() => () => timers.current.forEach((t) => window.clearInterval(t)), [])

  const sorted = useMemo(() => [...rows].sort((a, b) => (a.created < b.created ? -1 : 1) * (sortAsc ? 1 : -1)), [rows, sortAsc])

  const begin = () => {
    if (!sources.length) return
    const id = newId()
    const p: Proposal = { id, status: 'Running', type, classes: 5 + (sources.length % 3), created: new Date().toISOString().slice(0, 19), sources, progress: 0 }
    setRows((r) => [p, ...r])
    setStart(false)
    setNote('Induction started. It will be ready to review in a few seconds.')
    const timer = window.setInterval(() => {
      setRows((r) => r.map((x) => {
        if (x.id !== id) return x
        if (!navigator.onLine) { window.clearInterval(timer); return { ...x, status: 'Failed' } }
        const next = Math.min(100, x.progress + 12)
        if (next >= 100) { window.clearInterval(timer); setNote('Induction finished. Open the proposal to review it.'); return { ...x, progress: 100, status: 'In review' } }
        return { ...x, progress: next }
      }))
    }, 450)
    timers.current.push(timer)
  }

  const open = rows.find((r) => r.id === detail?.id)
  if (open) {
    return <ProposalDetail key={open.id} p={open} onAccept={() => setRows((r) => r.map((x) => (x.id === open.id ? { ...x, status: 'Accepted' } : x)))} />
  }

  return (
    <section className="ns" aria-labelledby="ind-title">
      <header className="ns__head">
        <PageTitle id="ind-title" title="Induction" help="induction" />
        <div className="ns__toolbar">
          <Button variant="ghost" className="h-auto ns__btn" onClick={onOpenExplorer}>Open Explorer</Button>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" onClick={() => { setSources([SOURCE_OPTIONS[0]]); setStart(true) }}><IconPlus /> Start induction</Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="ns__tabs">
        <TabsList aria-label="Induction sections">
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="reference">Reference ontologies</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="ns__note ns__note--solo" role="status" aria-live="polite">{note}</p>

      <div className="ns__card ns__panel">
        {tab === 'proposals' ? (
          <>
            <h2 className="ns__card-title">Proposals <span className="ns__count">({rows.length})</span></h2>
            {load === 'error' ? (
              <div className="ns__alert" role="alert">
                <p><b>Couldn’t load proposals.</b> Check your connection, then try again.</p>
                <Button variant="ghost" className="h-auto ns__btn" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
              </div>
            ) : rows.length === 0 && load === 'ready' ? (
              <EmptyState art="graph" title="No proposals yet" action={<Button variant="ghost" className="h-auto ns__btn ns__btn--primary" onClick={() => { setSources([SOURCE_OPTIONS[0]]); setStart(true) }}>Start induction</Button>}>
                Start an induction and KEOS will propose classes and relationships from your sources.
              </EmptyState>
            ) : (
              <div className="ns__tablewrap ns__tablewrap--flat" aria-busy={load === 'loading'}>
                <table className="ns__table">
                  <thead>
                    <tr>
                      <th scope="col">Proposal ID</th>
                      <th scope="col">Status</th>
                      <th scope="col">Type</th>
                      <th scope="col">Scope</th>
                      <th scope="col" aria-sort={sortAsc ? 'ascending' : 'descending'}>
                        <button type="button" className="ns__sort" onClick={() => setSortAsc((v) => !v)}>Created <IconSort className="ns__sort-icon is-on" /></button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {load === 'loading' && [0, 1].map((n) => (
                      <tr key={n} className="ns__skel" aria-hidden="true"><td><span /></td><td><span /></td><td><span /></td><td><span /></td><td><span /></td></tr>
                    ))}
                    {load === 'ready' && sorted.map((r) => (
                      <tr key={r.id}>
                        <td><button type="button" className="ns__name ind__id" onClick={() => onDetail({ id: r.id, name: `Proposal ${r.id.slice(0, 8)}` })}>{r.id}</button></td>
                        <td>
                          <StatusChip p={r} />
                          {r.status === 'Running' && <span className="ind__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.progress} aria-label="Induction progress"><i style={{ width: `${r.progress}%` }} /></span>}
                        </td>
                        <td>{r.type}</td>
                        <td className="ns__num">{r.classes} classes</td>
                        <td className="ns__num">{fmtTime(r.created)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <EmptyState art="graph" title="No reference ontologies yet">
            Reference ontologies ground your classes in shared vocabularies. Once you add one, matches appear here.
          </EmptyState>
        )}
      </div>

      <Modal open={start} title="Start induction" onClose={() => setStart(false)}>
        <p className="ns__sub">Choose the sources KEOS should read. It proposes classes and relationships for you to review before anything is published.</p>
        <fieldset className="ind__fields">
          <legend className="ns__label">Sources</legend>
          {SOURCE_OPTIONS.map((s) => (
            <label key={s} className="ind__check">
              <input type="checkbox" checked={sources.includes(s)} onChange={() => setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))} /> {s}
            </label>
          ))}
          {sources.length === 0 && <p className="ns__error" role="alert">Choose at least one source.</p>}
        </fieldset>
        <fieldset className="ind__fields">
          <legend className="ns__label">Type</legend>
          {(['Unstructured', 'Structured'] as const).map((t) => (
            <label key={t} className="ind__check">
              <input type="radio" name="ind-type" checked={type === t} onChange={() => setType(t)} /> {t}
              <span className="ind__muted"> {t === 'Unstructured' ? 'Documents and notes' : 'Tables and schemas'}</span>
            </label>
          ))}
        </fieldset>
        <div className="ns__actions">
          <Button variant="ghost" className="h-auto ns__btn" onClick={() => setStart(false)}>Cancel</Button>
          <Button variant="ghost" className="h-auto ns__btn ns__btn--primary" disabled={!sources.length} onClick={begin}>Start induction</Button>
        </div>
      </Modal>
    </section>
  )
}
