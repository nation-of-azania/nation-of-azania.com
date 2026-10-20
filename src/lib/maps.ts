import config from '@payload-config'
import { getPayload, type Where } from 'payload'
import { cache } from 'react'

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
import type { Article } from '@/payload-types'

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
    const [towns, places, roads, events] = await Promise.all([
      payload.find({
        collection: 'towns',
        where: { and: [{ azanian: { equals: true } }, { present: { equals: true } }] },
        sort: 'name',
        ...ALL,
      }),
      payload.find({ collection: 'places', sort: 'name', ...ALL }),
      payload.find({ collection: 'roads', sort: 'name', ...ALL }),
      payload.find({ collection: 'events', sort: 'startsAt', ...ALL }),
    ])
    const present = <T>(value: T | null): value is T => value !== null
    return {
      towns: towns.docs.map(mapTown),
      places: places.docs.map(mapPlace).filter(present),
      roads: roads.docs.map(mapRoad).filter(present),
      events: events.docs.map(mapEvent).filter(present),
    }
  } catch {
    return { towns: [], places: [], roads: [], events: [] }
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
      where: { date: { greater_than_equal: sinceDate(days) } },
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
