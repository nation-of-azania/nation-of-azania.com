/**
 * When an event is, relative to now: upcoming, happening, or past. An event
 * without an end is "happening" for two hours after it starts, long enough
 * to find it on the map while the crowd is still there.
 */

export const DEFAULT_EVENT_HOURS = 2

export type EventPhase = 'upcoming' | 'now' | 'past'

export const eventEnd = (event: { startsAt: string; endsAt?: string | null }): number =>
  event.endsAt
    ? Date.parse(event.endsAt)
    : Date.parse(event.startsAt) + DEFAULT_EVENT_HOURS * 3600 * 1000

export function eventPhase(
  event: { startsAt: string; endsAt?: string | null },
  now = Date.now(),
): EventPhase {
  const start = Date.parse(event.startsAt)
  if (now < start) return 'upcoming'
  if (now <= eventEnd(event)) return 'now'
  return 'past'
}

/** Soonest first for what's coming, latest first for what's gone. */
export function sortEvents<T extends { startsAt: string; endsAt?: string | null }>(
  events: T[],
  now = Date.now(),
): T[] {
  return [...events].sort((a, b) => {
    const pa = eventPhase(a, now)
    const pb = eventPhase(b, now)
    const rank = { now: 0, upcoming: 1, past: 2 }
    if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb]
    const ta = Date.parse(a.startsAt)
    const tb = Date.parse(b.startsAt)
    return pa === 'past' ? tb - ta : ta - tb
  })
}

/**
 * "In 3 days", "Tomorrow", "Today", "Now", "Yesterday", "3 days ago", or
 * nothing for something more than a fortnight away: the words beside a
 * date, for a glance down a list.
 */
export function relativeDay(startsAt: string, now = Date.now()): string | null {
  const start = new Date(startsAt)
  const today = new Date(now)
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const nowDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((startDay - nowDay) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 1 && days <= 14) return `In ${days} days`
  if (days < -1 && days >= -14) return `${-days} days ago`
  return null
}

/** The date and time as the reader's device would say it: "Sat 25 Oct, 19:00". */
export function formatWhen(iso: string, { withYear = false }: { withYear?: boolean } = {}): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** "19:00–21:00" or "19:00" for the time of day, "to Sun 26 Oct, 02:00" across midnight. */
export function formatSpan(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt)
  const time = (date: Date) =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
  if (!endsAt) return time(start)
  const end = new Date(endsAt)
  const sameDay = start.toDateString() === end.toDateString()
  return sameDay ? `${time(start)}–${time(end)}` : `${time(start)} to ${formatWhen(endsAt)}`
}

/** The day as a calendar leaf: { day: "25", month: "Oct", weekday: "Sat" }. */
export function calendarLeaf(iso: string): { day: string; month: string; weekday: string } {
  const date = new Date(iso)
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(date),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date),
    weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date),
  }
}

/** The local-time value a datetime-local input wants, "2026-10-25T19:00". */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Back from a datetime-local value to an ISO instant; null when empty or unreadable. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** The moment a server-rendered map judges its events by: the render's own. */
export const clock = (): number => Date.now()
