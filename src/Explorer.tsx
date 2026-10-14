import { useEffect, useMemo, useRef, useState } from 'react'
import Tip from './Tip'
import { heavyGraph } from './heavyGraph'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/arc/tabs/tabs'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Input } from '@/components/ui/input'
import EmptyState from './EmptyState'
import { Graph, SEED_CLASSES } from './Induction'
import { IconSearch, IconChevron, IconSort, IconList, IconOntology, IconFilter, IconCheck, IconInfo } from './icons'
import './Namespaces.css'
import './Induction.css'
import './Explorer.css'
import PageTitle from './PageHead'

const ONTOLOGY = 'Unstructured Induction'
const IRI = 'http://coa.amazon.com/namespace/d2e20449-333b-448c-97f7-435577c58714/ontology/induced#'

const DESCRIPTIONS: Record<string, string> = {
  Agent: 'A person or software component that carries out work in a process.',
  Exception: 'An unexpected event that interrupts a normal process step.',
  Module: 'A self-contained unit of a system that provides one capability.',
  Organization: 'A team, company or group that owns or runs something.',
  Process: 'A sequence of steps that turns an input into an outcome.',
  Technology: 'A platform, language or service that other things are built on.',
  Tool: 'An instrument an agent uses to perform a step.',
}

const PAGE = 5

type Tab = 'classes' | 'ontologies' | 'sources'
type Load = 'loading' | 'ready' | 'error'

/* A short loading and error wrapper shared by the three tabs. */
function useLoad(dep: unknown) {
  const [load, setLoad] = useState<Load>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setLoad('loading')
    const t = window.setTimeout(() => setLoad(navigator.onLine ? 'ready' : 'error'), 500)
    return () => window.clearTimeout(t)
  }, [dep, attempt])
  return { load, retry: () => setAttempt((n) => n + 1) }
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="ns__alert" role="alert">
      <p><b>Couldn’t load {what}.</b> Check your connection, then try again.</p>
      <Button variant="ghost" className="h-auto ns__btn" onClick={onRetry}>Try again</Button>
    </div>
  )
}

function Skeleton({ cols }: { cols: number }) {
  return (
    <>
      {[0, 1, 2].map((n) => (
        <tr key={n} className="ns__skel" aria-hidden="true">{Array.from({ length: cols }, (_, i) => <td key={i}><span /></td>)}</tr>
      ))}
    </>
  )
}

/* The graph shows the whole namespace, so it is built from a large sample data set. */
const HEAVY = heavyGraph(220)

/* ---------- Classes ---------- */

function Classes({ ontology, setOntology }: { ontology: string; setOntology: (o: string) => void }) {
  const [view, setView] = useState<'list' | 'graph'>('list')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [asc, setAsc] = useState(true)
  const [picked, setPicked] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const down = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [menuOpen])
  const { load, retry } = useLoad(ontology)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SEED_CLASSES.filter((c) => !q || c.name.toLowerCase().includes(q) || DESCRIPTIONS[c.key].toLowerCase().includes(q)).sort((a, b) => (a.name < b.name ? -1 : 1) * (asc ? 1 : -1))
  }, [query, asc])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const shown = list.slice((page - 1) * PAGE, page * PAGE)
  useEffect(() => { setPage(1) }, [query])

  return (
    <div className="ns__card ns__panel">
      <div className="exp__head">
        <h2 className="ns__card-title exp__titlerow">Classes <span className="ns__count">({list.length})</span><Tip label="The classes in the selected ontology. Switch to the graph to see how they connect." side="bottom"><Button variant="ghost" className="h-auto exp__info" aria-label="About classes"><IconInfo /></Button></Tip></h2>
        <div className="exp__bar">
        <label className="ns__search exp__search">
          <IconSearch />
          <Input className="h-auto" placeholder="Filter classes" aria-label="Filter classes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="ns__menu" ref={menuRef}>
          <Tip label={'Ontology: ' + ontology} side="bottom">
            <Button variant="ghost" className="h-auto exp__filter" aria-label="Choose ontology" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <IconFilter />
            </Button>
          </Tip>
          {menuOpen && (
            <div className="ns__pop" role="menu" aria-label="Ontology">
              {[ONTOLOGY].map((o) => (
                <button key={o} type="button" role="menuitemradio" aria-checked={o === ontology} className="ns__pop-item exp__opt" onClick={() => { setOntology(o); setMenuOpen(false) }}>
                  <span>{o}</span>{o === ontology && <IconCheck />}
                </button>
              ))}
            </div>
          )}
        </div>
        <SegmentedControl label="View" value={view} onValueChange={(v) => setView(v as 'list' | 'graph')} options={[{ value: 'list', label: 'List view', icon: <IconList /> }, { value: 'graph', label: 'Graph view', icon: <IconOntology /> }]} />
        {view === 'list' && (
          <nav className="exp__pager" aria-label="Pages">
            <Button variant="ghost" className="h-auto exp__pg" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><IconChevron className="exp__prev" /></Button>
            <span aria-live="polite">{page} / {pages}</span>
            <Button variant="ghost" className="h-auto exp__pg" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><IconChevron className="exp__next" /></Button>
          </nav>
        )}
        </div>
      </div>

      {load === 'error' ? (
        <LoadError what="classes" onRetry={retry} />
      ) : view === 'graph' ? (
        load === 'loading' ? <p className="exp__loading" role="status">Loading classes…</p> : <Graph classes={SEED_CLASSES} selected={picked} onSelect={setPicked} data={HEAVY} />
      ) : (
        <div className="ns__tablewrap ns__tablewrap--flat" aria-busy={load === 'loading'}>
          <table className="ns__table">
            <thead>
              <tr>
                <th scope="col" aria-sort={asc ? 'ascending' : 'descending'}>
                  <button type="button" className="ns__sort" onClick={() => setAsc((v) => !v)}>Class <IconSort className="ns__sort-icon is-on" /></button>
                </th>
                <th scope="col">Ontology</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {load === 'loading' && <Skeleton cols={3} />}
              {load === 'ready' && shown.map((c) => (
                <tr key={c.key}>
                  <th scope="row">{c.name}</th>
                  <td>{ontology}</td>
                  <td className="exp__desc">{DESCRIPTIONS[c.key]}</td>
                </tr>
              ))}
              {load === 'ready' && list.length === 0 && (
                <tr>
                  <td colSpan={3} className="ns__empty">
                    <EmptyState art="loupe" compact title="No classes match" action={<Button variant="ghost" className="h-auto ns__btn" onClick={() => setQuery('')}>Clear filter</Button>}>
                      Try a different word.
                    </EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {load === 'loading' && <p className="exp__loading" role="status">Loading classes…</p>}
        </div>
      )}
    </div>
  )
}

/* ---------- Ontologies ---------- */

type Kind = 'all' | 'induced' | 'foundational' | 'uploaded'

function Ontologies({ onOpen }: { onOpen: () => void }) {
  const [kind, setKind] = useState<Kind>('all')
  const { load, retry } = useLoad('ontologies')
  const rows = kind === 'all' || kind === 'induced' ? [{ name: ONTOLOGY, iri: IRI, classes: 7, props: 73, axioms: 553, created: '7/10/2026, 12:29:56 pm' }] : []
  return (
    <div className="ns__card ns__panel">
      <div className="exp__head">
        <h2 className="ns__card-title">Ontologies <span className="ns__count">(1)</span></h2>
        <SegmentedControl
          label="Ontology type"
          value={kind}
          onValueChange={(v) => setKind(v as Kind)}
          options={[
            { value: 'all', label: 'All (1)' },
            { value: 'induced', label: 'Induced (1)' },
            { value: 'foundational', label: 'Foundational (0)' },
            { value: 'uploaded', label: 'Uploaded (0)' },
          ]}
        />
      </div>
      <p className="exp__sub">Every ontology registered in this namespace. Open an induced ontology to browse its classes and relationships.</p>
      {load === 'error' ? <LoadError what="ontologies" onRetry={retry} /> : (
        load === 'ready' && rows.length === 0 ? (
          <EmptyState art="graph" compact title={`No ${kind} ontologies yet`}>
            {kind === 'foundational' ? 'Foundational ontologies give every namespace a shared base vocabulary.' : 'Upload an ontology file and it will be listed here.'}
          </EmptyState>
        ) : (
          <div className="ns__tablewrap ns__tablewrap--flat" aria-busy={load === 'loading'}>
            <table className="ns__table">
              <thead>
                <tr>
                  <th scope="col">Ontology</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="ind__num">Classes</th>
                  <th scope="col" className="ind__num">Properties</th>
                  <th scope="col" className="ind__num">Axioms</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {load === 'loading' && <Skeleton cols={6} />}
                {load === 'ready' && rows.map((r) => (
                  <tr key={r.name}>
                    <td>
                      <button type="button" className="ns__name" onClick={onOpen}>{r.name}</button>
                      <span className="exp__iri">{r.iri}</span>
                    </td>
                    <td><span className="ns__status ns__status--info">Induced</span></td>
                    <td className="ns__num ind__num">{r.classes}</td>
                    <td className="ns__num ind__num">{r.props}</td>
                    <td className="ns__num ind__num">{r.axioms}</td>
                    <td className="ns__num">{r.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

/* ---------- Inducted sources ---------- */

function Sources() {
  const { load, retry } = useLoad('sources')
  return (
    <div className="ns__card ns__panel">
      <h2 className="ns__card-title">Inducted sources <span className="ns__count">(1)</span></h2>
      <p className="exp__sub">Data sources that have fed an induction in this namespace.</p>
      {load === 'error' ? <LoadError what="sources" onRetry={retry} /> : (
        <div className="ns__tablewrap ns__tablewrap--flat" aria-busy={load === 'loading'}>
          <table className="ns__table">
            <thead>
              <tr>
                <th scope="col">Datasource</th>
                <th scope="col">Label</th>
                <th scope="col" className="ind__num">Tables</th>
                <th scope="col" className="ind__num">Classes</th>
              </tr>
            </thead>
            <tbody>
              {load === 'loading' && <Skeleton cols={4} />}
              {load === 'ready' && (
                <tr>
                  <th scope="row">AWS-blogs</th>
                  <td>{ONTOLOGY}</td>
                  <td className="ns__num ind__num">N/A</td>
                  <td className="ns__num ind__num">7</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ---------- Page ---------- */

export default function Explorer() {
  const [tab, setTab] = useState<Tab>('classes')
  const [ontology, setOntology] = useState(ONTOLOGY)
  return (
    <section className="ns" aria-labelledby="exp-title">
      <header className="ns__head">
        <PageTitle id="exp-title" title="Explorer" help="explorer" />
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="ns__tabs">
            <TabsList aria-label="Explorer sections">
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="ontologies">Ontologies</TabsTrigger>
              <TabsTrigger value="sources">Inducted sources</TabsTrigger>
            </TabsList>
        </Tabs>
      </header>
      {tab === 'classes' && <Classes ontology={ontology} setOntology={setOntology} />}
      {tab === 'ontologies' && <Ontologies onOpen={() => { setOntology(ONTOLOGY); setTab('classes') }} />}
      {tab === 'sources' && <Sources />}
    </section>
  )
}
