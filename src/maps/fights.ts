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
  /** The readings began, or came back after a gap, with them already there: they may have stepped in earlier. */
  early?: boolean
}

/** Their tries at the banner: stays that weren't a holder's. */
export const triesOf = (stays: Stay[]): Stay[] => stays.filter((stay) => !stay.holder)
export type Death = { at: number; confirmed: boolean }
export type FighterSide = 'attackers' | 'defenders' | 'other'

/**
 * How an ally's side was told: by their play (`banner`, a stay of theirs that
 * took the banner or joined its holders; `kill`, a death of theirs the other
 * side alone scored), or by an alliance known beforehand (`alliance`,
 * src/maps/alliances.ts) when their play showed nothing.
 */
export type ToldBy = 'banner' | 'kill' | 'alliance'

export type Fighter = {
  name: string
  side: FighterSide
  /**
   * They fought for a side they don't live with: an ally of its nation
   * (SiegeWar counts a mutual ally's soldiers for either side), told by
   * their play or by a known alliance (`by`).
   */
  ally?: boolean
  by?: ToldBy
  /** The nation they lived in at the battle, as the map had it; null for a town without one; absent in a battle saved before it was kept. */
  nation?: string | null
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

/** A capture completes this long after it begins: five minutes, from a check before to a couple after (and the marker's rewriting). */
const CAPTURE_FROM = RULES.captureMinutes * 60 - RULES.tickSeconds
const CAPTURE_TO = RULES.captureMinutes * 60 + 3 * RULES.tickSeconds

/**
 * The side whose capture the marks show completing as a stay in the banner
 * zone would complete one: the banner turned that side's, or its holders
 * grew, five minutes after the player stepped in, or after the banner last
 * changed hands while they stayed (a holder whose side loses it starts
 * again); by the time they left, give or take a check. `side` narrows it to
 * one side (null: either). A stay the readings may have caught late
 * (`early`) could have begun earlier, so any completion up to five minutes
 * after it was first seen counts. Null when the marks show none: they left
 * too soon, or weren't counted (on a town's claims, flying, too high or
 * low, of neither side).
 */
export function captureCompleted(marks: Mark[], side: BattleSide | null, stay: Pick<Stay, 'from' | 'to' | 'early'>): BattleSide | null {
  const starts = [stay.from]
  for (let i = 1; i < marks.length; i++) if (marks[i].t > stay.from && marks[i].t <= stay.to && marks[i].banner !== marks[i - 1].banner) starts.push(marks[i].t)
  for (let i = 1; i < marks.length; i++) {
    const [before, mark] = [marks[i - 1], marks[i]]
    if (!mark.banner || (side && mark.banner !== side)) continue
    if (mark.t > stay.to + 2 * RULES.tickSeconds || mark.t < stay.from) continue
    if (before.banner === mark.banner && mark.holders <= before.holders) continue
    const timely = starts.some((start, index) => {
      const after = mark.t - start
      return after <= CAPTURE_TO && (after >= CAPTURE_FROM || (index === 0 && stay.early))
    })
    if (timely) return mark.banner
  }
  return null
}

const opposite = (side: FighterSide): BattleSide | null => (side === 'attackers' ? 'defenders' : side === 'defenders' ? 'attackers' : null)

/**
 * A player's deaths, from their moments: a reading at no health, or a
 * jump no one runs (FIGHT.jumpBlocksPerSecond) that lands them at full
 * health from less, or from full health when the other side scored a
 * kill just then. Only in or from the siege zone, where deaths count.
 * Confirmed when the other side's points rose by a kill's worth soon after.
 */
export function deathsOf(moments: Moment[], marks: Mark[], side: FighterSide): Death[] {
  const deaths: Death[] = []
  // Deaths from full health, struck down between two readings: told only by a kill the other side scored, kept for last.
  const blows: number[] = []
  for (let i = 0; i < moments.length; i++) {
    const before = moments[i]
    const after = moments[i + 1]
    if (!inZone(before)) continue
    let at: number | null = null
    if (before.h === 0) at = before.t
    else if (after && after.t - before.t <= FIGHT.respawnWithinSeconds && before.h !== null && after.h === 20) {
      const speed = Math.abs(after.d - before.d) / Math.max(1, after.t - before.t)
      const jumped = speed >= FIGHT.jumpBlocksPerSecond || after.d === FAR
      if (jumped && before.h < 20) at = before.t
      // From full health a jump could be a teleport (a town's residents may go to their spawn by the banner): a death only
      // away from the banner, as a respawn is, and when the other side scored a kill just then. Seen at Pataliputra: a
      // defender struck down at the banner between two readings, respawning at the town's spawn a hundred blocks off.
      else if (jumped && side !== 'other' && after.d > before.d && killConfirmed(marks, side, before.t)) blows.push(before.t)
    }
    if (at === null) continue
    // A reading at no health and the respawn right after are one death.
    if (deaths.length && at - deaths[deaths.length - 1].at <= FIGHT.respawnWithinSeconds) continue
    deaths.push({ at, confirmed: killConfirmed(marks, side, at) })
  }
  // A blow whose kill another death of theirs explains (within the time a kill is confirmed in) was something else.
  for (const at of blows) {
    if (deaths.some((death) => Math.abs(death.at - at) <= FIGHT.confirmWithinSeconds)) continue
    deaths.push({ at, confirmed: true })
  }
  return deaths.sort((a, b) => a.at - b.at)
}

/**
 * The kills a side scored between two marks: what its points rose by
 * beyond what its holders earned at SiegeWar's checks in between (10 a
 * holder a check, a check every 20 seconds, the banner's holders as either
 * mark has them). A rise the checks alone explain is no kill, so a side
 * holding the banner with many doesn't seem to kill at every check; a
 * kill's 100 that a check's earnings could equal (ten holders) is taken for
 * the check.
 */
export function killsBetween(before: Mark, after: Mark, side: BattleSide): number {
  const rise = side === 'attackers' ? after.attacker - before.attacker : after.defender - before.defender
  if (rise < RULES.killPoints) return 0
  const checks = Math.max(1, Math.ceil((after.t - before.t) / RULES.tickSeconds))
  const holders = new Set([before.banner === side ? before.holders : 0, after.banner === side ? after.holders : 0])
  const earned = new Set<number>([0])
  for (const count of holders) for (let k = 1; k <= checks; k++) earned.add(k * count * RULES.pointsPerHolder)
  if (earned.has(rise)) return 0
  let kills = 0
  for (const checked of earned) {
    const rest = rise - checked
    if (rest >= RULES.killPoints && rest % RULES.killPoints === 0) kills = Math.max(kills, rest / RULES.killPoints)
  }
  // Not a whole number of kills over any count of checks (a reading caught mid-change): what's left over the most the checks could have earned.
  return kills || Math.max(0, Math.floor((rise - Math.max(...earned)) / RULES.killPoints))
}

/** The sides that scored a kill soon after `at`: from the last mark before it to FIGHT.confirmWithinSeconds after. */
function killGainers(marks: Mark[], at: number): Set<BattleSide> {
  const gainers = new Set<BattleSide>()
  let from = -1
  for (let i = 0; i < marks.length; i++) if (marks[i].t <= at) from = i
  if (from < 0) return gainers
  for (let i = from; i + 1 < marks.length && marks[i + 1].t <= at + FIGHT.confirmWithinSeconds; i++) {
    for (const side of ['attackers', 'defenders'] as const) if (killsBetween(marks[i], marks[i + 1], side) > 0) gainers.add(side)
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
 * The side a player's play shows them on, and what showed it: a stay at the
 * banner long enough to take it, as the banner turned to a side or its
 * holders grew by one (within a check or two of its end); or else a death
 * the other side alone scored. Null when nothing shows it, or the signs
 * disagree.
 */
export function sideShownBy(stays: Pick<Stay, 'from' | 'to' | 'early'>[], deaths: Pick<Death, 'at'>[], marks: Mark[]): { side: BattleSide; by: 'banner' | 'kill' } | null {
  const byBanner = new Set<BattleSide>()
  const byKill = new Set<BattleSide>()
  // A capture that completed as theirs would have (captureCompleted): one that merely happened while they stood there, someone
  // else's, says nothing of them.
  for (const stay of stays) {
    const side = captureCompleted(marks, null, stay)
    if (side) byBanner.add(side)
  }
  for (const death of deaths) {
    const gainers = killGainers(marks, death.at)
    if (gainers.size === 1) byKill.add(opposite([...gainers][0])!)
  }
  const shown = new Set([...byBanner, ...byKill])
  if (shown.size !== 1) return null
  return { side: [...shown][0], by: byBanner.size ? 'banner' : 'kill' }
}

/** The side a player's play shows them on (sideShownBy), without what showed it. */
export const sideShown = (stays: Pick<Stay, 'from' | 'to' | 'early'>[], deaths: Pick<Death, 'at'>[], marks: Mark[]): BattleSide | null =>
  sideShownBy(stays, deaths, marks)?.side ?? null

/**
 * Who a player fought for, as far as is known before their play: their own
 * side (`side`, where they live), or, for one who lives with neither, the
 * side a known alliance puts them on (`allied`, src/maps/alliances.ts), and
 * their nation.
 */
export type Allegiance = { side: FighterSide; allied?: BattleSide | null; nation?: string | null }

/**
 * A player's battle, from every reading's time (`readings`, so a reading
 * that didn't find them says they weren't there), their moments, and the
 * marks. One who lives with neither side is told by their play when it
 * shows a side, or else by a known alliance; their play wins where the two
 * disagree, since SiegeWar scored it.
 */
export function fighterOf(name: string, allegiance: FighterSide | Allegiance, readings: number[], moments: Moment[], marks: Mark[]): Fighter {
  const { side, allied = null, nation } = typeof allegiance === 'string' ? { side: allegiance } : allegiance
  const kept = nation === undefined ? {} : { nation }
  const fighter = { ...fighterAs(name, side, readings, moments, marks), ...kept }
  if (side !== 'other') return fighter
  const shown = sideShownBy(fighter.stays, fighter.deaths, marks)
  if (shown) return { ...fighterAs(name, shown.side, readings, moments, marks), ally: true, by: shown.by, ...kept }
  if (allied) return { ...fighterAs(name, allied, readings, moments, marks), ally: true, by: 'alliance', ...kept }
  return fighter
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
  let open: { from: number; lastIn: number; ours: boolean; holder: boolean; early: boolean } | null = null
  // One of the banner's holders, by a stay of theirs that took it or joined its holders: until their side loses the
  // banner, wherever they go and even if they die (SiegeWar's source; docs/war-rules.md → Banner control).
  let holding = false

  const close = (end: number, cut: boolean) => {
    if (!open) return
    const stayed = open.lastIn - open.from
    // Held: their capture completed, as the marks show it when there are any (the banner turned their side's, or its
    // holders grew, five minutes after they stepped in: captureCompleted), so one who walks off a few seconds before
    // the completing check hasn't; without marks, long enough to (the readings' first and last in it are up to a check
    // inside SiegeWar's five minutes).
    const stay = { from: open.from, to: open.lastIn, early: open.early }
    const took = marks.length ? captureCompleted(marks, ours, stay) !== null : stayed >= RULES.captureMinutes * 60 - RULES.tickSeconds
    const died = deaths.some((death) => death.at >= open!.from && death.at <= end + FIGHT.respawnWithinSeconds)
    const outcome: Outcome = took ? 'held' : died ? 'died' : cut ? 'cut' : 'left'
    stays.push({ from: open.from, to: open.lastIn, outcome, ours: open.ours, ...(open.holder ? { holder: true } : {}), ...(open.early ? { early: true } : {}) })
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
      // Caught already there by the first reading, or the first after a gap: they may have stepped in earlier.
      const early = i === 0 || t - readings[i - 1] > FIGHT.gapSeconds
      if (!open) open = { from: t, lastIn: t, ours: ours !== null && bannerAt(marks, t) === ours, holder: holding, early }
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
// some 5 KB for an hour in the zone at a reading every five seconds.

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
