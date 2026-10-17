import Image from 'next/image'
import Link from 'next/link'

import type { Article } from '@/payload-types'

import { Crest } from './Crest'
import { articleHref, formatDate, resolveImage } from './format'

/**
 * The standard gazette card, shared by the homepage and the article index.
 * The whole card is clickable via a stretched title link; relations are
 * rendered only when populated.
 */
export function ArticleCard({ article }: { article: Article }) {
  const image = resolveImage(article.featuredImage, 'card')
  const category =
    article.category && typeof article.category === 'object' ? article.category : null
  const author = article.author && typeof article.author === 'object' ? article.author : null
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const href = articleHref(article)

  return (
    <article className="group relative flex flex-col border border-parchment-300 bg-parchment-50 transition-colors hover:border-gold-400">
      <div className="border-b border-parchment-300 bg-parchment-100">
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
            <Crest className="h-16 w-auto text-parchment-300" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] uppercase tracking-[0.2em] text-gold-600">
          {category ? (
            <>
              <span className="text-pine-700">{category.name}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          {date ? <time dateTime={dateTime}>{date}</time> : null}
        </p>
        <h3 className="mt-2.5 font-display text-xl leading-snug text-ink-900">
          <Link
            href={href}
            className="transition-colors after:absolute after:inset-0 hover:text-pine-800 group-hover:text-pine-800"
          >
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-ink-500">
            {article.excerpt}
          </p>
        ) : null}
        {author ? <p className="mt-auto pt-4 text-xs text-ink-400">By {author.name}</p> : null}
      </div>
    </article>
  )
}
