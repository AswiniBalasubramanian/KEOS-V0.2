import { useState } from 'react'
import './App.css'

const A = '/assets'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  return (
    <div className="page">
      {/* ===================== LEFT — Brand panel ===================== */}
      <section className="brand">
        <div className="brand__frame" aria-hidden />

        <div className="brand__card">
          <img className="brand__bg" src={`${A}/bg-image.png`} alt="" aria-hidden />

          <img className="diamond diamond--a" src={`${A}/union2.svg`} alt="" aria-hidden />
          <img className="diamond diamond--b" src={`${A}/union2.svg`} alt="" aria-hidden />
          <img className="diamond diamond--c" src={`${A}/union1.svg`} alt="" aria-hidden />
          <img className="diamond diamond--d" src={`${A}/union3.svg`} alt="" aria-hidden />

          <img className="brand__buildings" src={`${A}/buildings.svg`} alt="" aria-hidden />

          <div className="brand__content">
            <div className="brand__head">
              <h1 className="brand__title">Your enterprise AI workspace</h1>
              <p className="brand__desc">
                Everything you need to search, collaborate, automate, and make
                better decisions, securely connected in one place.
              </p>
            </div>

            <ul className="brand__list">
              <li>
                <img src={`${A}/check-filled.svg`} alt="" />
                <span>Agentic chat, projects, research, and apps in one platform</span>
              </li>
              <li>
                <img src={`${A}/check-outline.svg`} alt="" />
                <span>Governed connectors into SAP, historians, and document stores</span>
              </li>
              <li>
                <img src={`${A}/check-outline.svg`} alt="" />
                <span>Responsible AI assurance on every response</span>
              </li>
            </ul>
          </div>

          <p className="brand__footer">Designed for KaarTech people</p>
        </div>

        <div className="badge badge--tl">
          <img className="badge__corner" src={`${A}/corner.svg`} alt="" aria-hidden />
          <img className="badge__k" src={`${A}/keos-build-mark.svg`} alt="KEOS" />
        </div>
        <div className="badge badge--br">
          <img className="badge__corner" src={`${A}/corner.svg`} alt="" aria-hidden />
          <img className="badge__drop" src={`${A}/droplet.png`} alt="Kaar" />
        </div>
      </section>

      {/* ===================== RIGHT — Login form ===================== */}
      <section className="auth">
        <img className="auth__watermark" src={`${A}/union.svg`} alt="" aria-hidden />

        <div className="auth__inner">
          <div className="auth__head">
            <div className="auth__intro">
              <h2 className="auth__title">Welcome to KEOS</h2>
              <p className="auth__subtitle">
                Sign in with your enterprise account to begin your personalized
                onboarding.
              </p>
            </div>
            <div className="steps" aria-hidden>
              <span className="steps__dot steps__dot--active" />
              <span className="steps__dot" />
              <span className="steps__dot" />
              <span className="steps__dot" />
              <span className="steps__dot" />
            </div>
          </div>

          <form className="auth__form" onSubmit={(e) => e.preventDefault()}>
            <button type="button" className="btn-sso">
              <img src={`${A}/corporate.svg`} alt="" />
              <span>Continue with Enterprise SSO</span>
            </button>

            <div className="divider">
              <span className="divider__line" />
              <span className="divider__text">Or sign in with</span>
              <span className="divider__line" />
            </div>

            <label className="field">
              <span className="field__label">E-mail Id</span>
              <div className="field__box">
                <input
                  type="email"
                  placeholder="workid@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <div className="field__box">
                <input
                  type="password"
                  placeholder="***"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <img className="field__icon" src={`${A}/lock.svg`} alt="" />
              </div>
            </label>

            <button
              type="button"
              className="remember"
              onClick={() => setRemember((v) => !v)}
            >
              <span className={`remember__box${remember ? ' is-checked' : ''}`}>
                {remember && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M5 8.4L6.71429 10L11 6"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="remember__label">Remember me</span>
            </button>

            <div className="auth__actions">
              <button type="button" className="btn-text">
                Forgot Password?
              </button>
              <button type="submit" className="btn-primary">
                Log In
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
