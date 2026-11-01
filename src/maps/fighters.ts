import { attended, triesOf, type Fighter, type FighterSide, type Mark } from './fights'

/**
 * Each player's record across the battles the tracker read
 * (src/maps/fights.ts, src/lib/battleTracker.ts), and their usual hours
 * online (src/lib/presence.ts): what /maps/fighters serves, for the war
 * view and the players' panels. Pure.
 */

/** A battle as the tracker saved it: enough to count records from. */
export type SavedBattle = {
  startedAt: string
  town: string | null
  attacker: string | null
  defender: string | null
  coverage: number | null
  result: Pick<Mark, 'attacker' | 'defender'> | null
  sides: { attackers?: string[]; defenders?: string[] } | null
  fighters: Fighter[] | null
}

export type FighterRecord = {
  name: string
  /**
   * Battle sessions they could have fought in (a resident of a side of one
   * of its battles, online during it), and fought in (a minute or more in
   * the zone of any of its battles). Counted by the session, not the
   * battle, so one whose nation has two sieges on at once, or who fights at
   * an ally's siege while their own nation's is on, isn't counted absent
   * from the one they weren't at.
   */
  could: number
  fought: number
  /** Battles fought: a siege's battle in a session, so two sieges fought in one session are two. */
  battles: number
  /** Sessions they fought in for an ally (a side they don't live with: src/maps/alliances.ts). */
  allied: number
  /** Minutes in the siege zone and at the banner, across the battles fought. */
  minutes: number
  bannerMinutes: number
  /** Tries at the banner (stays that weren't a holder's) and how they ended. */
  stays: number
  held: number
  died: number
  left: number
  cut: number
  /** Deaths in the siege zone, and those the points confirm. */
  deaths: number
  confirmed: number
  /** Battles fought whose session their side won, or lost, on points. */
  won: number
  lost: number
  /** The side they last fought on, and when. */
  side: FighterSide | null
  lastFought: string | null
}

const blank = (name: string): FighterRecord => ({
  name,
  could: 0,
  fought: 0,
  battles: 0,
  allied: 0,
  minutes: 0,
  bannerMinutes: 0,
  stays: 0,
  held: 0,
  died: 0,
  left: 0,
  cut: 0,
  deaths: 0,
  confirmed: 0,
  won: 0,
  lost: 0,
  side: null,
  lastFought: null,
})

/**
 * The battle session a battle was fought in, by the hour it began: sessions
 * start on the hour, and a siege laid in a session's first ten minutes
 * begins its battle a little after.
 */
export const sessionOf = (startedAt: string): string => startedAt.slice(0, 13)

/** Every player's record over `battles`, keyed by lower-cased name. */
export function recordsOf(battles: SavedBattle[]): Map<string, FighterRecord> {
  const records = new Map<string, FighterRecord>()
  const of = (name: string) => {
    const key = name.toLowerCase()
    let record = records.get(key)
    if (!record) {
      record = blank(name)
      records.set(key, record)
    }
    return record
  }
  // By the session: who could have fought in it, who fought in it, and who for an ally.
  const sessions = new Map<string, { could: Set<string>; fought: Set<string>; allied: Set<string> }>()
  for (const battle of [...battles].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const key = sessionOf(battle.startedAt)
    const session = sessions.get(key) ?? { could: new Set<string>(), fought: new Set<string>(), allied: new Set<string>() }
    sessions.set(key, session)
    for (const name of [...(battle.sides?.attackers ?? []), ...(battle.sides?.defenders ?? [])]) {
      of(name)
      session.could.add(name.toLowerCase())
    }
    for (const fighter of battle.fighters ?? []) {
      if (!attended(fighter)) continue
      const record = of(fighter.name)
      // One who fought without being counted as able to (an ally) could, after all.
      session.could.add(fighter.name.toLowerCase())
      session.fought.add(fighter.name.toLowerCase())
      if (fighter.ally) session.allied.add(fighter.name.toLowerCase())
      record.battles++
      record.minutes += fighter.zone / 60
      record.bannerMinutes += fighter.banner / 60
      for (const stay of triesOf(fighter.stays)) {
        record.stays++
        record[stay.outcome]++
      }
      record.deaths += fighter.deaths.length
      record.confirmed += fighter.deaths.filter((death) => death.confirmed).length
      if (battle.result && fighter.side !== 'other') {
        const ours = fighter.side === 'attackers' ? battle.result.attacker : battle.result.defender
        const theirs = fighter.side === 'attackers' ? battle.result.defender : battle.result.attacker
        if (ours > theirs) record.won++
        else if (ours < theirs) record.lost++
      }
      record.side = fighter.side
      record.lastFought = battle.startedAt
    }
  }
  for (const session of sessions.values()) {
    for (const key of session.could) records.get(key)!.could++
    for (const key of session.fought) records.get(key)!.fought++
    for (const key of session.allied) records.get(key)!.allied++
  }
  for (const record of records.values()) {
    record.minutes = Math.round(record.minutes)
    record.bannerMinutes = Math.round(record.bannerMinutes)
  }
  return records
}

/** Of their stays in the banner zone that came to an end they chose or met (not cut short by the readings), the share held. */
export const holdRate = (record: Pick<FighterRecord, 'held' | 'died' | 'left'>): number | null => {
  const ended = record.held + record.died + record.left
  return ended ? record.held / ended : null
}

/** Of the battle sessions they could have fought in, the share they did. */
export const turnout = (record: Pick<FighterRecord, 'could' | 'fought'>): number | null => (record.could ? record.fought / record.could : null)

// Usual hours, from the presence days.

const HOURS_OF_WEEK = 7 * 24

function bytesOf(packed: string): Uint8Array {
  try {
    const text = atob(packed)
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
    return bytes
  } catch {
    return new Uint8Array()
  }
}

/**
 * For each player, the share of the days recorded on which they were
 * online at each hour of the week (UTC, Monday 00:00 first): 168 numbers,
 * 0 to 1. A player online any of an hour's twelve slots was online that
 * hour. Days are `{ day: '2026-10-31', slots: { name: packed bits } }`.
 */
export function usualHours(days: { day: string; slots: Record<string, string> | null }[]): Map<string, number[]> {
  const seen = new Map<string, number[]>()
  const daysOfWeekday = new Array(7).fill(0)
  for (const { day, slots } of days) {
    const date = new Date(`${day}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) continue
    const weekday = (date.getUTCDay() + 6) % 7
    daysOfWeekday[weekday]++
    for (const [name, packed] of Object.entries(slots ?? {})) {
      const bytes = bytesOf(packed)
      const key = name.toLowerCase()
      const hours = seen.get(key) ?? new Array(HOURS_OF_WEEK).fill(0)
      for (let hour = 0; hour < 24; hour++) {
        // Twelve five-minute slots an hour: a byte and a half.
        let online = false
        for (let slot = hour * 12; slot < hour * 12 + 12 && !online; slot++) online = Boolean(bytes[slot >> 3] & (1 << (slot & 7)))
        if (online) hours[weekday * 24 + hour]++
      }
      seen.set(key, hours)
    }
  }
  for (const hours of seen.values()) {
    for (let i = 0; i < HOURS_OF_WEEK; i++) {
      const of = daysOfWeekday[Math.floor(i / 24)]
      hours[i] = of ? Math.round((hours[i] / of) * 100) / 100 : 0
    }
  }
  return seen
}

/** The hour of the week (UTC, Monday 00:00 first) a time falls in. */
export const hourOfWeek = (ms: number): number => {
  const date = new Date(ms)
  return ((date.getUTCDay() + 6) % 7) * 24 + date.getUTCHours()
}

/**
 * Their score, 0 to 100, to compare fighters by: the chance they take the
 * banner when they try, times the chance they fight in a battle session
 * they could have.
 * Both are smoothed toward an even chance (one more held and one more not,
 * one more fought and one more not), so a single lucky try doesn't top
 * the list and a newcomer starts mid-table; the more sessions, the more it
 * says (`tries` and `could` say how much it rests on).
 */
export function fighterScore(record: Pick<FighterRecord, 'held' | 'died' | 'left' | 'could' | 'fought'>): number {
  const taking = (record.held + 1) / (record.held + record.died + record.left + 2)
  const showing = (record.fought + 1) / (record.could + 2)
  return Math.round(taking * showing * 100)
}

/**
 * How likely they are to be fighting at `ms`, 0 to 1: how often they're
 * online at that hour of the week, times how often they fight in a session
 * they could have (smoothed as above). Null without their hours.
 */
export function expectedAt(record: Pick<FighterRecord, 'could' | 'fought'> & { hours: number[] | null }, ms: number): number | null {
  if (!record.hours) return null
  const showing = (record.fought + 1) / (record.could + 2)
  return Math.round((record.hours[hourOfWeek(ms)] ?? 0) * showing * 100) / 100
}

/**
 * How much of an ally's fighting to count on for another nation's siege,
 * 0 to 1: of the sessions they fought in, the share they fought for an ally.
 * Nothing for one who never has: an alliance alone doesn't bring anyone.
 */
export const allyShare = (record: Pick<FighterRecord, 'fought' | 'allied'>): number => (record.fought ? Math.min(1, (record.allied ?? 0) / record.fought) : 0)
