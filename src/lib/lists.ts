import { revalidatePath } from 'next/cache'
import type { Payload, PayloadRequest } from 'payload'

import {
  changeSummary,
  diffEntries,
  diffMembers,
  isEntryKind,
  resolveEntries,
  type EntryChange,
  type ListEntry,
  type PlayerChange,
  type Roster,
  type TownResidents,
} from '../lists/resolve'
import type { List, ListChange } from '../payload-types'
import { getWorld } from './world'

/**
 * Lists on the server (src/collections/Lists.ts): rendering one down to
 * players against the map (src/lists/resolve.ts), writing its changelog
 * (src/collections/ListChanges.ts) when an edit or the map's watch changes
 * it. The pages read lists through src/lib/sanctions.ts.
 *
 * The roster, the list as last rendered down, is kept on the list, so the
 * pages read it as it was recorded and a player keeps the date they came
 * onto the list. A reading of the map that can't tell who lives where (the
 * map down, an old cached reading) changes nothing: the changelog records
 * only what the map showed.
 */

type Row = NonNullable<List['entries']>[number]

const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()) : []

/** A list's entries as the resolver takes them; rows without a kind or name (a half-filled form) are skipped. */
export function entriesOf(rows: Row[] | null | undefined): ListEntry[] {
  return (rows ?? []).flatMap((row, index): ListEntry[] =>
    isEntryKind(row.kind) && row.name?.trim()
      ? [{
          id: row.id ?? `row-${index}`,
          kind: row.kind,
          name: row.name.trim(),
          classes: texts(row.classes),
          reason: row.reason ?? null,
          exceptTowns: texts(row.exceptTowns),
          exceptPlayers: texts(row.exceptPlayers),
        }]
      : [],
  )
}

export const rosterOf = (value: unknown): Roster =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Roster) : {}

/** Every page under a context, sanction lists and the articles that show them included, is rebuilt on its next visit. */
function refreshPages(): void {
  try {
    revalidatePath('/(frontend)/[top]', 'layout')
  } catch {
    // Outside a request Next can refresh from (a script): the pages catch up when next regenerated.
  }
}

type Recording = {
  list: List
  /** The entries before an edit, to tell what it changed; none for the watch. */
  before?: Row[] | null
  source: 'edit' | 'world'
  by?: number | null
  note?: string | null
  /** The map's towns, when the caller has read them (the watch); otherwise read here. */
  towns?: TownResidents[]
  req?: PayloadRequest
}

/**
 * The list rendered down against the map and held against its roster: what
 * changed goes into the changelog, and the roster is brought up to date. An
 * edit is recorded even when the map can't be read; its players then
 * follow with the watch's next reading.
 */
export async function recordListChange(payload: Payload, { list, before, source, by = null, note = null, towns, req }: Recording): Promise<ListChange | null> {
  const entries = entriesOf(list.entries)
  const entryChanges: EntryChange[] = source === 'edit' ? diffEntries(entriesOf(before), entries) : []

  let known: TownResidents[] | null = []
  if (entries.some((entry) => entry.kind !== 'player')) {
    if (towns) known = towns
    else {
      const world = await getWorld()
      known = world && !world.offline && world.towns.length > 0 ? world.towns : null
    }
  }
  const resolved = known ? resolveEntries(entries, known) : null
  const now = new Date().toISOString()
  const recorded = rosterOf(list.roster)
  const next = resolved && !resolved.unread ? diffMembers(recorded, resolved.members, now) : null
  const players: PlayerChange[] = next?.changes ?? []

  const saveRoster = async (roster: Roster) => {
    const held = req?.context.listSync
    await payload.update({
      collection: 'lists',
      id: list.id,
      data: { roster, rosterAt: now },
      overrideAccess: true,
      context: { listSync: true },
      depth: 0,
      req,
    })
    // The flag is for this save alone: Payload keeps it on a request passed in, and a request (a script, a
    // migration) may go on to edit the list again, whose changes must still be recorded.
    if (req) req.context.listSync = held
  }

  if (entryChanges.length === 0 && players.length === 0) {
    // Nobody came or went, but someone may have moved town within a listed nation: the roster says where they are now.
    if (next && JSON.stringify(next.roster) !== JSON.stringify(recorded)) await saveRoster(next.roster)
    return null
  }
  const change = await payload.create({
    collection: 'list-changes',
    data: {
      list: list.id,
      at: now,
      source,
      by,
      note,
      summary: changeSummary(entryChanges, players),
      entries: entryChanges,
      players,
    },
    overrideAccess: true,
    depth: 0,
    req,
  })
  if (next) await saveRoster(next.roster)
  refreshPages()
  return change
}

/**
 * The watch's part (src/lib/watch.ts): every list with a town or a nation
 * on it, held against a fresh reading of the map, so people moving in and
 * out are recorded within minutes of the map showing it.
 */
export async function syncLists(payload: Payload, towns: TownResidents[]): Promise<{ changed: string[] }> {
  if (towns.length === 0) return { changed: [] }
  const { docs } = await payload.find({
    collection: 'lists',
    where: { 'entries.kind': { in: ['town', 'nation'] } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const changed: string[] = []
  for (const list of docs) {
    const change = await recordListChange(payload, { list, source: 'world', towns }).catch((error: unknown) => {
      payload.logger.error({ err: error, msg: `Lists: bringing “${list.name}” up to date failed` })
      return null
    })
    if (change) changed.push(`${list.name}: ${change.summary}`)
  }
  return { changed }
}
