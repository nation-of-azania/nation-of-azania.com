import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { dress } from '@/components/styles'
import { getArticleStyle } from '@/lib/site'
import type { Article } from '@/payload-types'

import { Crest } from './Crest'
import { GazetteCredit } from './GazetteByline'
import { Seal } from './Seal'
import {
  articleHref,
  formatDate,
  isStateDocument,
  kickerOf,
  resolveByline,
  resolveImage,
} from './format'

/**
 * The standard gazette card, shared by the homepage and the article index.
 * The kicker reads "Public Works · Dispatch". A document of state — a decree,
 * a statement, a notice — is set apart by the seal and a coral rule at its
 * head, and shows the crest in place of a picture. An article in a style
 * wears it here too: the style's colours in the kicker and rules, its mark
 * in place of the seal, and the same rule at its head, so it stands out a
 * little in a mixed listing. The whole card is clickable via a stretched
 * title link; relations are rendered only when populated.
 */
export async function ArticleCard({ article }: { article: Article }) {
  const image = resolveImage(article.featuredImage, 'card')
  const { section, type } = kickerOf(article)
  const byline = resolveByline(article)
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const href = articleHref(article)
  const formal = isStateDocument(article)
  const { attrs, wears, Mark } = dress('gazette', await getArticleStyle(article))
  const Badge = Mark ?? Seal

  return (
    <article
      {...attrs}
      className={cn(
        'group relative flex flex-col border border-sand-300 bg-sand-50 transition-colors hover:border-(--accent)',
        (formal || wears) && 'border-t-2 border-t-(--seal) hover:border-t-(--seal)',
      )}
    >
      <div className="border-b border-sand-300 bg-(--accent-wash)">
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
          <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-3">
            <Crest className={cn('h-16 w-auto', formal ? 'text-sea-900/30' : 'text-sand-300')} />
            {formal ? (
              <span className="font-label text-[10px] uppercase tracking-[0.24em] text-ink-400">
                The Nation of Azania
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex flex-wrap items-center gap-x-2 font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)">
          {section ? (
            <>
              <span className="text-sea-700">{section.name}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          {formal ? (
            <span className="inline-flex items-center gap-1.5 text-(--seal-ink)">
              <Badge className="h-3 w-3 shrink-0" />
              {type}
            </span>
          ) : (
            <span>{type}</span>
          )}
          {date ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={dateTime} className="text-ink-400">
                {date}
              </time>
            </>
          ) : null}
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
