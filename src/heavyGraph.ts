import type { Hub, Link } from './Graph3D'

/* Sample data for the namespace-wide graph: a few hundred classes with uneven numbers of
   relationships and attributes, so the graph looks and behaves like a real, large ontology. */

const A = ['Asset', 'Account', 'Contract', 'Customer', 'Policy', 'Claim', 'Invoice', 'Ledger', 'Vendor', 'Order', 'Shipment', 'Facility', 'Permit', 'Incident', 'Inspection', 'Employee', 'Project', 'Budget', 'Risk', 'Control', 'Report', 'Metric', 'Region', 'Product', 'Service', 'Channel', 'Campaign', 'Device', 'Sensor', 'Work order']
const B = ['group', 'type', 'status', 'plan', 'record', 'owner', 'batch', 'limit', 'event', 'line', 'schedule', 'cycle']
const REL = ['belongs to', 'owned by', 'governed by', 'depends on', 'produced by', 'reviewed by', 'located at', 'part of', 'issued to', 'linked to']
const ATTR = ['id', 'name', 'status', 'created', 'updated', 'owner', 'amount', 'currency', 'region', 'category', 'priority', 'start date', 'end date', 'code', 'notes', 'version']

const rnd = (seed: number) => { let t = seed >>> 0; return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296 } }

export function heavyGraph(count: number): { hubs: Hub[]; links: Link[] } {
  const r = rnd(7)
  const hubs: Hub[] = []
  const seen = new Set<string>()
  for (let i = 0; hubs.length < count; i++) {
    const name = A[Math.floor(r() * A.length)] + (r() > 0.45 ? ' ' + B[Math.floor(r() * B.length)] : '')
    const key = 'c' + i
    const rel = 2 + Math.floor(Math.pow(r(), 2.2) * 16)
    const attrs = 3 + Math.floor(Math.pow(r(), 1.8) * 18)
    const label = seen.has(name) ? name + ' ' + (i % 9 + 2) : name
    seen.add(name)
    hubs.push({
      key,
      name: label,
      rel,
      attrs,
      rels: Array.from({ length: rel }, (_, j) => REL[(i + j) % REL.length]),
      attributes: Array.from({ length: attrs }, (_, j) => ATTR[(i * 3 + j) % ATTR.length]),
    })
  }
  const links: Link[] = []
  hubs.forEach((h, i) => {
    const n = 1 + Math.floor(r() * 3)
    for (let k = 0; k < n; k++) {
      const j = Math.floor(r() * hubs.length)
      if (j !== i) links.push({ a: h.key, b: hubs[j].key, label: REL[(i + k) % REL.length] })
    }
  })
  return { hubs, links }
}
