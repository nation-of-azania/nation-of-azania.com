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
import { abroadOf, abroadTownPage, homeNationOf, isOldSpawnTown, nationFit, worldSlug, type Abroad } from '@/maps/abroad'
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
import { azaniaSide, bySiegeWeight, siegeHeadline, siegeTitle } from '@/maps/sieges'
import { settlements, siteFacts, siteTitle } from '@/maps/sites'
import { inWorld, wrapPoint } from '@/maps/source'
import { eventPhase, toLocalInput } from '@/maps/time'
import {
  ALL_LAYERS,
  decodeAt,
  decodeDraw,
  decodeExtras,
  decodeLayers,
  DEFAULT_EXTRAS,
  MAPS_PATH,
  mapsQuery,
  sameSelection,
  selectionHref,
  selectionOf,
  type ExtraLayer,
  type Extras,
  type MapPosition,
  type MapSelection,
} from '@/maps/url'

import { api, ApiError, messageOf } from './api'
import { MapsContext, type EditorUpdate, type MapsActions, type RightsStatus } from './context'
import { EditorPanel } from './editor/EditorPanel'
import { createStore, useHydrated, useLatest, useMediaQuery, useSearch, useStore } from './hooks'
import { abroadTownTarget } from './layers/AbroadLayer'
import { useLivePlayers } from './live'
import type { LookTarget, SceneApi, SceneProps } from './MapScene'
import { Preview } from './panels/Preview'
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
import { DiplomacyKey } from './ui/Diplomacy'
import { Icon } from './ui/icons'
import { Coordinates, LiveCount, StatusNote, type MapStatus } from './ui/Readouts'
import { Search } from './ui/Search'
import { Sheet, type SheetState } from './ui/Sheet'
import { WhatsOnStrip } from './ui/WhatsOn'
import { Wordmark } from './ui/Wordmark'
import { SiegeBadge } from './ui/Siege'
import { useWar } from './war'
import { useWorld } from './world'

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
  world: Abroad | null,
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
    case 'abroad': {
      const found = world?.townBySlug.get(selection.slug)
      if (!found) return null
      return { title: spoken(found.name), kind: found.nation ? `Town · ${spoken(found.nation)}` : 'Town · no nation' }
    }
    case 'nation': {
      const found = world?.nationBySlug.get(selection.slug)
      return found ? { title: spoken(found.name), kind: 'Nation' } : null
    }
  }
}

type Store<T> = ReturnType<typeof createStore<T>>

/**
 * A page the reader has opened that hasn't arrived yet: what it is (null
 * for the map's front), its address, whether it has been sent for (it
 * isn't while the browser is offline), and whether the reader came to it
 * by back or forward, when asking again must not add a step to the
 * history. Each asking has a number of its own, so a timer set for one
 * can't speak for the next.
 */
type Asked = {
  selection: MapSelection | null
  href: string
  sent: boolean
  traversed?: boolean
  id: number
}

/** How long a page may take before the panel says it's slow in coming and offers to ask again. */
const SLOW_MS = 8000

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
 * The map's spot as an address names it: the world repeats east and west
 * on the live map, and a centre in an echo of it is given as the same spot
 * in the real world, so a shared link opens there.
 */
const realPosition = (position: MapPosition | null): MapPosition | null =>
  position && { centre: wrapPoint(position.centre), zoom: position.zoom }

/**
 * The block under the pointer, else the middle of the view: both change
 * with every move, so they live in small stores rather than React state,
 * and only this readout re-renders for them. In an echo of the world the
 * pointer is over nothing, and a centre there names no spot a player can
 * reach, so neither is read out.
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
      point={under ?? (position && inWorld(position.centre) ? position.centre : null)}
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
  const [, startTransition] = useTransition()

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

  // The page the reader has opened, from the moment they open it until it
  // arrives: meanwhile the panel is drawn from what the browser already
  // holds (panels/Preview.tsx), the map marks it, and the page is on its
  // way. It has arrived when the address moves, to it or to wherever the
  // server sent the reader instead (a page that isn't on the map).
  const [asked, setAsked] = useState<Asked | null>(null)
  // Whether the panel holds a page that came after its preview: what it brought fades in.
  const [handedOver, setHandedOver] = useState(false)
  const [seenPath, setSeenPath] = useState(pathname)
  if (pathname !== seenPath) {
    setSeenPath(pathname)
    if (asked) {
      setAsked(null)
      setHandedOver(true)
    }
  }
  const landed = useMemo(() => selectionOf(pathname), [pathname])
  // What's open: the page asked for, ahead of the address.
  const selection = asked ? asked.selection : landed
  const query = useMemo(() => new URLSearchParams(search), [search])

  // The address names the layers until the visitor chooses.
  const [chosenLayers, setLayers] = useState<MapLayer[] | null>(null)
  const layers = chosenLayers ?? decodeLayers(query.get('layers')) ?? ALL_LAYERS
  // The layers that aren't the nation's own data (the players online, the world around it), at their defaults unless said otherwise.
  const [chosenExtras, setExtras] = useState<Extras | null>(null)
  const extras = chosenExtras ?? decodeExtras(query.get('layers')) ?? DEFAULT_EXTRAS
  const setExtra = useCallback(
    (layer: ExtraLayer, on: boolean) => setExtras({ ...extras, [layer]: on }),
    [extras],
  )
  // The players online are polled only while their layer is on and the tab is seen.
  const live = extras.players
  const liveStore = useLivePlayers(live)
  // The rest of the world: asked for once the map has settled, at once when the page is a town or a nation abroad.
  const [mapReady, setMapReady] = useState(false)
  const foreign = selection?.kind === 'abroad' || selection?.kind === 'nation'
  const worldState = useWorld(mapReady, foreign)
  const world = useMemo(
    () => (worldState.world ? abroadOf(worldState.world, data.towns) : null),
    [worldState.world, data.towns],
  )
  // The war: asked for at once and every few minutes while the tab is seen; a siege is always shown.
  const war = useWar()
  const [chosenSiege, setSiegeOpen] = useState<string | null>(null)
  // A siege that has ended takes its card with it.
  const siegeOpen = chosenSiege && war.sieges.some((siege) => siege.townId === chosenSiege) ? chosenSiege : null
  // Azania's own sieges, its towns besieged first: what the map's alert and the front say.
  const ourSieges = useMemo(() => {
    const home = { nation: homeNationOf(data.towns), towns: data.towns }
    return bySiegeWeight(war.sieges.map((siege) => ({ siege, side: azaniaSide(siege, home) }))).filter(
      (entry) => entry.side !== null,
    )
  }, [war.sieges, data.towns])
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
    setMapReady(true)
  }, [])

  // A page abroad says where its town or nation is (panels/AbroadPanel.tsx → Arrival), since
  // the world it's in arrives after the page; the map waits a moment for it before opening.
  const [arrival, setArrival] = useState<LookTarget | null>(null)
  // Said at once as well, for the first look's sake, which runs before the state does.
  const arrived = useRef(false)
  const arrive = useCallback((target: LookTarget) => {
    arrived.current = true
    setArrival((current) => current ?? target)
  }, [])
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    if (!hydrated || !foreign) return
    const handle = window.setTimeout(() => setWaited(true), 1200)
    return () => window.clearTimeout(handle)
  }, [hydrated, foreign])

  /** Where the map opens: the address's spot, else the selected thing, else the nation's heartland. Fixed once the page is in the browser. */
  const [opening, setOpening] = useState<SceneProps['initial'] | null>(null)
  const awaiting = foreign && !arrival && !world && !waited && !decodeAt(query.get('at'))
  if (hydrated && !opening && !awaiting) {
    const at = decodeAt(query.get('at'))
    const target = selection ? (lookFor(data, world, selection) ?? arrival) : null
    const heart = heartland(data.towns)
    setOpening(
      at ??
        (target ? initialOf(target) : null) ??
        (heart ? { bounds: heart, padding: 64 } : { centre: [4300, 5600], zoom: -3 }),
    )
  }

  // On arrival at a spot the address named, the selection is left where it is.
  useEffect(() => {
    if (!hydrated || lastSelection.current !== undefined) return
    if (decodeAt(query.get('at'))) lastSelection.current = landed
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
        const next = `${window.location.pathname}${mapsQuery({ at: realPosition(position), layers, extras, view: viewing?.id ?? null })}`
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
  }, [centreStore, layers, extras, viewing])

  // Opening something draws the sheet up on a phone, and starts the panel at its top, at once.
  const [sheetFor, setSheetFor] = useState(selection)
  if (!sameSelection(sheetFor, selection)) {
    setSheetFor(selection)
    if (selection) setSheet('half')
  }
  const page = selectionHref(selection)
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 })
  }, [page])
  // The map looks at it once its page has arrived, as it always has. Flown
  // the moment it's opened, the map's new tiles would share a slow
  // connection with the page and the code it needs, and keep the panel's
  // placeholders up for seconds longer; the map marks it at once instead.
  // A town or a nation abroad opened before the world arrived is looked at once it has.
  // Unless the reader moved the map themselves while it came: then the map is
  // where they want it, and it stays there.
  const movesNow = () => sceneApi.current?.moves() ?? 0
  // The reader's moves of the map so far, counted when a page was asked for (null: none is coming).
  const movesAsked = useRef<number | null>(null)
  const owedLook = useRef<{ selection: MapSelection; moves: number } | null>(null)
  useEffect(() => {
    if (lastSelection.current !== undefined && sameSelection(lastSelection.current, landed)) return
    const first = lastSelection.current === undefined
    lastSelection.current = landed
    owedLook.current = null
    const since = movesAsked.current ?? movesNow()
    movesAsked.current = null
    if (first) {
      // The map opened before anything said where a page abroad is: it looks once the world arrives,
      // unless the address named a spot, which is where the reader asked to be.
      const placed = Boolean(decodeAt(new URLSearchParams(window.location.search).get('at')))
      if (landed && !placed && !arrived.current && !lookFor(data, world, landed)) {
        owedLook.current = { selection: landed, moves: since }
      }
      return
    }
    if (landed && movesNow() <= since) {
      const target = lookFor(data, world, landed)
      if (target) look(target)
      else owedLook.current = { selection: landed, moves: since }
    }
  }, [landed, data, world, look])
  useEffect(() => {
    const owed = owedLook.current
    if (!world || !owed || !sameSelection(owed.selection, landed)) return
    owedLook.current = null
    if (movesNow() > owed.moves) return
    const target = lookFor(data, world, owed.selection)
    if (target) look(target)
  }, [world, landed, data, look])

  const askedRef = useLatest(asked)
  const pathRef = useLatest(pathname)
  const askings = useRef(0)
  /**
   * Open a page: its panel at once, the page itself sent for now, or, while
   * the browser is offline, once it's back (asked for offline, the router
   * would have the browser leave the map for its own error page). The same
   * page opened twice is sent for once. The page already open needs
   * nothing, unless another is on its way, which it must overtake.
   */
  const go = useCallback(
    (chosen: MapSelection | null) => {
      const next = settle(chosen, data, world)
      const waiting = askedRef.current
      if (waiting && sameSelection(waiting.selection, next)) return
      const href = `${selectionHref(next)}${mapsQuery({ at: realPosition(centreStore.get()), layers, extras, view: viewing?.id ?? null })}`
      const push = () => startTransition(() => router.push(href, { scroll: false }))
      const here = next ? sameSelection(next, selectionOf(pathRef.current)) : pathRef.current === MAPS_PATH
      if (here) {
        setAsked(null)
        if (waiting?.sent) push()
        return
      }
      const sent = navigator.onLine
      setHandedOver(false)
      setAsked({ selection: next, href, sent, id: ++askings.current })
      movesAsked.current = movesNow()
      if (sent) push()
    },
    [router, centreStore, layers, extras, viewing, askedRef, pathRef, data, world],
  )

  const select = useCallback(
    (next: MapSelection | null) => {
      setEditor(null)
      go(next)
    },
    [go, setEditor],
  )

  // Back and forward: the page the browser goes to is drawn at once too,
  // while the router fetches it. One it still holds replaces it within a
  // frame, before any placeholder shows.
  useEffect(() => {
    const onPop = () => {
      const path = window.location.pathname
      const next = selectionOf(path)
      if (path === pathRef.current || (!next && path !== MAPS_PATH)) return
      setHandedOver(false)
      setAsked({
        selection: next,
        href: `${path}${window.location.search}`,
        sent: true,
        traversed: true,
        id: ++askings.current,
      })
      movesAsked.current = movesNow()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [pathRef])

  // A page held while the browser was offline is sent for once it's back.
  useEffect(() => {
    if (!asked || asked.sent) return
    const send = () => {
      setAsked((current) => (current?.id === asked.id ? { ...current, sent: true } : current))
      startTransition(() => router.push(asked.href, { scroll: false }))
    }
    window.addEventListener('online', send)
    return () => window.removeEventListener('online', send)
  }, [asked, router])

  // A page slow in coming is said to be, with a way to ask again, rather than left shimmering for ever.
  const [stalled, setStalled] = useState<number | null>(null)
  useEffect(() => {
    if (!asked?.sent) return
    const id = asked.id
    const handle = window.setTimeout(() => setStalled(id), SLOW_MS)
    return () => window.clearTimeout(handle)
  }, [asked])
  const slow = asked?.sent === true && stalled === asked.id
  // Slow, or held offline: its placeholders stop shimmering, and the panel says why.
  const held = asked != null && (slow || !asked.sent)
  const askAgain = () => {
    if (!asked) return
    const sent = navigator.onLine
    setAsked({ ...asked, sent, id: ++askings.current })
    if (!sent) return
    // Reached by back or forward, the address is already the page's own.
    if (asked.traversed) startTransition(() => router.replace(asked.href, { scroll: false }))
    else startTransition(() => router.push(asked.href, { scroll: false }))
  }

  // A link to another of the map's pages, anywhere in the shell (a place in
  // a town's panel, the wordmark), opens it as everything else does: the
  // panel at once, the map's state kept. Like the link it was, it leaves an
  // editor open, drawing and all. A link with its own query, or one opened
  // in a new tab, goes its own way.
  const followLink = (event: React.MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as Element).closest('a[href]')
    if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return
    if (anchor.target && anchor.target !== '_self') return
    const url = new URL(anchor.href)
    if (url.origin !== window.location.origin || url.search || url.hash) return
    const next = selectionOf(url.pathname)
    if (!next && url.pathname !== MAPS_PATH) return
    event.preventDefault()
    go(next)
  }

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
      go(null)
      refresh()
    },
    [go, refresh, setEditor],
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
  /** A siege's card, opened from a panel or the alert: the map comes to its banner, close enough to see the town. */
  const openSiege = useCallback(
    (townId: string) => {
      const siege = war.sieges.find((candidate) => candidate.townId === townId)
      if (!siege) return
      setEditor(null)
      setSiegeOpen(townId)
      look({ centre: siege.at, zoom: -1.5, minZoom: true })
    },
    [war.sieges, setEditor, look],
  )
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
      world,
      worldStatus: worldState.status,
      arrive,
      extras,
      setExtra,
      war,
      openSiege,
    }),
    [
      world,
      worldState.status,
      arrive,
      extras,
      setExtra,
      war,
      openSiege,
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
    go({ kind, id: item.id })
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

  const described = describe(data, world, selection)
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
          <p className="min-w-0 flex-1 self-center text-[11px] uppercase tracking-[0.18em] text-ink-400">
            Azania Maps
          </p>
        </div>
      ) : null}
      {/* The page, or until it arrives its preview: busy meanwhile, still once it's slow or held. */}
      <div
        aria-busy={asked ? true : undefined}
        className="az-panel flex-1"
        data-arrived={handedOver ? '' : undefined}
        data-stalled={held ? '' : undefined}
      >
        {asked && held ? (
          <div className="mx-4 mt-3 flex items-center gap-3 border border-sand-300 bg-sand-100/70 px-3 py-2 text-[13px] leading-snug text-ink-700">
            <Icon className="h-4 w-4 shrink-0 text-saffron-600" name={asked.sent ? 'clock' : 'offline'} />
            <span className="min-w-0 flex-1">
              {asked.sent
                ? 'Still on its way: the connection is slow.'
                : 'You’re offline. It opens as soon as the connection is back.'}
            </span>
            {asked.sent ? (
              <TextButton className="shrink-0 px-2.5 py-1" onClick={askAgain}>
                Try again
              </TextButton>
            ) : null}
          </div>
        ) : null}
        {asked ? <Preview selection={asked.selection} /> : children}
      </div>
    </>
  )

  const controls = (
    <>
      <LayerMenu
        extras={extras}
        layers={layers}
        liveStore={liveStore}
        onChange={setLayers}
        onExtra={setExtra}
        onShowPast={setShowPast}
        showPast={showPast}
        worldStatus={worldState.status}
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
    ) : ourSieges.length ? (
      // A siege Azania is in leads the front, even folded away.
      <span className="min-w-0 flex-1">
        <span className="block font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-coral-700">
          Siege{ourSieges.length > 1 ? ` · ${ourSieges.length} of Azania’s` : ''}
        </span>
        <span className="block truncate font-display text-lg leading-tight text-coral-700">
          {siegeHeadline(ourSieges[0].siege, ourSieges[0].side)}
        </span>
      </span>
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

  // Said to a screen reader as a page is opened, while the panel is busy with it.
  const askedName = asked ? (described?.title ?? (asked.selection ? 'the page' : 'Azania at a glance')) : null
  const announcement = !asked
    ? ''
    : !asked.sent
      ? `You’re offline: ${askedName} opens as soon as the connection is back.`
      : slow
        ? `Still loading ${askedName}: the connection is slow.`
        : `Loading ${askedName}…`

  return (
    <MapsContext.Provider value={actions}>
      <div
        className="az-maps fixed inset-0 flex bg-sea-900 text-ink-900"
        data-tool={editor ? editor.kind : undefined}
        onClickCapture={followLink}
      >
        <p aria-live="polite" className="sr-only" role="status">
          {announcement}
        </p>
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
              <Search className="mt-3" data={data} onPick={select} world={world} />
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
              diplomacy={extras.diplomacy}
              editor={editor}
              initial={opening}
              layers={sceneLayers}
              live={live}
              liveStore={liveStore}
              now={now}
              onApi={onApi}
              onEditor={setEditor}
              onMove={centreStore.set}
              onPointer={pointerStore.set}
              onSelect={select}
              rights={rights}
              selection={selection}
              showPast={showPast}
              showWorld={extras.world}
              siegeOpen={siegeOpen}
              sieges={war.sieges}
              onSiege={setSiegeOpen}
              capitals={war.capitals}
              radius={war.radius}
              showReach={extras.reach}
              viewing={viewing}
              world={world}
            />
          ) : null}

          {/* Phone: the name and the search float over the map. */}
          {!wide ? (
            <div className="absolute left-3 right-3 top-3 z-20 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 border border-sand-300 bg-sand-50 py-1 pl-2.5 pr-1 shadow-[0_1px_2px_rgba(22,25,31,0.08)]">
                <Wordmark small />
                <Search className="min-w-0 flex-1" data={data} onPick={select} world={world} />
              </div>
            </div>
          ) : null}

          {/*
            The map's own notes, top left, clear of the controls: a siege Azania is in, which
            nobody should miss, and the diplomacy layer's key.
          */}
          {ourSieges.length || extras.diplomacy ? (
            <div
              className={cn(
                'pointer-events-none absolute left-3 z-10 flex flex-col items-start gap-2',
                // Clear of the controls: a column of them beside a wide map, a row of two on a phone's.
                wide ? 'top-3 max-w-[calc(100%-4.75rem)]' : 'top-16 max-w-[calc(100%-7.75rem)]',
              )}
            >
              {ourSieges.slice(0, wide ? 2 : 1).map(({ siege, side }) => (
                <div
                  className="az-siege-alert pointer-events-auto flex w-[22rem] max-w-full items-center gap-2.5 border border-l-4 border-coral-600/50 border-l-coral-600 bg-sand-50/95 py-2 pl-2.5 pr-2 shadow-[0_2px_8px_rgba(22,25,31,0.18)]"
                  key={siege.townId}
                  role="status"
                >
                  <SiegeBadge className="h-7 w-7" side={side} siege={siege} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-display text-[15px] font-semibold leading-tight text-coral-700">
                      {siegeHeadline(siege, side)}
                    </p>
                    <p className="truncate text-[12px] text-ink-500">
                      {siegeTitle(siege)}
                      {siege.progress ? ` · ${siege.progress.done} of ${siege.progress.of} fought` : ''}
                      {siege.battle ? ' · a battle on' : ''}
                    </p>
                  </div>
                  <TextButton className="shrink-0 px-2.5 py-1" onClick={() => openSiege(siege.townId)}>
                    Show
                  </TextButton>
                </div>
              ))}
              {ourSieges.length > (wide ? 2 : 1) ? (
                <p className="pointer-events-auto border border-sand-300 bg-sand-50/95 px-2.5 py-1 text-[12px] text-coral-700">
                  and {ourSieges.length - (wide ? 2 : 1)} more of Azania’s sieges: see the front
                </p>
              ) : null}
              {extras.diplomacy ? (
                <DiplomacyKey className="pointer-events-auto w-[19rem] max-w-full" relations={data.relations} />
              ) : null}
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

          {/*
            The foot of the map, measured against the map's own width (a container, since the
            panel takes its share of the window): on a wide map the readout and the count sit
            left and the What's-on strip right, taking under half the width; the readout gives
            way first, showing its hint and walk only on a wide map and shrinking the walk before
            the command, and the strip's rows scroll within it. On a narrower map the two stack,
            the strip beneath the readout, full width.
          */}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex flex-col items-start gap-2 @container">
            <StatusNote className="pointer-events-auto max-w-md" status={status} />
            {wide ? (
              <div className="flex w-full flex-col items-start gap-2 @4xl:flex-row @4xl:items-end @4xl:justify-between @4xl:gap-3">
                <div className="flex min-w-0 max-w-full items-center gap-2 @4xl:flex-1">
                  <PointerReadout centre={centreStore} pointer={pointerStore} towns={data.towns} />
                  <LiveCount className="pointer-events-auto shrink-0" store={liveStore} />
                </div>
                <WhatsOnStrip
                  className="pointer-events-auto w-full max-w-2xl @4xl:w-[45%] @4xl:shrink-0"
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
          <Sheet handle={handle} onState={setSheet} page={page} state={sheet}>
            {/* One line of tools over the page: the way back, the map's centre, the account. */}
            <div className="flex items-center gap-3 border-b border-sand-300 px-4 py-1.5">
              {selection && !editor ? back : null}
              <div className="min-w-0 flex-1">
                <PointerReadout bare centre={centreStore} pointer={pointerStore} towns={data.towns} />
              </div>
              <LiveCount className="shrink-0 border-0 bg-transparent px-0" store={liveStore} />
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

/** Where the map opens for something to look at: its bounds filled, or its spot at its zoom. */
function initialOf(target: LookTarget): SceneProps['initial'] | null {
  if ('bounds' in target) return { bounds: target.bounds, padding: 64 }
  if ('centre' in target && 'zoom' in target && target.zoom != null)
    return { centre: target.centre, zoom: target.zoom }
  return null
}

/**
 * Where a selection's page really is, when the browser can tell: a town
 * named abroad that is Azania's own has a page of its own, and Azania's
 * own nation, like the server's old spawn town, is the map's front. The
 * server would send the reader on from the other, after a round trip and a
 * blank panel between.
 */
function settle(selection: MapSelection | null, data: MapData, world: Abroad | null): MapSelection | null {
  if (selection?.kind === 'abroad' && isOldSpawnTown(selection.slug)) return null
  if (selection?.kind === 'nation') {
    const home = homeNationOf(data.towns)
    return home && worldSlug(home) === selection.slug ? null : selection
  }
  if (selection?.kind === 'abroad' && world && !world.townBySlug.has(selection.slug)) {
    const page = abroadTownPage(world, selection.slug, null)
    const own = page?.kind === 'own' ? data.towns.find((town) => town.townyId === page.townyId) : null
    if (own) return { kind: 'town', slug: own.slug }
  }
  return selection
}

/** Where to look for a selection: a town's main claim, a road's course, a point up close, a nation's heartland. */
function lookFor(data: MapData, world: Abroad | null, selection: MapSelection): LookTarget | null {
  switch (selection.kind) {
    case 'abroad': {
      const town = world?.townBySlug.get(selection.slug)
      return town ? abroadTownTarget(town) : null
    }
    case 'nation': {
      const nation = world?.nationBySlug.get(selection.slug)
      const bounds = nation ? nationFit(nation) : null
      return bounds ? { bounds } : null
    }
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
