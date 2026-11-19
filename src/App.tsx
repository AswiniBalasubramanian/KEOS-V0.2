import { useCallback, useState } from 'react'
import Conversation from './Conversation'
import Login from './Login'
import Portal from './Portal'
import SessionGuard from './SessionGuard'
import { clearSignIn, lastWho, saveSignIn, signedInAs } from './auth'
import type { Notice } from './auth'

export default function App() {
  const [who, setWho] = useState<string | null>(signedInAs)
  const [chosen, setChosen] = useState<boolean>(() => { try { return sessionStorage.getItem('keos-product') === 'keos' } catch { return false } })
  const [notice, setNotice] = useState<Notice | null>(null)
  const [warn, setWarn] = useState(0)
  const openStates = new URLSearchParams(window.location.search).has('states')

  const leave = useCallback((why: Notice) => { clearSignIn(); setNotice(why); setWho(null) }, [])
  const expire = useCallback(() => leave('expired'), [leave])
  const signOut = useCallback(() => leave('signedout'), [leave])

  const pick = (on: boolean) => { setChosen(on); try { if (on) sessionStorage.setItem('keos-product', 'keos'); else sessionStorage.removeItem('keos-product') } catch { /* storage blocked */ } }

  if (!who && !chosen) return <Portal onOpenKeos={() => pick(true)} />
  if (!who) return <Login onBack={() => pick(false)} notice={notice} lastWho={lastWho()} onSignIn={(w) => { saveSignIn(w); setNotice(null); setWho(w) }} />
  return (
    <>
      <Conversation onSignOut={signOut} />
      <SessionGuard onExpire={expire} onSignOut={signOut} previewWarning={warn} />
      {(
        <details className="states" open={openStates}>
          <summary>Prototype states</summary>
          <div className="states__grid">
            <button type="button" onClick={() => setWarn((n) => n + 1)}>Session warning</button>
            <button type="button" onClick={expire}>Session expired</button>
          </div>
        </details>
      )}
    </>
  )
}
