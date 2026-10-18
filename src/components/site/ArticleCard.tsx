import Image from 'next/image'
import Link from 'next/link'

import type { Article } from '@/payload-types'

import { Crest } from './Crest'
import { GazetteCredit } from './GazetteByline'
import {
  articleHref,
  formatDate,
  resolveByline,
  resolveImage,
  sectionOf,
  typeLabel,
} from './format'

/**
 * The standard gazette card, shared by the homepage and the article index.
 * The whole card is clickable via a stretched title link; relations are
 * rendered only when populated.
 */
export function ArticleCard({ article }: { article: Article }) {
  const image = resolveImage(article.featuredImage, 'card')
  const kicker = sectionOf(article)?.name ?? typeLabel(article)
  const byline = resolveByline(article)
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const href = articleHref(article)

  return (
    <article className="group relative flex flex-col border border-sand-300 bg-sand-50 transition-colors hover:border-saffron-400">
      <div className="border-b border-sand-300 bg-sand-100">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
            className="aspect-[3/2] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/2] w-full items-center justify-center">
            <Crest className="h-16 w-auto text-sand-300" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-[0.2em] text-saffron-600">
          {kicker ? (
            <>
              <span className="text-sea-700">{kicker}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          {date ? <time dateTime={dateTime}>{date}</time> : null}
        </p>
        <h3 className="mt-2.5 font-display text-xl leading-snug text-ink-900">
          <Link
            href={href}
            className="transition-colors after:absolute after:inset-0 hover:text-sea-800 group-hover:text-sea-800"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-ink-500">
            {article.excerpt}
          </p>
        ) : null}
        {byline ? <GazetteCredit byline={byline} className="mt-auto pt-4" /> : null}
      </div>
    </article>
  )
}
