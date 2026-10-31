import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { articleHref, formatDate, kickerOf } from '@/components/site/format'
import { spoken, type MapPlace, type MapTown } from '@/maps/data'
import { PlaceIcon } from '@/maps/icons'
import { PLACE_CATEGORIES } from '@/maps/registry'
import { placeHref, townHref } from '@/maps/url'
import type { Article } from '@/payload-types'

import { placeColour } from '../layers/PlacesLayer'
import { Icon } from '../ui/icons'

/**
 * The furniture of the panels on /maps, in the Gazette's hand: an eyebrow
 * over a display title, facts as a definition list, sections under a
 * hairline, and the links back into the papers.
 */

export const EYEBROW =
  'font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron-600'

export function PanelHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: ReactNode
  title: string
  children?: ReactNode
}) {
  return (
    <header className="px-4 pt-4">
      <p className={EYEBROW}>{eyebrow}</p>
      <h1 className="mt-1 text-balance font-display text-2xl leading-tight text-sea-950">
        {title}
      </h1>
      {children}
    </header>
  )
}

export function PanelSection({
  title,
  action,
  children,
  flush = false,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section className="mt-5 border-t border-sand-300 pt-3">
      <div className={cn('flex items-baseline justify-between gap-3', flush ? 'px-4' : 'px-4')}>
        <h2 className="font-display text-lg text-sea-900">{title}</h2>
        {action}
      </div>
      <div className={cn('mt-1.5', !flush && 'px-4')}>{children}</div>
    </section>
  )
}

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item) => (
        <div className="min-w-0" key={item.label}>
          <dt className="font-label text-[11px] uppercase tracking-[0.18em] text-ink-500">
            {item.label}
          </dt>
          <dd className="mt-0.5 break-words text-[15px] text-ink-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A place as a row: its pin, name and category. */
export function PlaceRow({ place, town }: { place: MapPlace; town?: MapTown | null }) {
  return (
    <Link
      className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-sand-100"
      href={placeHref(place.id)}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sand-50"
        style={{ background: placeColour(place) }}
      >
        <PlaceIcon category={place.category} className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink-900 group-hover:text-sea-800">
          {place.name}
        </span>
        <span className="block truncate text-[13px] text-ink-500">
          {PLACE_CATEGORIES[place.category].label}
          {town ? ` · ${spoken(town.name)}` : ''}
        </span>
      </span>
    </Link>
  )
}

/** The articles about something, as the papers' own clippings: kicker, title, date. */
export function ArticleLinks({ articles, emptyNote }: { articles: Article[]; emptyNote: string }) {
  if (articles.length === 0) return <p className="text-[15px] italic text-ink-500">{emptyNote}</p>
  return (
    <ul className="divide-y divide-sand-300/70">
      {articles.map((article) => {
        const { parts } = kickerOf(article)
        const paper =
          article.context && typeof article.context === 'object'
            ? article.context.path?.split('/')[1]
            : null
        const date = formatDate(article.publishedAt ?? article.createdAt)
        return (
          <li key={article.id}>
            <Link className="group block py-2.5" href={articleHref(article)}>
              <span className="flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.18em] text-ink-500">
                <Icon className="h-3 w-3 text-saffron-600" name="article" />
                {paper === 'times'
                  ? 'The Azanian Times'
                  : paper === 'intl'
                    ? 'International'
                    : 'The Gazette'}
                {parts.length ? <span aria-hidden="true">·</span> : null}
                {parts.join(' · ')}
              </span>
              <span className="mt-0.5 block font-display text-base leading-snug text-sea-900 group-hover:text-sea-700">
                {article.title}
              </span>
              {date ? <span className="block text-[13px] text-ink-400">{date}</span> : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function TownLink({ town, className }: { town: MapTown; className?: string }) {
  return (
    <Link
      className={cn(
        'text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900',
        className,
      )}
      href={townHref(town.slug)}
    >
      {spoken(town.name)}
    </Link>
  )
}


/** "$27,036": a sum of the server's money, to the dollar, as the panels say a town's bank or a mayor's purse. */
export const money = (value: number): string => `$${Math.round(value).toLocaleString('en-GB')}`
