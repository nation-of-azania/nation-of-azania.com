'use client'

import { cn } from '@/blocks/components/shared'
import {
  spawnCommand,
  spawnRoute,
  spoken,
  type MapEvent,
  type MapPlace,
  type MapRoad,
  type MapTown,
} from '@/maps/data'
import type { Bounds, Point } from '@/maps/geo'
import { formatWhen, relativeDay, sortEvents } from '@/maps/time'

import { useMaps } from '../context'
import { useHydrated } from '../hooks'
import { emptyEvent, emptyPlace, emptyRoad } from '../state'
import { TextButton } from '../ui/chrome'
import { Icon } from '../ui/icons'
import { privateSpawnNote, useCopy } from '../ui/Readouts'
import { EventRow } from '../ui/WhatsOn'

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
  if (events.length === 0) return <p className="px-4 text-sm italic text-ink-500">{emptyNote}</p>
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
  fit,
  className,
}: {
  point: Point
  y?: number | null
  /** The town whose own spawn this is: no walk, just its command. */
  town?: MapTown
  /** Bounds to fit the map to, offered beside "Centre here": a town's main claim. */
  fit?: Bounds | null
  className?: string
}) {
  const { data } = useMaps()
  const [copied, copy] = useCopy()
  const [x, z] = point.map(Math.round)
  const route = town ? { town, walk: '' } : spawnRoute(data.towns, point)
  const command = route ? spawnCommand(route.town) : null
  const closed = route?.town.publicSpawn === false
  return (
    <div className={cn('space-y-1', className)}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums">
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
            Fit to town
          </Look>
        ) : null}
      </p>
      {route && command ? (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-ink-700">
          <button
            aria-label={`Copy ${command}`}
            className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.06em] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
            onClick={() => copy(command)}
            title="Copy the command"
            type="button"
          >
            <Icon className="h-3 w-3" name={copied ? 'check' : 'copy'} />
            <span aria-live="polite">{copied ? 'Copied' : command}</span>
          </button>
          {route.walk ? <span className="text-ink-500">{route.walk}</span> : null}
          {closed ? (
            <span className="basis-full text-[11px] italic leading-snug text-ink-500">
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

/** What the signed-in person may do with a place: edit it, move it, delete it. */
export function PlaceActions({ place }: { place: MapPlace }) {
  const { mayEdit, editPlace, remove } = useMaps()
  if (!mayEdit(place.town)) return null
  return (
    <div className="flex flex-wrap gap-2">
      <TextButton className="px-2.5 py-1.5" onClick={() => editPlace(place)}>
        <Icon className="h-3.5 w-3.5" name="pencil" /> Edit or move
      </TextButton>
      <TextButton
        className="px-2.5 py-1.5"
        onClick={() =>
          window.confirm(`Delete ${place.name} from the map?`) && remove('place', place.id)
        }
        tone="danger"
      >
        <Icon className="h-3.5 w-3.5" name="trash" /> Delete
      </TextButton>
    </div>
  )
}

export function RoadActions({ road }: { road: MapRoad }) {
  const { mayEdit, rights, editRoad, remove } = useMaps()
  // A road between towns is national: for those who draw anywhere.
  if (road.town == null ? !rights.anywhere : !mayEdit(road.town)) return null
  return (
    <div className="flex flex-wrap gap-2">
      <TextButton className="px-2.5 py-1.5" onClick={() => editRoad(road)}>
        <Icon className="h-3.5 w-3.5" name="pencil" /> Edit the course
      </TextButton>
      <TextButton
        className="px-2.5 py-1.5"
        onClick={() =>
          window.confirm(`Delete ${road.name ?? 'this road'} from the map?`) &&
          remove('road', road.id)
        }
        tone="danger"
      >
        <Icon className="h-3.5 w-3.5" name="trash" /> Delete
      </TextButton>
    </div>
  )
}

export function EventActions({ event }: { event: MapEvent }) {
  const { mayEdit, editEvent, remove } = useMaps()
  if (!mayEdit(event.town)) return null
  return (
    <div className="flex flex-wrap gap-2">
      <TextButton className="px-2.5 py-1.5" onClick={() => editEvent(event)}>
        <Icon className="h-3.5 w-3.5" name="pencil" /> Edit
      </TextButton>
      <TextButton
        className="px-2.5 py-1.5"
        onClick={() => window.confirm(`Delete ${event.title}?`) && remove('event', event.id)}
        tone="danger"
      >
        <Icon className="h-3.5 w-3.5" name="trash" /> Delete
      </TextButton>
    </div>
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
          edit({ kind: 'place', id: null, draft: emptyPlace(), placing: true, tracing: false })
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
