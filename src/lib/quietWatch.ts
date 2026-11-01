import { createHash } from 'node:crypto'

import { getCache } from '@vercel/functions'
import type { Payload } from 'payload'

import type { TownResidents } from '../lists/resolve'
import type { Siege } from '../maps/world'
import type { Town } from './dynmap'
import { townsMark, type TownInterest } from './towns'

/**
 * The watch's quiet runs (src/lib/watch.ts).
 *
 * The watch reads the Rulercraft map every five minutes. The database it
 * keeps everything in (Neon, on its free plan) sleeps after five minutes
 * without a query and counts every minute it's awake, so a watch that asked
 * it something on every run kept it awake around the clock: some 180 of
 * the 100 compute-hours a month the plan gives. Most runs find nothing
 * changed. So each run that goes to the database leaves a note here, in
 * Vercel's runtime cache (kept between runs in the region, and now and then
 * lost), with what the next run needs to tell from the map alone whether
 * it has anything to do there:
 *
 *   - fingerprints of everything a run would write or tell: Azania's towns
 *     as the Towns collection and the census hold them, the towns and
 *     nations a list names (who lives in them), and the sieges as the
 *     alerts see them (which there are, who besieges, a battle on, how many
 *     sessions fought);
 *   - what the database said to read the map by: Azania's nations and
 *     towns as the settings name them, the towns it has rows for, the
 *     towns and nations on the lists;
 *   - whether the run left something pending: a siege gone from the map,
 *     whose end is told minutes later, or an alert Discord didn't take.
 *
 * A run whose fingerprints all match, with nothing pending, writes only the
 * note and leaves the database asleep. Anything different, anything
 * pending, a new day (the census is daily), six hours since the last full
 * run (the outage copy, src/lib/snapshot.ts, is saved on full runs), or no
 * note at all, and the run is full, as it always was. So the cache is only
 * ever a reason to skip work that would have changed nothing; losing it
 * costs one full run.
 */

/** A full run at least this often, whatever the fingerprints say: the outage copy stays this fresh at worst. */
export const FULL_EVERY_MS = 6 * 60 * 60 * 1000
const KEY = 'azania-maps:watch-note:v1'
/** Kept a week: long past any run that would read it. */
const TTL_S = 7 * 24 * 60 * 60

/** What the database says to read the map by. */
export type Interest = TownInterest & {
  /** The towns and nations the lists name, lower-cased. */
  listTowns: string[]
  listNations: string[]
}

export type Marks = { towns: string; lists: string; sieges: string }

export type QuietNote = {
  /** When a run last started: the watch runs at most every four minutes in a battle session's hour, twelve otherwise, however often it's asked. */
  claimedAt: number
  /** When a run last went to the database. */
  fullAt: number
  /** When a run last read the map and found it as the marks say. */
  seenAt: number
  /** The UTC day of the last full run, `2026-10-31`. */
  day: string
  marks: Marks
  interest: Interest
  pending: boolean
}

export const digest = (text: string): string => createHash('sha1').update(text).digest('base64url')
export const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/** The sieges as the alerts see them: a new one, a battle starting, a session done, one gone. */
export function siegesMark(sieges: Pick<Siege, 'townId' | 'attacker' | 'defender' | 'battle' | 'progress'>[]): string {
  return digest(
    sieges
      .map((siege) => [siege.townId, siege.attacker, siege.defender, siege.battle ? 1 : 0, siege.progress?.done ?? -1].join('|'))
      .sort()
      .join('\n'),
  )
}

/** Who lives in the towns and nations the lists name: what the lists' rosters are held against. */
export function listsMark(towns: TownResidents[], interest: Pick<Interest, 'listTowns' | 'listNations'>): string {
  // Looser than the lists match (src/lists/resolve.ts): a town too many in here costs nothing, one too few a change missed.
  const loose = (name: string) => name.trim().toLowerCase().replace(/[\s_]+/g, '_')
  const names = new Set(interest.listTowns.map(loose))
  const nations = new Set(interest.listNations.map(loose))
  return digest(
    towns
      .filter((town) => names.has(loose(town.name)) || (town.nation !== null && nations.has(loose(town.nation))))
      .map((town) => JSON.stringify([town.name, town.nation, [...town.people].sort()]))
      .sort()
      .join('\n'),
  )
}

/** The three fingerprints of a reading of the map, by what the database last said. */
export function marksOf(
  reading: { towns: Map<string, Town>; world: TownResidents[]; sieges: Siege[] },
  interest: Interest,
  day: string,
): Marks {
  return { towns: townsMark(reading.towns, interest, day), lists: listsMark(reading.world, interest), sieges: siegesMark(reading.sieges) }
}

/**
 * Whether this run may leave the database asleep, and if not, why not.
 * `marks` is null when the reading can't say (its file is old: then there's
 * nothing a full run could do with it either, so it's quiet unless the day
 * or the six hours say otherwise).
 */
export function quietDecision(note: QuietNote | null, now: number, marks: Marks | null): { quiet: boolean; why: string } {
  if (!note) return { quiet: false, why: 'no note from a full run' }
  if (dayOf(now) !== note.day) return { quiet: false, why: 'a new day, for the census' }
  if (now - note.fullAt >= FULL_EVERY_MS) return { quiet: false, why: 'six hours since the last full run' }
  if (!marks) return { quiet: true, why: 'the map’s file is old: nothing to tell from it' }
  if (note.pending) return { quiet: false, why: 'something pending from the last run' }
  const changed = (Object.keys(marks) as (keyof Marks)[]).filter((key) => marks[key] !== note.marks[key])
  if (changed.length) return { quiet: false, why: `changed: ${changed.join(', ')}` }
  return { quiet: true, why: 'nothing changed' }
}

const isNames = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')
const isNote = (value: unknown): value is QuietNote => {
  const note = value as QuietNote | null
  return Boolean(
    note &&
      typeof note.claimedAt === 'number' &&
      typeof note.fullAt === 'number' &&
      typeof note.seenAt === 'number' &&
      typeof note.day === 'string' &&
      typeof note.pending === 'boolean' &&
      note.marks &&
      typeof note.marks.towns === 'string' &&
      typeof note.marks.lists === 'string' &&
      typeof note.marks.sieges === 'string' &&
      note.interest &&
      isNames(note.interest.nations) &&
      isNames(note.interest.towns) &&
      isNames(note.interest.townyIds) &&
      isNames(note.interest.listTowns) &&
      isNames(note.interest.listNations),
  )
}

/** The note, or null when there's none or the cache can't be reached (the run is then full). */
export async function readNote(): Promise<QuietNote | null> {
  try {
    const value = await getCache().get(KEY)
    return isNote(value) ? value : null
  } catch {
    return null
  }
}

export async function writeNote(note: QuietNote): Promise<void> {
  try {
    await getCache().set(KEY, note, { ttl: TTL_S, name: 'Azania Maps watch note' })
  } catch {
    // The next run is full, as without a note.
  }
}

/** What the database says to read the map by, asked by a full run (the database is awake for it anyway). */
export async function interestOf(payload: Payload): Promise<Interest> {
  const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
  const { docs: rows } = await payload.find({ collection: 'towns', pagination: false, depth: 0, select: { townyId: true } })
  const { docs: lists } = await payload.find({
    collection: 'lists',
    where: { 'entries.kind': { in: ['town', 'nation'] } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { entries: true },
  })
  const named = (kind: 'town' | 'nation') =>
    [...new Set(lists.flatMap((list) => (list.entries ?? []).filter((entry) => entry.kind === kind && entry.name?.trim()).map((entry) => entry.name!.trim().toLowerCase())))].sort()
  return {
    nations: (settings.nations ?? []).map((nation) => nation.name).filter((name): name is string => Boolean(name?.trim())),
    towns: (settings.towns ?? []).map((town) => town.name).filter((name): name is string => Boolean(name?.trim())),
    townyIds: rows.map((row) => row.townyId).filter((id): id is string => Boolean(id)).sort(),
    listTowns: named('town'),
    listNations: named('nation'),
  }
}

/**
 * Whether the towns were read from the map lately and found unchanged, by
 * a quiet run or a full one: then the database's copy is as good as fresh,
 * and a page of Azania Maps needn't have them read again (towns.ts →
 * syncIfStale).
 */
export async function townsCheckedWithin(ms: number, now = Date.now()): Promise<boolean> {
  const note = await readNote()
  return Boolean(note && now - note.seenAt < ms)
}
