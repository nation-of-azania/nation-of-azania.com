'use client'

import { createContext, useContext } from 'react'

import type { Abroad } from '@/maps/abroad'
import type { MapData, MapEvent, MapPlace, MapRights, MapRoad, MapTown, MapViewData, Relation } from '@/maps/data'
import type { Bounds } from '@/maps/geo'
import type { MapLayer } from '@/maps/registry'
import type { ExtraLayer, Extras, MapSelection } from '@/maps/url'

import type { Store } from './hooks'
import type { LiveState } from './live'
import type { LookTarget } from './MapScene'
import type { Editor } from './state'
import type { WarState } from './war'
import type { WorldState } from './world'

/**
 * A change to the editor: the next state, or a function of the current
 * one for changes that come thick and fast (a drag), so none is lost.
 */
export type EditorUpdate = Editor | null | ((current: Editor | null) => Editor | null)

/** Whether the visitor's rights are being asked for, known, or out of reach. */
export type RightsStatus = 'asking' | 'known' | 'unreachable'

/**
 * What the panels and controls on /maps can ask of the shell: open
 * something, look somewhere, start editing. Server-rendered panels reach
 * it through small client islands (./panels/islands.tsx).
 */
export type MapsActions = {
  data: MapData
  rights: MapRights
  /** Only 'known' means the Registry has said who the visitor is; 'unreachable' is no answer. */
  rightsStatus: RightsStatus
  /** Ask the Registry again who the visitor is. */
  retryRights: () => void
  selection: MapSelection | null
  editor: Editor | null
  /** Which of the map's layers show. */
  layers: MapLayer[]
  /** The clock the events are judged by, ticking once a minute. */
  now: number
  /** Opens a page; `focus`, where to look once it lands instead of at it: a town's outpost, or its detached claims, clicked. */
  select: (selection: MapSelection | null, focus?: Bounds) => void
  look: (target: LookTarget) => void
  edit: (editor: Editor) => void
  closeEditor: () => void
  /** Show an article's view on the map: framed on it, with its highlights. */
  showView: (view: MapViewData) => void
  editPlace: (place: MapPlace) => void
  editRoad: (road: MapRoad) => void
  editEvent: (event: MapEvent) => void
  editAbout: (town: MapTown, text: string) => void
  /** Rejects with the Registry's reason, or the plain line for an unreachable one. */
  remove: (kind: 'place' | 'road' | 'event', id: number) => Promise<void>
  /** Whether the visitor may change a feature in this town (null: between towns). */
  mayEdit: (town: number | null) => boolean
  /** After a save: have the cached pages regenerated, then fetch the fresh one. */
  refresh: () => void
  /** A step back, or forward again, through what's been drawn this session. */
  undo: () => void
  redo: () => void
  /** Whether there is anything to undo or redo; read with useStore. */
  historyStore: Store<{ canUndo: boolean; canRedo: boolean }>
  /** The rest of the world, once it has arrived (/maps/world.json), and how the asking goes. */
  world: Abroad | null
  worldStatus: WorldState['status']
  /** A page abroad says where its town or nation is, so the map can open there before the world arrives. */
  arrive: (target: LookTarget) => void
  /** The layers beyond the nation's own (the world, diplomacy, the players online), and turning one on or off. */
  extras: Extras
  setExtra: (layer: ExtraLayer, on: boolean) => void
  /** The war on the server (/maps/war), polled while the tab is seen; and a siege's card opened, by its town's Towny id. */
  war: WarState
  openSiege: (townId: string) => void
  /**
   * Azania's diplomacy as a diplomat has just set it (panels/Stance.tsx):
   * kept in the browser, ahead of the cached pages, so the layer, its key
   * and the panels change at once; the server's own copy takes over when
   * the pages come back fresh.
   */
  setRelations: (relations: Relation[]) => void
  /** The players online, as the live layer polls them (./live.ts): read with useStore; 'off' while the layer is off. */
  liveStore: Store<LiveState>
}

export const MapsContext = createContext<MapsActions | null>(null)

export function useMaps(): MapsActions {
  const value = useContext(MapsContext)
  if (!value) throw new Error('useMaps needs the Azania Maps shell above it.')
  return value
}

/** The same, or null outside the shell (for components that also render elsewhere). */
export const useMapsIfAny = (): MapsActions | null => useContext(MapsContext)
