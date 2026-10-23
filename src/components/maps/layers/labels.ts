import type { Abroad } from '@/maps/abroad'
import type { MapEvent, MapPlace, MapRoad, MapTown } from '@/maps/data'
import type { Drawing } from '@/maps/registry'
import type { EventPhase } from '@/maps/time'

import {
  EMPTY_ABROAD_PLAN,
  HOME_NAME_FIRST,
  placeAbroadNames,
  placeHomeName,
  type AbroadPlan,
  type HomeNation,
} from './AbroadLayer'
import { reserveDrawings } from './DrawingsLayer'
import { eventMarks, markRect, placeEventNames, type EventName } from './EventsLayer'
import { pinRect, placePins, placePlaceNames, type PlaceName } from './PlacesLayer'
import { LabelPlacer, type Projection } from './projection'
import { placeRoadNames, type RoadName } from './RoadsLayer'
import { placeTownNames, type TownLabel } from './TownsLayer'

/** Where every name on the map goes, decided once per view, before anything is drawn. */
export type LabelPlan = {
  towns: Map<number, TownLabel>
  roads: Map<number, RoadName>
  places: Map<number, PlaceName>
  events: Map<number, EventName>
  /** The world's names, when the live map draws it: its towns', and far out the nations'. */
  abroad: AbroadPlan
}

/**
 * The map's labels have a pecking order, and this settles it in one pass:
 * what a writer drew on a map view outranks the map's own names, no name
 * ever covers a pin or a mark, and then the names are placed in turn —
 * towns, roads, places, events — each taking a free spot or stepping
 * aside. One pure pass rather than claims made while drawing, so a layer
 * rendered twice (as React does to check) decides the same. Hosts (the
 * live map, an article's still, an embedded map) plan here, so all three
 * agree; a layer left out of the plan draws no names. The live map plans
 * the world's echoes after the real world, on the same placer, so a name
 * across a seam steps aside like any other. The rest of the world, which
 * only the live map draws, is named last of all: Azania's names outrank
 * every other nation's.
 */
export function planLabels(
  projection: Projection,
  {
    towns = [],
    roads = [],
    places = [],
    events = [],
    drawings = [],
    now,
    phases,
    selectedPlace = null,
    selectedEvent = null,
    abroad = null,
  }: {
    towns?: MapTown[]
    roads?: MapRoad[]
    places?: MapPlace[]
    events?: MapEvent[]
    drawings?: Drawing[]
    now: number
    phases?: EventPhase[]
    selectedPlace?: number | null
    selectedEvent?: number | null
    /** The world abroad, and Azania itself among the nations far out. */
    abroad?: { world: Abroad; home: HomeNation | null } | null
  },
  placer = new LabelPlacer(),
): LabelPlan {
  reserveDrawings(placer, projection, drawings)
  const pins = placePins(projection, places, selectedPlace)
  if (pins) for (const pin of pins.items) placer.claim(pinRect(pin))
  const marks = eventMarks(projection, events, now, phases, selectedEvent)
  for (const mark of marks) placer.claim(markRect(mark))
  // Azania's own name far out: before its towns' at the scale of the world, where they crowd; after them nearer.
  const home = abroad?.home ?? null
  const early = home && projection.zoom <= HOME_NAME_FIRST ? placeHomeName(projection, home, placer) : null
  const plan = {
    towns: placeTownNames(projection, towns, placer),
    roads: placeRoadNames(projection, roads, placer),
    places: pins && !pins.clustered ? placePlaceNames(projection, pins.items, placer, selectedPlace) : new Map(),
    events: placeEventNames(projection, marks, placer, selectedEvent),
  }
  const late = home && projection.zoom > HOME_NAME_FIRST ? placeHomeName(projection, home, placer) : null
  if (!abroad) return { ...plan, abroad: EMPTY_ABROAD_PLAN }
  const world = placeAbroadNames(projection, abroad.world, placer)
  const homeName = early ?? late
  if (homeName) world.nations.set('', homeName)
  return { ...plan, abroad: world }
}
