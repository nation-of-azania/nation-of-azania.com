import { RULES, SPRINT_BLOCKS_PER_S } from './battle'
import type { Point } from './geo'

/**
 * How players move, from the map's live feed: their own pace, their deaths
 * and teleports, and how long they are from a banner. Pure, for the war
 * view and the battle tracker.
 *
 * A sprint (5.6 blocks a second) is what a player on foot makes, and is
 * the pessimistic figure; most fly. Seen in the battle of 1 November 2026
 * at South_America_Quarry: a fighter on an elytra covered 22–33 blocks a
 * second, a reading every two seconds. Their own pace is read from their
 * readings: the speed between each two, each taken as the median of it and
 * its neighbours (so a teleport, one huge step between ordinary ones,
 * drops out), and of those the middle of the ones that were moving.
 *
 * A death in a battle keeps a player from teleporting for a while (the
 * server marks them in battle); how long isn't documented. Seen: a fighter
 * who died at the banner and respawned 6,900 blocks away teleported to a
 * spawn near it 258 and 212 seconds after his two deaths. So the lock is
 * at most about three and a half minutes; the battle tracker measures it
 * after every death (src/lib/battleTracker.ts), and /maps/fighters gives
 * the quickest seen, which replaces TELEPORT_LOCK_SECONDS once there is one.
 */

/** A player at a reading. */
export type Fix = { at: number; x: number; z: number; health: number | null }

/** The longest a death has been seen to keep a player from teleporting, until the tracker has measured it: an upper bound. */
export const TELEPORT_LOCK_SECONDS = 210
/** Faster than this is no flight: elytras with rockets make about 35. */
export const MOST_BLOCKS_PER_S = 40
/** Slower than this between two readings is standing about, not moving. */
const STILL_BLOCKS_PER_S = 1
/** A pace is read from the last two minutes of readings. */
export const PACE_WINDOW_MS = 120_000
/** Readings further apart than this say nothing of a pace: the player was out of sight. */
const GAP_MS = 10_000
/** A teleport covers this much at least, faster than anyone flies. */
const TELEPORT_BLOCKS = 300
const TELEPORT_BLOCKS_PER_S = 60

const distanceOf = (a: Pick<Fix, 'x' | 'z'>, b: Pick<Fix, 'x' | 'z'>) => Math.hypot(a.x - b.x, a.z - b.z)
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * A player's own pace, in blocks a second, from their readings (oldest
 * first) up to `now`: null until they've been seen moving across three
 * steps in the last two minutes. `moving` says whether they are now.
 */
export function paceOf(fixes: Fix[], now: number): { blocksPerSecond: number; moving: boolean } | null {
  const recent = fixes.filter((fix) => fix.at <= now && fix.at >= now - PACE_WINDOW_MS)
  const speeds: (number | null)[] = []
  for (let i = 1; i < recent.length; i++) {
    const seconds = (recent[i].at - recent[i - 1].at) / 1000
    speeds.push(seconds > 0 && seconds * 1000 <= GAP_MS ? distanceOf(recent[i], recent[i - 1]) / seconds : null)
  }
  // Each step as the median of it and its neighbours: one teleport between ordinary steps drops out.
  const smoothed: number[] = []
  for (let i = 1; i + 1 < speeds.length; i++) {
    const window = [speeds[i - 1], speeds[i], speeds[i + 1]]
    if (window.some((speed) => speed === null)) continue
    smoothed.push(median(window as number[]))
  }
  const moving = smoothed.filter((speed) => speed >= STILL_BLOCKS_PER_S)
  if (moving.length < 3) return null
  return {
    blocksPerSecond: Math.min(MOST_BLOCKS_PER_S, Math.round(median(moving) * 10) / 10),
    moving: (smoothed.at(-1) ?? 0) >= STILL_BLOCKS_PER_S,
  }
}

/** A death between two readings: at no health in the first, or a jump no one runs that lands them at full health from less. */
export function diedBetween(before: Fix, after: Fix): boolean {
  if (before.health === 0) return true
  const seconds = Math.max(1, (after.at - before.at) / 1000)
  return before.health !== null && before.health < 20 && after.health === 20 && distanceOf(before, after) / seconds > MOST_BLOCKS_PER_S && distanceOf(before, after) >= 50
}

/** A teleport between two readings: a long way, faster than anyone flies, and no death (their health didn't jump back to full). */
export function teleportedBetween(before: Fix, after: Fix): boolean {
  const blocks = distanceOf(before, after)
  const seconds = Math.max(1, (after.at - before.at) / 1000)
  const respawned = before.health !== null && before.health < 20 && after.health === 20
  return blocks >= TELEPORT_BLOCKS && blocks / seconds >= TELEPORT_BLOCKS_PER_S && !respawned
}

export type Return = {
  /** Straight there, or by their town's spawn first (nearer, and outside the siege zone, where nobody may teleport). */
  via: 'run' | 'spawn'
  blocks: number
  /** Seconds at a sprint: the pessimistic figure. */
  pessimistic: number
  /** Seconds at their own pace, when they've been seen moving faster than a sprint; null otherwise. */
  expected: number | null
  /** Their pace, blocks a second, when known. */
  pace: number | null
  /** Seconds until they may teleport again, after a death in a battle; 0 when they may. */
  locked: number
}

/**
 * How long a player is from a banner: straight there from where they are,
 * or, when their town's spawn is nearer the banner (and outside the siege
 * zone), teleporting there first, once they may (`diedAt`, `lockSeconds`).
 * The teleport's warm-up isn't counted; the server doesn't say it.
 */
export function returnOf(
  from: Point,
  banner: Point,
  home: Point | null,
  { now, pace = null, diedAt = null, lockSeconds = TELEPORT_LOCK_SECONDS }: { now: number; pace?: number | null; diedAt?: number | null; lockSeconds?: number },
): Return {
  const locked = diedAt === null ? 0 : Math.max(0, Math.round(lockSeconds - (now - diedAt) / 1000))
  const direct = Math.hypot(from[0] - banner[0], from[1] - banner[1])
  const fromHome = home ? Math.hypot(home[0] - banner[0], home[1] - banner[1]) : Infinity
  const spawnUseful = Boolean(home) && fromHome < direct && fromHome > RULES.siegeZoneRadius
  const timeAt = (speed: number) => {
    const straight = direct / speed
    return spawnUseful ? Math.min(straight, locked + fromHome / speed) : straight
  }
  const fast = pace !== null && pace > SPRINT_BLOCKS_PER_S ? pace : null
  const pessimistic = timeAt(SPRINT_BLOCKS_PER_S)
  const via = spawnUseful && locked + fromHome / SPRINT_BLOCKS_PER_S < direct / SPRINT_BLOCKS_PER_S ? 'spawn' : 'run'
  return {
    via,
    blocks: Math.round(via === 'spawn' ? fromHome : direct),
    pessimistic: Math.round(pessimistic),
    expected: fast === null ? null : Math.round(timeAt(fast)),
    pace: pace === null ? null : Math.round(pace * 10) / 10,
    locked,
  }
}

/**
 * After a death, the first teleport: what the battle tracker follows a
 * dead fighter for, to learn how long the lock lasts. `follow` takes the
 * last reading of the player and the next; it says when the teleport came
 * (the reading it was first seen at, so at most that long after the death).
 */
export type Follow = { died: number; last: Fix; teleport: number | null }

/** Follows a dead fighter one reading on; done when they've teleported, or after FOLLOW_MS. */
export function followed(follow: Follow, next: Fix): Follow {
  if (follow.teleport !== null) return follow
  if (teleportedBetween(follow.last, next)) return { ...follow, last: next, teleport: next.at }
  return { ...follow, last: next }
}

/** A dead fighter is followed this long at most; no teleport by then says only that they didn't. */
export const FOLLOW_MS = 15 * 60_000

/**
 * The lock as the tracker's follows say it: the quickest teleport after a
 * death (the lock can be no longer), and how many it rests on. Null when
 * none is seen yet.
 */
export function lockOf(seconds: number[]): { quickest: number; seen: number } | null {
  const seen = seconds.filter((value) => Number.isFinite(value) && value > 0)
  return seen.length ? { quickest: Math.round(Math.min(...seen)), seen: seen.length } : null
}
