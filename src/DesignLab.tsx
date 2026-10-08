import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './DesignLab.css'
import {
  IconNewChat, IconAgent, IconChevron, IconScope, IconFolder, IconClose,
  IconSpark, IconMic, IconSend, IconFile, IconDownload, IconImage, IconRefresh,
  IconCopy, IconPalette,
} from './icons'

const A = '/assets'

/* ---------------------------------------------------------------
   Colour utilities — plain RGB mixing, good enough for a palette
   preview (no perceptual color space needed here).
--------------------------------------------------------------- */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(v, 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}
function mix(hex: string, target: [number, number, number], amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const t = amt / 100
  return rgbToHex(r + (target[0] - r) * t, g + (target[1] - g) * t, b + (target[2] - b) * t)
}
const tint = (hex: string, amt: number) => mix(hex, [255, 255, 255], amt)
const shade = (hex: string, amt: number) => mix(hex, [0, 0, 0], amt)
function readableOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  })
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0535 ? '#ffffff' : '#0b0b0c'
}
function saturationOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const l = (max + min) / 2
  const d = max - min
  return l > 0.5 ? d / (2 - max - min) : d / (max + min)
}
function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

/* ---------------------------------------------------------------
   Design-system presets
--------------------------------------------------------------- */
type DsColors = { primary: string; accent: string; neutral: string; secondary: string }
type DsPreset = {
  id: string
  name: string
  blurb: string
  font: string
  googleFont?: string
  colors: DsColors
}

const DS_PRESETS: DsPreset[] = [
  {
    id: 'keos',
    name: 'KEOS Default',
    blurb: "This app's own system: nothing overridden",
    font: "'Figtree Variable', ui-sans-serif, system-ui, -apple-system, sans-serif",
    colors: { primary: '#771e2c', accent: '#771e2c', neutral: '#85817a', secondary: '#d9304a' },
  },
  {
    id: 'material3',
    name: 'Material 3',
    blurb: 'Google Material You: tonal purple, Roboto',
    font: "'Roboto', system-ui, sans-serif",
    googleFont: 'Roboto:wght@400;500;600;700',
    colors: { primary: '#6750a4', accent: '#7d5260', neutral: '#79747e', secondary: '#625b71' },
  },
  {
    id: 'shadcn',
    name: 'shadcn / Radix',
    blurb: 'Zinc neutrals, near-black primary, Inter',
    font: "'Inter', system-ui, sans-serif",
    googleFont: 'Inter:wght@400;500;600;700',
    colors: { primary: '#18181b', accent: '#2563eb', neutral: '#71717a', secondary: '#a1a1aa' },
  },
  {
    id: 'ant',
    name: 'Ant Design',
    blurb: 'Enterprise blue, compact, system font',
    font: "'Segoe UI', Roboto, system-ui, sans-serif",
    colors: { primary: '#1677ff', accent: '#1677ff', neutral: '#8c8c8c', secondary: '#597ef7' },
  },
  {
    id: 'apple',
    name: 'Apple HIG',
    blurb: 'iOS system blue, SF Pro, soft grays',
    font: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    colors: { primary: '#0a84ff', accent: '#0a84ff', neutral: '#8e8e93', secondary: '#64d2ff' },
  },
]

function ensureGoogleFont(spec?: string) {
  if (!spec) return
  const id = 'dl-gf-' + spec.replace(/[^a-z0-9]/gi, '')
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  document.head.appendChild(link)
}

/** Derives full component tokens from the 4 chosen roles. */
function buildVars(c: DsColors): Record<string, string> {
  return {
    '--accent': c.accent,
    '--accent-solid': c.primary,
    '--accent-solid-hover': shade(c.primary, 14),
    '--accent-soft': tint(c.accent, 46),
    '--focus-ring': c.accent,
    '--text': shade(c.neutral, 58),
    '--text-2': shade(c.neutral, 24),
    '--text-3': c.neutral,
    '--text-4': tint(c.neutral, 26),
    '--border': tint(c.neutral, 42),
    '--border-strong': tint(c.neutral, 28),
    '--hover': tint(c.accent, 48),
    '--active': tint(c.accent, 38),
    '--bg-elevated': '#ffffff',
    '--bg': tint(c.neutral, 50),
    '--ds-secondary': c.secondary,
    '--ds-secondary-fg': readableOn(c.secondary),
  }
}

/** Downsamples an uploaded image to a small canvas and buckets pixels
 *  into a handful of representative swatches by frequency. */
function extractPalette(file: File): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const size = 64
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas unavailable'))
      ctx.drawImage(img, 0, 0, size, size)
      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, size, size).data
      } catch (e) {
        return reject(e)
      }
      const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 200) continue
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const key = [r, g, b].map((v) => Math.round(v / 24) * 24).join(',')
        const cur = buckets.get(key)
        if (cur) { cur.count++; cur.r += r; cur.g += g; cur.b += b }
        else buckets.set(key, { count: 1, r, g, b })
      }
      const sorted = [...buckets.values()].sort((a, b) => b.count - a.count)
      const swatches: string[] = []
      for (const bkt of sorted) {
        const hex = rgbToHex(bkt.r / bkt.count, bkt.g / bkt.count, bkt.b / bkt.count)
        if (!swatches.some((s) => colorDistance(s, hex) < 42)) swatches.push(hex)
        if (swatches.length >= 6) break
      }
      URL.revokeObjectURL(img.src)
      resolve(swatches)
    }
    img.onerror = () => reject(new Error('could not load image'))
    img.src = URL.createObjectURL(file)
  })
}

function autoAssign(swatches: string[]): DsColors {
  if (swatches.length === 0) return DS_PRESETS[0].colors
  const bySat = [...swatches].sort((a, b) => saturationOf(b) - saturationOf(a))
  const accent = bySat[0]
  const primary = bySat[1] || bySat[0]
  const neutral = bySat[bySat.length - 1]
  const secondary = bySat[2] || tint(primary, 24)
  return { primary, accent, neutral, secondary }
}

const ROLES: { key: keyof DsColors; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'accent', label: 'Accent' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'secondary', label: 'Secondary' },
]

export default function DesignLab() {
  const [presetId, setPresetId] = useState('keos')
  const [colors, setColors] = useState<DsColors>(DS_PRESETS[0].colors)
  const [font, setFont] = useState(DS_PRESETS[0].font)
  const [iconStroke, setIconStroke] = useState(1.7)
  const [iconCap, setIconCap] = useState<'round' | 'square'>('round')
  const [swatches, setSwatches] = useState<string[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const applyPreset = (p: DsPreset) => {
    setPresetId(p.id)
    setColors(p.colors)
    setFont(p.font)
    ensureGoogleFont(p.googleFont)
  }

  const setColor = (key: keyof DsColors, value: string) => {
    setColors((c) => ({ ...c, [key]: value }))
    setPresetId('custom')
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setExtractError('')
    setExtracting(true)
    try {
      const found = await extractPalette(file)
      if (found.length === 0) {
        setExtractError('No usable colors found in that image. Try another.')
      } else {
        setSwatches(found)
        setColors(autoAssign(found))
        setPresetId('custom')
      }
    } catch {
      setExtractError('Could not read that image.')
    } finally {
      setExtracting(false)
    }
  }

  const reset = () => {
    applyPreset(DS_PRESETS[0])
    setIconStroke(1.7)
    setIconCap('round')
    setSwatches([])
    setExtractError('')
  }

  // Icon tuning always applies (defaults are no-ops); palette/font only
  // apply once the user picks something other than the KEOS default —
  // that keeps "KEOS Default" a pixel-exact match to the live app rather
  // than an approximation re-derived through the tint/shade math below.
  const overrideVars: Record<string, string> = {
    '--icon-stroke': String(iconStroke),
    '--icon-cap': iconCap,
  }
  if (presetId !== 'keos') {
    Object.assign(overrideVars, buildVars(colors))
    overrideVars['--font-sans'] = font
  }
  const stageStyle = overrideVars as unknown as CSSProperties

  const activePreset = DS_PRESETS.find((p) => p.id === presetId)

  const copyTokens = () => {
    const body = Object.entries(overrideVars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')
    const text = `:root {\n${body}\n}`
    const flash = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
    navigator.clipboard?.writeText(text).then(flash, () => {
      // Clipboard API blocked (permissions, insecure context, unfocused
      // document) — fall back to the classic textarea+execCommand trick
      // so the action still succeeds instead of silently doing nothing.
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); flash() } catch { /* give up quietly */ }
      document.body.removeChild(ta)
    })
  }

  return (
    <div className="dl">
      <div className="dl__panel">
        <p className="dl__notice">
          <strong>Sandbox only.</strong> Everything you change here previews on
          the mock screen to the right. It never touches the live KEOS app.
          Semantic colors (success, warning, danger) also stay fixed.
        </p>

        <div className="dl__section">
          <span className="dl__section-title">Design system</span>
          <div className="dl__presets">
            {DS_PRESETS.map((p) => (
              <button
                key={p.id}
                className={`dl__preset${presetId === p.id ? ' is-active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                <span className="dl__preset-dot" style={{ background: p.colors.primary }} />
                <span className="dl__preset-text">
                  <b>{p.name}</b>
                  <small>{p.blurb}</small>
                </span>
              </button>
            ))}
            <button
              className={`dl__preset${presetId === 'custom' ? ' is-active' : ''}`}
              onClick={() => setPresetId('custom')}
            >
              <span className="dl__preset-dot" style={{ background: colors.accent }} />
              <span className="dl__preset-text">
                <b>Custom</b>
                <small>Hand-picked or extracted colors</small>
              </span>
            </button>
          </div>
        </div>

        <div className="dl__section">
          <span className="dl__section-title">Colors</span>
          {ROLES.map(({ key, label }) => (
            <div className="dl__color-row" key={key}>
              <label htmlFor={`dl-${key}`}>{label}</label>
              <div className="dl__color-input">
                <input
                  id={`dl-${key}`}
                  type="color"
                  value={colors[key]}
                  onChange={(e) => setColor(key, e.target.value)}
                />
                <input
                  type="text"
                  value={colors[key]}
                  spellCheck={false}
                  onChange={(e) => setColor(key, e.target.value)}
                />
              </div>
              {swatches.length > 0 && (
                <div className="dl__swatches">
                  {swatches.map((s) => (
                    <button
                      key={s}
                      className="dl__swatch"
                      style={{ background: s }}
                      title={s}
                      aria-label={`Use ${s} for ${label}`}
                      onClick={() => setColor(key, s)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="dl__section">
          <span className="dl__section-title">Typography</span>
          <select
            className="dl__select"
            value={activePreset ? activePreset.font : font}
            onChange={(e) => {
              const p = DS_PRESETS.find((x) => x.font === e.target.value)
              setFont(e.target.value)
              setPresetId(p ? p.id : 'custom')
              ensureGoogleFont(p?.googleFont)
            }}
          >
            {DS_PRESETS.map((p) => (
              <option key={p.id} value={p.font}>{p.name}, {p.font.split(',')[0].replace(/['"]/g, '')}</option>
            ))}
          </select>
        </div>

        <div className="dl__section">
          <span className="dl__section-title">Icons</span>
          <div className="dl__slider-row">
            <input
              type="range"
              min={1.2}
              max={2.6}
              step={0.1}
              value={iconStroke}
              onChange={(e) => setIconStroke(Number(e.target.value))}
              aria-label="Icon stroke weight"
            />
            <span className="dl__slider-val">{iconStroke.toFixed(1)}</span>
          </div>
          <div className="dl__seg">
            <button
              className={iconCap === 'round' ? 'is-active' : ''}
              onClick={() => setIconCap('round')}
            >
              Round
            </button>
            <button
              className={iconCap === 'square' ? 'is-active' : ''}
              onClick={() => setIconCap('square')}
            >
              Square
            </button>
          </div>
        </div>

        <div className="dl__section">
          <span className="dl__section-title">Extract from screen</span>
          <label className="dl__drop">
            <IconImage />
            <span>{extracting ? 'Reading image…' : 'Click to attach a screenshot'}</span>
            <small>Colors are pulled and auto-mapped to the 4 roles above</small>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
          {extractError && <small style={{ color: '#e0455a' }}>{extractError}</small>}
        </div>

        <div className="dl__footer">
          <button onClick={copyTokens} className={copied ? 'is-copied' : ''}>
            <IconCopy /> {copied ? 'Copied!' : 'Copy CSS Variables'}
          </button>
          <button onClick={reset}>
            <IconRefresh /> Reset To KEOS Default
          </button>
        </div>
      </div>

      <div className="dl__stage">
        <div className="dl__stage-inner">
          <div className="dl__stage-label">
            <b>Live preview</b>
            <span>{activePreset ? activePreset.name : 'Custom'}</span>
          </div>

          <div className="dl-sandbox" style={stageStyle}>
            <div className="dl-sandbox__row">
              <button className="nav__item nav__item--primary is-active">
                <IconNewChat className="nav__icon" />
                <span className="nav__label">New chat</span>
              </button>
              <button className="nav__item">
                <IconAgent className="nav__icon" />
                <span className="nav__label">Agent store</span>
              </button>
            </div>

            <div className="msg msg--user">
              <div className="bubble">Prepare the PRD document</div>
            </div>

            <div className="msg msg--assistant">
              <img className="reply__avatar" src={`${A}/keos-build-mark.svg`} alt="" aria-hidden />
              <div className="reply__body">
                <button className="reply__tools">
                  <span>Ran 3 commands, viewed a file</span>
                  <IconChevron className="reply__tools-chev" />
                </button>
                <p className="reply__p">
                  Done! Here&rsquo;s a preview of how body copy, links, and
                  borders read in this palette and type.
                </p>
              </div>
            </div>

            <div className="chips">
              <button className="chip">
                <IconScope className="chip__icon" />
                <span>Scope: Multi Project</span>
                <IconChevron className="chip__chev" />
              </button>
              <span className="chip chip--project">
                <IconFolder className="chip__icon" />
                <span>Sample Project…</span>
                <button className="chip__remove" aria-label="Remove">
                  <IconClose className="chip__chev" />
                </button>
              </span>
            </div>

            <div className="reply__doc">
              <span className="reply__doc-thumb"><IconFile /></span>
              <div className="reply__doc-info">
                <b>Sample doc</b>
                <small>Document · DOCX</small>
              </div>
              <button className="reply__doc-btn">
                <IconDownload /> Download &amp; Open
              </button>
            </div>

            <div className="composer">
              <div className="composer__input" style={{ color: 'var(--text-4)' }}>
                Message KEOS. Use @ to mention an agent…
              </div>
              <div className="composer__actions">
                <button className="composer__smart">
                  <IconSpark className="composer__smart-icon" />
                  <span>Smart</span>
                  <IconChevron className="chip__chev" />
                </button>
                <button className="composer__mic"><IconMic /></button>
                <button className="composer__send"><IconSend /></button>
              </div>
            </div>

            <span className="dl-secondary-badge">Secondary</span>

            <div className="dl-semantic">
              <span className="dl-semantic__label">Semantic: always fixed</span>
              <div className="dl-semantic__pills">
                <span className="pill pill--open">Open</span>
                <span className="pill pill--progress">In progress</span>
                <span className="pill pill--completed">Completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const DesignLabNavIcon = IconPalette
