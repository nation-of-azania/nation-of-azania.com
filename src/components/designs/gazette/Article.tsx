import Image from 'next/image'
import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { GazetteByline, GazetteSignature } from '@/components/site/GazetteByline'
import { DoubleRule } from '@/components/site/SectionHeading'
import {
  formatDate,
  resolveByline,
  resolveImage,
  sectionOf,
  typeLabel,
} from '@/components/site/format'
import { archiveHref } from '@/lib/site'

import type { ArticleProps } from '../types'

/** A Gazette record: kicker, title, dek, byline, and a signature for documents of state. */
export function Article({ article, chain, draft }: ArticleProps) {
  const top = chain[0]
  const section = sectionOf(article)
  const byline = resolveByline(article)
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      {draft ? <PreviewTools /> : null}
      <header>
        <p className="flex flex-wrap items-center gap-x-2.5 text-[11px] uppercase tracking-[0.2em] text-saffron-600">
          {section ? (
            <>
              <Link href={section.path ?? '#'} className="text-sea-700 hover:text-sea-600">
                {section.name}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span>{typeLabel(article)}</span>
          {date ? <span aria-hidden="true">·</span> : null}
          {date ? <time dateTime={dateTime}>{date}</time> : null}
        </p>
        <h1 className="mt-4 text-balance font-display text-4xl leading-[1.08] text-sea-950 md:text-5xl">
          {article.title}
        </h1>
        {article.excerpt ? (
          <p className="mt-5 text-lg leading-relaxed text-ink-700 md:text-xl">
            {article.excerpt}
          </p>
        ) : null}
        {byline || article.pinned ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            {byline ? <GazetteByline byline={byline} /> : null}
            {article.pinned ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-coral-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-coral-600" />
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

      <RichText data={article.content} className="mt-10" />

      {byline && article.pinned ? (
        <GazetteSignature byline={byline} dateTime={dateTime} date={date} className="mt-12" />
      ) : null}

      <footer className="mt-14 border-t border-sand-300 pt-6">
        <Link
          href={top ? archiveHref(top) : '/'}
          className="text-sm font-medium text-sea-700 transition-colors hover:text-sea-600"
        >
          ← The Gazette
        </Link>
      </footer>
    </article>
  )
}
