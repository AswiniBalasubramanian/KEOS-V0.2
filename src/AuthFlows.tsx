import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconAdmin, IconBack, IconCheck, IconEye, IconEyeOff, IconInfo, IconKey, IconMail, IconSpinner, IconWarning } from './icons'

/* The steps around sign-in: single sign-on, two-step verification and choosing a new password.
   They share the sign-in page's look, so each one is a small panel that replaces the form. */

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
export const DEMO_CODE = '123456'

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'error'; children: ReactNode }) {
  const Icon = kind === 'ok' ? IconCheck : kind === 'error' ? IconWarning : IconInfo
  return (
    <p className={`login__notice login__notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon /> <span>{children}</span>
    </p>
  )
}

const BackLink = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <p className="login__foot"><button type="button" className="login__link login__link--plain" onClick={onClick}><IconBack /> {children}</button></p>
)

const maskEmail = (v: string) => {
  const m = v.trim().match(/^([^\s@])[^\s@]*@(.+)$/)
  return m ? `${m[1]}•••@${m[2]}` : 'your registered email'
}

/* ---------------------------------------------------------------- one-time code boxes */

function Otp({ value, onChange, onComplete, disabled, invalid, label }: { value: string; onChange: (v: string) => void; onComplete: (v: string) => void; disabled?: boolean; invalid?: boolean; label: string }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const LEN = 6
  const set = (next: string) => {
    onChange(next)
    if (next.length === LEN) onComplete(next)
  }
  const onInput = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, '')
    if (!d) return
    const chars = value.split('')
    chars[i] = d[d.length - 1]
    const next = chars.join('').slice(0, LEN)
    set(next)
    if (i < LEN - 1) refs.current[i + 1]?.focus()
  }
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[i]) set(value.slice(0, i) + value.slice(i + 1))
      else if (i > 0) { set(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus() }
    } else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus() }
    else if (e.key === 'ArrowRight' && i < LEN - 1) { e.preventDefault(); refs.current[i + 1]?.focus() }
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN)
    if (!d) return
    e.preventDefault()
    set(d)
    refs.current[Math.min(d.length, LEN - 1)]?.focus()
  }
  return (
    <div className="otp" role="group" aria-label={label}>
      {Array.from({ length: LEN }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className="otp__box"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={2}
          aria-label={`Digit ${i + 1} of ${LEN}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- two-step verification */

export type MfaMethod = 'app' | 'email' | 'recovery'
const LOCK_SECONDS = 30
const MAX_TRIES = 3

export function MfaStep({ who, onVerified, onBack, initialMethod = 'app', initialLocked = false }: {
  who: string
  onVerified: (remember: boolean) => void
  onBack: () => void
  initialMethod?: MfaMethod
  initialLocked?: boolean
}) {
  const [method, setMethod] = useState<MfaMethod>(initialMethod)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fails, setFails] = useState(initialLocked ? MAX_TRIES : 0)
  const [lock, setLock] = useState(initialLocked ? LOCK_SECONDS : 0)
  const [remember, setRemember] = useState(true)
  const [resend, setResend] = useState(initialMethod === 'email' ? 30 : 0)
  const [sentAgain, setSentAgain] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)

  // one clock for both countdowns
  useEffect(() => {
    if (lock <= 0 && resend <= 0) return
    const t = setInterval(() => {
      setLock((s) => Math.max(0, s - 1))
      setResend((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [lock > 0, resend > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lock === 0 && fails >= MAX_TRIES) { setFails(0); setError('') }
  }, [lock, fails])

  useEffect(() => {
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('input')?.focus())
  }, [method])

  const locked = lock > 0
  const pick = (m: MfaMethod) => {
    setMethod(m); setCode(''); setRecovery(''); setError('')
    if (m === 'email') { setResend(30); setSentAgain(false) }
  }

  const check = async (value: string) => {
    if (busy || locked) return
    setError('')
    setBusy(true)
    await wait(800)
    if (!navigator.onLine) { setBusy(false); setError('You are offline. Check your connection and try again.'); return }
    const ok = method === 'recovery' ? /^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(value.trim()) : value === DEMO_CODE
    if (ok) { onVerified(remember); return }
    setBusy(false)
    const n = fails + 1
    setFails(n)
    setCode('')
    if (n >= MAX_TRIES) { setLock(LOCK_SECONDS); setError('') }
    else setError(method === 'recovery'
      ? 'That recovery code is not valid. Recovery codes look like AB12-CD34.'
      : `That code did not work. Check your ${method === 'email' ? 'email' : 'authenticator app'} and try again. ${MAX_TRIES - n} ${MAX_TRIES - n === 1 ? 'try' : 'tries'} left.`)
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('input')?.focus())
  }

  const submitRecovery = (e: FormEvent) => { e.preventDefault(); if (recovery.trim()) check(recovery) }

  const title = method === 'recovery' ? 'Use a recovery code' : method === 'email' ? 'Check your email' : 'Two-step verification'
  const sub =
    method === 'recovery' ? 'Enter one of the recovery codes you saved when you set up two-step verification. Each code works once.'
    : method === 'email' ? <>We sent a 6-digit code to <b>{maskEmail(who)}</b>. It is valid for 10 minutes.</>
    : 'Open your authenticator app and enter the 6-digit code for KEOS.'

  return (
    <div ref={root}>
      <span className="login__badge" aria-hidden="true">{method === 'email' ? <IconMail /> : method === 'recovery' ? <IconKey /> : <IconAdmin />}</span>
      <h1 className="login__title login__title--left">{title}</h1>
      <p className="login__sub login__sub--left">{sub}</p>

      <div className="login__form login__form--tight">
        {locked && (
          <Notice kind="error">Too many attempts. For your security, try again in <b>{lock}s</b>.</Notice>
        )}
        {error && !locked && <Notice kind="error">{error}</Notice>}

        {method === 'recovery' ? (
          <form onSubmit={submitRecovery} className="login__form login__form--tight" noValidate>
            <Input id={id + '-rec'} className="login__input login__input--mono" placeholder="AB12-CD34" autoComplete="off" spellCheck={false} aria-label="Recovery code" value={recovery} disabled={busy || locked} onChange={(e) => setRecovery(e.target.value)} />
            <Button type="submit" variant="ghost" className="h-auto login__primary" disabled={busy || locked || !recovery.trim()} aria-busy={busy}>
              {busy ? <><IconSpinner className="login__spin" /> Verifying</> : 'Verify'}
            </Button>
          </form>
        ) : (
          <>
            <Otp label="6-digit verification code" value={code} onChange={setCode} onComplete={check} disabled={busy || locked} invalid={!!error} />
            <p className="login__status" role="status" aria-live="polite">{busy ? <><IconSpinner className="login__spin" /> Verifying your code</> : ' '}</p>
          </>
        )}

        <button type="button" role="checkbox" aria-checked={remember} className="login__check" onClick={() => setRemember((v) => !v)}>
          <span className={`login__checkbox${remember ? ' is-on' : ''}`}>{remember && <IconCheck />}</span>
          <span>Remember this device for 30 days</span>
        </button>

        {method === 'email' && (
          <p className="login__resend">
            {resend > 0
              ? `Did not get it? You can ask for a new code in ${resend}s.`
              : <>Did not get it? <button type="button" className="login__link" onClick={() => { setResend(30); setSentAgain(true); setCode('') }}>Send a new code</button></>}
            {sentAgain && resend > 0 && <span className="login__sent"> A new code was sent.</span>}
          </p>
        )}
      </div>

      <div className="login__alt">
        <p>Try another way</p>
        {method !== 'app' && <button type="button" className="login__alt-btn" onClick={() => pick('app')}><IconAdmin /> Use my authenticator app</button>}
        {method !== 'email' && <button type="button" className="login__alt-btn" onClick={() => pick('email')}><IconMail /> Email me a code</button>}
        {method !== 'recovery' && <button type="button" className="login__alt-btn" onClick={() => pick('recovery')}><IconKey /> Use a recovery code</button>}
      </div>

      <p className="login__demo">Prototype: the code is {DEMO_CODE}. Any code like AB12-CD34 works as a recovery code.</p>
      <BackLink onClick={onBack}>Back to sign in</BackLink>
    </div>
  )
}

/* ---------------------------------------------------------------- single sign-on */

export type SsoStatus = 'redirect' | 'checking' | 'cancelled' | 'noaccess' | 'offline'

export function SsoStep({ onDone, onBack, onRequestAccess, initial = 'redirect' }: { onDone: () => void; onBack: () => void; onRequestAccess: () => void; initial?: SsoStatus }) {
  const [status, setStatus] = useState<SsoStatus>(initial)
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (status === 'redirect') {
      const t = setTimeout(() => setStatus(navigator.onLine ? 'checking' : 'offline'), 1600)
      return () => clearTimeout(t)
    }
    if (status === 'checking') {
      const t = setTimeout(onDone, 1000)
      return () => clearTimeout(t)
    }
  }, [status, round]) // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => { setStatus('redirect'); setRound((n) => n + 1) }

  if (status === 'redirect' || status === 'checking') {
    const step = status === 'redirect' ? 0 : 1
    const steps = ['Contacting KaarTech SSO', 'Checking your access', 'Opening KEOS']
    return (
      <div>
        <span className="login__badge login__badge--brand" aria-hidden="true"><span className="login__kt login__kt--lg" /></span>
        <h1 className="login__title login__title--left">Taking you to KaarTech SSO</h1>
        <p className="login__sub login__sub--left">Sign in with your KaarTech account. Your company sign-in handles your password and two-step verification, so you will not be asked again here.</p>
        <ol className="login__steps" aria-live="polite">
          {steps.map((s, i) => (
            <li key={s} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
              <span className="login__step-dot">{i < step ? <IconCheck /> : i === step ? <IconSpinner className="login__spin" /> : null}</span>
              {s}
            </li>
          ))}
        </ol>
        <Button type="button" variant="ghost" className="h-auto login__secondary login__block" onClick={onBack}>Cancel</Button>
      </div>
    )
  }

  const copy = {
    cancelled: { title: 'Sign-in was cancelled', text: 'You closed the KaarTech sign-in window before finishing. Nothing was changed.' },
    noaccess: { title: 'This account cannot use KEOS yet', text: 'You signed in with KaarTech SSO, but your account has not been given access to KEOS. Ask your workspace admin to add you.' },
    offline: { title: 'We could not reach KaarTech SSO', text: 'Check your connection and try again. If it keeps happening, sign in with your email and password.' },
  }[status]

  return (
    <div>
      <span className="login__badge login__badge--error" aria-hidden="true"><IconWarning /></span>
      <h1 className="login__title login__title--left">{copy.title}</h1>
      <p className="login__sub login__sub--left" role="alert">{copy.text}</p>
      <div className="login__form login__form--tight">
        {status === 'noaccess'
          ? <Button type="button" variant="ghost" className="h-auto login__primary" onClick={onRequestAccess}>Request access</Button>
          : <Button type="button" variant="ghost" className="h-auto login__primary" onClick={retry}>Try again</Button>}
        <Button type="button" variant="ghost" className="h-auto login__secondary" onClick={onBack}>Use email and password</Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- choosing a new password */

function rulesFor(pw: string, who: string) {
  const name = who.trim().split('@')[0].toLowerCase()
  return [
    { ok: pw.length >= 12, label: 'At least 12 characters' },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: 'Upper and lower case letters' },
    { ok: /\d/.test(pw), label: 'A number' },
    { ok: /[^A-Za-z0-9]/.test(pw), label: 'A symbol, such as ! or #' },
    { ok: pw.length > 0 && !(name.length >= 3 && pw.toLowerCase().includes(name)), label: 'Does not contain your name or email' },
  ]
}

const STRENGTH = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const

export function ResetStep({ who, onDone, onBack }: { who: string; onDone: () => void; onBack: () => void }) {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ pw?: string; again?: string }>({})
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState('')
  const id = useId()
  const rules = useMemo(() => rulesFor(pw, who), [pw, who])
  const passed = rules.filter((r) => r.ok).length
  const score = !pw ? 0 : passed >= 5 ? 4 : passed >= 4 ? 3 : passed >= 3 ? 2 : 1

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!pw) next.pw = 'Enter a new password.'
    else if (passed < rules.length) next.pw = 'Your password does not meet all the requirements yet.'
    if (!again) next.again = 'Enter the new password again.'
    else if (again !== pw) next.again = 'The two passwords do not match.'
    setErrors(next)
    setBanner('')
    if (next.pw || next.again) return
    setBusy(true)
    await wait(900)
    if (!navigator.onLine) { setBusy(false); setBanner('You are offline. Check your connection and try again.'); return }
    onDone()
  }

  return (
    <div>
      <span className="login__badge" aria-hidden="true"><IconKey /></span>
      <h1 className="login__title login__title--left">Set a new password</h1>
      <p className="login__sub login__sub--left">Choose a password you have not used before. You will be signed out of your other devices.</p>

      <form className="login__form login__form--tight" onSubmit={submit} noValidate>
        {banner && <Notice kind="error">{banner}</Notice>}

        <div className="login__field">
          <label htmlFor={id + '-new'} className="login__label">New password</label>
          <div className="login__pw">
            <Input id={id + '-new'} className="login__input" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter a new password" value={pw} disabled={busy} aria-invalid={!!errors.pw} aria-describedby={id + '-rules'} onChange={(e) => { setPw(e.target.value); if (errors.pw) setErrors((x) => ({ ...x, pw: undefined })) }} />
            <button type="button" className="login__eye" aria-label={show ? 'Hide passwords' : 'Show passwords'} aria-pressed={show} onClick={() => setShow((v) => !v)}>{show ? <IconEyeOff /> : <IconEye />}</button>
          </div>
          {errors.pw && <p className="login__error" role="alert"><IconWarning /> {errors.pw}</p>}

          <div className="meter" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => <i key={n} className={score >= n ? `is-on is-${score}` : ''} />)}
          </div>
          <p className="meter__label" role="status" aria-live="polite">{pw ? `Strength: ${STRENGTH[score]}` : 'Strength appears as you type'}</p>

          <ul id={id + '-rules'} className="rules" aria-label="Password requirements">
            {rules.map((r) => (
              <li key={r.label} className={r.ok ? 'is-ok' : ''}>
                <span className="rules__dot" aria-hidden="true">{r.ok && <IconCheck />}</span>
                {r.label}<span className="sr-only">{r.ok ? ', met' : ', not met yet'}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="login__field">
          <label htmlFor={id + '-again'} className="login__label">Confirm new password</label>
          <Input id={id + '-again'} className="login__input" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter it again" value={again} disabled={busy} aria-invalid={!!errors.again} onChange={(e) => { setAgain(e.target.value); if (errors.again) setErrors((x) => ({ ...x, again: undefined })) }} />
          {errors.again && <p className="login__error" role="alert"><IconWarning /> {errors.again}</p>}
          {!errors.again && again && again === pw && <p className="login__ok"><IconCheck /> Passwords match</p>}
        </div>

        <Button type="submit" variant="ghost" className="h-auto login__primary" disabled={busy} aria-busy={busy}>
          {busy ? <><IconSpinner className="login__spin" /> Updating</> : 'Update password'}
        </Button>
      </form>
      <BackLink onClick={onBack}>Back to sign in</BackLink>
    </div>
  )
}

export function ResetDone({ onContinue }: { onContinue: () => void }) {
  return (
    <div>
      <span className="login__badge login__badge--ok" aria-hidden="true"><IconCheck /></span>
      <h1 className="login__title login__title--left">Password updated</h1>
      <p className="login__sub login__sub--left" role="status">Your password was changed and your other devices were signed out. Sign in with your new password.</p>
      <Button type="button" variant="ghost" className="h-auto login__primary login__block" onClick={onContinue}>Continue to sign in</Button>
    </div>
  )
}

export function ResetExpired({ onResend, onBack }: { onResend: () => void; onBack: () => void }) {
  return (
    <div>
      <span className="login__badge login__badge--error" aria-hidden="true"><IconWarning /></span>
      <h1 className="login__title login__title--left">This reset link has expired</h1>
      <p className="login__sub login__sub--left" role="alert">Reset links work for 30 minutes and only once. Ask for a new one and we will email it right away.</p>
      <div className="login__form login__form--tight">
        <Button type="button" variant="ghost" className="h-auto login__primary" onClick={onResend}>Send a new link</Button>
      </div>
      <BackLink onClick={onBack}>Back to sign in</BackLink>
    </div>
  )
}
