import { homeNationOf, type Abroad } from './abroad'
import type { MapData } from './data'
import { azaniaSide, type SiegeOnMap } from './sieges'
import type { Siege } from './world'

/**
 * The sieges as the maps draw them, apart from the words the panels and the
 * front say them in (./sieges.ts), which ride with the map's first load:
 * only the drawings need this, the flat map's layers
 * (src/components/maps/MapScene.tsx) and the globe's
 * (src/components/maps/globe/Globe.tsx).
 */

/**
 * The sieges as the flat map's layers and the globe draw them: each with
 * Azania's side in it, and its town's claims and home, from Azania's own
 * towns (matched by Towny's id first) or else the world's.
 */
export function siegesOnMap(sieges: Siege[], data: Pick<MapData, 'towns'>, abroad: Abroad | null): SiegeOnMap[] {
  const home = { nation: homeNationOf(data.towns), towns: data.towns }
  return sieges.map((siege) => {
    const own = data.towns.find((town) => town.townyId === siege.townId)
    const other = own ? null : abroad?.byId.get(siege.townId)
    const town = own ?? other
    return { siege, side: azaniaSide(siege, home), town: town ? { claims: town.claims, home: town.home } : null }
  })
}
