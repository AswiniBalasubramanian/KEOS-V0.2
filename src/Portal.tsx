import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import Tip from './Tip'
import { IconArrowRight, IconMoon, IconSun } from './icons'
import './Portal.css'

type Theme = 'light' | 'dark'

const A = '/assets'

const initialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('keos-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* storage blocked */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/* The page before sign-in: pick a Ktern product. KEOS is the one that is ready. */
export default function Portal({ onOpenKeos }: { onOpenKeos: () => void }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [note, setNote] = useState('')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('keos-theme', theme) } catch { /* storage blocked */ }
  }, [theme])

  return (
    <div className="portal">
      <header className="portal__bar">
        <span className="portal__brand" role="img" aria-label="KaarTech" />
        <Tip label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} side="bottom">
          <Button variant="ghost" className="h-auto portal__icon-btn" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={theme === 'dark'} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </Button>
        </Tip>
      </header>

      <main className="portal__main">
        <p className="portal__eyebrow">Welcome to KaarTech</p>
        <h1 className="portal__title">Choose a product</h1>
        <p className="portal__sub">Pick where you want to sign in.</p>

        <ul className="portal__grid">
          <li>
            <button type="button" className="pcard" onClick={onOpenKeos} aria-label="Open KEOS, the Kaar enterprise operating system">
              <span className="pcard__cover">
                <img src={A + '/login-cover.webp'} alt="" />
                <span className="pcard__pill"><i /> Enterprise intelligence</span>
                <img className="pcard__mark" src={A + '/keos-build-mark.svg'} alt="" />
              </span>
              <span className="pcard__body">
                <span className="pcard__name">KEOS</span>
                <span className="pcard__tag">Kaar enterprise operating system</span>
                <span className="pcard__text">Pods, agents, connectors and governed knowledge in one workspace.</span>
                <span className="pcard__go">Open KEOS <IconArrowRight /></span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" className="pcard" onClick={() => setNote('Ktern opens in its own app. Its sign-in is not connected in this prototype.')} aria-label="Open Ktern, the SAP digital transformation platform">
              <span className="pcard__cover pcard__cover--ktern">
                <span className="pcard__pill"><i /> Digital transformation</span>
                <span className="pcard__ktern">KTERN.AI</span>
              </span>
              <span className="pcard__body">
                <span className="pcard__name">Ktern</span>
                <span className="pcard__tag">SAP digital transformation platform</span>
                <span className="pcard__text">The intelligent platform for SAP digital transformation programs.</span>
                <span className="pcard__go">Open Ktern <IconArrowRight /></span>
              </span>
            </button>
          </li>
        </ul>
        <p className="portal__note" role="status" aria-live="polite">{note}</p>
      </main>

      <footer className="portal__foot">© 2026 KaarTech</footer>
    </div>
  )
}
