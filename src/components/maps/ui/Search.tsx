'use client'

import { useId, useMemo, useRef, useState } from 'react'

import { cn } from '@/blocks/components/shared'
import type { Abroad } from '@/maps/abroad'
import type { ClaimPart } from '@/maps/claims'
import { spoken, type MapData } from '@/maps/data'
import type { Bounds } from '@/maps/geo'
import { PlaceIcon } from '@/maps/icons'
import { nationInk, NO_NATION } from '@/maps/palette'
import { PLACE_CATEGORIES, ROAD_KINDS } from '@/maps/registry'
import { incomeWords, siteFacts, siteTitle } from '@/maps/sites'
import { isServerKind, SERVER_SEARCH, serverLine } from '@/maps/trading'
import type { MapSelection } from '@/maps/url'
import { formatWhen } from '@/maps/time'

import { abroadSite } from '../layers/AbroadLayer'
import { placeColour } from '../layers/PlacesLayer'
import { SiteBadge } from '../layers/SiteMark'
import { TradingBadge } from '../layers/TradingMark'
import { Icon } from './icons'
import { Swatch } from './Swatch'

type Result = {
  selection: MapSelection
  title: string
  subtitle: string
  icon: React.ReactNode
  /** For an outpost, found by the name its town gave it: where to look, rather than at the town. */
  focus?: Bounds
}

/** A town's outposts that have names of their own ("Calais"), each with what to look at. */
const namedOutposts = (parts: ClaimPart[]) =>
  parts.flatMap((part) =>
    part.role === 'outpost' ? part.spawns.flatMap((spawn) => (spawn.name ? [{ name: spawn.name, bounds: part.bounds }] : [])) : [],
  )

const normalise = (text: string) =>
  text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ')

/**
 * Finds anything on the map by name: towns and the sites the nation holds
 * (by name or by kind, so "diamond" finds the quarry), places, roads and
 * events, and, once the world has arrived, the other nations and their
 * towns and sites, and the server's trading outposts and landmarks (by
 * name, or by kind: "trading" finds the outposts, and so does "spawn",
 * after the server's old spawn town), after Azania's own; and any town's
 * outposts by the names their towns gave them, which open the town and
 * look at the outpost; a dozen at a
 * time, soonest and nearest-sounding first. Arrow keys walk the list;
 * Enter opens; Escape clears. The list is a listbox the input owns, so a
 * screen reader hears what's offered.
 */
export function Search({
  data,
  world = null,
  onPick,
  className,
  autoFocus,
}: {
  data: MapData
  world?: Abroad | null
  /** Something found; `focus`, for an outpost found by its name, where to look rather than at its town. */
  onPick: (selection: MapSelection, focus?: Bounds) => void
  className?: string
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // A new query starts the list at the top.
  const [lastQuery, setLastQuery] = useState(query)
  if (query !== lastQuery) {
    setLastQuery(query)
    setActive(0)
  }

  const results = useMemo<Result[]>(() => {
    const townName = (id: number | null) => {
      const town = data.towns.find((candidate) => candidate.id === id)
      return town ? spoken(town.name) : 'Between towns'
    }
    const needle = normalise(query.trim())
    if (needle.length < 1) return []
    const hit = (text: string | null | undefined) =>
      text ? normalise(text).includes(needle) : false
    const rank = (text: string) => (normalise(text).startsWith(needle) ? 0 : 1)
    const found: (Result & { rank: number })[] = []
    for (const town of data.towns) {
      const site = siteFacts(town)
      if (hit(town.name) || (site && hit(siteTitle(site)))) {
        found.push({
          rank: rank(town.name),
          selection: { kind: 'town', slug: town.slug },
          title: spoken(town.name),
          subtitle: site
            ? [siteTitle(site), incomeWords(site.income)].filter(Boolean).join(' · ')
            : `Town · ${town.residents} resident${town.residents === 1 ? '' : 's'}`,
          icon: site ? (
            <SiteBadge className="h-5 w-5" facts={site} />
          ) : (
            <Icon className="h-4 w-4 text-sea-800" name="town" />
          ),
        })
      }
      for (const outpost of namedOutposts(town.parts)) {
        if (!hit(outpost.name)) continue
        found.push({
          rank: rank(outpost.name) + 1,
          selection: { kind: 'town', slug: town.slug },
          title: outpost.name,
          subtitle: `Outpost of ${spoken(town.name)}`,
          icon: <Icon className="h-4 w-4 text-sea-800" name="town" />,
          focus: outpost.bounds,
        })
      }
    }
    for (const place of data.places) {
      if (hit(place.name) || hit(PLACE_CATEGORIES[place.category].label)) {
        found.push({
          rank: rank(place.name) + 1,
          selection: { kind: 'place', id: place.id },
          title: place.name,
          subtitle: `${PLACE_CATEGORIES[place.category].label} · ${townName(place.town)}`,
          icon: (
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-sand-50"
              style={{ background: placeColour(place) }}
            >
              <PlaceIcon category={place.category} className="h-3 w-3" />
            </span>
          ),
        })
      }
    }
    for (const road of data.roads) {
      if (hit(road.name)) {
        found.push({
          rank: rank(road.name ?? '') + 2,
          selection: { kind: 'road', id: road.id },
          title: road.name ?? 'Unnamed road',
          subtitle: `${ROAD_KINDS[road.kind].label} · ${road.town ? townName(road.town) : 'National'}`,
          icon: <Icon className="h-4 w-4 text-saffron-600" name="road" />,
        })
      }
    }
    for (const event of data.events) {
      if (hit(event.title) || hit(event.host)) {
        found.push({
          rank: rank(event.title) + 1,
          selection: { kind: 'event', id: event.id },
          title: event.title,
          subtitle: `Event · ${formatWhen(event.startsAt)}`,
          icon: <Icon className="h-4 w-4 text-coral-700" name="flag" />,
        })
      }
    }
    // The rest of the world comes after Azania's own, nations before their towns.
    for (const nation of world?.nations ?? []) {
      if (!hit(nation.name)) continue
      found.push({
        rank: rank(nation.name) + 2,
        selection: { kind: 'nation', slug: nation.slug },
        title: spoken(nation.name),
        subtitle: `Nation · ${nation.towns} town${nation.towns === 1 ? '' : 's'} · ${nation.residents} resident${nation.residents === 1 ? '' : 's'}`,
        icon: <Swatch colour={nation.colour} />,
      })
    }
    for (const town of world?.towns ?? []) {
      if (isServerKind(town.kind)) {
        if (!hit(town.name) && !hit(SERVER_SEARCH[town.kind])) continue
        found.push({
          rank: rank(town.name) + 3,
          selection: { kind: 'abroad', slug: town.slug },
          title: spoken(town.name),
          subtitle: serverLine({ kind: town.kind, name: town.name, home: town.home }),
          icon: <TradingBadge className="h-5 w-5" kind={town.kind} />,
        })
        continue
      }
      const site = abroadSite(town)
      const nation = town.nation ? world?.nationByName.get(town.nation) : null
      for (const outpost of namedOutposts(town.parts)) {
        if (!hit(outpost.name)) continue
        found.push({
          rank: rank(outpost.name) + 3,
          selection: { kind: 'abroad', slug: town.slug },
          title: outpost.name,
          subtitle: `Outpost of ${spoken(town.name)}${town.nation ? ` · ${spoken(town.nation)}` : ''}`,
          icon: <Swatch colour={nation?.colour ?? null} round />,
          focus: outpost.bounds,
        })
      }
      if (!hit(town.name) && !(site && hit(siteTitle(site)))) continue
      const holder = town.nation ? spoken(town.nation) : site ? 'unheld' : 'no nation'
      found.push({
        rank: rank(town.name) + 3,
        selection: { kind: 'abroad', slug: town.slug },
        title: spoken(town.name),
        subtitle: site
          ? [siteTitle(site), holder, incomeWords(site.income)].filter(Boolean).join(' · ')
          : `${town.capital ? 'Capital' : 'Town'} · ${holder} · ${town.residents} resident${town.residents === 1 ? '' : 's'}`,
        icon: site ? (
          <SiteBadge className="h-5 w-5" facts={site} ring={nation ? nationInk(nation.colour).line : NO_NATION.line} />
        ) : (
          <Swatch colour={nation?.colour ?? null} round />
        ),
      })
    }
    return found.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title)).slice(0, 12)
  }, [query, data, world])

  const pick = (result: Result) => {
    onPick(result.selection, result.focus)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const showList = open && results.length > 0

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          name="search"
        />
        <input
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showList}
          aria-label="Search Azania Maps"
          autoComplete="off"
          autoFocus={autoFocus}
          className="h-10 w-full border border-sand-300 bg-sand-50 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-sea-700 focus:outline-none"
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((index) => Math.min(results.length - 1, index + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((index) => Math.max(0, index - 1))
            } else if (event.key === 'Enter' && results[active]) {
              event.preventDefault()
              pick(results[active])
            } else if (event.key === 'Escape') {
              setQuery('')
              setOpen(false)
            }
          }}
          placeholder="Search towns, nations, places, roads, events"
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />
      </div>
      <ul
        aria-label="Results"
        className={cn(
          'absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto border border-sand-300 bg-sand-50 shadow-[0_8px_24px_rgba(22,25,31,0.14)]',
          !showList && 'hidden',
        )}
        id={listId}
        role="listbox"
      >
        {results.map((result, index) => (
          <li
            aria-selected={index === active}
            className={cn(
              'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
              index === active ? 'bg-sea-100/70' : 'hover:bg-sand-100',
            )}
            id={`${listId}-${index}`}
            key={`${result.selection.kind}-${'id' in result.selection ? result.selection.id : result.selection.slug}`}
            onMouseDown={(event) => {
              event.preventDefault()
              pick(result)
            }}
            onMouseEnter={() => setActive(index)}
            role="option"
          >
            <span className="flex w-5 shrink-0 justify-center">{result.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink-900">{result.title}</span>
              <span className="block truncate text-xs text-ink-500">{result.subtitle}</span>
            </span>
          </li>
        ))}
      </ul>
      {open && query.trim().length > 0 && results.length === 0 ? (
        <p className="absolute left-0 right-0 top-full z-30 mt-1 border border-sand-300 bg-sand-50 px-3 py-2 text-xs text-ink-500 shadow-[0_8px_24px_rgba(22,25,31,0.14)]">
          Nothing on the map by that name.
        </p>
      ) : null}
    </div>
  )
}
