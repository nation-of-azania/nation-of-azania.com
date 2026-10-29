import type { Access, PayloadRequest } from 'payload'

import { hasRole } from './index'
import { getScope, NOTHING } from './scope'

/**
 * Who may draw on Azania Maps. Places, roads and events belong to the town
 * whose claims hold them:
 *  - staff (editors, admins) and cartographers draw anywhere, including
 *    between towns (national roads, landmarks);
 *  - a mayor draws inside their own towns' claims, and edits what is there;
 *  - everyone else looks.
 * Mayors and cartographers are granted by admins on the user's account
 * (Users → Azania Maps). Map views, the highlights drawn for articles, belong
 * to whoever drew them and are for people who write articles.
 */
export type MapRights = {
  /** Staff or cartographer: anywhere on the map. */
  anywhere: boolean
  /** Town ids the user is mayor of. */
  towns: number[]
}

type MapUser = {
  id?: number
  role?: 'resident' | 'editor' | 'admin' | null
  cartographer?: boolean | null
  mayorOf?: (number | { id: number })[] | null
} | null

const idOf = (value: number | { id: number }) => (typeof value === 'number' ? value : value.id)

export function getMapRights(user: unknown): MapRights {
  const candidate = user as MapUser
  return {
    anywhere: hasRole(candidate, 'editor', 'admin') || Boolean(candidate?.cartographer),
    towns: (candidate?.mayorOf ?? []).map(idOf).filter((id): id is number => typeof id === 'number'),
  }
}

export const canDrawOnMap = (rights: MapRights): boolean => rights.anywhere || rights.towns.length > 0

/**
 * Who may set Azania's stance toward other nations from Azania Maps: admins,
 * and the people they make diplomats (Users → Azania Maps). The stances are
 * also under Settings → Azania Maps, for admins.
 */
export const canSetDiplomacy = (user: unknown): boolean =>
  hasRole(user as MapUser, 'admin') || Boolean((user as { diplomat?: boolean | null } | null)?.diplomat)

/** Places, roads, events: create if you may draw anywhere at all (the town is checked on save). */
export const createMapFeature: Access = ({ req }) => canDrawOnMap(getMapRights(req.user))

/** Places, roads, events: change what lies in your towns, or anything for staff and cartographers. */
export const editMapFeature: Access = ({ req }) => {
  const rights = getMapRights(req.user)
  if (rights.anywhere) return true
  if (rights.towns.length) return { town: { in: rights.towns } }
  return false
}

/** Whether the user may draw map views for articles: staff, cartographers, and anyone who writes somewhere. */
export async function canDrawViews(req: PayloadRequest): Promise<boolean> {
  if (!req.user) return false
  if (getMapRights(req.user).anywhere) return true
  const scope = await getScope(req)
  return scope.levels.size > 0
}

export const createMapView: Access = ({ req }) => canDrawViews(req)

/** Your own views; staff edit all. */
export const editMapView: Access = ({ req }) => {
  if (hasRole(req.user, 'editor', 'admin')) return true
  if (req.user) return { createdBy: { equals: req.user.id } }
  return NOTHING
}
