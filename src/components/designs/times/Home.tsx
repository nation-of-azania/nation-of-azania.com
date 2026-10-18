import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { OpinionPortrait } from '@/components/times/OpinionPortrait'
import { TimesByline } from '@/components/times/TimesByline'
import { TimesCard } from '@/components/times/TimesCard'
import {
  articleHref,
  formatDate,
  kickerOf,
  resolveByline,
  resolveImage,
} from '@/components/site/format'
import { dress } from '@/components/styles'
import { getArticleStyle } from '@/lib/site'

import type { HomeProps } from '../types'

/**
 * The Times' front page: a lead story (the pinned one, else the newest) over
 * a grid. The lead wears its style's colours like any card — and sits in
 * its box when the style has one on — but keeps the paper's own "Lead
 * Story" tag.
 */
export async function Home({ top, pinned, latest }: HomeProps) {
  const lead = pinned[0] ?? latest[0]
  const rest = [...pinned, ...latest].filter((story) => story.id !== lead?.id)

  if (!lead) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cinnabar-700">{top.name}</p>
        <h1 className="mt-4 font-news text-3xl font-black text-news-900">
          The presses are warm, but the front page is bare.
        </h1>
        <p className="mt-3 text-news-500">
          No stories have been filed yet. When the first is published, it prints here.
        </p>
      </div>
    )
  }

  const leadKicker = kickerOf(lead).parts.join(' · ')
  const leadByline = resolveByline(lead)
  const leadImage = resolveImage(lead.featuredImage, 'hero')
  // An opinion lead without a picture shows its writer instead, as its card would.
  const leadPortrait = !leadImage && lead.type === 'opinion' ? leadByline : null
  const leadDateTime = lead.publishedAt ?? lead.createdAt
  const leadDate = formatDate(leadDateTime)
  const leadHref = articleHref(lead)
  const { attrs, boxed } = dress('times', await getArticleStyle(lead))

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
      {/* Lead story */}
      <section
        {...attrs}
        className={cn(
          'grid gap-8 md:grid-cols-2 md:gap-10',
          boxed
            ? 'rounded-3xl border-2 border-(--box-edge) bg-(--box-ground) p-6 md:p-10'
            : 'border-b border-news-200 pb-12',
        )}
      >
        <div
          className={cn(
            'order-2 flex flex-col justify-center md:order-1',
            // Nothing to show beside it: the story takes the whole slot.
            !leadImage && !leadPortrait && 'max-w-3xl md:col-span-2',
          )}
        >
          <p className="flex flex-wrap items-center gap-x-2 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--accent-ink)">
            <span className="bg-(--accent) px-1.5 py-0.5 text-news-50">Lead Story</span>
            {leadKicker ? <span>{leadKicker}</span> : null}
            {leadDate ? (
              <>
                <span aria-hidden="true" className="text-news-300">·</span>
                <time dateTime={leadDateTime} className="font-medium text-news-500">
                  {leadDate}
                </time>
              </>
            ) : null}
          </p>
          <h1 className="mt-3 font-news text-4xl font-black leading-[1.02] text-news-900 md:text-5xl">
            <Link href={leadHref} className="transition-colors hover:text-(--accent)">
              {lead.title}
            </Link>
          </h1>
          {lead.excerpt ? (
            <p className="mt-4 text-lg leading-relaxed text-news-700">{lead.excerpt}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
            {leadByline ? <TimesByline byline={leadByline} /> : null}
            <Link
              href={leadHref}
              className="font-semibold text-(--accent-ink) transition-colors hover:text-(--accent)"
            >
              Read the full story →
            </Link>
          </div>
        </div>
        {leadImage ? (
          <div className={cn('order-1 overflow-hidden md:order-2', boxed && 'rounded-2xl')}>
            <Image
              src={leadImage.url}
              alt={leadImage.alt}
              width={leadImage.width}
              height={leadImage.height}
              sizes="(min-width: 768px) 560px, 92vw"
              priority
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        ) : leadPortrait ? (
          <OpinionPortrait
            byline={leadPortrait}
            boxed={boxed}
            className="order-1 hidden aspect-[4/3] md:order-2 md:flex"
          />
        ) : null}
      </section>

      {/* More from the Times */}
      {rest.length > 0 ? (
        <section className="mt-12">
          <p className="mb-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-news-500">
            More from the Times
          </p>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <TimesCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
