import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { TimesCard } from '@/components/times/TimesCard'
import { articleHref, formatDate, resolveImage } from '@/components/site/format'
import { getLatestArticles } from '@/lib/queries'

export const revalidate = 120

export const metadata: Metadata = {
  title: 'The Condor Times',
  description:
    'The independent press of Condoria — news, markets and opinion from the high valley, published without the Council’s leave.',
}

export default async function TimesFrontPage() {
  const stories = await getLatestArticles('times', 12, { includePinned: true })
  const lead = stories.find((s) => s.pinned) ?? stories[0]
  const rest = lead ? stories.filter((s) => s.id !== lead.id) : []

  if (!lead) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="text-[11px] uppercase tracking-[0.24em] text-maroon-700">The Condor Times</p>
        <h1 className="mt-4 font-news text-3xl font-black text-news-900">
          The presses are warm, but the front page is bare.
        </h1>
        <p className="mt-3 text-news-500">
          No stories have been filed yet. When the first is published, it prints here.
        </p>
      </div>
    )
  }

  const leadCategory =
    lead.category && typeof lead.category === 'object' ? lead.category : null
  const leadAuthor = lead.author && typeof lead.author === 'object' ? lead.author : null
  const leadImage = resolveImage(lead.featuredImage, 'hero')
  const leadDateTime = lead.publishedAt ?? lead.createdAt
  const leadDate = formatDate(leadDateTime)
  const leadHref = articleHref(lead)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
      {/* Lead story */}
      <section className="grid gap-8 border-b border-news-200 pb-12 md:grid-cols-2 md:gap-10">
        <div className="order-2 flex flex-col justify-center md:order-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-maroon-700">
            <span className="bg-maroon-800 px-1.5 py-0.5 text-news-50">Lead Story</span>
            {leadCategory ? <span>{leadCategory.name}</span> : null}
            {leadDate ? (
              <>
                <span aria-hidden="true" className="text-news-300">·</span>
                <time dateTime={leadDateTime} className="font-medium text-news-500">
                  {leadDate}
                </time>
              </>
            ) : null}
          </p>
          <h1 className="mt-3 font-news text-4xl font-black leading-[1.02] text-news-900 md:text-5xl">
            <Link href={leadHref} className="transition-colors hover:text-maroon-800">
              {lead.title}
            </Link>
          </h1>
          {lead.excerpt ? (
            <p className="mt-4 text-lg leading-relaxed text-news-700">{lead.excerpt}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {leadAuthor ? (
              <span className="uppercase tracking-wider text-news-500">By {leadAuthor.name}</span>
            ) : null}
            <Link
              href={leadHref}
              className="font-semibold text-maroon-700 transition-colors hover:text-maroon-800"
            >
              Read the full story →
            </Link>
          </div>
        </div>
        {leadImage ? (
          <div className="order-1 overflow-hidden md:order-2">
            <Image
              src={leadImage.url}
              alt={leadImage.alt}
              width={leadImage.width}
              height={leadImage.height}
              sizes="(min-width: 768px) 560px, 92vw"
              priority
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        ) : null}
      </section>

      {/* More from the Times */}
      {rest.length > 0 ? (
        <section className="mt-12">
          <p className="mb-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-news-500">
            More from the Times
          </p>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((article) => (
              <TimesCard key={article.id} article={article} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
