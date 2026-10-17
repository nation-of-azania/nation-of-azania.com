import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { formatDate, resolveImage } from '@/components/site/format'
import { getAllArticleSlugs, getArticleBySlug } from '@/lib/queries'

export const revalidate = 120

type Props = {
  // Next 16: params is a Promise and must be awaited.
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs('times')
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug('times', slug)
  if (!article) return { title: 'Story not found' }
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
  }
}

export default async function TimesArticlePage({ params }: Props) {
  const { slug } = await params
  const article = await getArticleBySlug('times', slug)
  if (!article) notFound()

  const category =
    article.category && typeof article.category === 'object' ? article.category : null
  const author = article.author && typeof article.author === 'object' ? article.author : null
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <header>
        <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-maroon-700">
          {category ? <span>{category.name}</span> : null}
          {category && date ? <span aria-hidden="true" className="text-news-300">·</span> : null}
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
        {author ? (
          <p className="mt-5 text-sm uppercase tracking-wider text-news-500">By {author.name}</p>
        ) : null}
        <div aria-hidden="true" className="mt-6 h-0.5 w-full bg-maroon-800" />
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
          href="/times"
          className="text-sm font-semibold text-maroon-700 transition-colors hover:text-maroon-800"
        >
          ← The Condor Times
        </Link>
      </footer>
    </article>
  )
}
