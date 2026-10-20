import { APIError, type CollectionBeforeChangeHook, type Field, type PayloadRequest } from 'payload'

import { hasRole } from '../../access'
import { getMapRights } from '../../access/maps'
import { inOutlines, isCoordinate, isPoint, samplePath, type Outline, type Point } from '../../maps/geo'

/** A block position as two number fields, x and z, with an optional height. */
export const pointField = ({
  name,
  label,
  required = false,
  description,
  height = false,
}: {
  name: string
  label?: string
  required?: boolean
  description?: string
  height?: boolean
}): Field => {
  const coordinate = (value: unknown) =>
    value == null ? !required || 'Required.' : isCoordinate(value) || 'A block coordinate on the map.'
  return {
    name,
    label,
    type: 'group',
    admin: { description },
    fields: [
      {
        type: 'row',
        fields: [
          { name: 'x', type: 'number', required, validate: coordinate, admin: { width: height ? '33%' : '50%' } },
          ...(height
            ? [
                {
                  name: 'y',
                  type: 'number' as const,
                  admin: { width: '33%', description: 'Height, for places underground or in the sky.' },
                },
              ]
            : []),
          { name: 'z', type: 'number', required, validate: coordinate, admin: { width: height ? '33%' : '50%' } },
        ],
      },
    ],
  }
}

/** A list of [x, z] points as a JSON field. */
export const pathField = ({
  name,
  label,
  min,
  max = 2000,
  required = false,
  description,
}: {
  name: string
  label?: string
  min: number
  max?: number
  required?: boolean
  description?: string
}): Field => ({
  name,
  label,
  type: 'json',
  required,
  admin: { description },
  validate: (value: unknown) => {
    if (value == null) return !required || 'Required.'
    return (
      (Array.isArray(value) && value.length >= min && value.length <= max && value.every(isPoint)) ||
      `${min} to ${max} points, each [x, z] in blocks.`
    )
  },
})

/** Who drew it and who changed it last; set on save, visible to staff only. */
export const authorshipFields: Field[] = [
  {
    name: 'createdBy',
    type: 'relationship',
    relationTo: 'users',
    access: { read: ({ req }) => hasRole(req.user, 'editor', 'admin'), update: () => false },
    admin: { readOnly: true, position: 'sidebar' },
  },
  {
    name: 'updatedBy',
    type: 'relationship',
    relationTo: 'users',
    access: { read: ({ req }) => hasRole(req.user, 'editor', 'admin'), update: () => false },
    admin: { readOnly: true, position: 'sidebar' },
  },
]

/** The town a feature belongs to, worked out from where it is on save. */
export const townField: Field = {
  name: 'town',
  type: 'relationship',
  relationTo: 'towns',
  index: true,
  admin: {
    readOnly: true,
    position: 'sidebar',
    description: 'Set from where it is: the Azanian town whose claims hold it. Empty between towns.',
  },
}

type ClaimedTown = { id: number; claims: Outline[] }

const TOWNS_KEY = 'azaniaClaimedTowns'

/** Azania's towns and their claims, once per request. */
export async function claimedTowns(req: PayloadRequest): Promise<ClaimedTown[]> {
  const cached = req.context[TOWNS_KEY] as Promise<ClaimedTown[]> | undefined
  if (cached) return cached
  const promise = req.payload
    .find({
      collection: 'towns',
      where: { and: [{ azanian: { equals: true } }, { present: { equals: true } }] },
      limit: 0,
      depth: 0,
      pagination: false,
      select: { claims: true },
      req,
    })
    .then(({ docs }) =>
      docs.map((town) => ({ id: town.id, claims: Array.isArray(town.claims) ? (town.claims as Outline[]) : [] })),
    )
  req.context[TOWNS_KEY] = promise
  return promise
}

/** The town whose claims hold every one of the points, if one does. */
export async function townHolding(req: PayloadRequest, points: Point[]): Promise<number | null> {
  if (points.length === 0) return null
  const towns = await claimedTowns(req)
  return towns.find((town) => points.every((point) => inOutlines(point, town.claims)))?.id ?? null
}

/**
 * Places a feature on the map as it's saved: finds the town holding it, keeps
 * mayors inside their own towns, and records who drew it. `geometry` reads
 * the feature's points from the document as it will be (saved values with
 * the change on top), so a partial update is judged on the whole feature.
 */
export const placeOnMap =
  (geometry: (doc: Record<string, unknown>, req: PayloadRequest) => Promise<Point[]> | Point[]): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req, operation }) => {
    const doc = { ...(originalDoc ?? {}), ...data }
    const points = await geometry(doc, req)
    const town = await townHolding(req, points)
    if (req.user) {
      const rights = getMapRights(req.user)
      if (!rights.anywhere && (town == null || !rights.towns.includes(town))) {
        throw new APIError('Mayors draw inside their own town’s claims. This reaches outside them.', 403, null, true)
      }
      if (operation === 'create') data.createdBy = req.user.id
      data.updatedBy = req.user.id
    }
    data.town = town
    return data
  }

export const pointOf = (value: unknown): Point | null => {
  const point = value as { x?: unknown; z?: unknown } | null | undefined
  return isCoordinate(point?.x) && isCoordinate(point?.z) ? [point.x, point.z] : null
}

/** A path's points, sampled along each segment. */
export const pathPoints = (value: unknown): Point[] =>
  Array.isArray(value) && value.every(isPoint) ? samplePath(value as Point[]) : []
