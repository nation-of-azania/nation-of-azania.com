import {
  mapEvent,
  mapPlace,
  mapRoad,
  mapView,
  type MapEvent,
  type MapPlace,
  type MapRoad,
  type MapViewData,
} from '@/maps/data'
import type { Event, MapView, Place, Road } from '@/payload-types'

/**
 * Azania Maps' writes go through Payload's REST API from the browser, as
 * the signed-in person (the session cookie goes along), so every rule in
 * the collections applies: a mayor who reaches outside their claims is
 * refused with the server's own message, and the panels show it as it is.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

type PayloadErrors = {
  errors?: { message?: string; data?: { errors?: { message?: string; path?: string }[] } }[]
  message?: string
}

/** The message Payload put in its JSON, or a plain one for the status. */
async function errorOf(response: Response): Promise<ApiError> {
  let message = ''
  try {
    const body = (await response.json()) as PayloadErrors
    const first = body.errors?.[0]
    const field = first?.data?.errors?.[0]
    message = field?.message
      ? `${field.path ? `${field.path}: ` : ''}${field.message}`
      : (first?.message ?? body.message ?? '')
  } catch {
    // Not JSON: fall through to the status.
  }
  if (!message) {
    message =
      response.status === 401
        ? 'You’re signed out. Sign in and try again.'
        : response.status === 403
          ? 'You may not change this.'
          : `The Registry answered ${response.status}.`
  }
  return new ApiError(message, response.status)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
  if (!response.ok) throw await errorOf(response)
  return (await response.json()) as T
}

const write = <T>(method: 'POST' | 'PATCH', path: string, data: unknown) =>
  request<{ doc: T }>(path, { method, body: JSON.stringify(data) }).then((body) => body.doc)

export type PlaceInput = {
  name: string
  category: string
  description?: string
  point: { x: number; y?: number | null; z: number }
  outline?: [number, number][] | null
}

export type RoadInput = { name?: string; kind: string; line: [number, number][] }

export type EventInput = {
  title: string
  description?: string
  startsAt: string
  endsAt?: string | null
  place?: number | null
  point?: { x: number; z: number } | null
  host?: string
  article?: number | null
}

export type ViewInput = {
  title: string
  centre: { x: number; z: number }
  span: number
  aspect: string
  map: string
  layers: string[]
  drawings: unknown[]
}

export const api = {
  savePlace: async (id: number | null, data: PlaceInput): Promise<MapPlace> => {
    const doc = await (id
      ? write<Place>('PATCH', `/api/places/${id}?depth=0`, data)
      : write<Place>('POST', '/api/places?depth=0', data))
    return mapPlace(doc)!
  },
  saveRoad: async (id: number | null, data: RoadInput): Promise<MapRoad> => {
    const doc = await (id
      ? write<Road>('PATCH', `/api/roads/${id}?depth=0`, data)
      : write<Road>('POST', '/api/roads?depth=0', data))
    return mapRoad(doc)!
  },
  saveEvent: async (id: number | null, data: EventInput): Promise<MapEvent> => {
    const doc = await (id
      ? write<Event>('PATCH', `/api/events/${id}?depth=0`, data)
      : write<Event>('POST', '/api/events?depth=0', data))
    return mapEvent(doc)!
  },
  saveView: async (id: number | null, data: ViewInput): Promise<MapViewData> => {
    const doc = await (id
      ? write<MapView>('PATCH', `/api/map-views/${id}?depth=0`, data)
      : write<MapView>('POST', '/api/map-views?depth=0', data))
    return mapView(doc)!
  },
  saveAbout: (id: number, about: string) =>
    write<unknown>('PATCH', `/api/towns/${id}?depth=0`, { about }),
  remove: (collection: 'places' | 'roads' | 'events' | 'map-views', id: number) =>
    request<unknown>(`/api/${collection}/${id}`, { method: 'DELETE' }),
  view: async (id: number): Promise<MapViewData | null> => {
    const doc = await request<MapView>(`/api/map-views/${id}?depth=0`)
    return mapView(doc)
  },
  myViews: async (userId: number | null): Promise<MapViewData[]> => {
    const where = userId ? `&where[createdBy][equals]=${userId}` : ''
    const body = await request<{ docs: MapView[] }>(
      `/api/map-views?depth=0&limit=50&sort=-updatedAt${where}`,
    )
    return body.docs.map(mapView).filter((view): view is MapViewData => view !== null)
  },
  articles: async (query: string): Promise<{ id: number; title: string }[]> => {
    const params = new URLSearchParams({
      depth: '0',
      limit: '8',
      'where[_status][equals]': 'published',
      'where[title][like]': query,
    })
    const body = await request<{ docs: { id: number; title: string }[] }>(`/api/articles?${params}`)
    return body.docs.map((doc) => ({ id: doc.id, title: doc.title }))
  },
}
