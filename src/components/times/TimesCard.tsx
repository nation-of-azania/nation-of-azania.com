import Image from 'next/image'
import Link from 'next/link'

import type { Article } from '@/payload-types'

import { articleHref, formatDate, resolveImage } from '@/components/site/format'

/**
 * A Condor Times story card for the front-page grid: image, maroon kicker,
 * Archivo headline, dek and byline. The whole card is clickable via a
 * stretched title link.
 */
export function TimesCard({ article }: { article: Article }) {
  const image = resolveImage(article.featuredImage, 'card')
  const category =
    article.category && typeof article.category === 'object' ? article.category : null
  const author = article.author && typeof article.author === 'object' ? article.author : null
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
        <div className="aspect-[3/2] w-full bg-maroon-800/[0.06]" />
      )}
      <div className="mt-3.5 flex flex-1 flex-col">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-maroon-700">
          {category ? <span>{category.name}</span> : null}
          {category && date ? <span aria-hidden="true" className="text-news-300">·</span> : null}
          {date ? (
            <time dateTime={dateTime} className="font-medium text-news-500">
              {date}
            </time>
          ) : null}
        </p>
        <h3 className="mt-1.5 font-news text-xl font-bold leading-tight text-news-900">
          <Link
            href={articleHref(article)}
            className="transition-colors after:absolute after:inset-0 group-hover:text-maroon-800"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-news-700">
            {article.excerpt}
          </p>
        ) : null}
        {author ? (
          <p className="mt-auto pt-3.5 text-xs uppercase tracking-wider text-news-500">
            By {author.name}
          </p>
        ) : null}
      </div>
    </article>
  )
}
