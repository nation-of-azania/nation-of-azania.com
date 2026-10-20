'use client'

import { useState } from 'react'

import { cn } from '@/blocks/components/shared'
import { spawnCommand, spawnRoute, spoken, type MapTown, type SpawnRoute } from '@/maps/data'
import type { Point } from '@/maps/geo'
import { formatDate } from '@/components/site/format'

import { Icon } from './icons'

/** Copies text and says so for a moment; quiet when the clipboard is out of reach. */
export function useCopy(): [copied: boolean, copy: (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {
        // No clipboard (an insecure context): the command is on the page to select.
      })
  }
  return [copied, copy]
}

/** Said of a spawn only its residents may use. */
export const privateSpawnNote = (town: Pick<MapTown, 'name'>): string =>
  `${spoken(town.name)}’s spawn is private: only its residents can use it.`

/**
 * The block under the pointer (or the middle of the view, on a phone), in
 * the survey hand of the Map block, with a Copy that puts the nearest town's
 * `/t spawn` in the clipboard — the command players actually have — and the
 * walk from there. A live region that stays quiet: coordinates change too
 * often to be read aloud, so only the Copy speaks.
 */
export function Coordinates({
  point,
  hint,
  towns,
  className,
}: {
  point: Point | null
  hint: string
  towns: MapTown[]
  className?: string
}) {
  const [copied, copy] = useCopy()
  if (!point) return null
  const [x, z] = point.map(Math.round)
  const route: SpawnRoute | null = spawnRoute(towns, point)
  return (
    <div
      className={cn(
        'flex items-center gap-x-3 whitespace-nowrap border border-sand-300/80 bg-sand-50/95 px-2.5 py-1.5 font-mono text-[11px] tracking-[0.06em] text-ink-700 tabular-nums',
        className,
      )}
    >
      <span className="hidden text-ink-400 sm:inline">{hint}</span>
      <span>
        <span className="opacity-60">X</span> {x} <span className="ml-1 opacity-60">Z</span> {z}
      </span>
      {route ? (
        <>
          <button
            aria-label={`Copy ${spawnCommand(route.town)}`}
            className="inline-flex items-center gap-1 text-sea-700 hover:text-sea-900 focus-visible:outline-saffron-500"
            onClick={() => copy(spawnCommand(route.town))}
            title={[
              'Copy the command',
              route.walk ? `, ${route.walk}` : '',
              route.town.publicSpawn === false ? `. ${privateSpawnNote(route.town)}` : '',
            ].join('')}
            type="button"
          >
            <Icon className="h-3 w-3 shrink-0" name={copied ? 'check' : 'copy'} />
            <span aria-live="polite">{copied ? 'Copied' : spawnCommand(route.town)}</span>
          </button>
          {route.walk ? <span className="hidden text-ink-400 xl:inline">{route.walk}</span> : null}
          {route.town.publicSpawn === false ? (
            <span className="hidden text-saffron-600 lg:inline" title={privateSpawnNote(route.town)}>
              residents only
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export type MapStatus = { online: boolean; checkedAt: string; townsReadAt: string | null }

/** Said when the Rulercraft map isn't answering: the pictures are the last saved. */
export function StatusNote({
  status,
  className,
}: {
  status: MapStatus | null
  className?: string
}) {
  if (!status || status.online) return null
  const read = formatDate(status.townsReadAt)
  return (
    <p
      className={cn(
        'flex items-center gap-2 border border-saffron-400/60 bg-saffron-100/95 px-2.5 py-1.5 text-[12px] leading-snug text-saffron-600',
        className,
      )}
      role="status"
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-500" />
      <span>
        The Rulercraft map isn’t answering, so this is the map as last saved
        {read ? `, towns as read on ${read}` : ''}. Azania’s own places and events are current.
      </span>
    </p>
  )
}
