import type { Metadata } from 'next'
import Link from 'next/link'

import { ArticleCard } from '@/components/site/ArticleCard'
import { Crest } from '@/components/site/Crest'
import { Pagination } from '@/components/site/Pagination'
import { DoubleRule } from '@/components/site/SectionHeading'
import { getArticlesPage } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'The Gazette',
  description:
    'All published records of the Nation of Condoria — decrees, dispatches and chronicles, newest first.',
}

type Props = {
  // Next 16: searchParams is a Promise and must be awaited.
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
}

export default async function GovArticlesIndexPage({ searchParams }: Props) {
  const { page: rawPage } = await searchParams
  const page = parsePage(rawPage)
  const result = await getArticlesPage('government', page)
  const docs = result?.docs ?? []
  const totalDocs = result?.totalDocs ?? 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <header>
        <p className="text-[11px] uppercase tracking-[0.24em] text-gold-600">
          Published by Authority of the Council
        </p>
        <h1 className="mt-3 font-display text-4xl text-pine-950 md:text-5xl">
          The Condoria Gazette
        </h1>
        <p className="mt-4 max-w-2xl text-ink-500">
          Decrees, dispatches and chronicles of the nation, newest first.
        </p>
        <DoubleRule className="mt-8" />
        {totalDocs > 0 ? (
          <p className="mt-3 text-right text-[11px] uppercase tracking-[0.2em] text-ink-400">
            {totalDocs} {totalDocs === 1 ? 'record' : 'records'} in the archive
          </p>
        ) : null}
      </header>

      {docs.length > 0 ? (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination
            page={result?.page ?? page}
            totalPages={result?.totalPages ?? 1}
            hasPrevPage={result?.hasPrevPage ?? false}
            hasNextPage={result?.hasNextPage ?? false}
          />
        </>
      ) : totalDocs > 0 ? (
        <div className="mt-12 border border-parchment-300 bg-parchment-100/60 px-6 py-16 text-center">
          <p className="font-display text-xl text-ink-700">
            There is no page {page} in the record.
          </p>
          <p className="mt-3 text-sm text-ink-500">
            <Link href="/gov/articles" className="font-medium text-pine-700 hover:text-pine-600">
              Return to the first page →
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center border border-parchment-300 bg-parchment-100/60 px-6 py-20 text-center">
          <Crest className="h-14 w-auto text-parchment-300" />
          <p className="mt-6 font-display text-xl text-ink-700">
            The gazette has no published articles yet.
          </p>
          <p className="mt-2 max-w-md text-sm text-ink-500">
            The council has entered nothing into the public record. When the first dispatch is
            published, it will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
