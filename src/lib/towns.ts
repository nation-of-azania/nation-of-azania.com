import { revalidatePath } from 'next/cache'
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
 * When Towny renames the nation, the settings follow by themselves
 * (followRenames), so the towns keep counting.
 *
 * Runs at most every few minutes whoever asks: on a schedule (vercel.json),
 * after a page of Azania Maps finds the last reading stale, and from the
 * seed. When the map is down nothing changes and the site keeps showing the
 * last reading.
 */

/** However often it's asked, the map is read at most this often. */
const MIN_INTERVAL_MS = 10 * 60 * 1000
/**
 * A reading older than this is refreshed after the next page of Azania Maps.
 * Towny redraws its claims on the Rulercraft map every few minutes, so a
 * quarter of an hour keeps the map close behind without reading a 5 MB
 * file on every visit.
 */
export const STALE_AFTER_MS = 15 * 60 * 1000

export type SyncResult = {
  status: 'synced' | 'skipped' | 'offline'
  note: string
  /** Whether the reading changed anything the pages show (and so refreshed them). */
  changed?: boolean
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

/** A town's key: Towny's own id, which survives renames, or its name when the map gives none. */
const townyIdOf = (town: Town): string => town.id ?? `name:${town.name.toLowerCase()}`

function townData(town: Town, azanian: boolean, at: string) {
  return {
    name: town.name,
    townyId: townyIdOf(town),
    azanian,
    present: true,
    nation: town.nation,
    ruler: town.ruler,
    founded: town.founded,
    publicSpawn: town.publicSpawn,
    kind: town.kind,
    siteNote: town.siteNote,
    income: town.income,
    resource: town.resource,
    culture: town.culture,
    religion: town.religion,
    residentCount: town.residents.length,
    residents: town.residents,
    chunks: outlinesChunks(town.outlines),
    home: town.home ? { x: town.home.x, y: town.home.y, z: town.home.z } : { x: null, y: null, z: null },
    claims: town.outlines,
    outposts: town.outposts,
    syncedAt: at,
  }
}

/** The reading under way in this server process, which later callers join rather than start another. */
let running: Promise<SyncResult> | null = null

export function syncTowns(payload: Payload, options: { force?: boolean } = {}): Promise<SyncResult> {
  running ??= readMap(payload, options).finally(() => {
    running = null
  })
  return running
}

type StoredTown = { townyId: string; azanian?: boolean | null; present?: boolean | null; nation?: string | null }

/**
 * A Towny nation renamed in game keeps its towns, and the settings follow
 * it. When a nation named in the settings is gone from the map, and most of
 * the towns that counted under it at the last reading (two in three, and at
 * least two) now share one other nation, that is its new name. A nation
 * that falls apart, its towns scattered or nationless, is no rename: its
 * towns stop counting until an admin names the nation they went to. Old
 * name to new, as the settings and the map spell them.
 */
function followRenames(named: string[], rows: StoredTown[], towns: Map<string, Town>): Map<string, string> {
  const onMap = new Set([...towns.values()].map((town) => town.nation?.toLowerCase()).filter(Boolean))
  const byId = new Map([...towns.values()].map((town) => [townyIdOf(town), town]))
  const renames = new Map<string, string>()
  for (const name of named) {
    const lower = name.toLowerCase()
    if (onMap.has(lower)) continue
    const before = rows.filter((row) => row.azanian && row.present && row.nation?.toLowerCase() === lower)
    const now = new Map<string, number>()
    for (const row of before) {
      const nation = byId.get(row.townyId)?.nation
      if (nation) now.set(nation, (now.get(nation) ?? 0) + 1)
    }
    const [best, count = 0] = [...now].sort((a, b) => b[1] - a[1])[0] ?? []
    if (best && count >= 2 && count * 3 >= before.length * 2) renames.set(name, best)
  }
  return renames
}

/**
 * Whether an error is a unique value already taken: two servers reading the
 * map at once both create the same new town or census entry, and the second
 * to arrive loses. The first one's row stands, so the loser just moves on.
 */
/** What a town's row says, but when it was read: the reading changed the town when this did. */
const shownOf = (row: Record<string, unknown>): string => {
  const { syncedAt: _read, ...shown } = row
  return JSON.stringify(shown, (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value ?? null,
  )
}

/**
 * Azania Maps' cached pages are rebuilt on their next visit, rather than a
 * minute after it: a reading that changed a town shows at once. Outside a
 * request Next can refresh from (a page's after(), a script), they catch
 * up when next regenerated, as ever.
 */
function refreshMaps(): void {
  try {
    revalidatePath('/(frontend)/maps', 'layout')
  } catch {
    // Nothing to refresh from here.
  }
}

const alreadyTaken = (error: unknown) =>
  (error as { data?: { errors?: { message?: string }[] } })?.data?.errors?.some((e) =>
    /unique/i.test(e.message ?? ''),
  ) ?? false

async function readMap(payload: Payload, { force = false }: { force?: boolean }): Promise<SyncResult> {
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

  const { docs: rows } = await payload.find({ collection: 'towns', limit: 0, depth: 0, pagination: false })
  const renames = followRenames(
    (settings.nations ?? []).map((nation) => nation.name).filter(Boolean),
    rows,
    towns,
  )
  if (renames.size) {
    settings.nations = (settings.nations ?? []).map((nation) => ({
      ...nation,
      name: renames.get(nation.name) ?? nation.name,
    }))
    await payload.updateGlobal({ slug: 'azania-maps', data: { nations: settings.nations }, depth: 0 })
    payload.logger.info({ msg: 'Azania Maps: followed a Towny nation rename', renames: Object.fromEntries(renames) })
  }
  const nations = lowerNames(settings.nations)
  const listed = lowerNames(settings.towns)
  const byTownyId = new Map(rows.map((row) => [row.townyId, row]))
  const at = now.toISOString()
  const date = at.slice(0, 10)
  const seen = new Set<string>()
  let azanianCount = 0
  let siteCount = 0
  let created = 0
  let changed = renames.size > 0

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
      const before = Object.fromEntries(Object.keys(data).map((key) => [key, (row as unknown as Record<string, unknown>)[key]]))
      if (shownOf({ ...before, slug: row.slug }) !== shownOf({ ...data, slug })) changed = true
      id = (await payload.update({ collection: 'towns', id: row.id, data: { ...data, slug }, depth: 0 })).id
    } else {
      changed = true
      try {
        id = (await payload.create({ collection: 'towns', data: { ...data, slug }, depth: 0 })).id
        created++
      } catch (error) {
        if (!alreadyTaken(error)) throw error
        continue
      }
    }
    if (!azanian) continue
    // A server site's bot and its fixed claims aren't the nation growing.
    if (town.kind !== 'town') {
      siteCount++
      continue
    }
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
    else {
      await payload.create({ collection: 'town-census', data: entry, depth: 0 }).catch((error) => {
        if (!alreadyTaken(error)) throw error
      })
    }
  }

  // Towns no longer on the map at all.
  for (const row of rows) {
    if (seen.has(row.townyId) || (!row.present && !row.azanian)) continue
    await payload.update({ collection: 'towns', id: row.id, data: { present: false, azanian: false, syncedAt: at }, depth: 0 })
    changed = true
  }
  if (changed) refreshMaps()

  const newTowns = created ? `, ${created} new` : ''
  const sites = siteCount ? ` and ${siteCount} held site${siteCount === 1 ? '' : 's'}` : ''
  const renamed = [...renames].map(([from, to]) => ` Towny renamed the nation ${from} to ${to}; the settings follow.`).join('')
  const news = changed ? '' : ' Nothing changed.'
  return note({ status: 'synced', note: `${azanianCount} Azanian towns${sites}${newTowns}.${renamed}${news}`, changed })
}

/**
 * Reads the map if the last reading is stale; for after() on Azania Maps'
 * pages, which also runs when a page is regenerated or built, so it never
 * throws.
 */
export async function syncIfStale(payload: Payload): Promise<void> {
  try {
    const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
    const last = settings.syncedAt ? Date.parse(settings.syncedAt) : 0
    if (Date.now() - last < STALE_AFTER_MS) return
    await syncTowns(payload)
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Azania Maps: reading the Rulercraft map failed' })
  }
}
