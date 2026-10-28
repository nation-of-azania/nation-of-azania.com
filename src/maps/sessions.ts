/**
 * SiegeWar's battle sessions: when sieges are fought. The server starts one
 * at set times of day, in its own time zone, each an hour long; they aren't
 * on the map, so the times are a setting (Settings → Discord → Siege
 * alerts), checked against the map whenever a session is seen running: a
 * siege's mark then says how long the session has left (`Battle Time Left`,
 * "N/A" between sessions). Pure.
 */

/** How long a battle session lasts, as Rulercraft's rules say. */
export const SESSION_MS = 60 * 60 * 1000

export type SessionSchedule = {
  /** Times of day, as minutes after midnight, in `zone`. */
  times: number[]
  zone: string
}

/** "13:00, 19:00, 01:00" as minutes after midnight; null when any part isn't a time. */
export function sessionTimes(text: string | null | undefined): number[] | null {
  const parts = (text ?? '').split(/[,;\s]+/).filter(Boolean)
  if (!parts.length) return null
  const times = parts.map((part) => {
    const match = /^([01]?\d|2[0-3])(?::([0-5]\d))?$/.exec(part)
    return match ? Number(match[1]) * 60 + Number(match[2] ?? 0) : null
  })
  return times.every((time): time is number => time !== null) ? [...new Set(times)].sort((a, b) => a - b) : null
}

/** Whether the browser's and the server's clock know a time zone by this name. */
export function isTimeZone(zone: string | null | undefined): boolean {
  if (!zone?.trim()) return false
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone.trim() })
    return true
  } catch {
    return false
  }
}

/** The schedule out of the settings; null when either part is missing or wrong. */
export function scheduleOf(times: string | null | undefined, zone: string | null | undefined): SessionSchedule | null {
  const parsed = sessionTimes(times)
  return parsed && isTimeZone(zone) ? { times: parsed, zone: zone!.trim() } : null
}

/** How far a zone is ahead of UTC at an instant, in ms. */
function offsetAt(zone: string, at: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(new Date(at))
      .map((part) => [part.type, Number(part.value)]),
  )
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(at / 1000) * 1000
}

/** The instant a zone's clock shows a time on a day (the day as a UTC date's year, month and day). */
function instantOf(zone: string, year: number, month: number, day: number, minutes: number): number {
  const wall = Date.UTC(year, month, day, 0, minutes)
  // Twice, so a day the clocks change on settles on the right side of it.
  const first = wall - offsetAt(zone, wall)
  return wall - offsetAt(zone, first)
}

/** Session starts from a day before `from` to a few after, in order. */
function startsAround(from: number, schedule: SessionSchedule, days = 4): number[] {
  const starts: number[] = []
  for (let offset = -1; offset <= days; offset++) {
    const day = new Date(from + offset * 86_400_000)
    for (const minutes of schedule.times) {
      starts.push(instantOf(schedule.zone, day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), minutes))
    }
  }
  return [...new Set(starts)].sort((a, b) => a - b)
}

/** The next `count` sessions starting after `after` (ms since the epoch). */
export function nextSessions(after: number, schedule: SessionSchedule, count: number): number[] {
  return startsAround(after, schedule, Math.ceil(count / Math.max(1, schedule.times.length)) + 2)
    .filter((start) => start > after)
    .slice(0, count)
}

/** The scheduled session nearest an instant a session was seen to end, and how far off it is, in ms. */
export function nearestEnd(end: number, schedule: SessionSchedule): { start: number; off: number } {
  const start = startsAround(end, schedule, 1).reduce((best, candidate) =>
    Math.abs(candidate + SESSION_MS - end) < Math.abs(best + SESSION_MS - end) ? candidate : best,
  )
  return { start, off: end - (start + SESSION_MS) }
}

/**
 * How long a session has left, from a siege's `Battle Time Left` as Towny
 * formats it ("45.3 minutes", "45m 12s", "1h 2m", "12:30"); null between
 * sessions ("N/A").
 */
export function timeLeftMs(text: string | null | undefined): number | null {
  const value = text?.trim().toLowerCase() ?? ''
  if (!value || /^(n\/?a|none|-+|0)$/.test(value)) return null
  const clock = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(value)
  if (clock) return ((Number(clock[1] ?? 0) * 60 + Number(clock[2])) * 60 + Number(clock[3])) * 1000
  let ms = 0
  for (const [, amount, unit] of value.matchAll(/(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g)) {
    const size = unit.startsWith('h') ? 3_600_000 : unit.startsWith('m') ? 60_000 : 1000
    ms += Number(amount.replace(',', '.')) * size
  }
  return ms > 0 ? Math.round(ms) : null
}
