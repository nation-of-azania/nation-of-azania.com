import { BylineAvatar } from '@/components/site/BylineAvatar'
import { formatDate, minecraftHeadUrl } from '@/components/site/format'
import type { CensusPoint } from '@/lib/maps'
import { homeClaimBounds, outpostsOf, spoken, type MapData, type MapTown } from '@/maps/data'
import type { Article } from '@/payload-types'

import { GrowthChart } from './GrowthChart'
import { AboutActions, AddHere, EventsList, Look, Survey } from './islands'
import { ArticleLinks, Facts, PanelHead, PanelSection, PlaceRow } from './shared'

/** "Oct 10 2026", as Towny writes it, in the site's own date form; the raw text if it won't parse. */
function foundedOn(raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : (formatDate(date.toISOString()) ?? raw)
}

/**
 * A town's page: Towny's facts with the ruler's head, the mayor's own
 * lines, its outposts (claims away from the one holding the home block,
 * each shown on the map on request), its growth from the census, its
 * places and events, and what the papers have written about it.
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
  record: { about: string | null; residents: string[]; culture: string | null } | null
  census: CensusPoint[]
  articles: Article[]
}) {
  const places = data.places
    .filter((place) => place.town === town.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const events = data.events.filter((event) => event.town === town.id)
  const residents = record?.residents ?? []
  const shown = residents.slice(0, 6)
  const more = residents.length - shown.length
  const outposts = outpostsOf(town)
  const main = homeClaimBounds(town)

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

      <div className="mt-4 px-4">
        <Facts
          items={[
            {
              label: town.residents === 1 ? 'Resident' : 'Residents',
              value: `${town.residents}${shown.length ? ` · ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}` : ''}`,
            },
            {
              label: 'Claimed chunks',
              value: `${town.chunks.toLocaleString('en-GB')}${outposts.length ? ` · ${outposts.length} outpost${outposts.length === 1 ? '' : 's'}` : ''}`,
            },
            { label: 'Founded', value: foundedOn(town.founded) ?? 'Not recorded' },
            { label: 'Culture', value: record?.culture ?? 'Not recorded' },
          ]}
        />
      </div>

      {outposts.length ? (
        <PanelSection title={`Outposts · ${outposts.length}`}>
          <p className="text-[13px] leading-relaxed text-ink-500">
            Claims away from the town itself; the map fits the town to the claim that holds its
            home block.
          </p>
          <ul className="mt-2 divide-y divide-sand-300/70">
            {outposts.map((outpost, index) => (
              <li
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
                key={`${outpost.centre[0]},${outpost.centre[1]}`}
              >
                <span className="min-w-0">
                  <span className="font-semibold text-ink-900">Outpost {index + 1}</span>
                  <span className="block font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums">
                    {outpost.chunks.toLocaleString('en-GB')} chunk{outpost.chunks === 1 ? '' : 's'}{' '}
                    · X {Math.round(outpost.centre[0])} Z {Math.round(outpost.centre[1])}
                  </span>
                </span>
                <Look
                  className="shrink-0 text-[12px] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
                  target={{ bounds: outpost.bounds }}
                >
                  Show on map
                </Look>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      <PanelSection
        action={<AboutActions about={record?.about ?? null} town={town} />}
        title="About"
      >
        {record?.about ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{record.about}</p>
        ) : (
          <p className="text-sm italic text-ink-500">
            Nothing written yet. The town’s mayor can add a few lines here.
          </p>
        )}
      </PanelSection>

      <PanelSection title="Growth">
        {census.length === 0 ? (
          <p className="text-sm italic text-ink-500">
            The census starts with the next reading of the map.
          </p>
        ) : (
          <div className="space-y-4">
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
        <ArticleLinks articles={articles} emptyNote="Nothing written about the town yet." />
      </PanelSection>
    </article>
  )
}
