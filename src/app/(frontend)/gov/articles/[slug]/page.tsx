import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { DoubleRule } from '@/components/site/SectionHeading'
import { formatDate, resolveImage } from '@/components/site/format'
import { getAllArticleSlugs, getArticleBySlug } from '@/lib/queries'

export const revalidate = 120

type Props = {
  // Next 16: params is a Promise and must be awaited.
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs('government')
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug('government', slug)
  if (!article) return { title: 'Record not found' }
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
  }
}

export default async function GovArticlePage({ params }: Props) {
  const { slug } = await params
  const article = await getArticleBySlug('government', slug)
  if (!article) notFound()

  const category =
    article.category && typeof article.category === 'object' ? article.category : null
  const author = article.author && typeof article.author === 'object' ? article.author : null
  const hero = resolveImage(article.featuredImage, 'hero')
  const dateTime = article.publishedAt ?? article.createdAt
  const date = formatDate(dateTime)

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <header>
        <p className="flex flex-wrap items-center gap-x-2.5 text-[11px] uppercase tracking-[0.2em] text-gold-600">
          {category ? (
            <>
              <span className="text-pine-700">{category.name}</span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          {date ? <time dateTime={dateTime}>{date}</time> : null}
        </p>
        <h1 className="mt-4 text-balance font-display text-4xl leading-[1.08] text-pine-950 md:text-5xl">
          {article.title}
        </h1>
        {article.excerpt ? (
          <p className="mt-5 text-lg leading-relaxed text-ink-700 md:text-xl">
            {article.excerpt}
          </p>
        ) : null}
        {author || article.pinned ? (
          <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-500">
            {author ? <span>By {author.name}</span> : null}
            {article.pinned ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-oxide-700">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-oxide-600" />
                Pinned document
              </span>
            ) : null}
          </p>
        ) : null}
        <DoubleRule className="mt-7" />
      </header>

      {hero ? (
        <figure className="mt-8">
          <div className="border border-parchment-300 bg-parchment-100 p-1.5">
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

      <footer className="mt-14 border-t border-parchment-300 pt-6">
        <Link
          href="/gov/articles"
          className="text-sm font-medium text-pine-700 transition-colors hover:text-pine-600"
        >
          ← The Gazette
        </Link>
      </footer>
    </article>
  )
}
