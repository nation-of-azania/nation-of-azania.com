import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { PreviewTools } from '@/components/PreviewTools'
import { ArticleLocations } from '@/components/site/ArticleLocations'
import { RichText } from '@/components/RichText'
import { Crest } from '@/components/site/Crest'
import { FlagTick } from '@/components/site/FlagTick'
import { GazetteByline, GazetteSignature } from '@/components/site/GazetteByline'
import { Seal } from '@/components/site/Seal'
import { DoubleRule } from '@/components/site/SectionHeading'
import {
  formatDate,
  isStateDocument,
  kickerOf,
  resolveByline,
  resolveImage,
} from '@/components/site/format'
import { dress } from '@/components/styles'
import { archiveHref, contextHref } from '@/lib/site'

import type { ArticleProps } from '../types'

/**
 * A Gazette record: kicker ("Public Works · Dispatch"), title, dek and
 * byline. A document of state — a decree, a statement, a notice — is set as
 * an instrument instead: the crest and the nation's name as a letterhead,
 * the type under the seal, everything centred, and a signature block to
 * close it, with the Seal of the Nation pressed beside a decree's. A record
 * in a style keeps the letterhead and the crest, and takes the style's
 * colours for its kicker and hairline, its faces for the headline and
 * labels, and its mark in place of the seal.
 */
export function Article({ article, chain, style, draft }: ArticleProps) {
  const top = chain[0]
  const { section, type } = kickerOf(article)
  const byline = resolveByline(article)
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const formal = isStateDocument(article)
  const decree = article.type === 'decree'
  const { attrs, Mark } = dress('gazette', style)
  const Badge = Mark ?? Seal

  return (
    <article {...attrs} className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      {draft ? <PreviewTools /> : null}
      <header className={cn(formal && 'text-center')}>
        {formal ? (
          <div className="flex flex-col items-center">
            <Crest className="h-12 w-auto text-sea-900" />
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2.5 font-label text-[11px] uppercase tracking-[0.24em] text-ink-500">
              <FlagTick />
              <span>The Nation of Azania</span>
              {section ? (
                <>
                  <span aria-hidden="true">·</span>
                  <Link href={contextHref(section)} className="text-sea-700 hover:text-sea-600">
                    {section.name}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 font-label text-[11px] uppercase tracking-[0.24em] text-(--seal-ink)">
              <Badge className="h-3.5 w-3.5 shrink-0" />
              <span>{type}</span>
              {date ? (
                <>
                  <span aria-hidden="true">·</span>
                  <time dateTime={dateTime} className="text-ink-500">
                    {date}
                  </time>
                </>
              ) : null}
            </p>
          </div>
        ) : (
          <p className="flex flex-wrap items-center gap-x-2.5 font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)">
            {section ? (
              <>
                <Link href={contextHref(section)} className="text-sea-700 hover:text-sea-600">
                  {section.name}
                </Link>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span>{type}</span>
            {date ? (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={dateTime} className="text-ink-400">
                  {date}
                </time>
              </>
            ) : null}
          </p>
        )}
        <h1
          className={cn(
            'mt-4 text-balance font-display text-4xl leading-[1.08] text-sea-950 md:text-5xl',
            formal && 'mt-6',
          )}
        >
          {article.title}
        </h1>
        {article.excerpt ? (
          <p
            className={cn(
              'mt-5 text-lg leading-relaxed text-ink-700 md:text-xl',
              formal && 'mx-auto max-w-2xl',
            )}
          >
            {article.excerpt}
          </p>
        ) : null}
        {byline || article.pinned ? (
          <div
            className={cn(
              'mt-6 flex flex-wrap items-center gap-x-6 gap-y-3',
              formal ? 'justify-center' : 'justify-between',
            )}
          >
            {byline ? <GazetteByline byline={byline} /> : null}
            {article.pinned ? (
              <span className="inline-flex items-center gap-1.5 font-label text-[11px] uppercase tracking-[0.18em] text-(--seal-ink)">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-(--seal)" />
                Pinned document
              </span>
            ) : null}
          </div>
        ) : null}
        <DoubleRule className="mt-7" />
      </header>

      {hero ? (
        <figure className="mt-8">
          <div className="border border-sand-300 bg-sand-100 p-1.5">
            <Image
              src={hero.url}
              alt={hero.alt}
              width={hero.width}
              height={hero.height}
              sizes="(min-width: 768px) 720px, 92vw"
              priority
              className="w-full"
            />
          </div>
          {hero.alt ? (
            <figcaption className="mt-2.5 text-xs text-ink-400">{hero.alt}</figcaption>
          ) : null}
        </figure>
      ) : null}

      <RichText data={article.content} style={style} className="mt-10" />

      {byline && formal ? (
        <GazetteSignature
          byline={byline}
          dateTime={dateTime}
          date={date}
          heading={decree ? 'Given under the hand of' : 'Issued by'}
          sealed={decree}
          className="mt-12"
        />
      ) : null}

      <ArticleLocations article={article} className="mt-12" tone="gazette" />

      <footer className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-sand-300 pt-6 text-sm font-medium">
        {section ? (
          <Link
            href={contextHref(section)}
            className="text-sea-700 transition-colors hover:text-sea-600"
          >
            ← {section.name}
          </Link>
        ) : null}
        <Link
          href={top ? archiveHref(top) : '/'}
          className="text-sea-700 transition-colors hover:text-sea-600"
        >
          {section ? 'The Gazette' : '← The Gazette'}
        </Link>
      </footer>
    </article>
  )
}
