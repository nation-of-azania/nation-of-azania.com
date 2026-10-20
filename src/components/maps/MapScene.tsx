'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

import type { MapData, MapRights, MapTown, MapViewData } from '@/maps/data'
import { roundPoint, type Bounds, type Point } from '@/maps/geo'
import { pixelsPerBlock } from '@/maps/palette'
import type { MapLayer, ViewAspect } from '@/maps/registry'
import type { MapName } from '@/maps/source'
import type { EventPhase } from '@/maps/time'
import type { MapPosition, MapSelection } from '@/maps/url'
import { frameInViewport, zoomForSpan } from '@/maps/view'

import { Tools } from './editor/Tools'
import { useLatest } from './hooks'
import { DrawingsLayer } from './layers/DrawingsLayer'
import { EventsLayer } from './layers/EventsLayer'
import { PlacesLayer } from './layers/PlacesLayer'
import { LabelPlacer } from './layers/projection'
import { RoadsLayer } from './layers/RoadsLayer'
import { TownLabels, TownsLayer } from './layers/TownsLayer'
import {
  fitBounds,
  flyTo,
  L,
  MapCanvas,
  MAX_ZOOM,
  toLatLng,
  toPoint,
  useProjection,
} from './leaflet/canvas'
import { editorWantsClicks, type Editor } from './state'

export type LookTarget =
  | {
      centre: Point
      zoom?: number
      /** Only zoom in as far as `zoom`; never out. */ minZoom?: boolean
    }
  | { bounds: Bounds }
  | { centre: Point; span: number; aspect: ViewAspect }

export type SceneApi = {
  look: (target: LookTarget) => void
  zoomBy: (delta: number) => void
  /** The frame a map view would save just now: its centre and how many blocks it spans. */
  frame: (aspect: ViewAspect) => { centre: Point; span: number } | null
}

export type SceneProps = {
  data: MapData
  rights: MapRights
  mapName: MapName
  layers: MapLayer[]
  showPast: boolean
  now: number
  selection: MapSelection | null
  viewing: MapViewData | null
  editor: Editor | null
  initial: MapPosition | { bounds: Bounds; padding?: number }
  onApi: (api: SceneApi) => void
  onMove: (position: MapPosition) => void
  onPointer: (point: Point | null) => void
  onSelect: (selection: MapSelection) => void
  onEditor: (editor: Editor | null) => void
}

/**
 * The map on /maps: the canvas, the nation's layers drawn on it, an
 * article's highlights when one is being shown, and the editor's own
 * marks while someone draws. The shell (./MapsShell.tsx) holds the state;
 * this turns it into the picture and sends back what the map says.
 */
export function MapScene(props: SceneProps) {
  const { mapName, initial, editor, onApi, onMove, onPointer, onEditor } = props
  const mapRef = useRef<L.Map | null>(null)
  const editorRef = useLatest(editor)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  const api = useMemo<SceneApi>(
    () => ({
      look: (target) => {
        const map = mapRef.current
        if (!map) return
        if ('bounds' in target) return fitBounds(map, target.bounds)
        if ('span' in target) {
          const size = map.getSize()
          const frame = frameInViewport({ width: size.x, height: size.y }, target.aspect)
          return flyTo(
            map,
            target.centre,
            Math.min(MAX_ZOOM, zoomForSpan(target.span, frame.width)),
          )
        }
        const zoom =
          target.zoom == null
            ? undefined
            : target.minZoom
              ? Math.max(target.zoom, map.getZoom())
              : target.zoom
        flyTo(map, target.centre, zoom)
      },
      zoomBy: (delta) => {
        const map = mapRef.current
        if (!map) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        map.setZoom(map.getZoom() + delta, { animate: !reduced })
      },
      frame: (aspect) => {
        const map = mapRef.current
        if (!map) return null
        const size = map.getSize()
        const frame = frameInViewport({ width: size.x, height: size.y }, aspect)
        const centre = map.containerPointToLatLng(
          L.point(frame.left + frame.width / 2, frame.top + frame.height / 2),
        )
        return {
          centre: roundPoint(toPoint(centre)),
          span: Math.round(frame.width / pixelsPerBlock(map.getZoom())),
        }
      },
    }),
    [],
  )

  const onReady = useCallback(
    (map: L.Map) => {
      mapRef.current = map
      const size = map.getSize()
      setViewport({ width: size.x, height: size.y })
      map.on('resize', () => {
        const next = map.getSize()
        setViewport({ width: next.x, height: next.y })
      })
      onApi(api)
    },
    [api, onApi],
  )

  // A click on the map, while a tool wants one.
  const onClick = useCallback(
    (point: Point) => {
      const current = editorRef.current
      if (!current || !editorWantsClicks(current)) return
      const at = roundPoint(point)
      const map = mapRef.current
      const nearFirst = (points: Point[]) => {
        if (!map || points.length < 3) return false
        const a = map.latLngToContainerPoint(toLatLng(points[0]))
        const b = map.latLngToContainerPoint(toLatLng(at))
        return a.distanceTo(b) < 12
      }
      switch (current.kind) {
        case 'place':
          if (current.placing)
            onEditor({ ...current, placing: false, draft: { ...current.draft, point: at } })
          else if (current.tracing) {
            if (nearFirst(current.draft.outline)) onEditor({ ...current, tracing: false })
            else
              onEditor({
                ...current,
                draft: { ...current.draft, outline: [...current.draft.outline, at] },
              })
          }
          return
        case 'road':
          if (current.drawing)
            onEditor({ ...current, draft: { ...current.draft, line: [...current.draft.line, at] } })
          return
        case 'event':
          if (current.picking)
            onEditor({
              ...current,
              picking: false,
              draft: { ...current.draft, point: at, place: null },
            })
          return
        case 'view':
          switch (current.tool) {
            case 'line':
            case 'area':
              onEditor({ ...current, pending: [...current.pending, at] })
              return
            case 'pin':
              onEditor({
                ...current,
                selected: current.draft.drawings.length,
                draft: {
                  ...current.draft,
                  drawings: [...current.draft.drawings, { kind: 'pin', at, ink: current.ink }],
                },
              })
              return
            case 'text':
              onEditor({
                ...current,
                selected: current.draft.drawings.length,
                draft: {
                  ...current.draft,
                  drawings: [
                    ...current.draft.drawings,
                    { kind: 'text', at, ink: current.ink, text: '' },
                  ],
                },
              })
              return
            default:
              return
          }
        default:
          return
      }
    },
    [onEditor, editorRef],
  )

  // A double click finishes a line; the two clicks it carries are undone.
  const onDoubleClick = useCallback(() => {
    const current = editorRef.current
    if (!current) return
    const dedupe = (points: Point[]) => {
      const out = [...points]
      while (
        out.length > 1 &&
        out[out.length - 1][0] === out[out.length - 2][0] &&
        out[out.length - 1][1] === out[out.length - 2][1]
      )
        out.pop()
      return out
    }
    if (current.kind === 'road' && current.drawing)
      onEditor({
        ...current,
        drawing: false,
        draft: { ...current.draft, line: dedupe(current.draft.line) },
      })
    if (current.kind === 'place' && current.tracing)
      onEditor({
        ...current,
        tracing: false,
        draft: { ...current.draft, outline: dedupe(current.draft.outline) },
      })
    if (current.kind === 'view' && (current.tool === 'line' || current.tool === 'area')) {
      const points = dedupe(current.pending)
      const enough = current.tool === 'line' ? points.length >= 2 : points.length >= 3
      if (!enough) return onEditor({ ...current, pending: [] })
      const drawing =
        current.tool === 'line'
          ? {
              kind: 'line' as const,
              points,
              ink: current.ink,
              weight: current.weight,
              arrow: current.arrow,
            }
          : { kind: 'area' as const, points, ink: current.ink }
      onEditor({
        ...current,
        pending: [],
        selected: current.draft.drawings.length,
        draft: { ...current.draft, drawings: [...current.draft.drawings, drawing] },
      })
    }
  }, [onEditor, editorRef])

  const wantsClicks = editorWantsClicks(editor)
  const frame =
    editor?.kind === 'view' && viewport.width
      ? frameInViewport(viewport, editor.draft.aspect)
      : null

  // Dragging the map in pen mode draws instead; the pen handles its own pointer.
  const penning = editor?.kind === 'view' && editor.tool === 'pen'

  return (
    <MapCanvas
      chrome={
        frame ? (
          <div
            aria-hidden="true"
            className="az-frame pointer-events-none absolute z-[450] border-2 border-saffron-300/90"
            style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
          >
            <span className="absolute -top-6 left-0 font-label text-[10px] uppercase tracking-[0.2em] text-sand-50 drop-shadow">
              The article’s frame
            </span>
          </div>
        ) : null
      }
      className="absolute inset-0 z-0"
      cursor={wantsClicks ? 'crosshair' : undefined}
      initial={initial}
      interactive={!penning}
      mapName={mapName}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMove={onMove}
      onPointer={onPointer}
      onReady={onReady}
    >
      <Layers {...props} />
    </MapCanvas>
  )
}

/** The nation, in order: claims under roads under places under events under highlights under the editor. */
function Layers({
  data,
  rights,
  layers,
  showPast,
  now,
  selection,
  viewing,
  editor,
  onSelect,
  onEditor,
}: SceneProps) {
  const projection = useProjection('maps')
  const placer = new LabelPlacer()
  const phases: EventPhase[] = showPast ? ['upcoming', 'now', 'past'] : ['upcoming', 'now']
  const selectedTown =
    selection?.kind === 'town'
      ? (data.towns.find((town) => town.slug === selection.slug)?.id ?? null)
      : null
  const drawing = Boolean(
    editor && (editor.kind === 'place' || editor.kind === 'road' || editor.kind === 'event'),
  )
  const emphasised = drawing && !rights.anywhere ? rights.towns : undefined
  const viewLayers = viewing?.layers
  const show = (layer: MapLayer) =>
    layers.includes(layer) && (!viewLayers || viewLayers.includes(layer))
  const labelled = new Set<number>()
  const selectTown = (town: MapTown) => onSelect({ kind: 'town', slug: town.slug })

  return (
    <>
      {show('towns') ? (
        <TownsLayer
          emphasised={emphasised}
          labelled={labelled}
          onSelect={selectTown}
          placer={placer}
          projection={projection}
          selected={selectedTown}
          towns={data.towns}
        />
      ) : null}
      {show('roads') ? (
        <RoadsLayer
          onSelect={(road) => onSelect({ kind: 'road', id: road.id })}
          placer={placer}
          projection={projection}
          roads={
            editor?.kind === 'road' && editor.id
              ? data.roads.filter((road) => road.id !== editor.id)
              : data.roads
          }
          selected={selection?.kind === 'road' ? selection.id : null}
        />
      ) : null}
      {show('events') ? (
        <EventsLayer
          events={
            editor?.kind === 'event' && editor.id
              ? data.events.filter((event) => event.id !== editor.id)
              : data.events
          }
          now={now}
          onSelect={(event) => onSelect({ kind: 'event', id: event.id })}
          phases={phases}
          placer={placer}
          projection={projection}
          selected={selection?.kind === 'event' ? selection.id : null}
        />
      ) : null}
      {show('places') ? (
        <PlacesLayer
          onSelect={(place) => onSelect({ kind: 'place', id: place.id })}
          placer={placer}
          places={
            editor?.kind === 'place' && editor.id
              ? data.places.filter((place) => place.id !== editor.id)
              : data.places
          }
          projection={projection}
          selected={selection?.kind === 'place' ? selection.id : null}
        />
      ) : null}
      {show('towns') ? (
        <TownLabels
          labelled={labelled}
          onSelect={selectTown}
          projection={projection}
          selected={selectedTown}
          towns={data.towns}
        />
      ) : null}
      {viewing && editor?.kind !== 'view' ? (
        <DrawingsLayer drawings={viewing.drawings} projection={projection} />
      ) : null}
      {editor ? (
        <Tools
          data={data}
          editor={editor}
          onEditor={onEditor}
          projection={projection}
          rights={rights}
        />
      ) : null}
    </>
  )
}
