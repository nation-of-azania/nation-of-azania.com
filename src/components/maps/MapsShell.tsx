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
  isSite,
  mapRightsOf,
  NO_RIGHTS,
  roadPoints,
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
import { settlements, siteFacts, siteTitle } from '@/maps/sites'
import { eventPhase, toLocalInput } from '@/maps/time'
import {
  ALL_LAYERS,
  decodeAt,
  decodeDraw,
  decodeLayers,
  mapsQuery,
  sameSelection,
  selectionHref,
  selectionOf,
  type MapPosition,
  type MapSelection,
} from '@/maps/url'

import { api, ApiError, messageOf } from './api'
import { MapsContext, type EditorUpdate, type MapsActions, type RightsStatus } from './context'
import { EditorPanel } from './editor/EditorPanel'
import { createStore, useHydrated, useMediaQuery, useSearch, useStore } from './hooks'
import type { LookTarget, SceneApi, SceneProps } from './MapScene'
import {
  emptyEvent,
  emptyPlace,
  emptyRoad,
  sameSnapshot,
  snapshotOf,
  viewEditor,
  withSnapshot,
  type Editor,
  type Snapshot,
} from './state'
import { Notice, TextButton } from './ui/chrome'
import { DrawMenu, LayerMenu, Legend, ZoomButtons, type DrawChoice } from './ui/Controls'
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
      if (!found) return null
      const site = siteFacts(found)
      return { title: spoken(found.name), kind: site ? siteTitle(site) : 'Town' }
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

type Store<T> = ReturnType<typeof createStore<T>>

/** How long to wait before asking the Registry again who the visitor is, attempt by attempt. */
const RIGHTS_RETRIES = [0, 1500, 4000]

/** Steps of undo kept for one editing session. */
const HISTORY_LIMIT = 100

/**
 * What a signed-in person may do on the map, in a few words beside their
 * name, so nobody has to guess their rights: "draws anywhere" for staff and
 * cartographers, "Mayor of GirlieTown", "map views only" for a writer.
 * Nobody is mayor of a held site, so someone given one to draw in "draws
 * at Africa Quarry".
 */
function standingOf(rights: MapRights, towns: MapTown[]): string {
  if (rights.anywhere) return 'draws anywhere'
  if (rights.towns.length) {
    const held = rights.towns
      .map((id) => towns.find((town) => town.id === id))
      .filter((town): town is MapTown => Boolean(town))
    const mayorOf = held.filter((town) => !isSite(town)).map((town) => spoken(town.name))
    const drawsAt = held.filter(isSite).map((town) => spoken(town.name))
    const words = [
      ...(mayorOf.length ? [`Mayor of ${mayorOf.join(' and ')}`] : []),
      ...(drawsAt.length ? [`draws at ${drawsAt.join(' and ')}`] : []),
    ]
    return words.length ? words.join(' · ') : 'Mayor'
  }
  if (rights.views) return 'map views only'
  return 'reader'
}

/**
 * The block under the pointer, else the middle of the view: both change
 * with every move, so they live in small stores rather than React state,
 * and only this readout re-renders for them.
 */
function PointerReadout({
  pointer,
  centre,
  towns,
  bare,
}: {
  pointer: Store<Point | null>
  centre: Store<MapPosition | null>
  towns: MapTown[]
  bare?: boolean
}) {
  const under = useStore(pointer)
  const position = useStore(centre)
  return (
    <Coordinates
      bare={bare}
      className="pointer-events-auto"
      hint={under ? 'Under the pointer' : 'Centre'}
      point={under ?? position?.centre ?? null}
      towns={towns}
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
 * are judged by. The page itself is cached for everyone; the visitor's own
 * rights are fetched here. The map itself is in ./MapScene.tsx, loaded
 * only here.
 */
export function MapsShell({ data: served, children }: ShellProps) {
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

  // Who the visitor is on the map: asked of the server once the page is here,
  // since the page is the same for everyone. A flaky connection is no answer:
  // the question is asked again, with a pause between tries, and only the
  // Registry's own word turns a signed-in person into a visitor.
  const [rights, setRights] = useState<MapRights>(NO_RIGHTS)
  const [rightsStatus, setRightsStatus] = useState<RightsStatus>('asking')
  const [rightsAttempt, setRightsAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    let handle: number | undefined
    const ask = (attempt: number) =>
      api
        .me()
        .then((user) => {
          if (cancelled) return
          setRights(mapRightsOf(user))
          setRightsStatus('known')
        })
        .catch((error: unknown) => {
          if (cancelled) return
          // The Registry answered, and said no: a visitor.
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            setRights(NO_RIGHTS)
            setRightsStatus('known')
          } else if (attempt + 1 < RIGHTS_RETRIES.length) {
            handle = window.setTimeout(() => ask(attempt + 1), RIGHTS_RETRIES[attempt + 1])
          } else setRightsStatus('unreachable')
        })
    ask(0)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [rightsAttempt])
  const retryRights = useCallback(() => {
    setRightsStatus('asking')
    setRightsAttempt((attempt) => attempt + 1)
  }, [])
  // Back online: ask again of our own accord.
  useEffect(() => {
    if (rightsStatus !== 'unreachable') return
    window.addEventListener('online', retryRights)
    return () => window.removeEventListener('online', retryRights)
  }, [rightsStatus, retryRights])
  const rightsKnown = rightsStatus === 'known'

  const selection = useMemo(() => selectionOf(pathname), [pathname])
  const query = useMemo(() => new URLSearchParams(search), [search])

  // The address names the layers until the visitor chooses.
  const [chosenLayers, setLayers] = useState<MapLayer[] | null>(null)
  const layers = chosenLayers ?? decodeLayers(query.get('layers')) ?? ALL_LAYERS
  const [showPast, setShowPast] = useState(false)
  const [viewing, setViewing] = useState<MapViewData | null>(null)
  const [viewProblem, setViewProblem] = useState<string | null>(null)
  const [viewAttempt, setViewAttempt] = useState(0)
  const [editor, setEditorState] = useState<Editor | null>(null)
  const [status, setStatus] = useState<MapStatus | null>(null)

  // Every change to the editor goes through here, so the step it takes can
  // be undone. A drag sends many changes under one gesture number; they
  // make one step. The record is taken from what React commits (below),
  // never from a possibly stale copy, so quick successive changes can't
  // lose each other.
  const gestureRef = useRef<number | null>(null)
  const restoringRef = useRef(false)
  const history = useRef<{
    past: Snapshot[]
    future: Snapshot[]
    /** The snapshot of the editor as last committed. */
    last: Snapshot | null
    /** The gesture the latest step belongs to, while it goes on. */
    gesture: number | null
  }>({ past: [], future: [], last: null, gesture: null })
  const historyStore = useMemo(() => createStore({ canUndo: false, canRedo: false }), [])
  const setEditor = useCallback((update: EditorUpdate, gesture?: number) => {
    gestureRef.current = gesture ?? null
    setEditorState((current) => (typeof update === 'function' ? update(current) : update))
  }, [])
  useEffect(() => {
    const record = history.current
    const next = snapshotOf(editor)
    const previous = record.last
    const gesture = gestureRef.current
    record.last = next
    gestureRef.current = null
    const publish = () =>
      historyStore.set({ canUndo: record.past.length > 0, canRedo: record.future.length > 0 })
    if (restoringRef.current) {
      // An undo or redo landing: not a step of its own.
      restoringRef.current = false
      record.gesture = null
      return publish()
    }
    if (!next || !previous || next.kind !== previous.kind) {
      // A new editing session, or none.
      record.past = []
      record.future = []
      record.gesture = null
      return publish()
    }
    if (sameSnapshot(previous, next)) return
    if (gesture != null && gesture === record.gesture) return publish()
    record.gesture = gesture
    record.past = [...record.past.slice(-(HISTORY_LIMIT - 1)), previous]
    record.future = []
    publish()
  }, [editor, historyStore])
  const undo = useCallback(() => {
    const record = history.current
    const target = record.past[record.past.length - 1]
    if (!target || !record.last) return
    record.past = record.past.slice(0, -1)
    record.future = [...record.future, record.last]
    restoringRef.current = true
    setEditorState((current) => (current ? withSnapshot(current, target) : current))
  }, [])
  const redo = useCallback(() => {
    const record = history.current
    const target = record.future[record.future.length - 1]
    if (!target || !record.last) return
    record.future = record.future.slice(0, -1)
    record.past = [...record.past, record.last]
    restoringRef.current = true
    setEditorState((current) => (current ? withSnapshot(current, target) : current))
  }, [])
  const [now, setNow] = useState(() => Date.now())
  const [sheet, setSheet] = useState<SheetState>(selection ? 'half' : 'peek')
  // Where the map is and what's under the pointer: changing with every move, kept out of React state.
  const centreStore = useMemo(() => createStore<MapPosition | null>(null), [])
  const pointerStore = useMemo(() => createStore<Point | null>(null), [])
  const sceneApi = useRef<SceneApi | null>(null)
  const pendingLook = useRef<LookTarget | null>(null)
  const lastSelection = useRef<MapSelection | null | undefined>(undefined)
  const panelRef = useRef<HTMLDivElement>(null)

  // On a phone the sheet covers the foot of the map; what's looked at lands above it.
  const look = useCallback(
    (target: LookTarget) => {
      const inset = wide ? 0 : window.innerHeight * 0.5
      if (sceneApi.current) {
        pendingLook.current = null
        sceneApi.current.look(target, inset)
      } else pendingLook.current = target
    },
    [wide],
  )

  const onApi = useCallback((scene: SceneApi) => {
    // Kept, not cleared: a scene that mounts again (development's double mount) must look at the same place.
    sceneApi.current = scene
    if (pendingLook.current) scene.look(pendingLook.current)
  }, [])

  /** Where the map opens: the address's spot, else the selected thing, else the nation's heartland. Fixed once the page is in the browser. */
  const opening = useMemo<SceneProps['initial'] | null>(() => {
    if (!hydrated) return null
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
    // Whether the address also named a spot, judged now: by the time the view
    // arrives, the map's first settling will have written its own.
    const placed = Boolean(decodeAt(new URLSearchParams(window.location.search).get('at')))
    let cancelled = false
    api
      .view(id)
      .then((view) => {
        if (cancelled) return
        if (!view) return setViewProblem('That map view is no longer on the map.')
        setViewProblem(null)
        setViewing(view)
        setLayers(view.layers)
        if (!placed) look({ centre: view.centre, span: view.span, aspect: view.aspect })
      })
      .catch((error: unknown) => !cancelled && setViewProblem(messageOf(error)))
    return () => {
      cancelled = true
    }
  }, [viewParam, viewAttempt, look])

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
    let handle: number | undefined
    const write = () => {
      const position = centreStore.get()
      if (!position) return
      window.clearTimeout(handle)
      handle = window.setTimeout(() => {
        const next = `${window.location.pathname}${mapsQuery({ at: position, layers, view: viewing?.id ?? null })}`
        if (next !== `${window.location.pathname}${window.location.search}`)
          window.history.replaceState(window.history.state, '', next)
      }, 300)
    }
    write()
    const unsubscribe = centreStore.subscribe(write)
    return () => {
      unsubscribe()
      window.clearTimeout(handle)
    }
  }, [centreStore, layers, viewing])

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
      const query = mapsQuery({ at: centreStore.get(), layers, view: viewing?.id ?? null })
      startTransition(() => router.push(`${selectionHref(next)}${query}`, { scroll: false }))
    },
    [router, centreStore, layers, viewing, setEditor],
  )

  const mayEdit = useCallback(
    (town: number | null) => rights.anywhere || (town != null && rights.towns.includes(town)),
    [rights],
  )

  // The pages are cached for everyone: have them regenerated now, then fetch the fresh one.
  const refresh = useCallback(() => {
    fetch('/maps/revalidate', { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => startTransition(() => router.refresh()))
  }, [router])

  const openEditor = useCallback(
    (next: Editor) => {
      setEditor(next)
      if (window.innerWidth >= 1024) return
      // On a phone the sheet comes up over the foot of the map: what's being edited lands above it.
      setSheet('half')
      const target = editorTarget(next)
      if (target) look(target)
    },
    [setEditor, look],
  )

  const choose = (choice: DrawChoice) => {
    switch (choice) {
      case 'place':
        return openEditor({
          kind: 'place',
          id: null,
          draft: emptyPlace(),
          placing: true,
          tracing: false,
          vertex: null,
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
        return openEditor({ ...viewEditor(null, layers), createdBy: rights.user?.id ?? null })
      case 'views':
        return openEditor({ kind: 'views', everyone: false })
    }
  }

  // Sent from the admin's Map block ("Draw a new view", "Edit this view"):
  // the view editor opens on arrival, on the named view once it has loaded.
  const drawOnArrival = decodeDraw(query.get('draw'))
  const drawOpened = useRef(false)
  useEffect(() => {
    if (drawOpened.current || drawOnArrival !== 'view' || !rightsKnown || !rights.views) return
    if (viewParam) {
      if (viewing?.id !== Number(viewParam)) return
      drawOpened.current = true
      // Once, on arrival, in answer to the address and the view's arrival: not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openEditor(viewEditor(viewing, layers))
      return
    }
    drawOpened.current = true
    choose('view')
    // Arrival only: `choose` is rebuilt each render and needs no watching.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawOnArrival, rightsKnown, rights.views, viewParam, viewing, openEditor])

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
      setEditor(null)
      startTransition(() => router.push('/maps', { scroll: false }))
      refresh()
    },
    [router, refresh, setEditor],
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
        vertex: null,
      }),
    [openEditor],
  )
  const editRoad = useCallback(
    (road: MapRoad) =>
      openEditor({
        kind: 'road',
        id: road.id,
        draft: {
          name: road.name ?? '',
          kind: road.kind,
          line: road.line,
          shape: road.shape,
          corners: road.corners,
        },
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
  const closeEditor = useCallback(() => setEditor(null), [setEditor])
  const showView = useCallback(
    (view: MapViewData) => {
      setEditor(null)
      setViewing(view)
      setLayers(view.layers)
      look({ centre: view.centre, span: view.span, aspect: view.aspect })
    },
    [setEditor, look],
  )

  const actions = useMemo<MapsActions>(
    () => ({
      data,
      rights,
      rightsStatus,
      retryRights,
      selection,
      editor,
      layers,
      now,
      select,
      look,
      edit: openEditor,
      closeEditor,
      showView,
      mayEdit,
      editPlace,
      editRoad,
      editEvent,
      editAbout,
      remove,
      refresh,
      undo,
      redo,
      historyStore,
    }),
    [
      data,
      rights,
      rightsStatus,
      retryRights,
      selection,
      editor,
      layers,
      now,
      select,
      look,
      openEditor,
      closeEditor,
      showView,
      mayEdit,
      editPlace,
      editRoad,
      editEvent,
      editAbout,
      remove,
      refresh,
      undo,
      redo,
      historyStore,
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
    startTransition(() =>
      router.push(selectionHref({ kind, id: item.id } as MapSelection), { scroll: false }),
    )
    refresh()
  }

  // Escape steps out of the editor, then out of the selection. ⌘Z and ⌃Z
  // undo a step of drawing, with Shift (or ⌃Y) redo; a field keeps its own.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && (key === 'z' || key === 'y')) {
        if (!snapshotOf(editor)) return
        event.preventDefault()
        if (key === 'y' || event.shiftKey) redo()
        else undo()
        return
      }
      if (event.key !== 'Escape') return
      if (editor) return // the editor handles its own steps
      if (viewing) setViewing(null)
      else if (selection) select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor, selection, viewing, select, undo, redo])

  const described = describe(data, selection)
  const canDraw = rights.anywhere || rights.towns.length > 0
  const liveEvents = data.events.filter((event) => eventPhase(event, now) === 'now').length
  const upcoming = data.events.filter((event) => eventPhase(event, now) === 'upcoming').length
  // While a view is drawn, the map shows the view's own layers.
  const sceneLayers = editor?.kind === 'view' ? editor.draft.layers : layers

  const back = (
    <button
      aria-label="Back to the map"
      className="-ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-sea-700 hover:text-sea-900 focus-visible:outline-saffron-500"
      onClick={() => select(null)}
      type="button"
    >
      <Icon className="h-4 w-4" name="back" />
    </button>
  )

  const content = editor ? (
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
      ) : viewProblem ? (
        <Notice className="m-3 flex items-center gap-3" tone="warning">
          <span className="min-w-0 flex-1">{viewProblem}</span>
          <TextButton
            className="shrink-0 px-2 py-1"
            onClick={() => {
              setViewProblem(null)
              setViewAttempt((attempt) => attempt + 1)
            }}
          >
            Retry
          </TextButton>
        </Notice>
      ) : null}
      {/* Beside the map, a way back above the page; on a phone the sheet's own line has it. */}
      {wide && selection ? (
        <div className="flex items-start gap-3 border-b border-sand-300 px-4 py-3">
          <span className="mt-0.5">{back}</span>
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
  )

  const controls = (
    <>
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

  // Nothing until the visitor is known, so a signed-in reader never sees
  // "Sign in" flash; when the Registry can't be reached, that is said
  // instead, with a way to ask again, since the person may well be signed in.
  const account =
    rightsStatus === 'unreachable' ? (
      <button
        className="inline-flex max-w-[60%] items-center gap-1.5 text-left text-[11px] leading-tight text-saffron-600 hover:text-saffron-500 focus-visible:outline-saffron-500"
        onClick={retryRights}
        title="The Registry couldn’t be reached, so who you are isn’t known yet. Click to try again."
        type="button"
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500" />
        <span>
          Couldn’t reach the Registry · <span className="font-semibold underline">Retry</span>
        </span>
      </button>
    ) : !rightsKnown ? null : rights.user ? (
      <span
        className="inline-flex min-w-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-ink-500"
        title={`Signed in as ${rights.user.name}: ${standingOf(rights, data.towns)}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" name="user" />
        <span className="truncate">
          {rights.user.name}
          <span className="normal-case tracking-normal text-ink-400">
            {' '}
            · {standingOf(rights, data.towns)}
          </span>
        </span>
      </span>
    ) : (
      <Link
        className="text-[11px] uppercase tracking-[0.16em] text-sea-700 hover:text-sea-900"
        href="/login?next=/maps"
      >
        Sign in
      </Link>
    )

  /** The sheet's own line: at a peek, what it holds; drawn up, just the pill, since the page's head is right below. */
  const handle =
    sheet !== 'peek' ? null : described ? (
      <span className="min-w-0 flex-1">
        <span className="block font-label text-[10px] uppercase tracking-[0.2em] text-saffron-600">
          {described.kind}
        </span>
        <span className="block truncate font-display text-lg leading-tight text-sea-950">
          {described.title}
        </span>
      </span>
    ) : editor ? (
      <span className="min-w-0 flex-1 truncate font-semibold text-sea-900">Drawing on the map</span>
    ) : (
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="font-display text-lg leading-tight text-sea-950">Azania at a glance</span>
        <span className="truncate text-xs text-ink-500">
          {settlements(data.towns).length} towns
          {liveEvents
            ? ` · ${liveEvents} on now`
            : upcoming
              ? ` · ${upcoming} coming up`
              : ''}
        </span>
      </span>
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
              <div className="flex min-h-full flex-col">{content}</div>
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
              now={now}
              onApi={onApi}
              onEditor={setEditor}
              onMove={centreStore.set}
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
            <div className="absolute left-3 right-3 top-3 z-20 flex items-center gap-2">
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
                <PointerReadout centre={centreStore} pointer={pointerStore} towns={data.towns} />
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
          <Sheet handle={handle} onState={setSheet} state={sheet}>
            {/* One line of tools over the page: the way back, the map's centre, the account. */}
            <div className="flex items-center gap-3 border-b border-sand-300 px-4 py-1.5">
              {selection && !editor ? back : null}
              <div className="min-w-0 flex-1">
                <PointerReadout bare centre={centreStore} pointer={pointerStore} towns={data.towns} />
              </div>
              {account}
            </div>
            <div className="flex min-h-full flex-col">{content}</div>
          </Sheet>
        ) : null}
      </div>
    </MapsContext.Provider>
  )
}

/** Where to look when an editor opens on something already drawn: a road's course, a pin. */
function editorTarget(editor: Editor): LookTarget | null {
  switch (editor.kind) {
    case 'road': {
      const bounds = editor.draft.line.length >= 2 ? pad(boundsOf(roadPoints(editor.draft))) : null
      return bounds ? { bounds } : null
    }
    case 'place':
      return editor.draft.point ? { centre: editor.draft.point, zoom: 1, minZoom: true } : null
    case 'event':
      return editor.draft.point ? { centre: editor.draft.point, zoom: 1, minZoom: true } : null
    default:
      return null
  }
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
      const bounds = road ? pad(boundsOf(roadPoints(road))) : null
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
