'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

import { cn } from '@/blocks/components/shared'
import {
  heartland,
  homeClaimBounds,
  spoken,
  type MapData,
  type MapEvent,
  type MapPlace,
  type MapRights,
  type MapRoad,
  type MapTown,
  type MapViewData,
} from '@/maps/data'
import { boundsOf, type Bounds, type Point } from '@/maps/geo'
import { PLACE_CATEGORIES, ROAD_KINDS, type MapLayer } from '@/maps/registry'
import type { MapName } from '@/maps/source'
import { eventPhase, toLocalInput } from '@/maps/time'
import {
  ALL_LAYERS,
  decodeAt,
  decodeLayers,
  decodeMapName,
  mapsQuery,
  sameSelection,
  selectionHref,
  selectionOf,
  type MapPosition,
  type MapSelection,
} from '@/maps/url'

import { api } from './api'
import { MapsContext, type MapsActions } from './context'
import { EditorPanel } from './editor/EditorPanel'
import { createStore, useHydrated, useMediaQuery, useSearch, useStore } from './hooks'
import type { LookTarget, SceneApi, SceneProps } from './MapScene'
import { emptyEvent, emptyPlace, emptyRoad, emptyView, type Editor } from './state'
import { DrawMenu, LayerMenu, Legend, MapToggle, ZoomButtons, type DrawChoice } from './ui/Controls'
import { Icon } from './ui/icons'
import { Coordinates, StatusNote, type MapStatus } from './ui/Readouts'
import { Search } from './ui/Search'
import { Sheet, type SheetState } from './ui/Sheet'
import { WhatsOnStrip } from './ui/WhatsOn'
import { Wordmark } from './ui/Wordmark'

import './maps.css'

/**
 * The map's JavaScript (Leaflet and the scene) is loaded only in the
 * browser, only on /maps, and never with any other page's bundle.
 */
const MapScene = dynamic<SceneProps>(() => import('./MapScene').then((module) => module.MapScene), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="absolute inset-0 bg-sea-900" />,
})

type ShellProps = {
  data: MapData
  rights: MapRights
  /** The page's panel: a town, a place, …, or the map's own front. */
  children: ReactNode
}

/** How a selection is named in the panel's head, before the page arrives. */
function describe(
  data: MapData,
  selection: MapSelection | null,
): { title: string; kind: string } | null {
  if (!selection) return null
  const town = (id: number | null) => {
    const found = data.towns.find((candidate) => candidate.id === id)
    return found ? spoken(found.name) : null
  }
  switch (selection.kind) {
    case 'town': {
      const found = data.towns.find((candidate) => candidate.slug === selection.slug)
      return found ? { title: spoken(found.name), kind: 'Town' } : null
    }
    case 'place': {
      const found = data.places.find((candidate) => candidate.id === selection.id)
      return found
        ? {
            title: found.name,
            kind: `${PLACE_CATEGORIES[found.category].label}${town(found.town) ? ` · ${town(found.town)}` : ''}`,
          }
        : null
    }
    case 'road': {
      const found = data.roads.find((candidate) => candidate.id === selection.id)
      return found
        ? { title: found.name ?? 'Unnamed road', kind: ROAD_KINDS[found.kind].label }
        : null
    }
    case 'event': {
      const found = data.events.find((candidate) => candidate.id === selection.id)
      return found ? { title: found.title, kind: 'Event' } : null
    }
  }
}

/** The block under the pointer, kept out of React state: it changes with every mouse move. */
function PointerReadout({
  store,
  centre,
}: {
  store: ReturnType<typeof createStore<Point | null>>
  centre: Point | null
}) {
  const pointer = useStore(store)
  return (
    <Coordinates
      className="pointer-events-auto"
      hint={pointer ? 'Under the pointer' : 'Centre'}
      point={pointer ?? centre}
    />
  )
}

/**
 * Azania Maps: the page around the map. A panel beside it on a wide
 * screen (a sheet drawn up over it on a phone) holds the page's content —
 * the front, a town, a place, an event — and the editor when someone with
 * rights is drawing. The shell owns the state the map and the panel
 * share: where the map is (also in the URL, to share), which layers show,
 * what's selected (the path), what's being drawn, and the clock the events
 * are judged by. The map itself is in ./MapScene.tsx, loaded only here.
 */
export function MapsShell({ data: served, rights, children }: ShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const hydrated = useHydrated()
  const search = useSearch()
  // The panel stands beside the map on a wide screen; on a phone it's a sheet. One or the other, never both.
  const wide = useMediaQuery('(min-width: 1024px)', true)
  const [pending, startTransition] = useTransition()

  // The nation as served, with the visitor's own edits until the server catches up.
  const [data, setData] = useState(served)
  const [lastServed, setLastServed] = useState(served)
  if (served !== lastServed) {
    setLastServed(served)
    setData(served)
  }

  const selection = useMemo(() => selectionOf(pathname), [pathname])
  const query = useMemo(() => new URLSearchParams(search), [search])

  // The address names the base map and the layers until the visitor chooses.
  const [chosenMap, setMapName] = useState<MapName | null>(null)
  const [chosenLayers, setLayers] = useState<MapLayer[] | null>(null)
  const mapName = chosenMap ?? decodeMapName(query.get('map'))
  const layers = chosenLayers ?? decodeLayers(query.get('layers')) ?? ALL_LAYERS
  const [showPast, setShowPast] = useState(false)
  const [viewing, setViewing] = useState<MapViewData | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [status, setStatus] = useState<MapStatus | null>(null)
  const [position, setPosition] = useState<MapPosition | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [sheet, setSheet] = useState<SheetState>(selection ? 'half' : 'peek')
  const pointerStore = useMemo(() => createStore<Point | null>(null), [])
  const sceneApi = useRef<SceneApi | null>(null)
  const pendingLook = useRef<LookTarget | null>(null)
  const lastSelection = useRef<MapSelection | null | undefined>(undefined)
  const panelRef = useRef<HTMLDivElement>(null)

  const look = useCallback((target: LookTarget) => {
    if (sceneApi.current) sceneApi.current.look(target)
    else pendingLook.current = target
  }, [])

  /** Where the map opens: the address's spot, else the selected thing, else the nation's heartland. Fixed once the page is in the browser. */
  const [initial] = useState<SceneProps['initial'] | null>(() => null)
  const opening = useMemo<SceneProps['initial'] | null>(() => {
    if (!hydrated) return null
    if (initial) return initial
    const at = decodeAt(query.get('at'))
    if (at) return at
    const bounds = selection ? boundsFor(data, selection) : null
    if (bounds) return bounds
    const heart = heartland(data.towns)
    return heart ? { bounds: heart, padding: 64 } : { centre: [4300, 5600], zoom: -3 }
    // Decided on arrival; later moves don't move the opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  // On arrival at a spot the address named, the selection is left where it is.
  useEffect(() => {
    if (!hydrated || lastSelection.current !== undefined) return
    if (decodeAt(query.get('at'))) lastSelection.current = selection
    // Arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  // An article's view named in the address: its highlights, its frame.
  const viewParam = query.get('view')
  useEffect(() => {
    const id = Number(viewParam)
    if (!Number.isInteger(id) || id <= 0) return
    let cancelled = false
    api
      .view(id)
      .then((view) => {
        if (cancelled || !view) return
        setViewing(view)
        setMapName(view.map)
        setLayers(view.layers)
        if (!decodeAt(new URLSearchParams(window.location.search).get('at')))
          look({ centre: view.centre, span: view.span, aspect: view.aspect })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [viewParam, look])

  // The clock, and whether the Rulercraft map is answering.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000)
    const check = () =>
      fetch('/maps/status', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((body: MapStatus | null) => body && setStatus(body))
        .catch(() => {})
    check()
    const poll = window.setInterval(check, 5 * 60_000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(poll)
    }
  }, [])

  // The map's spot in the address, so it can be shared, written quietly after each move.
  useEffect(() => {
    if (!position) return
    const handle = window.setTimeout(() => {
      const next = `${window.location.pathname}${mapsQuery({ at: position, map: mapName, layers, view: viewing?.id ?? null })}`
      if (next !== `${window.location.pathname}${window.location.search}`)
        window.history.replaceState(window.history.state, '', next)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [position, mapName, layers, viewing])

  // Opening something looks at it, and on a phone draws the sheet up.
  const [sheetFor, setSheetFor] = useState(selection)
  if (!sameSelection(sheetFor, selection)) {
    setSheetFor(selection)
    if (selection) setSheet('half')
  }
  useEffect(() => {
    if (lastSelection.current !== undefined && sameSelection(lastSelection.current, selection))
      return
    const first = lastSelection.current === undefined
    lastSelection.current = selection
    if (first) return
    if (selection) {
      const target = lookFor(data, selection)
      if (target) look(target)
    }
    panelRef.current?.scrollTo({ top: 0 })
  }, [selection, data, look])

  const select = useCallback(
    (next: MapSelection | null) => {
      setEditor(null)
      const query = mapsQuery({ at: position, map: mapName, layers, view: viewing?.id ?? null })
      startTransition(() => router.push(`${selectionHref(next)}${query}`, { scroll: false }))
    },
    [router, position, mapName, layers, viewing],
  )

  const mayEdit = useCallback(
    (town: number | null) => rights.anywhere || (town != null && rights.towns.includes(town)),
    [rights],
  )

  const openEditor = useCallback((next: Editor) => {
    setEditor(next)
    if (window.innerWidth < 1024) setSheet('half')
  }, [])

  const choose = (choice: DrawChoice) => {
    switch (choice) {
      case 'place':
        return openEditor({
          kind: 'place',
          id: null,
          draft: emptyPlace(),
          placing: true,
          tracing: false,
        })
      case 'road':
        return openEditor({
          kind: 'road',
          id: null,
          draft: emptyRoad(),
          drawing: true,
          vertex: null,
        })
      case 'event':
        return openEditor({ kind: 'event', id: null, draft: emptyEvent(), picking: false })
      case 'view':
        return openEditor({
          kind: 'view',
          id: null,
          draft: emptyView(mapName, layers),
          tool: 'pen',
          ink: 'red',
          weight: 2,
          arrow: false,
          selected: null,
          pending: [],
          createdBy: rights.user?.id ?? null,
        })
      case 'views':
        return openEditor({ kind: 'views', list: null, everyone: false })
    }
  }

  const remove = useCallback(
    async (kind: 'place' | 'road' | 'event', id: number) => {
      const collection = kind === 'place' ? 'places' : kind === 'road' ? 'roads' : 'events'
      await api.remove(collection, id)
      setData((current) => ({
        ...current,
        places: kind === 'place' ? current.places.filter((item) => item.id !== id) : current.places,
        roads: kind === 'road' ? current.roads.filter((item) => item.id !== id) : current.roads,
        events: kind === 'event' ? current.events.filter((item) => item.id !== id) : current.events,
      }))
      startTransition(() => {
        router.push('/maps', { scroll: false })
        router.refresh()
      })
    },
    [router],
  )

  const editPlace = useCallback(
    (place: MapPlace) =>
      openEditor({
        kind: 'place',
        id: place.id,
        draft: {
          name: place.name,
          category: place.category,
          description: place.description ?? '',
          y: place.y != null ? String(place.y) : '',
          point: place.point,
          outline: place.outline ?? [],
        },
        placing: false,
        tracing: false,
      }),
    [openEditor],
  )
  const editRoad = useCallback(
    (road: MapRoad) =>
      openEditor({
        kind: 'road',
        id: road.id,
        draft: { name: road.name ?? '', kind: road.kind, line: road.line },
        drawing: false,
        vertex: null,
      }),
    [openEditor],
  )
  const editEvent = useCallback(
    (event: MapEvent) =>
      openEditor({
        kind: 'event',
        id: event.id,
        draft: {
          title: event.title,
          description: event.description ?? '',
          startsAt: toLocalInput(event.startsAt),
          endsAt: toLocalInput(event.endsAt),
          host: event.host ?? '',
          place: event.place,
          point: event.place == null ? event.point : null,
          article: null,
        },
        picking: false,
      }),
    [openEditor],
  )
  const editAbout = useCallback(
    (town: MapTown, text: string) => openEditor({ kind: 'about', town: town.id, text }),
    [openEditor],
  )
  const closeEditor = useCallback(() => setEditor(null), [])

  const actions = useMemo<MapsActions>(
    () => ({
      data,
      rights,
      selection,
      editor,
      now,
      select,
      look,
      edit: openEditor,
      closeEditor,
      mayEdit,
      editPlace,
      editRoad,
      editEvent,
      editAbout,
      remove,
    }),
    [
      data,
      rights,
      selection,
      editor,
      now,
      select,
      look,
      openEditor,
      closeEditor,
      mayEdit,
      editPlace,
      editRoad,
      editEvent,
      editAbout,
      remove,
    ],
  )

  /** After a save: keep the visitor's copy current, then let the server confirm. */
  const saved = (kind: 'place' | 'road' | 'event', item: MapPlace | MapRoad | MapEvent) => {
    setData((current) => {
      const replace = <T extends { id: number }>(list: T[], next: T) =>
        list.some((candidate) => candidate.id === next.id)
          ? list.map((candidate) => (candidate.id === next.id ? next : candidate))
          : [...list, next]
      return {
        ...current,
        places: kind === 'place' ? replace(current.places, item as MapPlace) : current.places,
        roads: kind === 'road' ? replace(current.roads, item as MapRoad) : current.roads,
        events: kind === 'event' ? replace(current.events, item as MapEvent) : current.events,
      }
    })
    setEditor(null)
    startTransition(() => {
      router.push(selectionHref({ kind, id: item.id } as MapSelection), { scroll: false })
      router.refresh()
    })
  }

  // Escape steps out of the editor, then out of the selection.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (editor) return // the editor handles its own steps
      if (viewing) setViewing(null)
      else if (selection) select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, selection, viewing, select])

  const described = describe(data, selection)
  const canDraw = rights.anywhere || rights.towns.length > 0
  const liveEvents = data.events.filter((event) => eventPhase(event, now) === 'now').length
  const upcoming = data.events.filter((event) => eventPhase(event, now) === 'upcoming').length
  // While a view is drawn, the map shows the view's own base map and layers.
  const sceneMap = editor?.kind === 'view' ? editor.draft.map : mapName
  const sceneLayers = editor?.kind === 'view' ? editor.draft.layers : layers

  const panel = (
    <div className="flex min-h-full flex-col">
      {editor ? (
        <EditorPanel
          editor={editor}
          onChange={setEditor}
          onClose={closeEditor}
          onSaved={saved}
          onViewSaved={setViewing}
          sceneApi={sceneApi}
        />
      ) : (
        <>
          {viewing ? (
            <div className="flex items-center gap-2 border-b border-saffron-400/50 bg-saffron-100/70 px-4 py-2 text-xs text-saffron-600">
              <Icon className="h-3.5 w-3.5 shrink-0" name="frame" />
              <span className="min-w-0 flex-1 truncate">
                Showing an article’s highlights: {viewing.title}
              </span>
              <button
                className="font-semibold underline underline-offset-2 hover:text-saffron-500"
                onClick={() => setViewing(null)}
                type="button"
              >
                Clear
              </button>
            </div>
          ) : null}
          {selection ? (
            <div className="flex items-start gap-3 border-b border-sand-300 px-4 py-3">
              <button
                aria-label="Back to the map"
                className="-ml-1 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center text-sea-700 hover:text-sea-900 focus-visible:outline-saffron-500"
                onClick={() => select(null)}
                type="button"
              >
                <Icon className="h-4 w-4" name="back" />
              </button>
              {pending && described ? (
                <div aria-busy="true" className="min-w-0 flex-1">
                  <p className="font-label text-[10px] uppercase tracking-[0.2em] text-saffron-600">
                    {described.kind}
                  </p>
                  <p className="truncate font-display text-xl text-sea-950">{described.title}</p>
                </div>
              ) : (
                <p className="min-w-0 flex-1 self-center text-[11px] uppercase tracking-[0.18em] text-ink-400">
                  Azania Maps
                </p>
              )}
            </div>
          ) : null}
          <div className={cn('flex-1', pending && 'opacity-60 transition-opacity')}>{children}</div>
        </>
      )}
    </div>
  )

  const controls = (
    <>
      <MapToggle onChange={setMapName} value={mapName} />
      <LayerMenu
        layers={layers}
        onChange={setLayers}
        onShowPast={setShowPast}
        showPast={showPast}
      />
      <Legend />
      {canDraw || rights.views ? (
        <DrawMenu
          active={Boolean(editor)}
          canDraw={canDraw}
          canViews={rights.views}
          onChoose={choose}
        />
      ) : null}
    </>
  )

  const account = rights.user ? (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-ink-500">
      <Icon className="h-3.5 w-3.5" name="user" />
      {rights.user.name}
    </span>
  ) : (
    <Link
      className="text-[11px] uppercase tracking-[0.16em] text-sea-700 hover:text-sea-900"
      href="/login?next=/maps"
    >
      Sign in
    </Link>
  )

  return (
    <MapsContext.Provider value={actions}>
      <div
        className="az-maps fixed inset-0 flex bg-sea-900 text-ink-900"
        data-tool={editor ? editor.kind : undefined}
      >
        {/* The panel, beside the map on a wide screen. */}
        {wide ? (
          <aside
            aria-label="Panel"
            className="flex w-[26rem] shrink-0 flex-col border-r border-sand-300 bg-sand-50"
          >
            <header className="border-b border-sand-300 px-4 pb-3 pt-4">
              <div className="flex items-center justify-between gap-3">
                <Wordmark />
                {account}
              </div>
              <Search className="mt-3" data={data} onPick={select} />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto" ref={panelRef}>
              {panel}
            </div>
          </aside>
        ) : null}

        {/* The map. */}
        <div className="relative min-w-0 flex-1">
          {opening ? (
            <MapScene
              data={data}
              editor={editor}
              initial={opening}
              layers={sceneLayers}
              mapName={sceneMap}
              now={now}
              onApi={(scene) => {
                sceneApi.current = scene
                if (pendingLook.current) {
                  scene.look(pendingLook.current)
                  pendingLook.current = null
                }
              }}
              onEditor={setEditor}
              onMove={setPosition}
              onPointer={pointerStore.set}
              onSelect={select}
              rights={rights}
              selection={selection}
              showPast={showPast}
              viewing={viewing}
            />
          ) : null}

          {/* Phone: the name and the search float over the map. */}
          {!wide ? (
            <div className="absolute left-3 right-3 top-3 z-10 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 border border-sand-300 bg-sand-50 py-1 pl-2.5 pr-1 shadow-[0_1px_2px_rgba(22,25,31,0.08)]">
                <Wordmark small />
                <Search className="min-w-0 flex-1" data={data} onPick={select} />
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              'absolute right-3 z-10 flex flex-col items-end gap-2',
              wide ? 'top-3' : 'top-16',
            )}
          >
            <div className="flex items-start gap-2">{controls}</div>
            <ZoomButtons onZoom={(delta) => sceneApi.current?.zoomBy(delta)} />
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex flex-col items-start gap-2">
            <StatusNote className="pointer-events-auto max-w-md" status={status} />
            {wide ? (
              <div className="flex w-full items-end justify-between gap-3">
                <PointerReadout centre={position?.centre ?? null} store={pointerStore} />
                <WhatsOnStrip
                  className="pointer-events-auto w-full max-w-2xl"
                  data={data}
                  now={now}
                  onOpen={(event) => select({ kind: 'event', id: event.id })}
                  selected={selection?.kind === 'event' ? selection.id : null}
                />
              </div>
            ) : null}
          </div>
        </div>

        {/* Phone: the panel as a sheet. */}
        {!wide ? (
          <Sheet
            handle={
              described ? (
                <span className="min-w-0 flex-1">
                  <span className="block font-label text-[10px] uppercase tracking-[0.2em] text-saffron-600">
                    {described.kind}
                  </span>
                  <span className="block truncate font-display text-lg leading-tight text-sea-950">
                    {described.title}
                  </span>
                </span>
              ) : editor ? (
                <span className="min-w-0 flex-1 truncate font-semibold text-sea-900">
                  Drawing on the map
                </span>
              ) : (
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="font-display text-lg leading-tight text-sea-950">
                    Azania at a glance
                  </span>
                  <span className="truncate text-xs text-ink-500">
                    {data.towns.length} towns
                    {liveEvents
                      ? ` · ${liveEvents} on now`
                      : upcoming
                        ? ` · ${upcoming} coming up`
                        : ''}
                  </span>
                </span>
              )
            }
            onState={setSheet}
            state={sheet}
          >
            <div className="flex items-center justify-between border-b border-sand-300 px-4 py-2">
              <Coordinates hint="Centre" point={position?.centre ?? null} />
              {account}
            </div>
            {panel}
          </Sheet>
        ) : null}
      </div>
    </MapsContext.Provider>
  )
}

/** The bounds a selection fills on arrival. */
function boundsFor(data: MapData, selection: MapSelection): SceneProps['initial'] | null {
  const target = lookFor(data, selection)
  if (!target) return null
  if ('bounds' in target) return { bounds: target.bounds, padding: 64 }
  if ('centre' in target && 'zoom' in target && target.zoom != null)
    return { centre: target.centre, zoom: target.zoom }
  return null
}

/** Where to look for a selection: a town's main claim, a road's course, a point up close. */
function lookFor(data: MapData, selection: MapSelection): LookTarget | null {
  switch (selection.kind) {
    case 'town': {
      const town = data.towns.find((candidate) => candidate.slug === selection.slug)
      const bounds = town ? homeClaimBounds(town) : null
      return bounds ? { bounds } : town?.home ? { centre: town.home, zoom: 0 } : null
    }
    case 'place': {
      const place = data.places.find((candidate) => candidate.id === selection.id)
      return place ? { centre: place.point, zoom: 1, minZoom: true } : null
    }
    case 'road': {
      const road = data.roads.find((candidate) => candidate.id === selection.id)
      const bounds = road ? pad(boundsOf(road.line)) : null
      return bounds ? { bounds } : null
    }
    case 'event': {
      const event = data.events.find((candidate) => candidate.id === selection.id)
      return event ? { centre: event.point, zoom: 1, minZoom: true } : null
    }
  }
}

/** A road is a line; give its bounds some body so a straight one isn't zoomed to a sliver. */
function pad(bounds: Bounds | null): Bounds | null {
  if (!bounds) return null
  const margin = Math.max(48, (bounds.maxX - bounds.minX + bounds.maxZ - bounds.minZ) * 0.1)
  return {
    minX: bounds.minX - margin,
    maxX: bounds.maxX + margin,
    minZ: bounds.minZ - margin,
    maxZ: bounds.maxZ + margin,
  }
}
