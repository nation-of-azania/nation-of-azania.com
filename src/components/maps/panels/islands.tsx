'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/blocks/components/shared'
import {
  spoken,
  type MapEvent,
  type MapPlace,
  type MapRoad,
  type MapTown,
} from '@/maps/data'
import { routeFrom, spawnRoute, type SpawnRoute, type SpawnTown } from '@/maps/spawn'
import type { Bounds, Point } from '@/maps/geo'
import { formatWhen, relativeDay, sortEvents } from '@/maps/time'
import type { ExtraLayer } from '@/maps/url'

import { messageOf } from '../api'
import { useMaps } from '../context'
import { useHydrated } from '../hooks'
import { emptyEvent, emptyPlace, emptyRoad } from '../state'
import { Notice, TextButton } from '../ui/chrome'
import { Icon } from '../ui/icons'
import { privateSpawnNote, useCopy } from '../ui/Readouts'
import { EventRow } from '../ui/WhatsOn'
import { money } from './shared'

/**
 * The client islands in the server-rendered panels: whatever needs the
 * reader's clock or time zone, the shell's actions, or the clipboard.
 */

/** An instant in the reader's own time zone; the server writes it in UTC, the browser restates it. */
export function LocalTime({
  iso,
  withYear = false,
  className,
}: {
  iso: string
  withYear?: boolean
  className?: string
}) {
  const hydrated = useHydrated()
  const text = hydrated
    ? formatWhen(iso, { withYear })
    : `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
  return (
    <time className={className} dateTime={iso}>
      {text}
    </time>
  )
}

/** "In 5 days", judged by the reader's clock. */
export function RelativeDay({ iso, className }: { iso: string; className?: string }) {
  const { now } = useMaps()
  const words = relativeDay(iso, now)
  return words ? <span className={className}>{words}</span> : null
}

/** Events by id, as rows that open them; soonest first, past ones last. */
export function EventsList({ ids, emptyNote }: { ids: number[]; emptyNote: string }) {
  const { data, now, select, selection } = useMaps()
  const events = sortEvents(
    data.events.filter((event) => ids.includes(event.id)),
    now,
  )
  if (events.length === 0) return <p className="px-4 text-[15px] italic text-ink-500">{emptyNote}</p>
  return (
    <ul className="divide-y divide-sand-300/70">
      {events.map((event) => (
        <li key={event.id}>
          <EventRow
            data={data}
            event={event}
            now={now}
            onOpen={(chosen) => select({ kind: 'event', id: chosen.id })}
            selected={selection?.kind === 'event' && selection.id === event.id}
          />
        </li>
      ))}
    </ul>
  )
}

/** A link into the map, by selection, that keeps the shell's state. */
export function Open({
  selection,
  className,
  children,
}: {
  selection: Parameters<ReturnType<typeof useMaps>['select']>[0]
  className?: string
  children: React.ReactNode
}) {
  const { select } = useMaps()
  return (
    <button className={className} onClick={() => select(selection)} type="button">
      {children}
    </button>
  )
}

/**
 * Where a page abroad's town or nation is, said to the shell as the page
 * arrives: the world it's in comes after the page, and the map, opening on
 * the page, would otherwise not know where to look. Draws nothing.
 */
export function Arrival({ target }: { target: Parameters<ReturnType<typeof useMaps>['look']>[0] | null }) {
  const { arrive } = useMaps()
  useEffect(() => {
    if (target) arrive(target)
    // Once, as the page arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

/** One of the layers beyond the nation's own, turned on or off from a panel: "Show on the map", "Hide". */
export function LayerToggle({
  layer,
  on: onLabel,
  off: offLabel,
  className,
}: {
  layer: ExtraLayer
  on: string
  off: string
  className?: string
}) {
  const { extras, setExtra } = useMaps()
  const shown = extras[layer]
  return (
    <button aria-pressed={shown} className={className} onClick={() => setExtra(layer, !shown)} type="button">
      {shown ? offLabel : onLabel}
    </button>
  )
}

/** Centre the map on a point, or fit bounds. */
export function Look({
  target,
  className,
  children,
}: {
  target: Parameters<ReturnType<typeof useMaps>['look']>[0]
  className?: string
  children: React.ReactNode
}) {
  const { look } = useMaps()
  return (
    <button
      className={cn('inline-flex items-center gap-1.5', className)}
      onClick={() => look(target)}
      type="button"
    >
      {children}
    </button>
  )
}

/**
 * The survey line: coordinates (players see them with F3), a Look, and the
 * way there as a player can actually travel — `/t spawn <town>` for the
 * nearest town, with the walk from its home block, copied by a click. A
 * town's own line names its own spawn. A private spawn is said kindly: only
 * the town's residents can use it.
 */
export function Survey({
  point,
  y,
  town,
  route: given,
  fit,
  fitLabel = 'Fit to town',
  className,
}: {
  point: Point
  y?: number | null
  /** The town whose own spawn this is: no walk, just its command. */
  town?: SpawnTown
  /** The way there, worked out already: abroad, from any spawn on the server anyone may use. */
  route?: SpawnRoute | null
  /** Bounds to fit the map to, offered beside "Centre here": a town's main claim. */
  fit?: Bounds | null
  /** What fitting is called: "Fit to the site" for a quarry. */
  fitLabel?: string
  className?: string
}) {
  const { data } = useMaps()
  const [copied, copy] = useCopy()
  const [x, z] = point.map(Math.round)
  // A town's own panel offers its own spawn, with no walk.
  const route =
    given !== undefined ? given : town ? routeFrom(town, town.home ?? point) : spawnRoute(point, data.towns)
  const command = route?.command ?? null
  const closed = route?.town.publicSpawn === false
  return (
    <div className={cn('space-y-1', className)}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[12px] tracking-[0.06em] text-ink-500 tabular-nums">
        <span className="inline-flex gap-x-2">
          <span>
            <span className="opacity-70">X</span> {x}
          </span>
          {y != null ? (
            <span>
              <span aria-hidden="true" className="mr-2 opacity-50">
                /
              </span>
              <span className="opacity-70">Y</span> {Math.round(y)}
            </span>
          ) : null}
          <span>
            <span aria-hidden="true" className="mr-2 opacity-50">
              /
            </span>
            <span className="opacity-70">Z</span> {z}
          </span>
        </span>
        <Look
          className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
          target={{ centre: point, zoom: 1, minZoom: true }}
        >
          Centre here
        </Look>
        {fit ? (
          <Look
            className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
            target={{ bounds: fit }}
          >
            {fitLabel}
          </Look>
        ) : null}
      </p>
      {route && command ? (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-ink-700">
          <button
            aria-label={`Copy ${command}`}
            className="inline-flex items-center gap-1 font-mono text-[12px] tracking-[0.06em] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
            onClick={() => copy(command)}
            title="Copy the command"
            type="button"
          >
            <Icon className="h-3 w-3" name={copied ? 'check' : 'copy'} />
            <span aria-live="polite">{copied ? 'Copied' : command}</span>
          </button>
          {route.then ? <span className="text-ink-500">{route.then}</span> : null}
          {closed ? (
            <span className="basis-full text-[12px] italic leading-snug text-ink-500">
              {town
                ? `Its spawn is private: only ${spoken(town.name)}’s residents can use it.`
                : privateSpawnNote(route.town)}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

/**
 * What the signed-in person may do with something on the map, set right
 * under its name for those who may: edit it (the plain way in), and delete
 * it, asked first. A deletion that fails — refused, or never reaching the
 * Registry — is said here, not swallowed.
 */
function FeatureActions({
  edit,
  editLabel,
  onDelete,
  question,
  className,
}: {
  edit: () => void
  editLabel: string
  onDelete: () => Promise<void>
  question: string
  className?: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const remove = () => {
    if (!window.confirm(question)) return
    setBusy(true)
    setError(null)
    onDelete()
      .catch((caught: unknown) => setError(messageOf(caught)))
      .finally(() => setBusy(false))
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <TextButton className="px-3 py-1.5" onClick={edit} tone="primary">
          <Icon className="h-3.5 w-3.5" name="pencil" /> {editLabel}
        </TextButton>
        <TextButton className="px-2.5 py-1.5" disabled={busy} onClick={remove} tone="danger">
          <Icon className="h-3.5 w-3.5" name="trash" /> {busy ? 'Deleting…' : 'Delete'}
        </TextButton>
      </div>
      {error ? (
        <Notice className="mt-2" tone="warning">
          {error}
        </Notice>
      ) : null}
    </div>
  )
}

/** A place: edit it, move it, delete it. */
export function PlaceActions({ place, className }: { place: MapPlace; className?: string }) {
  const { mayEdit, editPlace, remove } = useMaps()
  if (!mayEdit(place.town)) return null
  return (
    <FeatureActions
      className={className}
      edit={() => editPlace(place)}
      editLabel="Edit or move"
      onDelete={() => remove('place', place.id)}
      question={`Delete ${place.name} from the map?`}
    />
  )
}

export function RoadActions({ road, className }: { road: MapRoad; className?: string }) {
  const { mayEdit, rights, editRoad, remove } = useMaps()
  // A road between towns is national: for those who draw anywhere.
  if (road.town == null ? !rights.anywhere : !mayEdit(road.town)) return null
  return (
    <FeatureActions
      className={className}
      edit={() => editRoad(road)}
      editLabel="Edit the course"
      onDelete={() => remove('road', road.id)}
      question={`Delete ${road.name ?? 'this road'} from the map?`}
    />
  )
}

export function EventActions({ event, className }: { event: MapEvent; className?: string }) {
  const { mayEdit, editEvent, remove } = useMaps()
  if (!mayEdit(event.town)) return null
  return (
    <FeatureActions
      className={className}
      edit={() => editEvent(event)}
      editLabel="Edit"
      onDelete={() => remove('event', event.id)}
      question={`Delete ${event.title}?`}
    />
  )
}

/** A mayor writes their town's few lines; staff too. */
export function AboutActions({ town, about }: { town: MapTown; about: string | null }) {
  const { mayEdit, editAbout } = useMaps()
  if (!mayEdit(town.id)) return null
  return (
    <TextButton className="px-2.5 py-1.5" onClick={() => editAbout(town, about ?? '')}>
      <Icon className="h-3.5 w-3.5" name="pencil" />{' '}
      {about ? 'Edit the description' : 'Write a description'}
    </TextButton>
  )
}

/** Add something here: offered in a town's panel to those who may draw in it. */
export function AddHere({ town }: { town: MapTown }) {
  const { mayEdit, edit, look } = useMaps()
  if (!mayEdit(town.id)) return null
  const start = () => {
    if (town.home) look({ centre: town.home, zoom: 0, minZoom: true })
  }
  return (
    <div className="flex flex-wrap gap-2">
      <TextButton
        className="px-2.5 py-1.5"
        onClick={() => {
          start()
          edit({
            kind: 'place',
            id: null,
            draft: emptyPlace(),
            placing: true,
            tracing: false,
            vertex: null,
          })
        }}
      >
        <Icon className="h-3.5 w-3.5" name="pin" /> Add a place
      </TextButton>
      <TextButton
        className="px-2.5 py-1.5"
        onClick={() => {
          start()
          edit({ kind: 'road', id: null, draft: emptyRoad(), drawing: true, vertex: null })
        }}
      >
        <Icon className="h-3.5 w-3.5" name="road" /> Draw a road
      </TextButton>
      <TextButton
        className="px-2.5 py-1.5"
        onClick={() =>
          edit({
            kind: 'event',
            id: null,
            draft: { ...emptyEvent(), point: town.home },
            picking: false,
          })
        }
      >
        <Icon className="h-3.5 w-3.5" name="flag" /> Add an event
      </TextButton>
    </div>
  )
}

/**
 * A town's bank, from the world's reading in the browser (src/maps/world.ts
 * → bank): Azania's own towns are in it too, by Towny id, and their pages
 * are the nation's own, so the figure is fetched here rather than kept.
 * Quiet until the world arrives, and where the map doesn't say.
 */
export function TownBank({ townyId }: { townyId: string | null }) {
  const { world, worldStatus } = useMaps()
  const town = townyId ? world?.byId.get(townyId) : null
  if (town?.bank == null)
    return <span className="text-ink-400">{world ? 'Not shown' : worldStatus === 'down' ? 'Not known just now' : '…'}</span>
  return <span className="tabular-nums">{money(town.bank)}</span>
}

/** The mayor's own purse, beside their name, as the Rulercraft map gives it; nothing where it doesn't. */
export function RulerPurse({ townyId }: { townyId: string | null }) {
  const { world } = useMaps()
  const town = townyId ? world?.byId.get(townyId) : null
  if (town?.rulerBalance == null) return null
  return (
    <p className="text-[13px] text-ink-500">
      Purse <span className="font-semibold tabular-nums text-ink-700">{money(town.rulerBalance)}</span>
    </p>
  )
}
