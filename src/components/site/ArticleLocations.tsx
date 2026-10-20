import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { Icon } from '@/components/maps/ui/icons'
import { spoken } from '@/maps/data'
import { PlaceIcon } from '@/maps/icons'
import { eventHref, placeHref, townHref } from '@/maps/url'
import type { Article } from '@/payload-types'

/**
 * Where an article happened, as chips that open Azania Maps: the towns,
 * places and events named in its `locations`. Each paper sets the line in
 * its own hand — the Gazette's saffron eyebrow and sand chips, the Times'
 * cinnabar label, the registry's mono — but the chips are the same, so a
 * reader learns them once.
 */

type Tone = 'gazette' | 'times' | 'international'

const VOICES: Record<Tone, { label: string; chip: string; row: string }> = {
  gazette: {
    row: 'border-t border-sand-300 pt-5',
    label: 'font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)',
    chip: 'border border-sand-300 bg-sand-100/70 text-ink-700 hover:border-(--accent) hover:text-sea-900',
  },
  times: {
    row: 'border-t border-news-200 pt-5',
    label: 'font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--accent-ink)',
    chip: 'border border-news-200 bg-news-100 text-news-700 hover:border-(--accent) hover:text-news-900',
  },
  international: {
    row: '',
    label: 'font-mono text-[11px] uppercase tracking-[0.14em] text-graphite-500',
    chip: 'border border-paper-300 bg-paper-100 text-graphite-700 hover:border-verdigris-600 hover:text-graphite-900',
  },
}

type Chip = { key: string; href: string; label: string; icon: React.ReactNode }

/** The chips an article's locations make, in order; empty when none are populated. */
export function locationChips(article: Pick<Article, 'locations'>): Chip[] {
  const chips: Chip[] = []
  // Only populated relations (depth ≥ 1) can be named; a bare id is skipped.
  for (const location of article.locations ?? []) {
    if (location.relationTo === 'towns' && typeof location.value === 'object') {
      const town = location.value
      chips.push({
        key: `town-${town.id}`,
        href: townHref(town.slug),
        label: spoken(town.name),
        icon: <Icon className="h-3.5 w-3.5 text-sea-700" name="town" />,
      })
    } else if (location.relationTo === 'places' && typeof location.value === 'object') {
      const place = location.value
      chips.push({
        key: `place-${place.id}`,
        href: placeHref(place.id),
        label: place.name,
        icon: <PlaceIcon category={place.category} className="h-3.5 w-3.5 text-sea-700" />,
      })
    } else if (location.relationTo === 'events' && typeof location.value === 'object') {
      const event = location.value
      chips.push({
        key: `event-${event.id}`,
        href: eventHref(event.id),
        label: event.title,
        icon: <Icon className="h-3.5 w-3.5 text-coral-700" name="flag" />,
      })
    }
  }
  return chips
}

export function ArticleLocations({
  article,
  tone,
  className,
  bare = false,
}: {
  article: Pick<Article, 'locations'>
  tone: Tone
  className?: string
  /** Only the chips, for a registry card that sets its own label. */
  bare?: boolean
}) {
  const chips = locationChips(article)
  if (chips.length === 0) return null
  const voice = VOICES[tone]
  const list = (
    <ul className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-medium transition-colors focus-visible:outline-saffron-500',
              voice.chip,
            )}
            href={chip.href}
          >
            {chip.icon}
            {chip.label}
          </Link>
        </li>
      ))}
    </ul>
  )
  if (bare) return list
  return (
    <aside aria-label="On Azania Maps" className={cn(voice.row, className)}>
      <p className={cn('mb-2.5 flex items-center gap-2', voice.label)}>
        <Icon className="h-3.5 w-3.5" name="pin" />
        On Azania Maps
      </p>
      {list}
    </aside>
  )
}
