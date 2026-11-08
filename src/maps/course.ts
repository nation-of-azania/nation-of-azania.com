import { RULES, type BattleSide } from './battle'
import { killsBetween, type Mark } from './fights'

/**
 * A session's course as the war view charts it (panels/Outlook.tsx →
 * SessionChart): the points at each moment, and, along them, where a
 * side's line stepped up by a kill rather than climbed by the banner. A
 * kill is 100 to the side that didn't die, at once; the banner is 10 a
 * holder at every check, a steady climb. Telling the two apart is what the
 * banner's holders could have earned between two points (fights.ts →
 * killsBetween), which the view's own readings know. The tracker's minute
 * points (/maps/battles) say only who held the banner, not with how many,
 * so along them a kill is told by a minute's rise over the run's usual: a
 * side not holding the banner can only have risen by kills; a side holding
 * it earns about the same every minute, and a minute a hundred over that
 * had a kill in it. Pure.
 */

/** A point of the course: the minute, each side's points, who held the banner, and with how many when known (null: the tracker's minute points). */
export type CoursePoint = { minute: number; attacker: number; defender: number; banner: BattleSide | null; holders: number | null }

/** A side's kills between two points of the course: at the later point (its index and minute), and how many. */
export type KillStep = { at: number; minute: number; side: BattleSide; kills: number }

/** Kills close together drawn as one: from the first's minute to the last's (`at` the last's point), and how many in all. */
export type KillCluster = KillStep & { from: number }

/** Kills within this many minutes of a cluster's first are drawn as one mark, with their number. */
export const KILL_CLUSTER_MINUTES = 3

const keyOf = (side: BattleSide): 'attacker' | 'defender' => (side === 'attackers' ? 'attacker' : 'defender')

/** A point as a mark for killsBetween, with its holders taken as known. */
const markOf = (point: CoursePoint, holders: number): Mark => ({
  t: point.minute * 60,
  banner: point.banner,
  holders: point.banner ? holders : 0,
  attacker: point.attacker,
  defender: point.defender,
})

/** The lower median of some rises: the run's usual minute, leaning to the one without a kill in it. */
const usualOf = (rises: number[]): number => {
  const sorted = [...rises].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

/**
 * Along a side's points with unknown holders, what the banner usually earned
 * it in a minute during each run of holding it: for each point's index, the
 * usual rise of the run of intervals (both ends held by the side) it ends
 * or begins; undefined where the side held at neither end, or the run is
 * too short to say (one point, no interval within it).
 */
function usualRises(points: CoursePoint[], side: BattleSide): Map<number, number> {
  const key = keyOf(side)
  const usual = new Map<number, number>()
  let run: number[] = []
  let members: number[] = []
  const close = () => {
    if (run.length) {
      const value = usualOf(run)
      for (const index of members) usual.set(index, value)
    }
    run = []
    members = []
  }
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    if (a.banner === side && b.banner === side) {
      run.push(b[key] - a[key])
      if (!members.includes(i - 1)) members.push(i - 1)
      members.push(i)
    } else close()
  }
  close()
  return usual
}

/**
 * Where a side's points rose by kills between two points of the course,
 * and by how many; the step is put at the later point. With the holders
 * known at both ends (or at one, and the same side holding at the other),
 * exactly as fights.ts → killsBetween tells it; without them, by the rise
 * over what the banner usually earned the side in a minute of that run
 * (see above), and all of it where the side didn't hold the banner.
 */
export function killsAlong(points: CoursePoint[]): KillStep[] {
  const steps: KillStep[] = []
  const usual: Record<BattleSide, Map<number, number> | null> = { attackers: null, defenders: null }
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    for (const side of ['attackers', 'defenders'] as const) {
      const key = keyOf(side)
      const rise = b[key] - a[key]
      if (rise < RULES.killPoints) continue
      // The holders at a point: its own, or its neighbour's while the same side held at both.
      const holdersA = a.holders ?? (a.banner === b.banner ? b.holders : null)
      const holdersB = b.holders ?? (a.banner === b.banner ? a.holders : null)
      let kills: number
      if (holdersA !== null && holdersB !== null) kills = killsBetween(markOf(a, holdersA), markOf(b, holdersB), side)
      else if (a.banner !== side && b.banner !== side) kills = Math.floor(rise / RULES.killPoints)
      else {
        usual[side] ??= usualRises(points, side)
        // Held at one end only (taken or lost this minute): the banner earned at most a usual minute's worth.
        const base = usual[side].get(a.banner === side && b.banner === side ? i : a.banner === side ? i - 1 : i)
        kills = base === undefined ? 0 : Math.max(0, Math.round((rise - base) / RULES.killPoints))
      }
      if (kills > 0) steps.push({ at: i, minute: b.minute, side, kills })
    }
  }
  return steps
}

/**
 * Kill steps gathered for drawing: a side's steps within `within` minutes
 * of the first of them make one mark at the last, with their number, so
 * a run of deaths in a few minutes isn't a row of marks. In the order of
 * the steps.
 */
export function clusterKills(steps: KillStep[], within = KILL_CLUSTER_MINUTES): KillCluster[] {
  const clusters: KillCluster[] = []
  const open: Partial<Record<BattleSide, KillCluster>> = {}
  for (const step of steps) {
    const cluster = open[step.side]
    if (cluster && step.minute - cluster.from <= within) {
      cluster.at = step.at
      cluster.minute = step.minute
      cluster.kills += step.kills
      continue
    }
    const next: KillCluster = { ...step, from: step.minute }
    open[step.side] = next
    clusters.push(next)
  }
  return clusters
}
