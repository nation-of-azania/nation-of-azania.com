import { RULES, type BattleSide } from './battle'

/**
 * What the battle tracker (src/lib/battleTracker.ts) keeps of a battle, and
 * what it makes of it: for each player who came near the banner, how long
 * they were in the siege zone and in the banner zone, every time they
 * stepped into the banner zone and how that ended, and their deaths.
 *
 * The tracker reads the map's live feed every few seconds through a battle
 * session. A reading is a moment: who was where, with what health. It keeps
 * the moments of each player within KEEP_WITHIN blocks of the banner, and
 * one more as they go further (`far`), so that leaving, a teleport and a
 * respawn can be told apart. SiegeWar itself looks only every 20 seconds
 * (RULES.tickSeconds), so a step out of the banner zone shorter than that
 * may never have counted, and doesn't end a stay here either.
 *
 * Pure, for the server that records and for any page that reads.
 */

/** Players this near the banner are kept: the siege zone and a margin, to see them come and go. */
export const KEEP_WITHIN = RULES.siegeZoneRadius + 50
/** Stored for a reading where the player had gone further than KEEP_WITHIN. */
export const FAR = 255

export const FIGHT = {
  /** A step out of the banner zone shorter than one of SiegeWar's checks may not have counted: the stay goes on. */
  graceSeconds: RULES.tickSeconds,
  /** Readings further apart than this leave a gap: what happened in between isn't known. */
  gapSeconds: 30,
  /** Faster than this between two readings is no run or ride: a teleport or a respawn. */
  jumpBlocksPerSecond: 12,
  /** A respawn is told from its readings at most this far apart. */
  respawnWithinSeconds: 8,
  /** A side's points rising by a kill's worth this soon after a death confirm it. */
  confirmWithinSeconds: 30,
  /** In the siege zone at least this long counts as having fought. */
  attendedSeconds: 60,
} as const

/** One player at one reading: seconds since the battle began, blocks from the banner (FAR beyond KEEP_WITHIN), health and armour. */
export type Moment = { t: number; d: number; h: number | null; a: number | null }

/** The siege's marker at a reading: who holds the banner, and the session's points. */
export type Mark = { t: number; banner: BattleSide | null; holders: number; attacker: number; defender: number }

export type Outcome = 'held' | 'died' | 'left' | 'cut'
/**
 * A stay in the banner zone, from the reading that first found the player
 * there to the last: a try to take the banner, or, when their side held it
 * already (`ours`), to become one more of its holders. Either takes five
 * minutes there, and either way it's held, or ended by a death, by walking
 * out, or by the readings (the session's end, a gap).
 */
export type Stay = {
  from: number
  to: number
  outcome: Outcome
  ours: boolean
  /**
   * They were one of the banner's holders already (they'd taken it and
   * their side still held it): standing there, not trying anything; left
   * out of their tries.
   */
  holder?: boolean
}

/** Their tries at the banner: stays that weren't a holder's. */
export const triesOf = (stays: Stay[]): Stay[] => stays.filter((stay) => !stay.holder)
export type Death = { at: number; confirmed: boolean }
export type FighterSide = 'attackers' | 'defenders' | 'other'

export type Fighter = {
  name: string
  side: FighterSide
  /**
   * Their side was told by their play, not where they live: one who lives
   * with neither side, whose stay at the banner turned it, or whose death
   * the other side scored (an ally, a mercenary).
   */
  ally?: boolean
  /** Seconds in the siege zone and in the banner zone, between readings close enough to know. */
  zone: number
  banner: number
  /** When they were first and last seen in the siege zone. */
  first: number | null
  last: number | null
  /** Their stays in the banner zone. */
  stays: Stay[]
  deaths: Death[]
}

const inZone = (moment: Moment | undefined) => Boolean(moment && moment.d <= RULES.siegeZoneRadius)
const atBanner = (moment: Moment | undefined) => Boolean(moment && moment.d <= RULES.bannerRadius)

/** Who held the banner at second `t`, by the latest mark at or before it. */
export function bannerAt(marks: Mark[], t: number): BattleSide | null {
  let side: BattleSide | null = null
  for (const mark of marks) {
    if (mark.t > t) break
    side = mark.banner
  }
  return side
}

const opposite = (side: FighterSide): BattleSide | null => (side === 'attackers' ? 'defenders' : side === 'defenders' ? 'attackers' : null)

/**
 * A player's deaths, from their moments: a reading at no health, or a
 * jump no one runs (FIGHT.jumpBlocksPerSecond) that lands them at full
 * health from less. Only in or from the siege zone, where deaths count.
 * Confirmed when the other side's points rose by a kill's worth soon after.
 */
export function deathsOf(moments: Moment[], marks: Mark[], side: FighterSide): Death[] {
  const deaths: Death[] = []
  for (let i = 0; i < moments.length; i++) {
    const before = moments[i]
    const after = moments[i + 1]
    if (!inZone(before)) continue
    let at: number | null = null
    if (before.h === 0) at = before.t
    else if (after && after.t - before.t <= FIGHT.respawnWithinSeconds && before.h !== null && before.h < 20 && after.h === 20) {
      const speed = Math.abs(after.d - before.d) / Math.max(1, after.t - before.t)
      if (speed >= FIGHT.jumpBlocksPerSecond || after.d === FAR) at = before.t
    }
    if (at === null) continue
    // A reading at no health and the respawn right after are one death.
    if (deaths.length && at - deaths[deaths.length - 1].at <= FIGHT.respawnWithinSeconds) continue
    deaths.push({ at, confirmed: killConfirmed(marks, side, at) })
  }
  return deaths
}

/** The sides that gained a kill's worth of points soon after `at`. */
function killGainers(marks: Mark[], at: number): Set<BattleSide> {
  const gainers = new Set<BattleSide>()
  const before = [...marks].reverse().find((mark) => mark.t <= at)
  if (!before) return gainers
  for (const mark of marks) {
    if (mark.t <= at || mark.t > at + FIGHT.confirmWithinSeconds) continue
    if (mark.attacker - before.attacker >= RULES.killPoints) gainers.add('attackers')
    if (mark.defender - before.defender >= RULES.killPoints) gainers.add('defenders')
  }
  return gainers
}

/** Whether the side that didn't die (either, for one of neither side) gained a kill's worth of points soon after `at`. */
function killConfirmed(marks: Mark[], side: FighterSide, at: number): boolean {
  const gainers = killGainers(marks, at)
  const gainer = opposite(side)
  return gainer ? gainers.has(gainer) : gainers.size > 0
}

/**
 * The side a player's play shows them on: a stay at the banner long enough
 * to take it, as the banner turned to a side or its holders grew by one
 * (within a check or two of its end); or a death the other side alone
 * scored. Null when nothing shows it, or the signs disagree.
 */
export function sideShown(stays: Pick<Stay, 'from' | 'to'>[], deaths: Pick<Death, 'at'>[], marks: Mark[]): BattleSide | null {
  const shown = new Set<BattleSide>()
  for (const stay of stays) {
    if (stay.to - stay.from < RULES.captureMinutes * 60 - RULES.tickSeconds) continue
    for (let i = 1; i < marks.length; i++) {
      const [before, mark] = [marks[i - 1], marks[i]]
      if (mark.t < stay.from || mark.t > stay.to + 2 * RULES.tickSeconds || !mark.banner) continue
      if (before.banner !== mark.banner || mark.holders > before.holders) shown.add(mark.banner)
    }
  }
  for (const death of deaths) {
    const gainers = killGainers(marks, death.at)
    if (gainers.size === 1) shown.add(opposite([...gainers][0])!)
  }
  return shown.size === 1 ? [...shown][0] : null
}

/**
 * A player's battle, from every reading's time (`readings`, so a reading
 * that didn't find them says they weren't there), their moments, and the
 * marks.
 */
export function fighterOf(name: string, side: FighterSide, readings: number[], moments: Moment[], marks: Mark[]): Fighter {
  const fighter = fighterAs(name, side, readings, moments, marks)
  if (side !== 'other') return fighter
  // One who lives with neither side: told by their play, if it shows.
  const shown = sideShown(fighter.stays, fighter.deaths, marks)
  return shown ? { ...fighterAs(name, shown, readings, moments, marks), ally: true } : fighter
}

function fighterAs(name: string, side: FighterSide, readings: number[], moments: Moment[], marks: Mark[]): Fighter {
  const at = new Map(moments.map((moment) => [moment.t, moment]))
  const deaths = deathsOf(moments, marks, side)
  const ours: BattleSide | null = side === 'other' ? null : side
  let zone = 0
  let banner = 0
  let first: number | null = null
  let last: number | null = null
  const stays: Stay[] = []
  let open: { from: number; lastIn: number; ours: boolean; holder: boolean } | null = null
  // One of the banner's holders, by a stay of theirs that took it or joined its holders: until their side loses the
  // banner, wherever they go and even if they die (SiegeWar's source; docs/war-rules.md → Banner control).
  let holding = false

  const close = (end: number, cut: boolean) => {
    if (!open) return
    const stayed = open.lastIn - open.from
    // Held: long enough to take it (the readings' first and last in it are up to a check inside SiegeWar's five
    // minutes), or the banner became their side's while they were in it.
    const took =
      stayed >= RULES.captureMinutes * 60 - RULES.tickSeconds ||
      (ours !== null && !open.ours && bannerAt(marks, open.from) !== ours && bannerAt(marks, open.lastIn + RULES.tickSeconds) === ours)
    const died = deaths.some((death) => death.at >= open!.from && death.at <= end + FIGHT.respawnWithinSeconds)
    const outcome: Outcome = took ? 'held' : died ? 'died' : cut ? 'cut' : 'left'
    stays.push({ from: open.from, to: open.lastIn, outcome, ours: open.ours, ...(open.holder ? { holder: true } : {}) })
    if (took && ours !== null) holding = true
    open = null
  }

  for (let i = 0; i < readings.length; i++) {
    const t = readings[i]
    const next = readings[i + 1]
    const moment = at.get(t)
    const gap = next === undefined || next - t > FIGHT.gapSeconds
    if (holding && bannerAt(marks, t) !== ours) holding = false
    if (inZone(moment)) {
      first ??= t
      last = t
      if (!gap) zone += next - t
    }
    if (atBanner(moment)) {
      if (!gap) banner += next - t
      if (!open) open = { from: t, lastIn: t, ours: ours !== null && bannerAt(marks, t) === ours, holder: holding }
      else open.lastIn = t
    } else if (open && t - open.lastIn > FIGHT.graceSeconds) {
      close(t, false)
    }
    // A gap in the readings: what came of a stay across it isn't known.
    if (open && gap) close(t, true)
  }
  close(readings[readings.length - 1] ?? 0, true)
  return { name, side, zone, banner, first, last, stays, deaths }
}

/** Fought: in the siege zone long enough to count. */
export const attended = (fighter: Pick<Fighter, 'zone'>): boolean => fighter.zone >= FIGHT.attendedSeconds

/** How much of a battle session the readings cover, 0–1: a gap's time isn't covered. */
export function coverageOf(readings: number[], sessionSeconds = RULES.sessionMinutes * 60): number {
  let covered = 0
  for (let i = 0; i + 1 < readings.length; i++) {
    const step = readings[i + 1] - readings[i]
    if (step <= FIGHT.gapSeconds) covered += step
  }
  return Math.min(1, covered / sessionSeconds)
}

// Compact storage: a player's moments as one base64 string of 5 bytes each (seconds as 2, distance, health ×2, armour),
// some 8 KB for an hour in the zone at a reading every three seconds.

const NONE = 255

export function packMoments(moments: Moment[]): string {
  const bytes = new Uint8Array(moments.length * 5)
  moments.forEach((moment, i) => {
    const t = Math.max(0, Math.min(65535, Math.round(moment.t)))
    bytes[i * 5] = t >> 8
    bytes[i * 5 + 1] = t & 255
    bytes[i * 5 + 2] = Math.max(0, Math.min(FAR, Math.round(moment.d)))
    bytes[i * 5 + 3] = moment.h === null ? NONE : Math.max(0, Math.min(40, Math.round(moment.h * 2)))
    bytes[i * 5 + 4] = moment.a === null ? NONE : Math.max(0, Math.min(40, Math.round(moment.a)))
  })
  return toBase64(bytes)
}

export function unpackMoments(packed: string): Moment[] {
  const bytes = fromBase64(packed)
  const moments: Moment[] = []
  for (let i = 0; i + 4 < bytes.length; i += 5) {
    moments.push({
      t: (bytes[i] << 8) | bytes[i + 1],
      d: bytes[i + 2],
      h: bytes[i + 3] === NONE ? null : bytes[i + 3] / 2,
      a: bytes[i + 4] === NONE ? null : bytes[i + 4],
    })
  }
  return moments
}

/** Reading times as one base64 string of 2 bytes each. */
export function packTimes(times: number[]): string {
  const bytes = new Uint8Array(times.length * 2)
  times.forEach((time, i) => {
    const t = Math.max(0, Math.min(65535, Math.round(time)))
    bytes[i * 2] = t >> 8
    bytes[i * 2 + 1] = t & 255
  })
  return toBase64(bytes)
}

export function unpackTimes(packed: string): number[] {
  const bytes = fromBase64(packed)
  const times: number[] = []
  for (let i = 0; i + 1 < bytes.length; i += 2) times.push((bytes[i] << 8) | bytes[i + 1])
  return times
}

/** Two sets of moments as one, by time, the first's kept where both have one. */
export function mergeMoments(a: Moment[], b: Moment[]): Moment[] {
  const byTime = new Map<number, Moment>()
  for (const moment of [...b, ...a]) byTime.set(moment.t, moment)
  return [...byTime.values()].sort((x, y) => x.t - y.t)
}

export const mergeTimes = (a: number[], b: number[]): number[] => [...new Set([...a, ...b])].sort((x, y) => x - y)

function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

function fromBase64(packed: string): Uint8Array {
  try {
    const text = atob(packed)
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
    return bytes
  } catch {
    return new Uint8Array()
  }
}
