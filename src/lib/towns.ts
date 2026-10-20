import type { Payload } from 'payload'

import { outlinesChunks } from '../maps/geo'
import { getTowns, type Town } from './dynmap'

/**
 * Keeps the Towns collection and the daily census in step with Towny, as
 * the Rulercraft map publishes it. A town is Azanian when its Towny nation
 * is one of those named under Settings → Azania Maps, or when it's listed
 * there by name. Towns are keyed on Towny's id, so a rename is the same
 * town; a town that leaves or falls keeps its row (and its places), marked.
 *
 * Runs at most every few minutes whoever asks: on a schedule (vercel.json),
 * after a page of Azania Maps finds the last reading stale, and from the
 * seed. When the map is down nothing changes and the site keeps showing the
 * last reading.
 */

/** However often it's asked, the map is read at most this often. */
const MIN_INTERVAL_MS = 10 * 60 * 1000
/** A reading older than this is refreshed after the next page of Azania Maps. */
export const STALE_AFTER_MS = 60 * 60 * 1000

export type SyncResult = {
  status: 'synced' | 'skipped' | 'offline'
  note: string
}

export const townSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'town'

const lowerNames = (rows: { name?: string | null }[] | null | undefined) =>
  new Set((rows ?? []).map((row) => row.name?.trim().toLowerCase()).filter((name): name is string => Boolean(name)))

function townData(town: Town, azanian: boolean, at: string) {
  return {
    name: town.name,
    townyId: town.id ?? `name:${town.name.toLowerCase()}`,
    azanian,
    present: true,
    nation: town.nation,
    ruler: town.ruler,
    founded: town.founded,
    culture: town.culture,
    residentCount: town.residents.length,
    residents: town.residents,
    chunks: outlinesChunks(town.outlines),
    home: town.home ? { x: town.home.x, y: town.home.y, z: town.home.z } : { x: null, y: null, z: null },
    claims: town.outlines,
    syncedAt: at,
  }
}

export async function syncTowns(payload: Payload, { force = false } = {}): Promise<SyncResult> {
  const now = new Date()
  const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
  const last = settings.syncedAt ? Date.parse(settings.syncedAt) : 0
  if (!force && now.getTime() - last < MIN_INTERVAL_MS) {
    return { status: 'skipped', note: 'The map was read a moment ago.' }
  }
  // Claim the run before the slow part, so requests arriving meanwhile skip.
  await payload.updateGlobal({ slug: 'azania-maps', data: { syncedAt: now.toISOString() }, depth: 0 })
  const note = async (result: SyncResult) => {
    await payload.updateGlobal({ slug: 'azania-maps', data: { syncNote: result.note }, depth: 0 })
    return result
  }

  const towns = await getTowns({ fresh: true })
  if (!towns) return note({ status: 'offline', note: 'The Rulercraft map didn’t answer; the last reading stands.' })

  const nations = lowerNames(settings.nations)
  const listed = lowerNames(settings.towns)
  const { docs: rows } = await payload.find({ collection: 'towns', limit: 0, depth: 0, pagination: false })
  const byTownyId = new Map(rows.map((row) => [row.townyId, row]))
  const at = now.toISOString()
  const date = at.slice(0, 10)
  const seen = new Set<string>()
  let azanianCount = 0
  let created = 0

  for (const town of towns.values()) {
    const azanian = Boolean(
      (town.nation && nations.has(town.nation.toLowerCase())) || listed.has(town.name.toLowerCase()),
    )
    const data = townData(town, azanian, at)
    const row = byTownyId.get(data.townyId)
    if (!azanian && !row) continue
    seen.add(data.townyId)
    // A renamed town moves to its new address, unless another town holds it.
    const wanted = townSlug(town.name)
    const taken = rows.some((other) => other.slug === wanted && other.id !== row?.id)
    const slug = row && (row.name === town.name || taken) ? row.slug : taken ? `${wanted}-${data.townyId.slice(0, 4)}` : wanted
    let id: number
    if (row) {
      id = (await payload.update({ collection: 'towns', id: row.id, data: { ...data, slug }, depth: 0 })).id
    } else {
      id = (await payload.create({ collection: 'towns', data: { ...data, slug }, depth: 0 })).id
      created++
    }
    if (!azanian) continue
    azanianCount++

    // Today's census entry: the day's last reading wins.
    const key = `${id}:${date}`
    const entry = { key, date, town: id, residents: data.residentCount, chunks: data.chunks, nation: town.nation }
    const { docs: existing } = await payload.find({
      collection: 'town-census',
      where: { key: { equals: key } },
      limit: 1,
      depth: 0,
    })
    if (existing[0]) await payload.update({ collection: 'town-census', id: existing[0].id, data: entry, depth: 0 })
    else await payload.create({ collection: 'town-census', data: entry, depth: 0 })
  }

  // Towns no longer on the map at all.
  for (const row of rows) {
    if (seen.has(row.townyId) || (!row.present && !row.azanian)) continue
    await payload.update({ collection: 'towns', id: row.id, data: { present: false, azanian: false, syncedAt: at }, depth: 0 })
  }

  const newTowns = created ? `, ${created} new` : ''
  return note({ status: 'synced', note: `${azanianCount} Azanian towns${newTowns}.` })
}

/** Reads the map if the last reading is stale; for after() on Azania Maps' pages. */
export async function syncIfStale(payload: Payload): Promise<void> {
  const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
  const last = settings.syncedAt ? Date.parse(settings.syncedAt) : 0
  if (Date.now() - last < STALE_AFTER_MS) return
  try {
    await syncTowns(payload)
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Azania Maps: reading the Rulercraft map failed' })
  }
}
