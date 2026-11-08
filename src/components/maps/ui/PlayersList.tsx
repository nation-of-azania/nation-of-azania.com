'use client'

import { useMemo, useState } from 'react'

import type { Allegiance, WarFocus } from '../warView'

import { cn } from '@/blocks/components/shared'
import { sameNation } from '@/maps/abroad'
import { townOfName } from '@/maps/battle'
import { spoken } from '@/maps/data'
import type { LivePlayer } from '@/maps/players'
import type { Siege, WorldTown } from '@/maps/world'

import { useStore, type Store } from '../hooks'
import type { LiveState } from '../live'
import { EYEBROW, FIELD, Popover } from './chrome'
import { Head } from './Head'
import { Icon } from './icons'
import { Vitals } from './Vitals'

/**
 * Everyone online, as the Rulercraft map lists them: a button among the
 * map's controls that opens a compact list, searched by typing, with the
 * total in its head. Azania's own come first, then each other nation by
 * how many of it are on, then those of no town the map knows; a click
 * flies the map to the player and picks them (in the war view, the
 * sidebar takes them; otherwise their card opens). In the war view every
 * row carries health and armour, the loudest thing on it, and a ring in
 * the player's side's colour: dashed for an ally of the side's nation,
 * whose row says whose ally they are ("ally of American Syndicate", the
 * side's nation: the group's head already says who they are themselves).
 * The head of the list says which siege the sides are of, so a ring is
 * never read against a siege nobody chose; with none, it says to choose one.
 */

/** A town as the sides and nations are read from it: the world's reading, or Azania's own before it comes. */
export type NamedTown = Pick<WorldTown, 'name' | 'nation' | 'people' | 'home'>

/** The war view, while it's on: each player's part in the siege the sides are taken from, for the ring and the ally's line, and that siege, named at the head of the list (null: no sides until one is chosen). */
export type WarList = { allegiance: (name: string) => Allegiance | null; siege: Siege | null }

const matches = (name: string, query: string) => name.replace(/^\./, '').toLowerCase().includes(query)

export function PlayersButton({
  store,
  towns,
  home,
  war,
  onPick,
}: {
  store: Store<LiveState>
  towns: NamedTown[]
  /** Azania's Towny nation, whose people lead the list. */
  home: string | null
  war: WarList | null
  onPick: (player: LivePlayer) => void
}) {
  return (
    <Popover icon="players" label="Who’s online" width="w-[22rem] max-w-[calc(100vw-1.5rem)]">
      {(close) => (
        <PlayersList
          home={home}
          onPick={(player) => {
            close()
            onPick(player)
          }}
          store={store}
          towns={towns}
          war={war}
        />
      )}
    </Popover>
  )
}

/**
 * The list docked at the map's right edge in the war view: a slim tab
 * ("Players · 17") folded against the edge, which opens to the list
 * beside the map's controls and folds again by its own ×, so the list is
 * a glance away without ever lying over the map unasked. Whether it's
 * open is the shell's to keep (`open`, `onOpen`), which seats the zoom
 * buttons beside the open list rather than beneath it. A phone keeps
 * the button and its popover, the sheet already taking the foot.
 */
export function PlayersDock({
  store,
  towns,
  home,
  war,
  open,
  onOpen,
  onPick,
  className,
}: {
  store: Store<LiveState>
  towns: NamedTown[]
  home: string | null
  war: (WarList & { watch: WarFocus | null }) | null
  open: boolean
  onOpen: (open: boolean) => void
  onPick: (player: LivePlayer) => void
  className?: string
}) {
  const live = useStore(store)
  const count = live.status === 'live' ? (live.online ?? live.players.length) : null
  if (!open)
    return (
      <button
        aria-expanded={false}
        aria-label="Who’s online"
        className={cn('az-dock-tab', className)}
        onClick={() => onOpen(true)}
        type="button"
      >
        <Icon className="h-4 w-4" name="players" />
        <span>{count === null ? 'Players' : `${count} online`}</span>
      </button>
    )
  return (
    <section aria-label="Who’s online" className={cn('az-dock', className)}>
      <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
        <span className={cn(EYEBROW, 'text-ink-500')}>Who’s online</span>
        <button
          aria-label="Fold the list away"
          className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-ink-500 hover:text-ink-900 focus-visible:outline-saffron-500"
          onClick={() => onOpen(false)}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="close" />
        </button>
      </div>
      <PlayersList home={home} onPick={onPick} store={store} towns={towns} war={war} />
    </section>
  )
}

export function PlayersList({
  store,
  towns,
  home,
  war,
  onPick,
}: {
  store: Store<LiveState>
  towns: NamedTown[]
  home: string | null
  war: WarList | null
  onPick: (player: LivePlayer) => void
}) {
  const live = useStore(store)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  // By nation: Azania first, then the rest by how many are on, then those of no town the map knows.
  const groups = useMemo(() => {
    const byNation = new Map<string, LivePlayer[]>()
    for (const player of live.players) {
      const town = townOfName(player.name, towns)
      const key = town?.nation ?? (town ? `town:${town.name}` : '')
      byNation.set(key, [...(byNation.get(key) ?? []), player])
    }
    const label = (key: string) =>
      key === '' ? 'Of no town the map knows' : key.startsWith('town:') ? `${spoken(key.slice(5))}, of no nation` : spoken(key)
    return [...byNation.entries()]
      .map(([key, players]) => ({ key, label: label(key), ours: sameNation(key, home), players }))
      .sort((a, b) => Number(b.ours) - Number(a.ours) || Number(a.key === '') - Number(b.key === '') || b.players.length - a.players.length || a.label.localeCompare(b.label))
  }, [live.players, towns, home])
  const ours = groups.find((group) => group.ours)?.players.length ?? 0
  const shown = groups
    .map((group) => ({ ...group, players: q ? group.players.filter((player) => matches(player.name, q)) : group.players }))
    .filter((group) => group.players.length)

  return (
    <div className="flex max-h-[min(70vh,40rem)] flex-col">
      <div className="px-1 pb-2 pt-1">
        <p className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold text-ink-900">
            {live.status === 'live'
              ? `${live.online ?? live.players.length} online`
              : live.status === 'down'
                ? 'The map isn’t answering'
                : live.status === 'asking'
                  ? 'Asking who’s on…'
                  : 'The players layer is off'}
          </span>
          {ours ? <span className="text-[13px] font-semibold text-saffron-600">{ours} of Azania</span> : null}
        </p>
        {war && live.players.length ? (
          <p className="mt-0.5 text-[12px] leading-snug text-ink-500">
            {war.siege
              ? `Sides in the ${war.siege.battle ? 'battle at' : 'siege of'} ${spoken(war.siege.town ?? war.siege.defender)}`
              : 'Choose a siege to see its sides'}
          </p>
        ) : null}
        {live.players.length > 6 ? (
          <label className="relative mt-2 block">
            <span className="sr-only">Find a player</span>
            <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" name="search" />
            <input
              autoFocus
              className={cn(FIELD, 'py-1.5 pl-9 text-[15px]')}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a player"
              type="search"
              value={query}
            />
          </label>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? (
          <p className="px-1 pb-2 text-[14px] text-ink-500">{q ? 'Nobody by that name is on.' : 'Nobody is on the map just now.'}</p>
        ) : null}
        {shown.map((group) => (
          <section key={group.key}>
            <p className={cn(EYEBROW, 'mt-1 px-1', group.ours ? 'text-saffron-600' : 'text-ink-500')}>
              {group.label} · {group.players.length}
            </p>
            <ul className="mb-1 divide-y divide-sand-300/60">
              {group.players.map((player) => {
                const part = war?.allegiance(player.name) ?? null
                return (
                  <li key={player.name}>
                    <button
                      className="flex w-full items-center gap-2.5 px-1 py-1.5 text-left hover:bg-sand-100 focus-visible:outline-saffron-500"
                      onClick={() => onPick(player)}
                      type="button"
                    >
                      <span className={cn('az-war-head shrink-0', part ? `az-war-head-${part.side}` : null, part?.allyOf ? 'az-war-head-ally' : null)}>
                        <Head name={player.name} px={26} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[14px] font-semibold tracking-[0.02em] text-ink-900">{player.name}</span>
                        {part?.allyOf ? (
                          <span className={cn('block truncate text-[12px] font-semibold', part.side === 'attackers' ? 'text-(--az-atk)' : 'text-(--az-def)')}>
                            ally of {spoken(part.allyOf)}
                          </span>
                        ) : null}
                      </span>
                      {war ? <Vitals armor={player.armor} className="shrink-0" health={player.health} size="list" /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
