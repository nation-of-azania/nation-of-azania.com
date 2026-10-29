'use client'

import { useId, useMemo, useState } from 'react'

import { minecraftHeadUrl } from '@/components/site/format'
import { outlawCommand } from '@/maps/outlaw'

import { cn } from '../shared'

/**
 * Everyone on a sanction list, the list rendered down to players: the thing
 * a mayor enforces and a reader looks themselves up in. Each player with
 * their head, their classes, why they're on it and since when; a filter by
 * name once the list is long; and the outlaw commands for everyone, a line
 * each, to paste in game one at a time (Towny takes one name a command).
 * Set in the voice of whichever paper shows it, through the shell's
 * --design-* properties, with the sanction's seal colour for its marks.
 */

export type RollPlayer = {
  key: string
  name: string
  classes: string[]
  /** Why they're on it, in a line: "Leader and initiator of …", "Resident of Ravenswatch, Imperial Avalonia". */
  why: string
  /** "29 October 2026", and the moment, for the title. */
  since: string | null
  sinceAt: string | null
}

/** The filter shows from this many players. */
const FILTER_FROM = 10

function useCopy(): [copied: string | null, copy: (what: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (what: string, text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(what)
        window.setTimeout(() => setCopied(null), 1800)
      })
      .catch(() => {
        // No clipboard (an insecure context): the names are on the page to select.
      })
  }
  return [copied, copy]
}

const BUTTON =
  'inline-flex items-center gap-1.5 border border-(--design-ink)/20 px-2.5 py-1 font-label text-[11px] font-semibold uppercase tracking-[0.12em] text-(--design-ink) transition-colors hover:border-(--seal-ink) hover:text-(--seal-ink) disabled:opacity-40'

export function PlayerRoll({
  players,
  compact = false,
  className,
}: {
  players: RollPlayer[]
  /** In an article: tighter rows, no "since" column on small screens. */
  compact?: boolean
  className?: string
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [copied, copy] = useCopy()
  const wanted = query.trim().toLowerCase()
  const shown = useMemo(
    () => (wanted ? players.filter((player) => player.key.includes(wanted)) : players),
    [players, wanted],
  )
  const names = shown.map((player) => player.name)

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-(--design-muted)" aria-live="polite">
          {wanted
            ? `${shown.length} of ${players.length} player${players.length === 1 ? '' : 's'}`
            : `${players.length} player${players.length === 1 ? '' : 's'}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {players.length >= FILTER_FROM ? (
            <label className="relative">
              <span className="sr-only">Find a player</span>
              <input
                aria-controls={`${id}-roll`}
                className="w-44 border border-(--design-ink)/20 bg-transparent px-2.5 py-1 text-sm text-(--design-ink) placeholder:text-(--design-muted)/70 focus:border-(--seal-ink) focus:outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a player"
                type="search"
                value={query}
              />
            </label>
          ) : null}
          <button
            className={BUTTON}
            disabled={names.length === 0}
            onClick={() => copy('commands', names.map(outlawCommand).join('\n'))}
            title={`Copy ${outlawCommand('<name>')} for ${wanted ? 'everyone shown' : 'everyone'}, a line each`}
            type="button"
          >
            {copied === 'commands' ? `Copied ${names.length}` : 'Copy outlaw commands'}
          </button>
          <button
            className={BUTTON}
            disabled={names.length === 0}
            onClick={() => copy('names', names.join('\n'))}
            title="Copy every name, a line each"
            type="button"
          >
            {copied === 'names' ? `Copied ${names.length}` : 'Copy names'}
          </button>
        </div>
      </div>

      <ul
        className="mt-4 divide-y divide-(--design-ink)/10 border-y border-(--design-ink)/15"
        id={`${id}-roll`}
      >
        {shown.map((player) => (
          <li
            className={cn(
              'grid grid-cols-[28px_minmax(0,1fr)] items-start gap-x-3 gap-y-1',
              compact ? 'py-2' : 'py-2.5 sm:grid-cols-[28px_minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-center',
            )}
            key={player.key}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a 28px head from mc-heads.net, pixelated. */}
            <img
              alt=""
              className="mt-0.5 h-7 w-7 bg-(--design-ink)/10 [image-rendering:pixelated] sm:mt-0"
              height={28}
              loading="lazy"
              src={minecraftHeadUrl(player.name, 32)}
              width={28}
            />
            <div className="min-w-0">
              <p className="truncate font-mono text-[15px] font-medium text-(--design-ink)">{player.name}</p>
              {compact ? <p className="text-[13px] leading-snug text-(--design-muted)">{player.why}</p> : null}
            </div>
            {compact ? null : (
              <p className="col-start-2 text-[13px] leading-snug text-(--design-muted) sm:col-start-auto">{player.why}</p>
            )}
            <div
              className={cn(
                'col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1',
                compact ? '' : 'sm:col-start-auto sm:justify-end',
              )}
            >
              <ClassMarks classes={player.classes} />
              {player.since ? (
                <time
                  className="font-mono text-[11px] tabular-nums text-(--design-muted)"
                  dateTime={player.sinceAt ?? undefined}
                  title={player.sinceAt ? `On the list since ${new Date(player.sinceAt).toUTCString()}` : undefined}
                >
                  since {player.since}
                </time>
              ) : null}
            </div>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="py-6 text-center text-sm italic text-(--design-muted)">
            {players.length ? `Nobody on the list is called “${query.trim()}”.` : 'Nobody is on the list.'}
          </li>
        ) : null}
      </ul>
    </div>
  )
}

/** A sanction's classes, as the seal stamps them. */
export function ClassMarks({ classes, className }: { classes: string[]; className?: string }) {
  if (classes.length === 0) return null
  return (
    <ul aria-label="Classes" className={cn('flex flex-wrap gap-1', className)}>
      {classes.map((name) => (
        <li
          className="border border-(--seal-ink)/45 px-1.5 py-px font-label text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.12em] text-(--seal-ink)"
          key={name}
        >
          {name}
        </li>
      ))}
    </ul>
  )
}
