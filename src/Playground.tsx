import { useCallback, useEffect, useRef, useState } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import Tip from './Tip'
import EmptyState from './EmptyState'
import { SEED_CLASSES } from './Induction'
import { IconCopy, IconCheck, IconClose, IconRefresh, IconSend, IconInfo, IconChevron } from './icons'
import './Namespaces.css'
import './Playground.css'
import PageTitle from './PageHead'

type Mode = 'standard' | 'deep'
type Msg = { id: number; role: 'user' | 'assistant'; text: string; steps?: string[]; mode?: Mode; state?: 'done' | 'error' | 'stopped' }

const KEY = 'keos-playground'
const EDGES: [string, string, string][] = [
  ['Module', 'Tool', 'uses'], ['Module', 'Exception', 'integrates with'], ['Tool', 'Process', 'part of'], ['Tool', 'Agent', 'invoked by'],
  ['Exception', 'Agent', 'forwards to'], ['Agent', 'Process', 'evaluates'], ['Agent', 'Organization', 'part of'], ['Process', 'Organization', 'analyzed by'], ['Module', 'Agent', 'required by'],
]
const STARTERS = ['How many classes are in the ontology?', 'What is Agent connected to?', 'Which metrics are defined?']

/* A small stand-in for the governed surface: it answers from the ontology the Induction and Explorer pages show. */
function answer(q: string, mode: Mode): { text: string; steps: string[] } {
  const text = q.toLowerCase()
  const cls = SEED_CLASSES.find((c) => text.includes(c.name.toLowerCase()))
  const deep = mode === 'deep'
  if (cls) {
    const links = EDGES.filter(([a, b]) => a === cls.key || b === cls.key)
    const list = links.map(([a, b, l]) => `${a === cls.key ? b : a} (${l})`).join(', ')
    return {
      text: `${cls.name} has ${cls.rel} relationships and ${cls.attrs} attributes.${links.length ? ` It is linked to ${list}.` : ' It is not linked to another class yet.'}${deep ? ` Its attributes include ${['name', 'identifier', 'description'].join(', ')}, and none of them map to a reference ontology, so ${cls.name} is new to this namespace.` : ''}`,
      steps: ['Read the Unstructured Induction ontology', `Found the class ${cls.name}`, ...(deep ? ['Followed its relationships', 'Checked the reference ontologies for matches'] : [])],
    }
  }
  if (/metric/.test(text)) {
    return { text: 'No metrics are defined in this namespace yet. Import an OSI file on the Metrics page, and I can answer questions about them.', steps: ['Checked the governed metrics', ...(deep ? ['Looked for imported OSI files'] : [])] }
  }
  if (/relationship|connect|link|related/.test(text)) {
    return { text: `The ontology has ${EDGES.length} links between classes, such as ${EDGES.slice(0, 3).map(([a, b, l]) => `${a} ${l} ${b}`).join(', ')}.`, steps: ['Read the class relationships', ...(deep ? ['Counted links per class'] : [])] }
  }
  if (/class|ontolog|how many/.test(text)) {
    return { text: `The ontology has ${SEED_CLASSES.length} classes: ${SEED_CLASSES.map((c) => c.name).join(', ')}. All of them are new, with no matches in a reference ontology.`, steps: ['Read the Unstructured Induction ontology', 'Counted the classes'] }
  }
  return { text: 'I can answer from the ontology and metrics in the AWS namespace. Try asking about a class such as Agent, or how the classes connect.', steps: ['Searched the ontology', 'Found nothing that matches the question'] }
}

function loadHistory(): { msgs: Msg[]; failed: boolean } {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { msgs: [], failed: false }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('bad shape')
    return { msgs: parsed as Msg[], failed: false }
  } catch {
    return { msgs: [], failed: true }
  }
}

export default function Playground() {
  const first = useRef(loadHistory())
  const [msgs, setMsgs] = useState<Msg[]>(first.current.msgs)
  const [warn, setWarn] = useState(first.current.failed)
  const [mode, setMode] = useState<Mode>('standard')
  const [input, setInput] = useState('')
  const [running, setRunning] = useState<null | { step: number; steps: string[]; q: string; mode: Mode }>(null)
  const [stream, setStream] = useState('')
  const [copied, setCopied] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const timers = useRef<number[]>([])
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))) } catch { /* storage blocked */ } }, [msgs])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [msgs, running, stream])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }

  const ask = useCallback((q: string, m: Mode) => {
    const text = q.trim()
    if (!text || running) return
    setMsgs((cur) => [...cur, { id: Date.now(), role: 'user', text }])
    setInput('')
    setNote('')
    if (!navigator.onLine) {
      setMsgs((cur) => [...cur, { id: Date.now() + 1, role: 'assistant', text: '', state: 'error' }])
      return
    }
    const a = answer(text, m)
    setRunning({ step: 0, steps: a.steps, q: text, mode: m })
    const stepMs = m === 'deep' ? 900 : 450
    a.steps.forEach((_, i) => { if (i > 0) timers.current.push(window.setTimeout(() => setRunning((r) => (r ? { ...r, step: i } : r)), i * stepMs)) })
    timers.current.push(window.setTimeout(() => {
      const words = a.text.split(' ')
      let n = 0
      const tick = () => {
        n += 2
        setStream(words.slice(0, n).join(' '))
        if (n < words.length) timers.current.push(window.setTimeout(tick, 32))
        else {
          setMsgs((cur) => [...cur, { id: Date.now() + 2, role: 'assistant', text: a.text, steps: a.steps, mode: m, state: 'done' }])
          setRunning(null)
          setStream('')
          setNote('Answer ready.')
        }
      }
      tick()
    }, a.steps.length * stepMs))
  }, [running])

  const stop = () => {
    clear()
    const partial = stream
    setMsgs((cur) => [...cur, { id: Date.now(), role: 'assistant', text: partial, state: 'stopped' }])
    setRunning(null)
    setStream('')
    setNote('Stopped.')
  }

  const newChat = () => {
    clear()
    setMsgs([])
    setRunning(null)
    setStream('')
    setInput('')
    setNote('Started a new chat.')
  }

  const copy = (m: Msg) => {
    navigator.clipboard?.writeText(m.text).catch(() => {})
    setCopied(m.id)
    window.setTimeout(() => setCopied(null), 1500)
  }

  const retry = () => {
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user')
    if (!lastUser) return
    setMsgs((cur) => cur.slice(0, -2))
    ask(lastUser.text, mode)
  }

  const empty = msgs.length === 0 && !running

  return (
    <section className="ns pg" aria-labelledby="pg-title">
      <header className="ns__head">
        <PageTitle id="pg-title" title="Playground" help="playground" />
        <div className="ns__toolbar">
          <SegmentedControl label="Reasoning mode" value={mode} onValueChange={(v) => setMode(v as Mode)} options={[{ value: 'standard', label: 'Standard' }, { value: 'deep', label: 'Deep reasoning' }]} />
          <Button variant="ghost" className="h-auto ns__btn" disabled={msgs.length === 0 && !running} onClick={newChat}>New chat</Button>
        </div>
      </header>

      {warn && (
        <div className="pg__warn" role="status">
          <IconInfo />
          <span>Previous session history may not have loaded. Your new questions still work.</span>
          <Button variant="ghost" className="h-auto met__banner-x" aria-label="Dismiss" onClick={() => setWarn(false)}><IconClose /></Button>
        </div>
      )}

      <div className="pg__chat">
        <div className="pg__thread" aria-live="polite" aria-busy={!!running}>
          <div className="thread__inner pg__inner">
            {empty && (
              <EmptyState art="bubble" title="Ask a question against the governed surface" action={
                <div className="pg__starters" role="group" aria-label="Try one of these">
                  {STARTERS.map((s) => <button key={s} type="button" className="starter" onClick={() => ask(s, mode)}>{s}</button>)}
                </div>
              }>
                Your questions run on the ontology and metrics in the AWS namespace.
              </EmptyState>
            )}
            {msgs.map((m) => (
              m.role === 'user' ? (
                <div key={m.id} className="msg msg--user"><div className="bubble">{m.text}</div></div>
              ) : (
                <div key={m.id} className="msg msg--assistant">
                  <img className="reply__avatar" src="/assets/keos-build-mark.svg" alt="" aria-hidden="true" />
                  <div className="reply__body">
                    {m.state === 'error' ? (
                      <div className="reply__error" role="alert">
                        <p><b>This question didn’t run.</b> KEOS can’t reach the governed surface. Check your connection, then try again.</p>
                        <Button variant="ghost" className="h-auto reply__retry" onClick={retry}><IconRefresh /> Try again</Button>
                      </div>
                    ) : (
                      <>
                        {m.steps && (
                          <details className="pg__steps">
                            <summary>{m.mode === 'deep' ? 'Reasoned in ' + m.steps.length + ' steps' : 'Checked ' + m.steps.length + ' things'}<IconChevron className="pg__chev" /></summary>
                            <ul className="think__steps">{m.steps.map((st) => <li key={st}><IconCheck /> {st}</li>)}</ul>
                          </details>
                        )}
                        {m.state === 'stopped' && !m.text ? <p className="reply__stopped-note">Stopped before the answer started.</p> : <p className="reply__p">{m.text}</p>}
                        {m.state === 'stopped' && m.text && <p className="reply__stopped-note">Stopped. This is what was written so far.</p>}
                        {m.state === 'done' && (
                          <div className="reply__actions" role="group" aria-label="Answer actions">
                            <Tip label={copied === m.id ? 'Copied' : 'Copy'} side="top"><Button variant="ghost" className="h-auto reply__act" aria-label="Copy answer" onClick={() => copy(m)}>{copied === m.id ? <IconCheck /> : <IconCopy />}</Button></Tip>
                            <span className="reply__model">{m.mode === 'deep' ? 'Deep reasoning' : 'Standard'}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            ))}
            {running && (
              <div className="msg msg--assistant" role="status">
                <span className="reply__avatar reply__avatar--loading reply__avatar--orb" aria-hidden="true"><ThinkingOrb state={running.mode === 'deep' ? 'solving' : 'searching'} size={20} /></span>
                <div className="reply__body">
                  {!stream && (
                    <div className="think">
                      <span className="think__head"><span className="reply__shimmer">Thinking</span></span>
                      <p className="pg__step">{running.steps[running.step]}</p>
                    </div>
                  )}
                  {stream && <p className="reply__p">{stream}</p>}
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
        </div>

        <form className="pg__dock" onSubmit={(e) => { e.preventDefault(); ask(input, mode) }}>
          <div className="composer">
            <div className="composer__field">
              <Textarea
                className="min-h-0 [field-sizing:fixed] composer__input"
                rows={2}
                aria-label="Ask a question"
                placeholder={running ? 'Wait for the answer, or stop it' : 'Ask a question against the governed surface'}
                value={input}
                disabled={!!running}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input, mode) } if (e.key === 'Escape' && running) stop() }}
              />
            </div>
            <div className="composer__actions">
              <span className="pg__hint">{mode === 'deep' ? 'Deep reasoning checks more before it answers.' : 'Standard answers quickly from the ontology.'}</span>
              {running ? (
                <Tip label="Stop" shortcut="Esc" side="top"><Button type="button" variant="ghost" className="h-auto composer__send is-stop" aria-label="Stop" onClick={stop}><span className="composer__stop" aria-hidden="true" /></Button></Tip>
              ) : (
                <Tip label={input.trim() ? 'Send' : 'Type a question to send'} shortcut={input.trim() ? 'Enter' : undefined} side="top"><Button type="submit" variant="ghost" className="h-auto composer__send" aria-label="Send" disabled={!input.trim()}><IconSend /></Button></Tip>
              )}
            </div>
          </div>
        </form>
        <p className="sr-only" role="status" aria-live="polite">{note}</p>
      </div>
    </section>
  )
}
