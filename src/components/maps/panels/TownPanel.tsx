import { BylineAvatar } from '@/components/site/BylineAvatar'
import { formatDate, minecraftHeadUrl } from '@/components/site/format'
import type { CensusPoint } from '@/lib/maps'
import { awayOf } from '@/maps/abroad'
import { spoken, townFit, type MapData, type MapTown } from '@/maps/data'
import type { Article } from '@/payload-types'

import { ComingClippings, ComingText, ComingWords, type Coming } from './coming'
import { GrowthChart, GrowthChartComing } from './GrowthChart'
import { AboutActions, AddHere, EventsList, Survey } from './islands'
import { AwayParts, partsWords } from './parts'
import { ArticleLinks, Facts, PanelHead, PanelSection, PlaceRow } from './shared'
import { TownSiege } from './sieges'

/** "Oct 10 2026", as Towny writes it, in the site's own date form; the raw text if it won't parse. */
function foundedOn(raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : (formatDate(date.toISOString()) ?? raw)
}

/**
 * A town's page: Towny's facts with the ruler's head, the mayor's own
 * lines, its outposts and any claims detached from it (src/maps/claims.ts,
 * each shown on the map on request), its growth from the census, its
 * places and events, and what the papers have written about it. Drawn by
 * the shell the moment the town is opened, before its page arrives, with
 * the record, the census and the papers still to come (./coming.tsx).
 */
export function TownPanel({
  town,
  data,
  record,
  census,
  articles,
}: {
  town: MapTown
  data: MapData
  record: Coming<{ about: string | null; residents: string[]; culture: string | null } | null>
  census: Coming<CensusPoint[]>
  articles: Coming<Article[]>
}) {
  const places = data.places
    .filter((place) => place.town === town.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const events = data.events.filter((event) => event.town === town.id)
  // The record's names; while it's on its way, the same list the map was given with the town.
  const residents = record === undefined ? town.names : (record?.residents ?? [])
  const shown = residents.slice(0, 6)
  const more = residents.length - shown.length
  const away = awayOf(town.parts)
  const main = townFit(town)

  return (
    <article className="pb-6">
      <PanelHead
        eyebrow={town.nation ? `Town · ${spoken(town.nation)}` : 'Town · without a nation'}
        title={spoken(town.name)}
      >
        <div className="mt-3 flex items-center gap-3">
          <BylineAvatar
            byline={{
              name: town.ruler ?? town.name,
              avatar: town.ruler
                ? { url: minecraftHeadUrl(town.ruler), alt: '', pixelated: true }
                : undefined,
            }}
            size={40}
            tone="gazette"
          />
          <div className="min-w-0">
            <p className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-500">Ruler</p>
            <p className="truncate text-sm font-semibold text-ink-900">
              {town.ruler ?? 'None recorded'}
            </p>
          </div>
        </div>
        {town.home ? (
          <Survey className="mt-3" fit={main} point={town.home} town={town} y={64} />
        ) : null}
      </PanelHead>

      <TownSiege townyId={town.townyId} />

      <div className="mt-4 px-4">
        <Facts
          items={[
            {
              label: town.residents === 1 ? 'Resident' : 'Residents',
              value: `${town.residents}${shown.length ? ` · ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}` : ''}`,
            },
            {
              label: 'Claimed chunks',
              value: `${town.chunks.toLocaleString('en-GB')}${partsWords(away)}`,
            },
            { label: 'Founded', value: foundedOn(town.founded) ?? 'Not recorded' },
            {
              label: 'Culture',
              value:
                record === undefined ? (
                  <ComingWords width="5.5rem" />
                ) : (
                  <span className="az-arrive">{record?.culture ?? 'Not recorded'}</span>
                ),
            },
          ]}
        />
      </div>

      <AwayParts away={away} />

      <PanelSection
        action={record === undefined ? null : <AboutActions about={record?.about ?? null} town={town} />}
        title="About"
      >
        {record === undefined ? (
          // A line in the note's type, as the note that nothing is written yet takes: what most towns have.
          <ComingText className="text-sm" last="88%" lines={1} />
        ) : record?.about ? (
          <p className="az-arrive whitespace-pre-line text-sm leading-relaxed text-ink-700">{record.about}</p>
        ) : (
          <p className="az-arrive text-sm italic text-ink-500">
            Nothing written yet. The town’s mayor can add a few lines here.
          </p>
        )}
      </PanelSection>

      <PanelSection title="Growth">
        {census === undefined ? (
          <div className="space-y-4">
            <GrowthChartComing label="Residents" />
            <GrowthChartComing label="Claimed chunks" />
          </div>
        ) : census.length === 0 ? (
          <p className="az-arrive text-sm italic text-ink-500">
            The census starts with the next reading of the map.
          </p>
        ) : (
          <div className="az-arrive space-y-4">
            <GrowthChart label="Residents" measure="residents" points={census} />
            <GrowthChart label="Claimed chunks" measure="chunks" points={census} />
            {census.length < 3 ? (
              <p className="text-xs text-ink-400">Recorded daily; the lines fill in day by day.</p>
            ) : null}
          </div>
        )}
      </PanelSection>

      <PanelSection
        action={<AddHere town={town} />}
        flush
        title={`Places${places.length ? ` · ${places.length}` : ''}`}
      >
        {places.length ? (
          <ul className="divide-y divide-sand-300/70">
            {places.map((place) => (
              <li key={place.id}>
                <PlaceRow place={place} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 text-sm italic text-ink-500">No places drawn yet.</p>
        )}
      </PanelSection>

      <PanelSection flush title="Events">
        <EventsList
          emptyNote="Nothing on in town just now."
          ids={events.map((event) => event.id)}
        />
      </PanelSection>

      <PanelSection title="In the papers">
        {articles === undefined ? (
          <ComingClippings />
        ) : (
          <div className="az-arrive">
            <ArticleLinks articles={articles} emptyNote="Nothing written about the town yet." />
          </div>
        )}
      </PanelSection>
    </article>
  )
}
