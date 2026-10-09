import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import AssistantReply from './AssistantReply'
import { buildGreeting, registerVisit } from './greeting'
import ScopeMenu from './ScopeMenu'
import AttachMenu from './AttachMenu'
import type { Scope } from './ScopeMenu'
import { scopeLabel } from './ScopeMenu'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { BorderBeam } from 'border-beam'
import FloatingMascot from './FloatingMascot'
import FeedbackMenu from './FeedbackMenu'
import NewBadge from './NewBadge'
import Tip from './Tip'
import Namespaces from './Namespaces'
import Logo3D from './Logo3D'
import ProfileMenu from './ProfileMenu'
import SettingsDialog from './SettingsDialog'
import Walkthrough from './Walkthrough'
import type { Step } from './Walkthrough'
import { MASCOTS, loadMascot, saveMascot, loadShowMascot, saveShowMascot } from './mascots'
import type { MascotId } from './mascots'
import './Conversation.css'
import {
  IconNewChat, IconProjects, IconAgent, IconWorkflow, IconMarket,
  IconResearch, IconApps, IconAdmin, IconSettings, IconPanel, IconChevron,
  IconSearch, IconBell, IconMic, IconSend, IconFolderPlus,
  IconSpark, IconSun, IconMoon, IconClose, IconEdit, IconFolder, IconSliders, IconChat, IconFork,
  IconStar, IconGrid, IconBars, IconDownload, IconShare, IconSort, IconFile, IconRecords, IconClock,
  IconPalette, IconCode, IconOntology, IconInbox, IconGlobe, IconRoute,
} from './icons'
import DesignLab from './DesignLab'
import ProjectDetail from './ProjectDetail'

type Row = { name: string; status: 'Open' | 'In progress' | 'Completed'; date: string; units: string }

const PREVIEW_ROWS: Row[] = [
  { name: 'Zifo', status: 'Open', date: '05 Mar 2023', units: 'EUR' },
  { name: 'Maveric', status: 'In progress', date: '05 Mar 2023', units: 'GBP' },
  { name: 'Stellium', status: 'Completed', date: '05 Mar 2023', units: 'EUR' },
  { name: 'Instellar', status: 'In progress', date: '05 Mar 2023', units: 'EUR' },
  { name: 'Nest Digital', status: 'In progress', date: '05 Mar 2023', units: 'EUR' },
  { name: 'Meta', status: 'Open', date: '05 Mar 2023', units: 'GBP' },
]
const statusClass = (s: Row['status']) =>
  s === 'Completed' ? 'completed' : s === 'In progress' ? 'progress' : 'open'

type Msg = { id: number; role: 'user' | 'assistant'; text: string; fresh?: boolean; prompt?: string; context?: string[] }

type Chat = { id: string; group: string; title: string; dot: string; fork?: boolean }

const CHATS: Chat[] = [
  { id: 'c1', group: 'Today', title: 'Fork · CDU-1 scope freez…', dot: '#b9c0ca', fork: true },
  { id: 'c2', group: 'Today', title: 'CDU-1 scope freeze exce…', dot: '#b9c0ca', fork: true },
  { id: 'c3', group: 'Today', title: 'E-1104 bundle delivery slip', dot: '#3aa828' },
  { id: 'c4', group: 'Today', title: 'Jubail pipeline ILI: top a…', dot: '#3aa828' },
  { id: 'c5', group: 'Yesterday', title: 'IR-2214 flange leak: roo…', dot: '#fa8c16' },
  { id: 'c6', group: 'Last Monday', title: 'IR-2214 flange leak: root …', dot: '#52c41a' },
]

/* Split a typed prompt into styled segments: /commands (blue) and @agents (orange). */
function renderPrompt(text: string) {
  return text.split(/(\s+)/).map((tok, i) => {
    if (/^\/\S/.test(tok)) return <span key={i} className="seg seg--cmd">{tok}</span>
    if (/^@\S/.test(tok)) return <span key={i} className="seg seg--agent">{tok}</span>
    return <span key={i}>{tok}</span>
  })
}

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('keos-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const A = '/assets'
const BUILD_LOGO = `${A}/keos-build-mark.svg`

type Item = { id: string; label: string; Icon: (p: { className?: string }) => JSX.Element; isNew?: boolean }

type Note = { id: string; title: string; body: string; when: string; cta?: { label: string; tour: 'ontology' } }
const INBOX_ITEMS: Note[] = [
  { id: 'i1', title: 'Atlas finished the TAR scope-freeze review', body: '12 work orders flagged for re-sequencing before the CDU-1 shutdown window.', when: '2 hours ago' },
  { id: 'i2', title: 'You were mentioned in IR-2214 flange leak', body: 'Ravi asked you to confirm the root-cause owner before Friday.', when: 'Yesterday' },
  { id: 'i3', title: 'Budget alert for KEOS Internal', body: "You have used 26% of this month's $30.00 allowance.", when: '3 days ago' },
]
const NEWS_ITEMS: Note[] = [
  { id: 'n1', title: 'Ontology views are live', body: 'Namespaces, Induction, Explorer, Metrics and Playground now sit under Ontology in the sidebar.', when: 'Today', cta: { label: 'Tour the ontology views', tour: 'ontology' } },
  { id: 'n2', title: 'Three memory graph styles', body: 'Switch the pod memory graph between Classic, Minimal and Neon.', when: '2 days ago' },
  { id: 'n3', title: 'CodeGenie preview', body: 'Chat and Code modes for builds are available from the Build menu.', when: '5 days ago' },
]

const PROMPT_SAMPLES = [
  'Summarize the key risks in the Ras Tanura turnaround schedule',
  'Which contractors are behind on their milestones this week?',
  '@Planner build a 3-week look-ahead for the shutdown scope',
  'Compare planned vs. actual manhours across all active pods',
  'What changed in the latest revision of the scope document?',
]

const ONTOLOGY = [
  { id: 'ontology-namespaces', label: 'Namespaces' },
  { id: 'ontology-induction', label: 'Induction' },
  { id: 'ontology-explorer', label: 'Explorer' },
  { id: 'ontology-metrics', label: 'Metrics' },
  { id: 'ontology-playground', label: 'Playground' },
]

const build: Item[] = [
  { id: 'codegenie', label: 'CodeGenie', Icon: IconCode },
  { id: 'agents', label: 'Agent store', Icon: IconAgent },
  { id: 'workflows', label: 'Workflows', Icon: IconWorkflow },
  { id: 'market', label: 'Marketplace', Icon: IconMarket },
  { id: 'designlab', label: 'Design lab', Icon: IconPalette },
]
const work: Item[] = [
  { id: 'research', label: 'Research', Icon: IconResearch },
  { id: 'apps', label: 'Apps and artifacts', Icon: IconApps },
]
const control: Item[] = [
  { id: 'admin', label: 'Admin and governance', Icon: IconAdmin },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
]

const VISIT = registerVisit()

const STARTERS = [
  'Which contractors are behind this week?',
  'Chart planned vs. actual manhours',
  'Write a script to export the table',
]

const ONTOLOGY_TOUR: Step[] = [
  { target: '[data-nav="ontology-namespaces"]', title: 'Namespaces', body: 'Keep the concepts, rules and terms of each team or pod in their own space.' },
  { target: '[data-nav="ontology-induction"]', title: 'Induction', body: 'Review new concepts and relationships suggested from your documents before they join the ontology.' },
  { target: '[data-nav="ontology-explorer"]', title: 'Explorer', body: 'Browse how concepts connect and follow a thread from any node.' },
  { target: '[data-nav="ontology-metrics"]', title: 'Metrics', body: 'Check how complete and how well used your ontology is.' },
  { target: '[data-nav="ontology-playground"]', title: 'Playground', body: 'Try questions against the ontology without changing anything.' },
]

const TOUR_STEPS: Step[] = [
  { target: '[data-nav="newchat"]', title: 'Start a chat', body: 'Open a fresh conversation any time. Your earlier chats stay under All chats.' },
  { target: '.scope .chip', title: 'Choose where I search', body: 'Scope decides where answers come from: this device, selected pods, or your whole organization.' },
  { target: '.composer__attach', title: 'Add context', body: 'Attach files, pull in connectors, or turn on web search. Press Tab to use the suggested prompt.' },
  { target: '.chats-chip', title: 'Find past chats', body: 'All chats opens your history with search. Forked chats are marked with a branch icon.' },
  { target: '.topbar__inbox', title: 'Updates in one place', body: 'Agent results and mentions land here, with a red dot when something is new.' },
  { target: '.profile__trigger', title: 'Make it yours', body: 'Open Personal settings to pick a mascot, or replay this tour whenever you like.' },
]

export default function Conversation() {
  const [expanded, setExpanded] = useState(() => window.innerWidth > 640)
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [ontologyOpen, setOntologyOpen] = useState(true)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [inboxTab, setInboxTab] = useState<'inbox' | 'new'>('inbox')
  const [readIds, setReadIds] = useState<string[]>(['i3', 'n3'])
  useEffect(() => {
    if (!inboxOpen) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setInboxOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [inboxOpen])
  const unread = [...INBOX_ITEMS, ...NEWS_ITEMS].filter((n) => !readIds.includes(n.id)).length
  const firstUnread = INBOX_ITEMS.find((n) => !readIds.includes(n.id))
  const unreadInbox = INBOX_ITEMS.filter((n) => !readIds.includes(n.id)).length
  const [active, setActive] = useState('newchat')
  const [nsDetail, setNsDetail] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => { if (active !== 'ontology-namespaces') setNsDetail(null) }, [active])
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('keos-theme', theme)
  }, [theme])

  const [toast, setToast] = useState<{ lead: string; bold: string; sub: string } | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setToast({ lead: 'Theme set to', bold: next === 'dark' ? 'Dark' : 'Light', sub: 'Applies across every KEOS screen.' })
  }

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const hasThread = messages.length > 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const [files, setFiles] = useState<File[]>([])
  const [webSearch, setWebSearch] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [running, setRunning] = useState(false)
  const [stopCount, setStopCount] = useState(0)
  const canSend = !running && (input.trim().length > 0 || files.length > 0)
  type Queued = { id: number; text: string; ctx: string[] }
  const [dropping, setDropping] = useState(false)
  /* What this message will use: shown back under the reply so nothing is hidden */
  const ctxNow = (): string[] => [
    'Scope: ' + scopeLabel(scope),
    ...(scope === 'project' ? projects.map((p) => p.replace(/…$/, '')) : []),
    ...(files.length ? [files.length === 1 ? files[0].name : files.length + ' files'] : []),
    ...(webSearch ? ['Web search'] : []),
  ]
  const [queue, setQueue] = useState<Queued[]>([])
  const [queuePaused, setQueuePaused] = useState(false)
  const [queueNote, setQueueNote] = useState('')
  const stop = () => { setQueuePaused(true); setStopCount((n) => n + 1) }
  const submit = (t: string, ctx: string[]) => {
    const id = Date.now()
    setMessages((m) => [
      ...m,
      { id, role: 'user', text: t },
      { id: id + 1, role: 'assistant', text: '', fresh: true, prompt: t, context: ctx },
    ])
    // Running state: the prompt box shows the beam until the reply finishes streaming
    setRunning(true)
    // Document prompts open the Live preview panel (slides in after "generating")
    if (/\b(pdf|docx?|document|prd|report|dashboard|preview)\b/i.test(t)) {
      setChatsOpen(false)
      window.setTimeout(() => setPreviewOpen(true), 650)
    }
  }

  const send = () => {
    const t = input.trim()
    if (!t && files.length === 0) return
    const text = t || files.map((f) => f.name).join(', ')
    if (running) {
      // A reply is still running: keep the message in a visible queue instead of dropping it
      setQueue((q) => [...q, { id: Date.now(), text, ctx: ctxNow() }])
      setQueueNote('Queued. KEOS will send it when the current reply finishes.')
      setInput('')
      setFiles([])
      return
    }
    const ctx = ctxNow()
    setInput('')
    setFiles([])
    submit(text, ctx)
  }

  // Send the next queued message once the current reply is done
  useEffect(() => {
    if (running || queuePaused || queue.length === 0) return
    const id = window.setTimeout(() => {
      const [next, ...rest] = queue
      setQueue(rest)
      setQueueNote(rest.length ? 'Sent a queued message.' : 'Queue is empty.')
      submit(next.text, next.ctx)
    }, 500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, queuePaused, queue])

  const editQueued = (q: Queued) => {
    setQueue((cur) => cur.filter((x) => x.id !== q.id))
    setInput(q.text)
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer__input')?.focus())
  }
  const sendNow = (q: Queued) => {
    setQueue((cur) => [q, ...cur.filter((x) => x.id !== q.id)])
    setQueuePaused(false)
    setStopCount((n) => n + 1)
  }

  const editMessage = (id: number) => {
    const i = messages.findIndex((m) => m.id === id)
    if (i < 0 || running) return
    setInput(messages[i].text)
    setMessages(messages.slice(0, i))
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer__input')?.focus())
  }

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && running) {
      e.preventDefault()
      stop()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const [projects, setProjects] = useState([
    'Aramco Ras Tanura Turnaround (TAR…',
  ])
  const removeProject = (i: number) =>
    setProjects((p) => p.filter((_, idx) => idx !== i))
  const addProject = () =>
    setProjects((p) => [...p, `New pod ${p.length + 1}…`])

  const [chatsOpen, setChatsOpen] = useState(false)
  const [chatQuery, setChatQuery] = useState('')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewView, setPreviewView] = useState<'table' | 'chart'>('table')
  const [listening, setListening] = useState(false)

  const filteredChats = CHATS.filter((c) => {
    const q = chatQuery.trim().toLowerCase()
    return !q || c.title.toLowerCase().includes(q)
  })
  const chatGroups = filteredChats.reduce<Record<string, Chat[]>>((acc, c) => {
    ;(acc[c.group] ??= []).push(c)
    return acc
  }, {})

  const openChat = (c: Chat) => {
    setActiveChatId(c.id)
    const id = Date.now()
    setMessages([
      { id, role: 'user', text: c.title },
      { id: id + 1, role: 'assistant', text: '' },
    ])
  }

  const newChat = () => {
    setMessages([])
    setInput('')
    setActiveChatId(null)
    setActive('newchat')
  }

  const [sampleIdx, setSampleIdx] = useState(0)
  useEffect(() => {
    if (input) return
    const t = setInterval(() => setSampleIdx((i) => (i + 1) % PROMPT_SAMPLES.length), 4200)
    return () => clearInterval(t)
  }, [input])

  const [codeMode, setCodeMode] = useState<'chat' | 'code'>('chat')
  const newBuild = () => {
    setMessages([])
    setInput('')
    setActiveChatId(null)
    setActive('codegenie')
    setCodeMode('chat')
  }

  const [scope, setScope] = useState<Scope>('project')
  const [mascot, setMascot] = useState<MascotId>(loadMascot)
  const [showMascot, setShowMascot] = useState(loadShowMascot)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourSteps, setTourSteps] = useState<Step[]>(TOUR_STEPS)
  const startTour = (which: 'app' | 'ontology') => {
    if (which === 'ontology') { setExpanded(true); setOntologyOpen(true) }
    setTourSteps(which === 'ontology' ? ONTOLOGY_TOUR : TOUR_STEPS)
    setTourOpen(true)
  }
  const mascotDef = MASCOTS.find((m) => m.id === mascot) ?? MASCOTS[0]
  const greeting = buildGreeting({ now: new Date(), firstName: 'Aswini', visit: VISIT, nextUpdate: firstUnread?.title, unreadCount: unreadInbox, project: projects[0] })

  const composerBlock = (
    <>
      <div className="chips">
        <ScopeMenu value={scope} onChange={setScope} />
        {projects.map((name, i) => (
          <span key={i} className="chip chip--project">
            <IconFolder className="chip__icon" />
            <span>{name}</span>
            <Button variant="ghost" 
              className="h-auto chip__remove"
              aria-label={`Remove ${name}`}
              onClick={() => removeProject(i)}
            >
              <IconClose className="chip__chev" />
            </Button>
          </span>
        ))}
        <Tip label="Add a pod to your scope" side="top"><Button variant="ghost" className="h-auto chip chip--icon" aria-label="Add pod to scope" onClick={addProject}>
          <IconFolderPlus className="chip__icon" />
        </Button></Tip>
      </div>

      {(queue.length > 0 || queueNote) && (
        <div className="queue" role="region" aria-label="Queued messages">
          {queue.length > 0 && (
            <>
              <div className="queue__head">
                <span>{queuePaused ? 'Queue paused · ' + queue.length : 'Queued · ' + queue.length}</span>
                {queuePaused && <Button variant="ghost" className="h-auto queue__link" onClick={() => setQueuePaused(false)}>Resume</Button>}
                <Button variant="ghost" className="h-auto queue__link" onClick={() => { setQueue([]); setQueueNote('Queue cleared.') }}>Clear all</Button>
              </div>
              <ol className="queue__list">
                {queue.map((q, i) => (
                  <li key={q.id} className="queue__item">
                    <span className="queue__n">{i + 1}</span>
                    <span className="queue__t">{q.text}</span>
                    <Tip label="Send now" side="top"><Button variant="ghost" className="h-auto queue__act" aria-label={'Send queued message ' + (i + 1) + ' now'} onClick={() => sendNow(q)}><IconSend /></Button></Tip>
                    <Tip label="Edit" side="top"><Button variant="ghost" className="h-auto queue__act" aria-label={'Edit queued message ' + (i + 1)} onClick={() => editQueued(q)}><IconEdit /></Button></Tip>
                    <Tip label="Remove" side="top"><Button variant="ghost" className="h-auto queue__act" aria-label={'Remove queued message ' + (i + 1)} onClick={() => { setQueue((cur) => cur.filter((x) => x.id !== q.id)); setQueueNote('Removed from the queue.') }}><IconClose /></Button></Tip>
                  </li>
                ))}
              </ol>
              {queuePaused && <p className="queue__note">Paused because you stopped the reply. Resume to send these.</p>}
            </>
          )}
          <p className="sr-only" role="status" aria-live="polite">{queueNote}</p>
        </div>
      )}
      <div id="approval-slot" className="approval-slot" />
      <div className="composer-wrap">
        {showMascot && (
          <FloatingMascot
            key={mascotDef.id}
            directions={mascotDef.directions}
            reactions={mascotDef.reactions}
            name={mascotDef.name}
            size={88}
            onHide={() => {
              setShowMascot(false)
              saveShowMascot(false)
              setToast({ lead: 'Mascot hidden.', bold: 'Bring it back any time', sub: 'Open Personal settings from your profile menu.' })
            }}
          />
        )}
      <BorderBeam
        size="md"
        colorVariant="colorful"
        strength={1}
        theme={theme}
        borderRadius={10}
        active={running}
        className="composer-beam"
      >
      <div
        className={`composer${input.trim() ? ' is-typing' : ''}${running ? ' is-running' : ''}${dropping ? ' is-drop' : ''}`}
        aria-busy={running}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropping(true) } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false) }}
        onDrop={(e) => {
          e.preventDefault()
          setDropping(false)
          const dropped = Array.from(e.dataTransfer.files)
          if (dropped.length) setFiles((p) => [...p, ...dropped])
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
          e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.removeProperty('--mx')
          e.currentTarget.style.removeProperty('--my')
        }}
      >
        {dropping && <div className="composer__drop" role="status">Drop files to add them to this message</div>}
        <div className="composer__field">
          <Textarea
            className="min-h-0 [field-sizing:fixed] composer__input"
            aria-label="Message KEOS"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const pasted = Array.from(e.clipboardData.files)
              if (pasted.length) { e.preventDefault(); setFiles((p) => [...p, ...pasted]) }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !input && !e.shiftKey) {
                e.preventDefault()
                setInput(PROMPT_SAMPLES[sampleIdx])
                return
              }
              onComposerKey(e)
            }}
          />
          {!input && running && (
            <span className="composer__ph" aria-hidden="true">Type to queue your next message<kbd className="composer__ph-key">Enter</kbd></span>
          )}
          {!input && !running && (
            <span key={sampleIdx} className="composer__ph" aria-hidden="true">
              {PROMPT_SAMPLES[sampleIdx]}
              <kbd className="composer__ph-key">Tab</kbd>
            </span>
          )}
        </div>
        {(files.length > 0 || webSearch) && (
          <ul className="composer__files" aria-label="Attachments">
            {webSearch && (
              <li className="composer__file">
                <IconGlobe className="composer__file-icon" />
                <span>Web search</span>
                <Button variant="ghost" className="h-auto composer__file-x" aria-label="Turn off web search" onClick={() => setWebSearch(false)}>
                  <IconClose />
                </Button>
              </li>
            )}
            {files.map((f, n) => (
              <li key={f.name + n} className="composer__file">
                <IconFile className="composer__file-icon" />
                <span>{f.name}</span>
                <Button variant="ghost" className="h-auto composer__file-x" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((_, k) => k !== n))}>
                  <IconClose />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="composer__actions">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              if (picked.length) setFiles((p) => [...p, ...picked])
              e.target.value = ''
            }}
          />
          <AttachMenu
            webSearch={webSearch}
            onToggleWebSearch={() => setWebSearch((v) => !v)}
            onPickFiles={() => fileRef.current?.click()}
            onUnavailable={(what) => setToast({ lead: 'Coming soon:', bold: what, sub: 'For now, use “Add files or photos” to upload from this device.' })}
          />
          <Button variant="ghost" className="h-auto composer__smart">
            <IconSpark className="composer__smart-icon" />
            <span>Smart</span>
            <IconChevron className="chip__chev" />
          </Button>
          <Tip label={listening ? 'Stop voice input' : 'Voice input'} side="top"><Button variant="ghost" 
            className={`h-auto composer__mic${listening ? ' is-listening' : ''}`}
            onClick={() => setListening((v) => !v)}
            aria-label={listening ? 'Stop listening' : 'Voice input'}
            aria-pressed={listening}
          >
            {listening ? <ThinkingOrb state="listening" size={20} /> : <IconMic />}
          </Button></Tip>
          <Tip label={running ? 'Stop generating' : canSend ? 'Send' : 'Type a message to send'} shortcut={running ? 'Esc' : canSend ? 'Enter' : undefined} side="top"><Button variant="ghost" className={`h-auto composer__send${running ? ' is-stop' : ''}`} aria-label={running ? 'Stop generating' : 'Send'} disabled={!running && !canSend} onClick={running ? stop : send}>
            {running ? <span className="composer__stop" aria-hidden="true" /> : <IconSend />}
          </Button></Tip>
        </div>
      </div>
      </BorderBeam>
      </div>
    </>
  )

  const NavBtn = ({ id, label, Icon, isNew }: Item) => (
    <Tip label={label} side="right" block disabled={expanded}><Button variant="ghost" 
      data-nav={id}
      className={`h-auto nav__item${active === id ? ' is-active' : ''}`}
      onClick={() => setActive(id)}
    >
      <Icon className="nav__icon" />
      <span className="nav__label">{label}</span>
      {isNew && expanded && <NewBadge />}
    </Button></Tip>
  )

  return (
    <div className={`app${expanded ? ' is-expanded' : ' is-collapsed'}`}>
      {/* ===================== SIDEBAR ===================== */}
      <aside className="sidebar">
        <div className="sidebar__top">
          <div className="sidebar__id">
            {expanded ? (
              <img className="sidebar__logo" src={BUILD_LOGO} alt="KEOS" />
            ) : (
              <Tip label="Expand sidebar" side="right"><Button
                variant="ghost"
                className="h-auto sidebar__logo-btn"
                aria-label="Expand sidebar"
                onClick={() => setExpanded(true)}
              >
                <img className="sidebar__logo" src={BUILD_LOGO} alt="" aria-hidden="true" />
                <IconPanel className="sidebar__logo-panel" />
              </Button></Tip>
            )}
            <span className="sidebar__brand">
              KEOS
            </span>
          </div>
          <div className="sidebar__top-right">
            {expanded && active === 'codegenie' && (
              <div className="mode-toggle" role="radiogroup" aria-label="Chat or code mode">
                <Button variant="ghost" 
                  className={`h-auto mode-toggle__btn${codeMode === 'chat' ? ' is-active' : ''}`}
                  onClick={() => setCodeMode('chat')}
                  role="radio"
                  aria-checked={codeMode === 'chat'}
                  aria-label="Chat mode"
                >
                  <IconChat className="mode-toggle__icon" />
                  <span className="mode-toggle__dot" />
                </Button>
                <Button variant="ghost" 
                  className={`h-auto mode-toggle__btn${codeMode === 'code' ? ' is-active' : ''}`}
                  onClick={() => setCodeMode('code')}
                  role="radio"
                  aria-checked={codeMode === 'code'}
                  aria-label="Code mode"
                >
                  <IconCode className="mode-toggle__icon" />
                </Button>
              </div>
            )}
            <Tip label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} side="bottom"><Button variant="ghost" 
              className="h-auto sidebar__toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <IconPanel />
            </Button></Tip>
          </div>
        </div>

        <div className="sidebar__scroll">
          <Tip label={active === 'codegenie' ? 'New build' : 'New chat'} side="right" block disabled={expanded}><Button variant="ghost" 
            data-nav="newchat"
            className={`h-auto nav__item nav__item--primary${active === 'newchat' || active === 'codegenie' ? ' is-active' : ''}`}
            onClick={active === 'codegenie' ? newBuild : newChat}
          >
            <IconNewChat className="nav__icon" />
            <span className="nav__label">{active === 'codegenie' ? 'New build' : 'New chat'}</span>
          </Button></Tip>

          {/* Projects (expandable) */}
          <Tip label="Pods" side="right" block disabled={expanded}><Button variant="ghost" 
            data-nav="projects"
            className="h-auto nav__item"
            onClick={() => (expanded ? setProjectsOpen((v) => !v) : setExpanded(true))}
          >
            <IconProjects className="nav__icon" />
            <span className="nav__label">Pods</span>
            <IconChevron
              className={`nav__chevron${projectsOpen ? ' is-open' : ''}`}
            />
          </Button></Tip>
          {expanded && projectsOpen && (
            <div className="nav__sub">
              <Button variant="ghost" className="h-auto nav__subitem" onClick={() => setActive('project')}>All pods</Button>
              <Button variant="ghost" className="h-auto nav__subitem">New pod</Button>
            </div>
          )}

          {/* Ontology (expandable) */}
          <Tip label="Ontology" side="right" block disabled={expanded}><Button variant="ghost"
            data-nav="ontology"
            className="h-auto nav__item"
            onClick={() => (expanded ? setOntologyOpen((v) => !v) : setExpanded(true))}
          >
            <IconOntology className="nav__icon" />
            <span className="nav__label">Ontology</span>
            <IconChevron className={`nav__chevron${ontologyOpen ? ' is-open' : ''}`} />
          </Button></Tip>
          {expanded && ontologyOpen && (
            <div className="nav__sub">
              {ONTOLOGY.map((o) => (
                <Button
                  key={o.id}
                  variant="ghost"
                  data-nav={o.id}
                  className={`h-auto nav__subitem${active === o.id ? ' is-active' : ''}`}
                  onClick={() => setActive(o.id)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          )}

          <div className="nav__section">
            <span className="nav__section-label">Build</span>
            {build.map((it) => <NavBtn key={it.id} {...it} />)}
          </div>

          <div className="nav__section">
            <span className="nav__section-label">Work</span>
            {work.map((it) => <NavBtn key={it.id} {...it} />)}
          </div>

          <div className="nav__section">
            <span className="nav__section-label">Control</span>
            {control.map((it) => <NavBtn key={it.id} {...it} />)}
          </div>
        </div>

        <div className="sidebar__footer">
          <div className="footer-row">
          <ProfileMenu onWalkthrough={() => startTour('app')} onSettings={() => setSettingsOpen(true)}>
            <div className="user">
              <span className="user__avatar">AB</span>
              <span className="user__text">
                <b>Aswini Bala</b>
                <small>KaarTech</small>
              </span>
            </div>
          </ProfileMenu>
            <FeedbackMenu />
          </div>
        </div>
      </aside>

      {/* ===================== MAIN ===================== */}
      <main className="main">
        <header className="topbar">
          <nav className="crumbs">
            {active === 'ontology-namespaces' && nsDetail ? (
              <>
                <button type="button" className="crumbs__link" onClick={() => setNsDetail(null)}>Namespaces</button>
                <span className="crumbs__sep" aria-hidden="true">›</span>
                <span className="crumbs__current" aria-current="page">{nsDetail.name}</span>
              </>
            ) : (
              <span className={`crumbs__current${active === 'codegenie' ? ' crumbs__current--accent' : ''}`}>
                {active === 'project'
                  ? 'All pods'
                  : active === 'codegenie'
                    ? 'CodeGenie'
                    : ONTOLOGY.find((o) => o.id === active)?.label ?? 'Chats'}
              </span>
            )}
          </nav>
          <div className="topbar__actions">
            <Tip label="Search" side="bottom"><Button variant="ghost" className="h-auto" aria-label="Search"><IconSearch /></Button></Tip>
            <Tip label={unread ? `Updates (${unread} new)` : 'Updates'} side="bottom"><Button
              variant="ghost"
              className="h-auto topbar__inbox"
              aria-label={unread ? `Updates, ${unread} unread` : 'Updates'}
              aria-expanded={inboxOpen}
              onClick={() => setInboxOpen((v) => !v)}
            >
              <IconInbox />
              {unread > 0 && <span className="topbar__dot" />}
            </Button></Tip>
            <Tip label="Notifications" side="bottom"><Button variant="ghost" className="h-auto" aria-label="Notifications"><IconBell /></Button></Tip>
            <Tip label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} side="bottom"><Button variant="ghost" className="h-auto"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'dark'}
            >
              <span key={theme} className="icon-swap">{theme === 'dark' ? <IconSun /> : <IconMoon />}</span>
            </Button></Tip>
          </div>
        </header>

        <div className="main__split">
        {!chatsOpen && active !== 'project' && !active.startsWith('ontology-') && (
          <Button
            variant="ghost"
            className="h-auto chip chats-chip"
            aria-label="Open all chats"
            aria-expanded={false}
            onClick={() => setChatsOpen(true)}
          >
            <IconChat className="chip__icon" />
            <span>All chats</span>
          </Button>
        )}
        {chatsOpen && active !== 'project' && (
          <aside className="chats">
            <div className="chats__head">
              <span className="chats__title">{active === 'codegenie' ? 'Sessions' : 'Chats'}</span>
              <Button variant="ghost" className="h-auto chats__icon" aria-label="Filter chats">
                <IconSliders />
              </Button>
              <Button variant="ghost" 
                className="h-auto chats__icon"
                aria-label="Close chats"
                onClick={() => setChatsOpen(false)}
              >
                <IconClose />
              </Button>
            </div>

            <div className="chats__search">
              <IconSearch className="chats__search-icon" />
              <Input
                className="h-auto chats__search-input"
                placeholder="Search chats or pods"
                aria-label="Search chats or pods"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
              />
            </div>

            <div className="chats__scroll">
              {filteredChats.length === 0 ? (
                <div className="chats__empty">
                  <IconChat className="chats__empty-icon" />
                  <p>{chatQuery ? 'No chats match your search' : 'No chats yet. Start one and it appears here.'}</p>
                </div>
              ) : (
                Object.entries(chatGroups).map(([group, items]) => (
                  <div key={group} className="chats__group">
                    <span className="chats__group-label">{group}</span>
                    {items.map((c) => (
                      <Button variant="ghost" 
                        key={c.id}
                        className={`h-auto chat-item${activeChatId === c.id ? ' is-active' : ''}`}
                        onClick={() => openChat(c)}
                      >
                        <span className="chat-item__dot" style={{ background: c.dot }} />
                        {c.fork && <IconFork className="chat-item__fork" />}
                        <span className="chat-item__title">{c.title}</span>
                      </Button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
        {active === 'designlab' ? (
          <DesignLab />
        ) : active === 'project' ? (
          <ProjectDetail />
        ) : active === 'ontology-namespaces' ? (
          <Namespaces detail={nsDetail} onDetail={setNsDetail} />
        ) : active.startsWith('ontology-') ? (
          <section className="convo">
            <div className="convo__inner">
              <span className="codegenie-code__icon"><IconOntology /></span>
              <h1 className="convo__title">{ONTOLOGY.find((o) => o.id === active)?.label}</h1>
              <p className="convo__subtitle">This page isn’t available yet. We’re still building it.</p>
            </div>
          </section>
        ) : active === 'codegenie' && codeMode === 'code' ? (
          <section className="convo">
            <div className="convo__inner">
              <span className="codegenie-code__icon"><IconCode /></span>
              <h1 className="convo__title">Code workspace</h1>
              <p className="convo__subtitle">Describe what you want to build and KEOS writes the code. This workspace opens soon.</p>
            </div>
          </section>
        ) : (
        <>
        <section className={`convo${hasThread ? ' is-thread' : ''}`}>
          {hasThread ? (
            <>
              <div className="thread">
                <div className="thread__inner">
                  {messages.map((m) =>
                    m.role === 'user' ? (
                      <div key={m.id} className="msg msg--user">
                        <Tip label={running ? 'Wait for the reply to finish' : 'Edit message'} side="left"><Button variant="ghost" className="h-auto msg__edit" aria-label="Edit message" disabled={running} onClick={() => editMessage(m.id)}><IconEdit /></Button></Tip>
                        <div className="bubble">{renderPrompt(m.text)}</div>
                      </div>
                    ) : (
                      <AssistantReply
                        key={m.id}
                        logo={BUILD_LOGO}
                        sections={REPLY_SECTIONS}
                        fresh={!!m.fresh}
                        onDone={() => setRunning(false)}
                        onTick={() => endRef.current?.scrollIntoView({ block: 'end' })}
                        onOpenDoc={() => setPreviewOpen(true)}
                        onFollowUp={(text) => setInput(text)}
                        prompt={m.prompt}
                        context={m.context}
                        stopSignal={stopCount}
                      />
                    ),
                  )}
                  <div ref={endRef} />
                </div>
              </div>
              <div className="dock">{composerBlock}</div>
            </>
          ) : (
            <div className="convo__inner">
              <Logo3D className="convo__logo3d" size={84} theme={theme === 'dark' ? 'dark' : 'light'} />
              <h1 className="convo__title">
                {active === 'codegenie' ? "Halfway there. Let's solve this, Aswini." : greeting.title}
              </h1>
              <p className="convo__subtitle">
                {active === 'codegenie' ? (
                  "Big goals take focus. Let's get to work."
                ) : (
                  <>{greeting.lead}</>
                )}
              </p>
              <div className="dock dock--hero">
                {composerBlock}
                {active !== 'codegenie' && (
                  <div className="starters" role="group" aria-label="Try one of these">
                    {STARTERS.map((st) => (
                      <button key={st} type="button" className="starter" onClick={() => { setInput(st); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer__input')?.focus()) }}>{st}</button>
                    ))}
                  </div>
                )}
                {active !== 'codegenie' && (
                  <button type="button" className="convo__next" onClick={() => setInboxOpen(true)} aria-label={`${greeting.next} Open updates.`}>
                    <IconInbox className="convo__next-icon" />
                    <span>{greeting.next}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {previewOpen && (
          <aside className="preview">
            <div className="preview__head">
              <span className="preview__title">Live preview</span>
              <div className="preview__tools">
                <Button variant="ghost" className="h-auto preview__btn">
                  <IconStar /> <span>Add to favorites</span>
                </Button>
                <div className="preview__toggle">
                  <Button variant="ghost" className={`h-auto ${previewView === 'table' ? 'is-active' : ''}`}
                    onClick={() => setPreviewView('table')}
                    aria-label="Table view"
                  >
                    <IconGrid />
                  </Button>
                  <Button variant="ghost" className={`h-auto ${previewView === 'chart' ? 'is-active' : ''}`}
                    onClick={() => setPreviewView('chart')}
                    aria-label="Chart view"
                  >
                    <IconBars />
                  </Button>
                </div>
                <Button variant="ghost" className="h-auto preview__btn">
                  <IconDownload /> <span>Download</span>
                </Button>
                <Button variant="ghost" className="h-auto preview__btn">
                  <IconShare /> <span>Share</span>
                </Button>
                <Button variant="ghost" 
                  className="h-auto preview__btn preview__close"
                  onClick={() => setPreviewOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="preview__body">
              <div className="preview__stats">
                <div className="stat">
                  <span className="stat__icon"><IconRecords /></span>
                  <div className="stat__text">
                    <small>Total records</small>
                    <b>1200</b>
                  </div>
                </div>
                <div className="stat">
                  <span className="stat__icon"><IconGrid /></span>
                  <div className="stat__text">
                    <small>Columns</small>
                    <b>5</b>
                  </div>
                </div>
                <div className="stat">
                  <span className="stat__icon"><IconClock /></span>
                  <div className="stat__text">
                    <small>Last updated</small>
                    <b>Now</b>
                  </div>
                </div>
              </div>

              {previewView === 'table' ? (
                <div className="preview__table-wrap">
                  <Table className="ptable">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pods <IconSort className="ptable__sort" /></TableHead>
                        <TableHead>Status <IconSort className="ptable__sort" /></TableHead>
                        <TableHead>Start date <IconSort className="ptable__sort" /></TableHead>
                        <TableHead>Units <IconSort className="ptable__sort" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PREVIEW_ROWS.map((r) => (
                        <TableRow key={r.name}>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>
                            <span className={`pill pill--${statusClass(r.status)}`}>
                              {r.status} <IconChevron className="pill__chev" />
                            </span>
                          </TableCell>
                          <TableCell>{r.date}</TableCell>
                          <TableCell>{r.units}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="preview__chart">
                  {PREVIEW_ROWS.map((r, i) => (
                    <div className="preview__bar-col" key={r.name}>
                      <div
                        className={`preview__bar pill--${statusClass(r.status)}`}
                        style={{ height: `${40 + i * 12}%` }}
                      />
                      <span>{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
        </>
        )}
        {inboxOpen && (
          <aside className="inbox inbox--side" aria-label="Updates">
            <div className="inbox__head">
              <span className="inbox__heading">Updates</span>
              <Tip label="Close updates" side="bottom"><Button variant="ghost" className="h-auto inbox__close" aria-label="Close updates" onClick={() => setInboxOpen(false)}>
                <IconClose />
              </Button></Tip>
            </div>
            <div className="inbox__tabs">
              <SegmentedControl
                label="Updates"
                value={inboxTab}
                onValueChange={(v) => setInboxTab(v as 'inbox' | 'new')}
                options={[
                  { value: 'inbox', label: 'Inbox' },
                  { value: 'new', label: "What's new" },
                ]}
              />
            </div>
            <div className="inbox__list">
              {(inboxTab === 'inbox' ? INBOX_ITEMS : NEWS_ITEMS).map((n) =>
                n.cta ? (
                  <div key={n.id} className="inbox__item inbox__item--cta">
                    <span className="inbox__title">
                      {!readIds.includes(n.id) && <span className="inbox__unread" aria-label="Unread" />}
                      {n.title}
                    </span>
                    <span className="inbox__body">{n.body}</span>
                    <span className="inbox__when">{n.when}</span>
                    <Button
                      variant="ghost"
                      className="h-auto inbox__cta"
                      onClick={() => {
                        setReadIds((r) => (r.includes(n.id) ? r : [...r, n.id]))
                        setInboxOpen(false)
                        startTour(n.cta!.tour)
                      }}
                    >
                      <IconRoute className="inbox__cta-icon" /> {n.cta.label}
                    </Button>
                  </div>
                ) : (
                <Button
                  key={n.id}
                  variant="ghost"
                  className="h-auto inbox__item"
                  onClick={() => setReadIds((r) => (r.includes(n.id) ? r : [...r, n.id]))}
                >
                  <span className="inbox__title">
                    {!readIds.includes(n.id) && <span className="inbox__unread" aria-label="Unread" />}
                    {n.title}
                  </span>
                  <span className="inbox__body">{n.body}</span>
                  <span className="inbox__when">{n.when}</span>
                </Button>
                ),
              )}
            </div>
          </aside>
        )}
        </div>
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mascot={mascot}
        onMascot={(id) => { setMascot(id); saveMascot(id) }}
        showMascot={showMascot}
        onShowMascot={(on) => { setShowMascot(on); saveShowMascot(on) }}
      />
      <Walkthrough open={tourOpen} steps={tourSteps} onClose={() => setTourOpen(false)} />

      {toast && (
        <div className="toast" role="status">
          <span className="toast__icon"><IconPalette /></span>
          <div className="toast__text">
            <span>{toast.lead} <b>{toast.bold}</b></span>
            <small>{toast.sub}</small>
          </div>
          <Button variant="ghost" className="h-auto toast__close" aria-label="Dismiss" onClick={() => setToast(null)}>
            <IconClose />
          </Button>
        </div>
      )}
    </div>
  )
}

const REPLY_SECTIONS = [
  'Executive Summary: Platform overview and MVP focus',
  'Problem Statement: Pain points: manual data work, delayed decisions, complex existing tools',
  'Solution Overview: No-code dashboard & report builder with pre-built connectors',
  'Target Users: Business users (finance/ops/sales managers) and data analysts',
  'Key Features: Data connectors (Salesforce, HubSpot, Stripe, databases), dashboard builder, automated reports, role-based sharing',
  'Success Metrics: Time-to-first-dashboard, activation rate, NPS targets',
  'Development Timeline: 12-week sprint roadmap (dashboard → connectors → reporting → polish)',
  'Risks & Assumptions: Key bets and mitigation strategies',
  'Out of Scope: What’s saved for post-MVP (SQL editing, AI insights, mobile, etc.)',
  'Definition of Done: Launch criteria (5 connectors, accessibility, 100 beta testers, NPS ≥ 40)',
]
