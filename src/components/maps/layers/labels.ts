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
import { placeSiegeNames, siegeMarkRect, siegeMarks, type SiegeMark, type SiegeName, type SiegeOnMap } from './SiegesLayer'
import { placeTownNames, type OutpostLabel, type TownLabel } from './TownsLayer'

/** Where every name on the map goes, decided once per view, before anything is drawn. */
export type LabelPlan = {
  towns: Map<number, TownLabel>
  /** The towns' outposts' names, by town and part (TownsLayer → TownNames). */
  outposts: Map<string, OutpostLabel>
  roads: Map<number, RoadName>
  places: Map<number, PlaceName>
  events: Map<number, EventName>
  /** The world's names, when the live map draws it: its towns', and far out the nations'. */
  abroad: AbroadPlan
  /** The sieges' marks on the page and their names. */
  sieges: { marks: SiegeMark[]; names: Map<string, SiegeName> }
}

/**
 * The map's labels have a pecking order, and this settles it in one pass:
 * what a writer drew on a map view outranks the map's own names, no name
 * ever covers a pin or a mark, and then the names are placed in turn —
 * towns (their outposts after every town), roads, places, events — each
 * taking a free spot or stepping aside. One pure pass rather than claims
 * made while drawing, so a layer rendered twice (as React does to check)
 * decides the same. Hosts (the
 * live map, an article's still, an embedded map) plan here, so all three
 * agree; a layer left out of the plan draws no names. The live map plans
 * the world's echoes after the real world, on the same placer, so a name
 * across a seam steps aside like any other. The rest of the world, which
 * only the live map draws, is named last of all: Azania's names outrank
 * every other nation's. A siege outranks nearly everything: its mark takes
 * its room with the pins, and a siege Azania is in is named before
 * Azania's own towns; any other, after them. The live map's own canvas
 * asks, besides, that each name say how it may move mid-gesture and
 * that what lost be kept in reserve (`reserve`), for the names to be
 * placed again every frame as the map moves (leaflet/placing.ts).
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
    sieges = [],
    reserve = false,
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
    /** The sieges on the server, each with Azania's side in it. */
    sieges?: SiegeOnMap[]
    /**
     * Whether names that lost, or would be named a little further in, are
     * kept in reserve, drawn hidden, for the live map to bring in as the
     * map moves (leaflet/placing.ts). Only the map's own canvas asks;
     * without it the plan is as it always was, so an article's still and
     * its embedded map draw exactly what they drew.
     */
    reserve?: boolean
  },
  placer = new LabelPlacer(),
): LabelPlan {
  reserveDrawings(placer, projection, drawings)
  const pins = placePins(projection, places, selectedPlace)
  if (pins) for (const pin of pins.items) placer.claim(pinRect(pin))
  const marks = eventMarks(projection, events, now, phases, selectedEvent)
  for (const mark of marks) placer.claim(markRect(mark))
  const war = siegeMarks(projection, sieges)
  for (const mark of war) placer.claim(siegeMarkRect(mark))
  const ours = placeSiegeNames(projection, war, placer, true)
  // Azania's own name far out: before its towns' at the scale of the world, where they crowd; after them nearer.
  const home = abroad?.home ?? null
  const early = home && projection.zoom <= HOME_NAME_FIRST ? placeHomeName(projection, home, placer, reserve) : null
  const named = placeTownNames(projection, towns, placer, reserve)
  const plan = {
    towns: named.towns,
    outposts: named.outposts,
    roads: placeRoadNames(projection, roads, placer),
    places: pins && !pins.clustered ? placePlaceNames(projection, pins.items, placer, selectedPlace) : new Map(),
    events: placeEventNames(projection, marks, placer, selectedEvent),
  }
  const late = home && projection.zoom > HOME_NAME_FIRST ? placeHomeName(projection, home, placer, reserve) : null
  const others = placeSiegeNames(projection, war, placer, false, reserve)
  const besieged = { marks: war, names: new Map([...ours, ...others]) }
  if (!abroad) return { ...plan, abroad: EMPTY_ABROAD_PLAN, sieges: besieged }
  const world = placeAbroadNames(projection, abroad.world, home?.name ?? null, placer, reserve)
  const homeName = early ?? late
  if (homeName) world.nations.set('', homeName)
  return { ...plan, abroad: world, sieges: besieged }
}
