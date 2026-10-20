import Link from 'next/link'

import type { CensusPoint } from '@/lib/maps'
import { spoken, type MapData } from '@/maps/data'
import { townHref } from '@/maps/url'

import { Icon } from '../ui/icons'
import { StatTile } from './GrowthChart'
import { EventsList } from './islands'
import { EYEBROW, PanelSection } from './shared'
import { YourViews } from './views'

/**
 * The map's own front: the nation at a glance (its totals, with the
 * census's trend beneath), what's on, and the towns. Server-rendered, so
 * a search engine and a reader without JavaScript get the nation in words.
 */
export function HomePanel({ data, census }: { data: MapData; census: CensusPoint[] }) {
  const residents = data.towns.reduce((sum, town) => sum + town.residents, 0)
  const chunks = data.towns.reduce((sum, town) => sum + town.chunks, 0)
  const towns = [...data.towns].sort(
    (a, b) => b.residents - a.residents || a.name.localeCompare(b.name),
  )
  const since = census[0]?.date

  return (
    <div className="pb-6">
      <header className="px-4 pt-4">
        <p className={EYEBROW}>The Nation of Azania</p>
        <h1 className="mt-1 font-display text-2xl leading-tight text-sea-950">
          Azania at a glance
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Azania’s towns as Towny has them, with the places, roads and events the nation keeps
          itself. Click anything on the map, or search.
        </p>
      </header>
      <div className="mt-4 grid grid-cols-3 gap-2 px-4">
        <StatTile label="Towns" measure={null} points={census} value={data.towns.length} />
        <StatTile label="Residents" measure="residents" points={census} value={residents} />
        <StatTile label="Chunks" measure="chunks" points={census} value={chunks} />
      </div>
      <p className="mt-2 px-4 text-[11px] text-ink-400">
        {since
          ? `Recorded daily from the Rulercraft map since ${since}.`
          : 'Recorded daily from the Rulercraft map.'}
      </p>

      {/* For anyone who may draw views: theirs, so a view made for an article has a home here. */}
      <YourViews />

      <PanelSection flush title="What’s on">
        <EventsList
          emptyNote="Nothing announced yet. Mayors add events on the map."
          ids={data.events.map((event) => event.id)}
        />
      </PanelSection>

      <PanelSection flush title="Towns">
        <ul className="divide-y divide-sand-300/70">
          {towns.map((town) => (
            <li key={town.id}>
              <Link
                className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100"
                href={townHref(town.slug)}
              >
                <Icon className="h-4 w-4 shrink-0 text-sea-800" name="town" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-sea-800">
                    {spoken(town.name)}
                  </span>
                  <span className="block truncate text-xs text-ink-500">
                    {town.residents} resident{town.residents === 1 ? '' : 's'} ·{' '}
                    {town.chunks.toLocaleString('en-GB')} chunks
                    {town.ruler ? ` · ${town.ruler}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelSection>

      <p className="mt-6 px-4 text-xs leading-relaxed text-ink-400">
        Pictures from the Rulercraft map; towns from Towny. Places, roads and events are drawn by
        Azania’s mayors and cartographers.{' '}
        <Link
          className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
          href="/gov"
        >
          The Gazette
        </Link>{' '}
        ·{' '}
        <Link
          className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
          href="/times"
        >
          The Times
        </Link>
      </p>
    </div>
  )
}
