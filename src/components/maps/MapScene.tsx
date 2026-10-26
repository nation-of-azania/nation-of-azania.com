'use client'

import { memo, useCallback, useMemo, useRef, useState } from 'react'

import { homeNationOf, relationWith, type Abroad } from '@/maps/abroad'
import { heartland, type MapData, type MapRights, type MapTown, type MapViewData, type Relation } from '@/maps/data'
import { roundPoint, type Bounds, type Point } from '@/maps/geo'
import type { Insets } from '@/maps/globe'
import { siegesOnMap } from '@/maps/besieged'
import { azaniaSide } from '@/maps/sieges'
import { GROUND, nationInk, NO_NATION, pixelsPerBlock, STANCE_COLOURS } from '@/maps/palette'
import type { MapLayer, ViewAspect } from '@/maps/registry'
import { wrapPoint } from '@/maps/source'
import type { EventPhase } from '@/maps/time'
import type { MapPosition, MapSelection } from '@/maps/url'
import { frameInViewport, zoomForSpan } from '@/maps/view'
import type { Siege, War } from '@/maps/world'

import type { EditorUpdate } from './context'

import { PointChip } from './editor/PointChip'
import { Tools } from './editor/Tools'
import type { GlobePull } from './globe/types'
import { createStore, useLatest, type Store } from './hooks'
import { AbroadClaims, AbroadMarks, HomeGlow, type HomeNation, type NationStyle } from './layers/AbroadLayer'
import { DrawingsLayer } from './layers/DrawingsLayer'
import { EventsLayer } from './layers/EventsLayer'
import { AbroadHover, HoverReach } from './layers/hover'
import { planLabels, type LabelPlan } from './layers/labels'
import { PlacesLayer } from './layers/PlacesLayer'
import { PlayersLayer } from './layers/PlayersLayer'
import { LabelPlacer, type Projection } from './layers/projection'
import type { LiveState } from './live'
import { WarReach, type Reach } from './layers/ReachLayer'
import { RoadsLayer } from './layers/RoadsLayer'
import { SiegeCard } from './layers/SiegeCard'
import { SiegesLayer } from './layers/SiegesLayer'
import { TownLabels, TownsLayer } from './layers/TownsLayer'
import { EchoWash, echoesIn, echoProjection, Seams } from './layers/WorldEdge'
import {
  fitBounds,
  flyTo,
  L,
  MapCanvas,
  MAX_ZOOM,
  MIN_ZOOM,
  OnTop,
  toLatLng,
  toPoint,
  useLeaflet,
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
  /**
   * Look somewhere; `cover` is the height of a sheet covering the map's foot, or how much of its head and foot is
   * covered (a phone's search and sheet), so the spot stays in view.
   */
  look: (target: LookTarget, cover?: number | Insets) => void
  zoomBy: (delta: number) => void
  /** The frame a map view would save just now: its centre and how many blocks it spans. */
  frame: (aspect: ViewAspect) => { centre: Point; span: number } | null
  /**
   * How many times the reader has moved the map themselves, by a drag, a
   * pinch, the wheel, the keys or the zoom buttons; the map's own looks and
   * placings aren't counted. Compared before and after a wait, it says
   * whether they moved it meanwhile.
   */
  moves: () => number
  /**
   * The map as it stands this moment, mid-gesture too (mid-way through an
   * animated zoom, where it's going): its centre as Leaflet has it (in an
   * echo, past the world's edge), its zoom and its size. What the globe
   * hands over to and from (../globe).
   */
  view: () => { centre: Point; zoom: number; width: number; height: number } | null
  /** Stand the map at a spot at once, without a flight, the spot landing at a point of the container (the middle, unless `at` says). */
  place: (position: MapPosition, at?: [number, number]) => void
  /** The world as one picture, as the map holds it (leaflet/sheet.ts): the server's, else the one made from the tiles so far; null before either. */
  picture: () => HTMLImageElement | HTMLCanvasElement | null
  /** Gives the map the keyboard's focus. */
  focus: () => void
  /**
   * Veils the map's own picture of the world and what's drawn over it, or
   * lifts the veil: while the globe draws the flat map's twin and curls it
   * up, the original stands aside beneath, so the reader sees one map, not
   * two (maps.css → .az-veiled).
   */
  veil: (on: boolean) => void
}

/** Leaflet's own record of an animated zoom under way. */
type AnimatingMap = { _animatingZoom?: boolean; _animateToCenter?: L.LatLng; _animateToZoom?: number }

export type SceneProps = {
  data: MapData
  rights: MapRights
  layers: MapLayer[]
  /** The rest of the world, once it has arrived (/maps/world.json), whether it's drawn, and whether tinted by Azania's diplomacy. */
  world: Abroad | null
  showWorld: boolean
  diplomacy: boolean
  /** The sieges on the server, always drawn; the one whose card is open, by its town's Towny id; and opening one. */
  sieges: Siege[]
  siegeOpen: string | null
  onSiege: (townId: string | null) => void
  /** Every nation's capital (/maps/war), the reach of a capital's war, and whether it's drawn. */
  capitals: War['capitals']
  radius: number
  showReach: boolean
  /** Whether the players online are shown, and the feed they're read from. */
  live: boolean
  liveStore: Store<LiveState>
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
  /** A change to the editor; `press` numbers the drag it belongs to, so undo takes the drag as one step. */
  onEditor: (update: EditorUpdate, press?: number) => void
  /** The map pulled out past its farthest zoom, to curl it up into the globe (leaflet/canvas.tsx); none while it may not be. */
  onPull?: (pull: GlobePull) => void
}

/** Sends the map to look at a target: its bounds fitted, a view's span framed, or a spot flown to, clear of what covers the map. */
function lookAt(map: L.Map, target: LookTarget, inset?: number | Insets): void {
  const cover = typeof inset === 'number' ? { top: 0, bottom: inset } : inset
  if ('bounds' in target) return fitBounds(map, target.bounds, 48, cover)
  if ('span' in target) {
    const size = map.getSize()
    const frame = frameInViewport({ width: size.x, height: size.y }, target.aspect)
    return flyTo(map, target.centre, Math.min(MAX_ZOOM, zoomForSpan(target.span, frame.width)))
  }
  const zoom = target.zoom == null ? undefined : target.minZoom ? Math.max(target.zoom, map.getZoom()) : target.zoom
  flyTo(map, target.centre, zoom, cover)
}

/**
 * The map on /maps: the canvas, the nation's layers drawn on it, an
 * article's highlights when one is being shown, and the editor's own
 * marks while someone draws. The shell (./MapsShell.tsx) holds the state;
 * this turns it into the picture and sends back what the map says.
 */
export function MapScene(props: SceneProps) {
  const { initial, editor, onApi, onMove, onPointer, onEditor, live, liveStore, data } = props
  const { world, sieges, siegeOpen, onSiege } = props
  const mapRef = useRef<L.Map | null>(null)
  const editorRef = useLatest(editor)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  // The nation under the pointer: changing as the pointer moves, so kept out of the layers' props.
  const hover = useMemo(() => createStore<string | null>(null), [])

  // Every move a view starts with (Leaflet's movestart) is the reader's, unless the map is looking somewhere, or placed by the globe, itself.
  const moves = useRef(0)
  const owning = useRef(false)
  /** Moves the map on the map's own account, so the move it starts with isn't counted as the reader's. */
  const own = (move: () => void) => {
    owning.current = true
    try {
      move()
    } finally {
      owning.current = false
    }
  }

  const api = useMemo<SceneApi>(
    () => ({
      look: (target, inset) => {
        const map = mapRef.current
        if (!map) return
        // A flight starts at once, so the move it begins with is known for the map's own.
        own(() => lookAt(map, target, inset))
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
        // A frame drawn over an echo of the world is the same frame over the real one.
        return {
          centre: roundPoint(wrapPoint(toPoint(centre))),
          span: Math.round(frame.width / pixelsPerBlock(map.getZoom())),
        }
      },
      moves: () => moves.current,
      view: () => {
        const map = mapRef.current as (L.Map & AnimatingMap) | null
        if (!map) return null
        const size = map.getSize()
        // Mid-way through an animated zoom (a pinch let go past the farthest springs back by one), where it's going.
        if (map._animatingZoom && map._animateToCenter && map._animateToZoom != null)
          return { centre: toPoint(map._animateToCenter), zoom: map._animateToZoom, width: size.x, height: size.y }
        return { centre: toPoint(map.getCenter()), zoom: map.getZoom(), width: size.x, height: size.y }
      },
      place: (position, at) => {
        const map = mapRef.current
        if (!map) return
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, position.zoom))
        const half = map.getSize().divideBy(2)
        const anchor = at ? L.point(at[0], at[1]) : half
        // The spot's pixel at that zoom, less its offset from the middle: the centre that puts it at `at`.
        const centre = map.project(toLatLng(position.centre), zoom).subtract(anchor).add(half)
        own(() => map.setView(map.unproject(centre, zoom), zoom, { animate: false }))
      },
      picture: () => {
        const container = mapRef.current?.getContainer()
        if (!container) return null
        const image = container.querySelector<HTMLImageElement>('img.az-sheet')
        if (image?.complete && image.naturalWidth) return image
        return container.querySelector<HTMLCanvasElement>('canvas.az-sheet')
      },
      focus: () => mapRef.current?.getContainer().focus({ preventScroll: true }),
      veil: (on) => mapRef.current?.getContainer().classList.toggle('az-veiled', on),
    }),
    [],
  )

  const onReady = useCallback(
    (map: L.Map) => {
      mapRef.current = map
      map.on('movestart', () => {
        if (!owning.current) moves.current++
      })
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
                vertex: null,
                draft: { ...current.draft, outline: [...current.draft.outline, at] },
              })
          }
          return
        case 'road':
          if (current.drawing)
            onEditor({
              ...current,
              vertex: null,
              draft: { ...current.draft, line: [...current.draft.line, at] },
            })
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
                vertex: null,
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
                vertex: null,
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
        vertex: null,
        draft: { ...current.draft, drawings: [...current.draft.drawings, drawing] },
      })
    }
  }, [onEditor, editorRef])

  // The siege whose card is open, with Azania's side in it and the town besieged, when it's on the map.
  const open = useMemo(() => {
    const siege = siegeOpen ? sieges.find((candidate) => candidate.townId === siegeOpen) : null
    if (!siege) return null
    const own = data.towns.find((town) => town.townyId === siege.townId)
    const abroad = world?.towns.find((town) => town.id === siege.townId)
    const town: MapSelection | null = own
      ? { kind: 'town', slug: own.slug }
      : abroad
        ? { kind: 'abroad', slug: abroad.slug }
        : null
    return { siege, side: azaniaSide(siege, { nation: homeNationOf(data.towns), towns: data.towns }), town }
  }, [siegeOpen, sieges, data.towns, world])

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
        <>
          {frame ? (
            <div
              aria-hidden="true"
              className="az-frame pointer-events-none absolute z-[450] border-2 border-saffron-300/90"
              style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
            >
              <span className="absolute -top-6 left-0 font-label text-[10px] uppercase tracking-[0.2em] text-sand-50 drop-shadow">
                The article’s frame
              </span>
            </div>
          ) : null}
          {editor ? <PointChip editor={editor} onEditor={onEditor} /> : null}
          {open ? (
            <SiegeCard
              key={open.siege.townId}
              onClose={() => onSiege(null)}
              onOpen={props.onSelect}
              side={open.side}
              siege={open.siege}
              town={open.town}
            />
          ) : null}
          {/* The players online: Leaflet markers of their own, moved per frame, outside the overlay and its renders. */}
          <PlayersLayer data={data} enabled={live} store={liveStore} />
        </>
      }
      className="absolute inset-0 z-0"
      cursor={wantsClicks ? 'crosshair' : undefined}
      initial={initial}
      interactive={!penning}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMove={onMove}
      onPointer={onPointer}
      onPull={props.onPull}
      onReady={onReady}
      wrap
    >
      <Layers {...props} hover={hover} />
      <AbroadHover store={hover} />
    </MapCanvas>
  )
}

/**
 * The nation, in order: claims under roads under places under events under
 * highlights under the editor. The world repeats east and west, so the
 * same layers are drawn again, washed, for each echo on the page, and the
 * seams go over everything. Memoised, so the shell's own re-renders (a
 * sheet dragged, the clock's tick) don't redraw the overlay; it redraws
 * when the view settles (useProjection) or when what it shows changes.
 */
const Layers = memo(function Layers({
  data,
  rights,
  layers,
  world: abroad,
  showWorld,
  diplomacy,
  sieges,
  siegeOpen,
  onSiege,
  capitals,
  radius,
  showReach,
  showPast,
  now,
  selection,
  viewing,
  editor,
  onSelect: open,
  onEditor,
  hover,
}: SceneProps & { hover: Store<string | null> }) {
  const projection = useProjection('maps')
  const { map, world } = useLeaflet()
  // A drag that began on a pin ends on it too, since the pin moves with the
  // map, and the browser then calls that a click; Leaflet knows better.
  const onSelect = (selection: MapSelection) => {
    const dragging = map.dragging as L.Handler & { moved?: () => boolean }
    if (!dragging.moved?.()) open(selection)
  }
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
  const selectTown = (town: MapTown) => onSelect({ kind: 'town', slug: town.slug })
  // What's being edited is drawn by the tools, not by its layer.
  const places =
    editor?.kind === 'place' && editor.id
      ? data.places.filter((place) => place.id !== editor.id)
      : data.places
  const roads =
    editor?.kind === 'road' && editor.id
      ? data.roads.filter((road) => road.id !== editor.id)
      : data.roads
  const events =
    editor?.kind === 'event' && editor.id
      ? data.events.filter((event) => event.id !== editor.id)
      : data.events
  const selectedPlace = selection?.kind === 'place' ? selection.id : null
  const selectedEvent = selection?.kind === 'event' ? selection.id : null
  // An article's highlights, shown or being drawn, outrank the map's own names.
  const drawings =
    editor?.kind === 'view' ? editor.draft.drawings : viewing ? viewing.drawings : []
  const shown = {
    towns: show('towns') ? data.towns : [],
    roads: show('roads') ? roads : [],
    places: show('places') ? places : [],
    events: show('events') ? events : [],
  }
  // The world around the nation, drawn for itself or for the diplomacy; never in an article's view, which is the nation's own.
  const worldShown = abroad && (showWorld || diplomacy) && !viewLayers ? abroad : null
  const home = useHome(data)
  const styleOf = useNationStyles(abroad, diplomacy ? data.relations : null)
  const selectedAbroad = {
    town: selection?.kind === 'abroad' ? selection.slug : null,
    nation: selection?.kind === 'nation' ? selection.slug : null,
  }
  const plannedWorld = worldShown ? { world: worldShown, home: show('towns') ? home : null } : null
  const towns = data.towns
  const war = useMemo(() => siegesOnMap(sieges, { towns }, abroad), [sieges, towns, abroad])
  // The reach of the wars: Azania's always (with its layer on), and another nation's while it's open or hovered.
  const reachOf = useReaches(capitals, abroad, styleOf)
  const homeName = home?.name ?? null
  const openNation = selection?.kind === 'nation' ? (abroad?.nationBySlug.get(selection.slug)?.name ?? null) : null
  const homeReach = showReach && homeName ? reachOf(homeName, { home: true }) : null
  const openReach = showReach && openNation && openNation !== homeName ? reachOf(openNation, { named: true }) : null
  const hoverReach = (nation: string) => (nation === homeName || nation === openNation ? null : reachOf(nation))
  // One placer for the real world and its echoes, so no name lands on another across a seam.
  const placer = new LabelPlacer()
  const labels = planLabels(
    projection,
    { drawings, ...shown, now, phases, selectedPlace, selectedEvent, abroad: plannedWorld, sieges: war },
    placer,
  )
  const copies = [
    { copy: 0, at: projection, labels },
    ...echoesIn(projection).map((copy) => {
      const at = echoProjection(projection, copy)
      return {
        copy,
        at,
        labels: planLabels(
          at,
          { ...shown, now, phases, selectedPlace, selectedEvent, abroad: plannedWorld, sieges: war },
          placer,
        ),
      }
    }),
  ]

  /**
   * The nation's ground over one projection, the real world's or an
   * echo's: what grows and shrinks with a zoom, drawn in the overlay's
   * first SVG, which mid-zoom is scaled whole as a picture.
   */
  const ground = (at: Projection) => (
    <>
      {/* The rings of the wars' reach, under everything: long, calm lines across the map. */}
      {homeReach ? <WarReach part="ring" projection={at} radius={radius} reach={homeReach} /> : null}
      {openReach ? <WarReach part="ring" projection={at} radius={radius} reach={openReach} /> : null}
      {showReach ? <HoverReach projection={at} radius={radius} reachOf={hoverReach} store={hover} /> : null}
      {worldShown ? (
        <AbroadClaims
          abroad={worldShown}
          hover={hover}
          onSelect={onSelect}
          projection={at}
          selected={selectedAbroad}
          styleOf={styleOf}
        />
      ) : null}
      {worldShown && show('towns') ? <HomeGlow part="casing" projection={at} towns={data.towns} /> : null}
      {show('towns') ? (
        <TownsLayer
          emphasised={emphasised}
          onSelect={selectTown}
          projection={at}
          selected={selectedTown}
          towns={data.towns}
        />
      ) : null}
      {show('roads') ? (
        <RoadsLayer
          onSelect={(road) => onSelect({ kind: 'road', id: road.id })}
          part="roads"
          projection={at}
          roads={roads}
          selected={selection?.kind === 'road' ? selection.id : null}
        />
      ) : null}
    </>
  )

  /**
   * And what's drawn over it: names, pins and marks, which keep their size
   * on the page mid-zoom, in the overlay's second SVG (OnTop).
   */
  const marks = (at: Projection, plan: LabelPlan) => (
    <>
      {worldShown && show('towns') ? <HomeGlow part="discs" projection={at} towns={data.towns} /> : null}
      {homeReach ? <WarReach part="name" projection={at} radius={radius} reach={homeReach} /> : null}
      {openReach ? <WarReach part="name" projection={at} radius={radius} reach={openReach} /> : null}
      {show('roads') ? <RoadsLayer labels={plan.roads} part="names" projection={at} roads={roads} /> : null}
      {show('places') ? (
        <PlacesLayer
          labels={plan.places}
          onSelect={(place) => onSelect({ kind: 'place', id: place.id })}
          places={places}
          projection={at}
          selected={selectedPlace}
        />
      ) : null}
      {show('events') ? (
        <EventsLayer
          events={events}
          labels={plan.events}
          now={now}
          onSelect={(event) => onSelect({ kind: 'event', id: event.id })}
          phases={phases}
          projection={at}
          selected={selectedEvent}
        />
      ) : null}
      {show('towns') ? (
        <TownLabels
          labels={plan.towns}
          onSelect={selectTown}
          projection={at}
          selected={selectedTown}
          towns={data.towns}
        />
      ) : null}
      {worldShown ? (
        <AbroadMarks
          abroad={worldShown}
          labels={plan.abroad}
          onSelect={onSelect}
          projection={at}
          selected={selectedAbroad}
          styleOf={styleOf}
        />
      ) : null}
      {/* The sieges, whatever else is shown: news, over everything. */}
      <SiegesLayer
        labels={plan.sieges.names}
        marks={plan.sieges.marks}
        onOpen={(siege) => onSiege(siege.townId)}
        projection={at}
        selected={siegeOpen}
      />
    </>
  )

  return (
    <>
      <EchoWash projection={projection} world={world} />
      {/*
        The real world and its echoes on the page: the same nation, faded in an
        echo; a click on anything in one opens the real thing, and the map
        comes back to it. Each copy is keyed by which copy of the world it is
        to the reader, not to the map, so when the map re-bases a world over
        (leaflet/home.ts) the copy under the reader keeps its group and fades
        up to full colour, and the one they came from fades down. Its ground
        and its marks are drawn apart, in a group of each kind.
      */}
      {copies.map(({ copy, at }) => (
        <g className="az-world" data-echo={copy ? '' : undefined} key={world + copy}>
          {ground(at)}
        </g>
      ))}
      <OnTop>
        {copies.map(({ copy, at, labels: plan }) => (
          <g className="az-world" data-echo={copy ? '' : undefined} key={world + copy}>
            {marks(at, plan)}
          </g>
        ))}
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
        <Seams projection={projection} />
      </OnTop>
    </>
  )
})

/**
 * Azania among the nations far out: its Towny name, set across its
 * heartland like any other nation's, in the deep sea of its own claims.
 */
function useHome(data: MapData): HomeNation | null {
  return useMemo(() => {
    const name = homeNationOf(data.towns)
    const extent = heartland(data.towns)
    if (!name || !extent) return null
    return { name, extent, heart: [(extent.minX + extent.maxX) / 2, (extent.minZ + extent.maxZ) / 2] }
  }, [data.towns])
}

/**
 * Each nation's style, worked out once per world: its own colour tempered
 * (src/maps/palette.ts), or, with the diplomacy layer on (`relations`
 * given), where Azania stands with it — allies washed green, enemies red
 * and, at war, hatched, the neutral receding in grey.
 */
function useNationStyles(abroad: Abroad | null, relations: Relation[] | null): (nation: string | null) => NationStyle {
  return useMemo(() => {
    const styleOf = (name: string, colour: string | null): NationStyle => {
      if (!relations) return { ...nationInk(colour), fill: 0.08 }
      const stance = relationWith(name, relations)?.stance ?? 'neutral'
      const voice = stance === 'neutral' ? 'quiet' : stance === 'ally' || stance === 'war' || stance === 'hostile' ? 'loud' : undefined
      return { ...STANCE_COLOURS[stance], hatch: stance === 'war', voice }
    }
    const styles = new Map<string, NationStyle>(
      (abroad?.nations ?? []).map((nation) => [nation.name, styleOf(nation.name, nation.colour)]),
    )
    const none: NationStyle = relations
      ? { ...STANCE_COLOURS.neutral, dash: '3 2' }
      : { line: NO_NATION.line, text: NO_NATION.text, fill: 0.05, dash: '3 2' }
    return (nation) => (nation ? (styles.get(nation) ?? styleOf(nation, null)) : none)
  }, [abroad, relations])
}

/**
 * A nation's war reach, ready to draw: its capital (from /maps/war, else
 * the world's reading) and its colour — Azania's the deep sea of its own
 * claims, another's as the nations are drawn just now. Null for a nation
 * with no capital on the map.
 */
function useReaches(
  capitals: War['capitals'],
  abroad: Abroad | null,
  styleOf: (nation: string | null) => NationStyle,
): (nation: string, how?: { home?: boolean; named?: boolean }) => Reach | null {
  return useMemo(() => {
    const byName = new Map(capitals.map((capital) => [capital.nation, { town: capital.town, home: capital.home }]))
    return (nation, how = {}) => {
      const capital = byName.get(nation) ?? abroad?.nationByName.get(nation)?.capital ?? null
      if (!capital) return null
      const home = Boolean(how.home)
      return { nation, capital, colour: home ? GROUND.sea800 : styleOf(nation).line, home, named: home || Boolean(how.named) }
    }
  }, [capitals, abroad, styleOf])
}
