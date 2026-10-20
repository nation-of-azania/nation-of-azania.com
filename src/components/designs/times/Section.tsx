import Link from 'next/link'

import { RichText } from '@/components/RichText'
import { Breadcrumb } from '@/components/site/Breadcrumb'
import { Emblem } from '@/components/site/Emblem'
import { FeedLink } from '@/components/site/FeedLink'
import { dress } from '@/components/styles'
import { TimesCard } from '@/components/times/TimesCard'
import { contextHref, emblemOf, feedHref } from '@/lib/site'

import type { SectionProps } from '../types'

/**
 * A desk of the Times (Markets, Opinion…) at any depth: its name in the
 * desk's own colour over a rule of the same, its emblem — or its initial,
 * stamped — beside it, then its desks within and its stories, pinned first.
 * A desk in a style takes the style's colours and faces, and its mark in
 * place of the initial when it has no emblem; its stories' cards wear the
 * style's box, when it has one on.
 */
export function Section({ context, chain, style, subContexts, pages, pinned, latest }: SectionProps) {
  const { attrs, Mark } = dress('times', style)
  const ancestors = chain.slice(0, -1)
  const parent = ancestors[ancestors.length - 1]
  const level = ancestors.length > 1 && parent ? `Within ${parent.name}` : 'A desk of the Times'
  const stories = [...pinned, ...latest]
  const within = [
    ...subContexts.map((child) => ({ href: contextHref(child), label: child.name })),
    ...pages,
  ]

  return (
    <div {...attrs} className="mx-auto max-w-6xl px-6 py-10 md:py-12">
      <header className="border-b-[3px] border-(--accent-ink) pb-6">
        <Breadcrumb
          chain={ancestors}
          className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-news-500"
          linkClassName="transition-colors hover:text-(--accent-ink)"
          separatorClassName="text-news-300"
        />
        <div className="mt-4 flex items-center gap-5">
          <Emblem
            media={emblemOf(chain)}
            size={72}
            className="bg-(--accent-wash) p-1.5"
            fallback={
              Mark ? (
                <Mark className="h-10 w-10 text-(--accent-ink)" />
              ) : (
                <span
                  aria-hidden="true"
                  className="font-news text-4xl font-black uppercase leading-none text-(--accent-ink)"
                >
                  {context.name.charAt(0)}
                </span>
              )
            }
          />
          <div className="min-w-0">
            <p className="font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--accent-ink)">
              {level}
            </p>
            <h1 className="mt-1 text-balance font-news text-4xl font-black uppercase leading-none tracking-tight text-(--accent-ink) md:text-5xl">
              {context.name}
            </h1>
          </div>
        </div>
        {context.tagline ? <p className="mt-4 text-lg text-news-700">{context.tagline}</p> : null}
        {/* Follow the desk: in its own ink and face, so GirlieTea's reads in rose Fredoka. */}
        <p className="mt-4 font-label text-[11px] font-semibold uppercase tracking-[0.16em]">
          <FeedLink
            href={feedHref(context)}
            className="text-(--accent-ink) transition-colors hover:text-lagoon-600"
            title={`${context.name} as an RSS feed`}
          >
            Subscribe to {context.name}
          </FeedLink>
        </p>
      </header>

      {context.intro ? (
        <RichText data={context.intro} tone="times" className="mt-8 max-w-3xl" />
      ) : null}

      {within.length > 0 ? (
        <nav
          aria-label={`Within ${context.name}`}
          className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-label text-[12px] font-semibold uppercase tracking-[0.14em] text-(--accent)"
        >
          <span className="text-news-500">Within this desk</span>
          {within.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-lagoon-600">
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {stories.length > 0 ? (
        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((article) => (
            <TimesCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-news-500">No stories have been filed on this desk yet.</p>
      )}
    </div>
  )
}
