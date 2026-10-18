import Image from 'next/image'
import Link from 'next/link'

import type { Article } from '@/payload-types'

import {
  articleHref,
  formatDate,
  resolveByline,
  resolveImage,
  sectionOf,
  typeLabel,
} from '@/components/site/format'

import { TimesCredit } from './TimesByline'

/**
 * An Azanian Times story card for the front-page grid: image, cinnabar kicker,
 * Archivo headline, dek and byline. The whole card is clickable via a
 * stretched title link.
 */
export function TimesCard({ article }: { article: Article }) {
  const image = resolveImage(article.featuredImage, 'card')
  const kicker = sectionOf(article)?.name ?? typeLabel(article)
  const byline = resolveByline(article)
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)

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
      ) : (
        <div className="aspect-[3/2] w-full bg-cinnabar-800/[0.06]" />
      )}
      <div className="mt-3.5 flex flex-1 flex-col">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cinnabar-700">
          {kicker ? <span>{kicker}</span> : null}
          {kicker && date ? <span aria-hidden="true" className="text-news-300">·</span> : null}
          {date ? (
            <time dateTime={dateTime} className="font-medium text-news-500">
              {date}
            </time>
          ) : null}
        </p>
        <h3 className="mt-1.5 font-news text-xl font-bold leading-tight text-news-900">
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
        {byline ? <TimesCredit byline={byline} className="mt-auto pt-4" /> : null}
      </div>
    </article>
  )
}
