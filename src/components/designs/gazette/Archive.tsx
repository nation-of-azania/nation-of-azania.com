import Link from 'next/link'

import { ArticleCard } from '@/components/site/ArticleCard'
import { Crest } from '@/components/site/Crest'
import { Pagination } from '@/components/site/Pagination'
import { Seal } from '@/components/site/Seal'
import { DoubleRule } from '@/components/site/SectionHeading'
import { isStateDocument } from '@/components/site/format'
import { cn } from '@/blocks/components/shared'
import { TYPE_LABELS } from '@/contexts/designs'
import { archiveHref } from '@/lib/site'

import type { ArchiveProps } from '../types'

/** The Gazette's archive: every record under Government, newest first, by type. */
export function Archive({ top, result, page, type, types }: ArchiveProps) {
  const docs = result?.docs ?? []
  const totalDocs = result?.totalDocs ?? 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <header>
        <p className="text-[11px] uppercase tracking-[0.24em] text-saffron-600">
          Published by Authority of the Chancellery
        </p>
        <h1 className="mt-3 font-display text-4xl text-sea-950 md:text-5xl">
          The Azania Gazette
        </h1>
        <p className="mt-4 max-w-2xl text-ink-500">
          Decrees, dispatches and chronicles of the nation, newest first.
        </p>
        {types.length > 1 ? (
          <nav aria-label="Filter by type" className="mt-8">
            <p className="text-[11px] uppercase tracking-[0.2em] text-ink-400">Kind of record</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[null, ...types].map((option) => (
                <li key={option ?? 'all'}>
                  <Link
                    href={archiveHref(top, option)}
                    aria-current={option === type ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-1.5 border px-3 py-1 text-[12px] uppercase tracking-[0.14em] transition-colors',
                      option === type
                        ? 'border-sea-800 bg-sea-800 text-sand-50'
                        : 'border-sand-300 text-sea-800 hover:border-saffron-400',
                    )}
                  >
                    {option && isStateDocument({ type: option }) ? (
                      <Seal
                        className={cn('h-3 w-3', option === type ? 'text-sand-200' : 'text-coral-700')}
                      />
                    ) : null}
                    {option ? TYPE_LABELS[option] : 'All'}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <DoubleRule className="mt-8" />
        <p className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.2em] text-ink-400">
          <span>{type ? `${TYPE_LABELS[type]} · every office` : 'Every kind, every office'}</span>
          {totalDocs > 0 ? (
            <span>
              {totalDocs} {totalDocs === 1 ? 'record' : 'records'}
            </span>
          ) : null}
        </p>
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
            hrefFor={(target) => archiveHref(top, type, target)}
          />
        </>
      ) : totalDocs > 0 ? (
        <div className="mt-12 border border-sand-300 bg-sand-100/60 px-6 py-16 text-center">
          <p className="font-display text-xl text-ink-700">
            There is no page {page} in the record.
          </p>
          <p className="mt-3 text-sm text-ink-500">
            <Link href={archiveHref(top, type)} className="font-medium text-sea-700 hover:text-sea-600">
              Return to the first page →
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center border border-sand-300 bg-sand-100/60 px-6 py-20 text-center">
          <Crest className="h-14 w-auto text-sand-300" />
          <p className="mt-6 font-display text-xl text-ink-700">
            The Gazette has no published articles yet.
          </p>
          <p className="mt-2 max-w-md text-sm text-ink-500">
            The Chancellery has entered nothing into the public record. When the first dispatch
            is published, it will appear here.
          </p>
        </div>
      )}
    </div>
  )
}
