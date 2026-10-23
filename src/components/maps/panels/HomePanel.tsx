import Link from 'next/link'

import type { CensusPoint } from '@/lib/maps'
import { worldSlug } from '@/maps/abroad'
import { spoken, type MapData } from '@/maps/data'
import { STANCE_COLOURS } from '@/maps/palette'
import { holdingsOf, incomeWords, settlements, siteFacts, siteTitle } from '@/maps/sites'
import { nationHref, townHref } from '@/maps/url'

import { SiteBadge } from '../layers/SiteMark'
import { STANCE_ORDER, StanceSwatch, stanceLabel } from '../ui/Diplomacy'
import { Icon } from '../ui/icons'
import { StatTile } from './GrowthChart'
import { EventsList, LayerToggle } from './islands'
import { EYEBROW, PanelSection } from './shared'
import { YourViews } from './views'

/**
 * The map's own front: the nation at a glance (its totals, with the
 * census's trend beneath), what it holds, where it stands with the other
 * nations, what's on, and the towns.
 * Server-rendered, so a search engine and a reader without JavaScript get
 * the nation in words. The figures count players' towns alone: a held
 * quarry's bot isn't a resident, and its fixed claims aren't growth.
 */
export function HomePanel({ data, census }: { data: MapData; census: CensusPoint[] }) {
  const towns = settlements(data.towns).sort(
    (a, b) => b.residents - a.residents || a.name.localeCompare(b.name),
  )
  const residents = towns.reduce((sum, town) => sum + town.residents, 0)
  const chunks = towns.reduce((sum, town) => sum + town.chunks, 0)
  const { sites, total } = holdingsOf(data.towns)
  const since = census[0]?.date
  const relations = [...data.relations].sort(
    (a, b) => STANCE_ORDER.indexOf(a.stance) - STANCE_ORDER.indexOf(b.stance) || a.nation.localeCompare(b.nation),
  )

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
        <StatTile label="Towns" measure={null} points={census} value={towns.length} />
        <StatTile label="Residents" measure="residents" points={census} value={residents} />
        <StatTile label="Chunks" measure="chunks" points={census} value={chunks} />
      </div>
      <p className="mt-2 px-4 text-[11px] text-ink-400">
        {since
          ? `Recorded daily from the Rulercraft map since ${since}.`
          : 'Recorded daily from the Rulercraft map.'}
      </p>

      {/* A ledger, not a dashboard: what the nation holds and what each pays, with the day's total under a rule. */}
      {sites.length ? (
        <PanelSection flush title="Holdings">
          <p className="px-4 text-[13px] leading-relaxed text-ink-500">
            Sites the server runs and Azania holds, paying the nation for as long as it does.
          </p>
          <ul className="mt-2 divide-y divide-sand-300/70">
            {sites.map((site) => {
              const facts = siteFacts(site)!
              return (
                <li key={site.id}>
                  <Link
                    className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100"
                    href={townHref(site.slug)}
                  >
                    <SiteBadge className="h-5 w-5 shrink-0" facts={facts} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-sea-800">
                        {spoken(site.name)}
                      </span>
                      <span className="block truncate text-xs text-ink-500">{siteTitle(facts)}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] tracking-[0.04em] text-saffron-600 tabular-nums">
                      {incomeWords(facts.income) ?? 'pays nothing'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          {total > 0 ? (
            <p className="mx-4 mt-1 flex items-baseline justify-between gap-3 border-t border-sand-300 pt-2 text-sm">
              <span className="text-ink-500">
                Together, a day
              </span>
              <span className="font-mono text-[13px] font-semibold tracking-[0.04em] text-ink-900 tabular-nums">
                ${total.toLocaleString('en-GB')}
              </span>
            </p>
          ) : null}
        </PanelSection>
      ) : null}

      {/* Where Azania stands, friends first: the nations the admins have named, each opening its page. */}
      {relations.length ? (
        <PanelSection
          action={
            <LayerToggle
              className="text-[12px] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
              layer="diplomacy"
              off="Hide on the map"
              on="Show on the map"
            />
          }
          flush
          title="Diplomacy"
        >
          <ul className="divide-y divide-sand-300/70">
            {relations.map((relation) => (
              <li key={relation.nation}>
                <Link
                  className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100"
                  href={nationHref(worldSlug(relation.nation))}
                >
                  <StanceSwatch className="h-3.5 w-5" stance={relation.stance} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-sea-800">
                      {spoken(relation.nation)}
                    </span>
                    {relation.note ? (
                      <span className="block truncate text-xs text-ink-500">{relation.note}</span>
                    ) : null}
                  </span>
                  <span
                    className="shrink-0 font-label text-[10px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: STANCE_COLOURS[relation.stance].text }}
                  >
                    {stanceLabel(relation.stance)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-1 px-4 text-[11px] text-ink-400">Every other nation is neutral.</p>
        </PanelSection>
      ) : null}

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
