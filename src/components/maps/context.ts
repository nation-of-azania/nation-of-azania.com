'use client'

import { createContext, useContext } from 'react'

import type { MapData, MapEvent, MapPlace, MapRights, MapRoad, MapTown } from '@/maps/data'
import type { MapSelection } from '@/maps/url'

import type { LookTarget } from './MapScene'
import type { Editor } from './state'

/**
 * What the panels and controls on /maps can ask of the shell: open
 * something, look somewhere, start editing. Server-rendered panels reach
 * it through small client islands (./panels/islands.tsx).
 */
export type MapsActions = {
  data: MapData
  rights: MapRights
  selection: MapSelection | null
  editor: Editor | null
  /** The clock the events are judged by, ticking once a minute. */
  now: number
  select: (selection: MapSelection | null) => void
  look: (target: LookTarget) => void
  edit: (editor: Editor) => void
  closeEditor: () => void
  editPlace: (place: MapPlace) => void
  editRoad: (road: MapRoad) => void
  editEvent: (event: MapEvent) => void
  editAbout: (town: MapTown, text: string) => void
  remove: (kind: 'place' | 'road' | 'event', id: number) => Promise<void>
  /** Whether the visitor may change a feature in this town (null: between towns). */
  mayEdit: (town: number | null) => boolean
}

export const MapsContext = createContext<MapsActions | null>(null)

export function useMaps(): MapsActions {
  const value = useContext(MapsContext)
  if (!value) throw new Error('useMaps needs the Azania Maps shell above it.')
  return value
}

/** The same, or null outside the shell (for components that also render elsewhere). */
export const useMapsIfAny = (): MapsActions | null => useContext(MapsContext)
