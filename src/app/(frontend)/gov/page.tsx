import type { Metadata } from 'next'
import Link from 'next/link'

import { ArticleCard } from '@/components/site/ArticleCard'
import { Crest } from '@/components/site/Crest'
import { DocumentCard } from '@/components/site/DocumentCard'
import { LinkButton } from '@/components/site/LinkButton'
import { SectionHeading } from '@/components/site/SectionHeading'
import { getLatestArticles, getPinnedArticles } from '@/lib/queries'

export const revalidate = 120

export const metadata: Metadata = {
  title: 'Official Gazette of the Nation',
  description:
    'The official record of the Nation of Condoria on the Rulercraft realm — charter, decrees, dispatches and chronicles from the high valley.',
}

export default async function GovHomePage() {
  const [pinned, latest] = await Promise.all([
    getPinnedArticles('government', 4),
    getLatestArticles('government', 6),
  ])

  return (
    <>
      {/* Masthead */}
      <section className="relative overflow-hidden border-b border-parchment-300">
        <Crest className="pointer-events-none absolute -right-16 top-1/2 hidden h-[480px] w-auto -translate-y-1/2 text-pine-900/[0.05] lg:block" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
          <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-gold-600">
            {/* Flag tick — maroon and gold. */}
            <span aria-hidden="true" className="flex h-3 w-6 overflow-hidden rounded-[1px]">
              <span className="h-full w-1/2 bg-flag-brown" />
              <span className="h-full w-1/2 bg-flag-gold" />
            </span>
            The Nation of Condoria
          </p>
          <h1 className="mt-4 max-w-3xl text-balance font-display text-5xl leading-[1.05] text-pine-950 md:text-6xl">
            A mountain nation, kept in good record.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700">
            Condoria was founded on the Rulercraft realm by builders who crossed the glacier
            and settled the high valley beneath the condor’s ridge. Governed by an elected
            council and bound by its charter, the nation publishes its decrees, dispatches and
            works openly in this gazette. Builders of good standing are always welcome.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <LinkButton href="/gov/articles" variant="primary">
              Read the Gazette
            </LinkButton>
            <LinkButton href="/gov/about" variant="outline">
              About the Nation
            </LinkButton>
          </div>
        </div>
      </section>

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
            No standing documents yet. The charter will appear here when the council enters it
            into the record.
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
            <Link
              href="/gov/articles"
              className="text-sm font-medium text-pine-700 transition-colors hover:text-pine-600"
            >
              All articles →
            </Link>
          }
        />
        {latest.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="mt-8 flex flex-col items-center border border-parchment-300 bg-parchment-100/60 px-6 py-16 text-center">
            <Crest className="h-12 w-auto text-parchment-300" />
            <p className="mt-5 font-display text-xl text-ink-700">
              The gazette has no published articles yet.
            </p>
            <p className="mt-2 text-sm text-ink-500">
              When the first dispatch is published, it will appear here.
            </p>
          </div>
        )}
      </section>

      {/* Contribution band */}
      <section aria-labelledby="contribute" className="mt-20 bg-pine-900 text-parchment-100">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-6 py-14 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-5">
            <Crest className="hidden h-14 w-auto shrink-0 text-gold-300 sm:block" />
            <div>
              <h2 id="contribute" className="font-display text-2xl text-parchment-50">
                Add to the record.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-parchment-200/85">
                Residents of Condoria may draft dispatches, decrees and chronicles for the
                gazette. Sign in to the national registry to begin.
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
