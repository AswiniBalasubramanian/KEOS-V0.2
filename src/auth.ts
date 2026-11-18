/* A stand-in for real sign-in: the prototype remembers who signed in for this browser tab only. */
const KEY = 'keos-auth'
const LAST = 'keos-last-who'
const TRUST = 'keos-mfa-trusted'

/** Why the person is back on the sign-in page. */
export type Notice = 'expired' | 'signedout' | 'reset'

export function signedInAs(): string | null {
  try { return sessionStorage.getItem(KEY) } catch { return null }
}

export function saveSignIn(who: string) {
  try {
    sessionStorage.setItem(KEY, who)
    localStorage.setItem(LAST, who)
  } catch { /* storage blocked: the session lasts until reload */ }
}

export function clearSignIn() {
  try { sessionStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}

/** The last person to sign in on this device, so an expired session can pick up where it left off. */
export function lastWho(): string {
  try { return localStorage.getItem(LAST) ?? '' } catch { return '' }
}

/** A device the person chose to remember skips the second step for 30 days. */
export function isTrusted(who: string): boolean {
  try {
    const raw = localStorage.getItem(TRUST)
    if (!raw) return false
    const o = JSON.parse(raw) as { who: string; until: number }
    return o.who === who && o.until > Date.now()
  } catch { return false }
}

export function trustDevice(who: string) {
  try { localStorage.setItem(TRUST, JSON.stringify({ who, until: Date.now() + 30 * 24 * 60 * 60 * 1000 })) } catch { /* storage blocked */ }
}
