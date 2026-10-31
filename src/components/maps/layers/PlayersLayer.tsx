'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { minecraftHeadUrl } from '@/components/site/format'
import type { PlayerSide } from '@/maps/battle'
import { spoken, type MapData, type MapTown } from '@/maps/data'
import type { Point } from '@/maps/geo'
import { isBedrockName, MAX_ARMOR, MAX_HEALTH, TELEPORT_BLOCKS, townOfPlayer, type LivePlayer } from '@/maps/players'
import { settlements } from '@/maps/sites'
import { spawnRoute } from '@/maps/spawn'

import type { LiveState } from '../live'
import type { Store } from '../hooks'
import { useLatest, useStore } from '../hooks'
import { L, toLatLng, useLeaflet } from '../leaflet/canvas'
import { monogramOf } from '../ui/Head'
import { Icon } from '../ui/icons'
import { useCopy } from '../ui/Readouts'
import { LOW_HEALTH } from '../ui/Vitals'

/**
 * Who is online and where, live: each player a small Minecraft head on the
 * map, gliding from one reading to the next rather than jumping every few
 * seconds, Azania's own residents ringed in saffron. Plain Leaflet markers
 * in a pane of their own, moved by one animation frame loop writing
 * transforms — nothing of React's runs per frame, and the SVG overlay with
 * every other layer is never touched for a poll. Names stand beside the
 * heads at every zoom while the viewer has it so (`named`, on unless they
 * turned it off); otherwise on hover, on the chosen player, and close in.
 * A click opens a small card beside the head with who they are, where,
 * and the way there as a player has it. The heads stand only in the real
 * world, never in an echo of it.
 *
 * In the war view (`war`) the heads are fighters: ringed by their side in
 * the siege the view is on (attackers coral, defenders sea), with health
 * and armour drawn under the name as two small bars, and a click gives
 * the player to the sidebar rather than opening the card. The one being
 * watched wears a ring that breathes, and, while the view follows them,
 * the map pans with each reading to keep them in the middle: the pan
 * takes as long as the reading does, so the ground moves as they do. A
 * drag of the map ends the following; the sidebar can start it again.
 */

/** The names show for everyone from this zoom in; before that, on hover and on the chosen player. */
const NAMED_FROM = 0.5
/** The head's size on the map, in CSS px: 8 skin pixels at 3 each. */
const HEAD_PX = 24
/** The marker's box, head and ring; the anchor is its middle. */
const BOX_PX = 28

const PANE = 'az-players'

/** Room in a head's stacking for the heads that share its block row, by when each arrived. */
const STACK_SPREAD = 1000
/** How far a hovered head rises: over every other, wherever it stands. */
const RISE = 100_000_000

type StackedMarker = L.Marker & { _icon?: HTMLElement | null; arrival: number }

/** Leaflet's own record of an animated zoom (a flight) under way, which a following pan must not cut short. */
type AnimatingMap = L.Map & { _animatingZoom?: boolean }

/**
 * A head's marker, stacked by where its player stands in the world, south
 * over north as the map draws it, and two in one row by when each arrived.
 * Leaflet stacks a marker by its pixel on the page instead, rounded afresh
 * every frame of a zoom, so two heads at nearly one height traded places
 * frame by frame and flickered.
 */
const HeadMarker = L.Marker.extend({
  _updateZIndex(this: StackedMarker, offset: number) {
    if (!this._icon) return
    this._icon.style.zIndex = String(Math.round(this.getLatLng().lat) * STACK_SPREAD + this.arrival + offset)
  },
}) as unknown as new (latlng: L.LatLngExpression, options?: L.MarkerOptions) => StackedMarker
let arrivals = 0

type Entry = {
  marker: L.Marker
  element: HTMLElement
  player: LivePlayer
  /** Where the head is gliding from and to, when it set off, and how long the glide takes: the feed's own beat. */
  from: Point
  to: Point
  since: number
  over: number
  /** Whether it has arrived, so a frame can leave it alone. */
  still: boolean
}

/** What the war view asks of the heads. */
export type WarHeads = {
  /** A player's side in the siege the view is on; null for someone it can't place. */
  sideOf: (name: string) => PlayerSide | null
  /** The player the sidebar is watching, and whether the map follows them. */
  watch: string | null
  follow: boolean
  /** A head clicked: the sidebar takes the player. */
  onPick: (name: string) => void
  /** The reader dragged the map away from the one followed. */
  onFollowBroken: () => void
  /** How much of the map's foot a phone's sheet covers, in px, so the one followed is kept in the middle of what's left. */
  cover: number
}

const at = (player: LivePlayer): Point => [player.x, player.z]

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The head: the player's monogram, with the skin service's face laid over
 * it once the face has arrived. A Bedrock player (whom the skin service
 * doesn't know), a face still on its way and one that won't load all show
 * the monogram, so a head is never an empty square.
 */
function headOf(name: string): HTMLElement {
  const { letter, ink } = monogramOf(name)
  const mark = document.createElement('span')
  mark.className = 'az-player-mark'
  mark.style.setProperty('--az-monogram', ink)
  mark.textContent = letter
  if (isBedrockName(name)) return mark
  const image = document.createElement('img')
  image.className = 'az-player-head'
  image.alt = ''
  image.decoding = 'async'
  image.width = HEAD_PX
  image.height = HEAD_PX
  image.onload = () => image.setAttribute('data-loaded', '')
  image.onerror = () => image.remove()
  image.src = minecraftHeadUrl(name, HEAD_PX * 2)
  mark.appendChild(image)
  return mark
}

/** The same head in React, for the card. */
function PlayerHead({ name }: { name: string }) {
  const { letter, ink } = monogramOf(name)
  const [face, setFace] = useState<'loading' | 'loaded' | 'failed'>('loading')
  return (
    <span className="az-player-mark" style={{ '--az-monogram': ink } as CSSProperties}>
      {letter}
      {isBedrockName(name) || face === 'failed' ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- the skin service's head, kept crisp; the marker uses the same picture
        <img
          alt=""
          className="az-player-head"
          data-loaded={face === 'loaded' ? '' : undefined}
          decoding="async"
          height={HEAD_PX}
          onError={() => setFace('failed')}
          onLoad={() => setFace('loaded')}
          src={minecraftHeadUrl(name, HEAD_PX * 2)}
          width={HEAD_PX}
        />
      )}
    </span>
  )
}

/** The marker's element: the head, the name beneath it, and under the name the two bars the war view shows. */
function iconFor(player: LivePlayer, town: MapTown | null): { icon: L.DivIcon; element: HTMLElement } {
  const element = document.createElement('div')
  element.className = `az-player az-player-new${town ? ' az-player-azanian' : ''}`
  element.setAttribute('role', 'button')
  element.setAttribute('aria-label', `${player.name}, online${town ? `, of ${spoken(town.name)}` : ''}`)
  element.appendChild(headOf(player.name))
  const name = document.createElement('span')
  name.className = 'az-player-name'
  name.textContent = player.name
  element.appendChild(name)
  const vitals = document.createElement('span')
  vitals.className = 'az-player-vitals'
  const stats = document.createElement('span')
  stats.className = 'az-player-stats'
  for (const kind of ['health', 'armour'] as const) {
    const stat = document.createElement('span')
    stat.className = 'az-player-stat'
    stat.dataset.kind = kind
    stat.innerHTML = kind === 'health' ? HEART : CHESTPLATE
    const figure = document.createElement('b')
    figure.className = 'az-player-figure'
    stat.appendChild(figure)
    stats.appendChild(stat)
  }
  vitals.appendChild(stats)
  for (const kind of ['health', 'armour']) {
    const bar = document.createElement('span')
    bar.className = 'az-vital-track'
    bar.dataset.kind = kind
    const fill = document.createElement('span')
    fill.className = 'az-vital-fill'
    bar.appendChild(fill)
    vitals.appendChild(bar)
  }
  element.appendChild(vitals)
  // Leaflet takes the element as the icon's html, and sets its size and anchor.
  const icon = L.divIcon({ html: element, className: 'az-player-icon', iconSize: [BOX_PX, BOX_PX], iconAnchor: [BOX_PX / 2, BOX_PX / 2] })
  return { icon, element }
}

/** The game's own heart and chestplate, as the figures under a head wear them (the same shapes mask the sidebar's rows: maps.css). */
const HEART =
  "<svg viewBox='0 0 8 8' aria-hidden='true'><rect x='1' y='1' width='2' height='1'/><rect x='4' y='1' width='2' height='1'/><rect x='0' y='2' width='7' height='2'/><rect x='1' y='4' width='5' height='1'/><rect x='2' y='5' width='3' height='1'/><rect x='3' y='6' width='1' height='1'/></svg>"
const CHESTPLATE =
  "<svg viewBox='0 0 8 8' aria-hidden='true'><rect x='0' y='1' width='2' height='1'/><rect x='5' y='1' width='2' height='1'/><rect x='0' y='2' width='3' height='1'/><rect x='4' y='2' width='3' height='1'/><rect x='0' y='3' width='7' height='1'/><rect x='1' y='4' width='5' height='3'/></svg>"

/** The figures and the bars under a head, set to the reading: the two values, a share each, and whether the health is low. */
function setVitals(element: HTMLElement, player: LivePlayer): void {
  const share = (value: number | null, max: number) => (value === null ? 0 : Math.max(0, Math.min(1, value / max)))
  element.style.setProperty('--az-hp', String(share(player.health, MAX_HEALTH)))
  element.style.setProperty('--az-ar', String(share(player.armor, MAX_ARMOR)))
  element.toggleAttribute('data-low', player.health !== null && player.health <= LOW_HEALTH)
  const [health, armour] = element.querySelectorAll<HTMLElement>('.az-player-figure')
  if (health) health.textContent = player.health === null ? '–' : String(player.health)
  if (armour) armour.textContent = player.armor === null ? '–' : String(player.armor)
}

export function PlayersLayer({
  store,
  data,
  enabled,
  named,
  war = null,
  pick = null,
}: {
  store: Store<LiveState>
  data: MapData
  enabled: boolean
  /** Names beside every head, at every zoom (the viewer's setting). */
  named: boolean
  war?: WarHeads | null
  /** A player chosen elsewhere (the player list): their card opens as if their head were clicked. */
  pick?: Store<{ name: string } | null> | null
}) {
  const { map } = useLeaflet()
  const towns = useMemo(() => settlements(data.towns), [data.towns])
  const townsRef = useLatest(towns)
  const entries = useRef(new Map<string, Entry>())
  const [chosen, setChosen] = useState<string | null>(null)
  const chosenRef = useLatest(chosen)
  const warRef = useLatest(war)
  const cardRef = useRef<HTMLDivElement>(null)

  // The pane, once: above the overlay, below the chrome; its classes say when names show, and whether the heads are fighters.
  useEffect(() => {
    if (map.getPane(PANE)) return
    const pane = map.createPane(PANE)
    pane.style.zIndex = '620'
    const near = () => pane.classList.toggle('az-players-near', map.getZoom() >= NAMED_FROM)
    map.on('zoomend', near)
    near()
  }, [map])
  useEffect(() => {
    map.getPane(PANE)?.classList.toggle('az-players-named', named)
  }, [map, named])
  useEffect(() => {
    map.getPane(PANE)?.classList.toggle('az-players-war', Boolean(war))
  }, [map, war])
  // The war's own card is the sidebar: the small one stands aside while the view is on.
  const picked = war ? null : chosen

  /** Where the chosen player's card sits: beside the head, to the right, else the left, else below. */
  const placeCard = () => {
    const card = cardRef.current
    const entry = chosenRef.current ? entries.current.get(chosenRef.current) : null
    if (!card || !entry) return
    const p = map.latLngToContainerPoint(entry.marker.getLatLng())
    const size = map.getSize()
    const width = card.offsetWidth
    const margin = 8
    const gap = BOX_PX / 2 + 8
    if (p.x + gap + width <= size.x - margin) {
      card.dataset.side = 'right'
      card.style.transform = `translate(${p.x + gap}px, ${p.y}px) translateY(-50%)`
    } else if (p.x - gap - width >= margin) {
      card.dataset.side = 'left'
      card.style.transform = `translate(${p.x - gap - width}px, ${p.y}px) translateY(-50%)`
    } else {
      card.dataset.side = 'below'
      const x = Math.min(Math.max(p.x - width / 2, margin), size.x - width - margin)
      card.style.setProperty('--az-nib', `${p.x - x}px`)
      card.style.transform = `translate(${x}px, ${p.y + gap}px)`
    }
  }
  const placeCardRef = useLatest(placeCard)

  // The markers, following the store; the glide, in one frame loop that runs only while a head is moving.
  useEffect(() => {
    if (!enabled) return
    const held = entries.current
    let frame = 0
    const step = (now: number) => {
      frame = 0
      let moving = false
      for (const entry of held.values()) {
        if (entry.still) continue
        // At a steady pace from one reading to the next, over the feed's own beat, so a walk reads as a walk; the
        // next reading sets off from wherever the head has got to, so the pace holds whether the feed is early or late.
        const t = Math.min(1, (now - entry.since) / entry.over)
        const x = entry.from[0] + (entry.to[0] - entry.from[0]) * t
        const z = entry.from[1] + (entry.to[1] - entry.from[1]) * t
        entry.marker.setLatLng(toLatLng([x, z]))
        if (t >= 1) entry.still = true
        else moving = true
      }
      placeCardRef.current()
      if (moving) frame = requestAnimationFrame(step)
    }
    const animate = () => {
      if (!frame) frame = requestAnimationFrame(step)
    }
    /** Where a head is right now, mid-glide. */
    const current = (entry: Entry): Point => {
      const { lng, lat } = entry.marker.getLatLng()
      return [lng, lat]
    }
    /** The map brought to the player followed, over the feed's beat, the ground moving as they do; not while a flight is under way. */
    const follow = (to: Point, over: number, jump: boolean) => {
      if ((map as AnimatingMap)._animatingZoom) return
      const cover = warRef.current?.cover ?? 0
      const zoom = map.getZoom()
      const target = cover ? map.unproject(map.project(toLatLng(to), zoom).add([0, cover / 2]), zoom) : toLatLng(to)
      map.panTo(target, { animate: !jump, duration: over / 1000, easeLinearity: 1, noMoveStart: true })
    }

    const reconcile = () => {
      const { players, every } = store.get()
      const seen = new Set<string>()
      const now = performance.now()
      // A page out of sight gets no animation frames (the window behind the game, or minimised, while the feed
      // goes on: ../steady.ts), so each head stands at its reading at once; the glide is back once it's seen.
      const hidden = document.hidden
      const jump = reduced() || hidden
      const fight = warRef.current
      for (const player of players) {
        seen.add(player.name)
        const to = at(player)
        const entry = held.get(player.name)
        if (entry) {
          entry.player = player
          const from = current(entry)
          const far = Math.hypot(to[0] - from[0], to[1] - from[1]) > TELEPORT_BLOCKS
          entry.from = jump || far ? to : from
          entry.to = to
          entry.since = now
          entry.over = every
          entry.still = hidden
          if (jump || far) entry.marker.setLatLng(toLatLng(to))
          setVitals(entry.element, player)
          if (fight) entry.element.setAttribute('data-side', fight.sideOf(player.name) ?? '')
          if (fight?.follow && fight.watch === player.name) follow(to, every, jump || far)
          continue
        }
        const town = townOfPlayer(player.name, townsRef.current)
        const { icon, element } = iconFor(player, town)
        setVitals(element, player)
        if (fight) {
          element.setAttribute('data-side', fight.sideOf(player.name) ?? '')
          element.classList.toggle('az-player-watched', fight.watch === player.name)
        }
        const marker = new HeadMarker(toLatLng(to), {
          icon,
          pane: PANE,
          keyboard: false,
          // A head's click is its own: the map, and a tool wanting clicks, never see it.
          bubblingMouseEvents: false,
          riseOnHover: true,
          riseOffset: RISE,
        })
        marker.arrival = arrivals++ % STACK_SPREAD
        marker.on('click', (event: L.LeafletMouseEvent) => {
          L.DomEvent.stop(event.originalEvent)
          const fighting = warRef.current
          if (fighting) return fighting.onPick(player.name)
          setChosen((picked) => (picked === player.name ? null : player.name))
        })
        marker.addTo(map)
        // The arrival's fade is a one-off.
        window.setTimeout(() => element.classList.remove('az-player-new'), 600)
        held.set(player.name, { marker, element, player, from: to, to, since: now, over: every, still: true })
      }
      for (const [name, entry] of held) {
        if (seen.has(name)) continue
        entry.marker.remove()
        held.delete(name)
        if (chosenRef.current === name) setChosen(null)
      }
      animate()
    }
    reconcile()
    const unsubscribe = store.subscribe(reconcile)
    return () => {
      unsubscribe()
      cancelAnimationFrame(frame)
      for (const entry of held.values()) entry.marker.remove()
      held.clear()
      setChosen(null)
    }
  }, [enabled, store, map, townsRef, chosenRef, warRef, placeCardRef])

  // A player picked from the list: the card opens beside their head, as a click would open it; the war view takes its own.
  useEffect(() => {
    if (!pick) return
    return pick.subscribe(() => {
      const chosen = pick.get()
      if (chosen && !warRef.current) setChosen(chosen.name)
    })
  }, [pick, warRef])

  // The war view's sides and its watched player, on the heads already standing; and a drag ends the following.
  const sideOf = war?.sideOf
  const watch = war?.watch ?? null
  const following = Boolean(war?.follow)
  useEffect(() => {
    for (const [name, entry] of entries.current) {
      entry.element.setAttribute('data-side', sideOf ? (sideOf(name) ?? '') : '')
      entry.element.classList.toggle('az-player-watched', Boolean(sideOf) && name === watch)
    }
  }, [sideOf, watch])
  useEffect(() => {
    if (!following) return
    const broken = () => warRef.current?.onFollowBroken()
    map.on('dragstart', broken)
    return () => {
      map.off('dragstart', broken)
    }
  }, [map, following, warRef])

  // The chosen one's ring, and the card kept beside it as the map moves.
  useEffect(() => {
    for (const [name, entry] of entries.current) entry.element.classList.toggle('az-player-selected', name === picked)
    if (!picked) return
    const card = cardRef.current
    if (card) {
      L.DomEvent.disableClickPropagation(card)
      L.DomEvent.disableScrollPropagation(card)
    }
    const follow = () => placeCardRef.current()
    const hide = () => {
      if (card) card.style.visibility = 'hidden'
    }
    const show = () => {
      if (card) card.style.visibility = ''
      placeCardRef.current()
    }
    const close = () => setChosen(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    // A viewreset is the map re-based a world over (leaflet/home.ts): the head stands again, so the card follows it.
    map.on('move zoom viewreset', follow)
    map.on('zoomstart', hide)
    map.on('zoomend', show)
    map.on('click', close)
    window.addEventListener('keydown', onKey)
    placeCardRef.current()
    return () => {
      map.off('move zoom viewreset', follow)
      map.off('zoomstart', hide)
      map.off('zoomend', show)
      map.off('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [picked, map, placeCardRef])

  if (!enabled || !picked) return null
  return <PlayerCard data={data} name={picked} onClose={() => setChosen(null)} ref={cardRef} store={store} towns={towns} />
}

/**
 * The card beside a chosen head: who they are and, if Azanian, of which
 * town; where they are, to copy, as F3 shows it; and the way there as a
 * player has it — the nearest town's spawn and the walk — since nobody
 * has `/tp`. It follows the head, and its figures follow the feed.
 */
function PlayerCard({
  name,
  store,
  data,
  towns,
  onClose,
  ref,
}: {
  name: string
  store: Store<LiveState>
  data: MapData
  towns: MapTown[]
  onClose: () => void
  ref: React.RefObject<HTMLDivElement | null>
}) {
  const live = useStore(store)
  const [copied, copy] = useCopy()
  const [copiedWay, copyWay] = useCopy()
  const player = live.players.find((candidate) => candidate.name === name)
  if (!player) return null
  const town = townOfPlayer(name, towns)
  const route = spawnRoute(at(player), data.towns)
  // Whole blocks, as F3 shows them.
  const [x, y, z] = [player.x, player.y, player.z].map(Math.round)
  const place = `${x} ${y} ${z}`
  return (
    <div
      aria-label={`${name}, online`}
      className="az-chip az-player-card pointer-events-auto absolute left-0 top-0 z-[500] w-64 border border-sand-300 bg-sand-50 text-ink-900 shadow-[0_2px_8px_rgba(22,25,31,0.18)]"
      data-side="right"
      ref={ref}
      role="dialog"
    >
      <div className="flex items-start gap-2.5 px-3 pt-2.5">
        <span className="az-player-portrait mt-0.5 shrink-0" data-azanian={town ? '' : undefined}>
          <PlayerHead key={name} name={name} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight text-sea-950">{name}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-500">
            {town ? (
              <>
                <span className="font-semibold text-saffron-600">Azanian</span> · of {spoken(town.name)}
              </>
            ) : (
              'On the server, not of Azania'
            )}
          </p>
        </div>
        <button
          aria-label="Close"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-ink-500 hover:text-sea-900 focus-visible:outline-saffron-500"
          onClick={onClose}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="close" />
        </button>
      </div>
      <div className="mt-2 border-t border-sand-300/70 px-3 py-2 font-mono text-[12px] tracking-[0.06em] text-ink-500 tabular-nums">
        <p className="flex items-baseline gap-x-3">
          <span>
            <span className="opacity-70">X</span> {x} <span className="ml-1 opacity-70">Y</span> {y}{' '}
            <span className="ml-1 opacity-70">Z</span> {z}
          </span>
          <button
            aria-label={`Copy ${place}`}
            className="inline-flex items-center gap-1 text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
            onClick={() => copy(place)}
            title="Copy the coordinates"
            type="button"
          >
            <Icon className="h-3 w-3" name={copied ? 'check' : 'copy'} />
            <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </p>
        {route ? (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-body text-[13px] tracking-normal text-ink-700">
            <button
              aria-label={`Copy ${route.command}`}
              className="inline-flex items-center gap-1 font-mono text-[12px] tracking-[0.06em] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
              onClick={() => copyWay(route.command)}
              title="Copy the command"
              type="button"
            >
              <Icon className="h-3 w-3" name={copiedWay ? 'check' : 'copy'} />
              <span aria-live="polite">{copiedWay ? 'Copied' : route.command}</span>
            </button>
            {route.then ? <span className="text-ink-500">{route.then}</span> : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}
