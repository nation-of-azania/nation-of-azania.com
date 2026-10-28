import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'
import { cache } from 'react'

import { getTowns, type Town } from '@/lib/dynmap'

import {
  mapEvent,
  mapPlace,
  mapRoad,
  mapTown,
  mapView,
  type MapData,
  type MapEvent,
  type MapPlace,
  type MapRoad,
  type MapTown,
  type MapViewData,
} from '@/maps/data'
import { spawnsFrom } from '@/maps/claims'
import type { Outline } from '@/maps/geo'
import { isStance, isTownKind, type Stance } from '@/maps/registry'
import type { Article, Town as TownDoc } from '@/payload-types'

/**
 * Read-side data for Azania Maps' pages (src/app/(frontend)/maps): the
 * nation as the map draws it and the particulars of whatever's opened.
 * Nothing here looks at who's asking — the pages are cached for everyone
 * alike, and the browser asks /api/users/me for the visitor's own rights
 * (src/maps/data.ts → mapRightsOf). Everything the site stores is read
 * here; the pictures come from the tile cache. Database errors give empty
 * results, so `next build` succeeds before the database exists.
 */

const getClient = () => getPayload({ config })

const ALL = { limit: 0, pagination: false as const, depth: 0 }

/** The whole nation, once per render. */
export const getMapData = cache(async (): Promise<MapData> => {
  try {
    const payload = await getClient()
    const [towns, places, roads, events, settings] = await Promise.all([
      payload.find({
        collection: 'towns',
        where: { and: [{ azanian: { equals: true } }, { present: { equals: true } }] },
        sort: 'name',
        ...ALL,
      }),
      payload.find({ collection: 'places', sort: 'name', ...ALL }),
      payload.find({ collection: 'roads', sort: 'name', ...ALL }),
      payload.find({ collection: 'events', sort: 'startsAt', ...ALL }),
      // The diplomacy alone: if the settings can't be read, the map goes on without it.
      payload.findGlobal({ slug: 'azania-maps', depth: 0 }).catch(() => null),
    ])
    const present = <T>(value: T | null): value is T => value !== null
    return {
      towns: towns.docs.map(mapTown),
      places: places.docs.map(mapPlace).filter(present),
      roads: roads.docs.map(mapRoad).filter(present),
      events: events.docs.map(mapEvent).filter(present),
      // Only the diplomacy: the rest of the settings stay with the admins.
      relations: (settings?.relations ?? [])
        .filter((relation) => relation.nation?.trim() && isStance(relation.stance))
        .map((relation) => ({
          nation: relation.nation.trim(),
          stance: relation.stance as Stance,
          note: relation.note?.trim() || null,
        })),
    }
  } catch {
    return { towns: [], places: [], roads: [], events: [], relations: [] }
  }
})

/** The articles that name a town, place or event among their locations. */
export async function getArticlesAbout(
  relationTo: 'towns' | 'places' | 'events',
  id: number,
  limit = 8,
): Promise<Article[]> {
  try {
    const payload = await getClient()
    const where: Where = {
      and: [
        { _status: { equals: 'published' } },
        { 'locations.relationTo': { equals: relationTo } },
        { 'locations.value': { equals: id } },
      ],
    }
    const { docs } = await payload.find({
      collection: 'articles',
      where,
      sort: '-publishedAt',
      limit,
      depth: 1,
    })
    return docs
  } catch {
    return []
  }
}

export type CensusPoint = { date: string; residents: number; chunks: number }

/** A town's daily census, oldest first, the last `days` days. */
export async function getTownCensus(townId: number, days = 365): Promise<CensusPoint[]> {
  try {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'town-census',
      where: {
        and: [{ town: { equals: townId } }, { date: { greater_than_equal: sinceDate(days) } }],
      },
      sort: 'date',
      select: { date: true, residents: true, chunks: true },
      ...ALL,
    })
    return docs.map((row) => ({ date: row.date, residents: row.residents, chunks: row.chunks }))
  } catch {
    return []
  }
}

/** The nation's totals per day: every Azanian town's residents and chunks, summed. */
export async function getNationCensus(days = 365): Promise<CensusPoint[]> {
  try {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'town-census',
      // Players' towns only: a held quarry's bot and fixed claims aren't growth.
      where: { and: [{ date: { greater_than_equal: sinceDate(days) } }, { 'town.kind': { equals: 'town' } }] },
      sort: 'date',
      select: { date: true, residents: true, chunks: true },
      ...ALL,
    })
    const byDay = new Map<string, CensusPoint>()
    for (const row of docs) {
      const day = byDay.get(row.date) ?? { date: row.date, residents: 0, chunks: 0 }
      day.residents += row.residents
      day.chunks += row.chunks
      byDay.set(row.date, day)
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}

const sinceDate = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

export const findTown = (data: MapData, slug: string): MapTown | null =>
  data.towns.find((town) => town.slug === slug) ?? null
export const findPlace = (data: MapData, id: number): MapPlace | null =>
  data.places.find((place) => place.id === id) ?? null
export const findRoad = (data: MapData, id: number): MapRoad | null =>
  data.roads.find((road) => road.id === id) ?? null
export const findEvent = (data: MapData, id: number): MapEvent | null =>
  data.events.find((event) => event.id === id) ?? null

/** A town's full record, for its page: the about text and the residents' names. */
export async function getTownRecord(
  id: number,
): Promise<{ about: string | null; residents: string[]; culture: string | null } | null> {
  try {
    const payload = await getClient()
    const town = await payload.findByID({ collection: 'towns', id, depth: 0 })
    const residents = Array.isArray(town.residents)
      ? town.residents.filter((name): name is string => typeof name === 'string')
      : []
    return { about: town.about ?? null, residents, culture: town.culture ?? null }
  } catch {
    return null
  }
}

/** A stored town in the shape the Rulercraft map gives it (src/lib/dynmap.ts → Town). */
const townOf = (doc: TownDoc): Town => ({
  id: doc.townyId ?? null,
  name: doc.name,
  home:
    doc.home?.x != null && doc.home?.z != null
      ? { x: doc.home.x, y: doc.home.y ?? 64, z: doc.home.z }
      : null,
  outlines: Array.isArray(doc.claims) ? (doc.claims as Outline[]) : [],
  outposts: spawnsFrom(doc.outposts),
  ruler: doc.ruler ?? null,
  residents: Array.isArray(doc.residents)
    ? doc.residents.filter((name): name is string => typeof name === 'string')
    : [],
  nation: doc.nation ?? null,
  culture: doc.culture ?? null,
  founded: doc.founded ?? null,
  publicSpawn: doc.publicSpawn ?? null,
  kind: isTownKind(doc.kind) ? doc.kind : 'town',
  siteNote: doc.siteNote ?? null,
  income: doc.income ?? null,
  resource: doc.resource ?? null,
})

/** Any town on the live map, by lower-cased name, kept an hour; throws while the map is down, so that isn't kept. */
const liveTown = unstable_cache(
  async (key: string): Promise<Town | null> => {
    const towns = await getTowns()
    if (!towns) throw new Error('The Rulercraft map is not answering.')
    return towns.get(key) ?? null
  },
  ['rulercraft-town'],
  { revalidate: 3600 },
)

/**
 * A town by name for the Map block and its clippings. Azania's own come from
 * the database, synced from the Rulercraft map every day, so a page with a
 * town map neither waits on the map's 5 MB marker file nor stops being
 * cached; any other town comes from the live map, its answer kept an hour
 * (the read inside unstable_cache doesn't make the page dynamic). Null when
 * there's no such town; 'offline' when only the live map could say, and it
 * isn't answering.
 */
export async function getTownByName(name: string | null | undefined): Promise<Town | null | 'offline'> {
  const wanted = name?.trim()
  if (!wanted) return null
  const key = wanted.toLowerCase()
  try {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'towns',
      where: {
        and: [{ name: { like: wanted } }, { azanian: { equals: true } }, { present: { equals: true } }],
      },
      limit: 10,
      depth: 0,
    })
    const stored = docs.find((doc) => doc.name.toLowerCase() === key)
    if (stored) return townOf(stored)
  } catch {
    // No database (a build before it exists): ask the live map.
  }
  try {
    return await liveTown(key)
  } catch {
    return 'offline'
  }
}

/** A map view by id, for the Map block and for ?view=. */
export async function getMapView(id: number): Promise<MapViewData | null> {
  try {
    const payload = await getClient()
    const doc = await payload.findByID({ collection: 'map-views', id, depth: 0 })
    return mapView(doc)
  } catch {
    return null
  }
}
