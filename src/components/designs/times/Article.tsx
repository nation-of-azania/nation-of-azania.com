import Image from 'next/image'
import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import {
  formatDate,
  resolveByline,
  resolveImage,
  sectionOf,
  typeLabel,
} from '@/components/site/format'
import { TimesByline } from '@/components/times/TimesByline'
import { contextHref } from '@/lib/site'

import type { ArticleProps } from '../types'

/** A Times story: kicker, Archivo headline, dek, byline, a cinnabar rule. */
export function Article({ article, chain, draft }: ArticleProps) {
  const top = chain[0]
  const section = sectionOf(article)
  const kicker = section?.name ?? typeLabel(article)
  const byline = resolveByline(article)
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {draft ? <PreviewTools /> : null}
      <header>
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cinnabar-700">
          {kicker ? (
            section ? (
              <Link href={contextHref(section)} className="hover:text-cinnabar-800">
                {kicker}
              </Link>
            ) : (
              <span>{kicker}</span>
            )
          ) : null}
          {kicker && date ? <span aria-hidden="true" className="text-news-300">·</span> : null}
          {date ? (
            <time dateTime={dateTime} className="font-medium text-news-500">
              {date}
            </time>
          ) : null}
        </p>
        <h1 className="mt-3 font-news text-4xl font-black leading-[1.03] text-news-900 md:text-5xl">
          {article.title}
        </h1>
        {article.excerpt ? (
          <p className="mt-4 text-lg leading-relaxed text-news-700 md:text-xl">
            {article.excerpt}
          </p>
        ) : null}
        {byline ? <TimesByline byline={byline} className="mt-6" /> : null}
        <div aria-hidden="true" className="mt-6 h-0.5 w-full bg-cinnabar-800" />
      </header>

      {hero ? (
        <figure className="mt-8">
          <Image
            src={hero.url}
            alt={hero.alt}
            width={hero.width}
            height={hero.height}
            sizes="(min-width: 768px) 720px, 92vw"
            priority
            className="w-full"
          />
          {hero.alt ? (
            <figcaption className="mt-2.5 text-xs text-news-500">{hero.alt}</figcaption>
          ) : null}
        </figure>
      ) : null}

      <RichText data={article.content} tone="times" className="mt-10" />

      <footer className="mt-14 border-t border-news-200 pt-6">
        <Link
          href={top ? contextHref(top) : '/'}
          className="text-sm font-semibold text-cinnabar-700 transition-colors hover:text-cinnabar-800"
        >
          ← {top?.name ?? 'Front Page'}
        </Link>
      </footer>
    </article>
  )
}
