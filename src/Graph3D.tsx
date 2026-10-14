import { useEffect, useMemo, useRef, useState } from 'react'

/* A spherical network: every class is a hub, and its relationships and attributes orbit it as small dots.
   Drag to rotate, scroll or use the buttons to zoom, and zoom in to read the smaller labels.
   It spins slowly when idle and nodes blink now and then. Reduced motion turns the spin and blinking off. */

export type Hub = { key: string; name: string; rel: number; attrs: number; rels: string[]; attributes: string[] }
export type Link = { a: string; b: string; label: string }

type N = {
  i: number
  id: string
  kind: 'hub' | 'rel' | 'attr'
  hub: string
  label: string
  x: number
  y: number
  z: number
  r: number
  phase: number
}

const GOLD = Math.PI * (3 - Math.sqrt(5))
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 1000) / 1000 }
const norm = (v: [number, number, number]): [number, number, number] => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l] }

function build(hubs: Hub[]) {
  const nodes: N[] = []
  const n = hubs.length
  const spread = Math.min(1, 2.6 / Math.sqrt(Math.max(n, 1)))
  hubs.forEach((h, i) => {
    const y = n === 1 ? 0 : 1 - ((i + 0.5) * 2) / n
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    const th = i * GOLD
    const p: [number, number, number] = [Math.cos(th) * rr, y, Math.sin(th) * rr]
    nodes.push({ i: 0, id: 'h:' + h.key, kind: 'hub', hub: h.key, label: h.name, x: p[0], y: p[1], z: p[2], r: 7.5 + Math.sqrt(h.rel + h.attrs) * 1.25, phase: hash(h.key) * 6.28 })
    // a local frame on the sphere around the hub
    const up: [number, number, number] = Math.abs(p[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
    const t1 = norm([up[1] * p[2] - up[2] * p[1], up[2] * p[0] - up[0] * p[2], up[0] * p[1] - up[1] * p[0]])
    const t2: [number, number, number] = [p[1] * t1[2] - p[2] * t1[1], p[2] * t1[0] - p[0] * t1[2], p[0] * t1[1] - p[1] * t1[0]]
    const sats = [
      ...h.rels.map((label) => ({ kind: 'rel' as const, label })),
      ...h.attributes.map((label) => ({ kind: 'attr' as const, label })),
    ]
    const m = Math.max(sats.length, 1)
    sats.forEach((s, j) => {
      const ang = j * GOLD + hash(h.key) * 6
      const rho = (0.1 + 0.2 * Math.sqrt((j + 1) / m)) * spread
      const q: [number, number, number] = [
        p[0] + (Math.cos(ang) * t1[0] + Math.sin(ang) * t2[0]) * rho,
        p[1] + (Math.cos(ang) * t1[1] + Math.sin(ang) * t2[1]) * rho,
        p[2] + (Math.cos(ang) * t1[2] + Math.sin(ang) * t2[2]) * rho,
      ]
      const u = norm(q)
      const depth = 0.9 + hash(h.key + j) * 0.18
      const id = 's:' + h.key + ':' + j
      nodes.push({ i: 0, id, kind: s.kind, hub: h.key, label: s.label, x: u[0] * depth, y: u[1] * depth, z: u[2] * depth, r: 3 + hash(id) * 1.1, phase: hash(id) * 6.28 })
    })
  })
  nodes.forEach((x, i) => { x.i = i })
  return nodes
}

type Props = {
  hubs: Hub[]
  links: Link[]
  selected: string | null
  onSelect: (key: string | null) => void
  big?: boolean
}

export default function Sphere3D({ hubs, links, selected, onSelect, big }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const sig = hubs.map((h) => h.key + h.name + h.rel + h.attrs).join('|')
  const nodes = useMemo(() => build(hubs), [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const total = nodes.length
  // many dots: smaller dots, a higher zoom limit, and less drawn until you zoom in
  const dense = Math.min(1, Math.max(0.3, Math.sqrt(160 / total)))
  const maxZ = total > 500 ? 8 : 3.4
  const [tip, setTip] = useState<N | null>(null)
  const [zoomUi, setZoomUi] = useState(1)

  const st = useRef({
    yaw: 0.5, pitch: -0.25, vyaw: 0, vpitch: 0,
    zoom: 1, zoomTarget: 1,
    dragging: false, moved: 0, lastX: 0, lastY: 0,
    hover: null as N | null,
    flash: new Map<string, number>(),
    toYaw: null as number | null, toPitch: null as number | null,
    px: -1, py: -1,
    w: 0, h: 0,
    sel: selected as string | null,
  })
  const calm = useRef(false)
  const propsRef = useRef({ links, onSelect, hubs })
  propsRef.current = { links, onSelect, hubs }

  // keep the selection in the draw loop, and turn the sphere to face a newly selected class
  useEffect(() => {
    st.current.sel = selected
    if (!selected) return
    const n = byId.get('h:' + selected)
    if (!n) return
    const yaw = Math.atan2(-n.x, n.z)
    const z1 = -n.x * Math.sin(yaw) + n.z * Math.cos(yaw)
    st.current.toYaw = yaw
    st.current.toPitch = Math.atan2(-n.y, z1) * -1
    st.current.zoomTarget = Math.max(st.current.zoomTarget, 1.5)
    setZoomUi(st.current.zoomTarget)
  }, [selected, byId])

  useEffect(() => {
    const cv = canvas.current!
    const box = wrap.current!
    const ctx = cv.getContext('2d')!
    calm.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let visible = true
    let last = performance.now()
    let nextFlash = 0

    const resize = () => {
      const r = box.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      st.current.w = r.width
      st.current.h = r.height
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box)

    const P = nodes.map(() => ({ sx: 0, sy: 0, z: 0, persp: 1 }))
    const hubOrder = nodes.filter((n) => n.kind === 'hub').sort((a, b) => b.r - a.r)
    let nbrFocus: string | null = null
    let nbr = new Set<string>()
    const project = (n: N) => {
      const s = st.current
      const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw)
      const cp = Math.cos(s.pitch), sp = Math.sin(s.pitch)
      const x1 = n.x * cy + n.z * sy
      const z1 = -n.x * sy + n.z * cy
      const y2 = n.y * cp - z1 * sp
      const z2 = n.y * sp + z1 * cp
      const scale = Math.min(s.w, s.h) * 0.43 * s.zoom
      const persp = 1 / (1 - z2 * 0.32)
      const o = P[n.i]
      o.sx = s.w / 2 + x1 * scale * persp; o.sy = s.h / 2 + y2 * scale * persp; o.z = z2; o.persp = persp
      return o
    }

    const hit = (px: number, py: number) => {
      let best: N | null = null
      let bd = 14
      for (const n of nodes) {
        const p = P[n.i]
        if (p.z < -0.35) continue
        const d = Math.hypot(p.sx - px, p.sy - py) - n.r * p.persp * 0.5 * dense
        if (d < bd) { bd = d; best = n }
      }
      return best
    }

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (!visible || document.hidden) { last = now; return }
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const s = st.current
      const dark = document.documentElement.dataset.theme === 'dark'
      const focus = s.sel ?? (total > 500 ? null : s.hover?.hub ?? null)

      // motion: inertia, idle spin, easing toward a selected class, zoom easing
      if (!calm.current) {
        if (!s.dragging) {
          s.yaw += s.vyaw * dt
          s.pitch += s.vpitch * dt
          s.vyaw *= Math.pow(0.04, dt)
          s.vpitch *= Math.pow(0.04, dt)
          if (s.toYaw !== null && s.toPitch !== null) {
            const dy = Math.atan2(Math.sin(s.toYaw - s.yaw), Math.cos(s.toYaw - s.yaw))
            s.yaw += dy * Math.min(1, dt * 4)
            s.pitch += (s.toPitch - s.pitch) * Math.min(1, dt * 4)
            if (Math.abs(dy) < 0.01 && Math.abs(s.toPitch - s.pitch) < 0.01) { s.toYaw = null; s.toPitch = null }
          } else if (!s.hover && !s.sel && Math.abs(s.vyaw) < 0.05) {
            s.yaw += 0.14 * dt
          }
        }
        s.zoom += (s.zoomTarget - s.zoom) * Math.min(1, dt * 8)
        if (now > nextFlash) {
          const burst = 1 + Math.floor(nodes.length / 250)
          for (let k = 0; k < burst; k++) s.flash.set(nodes[Math.floor(Math.random() * nodes.length)].id, 1)
          nextFlash = now + 260 + Math.random() * 520
        }
        for (const [k, v] of s.flash) { const nv = v - dt * 1.6; if (nv <= 0) s.flash.delete(k); else s.flash.set(k, nv) }
      } else {
        s.zoom = s.zoomTarget
        if (s.toYaw !== null && s.toPitch !== null) { s.yaw = s.toYaw; s.pitch = s.toPitch; s.toYaw = null; s.toPitch = null }
      }
      s.pitch = Math.max(-1.35, Math.min(1.35, s.pitch))

      // colours
      const bg = dark ? '#131318' : '#f6f6f7'
      const ink = dark ? '#e4e4e7' : '#18181a'
      const quiet = total > 500
      const COL = quiet
        ? { hub: dark ? '#5b94ec' : '#2b6fd4', rel: dark ? '#6fb3a3' : '#4f9a8a', attr: dark ? '#f08a5d' : '#e8803f' }
        : { hub: dark ? '#5b94ec' : '#2b6fd4', rel: dark ? '#f08a5d' : '#e0663a', attr: dark ? '#9d8cf2' : '#4b3aa6' }
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, s.w, s.h)

      for (const n of nodes) project(n)
      if (nbrFocus !== focus) {
        nbrFocus = focus
        nbr = new Set(focus ? propsRef.current.links.flatMap((l) => (l.a === focus ? [l.b] : l.b === focus ? [l.a] : [])) : [])
      }
      const dimmed = (n: N) => !!focus && (n.kind === 'hub' ? !(n.hub === focus || nbr.has(n.hub)) : n.hub !== focus)
      const depthA = (z: number) => 0.42 + 0.58 * ((z + 1) / 2)

      // links: the many small ones are drawn in three batches, the focused class's links one by one
      const many = total > 500
      const lineCol = (al: number) => (dark ? 'rgba(190,195,210,' + al + ')' : 'rgba(110,114,128,' + al + ')')
      const showSat = !many || !!focus || s.zoom >= 1.6
      const k = many ? 0.55 : 1
      const buckets: [number, number, number, number][][] = [[], [], []]
      if (showSat) {
        for (const n of nodes) {
          if (n.kind === 'hub') continue
          const a = P[byId.get('h:' + n.hub)!.i], b = P[n.i]
          const dim = !!focus && n.hub !== focus
          buckets[dim ? 2 : (a.z + b.z) / 2 > 0 ? 0 : 1].push([a.sx, a.sy, b.sx, b.sy])
        }
        const style = [0.34 * k, 0.18 * k, 0.05]
        ctx.lineWidth = 0.7
        buckets.forEach((seg, bi) => {
          if (!seg.length) return
          ctx.strokeStyle = lineCol(style[bi])
          ctx.beginPath()
          for (const q of seg) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]) }
          ctx.stroke()
        })
      }
      ctx.lineWidth = 1
      for (const l of propsRef.current.links) {
        const a = byId.get('h:' + l.a), b = byId.get('h:' + l.b)
        if (!a || !b) continue
        const strong = !focus || l.a === focus || l.b === focus
        if (many && !strong) continue
        const hubA = many && !focus ? 0.1 : strong ? 0.7 : 0.14
        const pa = P[a.i], pb = P[b.i]
        ctx.strokeStyle = lineCol(depthA((pa.z + pb.z) / 2) * hubA)
        ctx.beginPath()
        ctx.moveTo(pa.sx, pa.sy)
        ctx.lineTo(pb.sx, pb.sy)
        ctx.stroke()
      }

      // nodes, far to near
      const order = [...nodes].sort((a, b) => P[a.i].z - P[b.i].z)
      const zoomBoost = Math.pow(s.zoom, 0.45) * dense
      for (const n of order) {
        const p = P[n.i]
        const f = s.flash.get(n.id) ?? 0
        const breathe = calm.current ? 0 : Math.sin(now / 1000 * 0.9 + n.phase) * 0.1
        let alpha = (depthA(p.z) + breathe) * (dimmed(n) ? 0.18 : 1)
        alpha = Math.max(0.05, Math.min(1, alpha + f * 0.5))
        const rad = n.r * p.persp * zoomBoost * (1 + f * 0.9) * (s.hover?.id === n.id ? 1.35 : 1)
        if (f > 0.02 || s.hover?.id === n.id || (n.kind === 'hub' && (s.sel === n.hub))) {
          ctx.fillStyle = COL[n.kind]
          ctx.globalAlpha = alpha * (0.14 + f * 0.2)
          ctx.beginPath()
          ctx.arc(p.sx, p.sy, rad * (2.1 + f), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = alpha
        ctx.fillStyle = COL[n.kind]
        ctx.beginPath()
        ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // labels: biggest classes first, never on top of each other, and only so many at a time
      ctx.font = '500 12px Inter, system-ui, sans-serif'
      ctx.textBaseline = 'middle'
      const taken = new Set<string>()
      let drawn = 0
      const cap = many ? Math.round(14 + s.zoom * 10) : 400
      const label = (n: N, p: (typeof P)[number], strong: boolean) => {
        if (drawn >= cap) return
        const a = Math.min(1, (p.z + 0.15) * 2) * (dimmed(n) ? 0.25 : 1)
        if (a <= 0.05) return
        const rad = n.r * p.persp * zoomBoost
        const w = ctx.measureText(n.label).width
        const x0 = p.sx + rad + 5
        const cy = Math.floor(p.sy / 16)
        const c0 = Math.floor(x0 / 60), c1 = Math.floor((x0 + w) / 60)
        for (let c = c0; c <= c1; c++) if (taken.has(c + ',' + cy)) return
        for (let c = c0; c <= c1; c++) taken.add(c + ',' + cy)
        drawn++
        ctx.globalAlpha = a
        ctx.lineWidth = 3.5
        ctx.strokeStyle = bg
        ctx.fillStyle = strong ? ink : (dark ? '#b4b4bd' : '#55555c')
        ctx.strokeText(n.label, x0, p.sy)
        ctx.fillText(n.label, x0, p.sy)
        ctx.globalAlpha = 1
      }
      if (s.hover) label(s.hover, P[s.hover.i], true)
      if (s.zoom >= 0.6) for (const n of hubOrder) { const p = P[n.i]; if (p.z > -0.25) label(n, p, true) }
      if (s.zoom >= 1.7) {
        const sats = order.filter((n) => n.kind !== 'hub' && P[n.i].z > -0.05 && (focus ? n.hub === focus : P[n.i].z > (s.zoom >= 2.4 ? 0 : 0.45)))
        for (let i = sats.length - 1; i >= 0; i--) label(sats[i], P[sats[i].i], false)
      }

      // names for the links around the focused class
      if (focus) {
        ctx.font = '500 12px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        for (const l of propsRef.current.links) {
          if (l.a !== focus && l.b !== focus) continue
          const ia = byId.get('h:' + l.a), ib = byId.get('h:' + l.b)
          if (!ia || !ib) continue
          const a = P[ia.i], b = P[ib.i]
          if ( (a.z + b.z) / 2 < -0.2) continue
          const x = (a.sx + b.sx) / 2, y = (a.sy + b.sy) / 2
          const w = ctx.measureText(l.label).width + 14
          ctx.fillStyle = dark ? '#1c1c20' : '#ffffff'
          ctx.strokeStyle = dark ? '#3b3b42' : '#d4d4d8'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.roundRect(x - w / 2, y - 10, w, 20, 5)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = ink
          ctx.fillText(l.label, x, y + 1)
        }
        ctx.textAlign = 'start'
      }
    }
    raf = requestAnimationFrame(draw)

    const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting })
    io.observe(box)

    const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const }
    const down = (e: PointerEvent) => {
      const [x, y] = pos(e)
      const s = st.current
      s.dragging = true; s.moved = 0; s.lastX = x; s.lastY = y; s.vyaw = 0; s.vpitch = 0; s.toYaw = null; s.toPitch = null
      cv.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      const [x, y] = pos(e)
      const s = st.current
      if (s.dragging) {
        const dx = x - s.lastX, dy = y - s.lastY
        s.moved += Math.abs(dx) + Math.abs(dy)
        s.yaw += dx * 0.006
        s.pitch += dy * 0.006
        s.vyaw = dx * 0.006 * 60
        s.vpitch = dy * 0.006 * 60
        s.lastX = x; s.lastY = y
        if (s.moved > 4) { s.hover = null; setTip(null) }
      } else {
        const h = hit(x, y)
        if (h?.id !== s.hover?.id) { s.hover = h; setTip(h) }
        cv.style.cursor = h ? (h.kind === 'hub' ? 'pointer' : 'default') : 'grab'
      }
      s.px = x; s.py = y
    }
    const up = (e: PointerEvent) => {
      const s = st.current
      const [x, y] = pos(e)
      if (s.dragging && s.moved <= 4) {
        const h = hit(x, y)
        if (h && h.kind === 'hub') propsRef.current.onSelect(s.sel === h.hub ? null : h.hub)
        else if (!h) propsRef.current.onSelect(null)
      }
      if (calm.current) { s.vyaw = 0; s.vpitch = 0 }
      s.dragging = false
      try { cv.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
    }
    const leave = () => { const s = st.current; if (!s.dragging) { s.hover = null; setTip(null) } }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = st.current
      s.zoomTarget = Math.max(0.6, Math.min(maxZ, s.zoomTarget * Math.exp(-e.deltaY * 0.0015)))
      setZoomUi(+s.zoomTarget.toFixed(2))
    }
    cv.addEventListener('pointerdown', down)
    cv.addEventListener('pointermove', move)
    cv.addEventListener('pointerup', up)
    cv.addEventListener('pointercancel', up)
    cv.addEventListener('pointerleave', leave)
    cv.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      cv.removeEventListener('pointerdown', down)
      cv.removeEventListener('pointermove', move)
      cv.removeEventListener('pointerup', up)
      cv.removeEventListener('pointercancel', up)
      cv.removeEventListener('pointerleave', leave)
      cv.removeEventListener('wheel', wheel)
    }
  }, [nodes, byId, dense, maxZ])

  const setZoom = (z: number) => { st.current.zoomTarget = Math.max(0.6, Math.min(maxZ, z)); setZoomUi(+st.current.zoomTarget.toFixed(2)) }
  const reset = () => { const s = st.current; s.zoomTarget = 1; s.toYaw = null; s.toPitch = null; s.vyaw = 0; setZoomUi(1); onSelect(null) }

  return (
    <div className={`ind__canvas${big ? ' is-big' : ''}`} ref={wrap}>
      <canvas ref={canvas} className="ind__sphere" role="img" aria-label={`Spherical network of ${hubs.length} classes and their relationships and attributes. Drag to rotate, scroll to zoom. Use the class list below the graph to select one with the keyboard.`} />
      <div className="ind__zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom in" disabled={zoomUi >= maxZ} onClick={() => setZoom(st.current.zoomTarget * 1.3)}>+</button>
        <button type="button" aria-label="Zoom out" disabled={zoomUi <= 0.6} onClick={() => setZoom(st.current.zoomTarget / 1.3)}>−</button>
        <button type="button" aria-label="Reset view" onClick={reset}>Reset</button>
      </div>
      {tip && (
        <div className="ind__tip" role="status">
          <b>{tip.label}</b>
          <span>
            {tip.kind === 'hub'
              ? `${hubs.find((h) => h.key === tip.hub)?.rel} relationships · ${hubs.find((h) => h.key === tip.hub)?.attrs} attributes`
              : `${tip.kind === 'rel' ? 'Relationship' : 'Attribute'} of ${hubs.find((h) => h.key === tip.hub)?.name}`}
          </span>
        </div>
      )}
      <p className="ind__hint">{hubs.length} classes · {total - hubs.length} dots · Drag to rotate · Scroll to zoom in for detail</p>
      <ul className="sr-only" aria-label="Classes in the graph">
        {hubs.map((h) => (
          <li key={h.key}><button type="button" aria-pressed={selected === h.key} onClick={() => onSelect(selected === h.key ? null : h.key)}>{h.name}, {h.rel} relationships, {h.attrs} attributes</button></li>
        ))}
      </ul>
    </div>
  )
}
