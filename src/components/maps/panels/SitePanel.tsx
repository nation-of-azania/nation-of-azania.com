import { awayOf } from '@/maps/abroad'
import { spoken, townFit, type MapData, type MapTown } from '@/maps/data'
import { incomeWords, resourceWords, siteTerms, siteTitle, type SiteFacts } from '@/maps/sites'
import type { Article } from '@/payload-types'

import { SiteBadge } from '../layers/SiteMark'
import { ComingClippings, ComingText, type Coming } from './coming'
import { AboutActions, AddHere, EventsList, Survey } from './islands'
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
  const terms = siteTerms(facts)

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
              <span className="text-sm text-ink-500">a day to the nation that holds it</span>
            </>
          ) : (
            <span className="text-sm text-ink-500">What it pays isn’t recorded.</span>
          )}
        </p>
        {town.home ? (
          <>
            <Survey className="mt-3" fit={main} fitLabel="Fit to the site" point={town.home} y={64} />
            <p className="mt-1 text-[11px] italic leading-snug text-ink-500">
              A site has no spawn of its own: that is the nearest town’s, and the walk from it.
            </p>
          </>
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
        <div className="space-y-1.5 text-sm leading-relaxed text-ink-700">
          {terms.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {facts.note ? (
          <p className="mt-3 text-xs italic leading-relaxed text-ink-500">
            As the map puts it: “{facts.note}”
          </p>
        ) : null}
      </PanelSection>

      <AwayParts away={away} from={town.home} of="site" town={town.name} />

      {/* Staff and cartographers may write a few lines: how it was taken, what's built there. */}
      <PanelSection
        action={record === undefined ? null : <AboutActions about={record?.about ?? null} town={town} />}
        title="About"
      >
        {record === undefined ? (
          // Two lines in the note's type, as the note that nothing is written yet takes: what most sites have.
          <ComingText className="text-sm" lines={2} />
        ) : record?.about ? (
          <p className="az-arrive whitespace-pre-line text-sm leading-relaxed text-ink-700">{record.about}</p>
        ) : (
          <p className="az-arrive text-sm italic text-ink-500">
            Nothing written yet. The nation’s cartographers can add a few lines here.
          </p>
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
          emptyNote="Nothing on at the site just now."
          ids={events.map((event) => event.id)}
        />
      </PanelSection>

      <PanelSection title="In the papers">
        {articles === undefined ? (
          <ComingClippings />
        ) : (
          <div className="az-arrive">
            <ArticleLinks articles={articles} emptyNote="Nothing written about the site yet." />
          </div>
        )}
      </PanelSection>
    </article>
  )
}
