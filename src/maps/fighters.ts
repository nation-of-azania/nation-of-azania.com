import { attended, type Fighter, type FighterSide, type Mark } from './fights'

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
  /** Battles they could have fought (a side's resident, online during it), and fought (a minute or more in the zone). */
  could: number
  fought: number
  /** Minutes in the siege zone and at the banner, across the battles fought. */
  minutes: number
  bannerMinutes: number
  /** Stays in the banner zone and how they ended. */
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
  for (const battle of [...battles].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const could = new Set([...(battle.sides?.attackers ?? []), ...(battle.sides?.defenders ?? [])].map((name) => name.toLowerCase()))
    for (const name of [...(battle.sides?.attackers ?? []), ...(battle.sides?.defenders ?? [])]) of(name).could++
    for (const fighter of battle.fighters ?? []) {
      if (!attended(fighter)) continue
      const record = of(fighter.name)
      // One who fought without being counted as able to (an ally, a mercenary) could, after all.
      if (!could.has(fighter.name.toLowerCase())) record.could++
      record.fought++
      record.minutes += fighter.zone / 60
      record.bannerMinutes += fighter.banner / 60
      for (const stay of fighter.stays) {
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

/** Of the battles they could have fought, the share they did. */
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
