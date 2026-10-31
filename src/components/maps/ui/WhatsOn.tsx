'use client'

import { useState } from 'react'

import { cn } from '@/blocks/components/shared'
import { spoken, type MapData, type MapEvent } from '@/maps/data'
import {
  calendarLeaf,
  eventPhase,
  formatSpan,
  relativeDay,
  sortEvents,
  type EventPhase,
} from '@/maps/time'

import { EYEBROW } from './chrome'
import { Icon } from './icons'

/** The words on an event's leaf, by phase. */
const PHASE_WORDS: Record<EventPhase, string> = {
  now: 'Happening now',
  upcoming: 'Coming up',
  past: 'Past',
}

/**
 * An event as a line in a list: a calendar leaf with the day, the title,
 * where and when. Happening now, the leaf is in the seal's coral and
 * breathes (stilled under reduced motion).
 */
export function EventRow({
  event,
  data,
  now,
  onOpen,
  selected,
  compact = false,
}: {
  event: MapEvent
  data: MapData
  now: number
  onOpen: (event: MapEvent) => void
  selected?: boolean
  compact?: boolean
}) {
  const phase = eventPhase(event, now)
  const leaf = calendarLeaf(event.startsAt)
  const place =
    event.place != null ? data.places.find((candidate) => candidate.id === event.place) : null
  const town =
    event.town != null ? data.towns.find((candidate) => candidate.id === event.town) : null
  const where = place?.name ?? (town ? spoken(town.name) : null)
  const relative = relativeDay(event.startsAt, now)
  return (
    <button
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'group flex w-full items-stretch gap-3 text-left transition-colors hover:bg-sand-100 focus-visible:outline-saffron-500',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
        selected && 'bg-sea-100/60',
      )}
      onClick={() => onOpen(event)}
      type="button"
    >
      <span
        className={cn(
          'flex w-11 shrink-0 flex-col items-center justify-center border text-center leading-none',
          phase === 'now'
            ? 'az-breathe border-coral-600 bg-coral-600 text-sand-50'
            : phase === 'past'
              ? 'border-sand-300 bg-sand-100 text-ink-400'
              : 'border-sand-300 bg-sand-50 text-sea-900',
          compact ? 'py-1' : 'py-1.5',
        )}
      >
        <span className="font-label text-[9px] uppercase tracking-[0.14em] opacity-80">
          {leaf.month}
        </span>
        <span className={cn('font-display', compact ? 'text-base' : 'text-xl')}>{leaf.day}</span>
      </span>
      <span className="min-w-0 flex-1 self-center">
        <span
          className={cn(
            'block truncate font-semibold text-ink-900',
            compact ? 'text-[14px]' : 'text-[15px]',
          )}
        >
          {event.title}
        </span>
        <span className="block truncate text-[13px] text-ink-500">
          {phase === 'now' ? (
            <span className="font-semibold text-coral-700">{PHASE_WORDS.now}</span>
          ) : (
            <>
              {relative ? (
                <span className={phase === 'past' ? '' : 'text-sea-700'}>{relative} · </span>
              ) : null}
              {leaf.weekday} {formatSpan(event.startsAt, event.endsAt)}
            </>
          )}
          {where ? ` · ${where}` : ''}
        </span>
      </span>
    </button>
  )
}

/**
 * What's on in Azania: a strip along the foot of the map on a wide screen,
 * the coming events in order, the one happening now first. Folds to a line
 * when the reader wants the map.
 */
export function WhatsOnStrip({
  data,
  now,
  onOpen,
  selected,
  className,
}: {
  data: MapData
  now: number
  onOpen: (event: MapEvent) => void
  selected: number | null
  className?: string
}) {
  const [open, setOpen] = useState(true)
  const events = sortEvents(data.events, now).filter((event) => eventPhase(event, now) !== 'past')
  if (events.length === 0) return null
  const live = events.filter((event) => eventPhase(event, now) === 'now').length
  return (
    <section
      aria-label="What’s on"
      className={cn(
        'border border-sand-300/80 bg-sand-50/95 shadow-[0_8px_24px_rgba(22,25,31,0.12)]',
        className,
      )}
    >
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline-saffron-500"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Icon className="h-4 w-4 text-coral-700" name="flag" />
        <span className={EYEBROW}>What’s on</span>
        <span className="text-[13px] text-ink-500">
          {live ? `${live} happening now · ` : ''}
          {events.length} coming
        </span>
        <Icon
          className={cn('ml-auto h-4 w-4 text-ink-400 transition-transform', open && 'rotate-180')}
          name="chevron"
        />
      </button>
      {open ? (
        <ul className="no-scrollbar flex max-w-full gap-1 overflow-x-auto border-t border-sand-300/80 px-1 py-1">
          {events.slice(0, 8).map((event) => (
            <li className="w-64 shrink-0" key={event.id}>
              <EventRow
                compact
                data={data}
                event={event}
                now={now}
                onOpen={onOpen}
                selected={selected === event.id}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
