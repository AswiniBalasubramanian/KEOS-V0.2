/* Personalised welcome: who, when, how the day is going, the next best step, and a fresh line on every visit. */

export type Greeting = { title: string; lead: string; next: string }

export type Visit = { count: number; daysSince: number | null }

type Input = {
  now: Date
  firstName: string
  visit: Visit
  nextUpdate?: string // title of the first unread update, if any
  project?: string // the project currently in scope
}

const KEY_COUNT = 'keos-visit-count'
const KEY_LAST = 'keos-last-visit'

/* Read and bump the visit counter once per page load. Falls back to a first visit if storage is blocked. */
export function registerVisit(now = new Date()): Visit {
  try {
    const prev = Number(localStorage.getItem(KEY_COUNT) ?? '0') || 0
    const last = Number(localStorage.getItem(KEY_LAST) ?? '0') || 0
    localStorage.setItem(KEY_COUNT, String(prev + 1))
    localStorage.setItem(KEY_LAST, String(now.getTime()))
    const daysSince = last ? Math.floor((now.getTime() - last) / 86_400_000) : null
    return { count: prev + 1, daysSince }
  } catch {
    return { count: 1, daysSince: null }
  }
}

type Bucket = { titles: string[]; leads: string[] }

const MORNING: Bucket = {
  titles: ['Good morning, {n}', 'Morning, {n}', 'Rise and build, {n}', 'A fresh start, {n}'],
  leads: [
    'Fresh start. Let’s make the first hour count.',
    'Your sharpest hours are ahead. Let’s aim them well.',
    'One clear priority beats ten open tabs. Pick yours.',
    'Small steps early add up by noon.',
  ],
}
const AFTERNOON: Bucket = {
  titles: ['Good afternoon, {n}', 'Welcome back, {n}', 'Hello again, {n}', 'Steady progress, {n}'],
  leads: [
    'You’re past the halfway mark. Let’s keep the momentum.',
    'A quick reset now saves the evening rush.',
    'Good work compounds. Let’s add to it.',
    'Time for the next decision. I’ll bring the context.',
  ],
}
const EVENING: Bucket = {
  titles: ['Good evening, {n}', 'Winding down, {n}?', 'Nice work today, {n}', 'Evening, {n}'],
  leads: [
    'Good work today. One focused push, then rest.',
    'Let’s tie off what’s open so tomorrow starts light.',
    'You’ve earned a calm finish. I’ll keep it tidy.',
    'Capture the loose ends now, thank yourself later.',
  ],
}
const NIGHT: Bucket = {
  titles: ['Working late, {n}?', 'Still going, {n}?', 'Quiet hours, {n}'],
  leads: [
    'Late hours need sharp focus. I’ll keep it short.',
    'Take a breath. One thing at a time.',
    'I’ll hold the details so you don’t have to.',
  ],
}

function pick<T>(list: T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length]
}

export function buildGreeting({ now, firstName, visit, nextUpdate, project }: Input): Greeting {
  const h = now.getHours()
  const day = now.getDay() // 0 Sunday ... 6 Saturday

  const bucket = h >= 5 && h < 12 ? MORNING : h >= 12 && h < 17 ? AFTERNOON : h >= 17 && h < 22 ? EVENING : NIGHT

  let title = pick(bucket.titles, visit.count).replace('{n}', firstName)
  let lead = pick(bucket.leads, visit.count + 1)

  if (visit.count <= 1) {
    title = `Welcome to KEOS, ${firstName}`
    lead = 'Let’s get your first win. Ask anything about your projects.'
  } else if (visit.daysSince !== null && visit.daysSince >= 2) {
    title = `Good to see you again, ${firstName}`
    lead = `It’s been ${visit.daysSince} days. Here’s what moved while you were away.`
  } else if (day === 1 && h < 12) {
    lead = 'New week, clear head. Let’s set the pace.'
  } else if (day === 5 && h >= 12 && h < 22) {
    lead = 'Almost the weekend. Let’s close the open loops.'
  }

  const next = nextUpdate
    ? `Next up: ${nextUpdate}.`
    : project
      ? `You’re all caught up. Ask me anything about ${project.replace(/…$/, '').trim()}.`
      : 'You’re all caught up. Ask me anything, or type @ to bring an agent in.'

  return { title, lead, next }
}
