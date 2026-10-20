import type { MapData, MapRights } from '@/maps/data'
import { inOutlines, type Point } from '@/maps/geo'

/**
 * The editor's pre-check of what the server will check on save
 * (src/collections/maps/shared.ts): a mayor's drawings must lie inside
 * their own towns' claims. Leaflet-free, so the forms can use it on the
 * server-rendered side of the page.
 */

/** Where a mayor may draw, if they're bound to their towns; null for anyone who draws anywhere. */
export function claimsOf(data: MapData, rights: MapRights) {
  if (rights.anywhere) return null
  return data.towns.filter((town) => rights.towns.includes(town.id)).flatMap((town) => town.claims)
}

/** Whether every point lies in the mayor's claims (always, for those who draw anywhere). */
export function withinRights(points: Point[], data: MapData, rights: MapRights): boolean {
  const claims = claimsOf(data, rights)
  if (!claims) return true
  return points.every((point) => inOutlines(point, claims))
}
