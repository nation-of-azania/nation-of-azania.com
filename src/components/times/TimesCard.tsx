import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { BylineAvatar } from '@/components/site/BylineAvatar'
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
 * a person speaking. The whole card is clickable via a stretched title link.
 */
export function TimesCard({ article }: { article: Article }) {
  const image = resolveImage(article.featuredImage, 'card')
  const { parts } = kickerOf(article)
  const byline = resolveByline(article)
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const opinion = article.type === 'opinion'
  const words = opinion ? parts.filter((part) => part !== 'Opinion') : parts

  return (
    <article className="group relative flex flex-col">
      {image ? (
        <div className="overflow-hidden bg-news-100">
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
        <div className="relative flex aspect-[3/2] w-full flex-col items-center justify-center overflow-hidden bg-cinnabar-100 px-6 text-center">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-3 left-4 select-none font-display text-[160px] leading-none text-cinnabar-300/60"
          >
            “
          </span>
          <BylineAvatar byline={byline} size={64} tone="times" className="relative" />
          <p className="relative mt-3 font-news text-sm font-bold uppercase tracking-[0.1em] text-cinnabar-900">
            {byline.name}
          </p>
          {byline.title ? (
            <p className="relative mt-1 text-xs text-cinnabar-800/80">{byline.title}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-3 bg-cinnabar-800/[0.06]">
          <span aria-hidden="true" className="h-px w-16 bg-lagoon-500/50" />
          <span
            aria-hidden="true"
            className="font-news text-[11px] font-bold uppercase tracking-[0.28em] text-cinnabar-800/40"
          >
            The Azanian Times
          </span>
          <span aria-hidden="true" className="h-px w-16 bg-lagoon-500/50" />
        </div>
      )}
      <div className="mt-3.5 flex flex-1 flex-col">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cinnabar-700">
          {opinion ? (
            <span className="bg-cinnabar-800 px-1.5 py-0.5 text-[10px] text-news-50">Opinion</span>
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
            opinion && 'text-cinnabar-900',
          )}
        >
          <Link
            href={articleHref(article)}
            className="transition-colors after:absolute after:inset-0 group-hover:text-cinnabar-800"
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
