import { sameNation } from './abroad'
import type { Point } from './geo'
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
  /** Staying in the banner zone this long captures the banner. */
  captureMinutes: 5,
  /** Banner control earns this many points per holder every tick. */
  tickSeconds: 20,
  pointsPerHolder: 10,
  /** A death in the siege zone gives the other side this many. */
  killPoints: 100,
  /** The banner control zone: a town block around the banner, in the wild. */
  bannerRadius: 16,
  /** The siege zone: no teleporting in, deaths count. */
  siegeZoneRadius: 200,
  /** After a reversal, banner points are multiplied by the reversals × this. */
  reversalFactor: 3,
  /** The siege balance is held within ± this. */
  balanceCap: 20_000,
  /** A win by less than this is a close victory (half the plunder). */
  closeVictory: 3_500,
} as const

/** The rules above the server's rules don't give, taken from SiegeWar's defaults: said as estimates wherever they count. */
export const ASSUMED = ['bannerRadius', 'siegeZoneRadius', 'reversalFactor', 'balanceCap', 'serverTimeZone'] as const

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

/** Points a second the banner earns its side: holders × 10 every 20 s, times the reversal bonus. */
export const bannerRate = (holders: number, multiplier: number): number =>
  (holders * RULES.pointsPerHolder * multiplier) / RULES.tickSeconds

/** The reversal bonus after this many reversals: none before the first, then the reversals × 3. */
export const reversalMultiplier = (reversals: number): number => (reversals > 0 ? reversals * RULES.reversalFactor : 1)

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
 * The banner's multiplier as the points show it: between two readings with
 * the same side holding with the same holders, the points it gained over
 * what the holders alone earn at ×1. Kills only add points, so the largest
 * multiplier the gain covers is taken; null when no two readings say.
 */
export function multiplierObserved(readings: BattleReading[]): number | null {
  let best: number | null = null
  for (let index = 1; index < readings.length; index++) {
    const [before, after] = [readings[index - 1], readings[index]]
    const side = after.banner.side
    if (!side || before.banner.side !== side || before.banner.holders !== after.banner.holders) continue
    if (!before.points || !after.points) continue
    const ticks = Math.floor((after.at - before.at) / 1000 / RULES.tickSeconds)
    if (ticks < 2) continue
    const key = side === 'attackers' ? 'attacker' : 'defender'
    const gained = after.points[key] - before.points[key]
    const base = after.banner.holders * RULES.pointsPerHolder * ticks
    if (base <= 0 || gained < base) continue
    const candidates = [1, 3, 6, 9, 12, 15].filter((m) => m * base <= gained * 1.05)
    best = candidates.at(-1) ?? 1
  }
  return best
}

/** The score a reading leads to by `now`, the banner earning as it does; kills can't be foreseen. */
export function scoreNow(reading: BattleReading, multiplier: number, now: number): { attacker: number; defender: number } | null {
  if (!reading.points) return null
  const elapsed = Math.max(0, (now - reading.at) / 1000)
  const left = reading.secondsLeft
  const running = left === null ? 0 : Math.min(elapsed, left)
  const ticks = Math.floor(running / RULES.tickSeconds)
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
): { points: { attacker: number; defender: number }; balance: number | null; sessionsLeft: number | null } | null {
  const current = scoreNow(reading, multiplier, now)
  const left = secondsLeftNow(reading, now)
  if (!current || left === null) return null
  const ticks = Math.floor(left / RULES.tickSeconds)
  const banner = reading.banner.side ? reading.banner.holders * RULES.pointsPerHolder * multiplier * ticks : 0
  const minutes = left / 60
  const points = {
    attacker: Math.round(current.attacker + (reading.banner.side === 'attackers' ? banner : 0) + kills.attacker * minutes * RULES.killPoints),
    defender: Math.round(current.defender + (reading.banner.side === 'defenders' ? banner : 0) + kills.defender * minutes * RULES.killPoints),
  }
  const balance = siege.balance === null ? null : capped(siege.balance + points.attacker - points.defender)
  const sessionsLeft = siege.progress ? Math.max(0, siege.progress.of - siege.progress.done - 1) : null
  return { points, balance, sessionsLeft }
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

/** Where a player stands to a siege, by their town's and nation's part in it. */
export type PlayerSide = BattleSide | 'other'

/** The towns a player is a resident of, by their name; the map's names can differ in case. */
export function townOfName(name: string, towns: Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>[]) {
  const wanted = name.toLowerCase()
  return towns.find((town) => town.people.some((person) => person.toLowerCase() === wanted)) ?? null
}

/**
 * A player's side in a siege, by where they live: the attacker's nation (or
 * town, for a nationless attacker) attacks; the besieged town, and the
 * nation defending it, defend. Anyone else is 'other': an ally of either,
 * which the map doesn't show, or nobody's.
 */
export function sideOf(
  town: Pick<WorldTown, 'name' | 'nation'> | null,
  siege: Pick<Siege, 'attacker' | 'defender' | 'town' | 'townNation'>,
): PlayerSide {
  if (!town) return 'other'
  const named = (a: string | null | undefined, b: string | null | undefined) => sameNation(a, b)
  if (named(town.nation, siege.attacker) || named(town.name, siege.attacker)) return 'attackers'
  if (named(town.name, siege.town) || named(town.nation, siege.defender) || named(town.name, siege.defender) || named(town.nation, siege.townNation)) {
    return 'defenders'
  }
  return 'other'
}

const distance = ([ax, az]: Point, [bx, bz]: Point) => Math.hypot(ax - bx, az - bz)

/** A player at a siege: who, which side, how far from the banner, and whether in its zones. */
export type AtSiege = {
  player: LivePlayer
  side: PlayerSide
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
  towns: Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>[],
  within = RULES.siegeZoneRadius * 2,
) {
  const near: AtSiege[] = []
  for (const player of players) {
    const far = distance([player.x, player.z], siege.at)
    if (far > within) continue
    near.push({
      player,
      side: sideOf(townOfName(player.name, towns), siege),
      distance: Math.round(far),
      atBanner: far <= RULES.bannerRadius,
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
