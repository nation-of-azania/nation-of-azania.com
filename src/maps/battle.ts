import { sameNation } from './abroad'
import { allySide, type Allied } from './alliances'
import { inOutlines, type Outline, type Point } from './geo'
import type { LivePlayer } from './players'
import { pointsOf } from './sieges'
import type { Siege, WorldTown } from './world'

/**
 * A siege battle, worked out: the score as it stands and as it will stand
 * if things go on as they are, what it takes to turn it round, who of
 * each side is at the banner, and how long a player is from it. For the
 * war view's sidebar. Everything comes from what the map shows (SiegeWar's
 * marker, src/maps/world.ts → Siege, and the live players) and from the
 * server's rules (docs/war-rules.md), which the marker doesn't repeat.
 * Pure, so the projections are tested without a battle
 * (scripts/test-battle.ts).
 */

/**
 * The rules a battle is scored by: Rulercraft's where its rules say,
 * SiegeWar's defaults where they don't (ASSUMED), as docs/war-rules.md
 * sets out.
 */
export const RULES = {
  /** A battle session's length. */
  sessionMinutes: 60,
  /** Sessions in a siege; the marker's "Siege Progress" says it for each siege (a revolt has 2). */
  sessionsPerSiege: 3,
  /** When sessions start, in the server's time. */
  sessionHours: [13, 19, 1],
  serverTimeZone: 'Europe/Berlin',
  /**
   * Staying in the banner zone this long captures the banner, counted from
   * the first of SiegeWar's checks (every tick) that finds the player
   * there, so in practice up to a tick more; seen in a battle.
   */
  captureMinutes: 5,
  /** Banner control earns this many points per holder every tick (seen in a battle: 2 holders +20, 3 holders +30). */
  tickSeconds: 20,
  pointsPerHolder: 10,
  /** A death in the siege zone gives the other side this many (seen in a battle). */
  killPoints: 100,
  /**
   * The banner control zone: this far from the banner across the ground and
   * up or down, in the wild, not on a town's claims. The server says it as a
   * capture starts ("Remain within 18 blocks of the banner, but staying out
   * of the town, for 5 minutes"); SiegeWar's default is a town block, 16.
   */
  bannerRadius: 18,
  /** The siege zone: no teleporting in, deaths count. */
  siegeZoneRadius: 200,
  /**
   * Taking the banner back earns no bonus on Rulercraft (SiegeWar's default
   * is ×3 a reversal): seen in a battle, where the defenders who took it back
   * earned 10 a holder a tick, as anyone holding it does.
   */
  reversalFactor: 1,
  /**
   * The siege balance is held within ± this: seen in a battle, where a
   * session that would have taken it from 3,280 to 7,620 left it at
   * 7,000 (SiegeWar's default is 20,000).
   */
  balanceCap: 7_000,
  /** A win by less than this is a close victory (half the plunder). */
  closeVictory: 3_500,
} as const

/**
 * The rules above the server's rules don't give, taken from SiegeWar's
 * defaults: said as estimates wherever they count. The session times (in
 * CET/CEST) and the balance moving by attacker − defender points each
 * session are confirmed by the leadership; the balance cap, the capture's
 * five minutes, the banner's 10 a holder a tick, the 100 a kill and no
 * bonus for taking the banner back were seen in battles (docs/war-rules.md
 * → Seen in a battle); the banner zone's 18 blocks, in the wild, the
 * server says in game.
 */
export const ASSUMED = ['siegeZoneRadius'] as const

/** How fast a player covers ground, in blocks a second: sprinting on flat ground, as the game moves them. */
export const SPRINT_BLOCKS_PER_S = 5.6

/** A side of a siege. */
export type BattleSide = 'attackers' | 'defenders'

/** Who holds the banner, and how many of them: SiegeWar's "Attackers (3)". */
export type Banner = { side: BattleSide | null; holders: number }

export function bannerOf(siege: Pick<Siege, 'bannerControl'>): Banner {
  const match = /^(attackers|defenders|nobody)\b(?:\s*\((\d+)\))?/i.exec(siege.bannerControl?.trim() ?? '')
  if (!match || match[1].toLowerCase() === 'nobody') return { side: null, holders: 0 }
  return { side: match[1].toLowerCase() as BattleSide, holders: match[2] ? Number(match[2]) : 1 }
}

/**
 * Seconds left in the battle session as the marker said it, when it was
 * written: Towny's "45.3 minutes", "1.0 hours", "38 seconds", or a short
 * "12m 30s"; null for SiegeWar's "N/A" (no battle on) or anything unread.
 */
export function secondsLeftOf(text: string | null | undefined): number | null {
  if (!text) return null
  const units: Record<string, number> = { s: 1, sec: 1, second: 1, m: 60, min: 60, minute: 60, h: 3600, hr: 3600, hour: 3600, d: 86_400, day: 86_400 }
  let total = 0
  let found = false
  for (const match of text.toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*([a-z]+)/g)) {
    const unit = units[match[2].replace(/s$/, '')] ?? units[match[2]]
    if (!unit) continue
    total += Number(match[1].replace(',', '.')) * unit
    found = true
  }
  return found ? Math.round(total) : null
}

/** Points a second the banner earns its side: holders × 10 every 20 s, times any reversal bonus (none on Rulercraft). */
export const bannerRate = (holders: number, multiplier: number): number =>
  (holders * RULES.pointsPerHolder * multiplier) / RULES.tickSeconds

/** The reversal bonus after this many reversals: none on Rulercraft (RULES.reversalFactor), kept should that change. */
export const reversalMultiplier = (reversals: number): number => (reversals > 0 ? RULES.reversalFactor : 1)

/** A reading of a battle at one moment: what the marker said, at the time the map wrote it. */
export type BattleReading = {
  at: number
  banner: Banner
  points: { attacker: number; defender: number } | null
  secondsLeft: number | null
}

export const readingOf = (siege: Siege, at: number): BattleReading => ({
  at,
  banner: bannerOf(siege),
  points: pointsOf(siege),
  secondsLeft: secondsLeftOf(siege.battleTimeLeft),
})

/**
 * How many times the banner has changed hands this session, as far as the
 * readings show: each time it passes from one side to the other (from
 * nobody isn't a reversal). Readings start when the view was opened, so
 * reversals before that are unknown: `complete` says whether the readings
 * reach back to the session's start (its first has the full hour left, or
 * no points yet).
 */
export function reversalsSeen(readings: BattleReading[]): { reversals: number; complete: boolean } {
  let reversals = 0
  let last: BattleSide | null = null
  for (const reading of readings) {
    const side = reading.banner.side
    if (side && last && side !== last) reversals++
    if (side) last = side
  }
  const first = readings[0]
  const complete = Boolean(
    first &&
      ((first.points && first.points.attacker === 0 && first.points.defender === 0) ||
        (first.secondsLeft !== null && first.secondsLeft >= (RULES.sessionMinutes - RULES.captureMinutes) * 60)),
  )
  return { reversals, complete }
}

/**
 * The readings as runs: each run the readings in a row with the same side
 * holding with the same holders, all with points, so what the banner
 * earned across it can be told from the points; a change of hands or of
 * holders begins another. Readings come half a minute apart, a tick and a
 * half, so two in a row say little; a run says more the longer it goes.
 */
function runsOf(readings: BattleReading[]): BattleReading[][] {
  const runs: BattleReading[][] = []
  let run: BattleReading[] = []
  for (const reading of readings) {
    const last = run.at(-1)
    const joins =
      Boolean(reading.points) &&
      Boolean(last) &&
      last!.banner.side === reading.banner.side &&
      last!.banner.holders === reading.banner.holders
    if (!joins) {
      if (run.length > 1) runs.push(run)
      run = reading.points ? [reading] : []
    } else run.push(reading)
  }
  if (run.length > 1) runs.push(run)
  return runs
}

/**
 * The banner's multiplier as the points show it: across a run of readings
 * with the same side holding with the same holders, the points it gained
 * over what the holders alone earn at ×1. Kills only add points, so the
 * largest multiplier the gain covers is taken, from the latest run long
 * enough to say (two ticks); null when none is.
 */
export function multiplierObserved(readings: BattleReading[]): number | null {
  let best: number | null = null
  for (const run of runsOf(readings)) {
    const [first, last] = [run[0], run[run.length - 1]]
    const side = last.banner.side
    if (!side) continue
    const ticks = Math.floor((last.at - first.at) / 1000 / RULES.tickSeconds)
    if (ticks < 2) continue
    const key = side === 'attackers' ? 'attacker' : 'defender'
    const gained = last.points![key] - first.points![key]
    const base = last.banner.holders * RULES.pointsPerHolder * ticks
    if (base <= 0 || gained < base) continue
    const candidates = [1, 3, 6, 9, 12, 15].filter((m) => m * base <= gained * 1.05)
    best = candidates.at(-1) ?? 1
  }
  return best
}

const TICK_MS = RULES.tickSeconds * 1000

/** SiegeWar's checks in (from, to], when they fall at `phase` ms past each 20-second step since the epoch. */
export const checksBetween = (from: number, to: number, phase: number): number =>
  to <= from ? 0 : Math.floor((to - phase) / TICK_MS) - Math.floor((from - phase) / TICK_MS)

/** The first of SiegeWar's checks at or after `at`. */
export const checkAtOrAfter = (at: number, phase: number): number => Math.ceil((at - phase) / TICK_MS) * TICK_MS + phase

/**
 * When SiegeWar's checks fall, as a battle's readings show it: the server
 * does everything on Towny's short tick, every 20 seconds at the same
 * moment (seen in a battle: about 10 s past each 20-second step), and the
 * banner's points rise only then. Between two readings a tick apart or
 * less, with the same holders, the points either rose by a tick's worth or
 * didn't; the moment that agrees with the most of them is the phase, in ms
 * past each 20-second step since the epoch. Kills (hundreds) are left
 * out. Null until enough readings say it plainly.
 */
export function tickPhaseOf(readings: BattleReading[]): number | null {
  const pairs: { from: number; to: number; ticked: boolean }[] = []
  for (let index = 1; index < readings.length; index++) {
    const [a, b] = [readings[index - 1], readings[index]]
    const side = b.banner.side
    if (!side || a.banner.side !== side || a.banner.holders !== b.banner.holders || !a.points || !b.points) continue
    const gap = b.at - a.at
    if (gap <= 0 || gap > TICK_MS) continue
    const key = side === 'attackers' ? 'attacker' : 'defender'
    const gained = b.points[key] - a.points[key]
    if (gained === 0) pairs.push({ from: a.at, to: b.at, ticked: false })
    else if (gained > 0 && gained % RULES.killPoints !== 0) pairs.push({ from: a.at, to: b.at, ticked: true })
  }
  if (pairs.length < 6) return null
  let best: number[] = []
  let bestScore = -1
  for (let phase = 0; phase < TICK_MS; phase += 250) {
    const score = pairs.filter((pair) => checksBetween(pair.from, pair.to, phase) > 0 === pair.ticked).length
    if (score > bestScore) [best, bestScore] = [[phase], score]
    else if (score === bestScore) best.push(phase)
  }
  if (bestScore < pairs.length * 0.9) return null
  // The middle of the moments that agree best; they run in one stretch, unless it wraps past the step's end.
  const wraps = best.length > 1 && best[0] === 0 && best.at(-1) === TICK_MS - 250
  const run = wraps ? best.map((phase) => (phase < TICK_MS / 2 ? phase + TICK_MS : phase)) : best
  return Math.round(run.reduce((sum, phase) => sum + phase, 0) / run.length) % TICK_MS
}

/**
 * The score a reading leads to by `now`, the banner earning as it does;
 * kills can't be foreseen. With the checks' phase (tickPhaseOf), the
 * points rise on the very checks the server makes; without it, every 20
 * seconds from the reading.
 */
export function scoreNow(
  reading: BattleReading,
  multiplier: number,
  now: number,
  phase: number | null = null,
): { attacker: number; defender: number } | null {
  if (!reading.points) return null
  const elapsed = Math.max(0, (now - reading.at) / 1000)
  const left = reading.secondsLeft
  const running = left === null ? 0 : Math.min(elapsed, left)
  const ticks = phase === null ? Math.floor(running / RULES.tickSeconds) : checksBetween(reading.at, reading.at + running * 1000, phase)
  const gained = reading.banner.side ? reading.banner.holders * RULES.pointsPerHolder * multiplier * ticks : 0
  return {
    attacker: reading.points.attacker + (reading.banner.side === 'attackers' ? gained : 0),
    defender: reading.points.defender + (reading.banner.side === 'defenders' ? gained : 0),
  }
}

/** Seconds left in the session at `now`, from a reading; null between sessions. */
export const secondsLeftNow = (reading: BattleReading, now: number): number | null =>
  reading.secondsLeft === null ? null : Math.max(0, reading.secondsLeft - Math.max(0, (now - reading.at) / 1000))

const capped = (balance: number) => Math.max(-RULES.balanceCap, Math.min(RULES.balanceCap, balance))

/**
 * The battle and the siege as they'll end if the banner stays where it is,
 * held by as many, and nobody dies: the session's final points, and the
 * siege balance after it (positive favours the attacker). `kills` adds an
 * expected number of kills a minute for each side, for "at this pace".
 */
export function projectBattle(
  siege: Pick<Siege, 'balance' | 'progress'>,
  reading: BattleReading,
  multiplier: number,
  now: number,
  kills: { attacker: number; defender: number } = { attacker: 0, defender: 0 },
  phase: number | null = null,
): {
  points: { attacker: number; defender: number }
  balance: number | null
  sessionsLeft: number | null
  /** Points of the session's margin the cap would leave uncounted (seen in a battle: the balance stops at ±7,000). */
  overCap: number
} | null {
  const current = scoreNow(reading, multiplier, now, phase)
  const left = secondsLeftNow(reading, now)
  if (!current || left === null) return null
  const ticks = phase === null ? Math.floor(left / RULES.tickSeconds) : checksBetween(now, now + left * 1000, phase)
  const banner = reading.banner.side ? reading.banner.holders * RULES.pointsPerHolder * multiplier * ticks : 0
  const minutes = left / 60
  const points = {
    attacker: Math.round(current.attacker + (reading.banner.side === 'attackers' ? banner : 0) + kills.attacker * minutes * RULES.killPoints),
    defender: Math.round(current.defender + (reading.banner.side === 'defenders' ? banner : 0) + kills.defender * minutes * RULES.killPoints),
  }
  const uncapped = siege.balance === null ? null : siege.balance + points.attacker - points.defender
  const balance = uncapped === null ? null : capped(uncapped)
  const overCap = uncapped === null ? 0 : Math.max(0, Math.abs(uncapped) - RULES.balanceCap)
  const sessionsLeft = siege.progress ? Math.max(0, siege.progress.of - siege.progress.done - 1) : null
  return { points, balance, sessionsLeft, overCap }
}

/**
 * What the side behind needs to come level with the side ahead, in points
 * of the siege balance: as kills, and as minutes of the banner held by a
 * number of holders, plain and with the reversal bonus that taking it from
 * the enemy brings (the first reversal triples it). `deficit` is how far
 * behind it is; nothing when it isn't.
 */
export function toTurnAround(deficit: number, holders: number, nextMultiplier: number) {
  if (deficit <= 0) return null
  const perMinute = (multiplier: number) => (holders * RULES.pointsPerHolder * multiplier * 60) / RULES.tickSeconds
  return {
    points: deficit,
    kills: Math.ceil(deficit / RULES.killPoints),
    /** Minutes of holding the banner, at ×1. */
    minutes: deficit / perMinute(1),
    /** Minutes of holding it after taking it back (the bonus it then earns), plus the capture itself. */
    minutesRetaken: RULES.captureMinutes + deficit / perMinute(nextMultiplier),
    holders,
  }
}

/**
 * The kills a minute each side has been making, as far as the readings
 * show: across a run of readings with the same side holding with the same
 * holders, what a side gained over what its holders earn (at `multiplier`)
 * can only be kills, 100 apiece; the span across a change of hands says
 * nothing and is left out. The banner's ticks fall where they may between
 * readings, so its earnings are reckoned by the run's exact length and the
 * kills rounded, which a banner earning near a hundred a tick can pass for
 * one of. Taken at the one multiplier, a stretch read before a reversal at
 * a lower bonus can read as a kill or so more. Null until a minute of
 * readings says anything.
 */
export function killPaceObserved(readings: BattleReading[], multiplier: number): { attacker: number; defender: number } | null {
  let minutes = 0
  const kills = { attacker: 0, defender: 0 }
  for (const run of runsOf(readings)) {
    const [first, last] = [run[0], run[run.length - 1]]
    const seconds = (last.at - first.at) / 1000
    if (seconds <= 0) continue
    const base = last.banner.side ? (last.banner.holders * RULES.pointsPerHolder * multiplier * seconds) / RULES.tickSeconds : 0
    const excess = (side: 'attacker' | 'defender', holds: boolean) =>
      Math.max(0, last.points![side] - first.points![side] - (holds ? base : 0))
    kills.attacker += Math.round(excess('attacker', last.banner.side === 'attackers') / RULES.killPoints)
    kills.defender += Math.round(excess('defender', last.banner.side === 'defenders') / RULES.killPoints)
    minutes += seconds / 60
  }
  if (minutes < 1) return null
  return { attacker: kills.attacker / minutes, defender: kills.defender / minutes }
}

/** Where the banner's multiplier was read from: the points themselves, the changes of hands seen since the session began, or taken for granted. */
export type MultiplierSource = 'observed' | 'inferred' | 'assumed'

/**
 * A battle as it stands at `now`, worked out from its readings for the war
 * view's sidebar: the latest reading, the banner's multiplier and where it
 * was read from, the score run on, the time left, the session's end as
 * the banner alone would make it and at the battle's own pace of kills,
 * and, for the side the projected balance leaves behind, what it takes to
 * come level by the session's end: kills; holders at the banner for the
 * rest of it, more than it has (`holders` is each side's at the banner
 * now); or, when the enemy holds it, taking it back and holding it. Null
 * without a reading.
 */
export function assessBattle(
  siege: Pick<Siege, 'balance' | 'progress'>,
  readings: BattleReading[],
  now: number,
  holders: { attackers: number; defenders: number },
): {
  reading: BattleReading
  multiplier: { value: number; source: MultiplierSource }
  /** When SiegeWar's checks fall (tickPhaseOf); null until the readings say. */
  phase: number | null
  reversals: number
  score: { attacker: number; defender: number } | null
  secondsLeft: number | null
  projected: ReturnType<typeof projectBattle>
  pace: { attacker: number; defender: number } | null
  paced: ReturnType<typeof projectBattle>
  behind: {
    side: BattleSide
    deficit: number
    kills: number
    /** Holders at the banner, in all, for the rest of the session (after capturing it, when the side doesn't hold it); null when the time left wouldn't do with any number. */
    holdersNeeded: number | null
    /** How many of the side behind stand at the banner now, at least one: whom the minutes below are reckoned for. */
    holders: number
    /** Taking the banner from the enemy, then holding it with those: minutes in all, with the capture; null when the side behind holds it, or nobody does. */
    minutesRetaken: number | null
  } | null
} | null {
  const reading = readings.at(-1)
  if (!reading) return null
  const seen = reversalsSeen(readings)
  const observed = multiplierObserved(readings)
  const multiplier =
    observed !== null
      ? { value: observed, source: 'observed' as const }
      : { value: reversalMultiplier(seen.reversals), source: seen.complete ? ('inferred' as const) : ('assumed' as const) }
  const phase = tickPhaseOf(readings)
  const score = scoreNow(reading, multiplier.value, now, phase)
  const secondsLeft = secondsLeftNow(reading, now)
  const projected = projectBattle(siege, reading, multiplier.value, now, undefined, phase)
  const pace = killPaceObserved(readings, multiplier.value)
  const paced = pace && (pace.attacker > 0 || pace.defender > 0) ? projectBattle(siege, reading, multiplier.value, now, pace, phase) : null
  let behind: NonNullable<ReturnType<typeof assessBattle>>['behind'] = null
  if (projected && projected.balance !== null && projected.balance !== 0 && secondsLeft !== null) {
    const side: BattleSide = projected.balance > 0 ? 'defenders' : 'attackers'
    // The whole of the margin to come level, past the cap too: what's over it must be made up first, for nothing.
    const deficit = Math.abs(projected.balance) + projected.overCap
    const holds = reading.banner.side === side
    const enemyHolds = reading.banner.side !== null && !holds
    // A side that doesn't hold the banner earns nothing from it until it has captured it: the capture's minutes come off.
    const earning = holds ? secondsLeft : secondsLeft - RULES.captureMinutes * 60
    const ticks = Math.floor(Math.max(0, earning) / RULES.tickSeconds)
    // Holding on at the rate the banner earns now, or, taken from the enemy, at the bonus that brings.
    const rateIfHeld = holds ? multiplier.value : enemyHolds ? reversalMultiplier(seen.reversals + 1) : multiplier.value
    const perHolder = RULES.pointsPerHolder * rateIfHeld * ticks
    const holdersNeeded = perHolder > 0 ? Math.ceil(deficit / perHolder) : null
    const present = Math.max(1, holders[side])
    const turn = toTurnAround(deficit, present, reversalMultiplier(seen.reversals + 1))
    behind = {
      side,
      deficit,
      kills: Math.ceil(deficit / RULES.killPoints),
      holdersNeeded,
      holders: present,
      minutesRetaken: enemyHolds && turn ? turn.minutesRetaken : null,
    }
  }
  return { reading, multiplier, reversals: seen.reversals, score, secondsLeft, projected, pace, paced, behind, phase }
}

/** Where a player stands to a siege, by their town's and nation's part in it. */
export type PlayerSide = BattleSide | 'other'

/** The towns a player is a resident of, by their name; the map's names can differ in case. */
export function townOfName(name: string, towns: Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>[]) {
  const wanted = name.toLowerCase()
  return towns.find((town) => town.people.some((person) => person.toLowerCase() === wanted)) ?? null
}

/**
 * A player's side in a siege, and whether as an ally, SiegeWar's way
 * (SiegeSide.getPlayerSiegeSide): the besieged town's residents and its
 * nation's defend, checked first; the attacker's nation (or town, for a
 * nationless attacker) attacks. With `allied` (src/maps/alliances.ts),
 * one whose nation is allied with the besieged town's nation defends, and
 * one allied with the attacker attacks; a town of no nation has no allies.
 * Anyone else is 'other': an ally not known, or nobody's.
 */
export function allegianceOf(
  town: Pick<WorldTown, 'name' | 'nation'> | null,
  siege: Pick<Siege, 'attacker' | 'defender' | 'town' | 'townNation'>,
  allied?: Allied,
): { side: PlayerSide; ally: boolean } {
  if (!town) return { side: 'other', ally: false }
  const named = (a: string | null | undefined, b: string | null | undefined) => sameNation(a, b)
  if (named(town.name, siege.town) || named(town.nation, siege.townNation) || named(town.nation, siege.defender) || named(town.name, siege.defender)) {
    return { side: 'defenders', ally: false }
  }
  if (named(town.nation, siege.attacker) || named(town.name, siege.attacker)) return { side: 'attackers', ally: false }
  const side = allied ? allySide(town.nation, siege, allied) : null
  return side ? { side, ally: true } : { side: 'other', ally: false }
}

/** A player's side in a siege (allegianceOf), without whether as an ally. */
export const sideOf = (
  town: Pick<WorldTown, 'name' | 'nation'> | null,
  siege: Pick<Siege, 'attacker' | 'defender' | 'town' | 'townNation'>,
  allied?: Allied,
): PlayerSide => allegianceOf(town, siege, allied).side

const distance = ([ax, az]: Point, [bx, bz]: Point) => Math.hypot(ax - bx, az - bz)

/** The towns' claims that reach within `within` blocks of a banner: the few a banner zone could overlap. */
export function claimsNear(banner: Point, towns: (Pick<WorldTown, 'name'> & { claims?: Outline[] })[], within = RULES.bannerRadius + 16): Outline[] {
  const [bx, bz] = banner
  const near: Outline[] = []
  for (const town of towns)
    for (const outline of town.claims ?? []) {
      if (!outline.x.length) continue
      const minX = Math.min(...outline.x)
      const maxX = Math.max(...outline.x)
      const minZ = Math.min(...outline.z)
      const maxZ = Math.max(...outline.z)
      if (maxX >= bx - within && minX <= bx + within && maxZ >= bz - within && minZ <= bz + within) near.push(outline)
    }
  return near
}

/**
 * In the banner control zone, as far as the map can tell: within
 * RULES.bannerRadius of the banner across the ground, and not on a town's
 * claims (`claims`, claimsNear), where SiegeWar doesn't count a capture.
 * The map gives no banner height, so the zone's limit up and down isn't
 * checked.
 */
export const inBannerZone = (at: Point, banner: Point, claims: Outline[] = []): boolean =>
  distance(at, banner) <= RULES.bannerRadius && !(claims.length && inOutlines(at, claims))

/** A player at a siege: who, which side, how far from the banner, and whether in its zones. */
export type AtSiege = {
  player: LivePlayer
  side: PlayerSide
  /** On their side as an ally of its nation, by a known alliance. */
  ally: boolean
  /** Blocks from the banner, across the ground. */
  distance: number
  /** Within the banner control zone, as far as the ground goes (the map gives no banner height). */
  atBanner: boolean
  inZone: boolean
}

/** Everyone online near a siege, nearest first, with the counts of each side at the banner and in the siege zone. */
export function playersAtSiege(
  siege: Siege,
  players: LivePlayer[],
  towns: (Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'> & { claims?: Outline[] })[],
  within = RULES.siegeZoneRadius * 2,
  allied?: Allied,
) {
  const near: AtSiege[] = []
  const claims = claimsNear(siege.at, towns)
  for (const player of players) {
    const far = distance([player.x, player.z], siege.at)
    if (far > within) continue
    near.push({
      player,
      ...allegianceOf(townOfName(player.name, towns), siege, allied),
      distance: Math.round(far),
      atBanner: inBannerZone([player.x, player.z], siege.at, claims),
      inZone: far <= RULES.siegeZoneRadius,
    })
  }
  near.sort((a, b) => a.distance - b.distance)
  const count = (where: 'atBanner' | 'inZone') => ({
    attackers: near.filter((entry) => entry[where] && entry.side === 'attackers').length,
    defenders: near.filter((entry) => entry[where] && entry.side === 'defenders').length,
    other: near.filter((entry) => entry[where] && entry.side === 'other').length,
  })
  return { near, atBanner: count('atBanner'), inZone: count('inZone') }
}

/**
 * A side's people at another siege: of everyone on `side` of `siege` (its
 * residents and, by `allied`, its allies), those standing in the siege
 * zone of `other` now, nearest its banner first, and how many of them
 * are allies. For the war view's note of the sieges a side shares its
 * fighters with (src/maps/alliances.ts → sharedSieges).
 */
export function sideAtSiege(
  siege: Pick<Siege, 'attacker' | 'defender' | 'town' | 'townNation'>,
  side: BattleSide,
  other: Pick<Siege, 'at'>,
  players: LivePlayer[],
  towns: Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>[],
  allied?: Allied,
): { names: string[]; allies: number } {
  const there: { name: string; ally: boolean; far: number }[] = []
  for (const player of players) {
    const far = distance([player.x, player.z], other.at)
    if (far > RULES.siegeZoneRadius) continue
    const part = allegianceOf(townOfName(player.name, towns), siege, allied)
    if (part.side === side) there.push({ name: player.name, ally: part.ally, far })
  }
  there.sort((a, b) => a.far - b.far)
  return { names: there.map((one) => one.name), allies: there.filter((one) => one.ally).length }
}

/**
 * How long a player is from the banner, in seconds: sprinting there from
 * where they stand, or teleporting to their own town's spawn first when
 * that's nearer and outside the siege zone (where nobody may teleport).
 * The teleport's warm-up is left out; the server doesn't say it.
 */
export function returnEstimate(
  from: Point,
  banner: Point,
  home: Point | null,
): { seconds: number; via: 'run' | 'spawn'; blocks: number } {
  const direct = distance(from, banner)
  const fromHome = home ? distance(home, banner) : Infinity
  if (home && fromHome < direct && fromHome > RULES.siegeZoneRadius) {
    return { seconds: Math.round(fromHome / SPRINT_BLOCKS_PER_S), via: 'spawn', blocks: Math.round(fromHome) }
  }
  return { seconds: Math.round(direct / SPRINT_BLOCKS_PER_S), via: 'run', blocks: Math.round(direct) }
}

/** The server's hour and minute at `at`, in its time zone. */
function serverClock(at: number): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RULES.serverTimeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at))
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return { hour: value('hour'), minute: value('minute') }
}

/**
 * The battle session on now, or the next: when it starts and ends, in ms
 * since the epoch. The server's time zone keeps whole hours from UTC, so
 * its sessions start on UTC hours.
 */
export function sessionClock(now: number): { on: boolean; start: number; end: number } {
  const hour = 3_600_000
  const base = Math.floor(now / hour) * hour
  for (let step = -1; step <= 25; step++) {
    const start = base + step * hour
    const { hour: local, minute } = serverClock(start)
    if (minute !== 0 || !(RULES.sessionHours as readonly number[]).includes(local)) continue
    const end = start + RULES.sessionMinutes * 60_000
    if (end <= now) continue
    return { on: start <= now, start, end }
  }
  return { on: false, start: base + 6 * hour, end: base + 7 * hour }
}

/**
 * Captures of a siege's banner as SiegeWar counts them (its code, and seen
 * in a battle), run on the live positions: at each of the server's checks
 * a player of either side in the banner zone, alive, who isn't capturing
 * and doesn't hold the banner starts; one who has left the zone, or the
 * map, stops; and one still in it on the check five minutes after the one
 * that started them completes, so their side takes the banner (they its
 * only holder; the enemy's holders lose it) or they join its holders.
 * Anyone of neither side is the server's to remove, and captures nothing.
 * The zone is RULES.bannerRadius across the ground, off any town's claims
 * (`claims`, claimsNear); the holders are those seen completing a capture
 * since the view opened.
 */
export type Captures = {
  /** When the last live reading was taken in, and who of either side stood in the banner zone in it. */
  at: number
  zone: Map<string, BattleSide>
  /** Captures under way: who, of which side, from which check. */
  under: Map<string, { side: BattleSide; since: number }>
  /** The banner's holders as seen capturing, and their side. */
  holders: { name: string; side: BattleSide }[]
  holdersSide: BattleSide | null
}

export const NO_CAPTURES: Captures = { at: 0, zone: new Map(), under: new Map(), holders: [], holdersSide: null }

/** A capture completes on the check this long after the one that started it; a second's grace for the server's own timing. */
const CAPTURE_MS = RULES.captureMinutes * 60_000 - 1000

/**
 * When a capture begun on the check at `since` completes: on the check five
 * minutes on, or, as SiegeWar counts whole seconds and its checks drift by
 * a fraction, one check later (seen in a battle: one capture of each).
 */
export const captureEndsAt = (since: number, phase: number | null): number =>
  phase === null ? since + RULES.captureMinutes * 60_000 : checkAtOrAfter(since + CAPTURE_MS, phase)

export function stepCaptures(
  captures: Captures,
  reading: { at: number; players: Pick<LivePlayer, 'name' | 'x' | 'z' | 'health'>[] },
  banner: Point,
  phase: number | null,
  sideOfName: (name: string) => PlayerSide | null,
  claims: Outline[] = [],
): Captures {
  // A gap of more than two checks (the tab asleep, the feed down): what happened in it is unknown, so no capture runs on through it.
  const gap = captures.at > 0 && reading.at - captures.at > 2 * TICK_MS
  const from = gap || captures.at === 0 ? reading.at - TICK_MS : captures.at
  const checks: number[] = []
  if (phase === null) checks.push(reading.at)
  else for (let check = checkAtOrAfter(from + 1, phase); check <= reading.at; check += TICK_MS) checks.push(check)
  const base = gap ? { ...captures, under: new Map<string, { side: BattleSide; since: number }>() } : captures
  const inZone = new Map<string, BattleSide>()
  for (const player of reading.players) {
    if (player.health === 0 || !inBannerZone([player.x, player.z], banner, claims)) continue
    const side = sideOfName(player.name)
    if (side === 'attackers' || side === 'defenders') inZone.set(player.name, side)
  }
  if (!checks.length) return { ...base, at: reading.at, zone: inZone }

  const under = new Map(base.under)
  let holders = base.holders
  let holdersSide = base.holdersSide
  for (const check of checks) {
    // Who stood in the zone at the check, as far as the readings either side of it tell: the checks' moment is known to a
    // second or two (tickPhaseOf), so a player in the zone in either counts as in it; one out of it in both is out.
    const zone = !gap && base.at > 0 ? new Map([...inZone, ...base.zone]) : inZone
    for (const name of [...under.keys()]) if (!zone.has(name)) under.delete(name)
    for (const [name, side] of zone) {
      if (holdersSide === side && holders.some((holder) => holder.name === name)) continue
      const capture = under.get(name)
      if (!capture) {
        under.set(name, { side, since: check })
        continue
      }
      if (check - capture.since < CAPTURE_MS) continue
      under.delete(name)
      if (holdersSide === side) holders = [...holders, { name, side }]
      else [holders, holdersSide] = [[{ name, side }], side]
    }
  }
  return { at: reading.at, zone: inZone, under, holders, holdersSide }
}
