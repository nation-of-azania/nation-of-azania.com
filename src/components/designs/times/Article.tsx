import Image from 'next/image'
import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { BylineAvatar } from '@/components/site/BylineAvatar'
import {
  formatDate,
  kickerOf,
  resolveByline,
  resolveImage,
} from '@/components/site/format'
import { dress } from '@/components/styles'
import { TimesByline } from '@/components/times/TimesByline'
import { contextHref } from '@/lib/site'

import type { ArticleProps } from '../types'

const OPINION_NOTE = 'A signed view, not the paper’s reporting.'

/**
 * The Times' box, for a style that switches it on (src/components/styles/slots.ts):
 * header and body in a rounded panel of the style's box colours, padded
 * generously, with the footer left outside on the newsprint.
 */
const BOX =
  'rounded-3xl border-2 border-(--box-edge) bg-(--box-ground) px-5 py-7 sm:px-8 sm:py-9 md:px-12 md:py-12'

/**
 * A Times story: kicker ("Markets · News"), Archivo headline, dek, byline, a
 * cinnabar rule. An opinion piece is a person speaking: a solid "Opinion"
 * tag, a great opening quotation mark behind the headline, the writer's head
 * at 64px, and the desk's standing note that this is a signed view. A story
 * in a style keeps all of this, in the style's colours and faces, with the
 * style's mark in the Opinion tag as the column's own badge — and, when the
 * style has the box on, sits in it, the quotation mark tucked inside.
 */
export function Article({ article, chain, style, draft }: ArticleProps) {
  const top = chain[0]
  const { section, parts } = kickerOf(article)
  const byline = resolveByline(article)
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)
  const opinion = article.type === 'opinion'
  const words = opinion ? parts.filter((part) => part !== 'Opinion') : parts
  const note = (section?.name.toLowerCase() === 'opinion' && section.tagline) || OPINION_NOTE
  const { attrs, Mark, boxed } = dress('times', style)

  return (
    <article {...attrs} className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {draft ? <PreviewTools /> : null}
      <div className={boxed ? BOX : undefined}>
        <header className="relative">
          {opinion ? (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute hidden select-none font-display text-[200px] leading-none text-(--accent-faint)/70 md:block',
                boxed ? '-left-7 top-2' : '-left-4 top-4 md:-left-24',
              )}
            >
              “
            </span>
          ) : null}
          <p className="relative flex flex-wrap items-center gap-x-2 font-label text-[11px] font-semibold uppercase tracking-[0.16em] text-(--accent-ink)">
            {opinion ? (
              <span className="inline-flex items-center gap-1 bg-(--accent) px-1.5 py-0.5 text-[10px] text-news-50">
                {Mark ? <Mark className="h-2.5 w-2.5 shrink-0" /> : null}
                Opinion
              </span>
            ) : null}
            {words.map((word, index) => (
              <span key={word} className="flex items-center gap-x-2">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-news-300">
                    ·
                  </span>
                ) : null}
                {section && word === section.name ? (
                  <Link href={contextHref(section)} className="hover:text-(--accent)">
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
                <p className="mt-2 flex items-center gap-2 text-xs italic text-(--accent)">
                  <span aria-hidden="true" className="h-px w-4 bg-lagoon-500" />
                  {note}
                </p>
              </div>
            </div>
          ) : byline ? (
            <TimesByline byline={byline} className="mt-6" />
          ) : null}
          <div aria-hidden="true" className="mt-6 h-0.5 w-full bg-(--accent)" />
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
              className={cn('w-full', boxed && 'rounded-xl')}
            />
            {hero.alt ? (
              <figcaption className="mt-2.5 text-xs text-news-500">{hero.alt}</figcaption>
            ) : null}
          </figure>
        ) : null}

        <RichText data={article.content} tone="times" className="mt-10" />
      </div>

      <footer className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-news-200 pt-6 text-sm font-semibold">
        {section ? (
          <Link
            href={contextHref(section)}
            className="text-(--accent-ink) transition-colors hover:text-(--accent)"
          >
            ← {section.name}
          </Link>
        ) : null}
        <Link
          href={top ? contextHref(top) : '/'}
          className="text-(--accent-ink) transition-colors hover:text-(--accent)"
        >
          {section ? 'Front Page' : `← ${top?.name ?? 'Front Page'}`}
        </Link>
      </footer>
    </article>
  )
}
