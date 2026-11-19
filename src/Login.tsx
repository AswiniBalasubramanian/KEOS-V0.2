import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Tip from './Tip'
import { IconBack, IconCheck, IconEye, IconEyeOff, IconMoon, IconSpinner, IconSun, IconWarning } from './icons'
import { MfaStep, Notice as Banner, ResetDone, ResetExpired, ResetStep, SsoStep } from './AuthFlows'
import type { MfaMethod, SsoStatus } from './AuthFlows'
import { isTrusted, trustDevice } from './auth'
import type { Notice } from './auth'
import './Login.css'
import './LoginFlows.css'

type View = 'signin' | 'forgot' | 'access' | 'mfa' | 'sso' | 'reset' | 'resetdone' | 'resetexpired'
type Social = 'microsoft'
type Theme = 'light' | 'dark'

const A = '/assets'
const LOGO = A + '/keos-build-mark.svg'
const DEMO_DELAY = 900

const initialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('keos-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* storage blocked */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/* The KaarTech drop and ripple, cropped from the logo so it reads at icon size. */
const KaarTechMark = () => <span className="login__kt" aria-hidden="true" />

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/* Filled squares on the grid that fade in and out, each on its own rhythm. Fixed positions, so nothing shifts. */
type Square = { x: number; y: number; delay: number; dur: number }
const makeSquares = (seed: number, minX: number, spanX: number, count: number): Square[] => {
  let t = seed
  const rnd = () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296 }
  const seen = new Set<string>()
  const out: Square[] = []
  while (out.length < count) {
    const x = minX + Math.floor(rnd() * spanX)
    const y = Math.floor(rnd() * 18)
    if (seen.has(x + ',' + y)) continue
    seen.add(x + ',' + y)
    out.push({ x, y, delay: +(rnd() * 8).toFixed(1), dur: +(5 + rnd() * 6).toFixed(1) })
  }
  return out
}
const SQUARES = makeSquares(7, 9, 22, 26)
const SQUARES_PANEL = makeSquares(21, 0, 10, 14)

function Field({ label, error, hint, children, aside, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; aside?: ReactNode; htmlFor: string }) {
  return (
    <div className="login__field">
      <div className="login__label-row">
        <label htmlFor={htmlFor} className="login__label">{label}</label>
        {aside}
      </div>
      {children}
      {error ? <p id={htmlFor + '-err'} className="login__error" role="alert"><IconWarning /> {error}</p> : hint ? <p className="login__hint">{hint}</p> : null}
    </div>
  )
}

const NOTICE_TEXT: Record<Notice, string> = {
  expired: 'Your session expired after 15 minutes of inactivity. Sign in again to pick up where you left off.',
  signedout: 'You have been signed out.',
  reset: 'Password updated. Sign in with your new password.',
}

/* Sign-in details for trying the prototype. */
const TRIAL = { email: 'aswini@kaartech.com', password: 'Keos@2026' }

const STATES: { key: string; label: string }[] = [
  { key: 'portal', label: 'Product page' },
  { key: 'signin', label: 'Sign in' },
  { key: 'signin-error', label: 'Wrong password' },
  { key: 'expired', label: 'Session expired' },
  { key: 'sso-redirect', label: 'SSO redirecting' },
  { key: 'sso-noaccess', label: 'SSO no access' },
  { key: 'sso-cancelled', label: 'SSO cancelled' },
  { key: 'sso-offline', label: 'SSO offline' },
  { key: 'mfa-app', label: 'MFA app code' },
  { key: 'mfa-email', label: 'MFA email code' },
  { key: 'mfa-recovery', label: 'MFA recovery code' },
  { key: 'mfa-locked', label: 'MFA locked' },
  { key: 'forgot', label: 'Reset: ask' },
  { key: 'forgot-sent', label: 'Reset: link sent' },
  { key: 'reset', label: 'Reset: new password' },
  { key: 'resetexpired', label: 'Reset: link expired' },
  { key: 'resetdone', label: 'Reset: done' },
]

export default function Login({ onSignIn, notice, lastWho, onBack }: { onSignIn: (who: string) => void; notice?: Notice | null; lastWho?: string; onBack?: () => void }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [view, setView] = useState<View>('signin')
  const [who, setWho] = useState(lastWho ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ who?: string; password?: string }>({})
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState<'' | 'password' | Social | 'mail'>('')
  const [sent, setSent] = useState(false)
  const [localNotice, setLocalNotice] = useState<Notice | null>(null)
  const [flow, setFlow] = useState<{ method?: MfaMethod; locked?: boolean; sso?: SsoStatus }>({})
  const [flowKey, setFlowKey] = useState(0)
  const openStates = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('states')
  const id = useId()
  const card = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('keos-theme', theme) } catch { /* storage blocked */ }
  }, [theme])

  // move focus to the first field whenever the view changes
  useEffect(() => {
    requestAnimationFrame(() => card.current?.querySelector<HTMLElement>('input')?.focus())
  }, [view, sent])

  const go = (v: View) => { setView(v); setErrors({}); setBanner(''); setSent(false); setBusy(''); setLocalNotice(null); setFlow({}); setFlowKey((k) => k + 1) }

  // jump straight to a state, for design review (add ?states to the address)
  const preview = (name: string) => {
    if (name === 'portal') { onBack?.(); return }
    const demo = 'aswini@kaartech.com'
    go('signin')
    if (name !== 'signin' && name !== 'signin-error' && name !== 'expired') setWho((w) => w || demo)
    switch (name) {
      case 'signin-error': setBanner('That email or password did not match. Check them and try again.'); break
      case 'expired': setLocalNotice('expired'); break
      case 'sso-redirect': case 'sso-noaccess': case 'sso-cancelled': case 'sso-offline':
        setFlow({ sso: ({ 'sso-redirect': 'redirect', 'sso-noaccess': 'noaccess', 'sso-cancelled': 'cancelled', 'sso-offline': 'offline' } as const)[name] }); setView('sso'); break
      case 'mfa-app': setFlow({ method: 'app' }); setView('mfa'); break
      case 'mfa-email': setFlow({ method: 'email' }); setView('mfa'); break
      case 'mfa-recovery': setFlow({ method: 'recovery' }); setView('mfa'); break
      case 'mfa-locked': setFlow({ method: 'app', locked: true }); setView('mfa'); break
      case 'forgot': setView('forgot'); break
      case 'forgot-sent': setView('forgot'); setSent(true); break
      case 'reset': setView('reset'); break
      case 'resetexpired': setView('resetexpired'); break
      case 'resetdone': setView('resetdone'); break
    }
  }

  const signIn = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!who.trim()) next.who = 'Enter your email or username.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    setBanner('')
    if (next.who || next.password) {
      card.current?.querySelector<HTMLElement>(next.who ? `#${CSS.escape(id)}-who` : `#${CSS.escape(id)}-pw`)?.focus()
      return
    }
    setBusy('password')
    await wait(DEMO_DELAY)
    if (!navigator.onLine) { setBusy(''); setBanner('You are offline. Check your connection and try again.'); return }
    // Demo rule: a password of six or more characters signs in.
    if (password.length < 6) { setBusy(''); setBanner('That email or password did not match. Check them and try again.'); return }
    // a remembered device skips the second step
    if (isTrusted(who.trim())) { onSignIn(who.trim()); return }
    setBusy('')
    setFlow({ method: 'app' })
    setFlowKey((k) => k + 1)
    setView('mfa')
  }

  const social = (kind: Social) => {
    if (kind === 'microsoft') { go('sso'); setView('sso') }
  }

  const sendMail = async (e: FormEvent) => {
    e.preventDefault()
    if (!looksLikeEmail(who.trim())) { setErrors({ who: 'Enter a work email, such as name@company.com.' }); card.current?.querySelector<HTMLElement>('input')?.focus(); return }
    setErrors({})
    setBanner('')
    setBusy('mail')
    await wait(DEMO_DELAY)
    if (!navigator.onLine) { setBusy(''); setBanner('You are offline. Check your connection and try again.'); return }
    setBusy('')
    setSent(true)
  }

  const working = busy !== ''

  return (
    <div className="login">
      <div className="login__grid" aria-hidden="true">
        {SQUARES.map((q) => <i key={q.x + '-' + q.y} style={{ left: q.x * 50, top: q.y * 50, animationDelay: q.delay + 's', animationDuration: q.dur + 's' }} />)}
      </div>

      <div className="login__theme">
        <Tip label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} side="bottom">
          <Button variant="ghost" className="h-auto login__icon-btn" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-pressed={theme === 'dark'} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </Button>
        </Tip>
      </div>

      <aside className="login__panel" aria-label="About KEOS">
        <img className="login__panel-bg" src={A + '/login-cover.webp'} alt="" />
        <div className="login__grid login__grid--panel" aria-hidden="true">
          {SQUARES_PANEL.map((q) => <i key={q.x + '-' + q.y} style={{ left: q.x * 50, top: q.y * 50, animationDelay: q.delay + 's', animationDuration: q.dur + 's' }} />)}
        </div>
        <div className="login__panel-in">
          <div className="login__brand">
            <img className="login__brand-k" src={LOGO} alt="" />
            <div className="login__brand-text">
              <span>KEOS</span>
              <p>Kaar enterprise operating system</p>
            </div>
          </div>

          <div className="login__story">
            <p className="login__pill"><i /> Enterprise intelligence</p>
            <h2>The Intelligence Operating System for Enterprise.</h2>
            <p className="login__lead">Unify enterprise data, knowledge, AI models and intelligent agents in one governed ecosystem.</p>
          </div>

          <div className="login__meta">
            <div><span>Intelligence</span><b>Enterprise knowledge &amp; AI</b></div>
            <div><span>Orchestration</span><b>Agents &amp; workflows</b></div>
          </div>

          <p className="login__legal">© 2026 KaarTech</p>
        </div>
      </aside>

      <main className="login__main">
        {onBack && <button type="button" className="login__back" onClick={onBack}><IconBack /> All products</button>}
        <div className="login__card" ref={card}>

          {view === 'signin' && (
            <>
              <h1 className="login__title">Sign in to KEOS</h1>
              <p className="login__sub">Welcome back.</p>
              {(localNotice ?? notice) && <div className="login__top"><Banner kind={(localNotice ?? notice) === 'reset' ? 'ok' : 'info'}>{NOTICE_TEXT[(localNotice ?? notice) as Notice]}</Banner></div>}

              <form className="login__form" onSubmit={signIn} noValidate>
                {banner && <p className="login__banner" role="alert"><IconWarning /> {banner}</p>}

                <Field label="Email or username" htmlFor={id + '-who'} error={errors.who}>
                  <Input id={id + '-who'} className="login__input" type="text" autoComplete="username" placeholder="Enter your email or username" value={who} disabled={working} aria-invalid={!!errors.who} aria-describedby={errors.who ? id + '-who-err' : undefined} onChange={(e) => { setWho(e.target.value); if (errors.who) setErrors((x) => ({ ...x, who: undefined })) }} />
                </Field>

                <Field label="Password" htmlFor={id + '-pw'} error={errors.password} aside={<button type="button" className="login__link login__link--muted" onClick={() => go('forgot')}>Forgot password?</button>}>
                  <div className="login__pw">
                    <Input id={id + '-pw'} className="login__input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} disabled={working} aria-invalid={!!errors.password} aria-describedby={errors.password ? id + '-pw-err' : undefined} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((x) => ({ ...x, password: undefined })) }} />
                    <button type="button" className="login__eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((v) => !v)}>
                      {show ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </Field>

                <Button type="submit" variant="ghost" className="h-auto login__primary" disabled={working} aria-busy={busy === 'password'}>
                  {busy === 'password' ? <><IconSpinner className="login__spin" /> Signing in</> : 'Sign in'}
                </Button>
              </form>

              <div className="login__divider"><span>Or continue with</span></div>

              <Button type="button" variant="ghost" className="h-auto login__secondary login__sso" disabled={working} onClick={() => social('microsoft')}>
                {busy === 'microsoft' ? <IconSpinner className="login__spin" /> : <KaarTechMark />} Continue with KaarTech SSO
              </Button>

              <p className="login__foot">Need an account? <button type="button" className="login__link" onClick={() => go('access')}>Request access</button></p>

            </>
          )}

          {(view === 'forgot' || view === 'access') && !sent && (
            <>
              <h1 className="login__title">{view === 'forgot' ? 'Reset your password' : 'Request access'}</h1>
              <p className="login__sub">
                {view === 'forgot' ? 'Enter your work email and we will send you a link to reset your password.' : 'KEOS accounts are created by your workspace admin. Send your work email and we will pass your request on.'}
              </p>
              <form className="login__form" onSubmit={sendMail} noValidate>
                {banner && <p className="login__banner" role="alert"><IconWarning /> {banner}</p>}
                <Field label="Work email" htmlFor={id + '-mail'} error={errors.who}>
                  <Input id={id + '-mail'} className="login__input" type="email" autoComplete="email" placeholder="name@company.com" value={who} disabled={working} aria-invalid={!!errors.who} aria-describedby={errors.who ? id + '-mail-err' : undefined} onChange={(e) => { setWho(e.target.value); if (errors.who) setErrors({}) }} />
                </Field>
                <Button type="submit" variant="ghost" className="h-auto login__primary" disabled={working} aria-busy={busy === 'mail'}>
                  {busy === 'mail' ? <><IconSpinner className="login__spin" /> Sending</> : view === 'forgot' ? 'Send reset link' : 'Send request'}
                </Button>
              </form>
              <p className="login__foot"><button type="button" className="login__link" onClick={() => go('signin')}>Back to sign in</button></p>
            </>
          )}

          {(view === 'forgot' || view === 'access') && sent && (
            <>
              <span className="login__done" aria-hidden="true"><IconCheck /></span>
              <h1 className="login__title">{view === 'forgot' ? 'Check your email' : 'Request sent'}</h1>
              <p className="login__sub" role="status">
                {view === 'forgot'
                  ? <>If <b>{who.trim()}</b> has a KEOS account, a reset link is on its way. It can take a few minutes, and it works for 30 minutes.</>
                  : <>We sent your request for <b>{who.trim()}</b> to your workspace admin. You will get an email when your account is ready.</>}
              </p>
              <Button type="button" variant="ghost" className="h-auto login__secondary login__block" onClick={() => go('signin')}>Back to sign in</Button>
              {view === 'forgot' && <p className="login__demo"><button type="button" className="login__link login__link--plain" onClick={() => { setView('reset'); setSent(false) }}>Prototype: open the link from the email</button></p>}
            </>
          )}

          {view === 'sso' && <SsoStep key={flowKey} initial={flow.sso} onDone={() => onSignIn('KaarTech SSO')} onBack={() => go('signin')} onRequestAccess={() => go('access')} />}
          {view === 'mfa' && <MfaStep key={flowKey} who={who} initialMethod={flow.method} initialLocked={flow.locked} onBack={() => go('signin')} onVerified={(remember) => { if (remember) trustDevice(who.trim()); onSignIn(who.trim()) }} />}
          {view === 'reset' && <ResetStep key={flowKey} who={who} onBack={() => go('signin')} onDone={() => setView('resetdone')} />}
          {view === 'resetdone' && <ResetDone onContinue={() => { go('signin'); setLocalNotice('reset') }} />}
          {view === 'resetexpired' && <ResetExpired onBack={() => go('signin')} onResend={() => go('forgot')} />}
        </div>
      </main>

      <div className="login__dock">
        <details className="states trial">
          <summary>Trial credentials</summary>
          <dl className="trial__list">
            <div><dt>Email</dt><dd>{TRIAL.email}</dd></div>
            <div><dt>Password</dt><dd>{TRIAL.password}</dd></div>
            <div><dt>Verification code</dt><dd>123456</dd></div>
          </dl>
          <div className="trial__foot">
            <p>Prototype only. Any password of six or more characters also works.</p>
            <button type="button" onClick={() => { go('signin'); setWho(TRIAL.email); setPassword(TRIAL.password) }}>Fill in</button>
          </div>
        </details>
        {(
          <details className="states" open={openStates}>
            <summary>Prototype states</summary>
            <div className="states__grid">
              {STATES.map((st) => <button key={st.key} type="button" onClick={() => preview(st.key)}>{st.label}</button>)}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
