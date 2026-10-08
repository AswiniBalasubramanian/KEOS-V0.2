/* Personalised welcome: positive, upbeat and human. Who, when, the day of the week, what is waiting, and a fresh line on every visit. */

export type Greeting = { title: string; lead: string; next: string }

export type Visit = { count: number; daysSince: number | null }

type Input = {
  now: Date
  firstName: string
  visit: Visit
  nextUpdate?: string // title of the first unread update, if any
  unreadCount?: number // how many updates are waiting
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
  titles: ['Good morning, {n}', 'Rise and shine, {n}', 'Let’s make today a good one, {n}', 'Ready when you are, {n}'],
  leads: [
    'Fresh start, fresh ideas. Let’s see what we can wrap up today.',
    'Your best work is just getting started, and your context is ready.',
    'A great day starts with one clear priority. What’s yours?',
    'You’ve got momentum. Let’s put it to good use.',
  ],
}
const AFTERNOON: Bucket = {
  titles: ['Good afternoon, {n}', 'Great to see you, {n}', 'You’re on a roll, {n}', 'Welcome back, {n}'],
  leads: [
    'Nice pace today. Let’s keep it going.',
    'You’ve already done the hard part. Let’s finish strong.',
    'A quick check-in can unlock the next big step.',
    'Every small win counts. Let’s add another.',
  ],
}
const EVENING: Bucket = {
  titles: ['Good evening, {n}', 'Great work today, {n}', 'Almost there, {n}', 'Evening, {n}'],
  leads: [
    'You’ve earned a smooth finish. Let’s tie up what’s open.',
    'Proud of today’s progress. One last push, then rest.',
    'Let’s wrap up well so tomorrow starts light.',
    'Look how far you’ve come today.',
  ],
}
const NIGHT: Bucket = {
  titles: ['Burning the midnight oil, {n}?', 'Still going strong, {n}', 'Night owl mode, {n}'],
  leads: [
    'Dedication noted. I’ll keep things quick and clear.',
    'One thing at a time. I’ve got the details covered.',
    'Quiet hours, sharp focus. Let’s do this.',
  ],
}

function pick<T>(list: T[], seed: number): T {
  return list[((seed % list.length) + list.length) % list.length]
}

export function buildGreeting({ now, firstName, visit, nextUpdate, unreadCount = 0, project }: Input): Greeting {
  const h = now.getHours()
  const day = now.getDay() // 0 Sunday ... 6 Saturday

  const bucket = h >= 5 && h < 12 ? MORNING : h >= 12 && h < 17 ? AFTERNOON : h >= 17 && h < 22 ? EVENING : NIGHT

  let title = pick(bucket.titles, visit.count).replace('{n}', firstName)
  let lead = pick(bucket.leads, visit.count + 1)

  if (visit.count <= 1) {
    title = `Welcome to KEOS, ${firstName}!`
    lead = 'We’re glad you’re here. Ask anything about your projects to get started.'
  } else if (visit.daysSince !== null && visit.daysSince >= 2) {
    title = `Great to have you back, ${firstName}!`
    lead = `It’s been ${visit.daysSince} days. Here’s what moved while you were away.`
  } else if (day === 1 && h < 12) {
    lead = 'New week, new wins. Let’s set the pace together.'
  } else if (day === 5 && h >= 12 && h < 22) {
    title = `Happy Friday, ${firstName}!`
    lead = 'Let’s close the open loops and finish the week strong.'
  } else if (day === 0 || day === 6) {
    lead = 'Weekend focus. Respect for the dedication, and I’ll keep it light.'
  }

  const next = nextUpdate
    ? unreadCount > 1
      ? `${unreadCount} updates are waiting. First up: ${nextUpdate}.`
      : `One update is waiting: ${nextUpdate}.`
    : project
      ? `You’re all caught up, nice. Ask me anything about ${project.replace(/…$/, '').trim()}.`
      : 'You’re all caught up, nice. Ask me anything, or type @ to bring an agent in.'

  return { title, lead, next }
}
