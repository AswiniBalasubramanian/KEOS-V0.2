/* Builds the isometric empty-state illustrations with the anatomy kit.
   Run: node scripts/build-empty-art.mjs   (writes src/emptyArt.ts and src/EmptyArt.css) */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const KIT = 'C:/Users/baswini/.claude/skills/anatomy/kit/'
const k = await import(pathToFileURL(KIT + 'iso-kit.mjs').href)
const G = await import(pathToFileURL(KIT + 'lathe.mjs').href)

const W = 360
const H = 250
const AZ = 40

/* A group that can move: its world axis becomes a screen vector (--vx, --vy per unit) the page animates along. */
const part = (name, P, axis, children, extra = '') => {
  const [vx, vy] = k.axisVector(P, axis)
  return `<g data-part="${name}" style="--vx:${vx.toFixed(3)};--vy:${vy.toFixed(3)};${extra}">${children}</g>`
}

const S = (paths, style) => k.solidSvg(paths, style)
const L = (d, style) => k.lineSvg(d, style)
const D = (points, style) => k.dotsSvg(points, style)

/* ---------- shared parts ---------- */

function plate(P, PLATE, z0, withRuler) {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, z0, 6, P)}"/>`]
  const feet = [...k.corners(PLATE, 14)].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P))
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 5, z0 - 4, 1.2, P, 20), { tone: 'lo' }))
    out.push(S(k.cylinder(x, y, 3.8, z0 - 2.8, 2.8, P, 20), { tone: 'mid' }))
  }
  out.push(S(k.slabOf(PLATE, z0, 6, P, 8, 1.2), { tone: 'mid' }))
  const top = z0 + 6
  out.push(L(k.planOutline(k.insetPlan(PLATE, 4), top, P), { tone: 'lo' }))
  const screws = k.corners(PLATE, 8)
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.8, top, P, 14)).join(''), { tone: 'lo' }))
  out.push(D(screws.map(([x, y]) => k.iso([x, y, top], P)), { size: 0.45 }))
  if (withRuler) {
    const strip = { x: PLATE.x + 20, y: PLATE.y + PLATE.d - 13, w: PLATE.w - 40, d: 6, r: 1 }
    out.push(S(k.slabOf(strip, top, 0.6, P, 3), { tone: 'lo', crease: 'none' }))
    const t = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.8, top + 0.6, [1.8, 3.2], P)
    out.push(L(t.minor, { tone: 'lo' }), L(t.major, { tone: 'mid' }))
  }
  return { svg: out.join(''), top }
}

/* ---------- A: a small knowledge graph with one concept missing (no ontologies yet) ---------- */

function graph() {
  const PLATE = { x: -104, y: -64, w: 208, d: 128, r: 8 }
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -4, 6), [-50, -20, 62], [10, 28, 70], [62, 24, 60]],
    W, H, { pad: 22, azimuth: AZ },
  )
  const base = plate(P, PLATE, 0, true)
  const z = base.top
  const out = [base.svg]
  const NODES = [
    { at: [-56, -18], h: 36, r: 10 },
    { at: [34, -34], h: 28, r: 8.5 },
    { at: [6, 26], h: 44, r: 11.5 },
  ]
  const centre = (n) => [n.at[0], n.at[1], z + n.h]
  const GHOST = { at: [64, 22], h: 30, r: 10 }

  // links first, then posts and balls over their ends (back to front)
  const link = (a, b, style) => L(k.segment(a, b, P), style)
  out.push(link(centre(NODES[0]), centre(NODES[1]), { tone: 'mid' }))
  out.push(link(centre(NODES[0]), centre(NODES[2]), { tone: 'mid' }))
  out.push(link(centre(NODES[1]), centre(NODES[2]), { tone: 'mid' }))
  const order = [...NODES].sort((a, b) => k.depthOf([a.at[0], a.at[1], 0], P) - k.depthOf([b.at[0], b.at[1], 0], P))
  for (const n of order) {
    out.push(S(k.cylinder(n.at[0], n.at[1], 5, z, 2, P, 20), { tone: 'lo' }))
    out.push(S(k.cylinder(n.at[0], n.at[1], 2.2, z + 2, n.h - n.r - 2, P, 16), { tone: 'mid', crease: 'none' }))
    out.push(S(G.sphereOf(centre(n), n.r, P), { tone: 'hi' }))
  }
  // the missing concept: a dashed ring on a dashed post, joined to the graph by a dashed link; it lifts when touched
  const g = [z + GHOST.h]
  const ghost = [
    L(k.rise(GHOST.at, z, g[0], P), { tone: 'mid', dashed: true }),
    L(k.ring(GHOST.at[0], GHOST.at[1], GHOST.r, g[0], P, 36), { tone: 'mid', dashed: true }),
    L(k.ring(GHOST.at[0], GHOST.at[1], GHOST.r * 0.55, g[0], P, 28), { tone: 'faint', dashed: true }),
    D([k.iso([GHOST.at[0], GHOST.at[1], g[0]], P)], { size: 0.7, tone: 'mid' }),
  ].join('')
  out.push(L(k.segment(centre(NODES[2]), [GHOST.at[0], GHOST.at[1], g[0]], P), { tone: 'mid', dashed: true }))
  out.push(part('ghost', P, [0, 0, 1], ghost))
  return k.figureSvg({
    width: W, height: H, className: 'empty-art__svg',
    label: 'A small knowledge graph: three connected nodes on posts and a dashed outline where the next concept would join.',
    body: out,
  })
}

/* ---------- B: loupe over a blank sheet (nothing found) ---------- */

function loupe() {
  const PLATE = { x: -104, y: -64, w: 208, d: 128, r: 8 }
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -4, 6), [-90, 4, 60], [20, 4, 60]],
    W, H, { pad: 22, azimuth: AZ },
  )
  const base = plate(P, PLATE, 0, false)
  const z = base.top
  const out = [base.svg]

  // blank sheet with ghost lines of text that is not there
  const SHEET = { x: -50, y: -40, w: 124, d: 84, r: 2 }
  out.push(S(k.slabOf(SHEET, z, 1.4, P, 3, 0.4), { tone: 'hi', crease: 'lo' }))
  const sz = z + 1.4
  out.push(L(k.planOutline(k.insetPlan(SHEET, 5), sz, P, 3), { tone: 'faint' }))
  for (let i = 0; i < 5; i++) {
    const y = SHEET.y + 14 + i * 12
    const len = [70, 54, 62, 40, 56][i]
    out.push(L(k.lineOnTop([SHEET.x + 10, y], [SHEET.x + 10 + len, y], sz, P), { tone: 'faint', dashed: true }))
  }
  out.push(D(k.pointsAt([[SHEET.x + 4, SHEET.y + 4], [SHEET.x + SHEET.w - 4, SHEET.y + 4]].map(([x, y]) => [x, y, sz]), P), { size: 0.4 }))

  // stand: post at the left edge, a bar over the sheet, lens ring hanging from it
  const POST = [-90, 4]
  const LENS = [-10, 4, 40]
  out.push(S(k.slabOf({ x: POST[0] - 9, y: POST[1] - 9, w: 18, d: 18, r: 3 }, z, 5, P, 4, 0.6), { tone: 'mid' }))
  out.push(L(k.planOutline({ x: POST[0] - 6, y: POST[1] - 6, w: 12, d: 12, r: 2 }, z + 5, P, 3), { tone: 'faint' }))
  out.push(S(k.cylinder(POST[0], POST[1], 3.6, z + 5, 52, P, 24), { tone: 'mid', crease: 'none' }))
  out.push(L([16, 32, 48].map((h) => k.sideArc(POST[0], POST[1], 3.6, z + h, P, 14)).join(''), { tone: 'faint' }))
  out.push(S(k.slabOf({ x: POST[0] - 6, y: POST[1] - 6, w: 12, d: 12, r: 2 }, z + 40, 10, P, 3, 0.5), { tone: 'mid' }))
  out.push(D(k.pointsAt([[POST[0] - 3.5, POST[1] + 6], [POST[0] + 3.5, POST[1] + 6]].map(([x, y]) => [x, y, z + 45]), P), { size: 0.4 }))
  const scan = []
  const arm = { x: POST[0] + 6, y: LENS[1] - 3, w: LENS[0] - 27 - (POST[0] + 6) + 3, d: 6, r: 1.6 }
  scan.push(S(k.slabOf(arm, z + 41, 4, P, 3, 0.5), { tone: 'mid' }))
  scan.push(L(k.lineOnTop([arm.x + 3, LENS[1]], [arm.x + arm.w - 3, LENS[1]], z + 45, P), { tone: 'faint' }))
  const lensF = G.frameAlong([LENS[0], LENS[1], z + 41], [0, 0, 1])
  scan.push(S(G.ringBand(0, 3.2, 21, 27, lensF, P), { tone: 'hi', crease: 'lo' }))
  scan.push(L(k.ring(LENS[0], LENS[1], 18.6, z + 44.2, P, 48), { tone: 'faint' }))
  out.push(part('scan', P, [1, 0, 0], scan.join('')))
  out.push(S(k.cylinder(POST[0] + 10, POST[1] - 2, 2.4, z + 41, 6, P, 18), { tone: 'mid' }))
  out.push(L(k.knurl(POST[0] + 10, POST[1] - 2, 2.4, z + 41, z + 47, 14, P), { tone: 'lo' }))
  // the ring of sheet seen through the lens: a magnified dashed circle with nothing in it
  out.push(part('scanring', P, [1, 0, 0], L(k.ring(LENS[0], LENS[1], 17, sz, P, 40), { tone: 'mid', dashed: true }) + D([k.iso([LENS[0], LENS[1], sz], P)], { size: 0.6, tone: 'mid' })))
  return k.figureSvg({
    width: W, height: H, className: 'empty-art__svg',
    label: 'A magnifying glass on a stand held over a blank sheet. Nothing was found.',
    body: out,
  })
}

/* ---------- C: a speech bubble waiting for the first message (no chats yet) ---------- */

function bubble() {
  const PLATE = { x: -104, y: -64, w: 208, d: 128, r: 8 }
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -4, 6), [-64, 0, 90], [64, 0, 90]],
    W, H, { pad: 22, azimuth: AZ },
  )
  const base = plate(P, PLATE, 0, true)
  const z = base.top
  const out = [base.svg]
  const B0 = z + 20
  const rounded = (w, h, r, n = 8) => {
    const pts = []
    const c = [[w / 2 - r, h - r, 0], [-w / 2 + r, h - r, 90], [-w / 2 + r, r, 180], [w / 2 - r, r, 270]]
    for (const [cx, cy, a0] of c) for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
    return pts
  }
  const F = G.frameOf([0, 0, B0], [0, 1, 0], [1, 0, 0], [0, 0, 1])
  // stand
  out.push(S(k.cylinder(20, 0, 5, z, 2, P, 20), { tone: 'lo' }))
  out.push(S(k.cylinder(20, 0, 2.4, z + 2, B0 - z - 2, P, 18), { tone: 'mid', crease: 'none' }))
  out.push(L([8, 14].map((h) => k.sideArc(20, 0, 2.4, z + h, P, 12)).join(''), { tone: 'faint' }))
  // tail first (behind the body edge), then the body
  out.push(S(G.prismOf(F, [[-34, 4], [-14, 4], [-42, -16]], -3, 3, P), { tone: 'hi', crease: 'lo' }))
  out.push(S(G.prismOf(F, rounded(124, 66, 14), -3, 3, P), { tone: 'hi', crease: 'lo' }))
  // inset outline and the three typing dots, which bounce one after another
  const dots = [-20, 0, 20].map((u, i) => part('dot', P, [0, 0, 1], S(G.disc(0, 1.2, 4.4, G.frameAlong([u, 3, B0 + 33], [0, 1, 0]), P), { tone: 'mid', crease: 'none' }), '--i:' + i))
  out.push(L(G.circleOf(G.frameAlong([0, 3, B0 + 33], [0, 1, 0]), 0, 0.01, P, 4), { tone: 'faint' }))
  out.push(...dots)
  // little screws at the bubble's upper corners
  out.push(D([[-50, 54], [50, 54]].map(([u, v]) => k.iso([u, 3, B0 + v], P)), { size: 0.45 }))
  return k.figureSvg({
    width: W, height: H, className: 'empty-art__svg',
    label: 'A speech bubble on a stand with three typing dots, waiting for the first message.',
    body: out,
  })
}

/* ---------- D: a monitor with a blinking cursor (a workspace that is not open yet) ---------- */

function screen() {
  const PLATE = { x: -104, y: -64, w: 208, d: 128, r: 8 }
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -4, 6), [-60, 0, 100], [60, 0, 100]],
    W, H, { pad: 22, azimuth: AZ },
  )
  const base = plate(P, PLATE, 0, false)
  const z = base.top
  const out = [base.svg]
  const CASE = { x: -58, y: -6, w: 116, d: 12, r: 3 }
  const Z0 = z + 24
  const ZH = 64
  // foot and neck
  out.push(S(k.slabOf({ x: -26, y: -22, w: 52, d: 30, r: 5 }, z, 4, P, 5, 0.6), { tone: 'mid' }))
  out.push(L(k.planOutline({ x: -22, y: -18, w: 44, d: 22, r: 3 }, z + 4, P, 3), { tone: 'faint' }))
  out.push(S(k.slabOf({ x: -9, y: -9, w: 18, d: 14, r: 2 }, z + 4, Z0 - z - 4, P, 3, 0.5), { tone: 'mid' }))
  out.push(L(k.rise([0, 5], z + 6, Z0, P), { tone: 'faint' }))
  // case
  out.push(S(k.slabOf(CASE, Z0, ZH, P, 4, 0.8), { tone: 'hi', crease: 'lo' }))
  const fy = CASE.y + CASE.d
  const seg = (a, b, style) => L(k.segment([a[0], fy, a[1]], [b[0], fy, b[1]], P), style)
  // screen window
  const X0 = -50, X1 = 50, Y0 = Z0 + 8, Y1 = Z0 + ZH - 7
  out.push(seg([X0, Y0], [X1, Y0], { tone: 'mid' }), seg([X1, Y0], [X1, Y1], { tone: 'mid' }), seg([X1, Y1], [X0, Y1], { tone: 'mid' }), seg([X0, Y1], [X0, Y0], { tone: 'mid' }))
  // code lines that are not there yet, and the prompt
  const rows = [Y1 - 9, Y1 - 19, Y1 - 29]
  const lens = [64, 40, 52]
  rows.forEach((y, i) => out.push(seg([X0 + 22, y], [X0 + 22 + lens[i], y], { tone: 'faint', dashed: true })))
  const py = Y0 + 9
  out.push(seg([X0 + 8, py + 3], [X0 + 13, py], { tone: 'mid' }), seg([X0 + 13, py], [X0 + 8, py - 3], { tone: 'mid' }))
  out.push(part('cursor', P, [0, 0, 1], S(k.slabOf({ x: X0 + 18, y: fy - 0.2, w: 7, d: 1.2, r: 0.3 }, py - 4, 8, P, 2, 0), { tone: 'lit', crease: 'none' })))
  // indicator light and speaker dots on the chin
  out.push(D([k.iso([X1 - 6, fy, Z0 + 4], P)], { size: 0.8, tone: 'hi' }))
  out.push(D([-8, -4, 0, 4, 8].map((x) => k.iso([x, fy, Z0 + 4], P)), { size: 0.35, tone: 'lo' }))
  return k.figureSvg({
    width: W, height: H, className: 'empty-art__svg',
    label: 'A monitor on a stand with a prompt and a blinking cursor, and dashed lines where code would appear.',
    body: out,
  })
}

/* ---------- E: a dial gauge reading zero (no metrics yet) ---------- */

function gauge() {
  const PLATE = { x: -104, y: -64, w: 208, d: 128, r: 8 }
  const DIAL = [0, 6]
  const DR = 34
  const P = k.fitProjection(
    [...k.boxCorners(PLATE, -4, 6), [DIAL[0] - DR, DIAL[1] - DR, 60], [DIAL[0] + DR, DIAL[1] + DR, 60]],
    W, H, { pad: 22, azimuth: AZ },
  )
  const base = plate(P, PLATE, 0, true)
  const z = base.top
  const out = [base.svg]
  const DZ = z + 30
  const DH = 12
  // pedestal: foot, neck, then the dial body
  out.push(S(k.cylinder(DIAL[0], DIAL[1], 18, z, 4, P, 36, 0.6), { tone: 'mid' }))
  out.push(L(k.ring(DIAL[0], DIAL[1], 14, z + 4, P, 36), { tone: 'faint' }))
  out.push(S(k.cylinder(DIAL[0], DIAL[1], 7, z + 4, DZ - z - 4, P, 24), { tone: 'mid', crease: 'none' }))
  out.push(L([10, 18].map((h) => k.sideArc(DIAL[0], DIAL[1], 7, z + h, P, 14)).join(''), { tone: 'faint' }))
  out.push(S(k.cylinder(DIAL[0], DIAL[1], DR, DZ, DH, P, 72, 0.8), { tone: 'hi', crease: 'lo' }))
  out.push(L(k.knurl(DIAL[0], DIAL[1], DR, DZ + 2, DZ + DH, 90, P, 0.3), { tone: 'lo' }))
  const top = DZ + DH
  out.push(L(k.ring(DIAL[0], DIAL[1], DR - 3, top, P, 72), { tone: 'lo' }))
  const ticks = k.radialTicks(DIAL[0], DIAL[1], DR - 4, 40, 5, top, [2, 4.4], P, -Math.PI * 0.75, Math.PI * 1.5)
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))
  // the zero mark, in the one lit colour
  out.push(L(k.lineOnTop([DIAL[0] - 20.5, DIAL[1] + 20.5], [DIAL[0] - 27, DIAL[1] + 27], top, P), { tone: 'lit' }))
  // needle: rests on zero (down-left). It rotates in the dial plane, so the page applies a matrix between two poses.
  const NEEDLE_R = 24
  const at = (deg, r) => {
    const a = (deg * Math.PI) / 180
    return [DIAL[0] + Math.sin(a) * r, DIAL[1] - Math.cos(a) * r]
  }
  const zeroDeg = -135
  const tip = at(zeroDeg, NEEDLE_R)
  const tail = at(zeroDeg + 180, 6)
  const needle = L(k.lineOnTop(tail, tip, top + 0.3, P), { tone: 'lit', free: true }) + D([k.iso([DIAL[0], DIAL[1], top + 0.3], P)], { size: 1.1, tone: 'hi' })
  // screen matrix for turning the needle by deg about the dial centre
  const ex = k.axisVector(P, [1, 0, 0])
  const ey = k.axisVector(P, [0, 1, 0])
  const Sm = [[ex[0], ey[0]], [ex[1], ey[1]]]
  const det = Sm[0][0] * Sm[1][1] - Sm[0][1] * Sm[1][0]
  const inv = [[Sm[1][1] / det, -Sm[0][1] / det], [-Sm[1][0] / det, Sm[0][0] / det]]
  const mul = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]]
  const turn = (deg) => {
    const a = (deg * Math.PI) / 180
    // floor coordinates are (x, y) with y pointing down the dial, so a clockwise turn seen from above is +deg
    const R = [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]]
    const T = mul(mul(Sm, R), inv)
    return [T[0][0], T[1][0], T[0][1], T[1][1], 0, 0].map((v) => v.toFixed(4)).join(',')
  }
  const o = k.iso([DIAL[0], DIAL[1], top + 0.3], P)
  const style = '--ox:' + o[0].toFixed(2) + 'px;--oy:' + o[1].toFixed(2) + 'px;--m0:' + turn(0) + ';--m1:' + turn(120) + ';--m2:' + turn(8)
  out.push('<g data-part="needle" style="' + style + '">' + needle + '</g>')
  // readout slot on the front of the dial base
  out.push(D(k.pointsAt([[DIAL[0] - 10, DIAL[1] + 46], [DIAL[0] + 10, DIAL[1] + 46]].map(([x, y]) => [x, y, z + 6]), P), { size: 0.4 }))
  return k.figureSvg({
    width: W, height: H, className: 'empty-art__svg',
    label: 'A dial gauge on a stand with its needle resting at zero.',
    body: out,
  })
}

/* ---------- write ---------- */

const art = { graph: graph(), loupe: loupe(), bubble: bubble(), screen: screen(), gauge: gauge() }
writeFileSync(
  join(HERE, '..', 'src', 'emptyArt.ts'),
  '/* Generated by scripts/build-empty-art.mjs. Do not edit by hand. */\n' +
    Object.entries(art).map(([name, svg]) => `export const ${name} = ${JSON.stringify(svg)}\n`).join(''),
)

// CSS: the kit rules, scoped to .empty-art and wired to KEOS themes
let css = readFileSync(KIT + 'iso.css', 'utf8')
css = css.replace('.iso{', ":root[data-theme='dark'] .empty-art{").replace('.iso[data-theme="light"]{', ":root:not([data-theme='dark']) .empty-art{")
writeFileSync(join(HERE, '..', 'src', 'EmptyArt.css'), '/* Generated from the anatomy kit. */\n' + css + '\n.empty-art { display: block; width: 100%; }\n')
console.log('wrote src/emptyArt.ts and src/EmptyArt.css', Object.entries(art).map(([n, s]) => `${n} ${(s.length / 1024).toFixed(0)}KB`).join(', '))

// Stronger dark tones so the objects read against KEOS dark surfaces
const extra = `
:root[data-theme='dark'] .empty-art {
  --anatomy-paper: #1c1c20; --anatomy-face: #26262b; --anatomy-top: #303036;
  --anatomy-shade-0: #1a1a1e; --anatomy-shade-1: #1f1f24; --anatomy-shade-2: #25252a; --anatomy-shade-3: #2b2b31;
  --anatomy-hi: #e4e4e7; --anatomy-mid: #8e8e97; --anatomy-lo: #5a5a62; --anatomy-faint: #3b3b42;
  --anatomy-halo: #000; --anatomy-halo-opacity: 0.6; --anatomy-dot: #e4e4e7;
}
`
writeFileSync(join(HERE, '..', 'src', 'EmptyArt.css'), readFileSync(join(HERE, '..', 'src', 'EmptyArt.css'), 'utf8') + extra)
