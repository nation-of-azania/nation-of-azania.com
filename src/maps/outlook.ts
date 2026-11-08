import { RULES, checksBetween, scoreNow, secondsLeftNow, sessionClock, type BattleReading, type BattleSide } from './battle'
import { expectedAt, type FighterRecord } from './fighters'
import type { Siege } from './world'

/**
 * The war view's outlook on a battle and the siege it's part of: what each
 * side needs from now on, whether the side ahead could leave the banner
 * and still win, which points the balance cap makes count for nothing, and
 * how the sessions still to come are likely to go by who usually turns up
 * at their hours. Pure, for the sidebar.
 *
 * All of it takes the banner as SiegeWar scores it on Rulercraft (seen in
 * battles, docs/war-rules.md): 10 points a holder every 20-second check, no
 * bonus for taking it back, five minutes in the zone to take it (or to join
 * its holders), and holders keep it wherever they go until the enemy takes
 * it. Kills (100 each) can't be foreseen and are left out, but every
 * shortfall is also said in kills.
 */

const PER_CHECK = RULES.pointsPerHolder
const CAPTURE_CHECKS = (RULES.captureMinutes * 60) / RULES.tickSeconds
const SESSION_CHECKS = (RULES.sessionMinutes * 60) / RULES.tickSeconds
const capped = (balance: number) => Math.max(-RULES.balanceCap, Math.min(RULES.balanceCap, balance))
const other = (side: BattleSide): BattleSide => (side === 'attackers' ? 'defenders' : 'attackers')
const key = (side: BattleSide): 'attacker' | 'defender' => (side === 'attackers' ? 'attacker' : 'defender')

/** To finish this session ahead on points, or to have the siege balance on their side after it (to win the siege, in its last session). */
export type Target = 'session' | 'siege'

export type Need = {
  side: BattleSide
  target: Target
  /** They get there if the banner stays as it is (its holders keep earning, nobody dies). */
  already: boolean
  /** Points short of it, the banner staying as it is; 0 when already there. */
  short: number
  /** The same in kills. */
  kills: number
  /**
   * Holders at the banner for the rest of the session it takes: taking it
   * first when they don't hold it (five minutes, the enemy's holders
   * earning meanwhile), or joining their holders (five minutes each). 0
   * when already there; null when no number would do in the time left.
   */
  holders: number | null
  /** Whether that many is no more than they have online; null without a count. */
  enough: boolean | null
}

export type BattleOutlook = {
  /** Checks left in the session, and the points now. */
  checks: number
  points: { attacker: number; defender: number }
  /** This session's last, the siege decided at its end. */
  final: boolean
  needs: Record<Target, Record<BattleSide, Need>>
  /**
   * The side ahead (on the siege when it's the last session, on the session
   * otherwise) could leave the banner now and still be ahead at the end,
   * even if every one of the other side online took it as soon as it could.
   * Null when nobody is ahead, or the other side's online count is unknown.
   */
  safeToLeave: { side: BattleSide; safe: boolean; margin: number } | null
  /**
   * The balance cap (±7,000) at work: the side ahead's further points this
   * session count for nothing, and so do the other side's first `points`.
   * Null when the session ends within the cap.
   */
  overCap: { side: BattleSide; points: number } | null
}

/** What the side gains on the other from now if it has `holders` at the banner for the rest of the session. */
function marginWith(side: BattleSide, holders: number, now: { attacker: number; defender: number }, banner: { side: BattleSide | null; holders: number }, checks: number): number {
  const ours = now[key(side)] - now[key(other(side))]
  const earning = Math.max(0, checks - CAPTURE_CHECKS)
  if (banner.side === side) {
    // Its holders keep earning; more join after five minutes each.
    const extra = Math.max(0, holders - banner.holders)
    return ours + PER_CHECK * (banner.holders * checks + extra * earning)
  }
  // Taking it: the enemy's holders earn through the capture, then lose it.
  const theirs = banner.side ? PER_CHECK * banner.holders * Math.min(CAPTURE_CHECKS, checks) : 0
  return ours - theirs + PER_CHECK * holders * earning
}

function needOf(
  side: BattleSide,
  target: Target,
  over: number,
  now: { attacker: number; defender: number },
  banner: { side: BattleSide | null; holders: number },
  checks: number,
  online: number | null,
): Need {
  // The margin the banner as it is gives them.
  const staying = now[key(side)] - now[key(other(side))] + (banner.side === side ? 1 : banner.side ? -1 : 0) * PER_CHECK * banner.holders * checks
  const already = staying > over
  const short = already ? 0 : over + 1 - staying
  let holders: number | null = 0
  if (!already) {
    const least = banner.side === side ? banner.holders : 1
    const earning = Math.max(0, checks - CAPTURE_CHECKS)
    if (earning === 0) holders = null
    else {
      const base = marginWith(side, banner.side === side ? banner.holders : 0, now, banner, checks)
      const each = PER_CHECK * earning
      holders = Math.max(least, (banner.side === side ? banner.holders : 0) + Math.ceil((over + 1 - base) / each))
    }
  }
  return {
    side,
    target,
    already,
    short,
    kills: Math.ceil(short / RULES.killPoints),
    holders,
    enough: holders === null ? false : online === null ? null : holders <= online,
  }
}

/**
 * The outlook on a battle at `now`, from its latest reading and the siege
 * as its marker says (its balance is the balance the session started from).
 * `online` is how many of each side are online, to say whether a need can
 * be met and whether the side ahead can leave the banner; null when unknown.
 */
export function outlookOf(
  siege: Pick<Siege, 'balance' | 'progress'>,
  reading: BattleReading,
  now: number,
  phase: number | null,
  online: Record<BattleSide, number> | null,
): BattleOutlook | null {
  const points = scoreNow(reading, 1, now, phase)
  const left = secondsLeftNow(reading, now)
  if (!points || left === null) return null
  const checks = phase === null ? Math.floor(left / RULES.tickSeconds) : checksBetween(now, now + left * 1000, phase)
  const start = siege.balance ?? 0
  const final = Boolean(siege.progress && siege.progress.done + 1 >= siege.progress.of)
  const count = (side: BattleSide) => (online ? online[side] : null)
  // The siege: the attackers want start + A − D > 0, the defenders start + A − D < 0.
  const over: Record<Target, Record<BattleSide, number>> = {
    session: { attackers: 0, defenders: 0 },
    siege: { attackers: -start, defenders: start },
  }
  const needs = {
    session: {
      attackers: needOf('attackers', 'session', over.session.attackers, points, reading.banner, checks, count('attackers')),
      defenders: needOf('defenders', 'session', over.session.defenders, points, reading.banner, checks, count('defenders')),
    },
    siege: {
      attackers: needOf('attackers', 'siege', over.siege.attackers, points, reading.banner, checks, count('attackers')),
      defenders: needOf('defenders', 'siege', over.siege.defenders, points, reading.banner, checks, count('defenders')),
    },
  }

  // Leaving the banner: the leaders keep earning until it's taken, five minutes after the others come.
  const target: Target = final ? 'siege' : 'session'
  const ahead = (['attackers', 'defenders'] as const).find((side) => needs[target][side].already) ?? null
  let safeToLeave: BattleOutlook['safeToLeave'] = null
  if (ahead && online) {
    const enemy = other(ahead)
    const kept = reading.banner.side === ahead ? PER_CHECK * reading.banner.holders * Math.min(CAPTURE_CHECKS, checks) : 0
    const theirs = PER_CHECK * online[enemy] * Math.max(0, checks - CAPTURE_CHECKS)
    const margin = points[key(ahead)] - points[key(enemy)] + kept - theirs - over[target][ahead]
    safeToLeave = { side: ahead, safe: margin > 0, margin }
  }

  // The cap: the balance stops at ±7,000, so a margin past it counts for nothing.
  const staying = { ...points }
  if (reading.banner.side) staying[key(reading.banner.side)] += PER_CHECK * reading.banner.holders * checks
  const uncapped = start + staying.attacker - staying.defender
  const overCap =
    Math.abs(uncapped) > RULES.balanceCap ? { side: (uncapped > 0 ? 'attackers' : 'defenders') as BattleSide, points: Math.abs(uncapped) - RULES.balanceCap } : null

  return { checks, points, final, needs, safeToLeave, overCap }
}

// The sessions to come.

/** The starts of the next `count` battle sessions after `now` (a session on now not among them). */
export function sessionsAfter(now: number, count: number): number[] {
  const starts: number[] = []
  let at = now
  while (starts.length < count) {
    const clock = sessionClock(at)
    const start = clock.on ? sessionClock(clock.end + 1000).start : clock.start
    starts.push(start)
    at = start + RULES.sessionMinutes * 60_000 + 1000
  }
  return starts
}

/** How many battle sessions start from `from` to `to`, both included: counted no further than `most + 1`, all a caller needs. */
export function sessionsStarted(from: number, to: number, most: number): number {
  let count = 0
  let at = from
  while (count <= most) {
    const clock = sessionClock(at)
    if (clock.start > to) break
    if (clock.start >= from) count++
    at = clock.end + 1000
  }
  return count
}

/**
 * Which of a town's tracked sessions by the same attacker are this siege's.
 * A nation can besiege a town again (South_America_Quarry: Sul America's
 * siege of 1 November, then its siege of 7 November), and the one before's
 * sessions are no part of this one's story. A siege's sessions follow one
 * another, and the tracker saved with each how many the siege had fought
 * before it (`session`, the marker's progress); so a session is this
 * siege's when no more sessions have started since it than the siege has
 * fought since, by its marker now: one more for the session on now or just
 * over, which the marker counts only once it's done. One of an earlier
 * siege fails it by the whole of that siege's sessions after it and this
 * one's before now. Without the marker's progress, all are kept.
 */
export function ofThisSiege<T extends { startedAt: string; session: number | null }>(battles: T[], siege: Pick<Siege, 'progress'>, now: number): T[] {
  if (!siege.progress || !now) return battles
  const done = siege.progress.done
  return battles.filter((battle) => {
    const start = Date.parse(battle.startedAt)
    if (!Number.isFinite(start)) return false
    const since = done - (battle.session ?? 0) + 1
    return since >= 1 && sessionsStarted(start, now, since) <= since
  })
}

/** Each fighter more than the other side brings is worth about this to the balance in a session: a holder for the hour, less the capture. */
export const POINTS_PER_EXTRA_FIGHTER = PER_CHECK * (SESSION_CHECKS - CAPTURE_CHECKS)

export type SessionForecast = {
  start: number
  /** How many of each side's residents are likely to fight then (expectedAt, summed). */
  expected: Record<BattleSide, number>
  /** The side likely to bring more, by at least half a fighter. */
  favoured: BattleSide | null
  /** The balance change that'd make, roughly: the difference in fighters × POINTS_PER_EXTRA_FIGHTER (+ the attackers'). */
  swing: number
  /** The balance after it, the swings so far added to `from`, within the cap. */
  balance: number
}

export type SiegeForecast = {
  sessions: SessionForecast[]
  /** Residents of each side with any usual hours recorded: what the forecast rests on. */
  known: Record<BattleSide, number>
  /** The siege as the forecast would leave it: the side the balance favours after the last session. */
  winner: BattleSide | null
  /**
   * For the side the forecast leaves losing: the balance it needs going into
   * the sessions that favour the other side to come through them still
   * ahead, and whether the cap even lets a balance be that big.
   */
  lead: { side: BattleSide; needs: number; possible: boolean } | null
}

/**
 * One who may fight for a side: a resident (`share` 1, the default), or an
 * ally of its nation, counted for the share of their fighting they've done
 * for allies (allyShare, src/maps/fighters.ts).
 */
type Resident = Pick<FighterRecord, 'could' | 'fought'> & { hours: number[] | null; share?: number }

/**
 * How the siege's sessions still to come are likely to go, by who usually
 * turns up at their hours: for each, how many of each side's residents are
 * likely to fight (their usual hours × their turnout, `expectedAt`), the
 * side likely to bring more, and roughly what that does to the balance,
 * starting `from` the balance as it stands (or as this session is
 * projected to leave it). Allies count for as much of their fighting as
 * they've done for allies before. Rough by design, and only as good as the
 * records: an ally not known isn't counted, a fighter shared with another
 * siege on at the same time is counted at both, and the side that brings
 * more doesn't always hold the banner.
 */
export function forecastSiege(
  from: number,
  starts: number[],
  residents: Record<BattleSide, Resident[]>,
): SiegeForecast {
  // Midway through the session: who's on then.
  const at = (start: number) => start + (RULES.sessionMinutes / 2) * 60_000
  let balance = capped(from)
  const sessions = starts.map((start): SessionForecast => {
    const expected = {
      attackers: residents.attackers.reduce((sum, one) => sum + (expectedAt(one, at(start)) ?? 0) * (one.share ?? 1), 0),
      defenders: residents.defenders.reduce((sum, one) => sum + (expectedAt(one, at(start)) ?? 0) * (one.share ?? 1), 0),
    }
    const difference = expected.attackers - expected.defenders
    const favoured: BattleSide | null = Math.abs(difference) < 0.5 ? null : difference > 0 ? 'attackers' : 'defenders'
    const swing = favoured ? Math.round((difference * POINTS_PER_EXTRA_FIGHTER) / 10) * 10 : 0
    balance = capped(balance + swing)
    return { start, expected: { attackers: round1(expected.attackers), defenders: round1(expected.defenders) }, favoured, swing, balance }
  })
  const last = sessions.at(-1)?.balance ?? capped(from)
  const winner: BattleSide | null = last > 0 ? 'attackers' : last < 0 ? 'defenders' : null
  let lead: SiegeForecast['lead'] = null
  if (winner) {
    const loser = other(winner)
    // What the winner's sessions take away, from the first of them on: the loser must be that far ahead going in.
    const firstAgainst = sessions.findIndex((session) => session.favoured === winner)
    if (firstAgainst >= 0) {
      const against = sessions.slice(firstAgainst).reduce((sum, session) => sum + Math.abs(session.swing) * (session.favoured === winner ? 1 : -1), 0)
      const needs = Math.max(0, against) + 10
      lead = { side: loser, needs, possible: needs <= RULES.balanceCap }
    }
  }
  const known = {
    attackers: residents.attackers.filter((one) => one.hours && (one.share ?? 1) > 0).length,
    defenders: residents.defenders.filter((one) => one.hours && (one.share ?? 1) > 0).length,
  }
  return { sessions, known, winner, lead }
}

const round1 = (value: number) => Math.round(value * 10) / 10
