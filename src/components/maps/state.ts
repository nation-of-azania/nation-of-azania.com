import type { MapViewData } from '@/maps/data'
import type { Point } from '@/maps/geo'
import type { Drawing, Ink, MapLayer, PlaceCategory, RoadKind, ViewAspect } from '@/maps/registry'
import type { MapName } from '@/maps/source'

/**
 * What the editor on /maps is doing, if anything: one of these at a time,
 * held by the shell (./MapsShell.tsx), drawn by the scene (./MapScene.tsx)
 * and edited in the panel (./editor). Geometry lives in blocks, like the
 * collections; the scene projects it.
 */

export type PlaceDraft = {
  name: string
  category: PlaceCategory
  description: string
  y: string
  point: Point | null
  outline: Point[]
}

export type RoadDraft = { name: string; kind: RoadKind; line: Point[] }

export type EventDraft = {
  title: string
  description: string
  startsAt: string
  endsAt: string
  host: string
  place: number | null
  point: Point | null
  article: { id: number; title: string } | null
}

export type ViewDraft = {
  title: string
  aspect: ViewAspect
  map: MapName
  layers: MapLayer[]
  drawings: Drawing[]
}

export type HighlightTool = 'select' | 'pen' | 'line' | 'area' | 'pin' | 'text'

export type Editor =
  | {
      kind: 'place'
      id: number | null
      draft: PlaceDraft
      /** Waiting for a click to set the pin. */
      placing: boolean
      /** Clicks add points to the outline. */
      tracing: boolean
    }
  | {
      kind: 'road'
      id: number | null
      draft: RoadDraft
      /** Clicks add points to the line. */
      drawing: boolean
      /** The vertex picked for removal. */
      vertex: number | null
    }
  | { kind: 'event'; id: number | null; draft: EventDraft; picking: boolean }
  | {
      kind: 'view'
      id: number | null
      draft: ViewDraft
      tool: HighlightTool
      ink: Ink
      weight: 1 | 2 | 3
      arrow: boolean
      /** The drawing being edited (index into draft.drawings). */
      selected: number | null
      /** Points of a line or area in progress. */
      pending: Point[]
      /** Owner, for staff editing someone else's. */
      createdBy: number | null
    }
  | { kind: 'views'; list: MapViewData[] | null; everyone: boolean }
  | { kind: 'about'; town: number; text: string }

export const emptyPlace = (): PlaceDraft => ({
  name: '',
  category: 'landmark',
  description: '',
  y: '',
  point: null,
  outline: [],
})
export const emptyRoad = (): RoadDraft => ({ name: '', kind: 'street', line: [] })
export const emptyEvent = (): EventDraft => ({
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  host: '',
  place: null,
  point: null,
  article: null,
})
export const emptyView = (map: MapName, layers: MapLayer[]): ViewDraft => ({
  title: '',
  aspect: 'wide',
  map,
  layers,
  drawings: [],
})

/** Whether a click on the map is wanted by the editor just now. */
export function editorWantsClicks(editor: Editor | null): boolean {
  if (!editor) return false
  switch (editor.kind) {
    case 'place':
      return editor.placing || editor.tracing
    case 'road':
      return editor.drawing
    case 'event':
      return editor.picking
    case 'view':
      return editor.tool !== 'select'
    default:
      return false
  }
}
