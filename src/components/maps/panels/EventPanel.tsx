import Link from 'next/link'

import { articleHref } from '@/components/site/format'
import type { MapData, MapEvent } from '@/maps/data'
import { placeHref } from '@/maps/url'
import type { Article } from '@/payload-types'

import { EventActions, LocalTime, RelativeDay, Survey } from './islands'
import { ArticleLinks, Facts, PanelHead, PanelSection, PlaceRow, TownLink } from './shared'

/** An event's page: when, in the reader's own time, where, who's holding it, and the article announcing it. */
export function EventPanel({
  event,
  data,
  article,
  articles,
}: {
  event: MapEvent
  data: MapData
  article: Article | null
  articles: Article[]
}) {
  const place =
    event.place != null
      ? (data.places.find((candidate) => candidate.id === event.place) ?? null)
      : null
  const town = data.towns.find((candidate) => candidate.id === event.town) ?? null
  const sameDay = event.endsAt ? event.endsAt.slice(0, 10) === event.startsAt.slice(0, 10) : true
  return (
    <article className="pb-6">
      <PanelHead
        eyebrow={
          <span className="inline-flex items-center gap-2">
            Event
            <RelativeDay
              className="normal-case tracking-normal text-sea-700"
              iso={event.startsAt}
            />
          </span>
        }
        title={event.title}
      >
        <p className="mt-3 text-base text-ink-900">
          <LocalTime className="font-semibold" iso={event.startsAt} withYear />
          {event.endsAt ? (
            <>
              <span className="text-ink-500"> to </span>
              <LocalTime className="font-semibold" iso={event.endsAt} withYear={!sameDay} />
            </>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">In your own time zone.</p>
        {event.description ? (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-700">
            {event.description}
          </p>
        ) : null}
        <Survey className="mt-3" point={event.point} />
      </PanelHead>

      <div className="mt-4 px-4">
        <Facts
          items={[
            {
              label: 'Where',
              value: place ? (
                <Link
                  className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
                  href={placeHref(place.id)}
                >
                  {place.name}
                </Link>
              ) : town ? (
                <TownLink town={town} />
              ) : (
                'A point on the map'
              ),
            },
            { label: 'Host', value: event.host ?? 'Not named' },
          ]}
        />
        {article ? (
          <p className="mt-4 border-l-2 border-saffron-400 pl-3 text-sm">
            <span className="font-label text-[10px] uppercase tracking-[0.18em] text-ink-500">
              Announced in
            </span>
            <Link
              className="mt-0.5 block font-display text-base leading-snug text-sea-900 hover:text-sea-700"
              href={articleHref(article)}
            >
              {article.title}
            </Link>
          </p>
        ) : null}
        <div className="mt-4">
          <EventActions event={event} />
        </div>
      </div>

      {place ? (
        <PanelSection flush title="The place">
          <PlaceRow place={place} town={town} />
        </PanelSection>
      ) : null}

      <PanelSection title="In the papers">
        <ArticleLinks articles={articles} emptyNote="Nothing written about it yet." />
      </PanelSection>
    </article>
  )
}
