import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { Button } from '@/components/ui/button'
import { IconClose, IconBook } from './icons'
import './PageHead.css'

export type HelpKey = 'namespaces' | 'induction' | 'explorer' | 'metrics' | 'playground'

type Help = {
  title: string
  lead: string
  intro: string
  steps: { title: string; text: string }[]
  facts: { label: string; text: string }[]
  tips: string[]
}

const HELP: Record<HelpKey, Help> = {
  namespaces: {
    title: 'Namespaces guide',
    lead: 'Keep each team or project separate',
    intro: 'A namespace is an isolated scope in your knowledge graph. It has its own data sources, ontology and access rules, so one team’s data never mixes with another’s.',
    steps: [
      { title: 'Create a namespace', text: 'Give it a name and an optional description.' },
      { title: 'Add data sources', text: 'Connect documents, a database or an API.' },
      { title: 'Build the ontology', text: 'Run an induction to turn the sources into classes.' },
    ],
    facts: [
      { label: 'Active or inactive', text: 'An inactive namespace keeps its data but stops answering questions.' },
      { label: 'Sources', text: 'Each source shows its own status: completed, processing or failed.' },
      { label: 'Owner', text: 'The owner controls who can see and change the namespace.' },
    ],
    tips: ['Use one namespace per business area.', 'Open a namespace to see its sources, ontologies and metrics.', 'Choose View more on a namespace to see its ID and health.'],
  },
  induction: {
    title: 'Induction guide',
    lead: 'Turn your sources into an ontology',
    intro: 'Induction reads the sources you approved and proposes classes, relationships and rules. You review the proposal, then accept it to publish.',
    steps: [
      { title: 'Start an induction', text: 'Choose the sources KEOS should read.' },
      { title: 'Review the proposal', text: 'Rename classes, check relationships and validate the rules.' },
      { title: 'Accept to publish', text: 'The classes are added to the namespace and appear in Explorer.' },
    ],
    facts: [
      { label: 'Novel or grounded', text: 'Novel classes are new. Grounded classes match a reference ontology.' },
      { label: 'Validation', text: 'Checks the proposal against its SHACL shapes before you accept it.' },
      { label: 'Nothing is public yet', text: 'A proposal stays private until you accept it.' },
    ],
    tips: ['Select a class in the table to highlight it on the graph.', 'Drag the graph to rotate it and scroll to zoom.', 'Run another induction later to refine the ontology.'],
  },
  explorer: {
    title: 'Explorer guide',
    lead: 'See what is in your ontology',
    intro: 'Explorer lets you browse the published ontologies in this namespace, the classes inside them, and the sources they came from.',
    steps: [
      { title: 'Pick an ontology', text: 'Choose one from the list to open it.' },
      { title: 'Browse classes', text: 'Check each class’s attributes and relationships.' },
      { title: 'Trace the source', text: 'See which sources a class was induced from.' },
    ],
    facts: [
      { label: 'Table or graph', text: 'Switch views to read details or to see how classes connect.' },
      { label: 'Read only', text: 'Explorer never changes the ontology. Use Induction for that.' },
      { label: 'Namespace scope', text: 'You only see ontologies in the current namespace.' },
    ],
    tips: ['Use search to find a class by name.', 'Open the graph view for a map of related classes.'],
  },
  metrics: {
    title: 'Metrics guide',
    lead: 'Define a number once and reuse it everywhere',
    intro: 'Metrics are governed business measures, such as revenue or downtime, each with a compiled SQL expression. Everyone who asks gets the same answer.',
    steps: [
      { title: 'Create or import', text: 'Add a metric by hand or import an OSI file.' },
      { title: 'Review the SQL', text: 'Check the expression and the data it uses.' },
      { title: 'Use it in answers', text: 'KEOS uses the metric whenever someone asks about it.' },
    ],
    facts: [
      { label: 'OSI files', text: 'Open Semantic Interchange files describe metrics in .yaml or .json.' },
      { label: 'Export', text: 'Export your metrics to share them with other tools.' },
      { label: 'Removing a metric', text: 'Anything that uses it stops working until you add it back.' },
    ],
    tips: ['Select several rows to delete them together.', 'Reload if the list looks out of date.'],
  },
  playground: {
    title: 'Playground guide',
    lead: 'Test questions against your governed data',
    intro: 'The Playground runs questions on the ontology and metrics in this namespace, so you can check an answer before anyone depends on it.',
    steps: [
      { title: 'Choose a mode', text: 'Standard answers fast. Deep reasoning checks more first.' },
      { title: 'Ask a question', text: 'Type it in plain language and press Enter.' },
      { title: 'Open the steps', text: 'See what KEOS checked to reach the answer.' },
    ],
    facts: [
      { label: 'Separate from chat', text: 'Playground questions do not appear in your main chat history.' },
      { label: 'Stop any time', text: 'Press Esc or the stop button to end an answer early.' },
      { label: 'New chat', text: 'Clears the conversation and starts again.' },
    ],
    tips: ['Try one of the starter questions.', 'Use Deep reasoning for questions that combine several metrics.'],
  },
}

function HelpDrawer({ open, help, onClose }: { open: boolean; help: Help; onClose: () => void }) {
  const reduce = useReducedMotion()
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button')?.focus())
  }, [open])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
    if (e.key === 'Tab') {
      const f = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

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
            ref={panel}
            className="ns__drawer help"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            onKeyDown={onKey}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0, transition: motionTokens.spring.smooth }}
            exit={reduce ? { opacity: 0 } : { x: '100%', transition: { duration: motionTokens.duration.exit } }}
          >
            <div className="ns__drawer-head">
              <h2 id={`${id}-title`} className="dialog__title">{help.title}</h2>
              <Button variant="ghost" className="h-auto dialog__close" aria-label="Close help" onClick={onClose}><IconClose /></Button>
            </div>
            <div className="help__body">
              <h3 className="help__lead">{help.lead}</h3>
              <p className="help__text">{help.intro}</p>

              <h4 className="help__label">How it works</h4>
              <ol className="help__steps">
                {help.steps.map((s, i) => (
                  <li key={s.title}>
                    <span className="help__num" aria-hidden="true">{i + 1}</span>
                    <div><b>{s.title}</b><span>{s.text}</span></div>
                  </li>
                ))}
              </ol>

              <h4 className="help__label">Good to know</h4>
              <dl className="help__facts">
                {help.facts.map((f) => (
                  <div key={f.label}><dt>{f.label}</dt><dd>{f.text}</dd></div>
                ))}
              </dl>

              <h4 className="help__label">Tips</h4>
              <ul className="help__tips">
                {help.tips.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Page title on one line with a "Learn more" link that opens a help drawer on the right. */
export default function PageTitle({ id, title, count, help }: { id: string; title: string; count?: number; help: HelpKey }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pagetitle">
      <h1 id={id} className="ns__title">{title}{count !== undefined && <> <span className="ns__count">({count})</span></>}</h1>
      <span className="pagetitle__rule" aria-hidden="true" />
      <Button variant="ghost" className="h-auto pagetitle__link" onClick={() => setOpen(true)}>
        <IconBook /> Learn more
      </Button>
      <HelpDrawer open={open} help={HELP[help]} onClose={() => setOpen(false)} />
    </div>
  )
}

export type { ReactNode }
