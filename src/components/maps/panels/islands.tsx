'use client'

import { cn } from '@/blocks/components/shared'
import type { MapEvent, MapPlace, MapRoad, MapTown } from '@/maps/data'
import type { Point } from '@/maps/geo'
import { formatWhen, relativeDay, sortEvents } from '@/maps/time'

import { useMaps } from '../context'
import { useHydrated } from '../hooks'
import { TextButton } from '../ui/chrome'
import { Icon } from '../ui/icons'
import { tpCommand, useCopy } from '../ui/Readouts'
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

/** The survey line: coordinates, a Copy for /tp, and a Look. */
export function Survey({
  point,
  y,
  className,
}: {
  point: Point
  y?: number | null
  className?: string
}) {
  const [copied, copy] = useCopy()
  const [x, z] = point.map(Math.round)
  return (
    <p
      className={cn(
        'flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums',
        className,
      )}
    >
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
      <button
        aria-label={`Copy ${tpCommand(point, y)}`}
        className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
        onClick={() => copy(tpCommand(point, y))}
        type="button"
      >
        {copied ? 'Copied' : 'Copy /tp'}
      </button>
      <Look
        className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
        target={{ centre: point, zoom: 1, minZoom: true }}
      >
        Centre here
      </Look>
    </p>
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
          edit({
            kind: 'place',
            id: null,
            draft: {
              name: '',
              category: 'landmark',
              description: '',
              y: '',
              point: null,
              outline: [],
            },
            placing: true,
            tracing: false,
          })
        }}
      >
        <Icon className="h-3.5 w-3.5" name="pin" /> Add a place
      </TextButton>
      <TextButton
        className="px-2.5 py-1.5"
        onClick={() => {
          start()
          edit({
            kind: 'road',
            id: null,
            draft: { name: '', kind: 'street', line: [] },
            drawing: true,
            vertex: null,
          })
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
            draft: {
              title: '',
              description: '',
              startsAt: '',
              endsAt: '',
              host: '',
              place: null,
              point: town.home,
              article: null,
            },
            picking: false,
          })
        }
      >
        <Icon className="h-3.5 w-3.5" name="flag" /> Add an event
      </TextButton>
    </div>
  )
}
