import { getCache } from '@vercel/functions'

/**
 * A meter on the compute the site's own schedule spends: Vercel's free plan
 * allows 4 hours a month of Fluid Active CPU across both of the account's
 * projects, and on 1 November 2026 the account went over it and every
 * deployment was paused for the rest of the month (README → The watch's
 * schedule). The watch and the battle tracker are what run whether anyone
 * looks or not, so each run's CPU time is added up here, by the month (UTC),
 * in Vercel's runtime cache, and logged; and the battle tracker stops for the
 * month once its share is spent (CPU_SHARE_S).
 *
 * Measured as the process's CPU time over the run (process.cpuUsage), which
 * on Fluid compute also counts whatever else the same instance served
 * meanwhile: if anything, more than the run's own.
 */

export type Metered = 'watch' | 'tracker'

/** Each one's share of the month's 4 hours, in seconds: the rest is for pages, tiles and the routes visitors ask. */
export const CPU_SHARE_S: Record<Metered, number> = { watch: 45 * 60, tracker: 60 * 60 }

const keyOf = (part: Metered, now: number) => `azania-maps:cpu:${part}:${new Date(now).toISOString().slice(0, 7)}`

/** The CPU seconds spent this month (UTC) by `part`, as the meter has it; 0 when the cache can't say. */
export async function cpuSpent(part: Metered, now = Date.now()): Promise<number> {
  try {
    return Number(await getCache().get(keyOf(part, now))) || 0
  } catch {
    return 0
  }
}

/** A start for a run's measure: call `stop()` at its end to add its CPU time to the month's and have it said. */
export function meter(part: Metered) {
  const start = process.cpuUsage()
  const began = Date.now()
  return async function stop(): Promise<{ seconds: number; month: number }> {
    const used = process.cpuUsage(start)
    const seconds = (used.user + used.system) / 1e6
    let month = seconds
    try {
      const cache = getCache()
      month += Number(await cache.get(keyOf(part, began))) || 0
      await cache.set(keyOf(part, began), month, { ttl: 40 * 24 * 60 * 60 })
    } catch {
      // Unmetered this time.
    }
    return { seconds, month }
  }
}

/** "0.31 s; this month 12.4 of 45 min" for the logs. */
export const cpuWords = (part: Metered, { seconds, month }: { seconds: number; month: number }): string =>
  `cpu ${seconds.toFixed(2)} s; this month ${(month / 60).toFixed(1)} of ${CPU_SHARE_S[part] / 60} min`
