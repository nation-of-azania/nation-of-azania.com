import type { Point, RoadShape } from '@/maps/geo'
import type { Drawing, Ink, MapLayer, PlaceCategory, RoadKind, ViewAspect } from '@/maps/registry'

import { samePoints } from './editor/points'

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

export type RoadDraft = {
  name: string
  kind: RoadKind
  line: Point[]
  /** Straight from point to point (the everyday choice), or curved smoothly through them. */
  shape: RoadShape
  /** In a curved road, the points kept as sharp turns, by index. */
  corners: number[]
}

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
      /** The outline's point picked for more (remove), by index. */
      vertex: number | null
    }
  | {
      kind: 'road'
      id: number | null
      draft: RoadDraft
      /** Clicks add points to the line. */
      drawing: boolean
      /** The point picked for more (remove, a sharp corner, carrying on), by index. */
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
      /** Of the selected line or area, the point picked for more, by index. */
      vertex: number | null
      /** Points of a line or area in progress. */
      pending: Point[]
      /** Owner, for staff editing someone else's. */
      createdBy: number | null
    }
  | { kind: 'views'; everyone: boolean }
  | { kind: 'about'; town: number; text: string }

export const emptyPlace = (): PlaceDraft => ({
  name: '',
  category: 'landmark',
  description: '',
  y: '',
  point: null,
  outline: [],
})
export const emptyRoad = (): RoadDraft => ({
  name: '',
  kind: 'street',
  line: [],
  shape: 'straight',
  corners: [],
})
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
export const emptyView = (layers: MapLayer[]): ViewDraft => ({
  title: '',
  aspect: 'wide',
  layers,
  drawings: [],
})

/** The view editor, opened on a view to redraw it, or empty for a new one. */
export const viewEditor = (
  view: { id: number; title: string; aspect: ViewAspect; layers: MapLayer[]; drawings: Drawing[]; createdBy: number | null } | null,
  layers: MapLayer[],
): Extract<Editor, { kind: 'view' }> => ({
  kind: 'view',
  id: view?.id ?? null,
  draft: view
    ? { title: view.title, aspect: view.aspect, layers: view.layers, drawings: view.drawings }
    : emptyView(layers),
  tool: view ? 'select' : 'pen',
  ink: 'red',
  weight: 2,
  arrow: false,
  selected: null,
  vertex: null,
  pending: [],
  createdBy: view?.createdBy ?? null,
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

/**
 * What undo and redo step through: the shape of what's drawn — points,
 * corners, highlights — and not the words typed beside it, which the
 * fields undo themselves. Taken from the editor after every change.
 */
export type Snapshot =
  | { kind: 'place'; point: Point | null; outline: Point[] }
  | { kind: 'road'; line: Point[]; shape: RoadShape; corners: number[] }
  | { kind: 'view'; drawings: Drawing[]; pending: Point[] }

export function snapshotOf(editor: Editor | null): Snapshot | null {
  if (!editor) return null
  switch (editor.kind) {
    case 'place':
      return { kind: 'place', point: editor.draft.point, outline: editor.draft.outline }
    case 'road':
      return {
        kind: 'road',
        line: editor.draft.line,
        shape: editor.draft.shape,
        corners: editor.draft.corners,
      }
    case 'view':
      return { kind: 'view', drawings: editor.draft.drawings, pending: editor.pending }
    default:
      return null
  }
}

/** Whether two snapshots show the same thing, by value. */
export function sameSnapshot(a: Snapshot | null, b: Snapshot | null): boolean {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind) return false
  switch (a.kind) {
    case 'place': {
      const other = b as Extract<Snapshot, { kind: 'place' }>
      return samePoints(a.point ? [a.point] : [], other.point ? [other.point] : []) && samePoints(a.outline, other.outline)
    }
    case 'road': {
      const other = b as Extract<Snapshot, { kind: 'road' }>
      return (
        a.shape === other.shape &&
        a.corners.length === other.corners.length &&
        a.corners.every((c, i) => c === other.corners[i]) &&
        samePoints(a.line, other.line)
      )
    }
    case 'view': {
      const other = b as Extract<Snapshot, { kind: 'view' }>
      return (
        samePoints(a.pending, other.pending) &&
        a.drawings.length === other.drawings.length &&
        a.drawings.every((d, i) => d === other.drawings[i])
      )
    }
  }
}

/** The editor as it was at a snapshot, keeping its words and tools; nothing stays picked that may be gone. */
export function withSnapshot(editor: Editor, snapshot: Snapshot): Editor {
  if (editor.kind === 'place' && snapshot.kind === 'place') {
    return {
      ...editor,
      vertex: null,
      draft: { ...editor.draft, point: snapshot.point, outline: snapshot.outline },
    }
  }
  if (editor.kind === 'road' && snapshot.kind === 'road') {
    return {
      ...editor,
      vertex: null,
      draft: { ...editor.draft, line: snapshot.line, shape: snapshot.shape, corners: snapshot.corners },
    }
  }
  if (editor.kind === 'view' && snapshot.kind === 'view') {
    return {
      ...editor,
      vertex: null,
      selected: editor.selected != null && editor.selected < snapshot.drawings.length ? editor.selected : null,
      pending: snapshot.pending,
      draft: { ...editor.draft, drawings: snapshot.drawings },
    }
  }
  return editor
}
