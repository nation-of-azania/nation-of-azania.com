import Image from 'next/image'
import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { BylineAvatar } from '@/components/site/BylineAvatar'
import {
  formatDate,
  kickerOf,
  resolveByline,
  resolveImage,
} from '@/components/site/format'
import { TimesByline } from '@/components/times/TimesByline'
import { contextHref } from '@/lib/site'

import type { ArticleProps } from '../types'

const OPINION_NOTE = 'A signed view, not the paper’s reporting.'

/**
 * A Times story: kicker ("Markets · News"), Archivo headline, dek, byline, a
 * cinnabar rule. An opinion piece is a person speaking: a solid "Opinion"
 * tag, a great opening quotation mark behind the headline, the writer's head
 * at 64px, and the desk's standing note that this is a signed view.
 */
export function Article({ article, chain, draft }: ArticleProps) {
  const top = chain[0]
  const { section, parts } = kickerOf(article)
  const byline = resolveByline(article)
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const opinion = article.type === 'opinion'
  const words = opinion ? parts.filter((part) => part !== 'Opinion') : parts
  const note = (section?.name.toLowerCase() === 'opinion' && section.tagline) || OPINION_NOTE

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {draft ? <PreviewTools /> : null}
      <header className="relative">
        {opinion ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-4 top-4 hidden select-none font-display text-[200px] leading-none text-cinnabar-200/70 md:-left-24 md:block"
          >
            “
          </span>
        ) : null}
        <p className="relative flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cinnabar-700">
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
              {section && word === section.name ? (
                <Link href={contextHref(section)} className="hover:text-cinnabar-800">
                  {word}
                </Link>
              ) : (
                <span>{word}</span>
              )}
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
        <h1 className="relative mt-3 font-news text-4xl font-black leading-[1.03] text-news-900 md:text-5xl">
          {article.title}
        </h1>
        {article.excerpt ? (
          <p className="relative mt-4 text-lg leading-relaxed text-news-700 md:text-xl">
            {article.excerpt}
          </p>
        ) : null}
        {byline && opinion ? (
          <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <BylineAvatar byline={byline} size={64} tone="times" />
            <div className="min-w-0">
              <p className="font-news text-lg font-bold text-news-900">
                <span className="font-medium text-news-500">By </span>
                {byline.name}
              </p>
              {byline.title ? <p className="mt-0.5 text-sm text-news-500">{byline.title}</p> : null}
              <p className="mt-2 flex items-center gap-2 text-xs italic text-cinnabar-800">
                <span aria-hidden="true" className="h-px w-4 bg-lagoon-500" />
                {note}
              </p>
            </div>
          </div>
        ) : byline ? (
          <TimesByline byline={byline} className="mt-6" />
        ) : null}
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

      <footer className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-news-200 pt-6 text-sm font-semibold">
        {section ? (
          <Link
            href={contextHref(section)}
            className="text-cinnabar-700 transition-colors hover:text-cinnabar-800"
          >
            ← {section.name}
          </Link>
        ) : null}
        <Link
          href={top ? contextHref(top) : '/'}
          className="text-cinnabar-700 transition-colors hover:text-cinnabar-800"
        >
          {section ? 'Front Page' : `← ${top?.name ?? 'Front Page'}`}
        </Link>
      </footer>
    </article>
  )
}
