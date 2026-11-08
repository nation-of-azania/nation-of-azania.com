import { awayOf } from '@/maps/abroad'
import { spoken, townFit, type MapData, type MapTown } from '@/maps/data'
import { incomeWords, resourceWords, siteTerms, siteTitle, type SiteFacts } from '@/maps/sites'
import type { Article } from '@/payload-types'

import { SiteBadge } from '../layers/SiteMark'
import { Icon } from '../ui/icons'
import { ComingClippings, ComingText, type Coming } from './coming'
import { AboutActions, AddHere, EmptyNote, EventsList, Survey } from './islands'
import { AwayParts, partsWords } from './parts'
import { ArticleLinks, Facts, PanelHead, PanelSection, PlaceRow } from './shared'
import { TownSiege } from './sieges'

/**
 * A held site's page: what it is and what it pays the nation, the way
 * there, its terms said kindly, its outposts, places and events, and what
 * the papers have written about it. No ruler's head, residents or growth
 * chart: the ruler is the server's bot, nobody lives there, and the claims
 * never grow. A site is nobody's `/t spawn` either, so the way there is
 * the nearest town's spawn and the walk, as for any spot on the map.
 * Drawn by the shell the moment the site is opened, with its record and
 * the papers still to come (./coming.tsx).
 */
export function SitePanel({
  town,
  facts,
  data,
  record,
  articles,
}: {
  town: MapTown
  facts: SiteFacts
  data: MapData
  record: Coming<{ about: string | null } | null>
  articles: Coming<Article[]>
}) {
  const places = data.places
    .filter((place) => place.town === town.id)
    .sort((a, b) => a.name.localeCompare(b.name))
  const events = data.events.filter((event) => event.town === town.id)
  const away = awayOf(town.parts)
  const main = townFit(town)
  const title = siteTitle(facts)
  const pays = incomeWords(facts.income)
  const produces = facts.kind === 'quarry' ? resourceWords(facts.resource) : null
  // The head says what it pays; the terms needn't again.
  const terms = siteTerms(facts, { pays: false })
  // What the page has nothing of yet, once it's known: one quiet line at the foot.
  const missing = [
    ...(record !== undefined && !record?.about ? (['about'] as const) : []),
    ...(places.length ? [] : (['places'] as const)),
    ...(events.length ? [] : (['events'] as const)),
    ...(articles !== undefined && articles.length === 0 ? (['papers'] as const) : []),
  ]
  const empty = (what: (typeof missing)[number]) => missing.includes(what)

  return (
    <article className="pb-6">
      <PanelHead
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <SiteBadge className="h-5 w-5" facts={facts} />
            {title}
            <span aria-hidden="true">·</span>
            <span>held by Azania</span>
          </span>
        }
        title={spoken(town.name)}
      >
        {/* What it pays, as the figure that matters: the treasury's line. */}
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
          {pays ? (
            <>
              <span className="font-body text-2xl font-semibold leading-none text-saffron-600 tabular-nums">
                ${facts.income!.toLocaleString('en-GB')}
              </span>
              <span className="text-[15px] text-ink-500">a day to the nation that holds it</span>
            </>
          ) : (
            <span className="text-[15px] text-ink-500">What it pays isn’t recorded.</span>
          )}
        </p>
        {town.home ? (
          <Survey
            className="mt-3"
            fit={main}
            fitLabel="Fit to the site"
            hint="A site has no spawn of its own: that is the nearest town’s, and the walk from it."
            point={town.home}
            y={64}
          />
        ) : null}
      </PanelHead>

      <TownSiege townyId={town.townyId} />

      <div className="mt-4 px-4">
        <Facts
          items={[
            { label: 'What it is', value: title },
            ...(produces ? [{ label: 'Produces', value: produces.adjective }] : []),
            {
              label: 'Held by',
              // Towny's name for the nation, when it isn't Azania's own.
              value:
                town.nation && town.nation.toLowerCase() !== 'azania'
                  ? `Azania, as ${spoken(town.nation)} in Towny`
                  : 'Azania',
            },
            {
              label: 'Extent',
              value: `${town.chunks.toLocaleString('en-GB')} chunks${partsWords(away)}`,
            },
          ]}
        />
      </div>

      <PanelSection title="Terms">
        <div className="space-y-1.5 text-[15px] leading-relaxed text-ink-700">
          {terms.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {/* The map's own words, exactly, folded: the terms above say the same more kindly. */}
        {facts.note ? (
          <details className="group mt-2 text-[13px]">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900 focus-visible:outline-saffron-500 [&::-webkit-details-marker]:hidden">
              As the map puts it
              <Icon className="h-3 w-3 transition-transform group-open:rotate-180 motion-reduce:transition-none" name="chevron" />
            </summary>
            <p className="mt-1.5 italic leading-relaxed text-ink-500">“{facts.note}”</p>
          </details>
        ) : null}
      </PanelSection>

      <AwayParts away={away} from={town.home} of="site" town={town.name} />

      {/* Staff and cartographers may write a few lines: how it was taken, what's built there. */}
      {empty('about') ? null : (
        <PanelSection action={record === undefined ? null : <AboutActions about={record?.about ?? null} town={town} />} title="About">
          {record === undefined ? (
            // Two lines in the note's type, as most sites' few lines take.
            <ComingText className="text-[15px]" lines={2} />
          ) : (
            <p className="az-arrive whitespace-pre-line text-[15px] leading-relaxed text-ink-700">{record?.about}</p>
          )}
        </PanelSection>
      )}

      {places.length ? (
        <PanelSection action={<AddHere town={town} />} flush title={`Places · ${places.length}`}>
          <ul className="divide-y divide-sand-300/70">
            {places.map((place) => (
              <li key={place.id}>
                <PlaceRow place={place} />
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      {events.length ? (
        <PanelSection flush title="Events">
          <EventsList emptyNote="Nothing on at the site just now." ids={events.map((event) => event.id)} />
        </PanelSection>
      ) : null}

      {empty('papers') ? null : (
        <PanelSection title="In the papers">
          {articles === undefined ? (
            <ComingClippings />
          ) : (
            <div className="az-arrive">
              <ArticleLinks articles={articles} emptyNote="Nothing written about the site yet." />
            </div>
          )}
        </PanelSection>
      )}

      <EmptyNote about={record?.about ?? null} missing={missing} town={town} />
    </article>
  )
}
