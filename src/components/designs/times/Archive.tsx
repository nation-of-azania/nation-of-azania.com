import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { Pagination } from '@/components/site/Pagination'
import { TimesCard } from '@/components/times/TimesCard'
import { TYPE_LABELS } from '@/contexts/designs'
import { archiveHref } from '@/lib/site'

import type { ArchiveProps } from '../types'

/** Every story the Times has printed, newest first, by type. */
export function Archive({ top, result, page, type, types }: ArchiveProps) {
  const docs = result?.docs ?? []
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
      <header className="border-b-2 border-cinnabar-800 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-news-500">{top.name}</p>
        <h1 className="mt-2 font-news text-4xl font-black uppercase tracking-tight text-cinnabar-800 md:text-5xl">
          The Archive
        </h1>
        {types.length > 1 ? (
          <nav aria-label="Filter by type" className="mt-5 flex flex-wrap gap-2">
            {[null, ...types].map((option) => (
              <Link
                key={option ?? 'all'}
                href={archiveHref(top, option)}
                aria-current={option === type ? 'page' : undefined}
                className={cn(
                  'px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors',
                  option === type
                    ? 'bg-cinnabar-800 text-news-50'
                    : 'bg-news-100 text-cinnabar-800 hover:text-lagoon-600',
                )}
              >
                {option ? TYPE_LABELS[option] : 'All'}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      {docs.length > 0 ? (
        <>
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((article) => (
              <TimesCard key={article.id} article={article} />
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
      ) : (
        <p className="mt-10 text-news-500">
          {(result?.totalDocs ?? 0) > 0 ? `There is no page ${page}.` : 'Nothing printed here yet.'}
        </p>
      )}
    </div>
  )
}
