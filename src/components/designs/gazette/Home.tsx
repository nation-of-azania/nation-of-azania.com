import Link from 'next/link'

import { ArticleCard } from '@/components/site/ArticleCard'
import { Crest } from '@/components/site/Crest'
import { DocumentCard } from '@/components/site/DocumentCard'
import { FeedLink } from '@/components/site/FeedLink'
import { FlagTick } from '@/components/site/FlagTick'
import { LinkButton } from '@/components/site/LinkButton'
import { SectionHeading } from '@/components/site/SectionHeading'
import { archiveHref, contextHref, feedHref } from '@/lib/site'

import type { HomeProps } from '../types'

/** The Gazette's front page: masthead, the offices of state, Documents of State, latest dispatches. */
export function Home({ top, sections, pages, pinned, latest }: HomeProps) {
  const archive = archiveHref(top)
  const about = pages[0]

  return (
    <>
      {/* Masthead */}
      <section className="relative overflow-hidden border-b border-sand-300">
        <Crest className="pointer-events-none absolute -right-16 top-1/2 hidden h-[480px] w-auto -translate-y-1/2 text-sea-900/[0.05] lg:block" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-saffron-600">
            <FlagTick />
            The Nation of Azania
          </p>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-5xl leading-[1.05] text-sea-950 md:text-6xl">
            A harbour nation, kept in good record.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700">
            Azania was founded on the Rulercraft realm by sailors and builders who raised a
            lighthouse on Founders’ Point and a city around the harbour beneath it. Governed by
            the Chancellor and the Council and bound by the Charter, the nation publishes its
            decrees, dispatches and works openly in this Gazette. Builders and traders of good
            standing are always welcome.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <LinkButton href={archive} variant="primary">
              Read the Gazette
            </LinkButton>
            {about ? (
              <LinkButton href={about.href} variant="outline">
                {about.label}
              </LinkButton>
            ) : null}
          </div>
        </div>
      </section>

      {/* The offices of state: the context tree's first level under Government. */}
      {sections.length > 0 ? (
        <nav aria-label="Offices of state" className="border-b border-sand-300 bg-sand-100/60">
          <ul className="mx-auto flex max-w-6xl flex-wrap gap-x-10 gap-y-2 px-6 py-4">
            {sections.map((section) => (
              <li key={section.id}>
                <Link
                  href={contextHref(section)}
                  className="group inline-flex flex-wrap items-baseline gap-x-2 text-sm"
                >
                  <span className="font-display text-base text-sea-900 transition-colors group-hover:text-sea-700">
                    {section.name}
                  </span>
                  {section.tagline ? (
                    <span className="text-ink-500">— {section.tagline}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/* Documents of State */}
      <section
        aria-labelledby="documents-of-state"
        className="mx-auto max-w-6xl px-6 pt-16 md:pt-20"
      >
        <SectionHeading
          id="documents-of-state"
          eyebrow="Standing Record"
          title="Documents of State"
        />
        {pinned.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {pinned.map((article) => (
              <DocumentCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="mt-8 text-sm italic text-ink-500">
            No standing documents yet. The Charter will appear here when the Chancellery enters
            it into the record.
          </p>
        )}
      </section>

      {/* Latest from the Gazette */}
      <section aria-labelledby="latest-gazette" className="mx-auto max-w-6xl px-6 pt-16 md:pt-20">
        <SectionHeading
          id="latest-gazette"
          eyebrow="Dispatches"
          title="Latest from the Gazette"
          action={
            <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm font-medium">
              <Link href={archive} className="text-sea-700 transition-colors hover:text-sea-600">
                All articles →
              </Link>
              <FeedLink
                href={feedHref(top)}
                className="text-saffron-600 transition-colors hover:text-sea-700"
                title="The Gazette as an RSS feed"
              >
                Subscribe
              </FeedLink>
            </span>
          }
        />
        {latest.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center border border-sand-300 bg-sand-100/60 px-6 py-16 text-center">
            <Crest className="h-12 w-auto text-sand-300" />
            <p className="mt-5 font-display text-xl text-ink-700">
              The Gazette has no published articles yet.
            </p>
            <p className="mt-2 text-sm text-ink-500">
              When the first dispatch is published, it will appear here.
            </p>
          </div>
        )}
      </section>

      {/* Contribution band */}
      <section aria-labelledby="contribute" className="mt-20 bg-sea-900 text-sand-100">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <Crest className="hidden h-14 w-auto shrink-0 text-saffron-300 sm:block" />
            <div>
              <h2 id="contribute" className="font-display text-2xl text-sand-50">
                Add to the record.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-sand-200/85">
                Residents of Azania may draft dispatches, decrees and chronicles for the
                Gazette. Sign in to the national registry to begin.
              </p>
            </div>
          </div>
          <LinkButton href="/admin" prefetch={false} variant="gold" className="shrink-0">
            Enter the Registry
          </LinkButton>
        </div>
      </section>
    </>
  )
}
