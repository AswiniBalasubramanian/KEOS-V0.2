export type MascotId = 'cube' | 'fox' | 'toaster' | 'glasses' | 'crt' | 'radio' | 'skater'

export type MascotDef = { id: MascotId; name: string; directions: string; reactions: string }

const sheet = (id: MascotId) => ({
  directions: `/mascots/${id}-directions.webp`,
  reactions: `/mascots/${id}-reactions.webp`,
})

/* Cube is the default. The library has no "bread" mascot, so the toaster stands in for it. */
export const MASCOTS: MascotDef[] = [
  { id: 'cube', name: 'Cube', ...sheet('cube') },
  { id: 'fox', name: 'Fox', ...sheet('fox') },
  { id: 'toaster', name: 'Toaster', ...sheet('toaster') },
  { id: 'glasses', name: 'Glasses', ...sheet('glasses') },
  { id: 'crt', name: 'CRT', ...sheet('crt') },
  { id: 'radio', name: 'Radio', ...sheet('radio') },
  { id: 'skater', name: 'Skater', ...sheet('skater') },
]

const KEY_PICK = 'keos-mascot'
const KEY_SHOW = 'keos-mascot-show'

export function loadMascot(): MascotId {
  try {
    const v = localStorage.getItem(KEY_PICK) as MascotId | null
    if (v && MASCOTS.some((m) => m.id === v)) return v
  } catch { /* storage blocked */ }
  return 'cube'
}

export function saveMascot(id: MascotId) {
  try { localStorage.setItem(KEY_PICK, id) } catch { /* storage blocked */ }
}

export function loadShowMascot(): boolean {
  try { return localStorage.getItem(KEY_SHOW) !== 'off' } catch { return true }
}

export function saveShowMascot(on: boolean) {
  try { localStorage.setItem(KEY_SHOW, on ? 'on' : 'off') } catch { /* storage blocked */ }
}
