import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { BylineAvatar } from '@/components/site/BylineAvatar'
import { dress } from '@/components/styles'
import { getArticleStyle } from '@/lib/site'
import type { Article } from '@/payload-types'

import {
  articleHref,
  formatDate,
  kickerOf,
  resolveByline,
  resolveImage,
} from '@/components/site/format'

import { TimesCredit } from './TimesByline'

/**
 * An Azanian Times story card for the front-page grid: image, cinnabar kicker
 * ("Markets · News"), Archivo headline, dek and byline. An opinion piece is
 * unmistakably one: a solid "Opinion" tag, and in place of a picture the
 * writer's head under a great opening quotation mark, since a signed view is
 * a person speaking. A story in a style wears it here too — its colours in
 * the kicker, tag and ground, its faces, its mark in the tag — so it stands
 * out a little in the grid; with the style's box on, the card is the box: a
 * rounded, bordered panel in the box colours, the picture inset in it. The
 * whole card is clickable via a stretched title link.
 */
export async function TimesCard({ article }: { article: Article }) {
  const image = resolveImage(article.featuredImage, 'card')
  const { parts } = kickerOf(article)
  const byline = resolveByline(article)
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const opinion = article.type === 'opinion'
  const words = opinion ? parts.filter((part) => part !== 'Opinion') : parts
  const { attrs, Mark, boxed } = dress('times', await getArticleStyle(article))

  return (
    <article
      {...attrs}
      className={cn(
        'group relative flex flex-col',
        boxed &&
          'rounded-2xl border-2 border-(--box-edge) bg-(--box-ground) p-4 transition-colors hover:border-(--accent-tint) sm:p-5',
      )}
    >
      {image ? (
        <div className={cn('overflow-hidden bg-news-100', boxed && 'rounded-xl')}>
          <Image
            src={image.url}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
            className="aspect-[3/2] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : opinion && byline ? (
        <div
          className={cn(
            'relative flex aspect-[3/2] w-full flex-col items-center justify-center overflow-hidden bg-(--accent-wash) px-6 text-center',
            boxed && 'rounded-xl',
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 left-4 select-none font-display text-[160px] leading-none text-(--accent-tint)/60"
          >
            “
          </span>
          <BylineAvatar byline={byline} size={64} tone="times" className="relative" />
          <p className="relative mt-3 font-news text-sm font-bold uppercase tracking-[0.1em] text-(--accent-deep)">
            {byline.name}
          </p>
          {byline.title ? (
            <p className="relative mt-1 text-xs text-(--accent)/80">{byline.title}</p>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(
            'flex aspect-[3/2] w-full flex-col items-center justify-center gap-3 bg-(--accent)/6',
            boxed && 'rounded-xl',
          )}
        >
          <span aria-hidden="true" className="h-px w-16 bg-lagoon-500/50" />
          <span
            aria-hidden="true"
            className="font-news text-[11px] font-bold uppercase tracking-[0.28em] text-(--accent)/40"
          >
            The Azanian Times
          </span>
          <span aria-hidden="true" className="h-px w-16 bg-lagoon-500/50" />
        </div>
      )}
      <div className="mt-3.5 flex flex-1 flex-col">
        <p className="flex flex-wrap items-center gap-x-2 font-label text-[11px] font-semibold uppercase tracking-[0.14em] text-(--accent-ink)">
          {opinion ? (
            <span className="inline-flex items-center gap-1 bg-(--accent) px-1.5 py-0.5 text-[10px] text-news-50">
              {Mark ? <Mark className="h-2.5 w-2.5 shrink-0" /> : null}
              Opinion
            </span>
          ) : null}
          {words.map((word, index) => (
            <span key={word} className="flex items-center gap-x-2">
              {index > 0 ? (
                <span aria-hidden="true" className="text-news-300">
                  ·
                </span>
              ) : null}
              {word}
            </span>
          ))}
          {date ? (
            <>
              <span aria-hidden="true" className="text-news-300">
                ·
              </span>
              <time dateTime={dateTime} className="font-medium text-news-500">
                {date}
              </time>
            </>
          ) : null}
        </p>
        <h3
          className={cn(
            'mt-1.5 font-news text-xl font-bold leading-tight text-news-900',
            opinion && 'text-(--accent-deep)',
          )}
        >
          <Link
            href={articleHref(article)}
            className="transition-colors after:absolute after:inset-0 group-hover:text-(--accent)"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-news-700">
            {article.excerpt}
          </p>
        ) : null}
        {byline && !(opinion && !image) ? (
          <TimesCredit byline={byline} className="mt-auto pt-4" />
        ) : null}
      </div>
    </article>
  )
}
