import { spoken, type MapData, type MapPlace } from '@/maps/data'
import { PlaceIcon } from '@/maps/icons'
import { ringArea } from '@/maps/geo'
import { PLACE_CATEGORIES, PLACE_GROUPS } from '@/maps/registry'
import { siteFacts, siteTitle } from '@/maps/sites'
import type { Article } from '@/payload-types'

import { placeColour } from '../layers/PlacesLayer'
import { ComingClippings, type Coming } from './coming'
import { EventsList, PlaceActions, Survey } from './islands'
import { ArticleLinks, Facts, PanelHead, PanelSection, TownLink } from './shared'

/** A place's page: what it is, where, the events held there, and the papers' coverage, which is still to come while the shell shows the page before it arrives. */
export function PlacePanel({
  place,
  data,
  articles,
}: {
  place: MapPlace
  data: MapData
  articles: Coming<Article[]>
}) {
  const town = data.towns.find((candidate) => candidate.id === place.town) ?? null
  // A place at a held site: the site is named, its bot is no mayor.
  const site = town ? siteFacts(town) : null
  const category = PLACE_CATEGORIES[place.category]
  const events = data.events.filter((event) => event.place === place.id)
  const footprint = place.outline ? Math.round(ringArea(place.outline)) : null

  return (
    <article className="pb-6">
      <PanelHead
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-sand-50"
              style={{ background: placeColour(place) }}
            >
              <PlaceIcon category={place.category} className="h-3 w-3" />
            </span>
            {category.label}
            {town ? (
              <>
                <span aria-hidden="true">·</span>
                <TownLink className="normal-case tracking-normal" town={town} />
              </>
            ) : null}
          </span>
        }
        title={place.name}
      >
        {place.description ? (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-700">{place.description}</p>
        ) : null}
        <Survey className="mt-3" point={place.point} y={place.y} />
        {/* For those who may: the way in, right under the name. */}
        <PlaceActions className="mt-3" place={place} />
      </PanelHead>

      <div className="mt-4 px-4">
        <Facts
          items={[
            { label: 'Kind', value: `${category.label} · ${PLACE_GROUPS[category.group]}` },
            {
              label: site ? 'At' : 'Town',
              value: town ? (
                <>
                  <TownLink town={town} />
                  {site ? ` · ${siteTitle(site).toLowerCase()}` : ''}
                </>
              ) : (
                'Between towns'
              ),
            },
            ...(footprint
              ? [{ label: 'Footprint', value: `${footprint.toLocaleString('en-GB')} blocks²` }]
              : []),
            ...(town?.ruler && !site ? [{ label: 'Mayor', value: spoken(town.ruler) }] : []),
          ]}
        />
      </div>

      <PanelSection flush title="Events here">
        <EventsList emptyNote="Nothing held here yet." ids={events.map((event) => event.id)} />
      </PanelSection>

      <PanelSection title="In the papers">
        {articles === undefined ? (
          <ComingClippings />
        ) : (
          <div className="az-arrive">
            <ArticleLinks articles={articles} emptyNote="Nothing written about it yet." />
          </div>
        )}
      </PanelSection>
    </article>
  )
}
