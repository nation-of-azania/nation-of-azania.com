import type { MapEvent, MapPlace, MapRoad, MapTown } from '@/maps/data'
import type { Drawing } from '@/maps/registry'
import type { EventPhase } from '@/maps/time'

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
}

/**
 * The map's labels have a pecking order, and this settles it in one pass:
 * what a writer drew on a map view outranks the map's own names, no name
 * ever covers a pin or a mark, and then the names are placed in turn —
 * towns, roads, places, events — each taking a free spot or stepping
 * aside. One pure pass rather than claims made while drawing, so a layer
 * rendered twice (as React does to check) decides the same. Hosts (the
 * live map, an article's still, an embedded map) plan here, so all three
 * agree; a layer left out of the plan draws no names.
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
  },
): LabelPlan {
  const placer = new LabelPlacer()
  reserveDrawings(placer, projection, drawings)
  const pins = placePins(projection, places, selectedPlace)
  if (pins) for (const pin of pins.items) placer.claim(pinRect(pin))
  const marks = eventMarks(projection, events, now, phases, selectedEvent)
  for (const mark of marks) placer.claim(markRect(mark))
  return {
    towns: placeTownNames(projection, towns, placer),
    roads: placeRoadNames(projection, roads, placer),
    places: pins && !pins.clustered ? placePlaceNames(projection, pins.items, placer, selectedPlace) : new Map(),
    events: placeEventNames(projection, marks, placer, selectedEvent),
  }
}
