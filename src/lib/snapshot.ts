import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import { packWorld, unpackWorld, type PackedWorld, type War, type World } from '../maps/world'
import { demoWar, warDemo } from './warDemo'
import { getWar, getWarLive, getWorld } from './world'

/**
 * Azania Maps while the Rulercraft map is down. The rest of the world and
 * the war are read from the map's marker file and kept nowhere but in a
 * server's memory, which a fresh server doesn't have: so the watch
 * (src/lib/watch.ts), reading the map every five minutes, saves them to the
 * database every quarter of an hour (Map snapshot, src/globals/MapSnapshot.ts),
 * and when the map doesn't answer, the world (/maps/world.json), the war
 * (/maps/war) and the pages abroad fall back to what was saved, said to be
 * saved, with when. The map's own pictures are kept by the CDN, and
 * Azania's towns by the database, already.
 */

/** The world and the war are saved at most this often. */
export const SNAPSHOT_EVERY_MS = 15 * 60 * 1000
/** What was saved is read from the database at most this often by one server. */
const READ_EVERY_MS = 60 * 1000

/** A reading: as the map gives it now, or as last saved (`saved`); its own `at` says when the map wrote it. */
export type Reading<T> = { value: T; saved: boolean }

/**
 * Saves the world and the war, unless they were saved under a quarter of
 * an hour ago. Resolves to whether it saved.
 */
export async function saveSnapshot(payload: Payload, world: World, war: War, now = new Date()): Promise<boolean> {
  const last = await payload.findGlobal({ slug: 'map-snapshot', depth: 0, select: { takenAt: true } })
  if (last.takenAt && now.getTime() - Date.parse(last.takenAt) < SNAPSHOT_EVERY_MS - 30_000) return false
  await payload.updateGlobal({
    slug: 'map-snapshot',
    data: { world: packWorld(world), war, takenAt: now.toISOString() },
    depth: 0,
  })
  return true
}

const isPacked = (value: unknown): value is PackedWorld =>
  Boolean(value) && Array.isArray((value as PackedWorld).towns) && Array.isArray((value as PackedWorld).nations)
const isWar = (value: unknown): value is War =>
  Boolean(value) && Array.isArray((value as War).sieges) && Array.isArray((value as War).capitals)

type Kept = { read: number; world: World | null; war: War | null }
let saved: Kept | null = null
let reading: Promise<Kept> | null = null

/** What was last saved, read at most every minute by this server; nothing when none was, or the database can't say. */
async function lastSaved(): Promise<{ world: World | null; war: War | null }> {
  if (saved && Date.now() - saved.read < READ_EVERY_MS) return saved
  reading ??= (async (): Promise<Kept> => {
    let kept: Kept
    try {
      const payload = await getPayload({ config })
      const doc = await payload.findGlobal({ slug: 'map-snapshot', depth: 0 })
      kept = {
        read: Date.now(),
        world: isPacked(doc.world) ? unpackWorld(doc.world) : null,
        war: isWar(doc.war) ? doc.war : null,
      }
    } catch {
      kept = { read: Date.now(), world: saved?.world ?? null, war: saved?.war ?? null }
    }
    saved = kept
    return kept
  })().finally(() => {
    reading = null
  })
  return reading
}

/** The world: the map's, else as last saved; null when neither can be had. */
export async function worldReading(): Promise<Reading<World> | null> {
  const world = await getWorld()
  if (world) return { value: world, saved: false }
  const { world: kept } = await lastSaved()
  return kept ? { value: kept, saved: true } : null
}

/**
 * The war: the map's, else as last saved; null when neither can be had.
 * `live` reads the map more often, for the war view during a battle. On a
 * machine running the war demo (src/lib/warDemo.ts), the demo's battle.
 */
export async function warReading({ live = false }: { live?: boolean } = {}): Promise<Reading<War> | null> {
  if (warDemo()) {
    const demo = await demoWar(Date.now())
    if (demo) return { value: demo, saved: false }
  }
  const war = await (live ? getWarLive : getWar)()
  if (war) return { value: war, saved: false }
  const { war: kept } = await lastSaved()
  return kept ? { value: kept, saved: true } : null
}
